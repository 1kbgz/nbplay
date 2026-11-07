"""A real TransportView comm endpoint for the browser test, driven by JSON lines on stdin."""

import json
import sys
from unittest.mock import Mock

import transports
from spaday.widget import _ESM

from nbplay.views import TransportView

codec = sys.argv[1] if len(sys.argv) > 1 else "json"
view = TransportView(bpm=120.0, autosync=False, codec=codec, update_interval=0.05)
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
                "widget_esm": str(_ESM),
            }
        elif op == "receive":
            view._msg_callbacks(view, request["content"], [memoryview(bytes(b)) for b in request.get("buffers", [])])
        elif op == "set_bpm":
            view.config.bpm = float(request["bpm"])
            transports.sync(view.server)
        elif op in ("play", "stop"):
            getattr(view, op)()
            transports.sync(view.server)
        elif op == "seek":
            view.seek(request["beat"])
            transports.sync(view.server)
        elif op == "state":
            result = {"bpm": view.config.bpm, "is_playing": view.status.is_playing, "current_beat": view.status.current_beat}
        print(json.dumps({"messages": list(sent), "result": result}), flush=True)
        sent.clear()
finally:
    view.close()
