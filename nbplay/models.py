"""Pydantic models behind the transports-backed views (:mod:`nbplay.views`).

Each widget splits into a config model the kernel owns and validates, and a
status model the browser owns (hosted with ``owner="client"``), matching the
``nbplay-set`` / ``nbplay-status`` split of the elements.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .widget import THEMES, render_waveform

__all__ = ("SynthConfig", "SynthStatus", "TransportConfig", "TransportStatus")


def _validate_theme(value):
    if value not in THEMES:
        raise ValueError(f"theme must be one of {THEMES}, got {value!r}")
    return value


class TransportConfig(BaseModel):
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


class SynthConfig(BaseModel):
    """Synth settings the kernel owns; ``waveform`` is derived.

    The preview is rendered by the Rust oscillators as part of validation,
    so it follows the parameters whether Python assigns them or a browser
    edit is validated into the model, and a client edit's authoritative
    patch already carries the new bytes.
    """

    model_config = ConfigDict(validate_assignment=True)

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
            # Re-validates once more and finds the bytes already current.
            self.waveform = rendered
        return self


class SynthStatus(BaseModel):
    """Whether the browser is sounding the synth's tone; browser-owned."""

    is_playing: bool = False
