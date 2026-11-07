"""Pydantic models behind the transports-backed views (:mod:`nbplay.views`).

Each widget splits into a config model the kernel owns and validates, and a
status model the browser owns (hosted with ``owner="client"``), matching the
``nbplay-set`` / ``nbplay-status`` split of the elements.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .widget import (
    THEMES,
    _default_pad_notes,
    _normalize_effects,
    _normalize_mixer_channel,
    _normalize_pad_actions,
    _normalize_return_bus,
    _pad_sends,
    render_waveform,
)

__all__ = (
    "KeyboardConfig",
    "KeyboardStatus",
    "MidiKeyboardConfig",
    "MidiKeyboardStatus",
    "MidiOutputConfig",
    "MidiOutputStatus",
    "MixerConfig",
    "PadsConfig",
    "PadsStatus",
    "SettingsConfig",
    "SettingsStatus",
    "SynthConfig",
    "SynthStatus",
    "TransportConfig",
    "TransportStatus",
)


def _validate_theme(value):
    if value not in THEMES:
        raise ValueError(f"theme must be one of {THEMES}, got {value!r}")
    return value


class _Validated(BaseModel):
    """A model that validates assignments through ``model_validate``.

    Pydantic's own ``validate_assignment`` writes the field from inside
    pydantic-core, where transports' observer cannot see it. Validating a
    copy and assigning every field that changed keeps derived fields (a
    padded send list, a rendered waveform) in step and keeps the hosted
    model observable.
    """

    def __setattr__(self, name, value):
        fields = type(self).model_fields
        if name not in fields:
            super().__setattr__(name, value)
            return
        fresh = type(self).model_validate({**self.model_dump(), name: value})
        for field in fields:
            new = getattr(fresh, field)
            if new != getattr(self, field):
                super().__setattr__(field, new)


class TransportConfig(_Validated):
    """Transport settings the kernel owns."""

    bpm: float = Field(120.0, ge=30, le=300)
    time_signature_num: int = Field(4, ge=1, le=16)
    time_signature_den: int = Field(4, ge=1, le=16)
    loop_enabled: bool = False
    loop_start_bar: int = Field(0, ge=0)
    loop_end_bar: int = Field(4, ge=1)
    session_id: str = ""
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))


class TransportStatus(BaseModel):
    """Transport state the browser clock owns.

    Host it with ``owner="client"``: Python reads it, and moves the clock
    through ``session.command`` rather than assignment.
    """

    is_playing: bool = False
    is_recording: bool = False
    current_beat: float = 0.0
    bar_number: int = 0
    beat_in_bar: int = 0


#: Config fields whose change re-renders the synth waveform preview.
WAVEFORM_PARAMS = ("oscillator_type", "frequency", "amplitude", "sample_rate")


class SynthConfig(_Validated):
    """Synth settings the kernel owns; ``waveform`` is derived.

    The preview is rendered by the Rust oscillators as part of validation,
    so it follows the parameters whether Python assigns them or a browser
    edit is validated into the model, and a client edit's authoritative
    patch already carries the new bytes.
    """

    oscillator_type: Literal["sine", "square", "saw", "noise"] = "sine"
    frequency: float = Field(440.0, ge=20, le=8000)
    amplitude: float = Field(0.8, ge=0, le=1)
    sample_rate: int = Field(44100, ge=8000, le=192000)
    waveform: bytes = b""
    session_id: str = ""
    channel_index: int = -1
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))

    @model_validator(mode="after")
    def _render(self):
        rendered = render_waveform(*(getattr(self, name) for name in WAVEFORM_PARAMS))
        if self.waveform != rendered:
            self.__dict__["waveform"] = rendered
        return self


class SynthStatus(BaseModel):
    """Whether the browser is sounding the synth's tone; browser-owned."""

    is_playing: bool = False


class MixerConfig(_Validated):
    """The mixer console the kernel owns: channels, returns, master.

    Channels, returns and effects are the same dicts the traitlets widget
    syncs, normalized and clamped by the same helpers; every channel carries
    one send level per return. The mixer has no browser-owned status.
    """

    channels: list[dict] = []
    returns: list[dict] = []
    master_gain: float = Field(0.8, ge=0, le=2)
    master_effects: list[dict] = []
    session_id: str = ""
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))

    @field_validator("channels")
    @classmethod
    def _channels(cls, value):
        return [_normalize_mixer_channel(channel, index) for index, channel in enumerate(value or [])]

    @field_validator("returns")
    @classmethod
    def _returns(cls, value):
        return [_normalize_return_bus(bus, index) for index, bus in enumerate(value or [])]

    @field_validator("master_effects")
    @classmethod
    def _master_effects(cls, value):
        return _normalize_effects(value)

    @model_validator(mode="after")
    def _pad(self):
        count = len(self.returns)
        if any(len(channel["sends"]) != count for channel in self.channels):
            self.__dict__["channels"] = [{**channel, "sends": _pad_sends(channel["sends"], count)} for channel in self.channels]
        return self


