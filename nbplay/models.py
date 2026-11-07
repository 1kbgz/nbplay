"""Pydantic models behind the transports-backed views (:mod:`nbplay.views`).

Each widget splits into a config model the kernel owns and validates, and a
status model the browser owns (hosted with ``owner="client"``), matching the
``nbplay-set`` / ``nbplay-status`` split of the elements.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .widget import THEMES, _normalize_effects, _normalize_mixer_channel, _normalize_return_bus, _pad_sends, render_waveform

__all__ = ("MixerConfig", "SynthConfig", "SynthStatus", "TransportConfig", "TransportStatus")


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
