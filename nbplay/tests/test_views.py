import json
from unittest.mock import Mock

import pytest

pytest.importorskip("transports")
pytest.importorskip("spaday")
views = pytest.importorskip("nbplay.views")

import transports
from transports._buffers import join_buffers

from nbplay.models import TransportConfig, TransportStatus


def messages(sent):
    return [json.loads(join_buffers(content["wire"], buffers, "json")) for content, buffers in sent if "wire" in content]


def ready(view, name="owner"):
    view._msg_callbacks(view, {"ready": True, "ownership": True, "view": name}, [])


class TestTransportModels:
    def test_config_validates_like_the_widget(self):
        assert TransportConfig().bpm == 120.0
        with pytest.raises(ValueError):
            TransportConfig(bpm=1000)
        with pytest.raises(ValueError):
            TransportConfig(theme="neon")
        assert TransportConfig(theme="studio").theme == "studio"

    def test_status_is_browser_owned(self):
        session = transports.Session()
        status = TransportStatus()
        mid = session.host(status, owner="client")
        with pytest.raises(ValueError, match="client-owned"):
            status.is_playing = True
        assert status.is_playing is False
        assert session.command(mid, "is_playing", True) >= 0


class TestTransportView:
    def test_hosts_config_and_status_and_binds_the_element(self):
        view = views.TransportView(bpm=100.0, theme="flat", autosync=False)
        try:
            assert view.config.bpm == 100.0 and view.config.theme == "flat"
            assert view.config_id != view.status_id
            tree = view._tree
            assert tree["tag"] == "nbplay-transport"
            assert tree["bindings"]["bpm"] == {"field": "config.bpm", "mode": "two-way", "event": "nbplay-set"}
            assert tree["bindings"]["isPlaying"] == {"field": "status.is_playing", "mode": "two-way", "event": "nbplay-status"}
            assert [w["namespace"] for w in view._wires] == ["config", "status"]
            assert [p["name"] for p in view._packages] == ["nbplay"]
        finally:
            view.close()

    def test_commands_reach_the_owning_view(self):
        view = views.TransportView(autosync=False)
        sent = []
        view.send = Mock(side_effect=lambda content, buffers=(): sent.append((content, buffers)))
        try:
            command = view.play()
            assert isinstance(command, int)
            ready(view)
            kinds = [m["t"] for m in messages(sent)]
            assert kinds.count("snapshot") == 2
            commands = [m for m in messages(sent) if m["t"] == "command"]
            assert len(commands) == 1
            assert commands[0]["field"] == "is_playing" and commands[0]["value"] == {"Bool": True}
            assert commands[0]["id"] == view.status_id
        finally:
            view.close()

    def test_config_assignment_syncs(self):
        view = views.TransportView(autosync=False)
        sent = []
        view.send = Mock(side_effect=lambda content, buffers=(): sent.append((content, buffers)))
        try:
            ready(view)
            sent.clear()
            view.config.bpm = 140.0
            transports.sync(view.server)
            patches = [m for m in messages(sent) if m["t"] == "patch"]
            assert patches and json.dumps(patches[-1]).count("140") >= 1
        finally:
            view.close()
