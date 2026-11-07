"""Views: nbplay instruments on transports models, rendered by spaday.

A view hosts a config model (kernel-owned, validated) and a status model
(browser-owned) in a :class:`transports.Session`, and renders the instrument
element with spaday bindings: config fields bind two-way on ``nbplay-set``,
status fields two-way on ``nbplay-status``, and an ``nbplay-wire`` child
delivers ``session.command`` calls to the element. This is the parallel
layer to the traitlets widgets in :mod:`nbplay.widget`; it needs
``spaday[widget]`` with notebook session support and ``transports`` 0.12.
"""

import inspect
from typing import ClassVar

import transports
from pydantic import BaseModel
from spaday import Widget, element

from .models import SynthConfig, SynthStatus, TransportConfig, TransportStatus

if "session" not in inspect.signature(Widget.__init__).parameters:
    raise ImportError("nbplay.views needs a spaday release with Widget(session=...) support")

__all__ = ("PACKAGE", "InstrumentView", "SynthView", "TransportView")

PACKAGE = "nbplay.components:package"


class InstrumentView(Widget):
    """One instrument element on a config model and a status model.

    Subclasses set ``TAG``, the model classes, and the trait-to-property
    maps. Keyword arguments that name config fields initialise the config;
    the rest go to :class:`spaday.Widget`.
    """

    TAG: ClassVar[str]
    CONFIG_MODEL: ClassVar[type[BaseModel]]
    STATUS_MODEL: ClassVar[type[BaseModel]]
    CONFIG: ClassVar[dict[str, str]]
    STATUS: ClassVar[dict[str, str]]

    def __init__(self, session=None, *, config=None, **kwargs):
        fields = {name: kwargs.pop(name) for name in list(kwargs) if name in self.CONFIG_MODEL.model_fields}
        self.config = config if config is not None else self.CONFIG_MODEL(**fields)
        self.status = self.STATUS_MODEL()
        self.session = session if session is not None else transports.Session()
        self._prepare()
        self.config_id = self.session.host(self.config)
        self.status_id = self.session.host(self.status, owner="client")
        node = element(self.TAG, element("nbplay-wire", namespace="status"))
        for name, prop in self.CONFIG.items():
            node.bind(prop, f"config.{name}", mode="two-way", event="nbplay-set")
        for name, prop in self.STATUS.items():
            node.bind(prop, f"status.{name}", mode="two-way", event="nbplay-status")
        super().__init__(
            node,
            session=self.session,
            # Plain wire mappings: the released Wire requires a websocket url.
            wires=[
                {"model": self.config_id, "namespace": "config"},
                {"model": self.status_id, "namespace": "status"},
            ],
            packages=PACKAGE,
            **kwargs,
        )

    def _prepare(self):
        """Hook run after the models exist and before they are hosted."""

    def _command(self, field, value):
        return self.session.command(self.status_id, field, value)


class TransportView(InstrumentView):
    """The transport instrument on a transports session."""

    TAG = "nbplay-transport"
    CONFIG_MODEL = TransportConfig
    STATUS_MODEL = TransportStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "bpm": "bpm",
        "time_signature_num": "timeSignatureNum",
        "time_signature_den": "timeSignatureDen",
        "loop_enabled": "loopEnabled",
        "loop_start_bar": "loopStartBar",
        "loop_end_bar": "loopEndBar",
        "session_id": "sessionId",
        "theme": "theme",
    }
    STATUS: ClassVar[dict[str, str]] = {
        "is_playing": "isPlaying",
        "is_recording": "isRecording",
        "current_beat": "currentBeat",
        "bar_number": "barNumber",
        "beat_in_bar": "beatInBar",
    }

    def play(self):
        """Start the clock in the owning view."""
        return self._command("is_playing", True)

    def stop(self):
        """Stop the clock in the owning view."""
        return self._command("is_playing", False)

    def seek(self, beat):
        """Move the clock to ``beat``."""
        return self._command("current_beat", float(beat))

    def record(self, on=True):
        """Arm or disarm recording; arming also starts the clock."""
        return self._command("is_recording", bool(on))


class SynthView(InstrumentView):
    """The synth instrument on a transports session.

    :class:`~nbplay.models.SynthConfig` renders the waveform preview as
    part of validation, so kernel and browser edits both refresh it.
    """

    TAG = "nbplay-synth"
    CONFIG_MODEL = SynthConfig
    STATUS_MODEL = SynthStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "oscillator_type": "oscillatorType",
        "frequency": "frequency",
        "amplitude": "amplitude",
        "sample_rate": "sampleRate",
        "waveform": "waveform",
        "session_id": "sessionId",
        "channel_index": "channelIndex",
        "theme": "theme",
    }
    STATUS: ClassVar[dict[str, str]] = {"is_playing": "isPlaying"}

    def play(self):
        """Start the tone in the owning view."""
        return self._command("is_playing", True)

    def stop(self):
        """Stop the tone in the owning view."""
        return self._command("is_playing", False)
