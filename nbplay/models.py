"""Pydantic models behind the widgets in :mod:`nbplay.widget`.

Each widget splits into a config model the kernel owns and validates, and a
status model the browser owns (hosted with ``owner="client"``), matching the
``nbplay-set`` / ``nbplay-status`` split of the elements.
"""

from typing import Literal

from pydantic import BaseModel, Field, PrivateAttr, field_validator, model_validator

from .descriptors import (
    THEMES,
    _clamp_midi_note,
    _clamp_velocity,
    _default_pad_notes,
    _default_steps,
    _measure_beats,
    _normalize_audio_clips,
    _normalize_effects,
    _normalize_launcher_slot,
    _normalize_mixer_channel,
    _normalize_pad_actions,
    _normalize_return_bus,
    _normalize_sample_slices,
    _normalize_timeline_tracks,
    _normalize_zones,
    _pad_sends,
    _resize_pad_notes,
    _resize_pad_velocities,
    render_waveform,
)

__all__ = (
    "KeyboardConfig",
    "KeyboardStatus",
    "LauncherConfig",
    "LauncherStatus",
    "MidiKeyboardConfig",
    "MidiKeyboardStatus",
    "MidiOutputConfig",
    "MidiOutputStatus",
    "MixerConfig",
    "PadsConfig",
    "PadsStatus",
    "SamplerConfig",
    "SamplerStatus",
    "SequencerConfig",
    "SequencerStatus",
    "SettingsConfig",
    "SettingsStatus",
    "SpectrumConfig",
    "SynthConfig",
    "SynthStatus",
    "TimelineConfig",
    "TimelineStatus",
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

    _listeners: list = PrivateAttr(default_factory=list)

    def __setattr__(self, name, value):
        if name not in type(self).model_fields:
            super().__setattr__(name, value)
            return
        self.update(**{name: value})

    def on_change(self, listener):
        """Call ``listener(changes)`` after each update with ``{field: (old, new)}``; returns a remover.

        Browser edits reach the hosted model through assignment too, so a
        listener sees both sides.
        """
        self._listeners.append(listener)

        def unobserve():
            if listener in self._listeners:
                self._listeners.remove(listener)

        return unobserve

    def update(self, **fields):
        """Assign several fields in one validation, so derived fields see all of them."""
        fresh = type(self).model_validate({**self.model_dump(), **fields})
        changes = {}
        for field in type(self).model_fields:
            new = getattr(fresh, field)
            old = getattr(self, field)
            if new != old:
                BaseModel.__setattr__(self, field, new)
                changes[field] = (old, new)
        if changes:
            for listener in list(self._listeners):
                listener(changes)


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
    #: Undo/redo shortcut counts; a session answers each bump.
    undo_request: int = 0
    redo_request: int = 0


#: Config fields whose change re-renders the synth waveform preview.
WAVEFORM_PARAMS = ("oscillator_type", "frequency", "amplitude", "sample_rate")


class SpectrumConfig(_Validated):
    """The spectrum analyzer's FFT, its axis ranges, and what it listens to.

    ``channel_index`` is a mixer channel of the session, or -1 for the master bus.
    """

    fft_size: Literal[256, 512, 1024, 2048, 4096, 8192, 16384] = 2048
    smoothing: float = Field(0.8, ge=0, le=0.99)
    min_db: float = Field(-100.0, ge=-140, le=0)
    max_db: float = Field(-20.0, ge=-100, le=20)
    min_frequency: float = Field(20.0, ge=10, le=20000)
    max_frequency: float = Field(20000.0, ge=20, le=24000)
    session_id: str = ""
    channel_index: int = Field(-1, ge=-1)
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))

    @model_validator(mode="after")
    def _ordered(self):
        if self.max_db <= self.min_db:
            raise ValueError(f"max_db ({self.max_db}) must be above min_db ({self.min_db})")
        if self.max_frequency <= self.min_frequency:
            raise ValueError(f"max_frequency ({self.max_frequency}) must be above min_frequency ({self.min_frequency})")
        return self


class SynthConfig(_Validated):
    """Synth settings the kernel owns; ``waveform`` is derived.

    The preview is rendered by the Rust oscillators as part of validation,
    so it follows the parameters whether Python assigns them or a browser
    edit is validated into the model, and a client edit's authoritative
    patch already carries the new bytes.
    """

    oscillator_type: Literal["sine", "triangle", "square", "saw", "noise"] = "sine"
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

    Channels, returns and effects are the same dicts the mixer widget
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
    so the grid is always fully described.
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