class PadsConfig(_Validated):
    """The trigger-pad grid the kernel owns.

    ``pad_notes``, ``pad_velocities`` and ``pad_actions`` always cover the
    ``rows`` by ``cols`` grid: the after-validator extends or trims them
    the way the traitlets widget's observers do.
    """

    rows: int = Field(4, ge=1)
    cols: int = Field(4, ge=1)
    velocity: int = Field(100, ge=1, le=127)
    velocity_sensitive: bool = True
    pad_notes: list[int] = []
    pad_velocities: list[int] = []
    pad_actions: list[dict] = []
    sampler_routing: list[dict] = []
    session_id: str = ""
    channel_index: int = -1
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))

    @field_validator("pad_notes")
    @classmethod
    def _notes(cls, value):
        return [max(0, min(127, int(n))) for n in value or []]

    @field_validator("pad_velocities")
    @classmethod
    def _velocities(cls, value):
        return [max(1, min(127, int(v))) for v in value or []]

    @model_validator(mode="after")
    def _fit_grid(self):
        total = self.rows * self.cols
        notes = list(self.pad_notes) or _default_pad_notes(self.rows, self.cols)
        if len(notes) < total:
            last = notes[-1]
            notes.extend(last + 1 + i for i in range(total - len(notes)))
        notes = notes[:total]
        velocities = list(self.pad_velocities)
        velocities.extend(self.velocity for _ in range(total - len(velocities)))
        velocities = velocities[:total]
        actions = _normalize_pad_actions(self.pad_actions, total, notes, velocities, prefer_defaults=True)
        for name, value in (("pad_notes", notes), ("pad_velocities", velocities), ("pad_actions", actions)):
            if getattr(self, name) != value:
                self.__dict__[name] = value
        return self


class PadsStatus(BaseModel):
    """What the pads are doing in the browser; browser-owned."""

    active_pads: list[int] = []
    last_note_event: dict = {}
    last_pad_event: dict = {}


class KeyboardConfig(_Validated):
    """The QWERTY keyboard's octaves, velocity, sustain and routing."""

    upper_octave: int = Field(3, ge=0, le=9)
    lower_octave: int = Field(4, ge=0, le=9)
    velocity: int = Field(100, ge=1, le=127)
    sustain_upper: bool = False
    sustain_lower: bool = False
    sustain_global: bool = False
    sampler_routing: list[dict] = []
    session_id: str = ""
    channel_index: int = -1
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))


class KeyboardStatus(BaseModel):
    """Notes held in the browser; browser-owned."""

    active_notes: list[int] = []
    last_note_event: dict = {}


class MidiKeyboardConfig(_Validated):
    """The Web MIDI keyboard's port, clock following and routing."""

    midi_port: str = ""
    sync_clock: bool = False
    sampler_routing: list[dict] = []
    session_id: str = ""
    channel_index: int = -1
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))


class MidiKeyboardStatus(BaseModel):
    """Ports, held notes, control changes and the device clock; browser-owned."""

    available_midi_ports: list[str] = []
    active_notes: list[int] = []
    last_note_event: dict = {}
    control_change: dict = {}
    clock_bpm: float = 0.0


class SettingsConfig(_Validated):
    """Audio output and MIDI input selection."""

    sample_rate: int = Field(44100, ge=8000, le=192000)
    channels: int = Field(1, ge=1, le=2)
    buffer_size: int = Field(512, ge=32, le=8192)
    audio_device: str = ""
    midi_port: str = ""
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))


class SettingsStatus(BaseModel):
    """Ports the browser enumerated and the last raw MIDI event; browser-owned."""

    available_midi_ports: list[str] = []
    midi_event: bytes = b""


class MidiOutputConfig(_Validated):
    """The MIDI output port, channel and what it forwards."""

    midi_port: str = ""
    channel: int = Field(0, ge=0, le=15)
    forward_notes: bool = True
    send_clock: bool = False
    session_id: str = ""
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))


class MidiOutputStatus(BaseModel):
    """Ports the browser enumerated; browser-owned.

    ``request`` is never written by either side: it is the client-owned
    field that ``session.command`` targets to deliver a send request.
    """

    available_midi_ports: list[str] = []
    request: dict = {}
