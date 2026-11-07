import json
from unittest.mock import Mock

import pytest

pytest.importorskip("transports")
pytest.importorskip("spaday")
views = pytest.importorskip("nbplay.views", exc_type=ImportError)

import transports
from transports._buffers import join_buffers

from nbplay.models import KeyboardConfig, MixerConfig, PadsConfig, SynthConfig, TransportConfig, TransportStatus


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


class TestSynthView:
    def test_waveform_follows_the_oscillator_parameters(self):
        with pytest.raises(ValueError):
            SynthConfig.model_validate({"oscillator_type": "triangle"})
        view = views.SynthView(frequency=220.0, autosync=False)
        try:
            first = view.config.waveform
            assert len(first) == 4 * min(2048, int(44100 / 220 * 3))
            view.config.frequency = 440.0
            assert len(view.config.waveform) == 4 * int(44100 / 440 * 3)
            view.config.oscillator_type = "noise"
            assert len(view.config.waveform) == 4 * 1024
            assert view._tree["tag"] == "nbplay-synth"
            assert view._tree["bindings"]["waveform"]["field"] == "config.waveform"
        finally:
            view.close()

    def test_waveform_bytes_travel_as_buffers(self):
        view = views.SynthView(autosync=False)
        sent = []
        view.send = Mock(side_effect=lambda content, buffers=(): sent.append((content, buffers)))
        try:
            ready(view)
            assert any(buffers for _, buffers in sent)
            command = view.play()
            assert isinstance(command, int)
        finally:
            view.close()


class TestMixerView:
    def test_config_normalizes_like_the_widget(self):
        config = MixerConfig(channels=[{"name": "Drums", "gain": 5, "effects": [{"type": "gain", "gain": 9}]}], returns=[{"name": "Rev"}])
        assert config.channels[0]["gain"] == 2.0
        assert config.channels[0]["effects"] == [{"type": "gain", "gain": 4.0}]
        assert config.channels[0]["sends"] == [0.0]
        config.returns = []
        assert config.channels[0]["sends"] == []
        with pytest.raises(ValueError):
            config.master_gain = 3

    def test_view_builds_the_console_without_a_status_model(self):
        view = views.MixerView(autosync=False)
        try:
            assert view.status is None and view.status_id is None
            assert [w["namespace"] for w in view._wires] == ["config"]
            assert "nbplay-wire" not in str(view._tree)
            index = view.add_channel("Drums")
            view.add_return("Rev")
            view.add_channel_effect(index, {"type": "compressor", "threshold": -18})
            view.add_master_effect({"type": "limiter"})
            assert view.config.channels[0]["sends"] == [0.0]
            assert view.config.channels[0]["effects"][0]["type"] == "compressor"
            assert view.config.master_effects[0]["type"] == "limiter"
            view.remove_channel(index)
            assert view.config.channels == []
            with pytest.raises(TypeError):
                view._command("x", 1)
        finally:
            view.close()


class TestKeysViews:
    def test_pads_config_fits_the_grid(self):
        config = PadsConfig(rows=2, cols=2)
        assert config.pad_notes == [36, 37, 38, 39]
        assert config.pad_velocities == [100] * 4
        assert [a["note"] for a in config.pad_actions] == [36, 37, 38, 39]
        config.rows = 3
        assert config.pad_notes == [36, 37, 38, 39, 40, 41] and len(config.pad_actions) == 6
        config.pad_notes = [60, 200, -5]
        assert config.pad_notes == [60, 127, 0, 1, 2, 3]
        assert [a["note"] for a in config.pad_actions][:3] == [60, 127, 0]
        with pytest.raises(ValueError):
            config.velocity = 0

    def test_keyboard_and_midi_keyboard_views(self):
        with pytest.raises(ValueError):
            KeyboardConfig(upper_octave=12)
        for cls, tag in ((views.PadsView, "nbplay-pads"), (views.KeyboardView, "nbplay-keyboard"), (views.MidiKeyboardView, "nbplay-midi-keyboard")):
            view = cls(autosync=False)
            try:
                assert view._tree["tag"] == tag
                assert view.status_id is not None
                assert view._tree["bindings"]["lastNoteEvent"]["field"] == "status.last_note_event"
                assert view._tree["bindings"]["theme"]["field"] == "config.theme"
            finally:
                view.close()


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