def _normalize_step(step):
    if not isinstance(step, dict):
        step = {}
    return {
        "note": _clamp_midi_note(step.get("note", 60)),
        "velocity": _clamp_velocity(step.get("velocity", 100)),
        "duration_ticks": max(1, int(step.get("duration_ticks", 1))),
        "active": bool(step.get("active", False)),
        "probability": max(0.0, min(100.0, float(step.get("probability", 100)))),
    }


def _normalize_lanes(lanes):
    normalized = []
    for lane in lanes or []:
        if not isinstance(lane, dict):
            continue
        trait = str(lane.get("trait", "")).strip()
        if not trait or not all(ch.isalnum() or ch == "_" for ch in trait):
            continue
        points = []
        for point in lane.get("points", []):
            if not isinstance(point, dict):
                continue
            try:
                points.append({"step": max(0, int(point["step"])), "value": float(point["value"])})
            except (KeyError, TypeError, ValueError):
                continue
        if points:
            normalized.append({"trait": trait, "points": sorted(points, key=lambda p: p["step"])})
    return normalized


_GRID_FIELDS = frozenset({"measures", "step_duration", "time_signature_num", "time_signature_den"})


class SequencerConfig(_Validated):
    """The step sequencer's pattern and grid.

    ``voices_data`` always holds ``num_voices`` lists of ``length``
    normalized steps; the after-validator resizes them, filling with
    default steps, the way the widget's composers do. Assigning a grid
    field recomputes ``length`` from measures, meter and step duration.
    """

    voices_data: list[list[dict]] = []
    num_voices: int = Field(1, ge=1, le=16)
    length: int = Field(16, ge=1, le=256)
    measures: int = Field(1, ge=1)
    step_duration: float = Field(0.25, gt=0)
    time_signature_num: int = Field(4, ge=1, le=16)
    time_signature_den: int = Field(4, ge=1, le=16)
    bpm: float = Field(120.0, ge=30, le=300)
    loop_enabled: bool = True
    keyboard_connected: bool = False
    follow_transport: bool = True
    swing: float = Field(0.0, ge=0, le=100)
    groove: list[float] = []
    automation_lanes: list[dict] = []
    #: Names the pattern loaded by a slot editor; the browser writes ``edit_ack``
    #: (the token plus a serial) before each pattern edit it makes on it.
    edit_token: str = ""
    edit_ack: str = ""
    session_id: str = ""
    channel_index: int = -1
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))

    @field_validator("groove")
    @classmethod
    def _groove(cls, value):
        return [max(-50.0, min(50.0, float(v))) for v in value or []]

    @field_validator("automation_lanes")
    @classmethod
    def _lanes(cls, value):
        return _normalize_lanes(value)

    def update(self, **fields):
        # A grid change (measures, step duration, meter) sets the length, as
        # the widget's observers do; an explicit length wins.
        if "length" not in fields and _GRID_FIELDS & fields.keys():
            grid = {name: fields.get(name, getattr(self, name)) for name in _GRID_FIELDS}
            beats = grid["measures"] * _measure_beats(grid["time_signature_num"], grid["time_signature_den"])
            fields["length"] = max(1, round(beats / max(0.001, float(grid["step_duration"]))))
        super().update(**fields)

    @model_validator(mode="after")
    def _fit_voices(self):
        voices = []
        for index in range(self.num_voices):
            steps = [_normalize_step(step) for step in (self.voices_data[index] if index < len(self.voices_data) else [])]
            steps = steps[: self.length] + _default_steps(max(0, self.length - len(steps)))
            voices.append(steps)
        if voices != self.voices_data:
            self.__dict__["voices_data"] = voices
        return self


class SequencerStatus(BaseModel):
    """Play state and the sounding step from the browser scheduler; browser-owned."""

    is_playing: bool = False
    current_step: int = -1


