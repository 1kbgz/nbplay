import json
from unittest.mock import Mock

import pytest

pytest.importorskip("transports")
pytest.importorskip("spaday")
views = pytest.importorskip("nbplay.views", exc_type=ImportError)

import transports
from transports._buffers import join_buffers

from nbplay.models import KeyboardConfig, MixerConfig, PadsConfig, SamplerConfig, SequencerConfig, SynthConfig, TransportConfig, TransportStatus


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


class TestIoViews:
    def test_settings_and_midi_output_views(self):
        settings = views.SettingsView(sample_rate=48000, autosync=False)
        try:
            assert settings.config.sample_rate == 48000
            assert settings._tree["bindings"]["midiEvent"]["field"] == "status.midi_event"
            with pytest.raises(ValueError):
                settings.config.channels = 3
        finally:
            settings.close()
        out = views.MidiOutputView(channel=9, autosync=False)
        sent = []
        out.send = Mock(side_effect=lambda content, buffers=(): sent.append((content, buffers)))
        try:
            out.note_on(200, 300)
            out.send_raw([0xC0, 5])
            with pytest.raises(ValueError):
                out.send_raw([])
            ready(out)
            # Commands are delivered one at a time; the raw send follows the ack.
            commands = [m for m in messages(sent) if m["t"] == "command"]
            assert [c["field"] for c in commands] == ["request"]
            assert commands[0]["value"]["Map"]["kind"] == {"Str": "note_on"}
            assert commands[0]["value"]["Map"]["note"] == {"Int": 127}
        finally:
            out.close()


class TestSequencerAndSamplerViews:
    def test_sequencer_config_fits_voices(self):
        config = SequencerConfig(length=4, num_voices=2)
        assert [len(v) for v in config.voices_data] == [4, 4]
        assert config.voices_data[0][0] == {"note": 60, "velocity": 100, "duration_ticks": 1, "active": False, "probability": 100.0}
        config.voices_data = [[{"note": 200, "velocity": 0, "active": True}]]
        assert config.voices_data[0][0]["note"] == 127 and config.voices_data[0][0]["velocity"] == 1
        assert [len(v) for v in config.voices_data] == [4, 4]
        config.length = 2
        assert [len(v) for v in config.voices_data] == [2, 2]
        view = views.SequencerView(length=8, autosync=False)
        try:
            view.set_step(2, note=48, active=True)
            view.toggle_step(3)
            assert view.config.voices_data[0][2]["note"] == 48 and view.config.voices_data[0][3]["active"] is True
            view.clear()
            assert not any(step["active"] for step in view.config.voices_data[0])
            assert isinstance(view.play(), int)
        finally:
            view.close()

    def test_sampler_config_and_view(self):
        config = SamplerConfig(pad_count=3)
        assert config.pad_notes == [48, 49, 50] and config.pad_velocities == [100] * 3 and len(config.pad_actions) == 3
        config.pad_count = 2
        assert len(config.pad_notes) == 2 and len(config.pad_actions) == 2
        view = views.SamplerView(autosync=False)
        try:
            view.load_sample([0.0, 0.5, -0.5, 1.5], sample_rate=22050, root_note=200, name="click")
            assert view.config.sample_length == 4 and view.config.root_note == 127
            assert len(view.config.sample_data) == 16 and len(view.config.waveform) == 16
            view.configure_pads(pad_notes=[60, 64])
            assert view.config.pad_count == 2 and view.config.pad_notes == [60, 64]
            zone = view.add_zone([0.1, 0.2], 40, 40)
            assert zone["root_note"] == 40 and len(view.config.zones) == 1 and view.config.zones[0]["data"] == zone["data"]
            assert isinstance(view.capture("blob:x", note=60, duration=1.5), int)
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
