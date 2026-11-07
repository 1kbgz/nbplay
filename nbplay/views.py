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

from .models import MixerConfig, SynthConfig, SynthStatus, TransportConfig, TransportStatus
from .widget import _normalize_effect

if "session" not in inspect.signature(Widget.__init__).parameters:
    raise ImportError("nbplay.views needs a spaday release with Widget(session=...) support")

__all__ = ("PACKAGE", "InstrumentView", "MixerView", "SynthView", "TransportView")

PACKAGE = "nbplay.components:package"


class InstrumentView(Widget):
    """One instrument element on a config model and, usually, a status model.

    Subclasses set ``TAG``, the model classes, and the trait-to-property
    maps; an instrument with no browser-owned state leaves ``STATUS_MODEL``
    as ``None``. Keyword arguments that name config fields initialise the
    config; the rest go to :class:`spaday.Widget`.
    """

    TAG: ClassVar[str]
    CONFIG_MODEL: ClassVar[type[BaseModel]]
    STATUS_MODEL: ClassVar[type[BaseModel] | None] = None
    CONFIG: ClassVar[dict[str, str]]
    STATUS: ClassVar[dict[str, str]] = {}

    def __init__(self, session=None, *, config=None, **kwargs):
        fields = {name: kwargs.pop(name) for name in list(kwargs) if name in self.CONFIG_MODEL.model_fields}
        self.config = config if config is not None else self.CONFIG_MODEL(**fields)
        self.status = self.STATUS_MODEL() if self.STATUS_MODEL is not None else None
        self.session = session if session is not None else transports.Session()
        self._prepare()
        self.config_id = self.session.host(self.config)
        # Plain wire mappings: the released Wire requires a websocket url.
        wires = [{"model": self.config_id, "namespace": "config"}]
        node = element(self.TAG)
        for name, prop in self.CONFIG.items():
            node.bind(prop, f"config.{name}", mode="two-way", event="nbplay-set")
        self.status_id = None
        if self.status is not None:
            self.status_id = self.session.host(self.status, owner="client")
            wires.append({"model": self.status_id, "namespace": "status"})
            node.child(element("nbplay-wire", namespace="status"))
            for name, prop in self.STATUS.items():
                node.bind(prop, f"status.{name}", mode="two-way", event="nbplay-status")
        super().__init__(node, session=self.session, wires=wires, packages=PACKAGE, **kwargs)

    def _prepare(self):
        """Hook run after the models exist and before they are hosted."""

    def _command(self, field, value):
        if self.status_id is None:
            raise TypeError(f"{type(self).__name__} has no browser-owned status to command")
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


class MixerView(InstrumentView):
    """The mixer console on a transports session.

    The console is configuration only: faders, pans, mutes, sends and
    effects live in the kernel model, and the browser builds the Web Audio
    graph from it. Edits in either place are validated by
    :class:`~nbplay.models.MixerConfig`.
    """

    TAG = "nbplay-mixer"
    CONFIG_MODEL = MixerConfig
    CONFIG: ClassVar[dict[str, str]] = {
        "channels": "channels",
        "returns": "returns",
        "master_gain": "masterGain",
        "master_effects": "masterEffects",
        "session_id": "sessionId",
        "theme": "theme",
    }

    def add_channel(self, name="Channel"):
        """Append a channel strip and return its index."""
        self.config.channels = [*self.config.channels, {"name": name}]
        return len(self.config.channels) - 1

    def remove_channel(self, index):
        """Remove the channel at ``index``."""
        channels = list(self.config.channels)
        if 0 <= index < len(channels):
            del channels[index]
            self.config.channels = channels

    def add_return(self, name="Return", effects=(), gain=0.8):
        """Append a send/return bus and return its index; every channel gains a send."""
        self.config.returns = [*self.config.returns, {"name": name, "gain": gain, "effects": list(effects)}]
        return len(self.config.returns) - 1

    def add_channel_effect(self, index, effect):
        """Append an insert effect to the channel at ``index``."""
        channels = list(self.config.channels)
        channels[index] = {**channels[index], "effects": [*channels[index]["effects"], _normalize_effect(effect)]}
        self.config.channels = channels

    def add_master_effect(self, effect):
        """Append an insert effect to the master bus."""
        self.config.master_effects = [*self.config.master_effects, _normalize_effect(effect)]