class SamplerConfig(_Validated):
    """The sampler's sample, envelope, pads, slices and zones.

    ``pad_count`` is authoritative for the pad lists, as the widget's
    ``pad_count`` observer is; slices are bounded by ``sample_length`` and
    zones carry their own float32 bytes.
    """

    sample_name: str = "(no sample)"
    sample_rate: int = Field(44100, ge=8000, le=192000)
    root_note: int = Field(69, ge=0, le=127)
    sample_length: int = Field(0, ge=0)
    waveform: bytes = b""
    sample_data: bytes = b""
    attack: float = Field(0.005, ge=0, le=2)
    decay: float = Field(0.1, ge=0, le=2)
    sustain: float = Field(0.8, ge=0, le=1)
    release: float = Field(0.1, ge=0, le=5)
    max_voices: int = Field(8, ge=1, le=32)
    pad_count: int = Field(8, ge=1, le=128)
    pad_notes: list[int] = []
    pad_velocities: list[int] = []
    pad_actions: list[dict] = []
    sample_slices: list[dict] = []
    velocity: int = Field(100, ge=1, le=127)
    velocity_sensitive: bool = True
    zones: list[dict] = []
    session_id: str = ""
    channel_index: int = -1
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))

    @model_validator(mode="after")
    def _fit(self):
        notes = _resize_pad_notes(self.pad_notes, self.pad_count)
        velocities = _resize_pad_velocities(self.pad_velocities, self.pad_count, self.velocity)
        actions = _normalize_pad_actions(self.pad_actions, self.pad_count, notes, velocities, prefer_defaults=True)
        slices = _normalize_sample_slices(self.sample_slices, self.sample_length)
        zones = _normalize_zones(self.zones)
        for name, value in (
            ("pad_notes", notes),
            ("pad_velocities", velocities),
            ("pad_actions", actions),
            ("sample_slices", slices),
            ("zones", zones),
        ):
            if getattr(self, name) != value:
                self.__dict__[name] = value
        return self


class SamplerStatus(BaseModel):
    """Taps and note events from the browser; browser-owned.

    ``request`` is the client-owned target of capture commands.
    """

    active_pads: list[int] = []
    last_note_event: dict = {}
    last_pad_event: dict = {}
    request: dict = {}


class LauncherConfig(_Validated):
    """The clip launcher's tracks, scenes and slots."""

    tracks: list[dict] = []
    scenes: list[str] = []
    slots: list[dict] = []
    quantize: Literal["bar", "beat", "none"] = "bar"
    bpm: float = Field(120.0, ge=30, le=300)
    time_signature_num: int = Field(4, ge=1, le=16)
    time_signature_den: int = Field(4, ge=1, le=16)
    selected_slot: dict = {}
    session_id: str = ""
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))

    @field_validator("tracks")
    @classmethod
    def _tracks(cls, value):
        return [
            {"name": str(track.get("name", f"Track {index + 1}")), "channel_index": max(-1, int(track.get("channel_index", index)))}
            for index, track in enumerate(value or [])
        ]

    @field_validator("slots")
    @classmethod
    def _slots(cls, value):
        return [_normalize_launcher_slot(slot) for slot in value or []]


class LauncherStatus(BaseModel):
    """Play state and slot state from the browser scheduler; browser-owned.

    ``request`` is the client-owned target of launch commands.
    """

    is_playing: bool = False
    active_slots: list[int] = []
    queued_slots: list[int] = []
    request: dict = {}


class TimelineConfig(_Validated):
    """The arrangement: lanes, clips and recording settings the kernel owns.

    ``current_beat`` is configuration here as in the widget: a standalone
    timeline restores and seeks from it, and a session's position lives in
    the transport.
    """

    tracks: list[dict] = []
    clips: list[dict] = []
    length: float = Field(16.0, ge=1, le=4096)
    selected_clip_id: str = ""
    bpm: float = Field(120.0, ge=30, le=300)
    time_signature_num: int = Field(4, ge=1, le=16)
    time_signature_den: int = Field(4, ge=1, le=16)
    count_in_bars: float = Field(0.0, ge=0, le=8)
    auto_extend_recording: bool = True
    recording_extend_bars: float = Field(8.0, ge=1, le=256)
    pixels_per_beat: float = Field(0.0, ge=0, le=400)
    current_beat: float = Field(0.0, ge=0)
    export_clip_id: str = ""
    import_clip_request: dict = {}
    import_clip_data: bytes = b""
    session_id: str = ""
    theme: str = ""

    _theme = field_validator("theme")(classmethod(lambda cls, value: _validate_theme(value)))

    @field_validator("tracks")
    @classmethod
    def _tracks(cls, value):
        return _normalize_timeline_tracks(value)

    @model_validator(mode="after")
    def _fit(self):
        clips = _normalize_audio_clips(self.clips, len(self.tracks))
        if clips != self.clips:
            self.__dict__["clips"] = clips
        if self.current_beat > self.length:
            self.__dict__["current_beat"] = self.length
        return self


class TimelineStatus(BaseModel):
    """Play, record and transfer state from the browser; browser-owned."""

    is_playing: bool = False
    is_recording: bool = False
    recording_track: int = -1
    recording_tracks: list[int] = []
    recording_countdown_beats: float = 0.0
    recording_error: str = ""
    recorded_clip: dict = {}
    exported_clip: dict = {}
    exported_clip_data: bytes = b""
