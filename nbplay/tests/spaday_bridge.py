"""Real view comm endpoints for the browser test, driven by JSON lines on stdin.

``python spaday_bridge.py <view> [codec]`` serves one instrument view, where
``view`` names an entry of ``VIEWS``; ``python spaday_bridge.py session``
serves a :class:`nbplay.views.Session` with one sequencer-and-synth track,
exposing every widget by name. Requests carry an optional ``widget`` name;
without one they address the only widget, or the session itself for
``command``.
"""

import json
import sys
from unittest.mock import Mock

import transports
from spaday.widget import _ESM

from nbplay import views

VIEWS = {
    "transport": views.TransportView,
    "synth": views.SynthView,
    "mixer": views.MixerView,
    "pads": views.PadsView,
    "keyboard": views.KeyboardView,
    "midi_keyboard": views.MidiKeyboardView,
    "settings": views.SettingsView,
    "midi_output": views.MidiOutputView,
    "sequencer": views.SequencerView,
    "sampler": views.SamplerView,
    "launcher": views.LauncherView,
    "timeline": views.TimelineView,
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


def _describe(view):
    return {
        "_tree": view._tree,
        "_wires": view._wires,
        "_packages": view._packages,
        "config_id": view.config_id,
        "status_id": view.status_id,
        "has_status": view.status is not None,
        "widget_esm": str(_ESM),
    }


def _state(view):
    return {
        "config": _jsonable(view.config.model_dump()),
        "status": _jsonable(view.status.model_dump()) if view.status is not None else None,
    }


name = sys.argv[1] if len(sys.argv) > 1 else "transport"
codec = sys.argv[2] if len(sys.argv) > 2 else "json"
options = {"autosync": False, "codec": codec, "update_interval": 0.05}
if name == "session":
    session = views.Session(bpm=120.0)
    sequencer = views.SequencerView(length=8, **options)
    synth = views.SynthView(**options)
    session.add_track("Lead", sequencer, synth)
    widgets = {
        "transport": session.transport,
        "mixer": session.mixer,
        "timeline": session.timeline,
        "launcher": session.launcher,
        "sequencer": sequencer,
        "synth": synth,
    }
    for view in session.views:
        view._autosync = False
    target = session
else:
    session = None
    widgets = {name: VIEWS[name](**options)}
    target = widgets[name]
sent = []


def sync_all():
    for view in widgets.values():
        transports.sync(view.server)


for widget_name, view in widgets.items():
    view.send = Mock(
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
            result = {"widgets": {widget_name: _describe(view) for widget_name, view in widgets.items()}}
            result.update(_describe(next(iter(widgets.values()))))
        elif op == "receive":
            view = pick(request)
            view._msg_callbacks(view, request["content"], [memoryview(bytes(b)) for b in request.get("buffers", [])])
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
                result = {widget_name: _state(view) for widget_name, view in widgets.items()}
        print(json.dumps({"messages": list(sent), "result": result}), flush=True)
        sent.clear()
finally:
    for view in widgets.values():
        view.close()
