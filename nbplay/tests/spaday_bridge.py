"""A real instrument view comm endpoint for the browser test, driven by JSON lines on stdin.

``python spaday_bridge.py <view> [codec]`` where ``view`` is ``transport`` or ``synth``.
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
}

name = sys.argv[1] if len(sys.argv) > 1 else "transport"
codec = sys.argv[2] if len(sys.argv) > 2 else "json"
view = VIEWS[name](autosync=False, codec=codec, update_interval=0.05)
sent = []
view.send = Mock(side_effect=lambda content, buffers=(): sent.append({"content": content, "buffers": [list(b) for b in buffers]}))
try:
    for line in sys.stdin:
        request = json.loads(line)
        op = request["op"]
        result = None
        if op == "describe":
            result = {
                "_tree": view._tree,
                "_wires": view._wires,
                "_packages": view._packages,
                "config_id": view.config_id,
                "status_id": view.status_id,
                "has_status": view.status is not None,
                "widget_esm": str(_ESM),
            }
        elif op == "receive":
            view._msg_callbacks(view, request["content"], [memoryview(bytes(b)) for b in request.get("buffers", [])])
            # A notebook kernel's autosync timer does this; the bridge flushes explicitly.
            transports.sync(view.server)
        elif op == "set":
            setattr(view.config, request["field"], request["value"])
            transports.sync(view.server)
        elif op == "command":
            getattr(view, request["name"])(*request.get("args", []), **request.get("kwargs", {}))
            transports.sync(view.server)
        elif op == "state":
            config = view.config.model_dump()
            for key in ("waveform", "sample_data", "zones"):
                if key in config:
                    value = config.pop(key)
                    config[f"{key}_bytes"] = len(value)
            result = {"config": config, "status": view.status.model_dump() if view.status is not None else None}
        print(json.dumps({"messages": list(sent), "result": result}), flush=True)
        sent.clear()
finally:
    view.close()
