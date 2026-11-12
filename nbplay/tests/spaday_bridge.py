"""Real widget comm endpoints for the browser test, driven by JSON lines on stdin.

``python spaday_bridge.py <widget> [codec]`` serves one instrument widget, where
``widget`` names an entry of ``VIEWS``; ``python spaday_bridge.py session``
serves a :class:`nbplay.nbplay.Session` with one sequencer-and-synth track,
exposing every widget by name. Requests carry an optional ``widget`` name;
without one they address the only widget, or the session itself for
``command``.
"""

import json
import sys
from unittest.mock import Mock

import transports
from spaday.widget import _ESM

import nbplay

VIEWS = {
    "transport": nbplay.TransportWidget,
    "synth": nbplay.SynthWidget,
    "mixer": nbplay.MixerWidget,
    "pads": nbplay.PadWidget,
    "keyboard": nbplay.KeyboardWidget,
    "midi_keyboard": nbplay.MidiKeyboardWidget,
    "settings": nbplay.SettingsWidget,
    "midi_output": nbplay.MidiOutputWidget,
    "sequencer": nbplay.SequencerWidget,
    "sampler": nbplay.SamplerWidget,
    "launcher": nbplay.LauncherWidget,
    "timeline": nbplay.TimelineWidget,
}


def _jsonable(value):
    """Replace bytes with their length, recursively, so the state fits a JSON line."""
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"bytes": len(value)}
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    return value


def _describe(widget):
    return {
        "_tree": widget._tree,
        "_wires": widget._wires,
        "_packages": widget._packages,
        "config_id": widget.config_id,
        "status_id": widget.status_id,
        "has_status": widget.status is not None,
        "widget_esm": str(_ESM),
    }


def _state(widget):
    return {
        "config": _jsonable(widget.config.model_dump()),
        "status": _jsonable(widget.status.model_dump()) if widget.status is not None else None,
    }


name = sys.argv[1] if len(sys.argv) > 1 else "transport"
codec = sys.argv[2] if len(sys.argv) > 2 else "json"
options = {"autosync": False, "codec": codec, "update_interval": 0.05}
if name == "session":
    session = nbplay.Session(bpm=120.0)
    sequencer = nbplay.SequencerWidget(length=8, **options)
    synth = nbplay.SynthWidget(**options)
    session.add_track("Lead", sequencer, synth)
    widgets = {
        "transport": session.transport,
        "mixer": session.mixer,
        "timeline": session.timeline,
        "launcher": session.launcher,
        "sequencer": sequencer,
        "synth": synth,
    }
    for widget in session.widgets:
        widget._autosync = False
    target = session
else:
    session = None
    widgets = {name: VIEWS[name](**options)}
    target = widgets[name]
sent = []


def sync_all():
    for widget in widgets.values():
        transports.sync(widget.server)


for widget_name, widget in widgets.items():
    widget.send = Mock(
        side_effect=lambda content, buffers=(), _name=widget_name: sent.append(
            {"widget": _name, "content": content, "buffers": [list(b) for b in buffers]}
        )
    )


def pick(request):
    return widgets[request["widget"]] if "widget" in request else next(iter(widgets.values()))


try:
    for line in sys.stdin:
        request = json.loads(line)
        op = request["op"]
        result = None
        if op == "describe":
            result = {"widgets": {widget_name: _describe(widget) for widget_name, widget in widgets.items()}}
            result.update(_describe(next(iter(widgets.values()))))
        elif op == "receive":
            widget = pick(request)
            widget._msg_callbacks(widget, request["content"], [memoryview(bytes(b)) for b in request.get("buffers", [])])
            # A notebook kernel's autosync timer does this; the bridge flushes explicitly.
            sync_all()
        elif op == "set":
            setattr(pick(request).config, request["field"], request["value"])
            sync_all()
        elif op == "command":
            owner = widgets[request["widget"]] if "widget" in request else target
            getattr(owner, request["name"])(*request.get("args", []), **request.get("kwargs", {}))
            sync_all()
        elif op == "state":
            if "widget" in request or session is None:
                result = _state(pick(request))
            else:
                result = {widget_name: _state(widget) for widget_name, widget in widgets.items()}
        print(json.dumps({"messages": list(sent), "result": result}), flush=True)
        sent.clear()
finally:
    for widget in widgets.values():
        widget.close()
