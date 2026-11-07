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
from spaday import Widget, Wire, element

from .models import TransportConfig, TransportStatus

if "session" not in inspect.signature(Widget.__init__).parameters:
    raise ImportError("nbplay.views needs a spaday release with Widget(session=...) support")

__all__ = ("PACKAGE", "TransportView")

PACKAGE = "nbplay.components:package"


class TransportView(Widget):
    """The transport instrument on a transports session.

    Keyword arguments that name :class:`~nbplay.models.TransportConfig`
    fields initialise the config; the rest go to :class:`spaday.Widget`.
    """

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

    def __init__(self, session=None, *, config=None, **kwargs):
        fields = {name: kwargs.pop(name) for name in list(kwargs) if name in TransportConfig.model_fields}
        self.config = config if config is not None else TransportConfig(**fields)
        self.status = TransportStatus()
        self.session = session if session is not None else transports.Session()
        self.config_id = self.session.host(self.config)
        self.status_id = self.session.host(self.status, owner="client")
        node = element("nbplay-transport", element("nbplay-wire", namespace="status"))
        for name, prop in self.CONFIG.items():
            node.bind(prop, f"config.{name}", mode="two-way", event="nbplay-set")
        for name, prop in self.STATUS.items():
            node.bind(prop, f"status.{name}", mode="two-way", event="nbplay-status")
        super().__init__(
            node,
            session=self.session,
            wires=[
                Wire(model=self.config_id, namespace="config"),
                Wire(model=self.status_id, namespace="status"),
            ],
            packages=PACKAGE,
            **kwargs,
        )

    def play(self):
        """Start the clock in the owning view."""
        return self.session.command(self.status_id, "is_playing", True)

    def stop(self):
        """Stop the clock in the owning view."""
        return self.session.command(self.status_id, "is_playing", False)

    def seek(self, beat):
        """Move the clock to ``beat``."""
        return self.session.command(self.status_id, "current_beat", float(beat))

    def record(self, on=True):
        """Arm or disarm recording; arming also starts the clock."""
        return self.session.command(self.status_id, "is_recording", bool(on))
