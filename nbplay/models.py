"""Pydantic models behind the transports-backed views (:mod:`nbplay.views`).

Each widget splits into a config model the kernel owns and validates, and a
status model the browser owns (hosted with ``owner="client"``), matching the
``nbplay-set`` / ``nbplay-status`` split of the elements.
"""

from pydantic import BaseModel, Field, field_validator

from .widget import THEMES

__all__ = ("TransportConfig", "TransportStatus")


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

    @field_validator("theme")
    @classmethod
    def _validate_theme(cls, value):
        if value not in THEMES:
            raise ValueError(f"theme must be one of {THEMES}, got {value!r}")
        return value


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
