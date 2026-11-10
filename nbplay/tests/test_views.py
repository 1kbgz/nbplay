import base64
import json
import struct
import wave
from unittest.mock import Mock

import pytest

pytest.importorskip("transports")
pytest.importorskip("spaday")
views = pytest.importorskip("nbplay.views", exc_type=ImportError)

import transports
from transports._buffers import join_buffers

from nbplay.descriptors import PadAction
from nbplay.models import (
    KeyboardConfig,
    LauncherConfig,
    MixerConfig,
    PadsConfig,
    SamplerConfig,
    SequencerConfig,
    SynthConfig,
    TimelineConfig,
    TransportConfig,
    TransportStatus,
)


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

    def test_strip_send_and_effect_setters(self):
        view = views.MixerView(autosync=False)
        try:
            drums = view.add_channel("Drums")
            keys = view.add_channel("Keys")
            view.set_channel_gain(drums, 5)
            view.set_channel_pan(drums, -2)
            view.set_channel_mute(drums, 1)
            view.set_channel_solo(keys, True)
            channel = view.config.channels[drums]
            assert (channel["gain"], channel["pan"], channel["mute"]) == (2.0, -1.0, True)
            assert view.config.channels[keys]["solo"] is True
            view.set_channel_effects(drums, [{"type": "gain", "gain": 9}, {"type": "limiter"}])
            view.set_channel_effect_enabled(drums, 1, False)
            assert view.config.channels[drums]["effects"] == [
                {"type": "gain", "gain": 4.0},
                {"type": "limiter", "threshold": -1.0, "release": 0.05, "enabled": False},
            ]
            view.set_channel_effect_enabled(drums, 1)
            assert "enabled" not in view.config.channels[drums]["effects"][1]
            view.clear_channel_effects(drums)
            assert view.config.channels[drums]["effects"] == []
            view.set_master_effects([{"type": "compressor"}, {"type": "limiter"}])
            view.set_master_effect_enabled(0, False)
            assert view.config.master_effects[0]["enabled"] is False
            view.clear_master_effects()
            assert view.config.master_effects == []

            verb = view.add_return("Verb")
            delay = view.add_return("Delay", effects=[{"type": "delay"}])
            view.set_return_gain(verb, 3)
            view.add_return_effect(verb, {"type": "reverb", "wet": 2})
            view.set_return_effect_enabled(verb, 0, False)
            assert view.config.returns[verb]["gain"] == 2.0
            assert view.config.returns[verb]["effects"][0]["wet"] == 1.0 and view.config.returns[verb]["effects"][0]["enabled"] is False
            view.set_return_effects(delay, [])
            assert view.config.returns[delay]["effects"] == []
            view.set_send(drums, verb, 0.5)
            view.set_send(drums, delay, 7)
            assert view.config.channels[drums]["sends"] == [0.5, 1.0]
            with pytest.raises(IndexError):
                view.set_send(drums, 2, 0.1)
            view.remove_return(verb)
            assert [r["name"] for r in view.config.returns] == ["Delay"]
            assert view.config.channels[drums]["sends"] == [1.0] and view.config.channels[keys]["sends"] == [0.0]

            mixer = view.to_mixer()
            assert len(mixer) == 2
            assert mixer.get_channel(drums).gain == 2.0 and mixer.get_channel(drums).mute is True
            assert mixer.get_channel(keys).solo is True
            assert mixer.master_gain == pytest.approx(0.8)
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

    def test_keyboards_route_to_samplers_and_record_into_sequencers(self):
        keys = views.KeyboardView(autosync=False)
        midi = views.MidiKeyboardView(autosync=False)
        pads = views.PadsView(autosync=False)
        drums = views.SamplerView(channel_index=2, autosync=False)
        bass = views.SamplerView(channel_index=5, autosync=False)
        loose = views.SamplerView(autosync=False)
        sequencer = views.SequencerView(autosync=False)
        try:
            keys.connect_sequencer(sequencer)
            assert sequencer.config.keyboard_connected is True
            keys.disconnect_sequencer(sequencer)
            assert sequencer.config.keyboard_connected is False
            keys.connect_sampler(drums, zone="lower")
            keys.connect_sampler(bass, octave=3)
            keys.connect_sampler(drums, notes=[36, 38])
            assert keys.config.sampler_routing == [
                {"channel_index": 5, "match": "octave", "octave": 3},
                {"channel_index": 2, "match": "notes", "notes": [36, 38]},
            ]
            keys.disconnect_sampler(bass)
            assert [r["channel_index"] for r in keys.config.sampler_routing] == [2]
            with pytest.raises(ValueError):
                keys.connect_sampler(loose)
            midi.connect_sampler(drums)
            assert midi.config.sampler_routing == [{"channel_index": 2, "match": "all"}]
            pads.connect_sampler(drums, note=36)
            assert pads.config.sampler_routing == [{"channel_index": 2, "match": "note", "note": 36}]
            with pytest.raises(ValueError, match="zone"):
                pads.connect_sampler(drums, zone="upper")
            pads.disconnect_sampler(drums)
            assert pads.config.sampler_routing == []
        finally:
            for view in (keys, midi, pads, drums, bass, loose, sequencer):
                view.close()

    def test_pads_grid_helpers_and_sampler_slices(self):
        pads = views.PadsView(velocity=90, autosync=False)
        sampler = views.SamplerView(channel_index=1, autosync=False)
        try:
            pads.configure_grid_for_actions(notes=[60, 62, 64, 65, 67])
            assert (
                (pads.config.rows, pads.config.cols) == (2, 4)
                and pads.config.pad_notes[:5] == [60, 62, 64, 65, 67]
                and len(pads.config.pad_notes) == 8
            )
            pads.configure_grid_for_actions(actions=[PadAction(note=40, label="Kick"), {"type": "note", "note": 41}], cols=2)
            assert (pads.config.rows, pads.config.cols) == (1, 2) and pads.config.pad_notes == [40, 41]
            assert pads.config.pad_actions[0] == {"type": "note", "note": 40, "velocity": 90, "label": "Kick"}
            pads.set_base_note(48)
            assert pads.config.pad_notes == [48, 49]
            pads.transpose_pads(-12)
            assert pads.config.pad_notes == [36, 37]
            sampler.load_sample([0.1] * 100)
            assert sampler.map_slices_to_pads(pads, count=4) is pads
            assert (pads.config.rows, pads.config.cols) == (1, 4) and pads.config.pad_notes == [36, 37, 38, 39]
            assert pads.config.pad_actions[3] == {"type": "note", "note": 39, "velocity": 90, "slice": 3, "label": "S4"}
            assert pads.config.sampler_routing == [{"channel_index": 1, "match": "all"}]
        finally:
            pads.close()
            sampler.close()


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

    def test_sequencer_grid_follows_measures_and_step_duration(self):
        config = SequencerConfig(measures=2)
        assert config.length == 16
        config.measures = 2
        assert config.length == 32 and len(config.voices_data[0]) == 32
        config.step_duration = 1.0
        assert config.length == 8
        config.time_signature_num = 3
        assert config.length == 6
        config.length = 5
        assert config.length == 5 and config.measures == 2
        view = views.SequencerView(length=8, autosync=False)
        try:
            assert view.config.step_duration == 0.5
            view.configure_grid(measures=2, step_duration=0.25)
            assert view.config.length == 32
            view.steps = [{"note": 48, "active": True}]
            assert view.steps[0]["note"] == 48 and view.steps[0]["active"] is True and len(view.steps) == 32
        finally:
            view.close()

    def test_sequencer_rust_and_midi_exports(self, tmp_path):
        pytest.importorskip("mido")
        view = views.SequencerView(length=8, num_voices=2, step_duration=0.5, bpm=132.0, autosync=False)
        other = views.SequencerView(autosync=False)
        try:
            view.set_step(0, note=60, velocity=90)
            view.set_step(0, note=64, velocity=80, voice=1)
            view.set_step(3, note=67, duration_ticks=2)
            pattern = view.to_pattern()
            assert len(pattern) == 8 and pattern.get_step(3).note == 67 and pattern.get_step(1).active is False
            assert view.to_pattern(voice=2) is None and view.to_step_sequencer(voice=2) is None
            sequencer = view.to_step_sequencer(channel=3, voice=1)
            assert sequencer.step_duration == 0.5

            path = tmp_path / "pattern.mid"
            midi = view.to_midi(path, name="Lead")
            assert path.exists() and [t.name for t in midi.tracks[1:]] == ["Lead"]
            other.load_midi(path)
            assert other.config.bpm == pytest.approx(132.0)
            assert other.config.step_duration == 0.25 and other.config.length == 7 and other.config.num_voices == 2
            notes = sorted((i, st["note"], st["duration_ticks"]) for v in other.config.voices_data for i, st in enumerate(v) if st["active"])
            assert notes == [(0, 60, 2), (0, 64, 2), (6, 67, 4)]
            other.load_midi(path, step_duration=0.5, max_voices=1)
            assert other.config.num_voices == 1 and other.config.length == 4
            with pytest.raises(IndexError):
                other.load_midi(path, track=5)
        finally:
            view.close()
            other.close()

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

    def test_sampler_edits_slices_and_files(self, tmp_path):
        path = tmp_path / "tone.wav"
        with wave.open(str(path), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(8000)
            handle.writeframes(struct.pack("<4h", 0, 32767, -32768, 0))
        view = views.SamplerView(velocity=90, autosync=False)
        try:
            view.load_audio_file(path, root_note=60)
            assert view.config.sample_name == "tone.wav" and view.config.sample_rate == 8000 and view.config.root_note == 60
            assert view.config.sample_length == 4 and view.get_sample_data()[1] == pytest.approx(32767 / 32768)
            view.load_sample([0.25, -0.5, 0.75, -1.0])
            view.trim_sample(1, 4)
            assert view.config.sample_length == 3 and view.get_sample_data() == pytest.approx([-0.5, 0.75, -1.0])
            view.normalize_sample(0.5)
            assert max(abs(s) for s in view.get_sample_data()) == pytest.approx(0.5)
            view.reverse_sample()
            assert view.get_sample_data()[0] == pytest.approx(-0.5)
            view.fade_sample(fade_in=2, fade_out=2)
            assert view.get_sample_data()[0] == 0.0 and view.get_sample_data()[-1] == 0.0
            assert len(view.config.waveform) == 12
            with pytest.raises(ValueError):
                view.trim_sample(3, 3)

            view.load_sample([0.1] * 100)
            slices = view.slice_sample(4, start_note=36)
            assert [(s["start"], s["end"], s["note"]) for s in slices] == [(0, 25, 36), (25, 50, 37), (50, 75, 38), (75, 100, 39)]
            assert view.config.pad_count == 4 and view.config.pad_notes == [36, 37, 38, 39]
            assert view.config.pad_actions[0] == {"type": "note", "note": 36, "velocity": 90, "slice": 0, "label": "S1"}
            assert view.config.sample_slices == slices
            sampler = view.to_sampler()
            assert sampler.max_voices == 8
            with pytest.raises(ValueError):
                views.SamplerView(autosync=False).slice_sample(2)
        finally:
            view.close()

    def test_sampler_zones_and_capture(self, tmp_path):
        path = tmp_path / "hit.wav"
        with wave.open(str(path), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(8000)
            handle.writeframes(struct.pack("<3h", 0, 16384, -16384))
        view = views.SamplerView(pad_notes=[36, 38, 42, 46], autosync=False)
        timeline = views.TimelineView(bpm=120.0, autosync=False)
        sent = []
        view.send = Mock(side_effect=lambda content, buffers=(): sent.append((content, buffers)))
        try:
            assert view.zone_for(60) is None
            low = view.add_zone([0.1, 0.2, 0.3], 0, 59, sample_rate=22050, name="Low")
            high = view.add_zone(struct.pack("<2f", 0.5, -0.5), 60, 127, root_note=72)
            hit = view.add_zone_file(path, 36, 36)
            assert low["root_note"] == 60 and high["name"] == "Zone 2" and high["length"] == 2
            assert hit["name"] == "hit.wav" and hit["sample_rate"] == 8000 and hit["root_note"] == 36
            assert view.zone_samples(2) == pytest.approx([0.0, 0.5, -0.5])
            assert view.zone_for(48)["id"] == low["id"] and view.zone_for(72)["id"] == high["id"]
            view.set_zone(2, note_low=40, note_high=38, name="Kick")
            assert (view.config.zones[2]["note_low"], view.config.zones[2]["note_high"], view.config.zones[2]["name"]) == (38, 40, "Kick")
            view.load_sample([0.0, 0.1], root_note=60)
            sample_map = view.to_sample_map()
            assert len(sample_map) == 4 and sample_map.find_sample(72, 100).root_note == 72
            view.remove_zone(0)
            assert [z["name"] for z in view.config.zones] == ["Zone 2", "Kick"]
            view.clear_zones()
            assert view.config.zones == [] and view.to_sample_map().find_sample(90, 100).root_note == 60

            timeline.add_track("Mic")
            clip = timeline.add_clip("Take 1", start=0.0, duration=2.0, offset=0.5, audio_url="blob:take")
            view.capture_clip(timeline, clip["id"], pad=1)
            view.capture_clip(timeline, clip["id"], name="Vox")
            ready(view)
            commands = [m for m in messages(sent) if m["t"] == "command"]
            request = commands[0]["value"]["Map"]
            assert request["url"] == {"Str": "blob:take"} and request["name"] == {"Str": "Take 1"}
            assert request["note_low"] == request["root_note"] == {"Int": 38}
            assert request["offset"] == {"Float": 0.25} and request["duration"] == {"Float": 1.0}
            with pytest.raises(ValueError, match="clip not found"):
                view.capture_clip(timeline, "missing")
            midi = timeline.add_midi_clip("Riff", events=[])
            with pytest.raises(ValueError, match="no audio"):
                view.capture_clip(timeline, midi["id"])
        finally:
            view.close()
            timeline.close()


class TestArrangementViews:
    def test_launcher_config_and_view(self):
        with pytest.raises(ValueError):
            LauncherConfig.model_validate({"quantize": "tick"})
        view = views.LauncherView(autosync=False)
        try:
            track = view.add_track("Drums")
            scene = view.add_scene()
            slot = view.set_slot(track, scene, [{"note": 36, "active": True}, {"note": 38}])
            assert slot["name"] == "Drums 1" and len(slot["voices_data"][0]) == 2
            assert view.config.slots == [slot] and view.config.tracks[0]["channel_index"] == 0
            with pytest.raises(IndexError):
                view.set_slot(1, 0, [{"note": 36}])
            sequencer = views.SequencerView(autosync=False, length=4)
            try:
                sequencer.set_step(2, note=42)
                from_view = view.set_slot(track, scene, sequencer, name="From view")
            finally:
                sequencer.close()
            assert from_view["voices_data"] == sequencer.config.voices_data
            assert view.config.slots == [from_view]
            assert isinstance(view.launch(track, scene), int)
            assert isinstance(view.stop_all(), int)
        finally:
            view.close()

    def test_launcher_slots_round_trip_through_a_sequencer_view(self):
        view = views.LauncherView(autosync=False)
        sequencer = views.SequencerView(length=4, num_voices=2, step_duration=0.5, swing=20.0, groove=[5.0, -5.0], autosync=False)
        editor = views.SequencerView(autosync=False)
        try:
            drums = view.add_track("Drums")
            view.add_track("Keys")
            a = view.add_scene("A")
            b = view.add_scene()
            sequencer.set_step(1, note=38, voice=1)
            slot = view.set_slot(drums, a, sequencer)
            assert (slot["step_duration"], slot["swing"], slot["groove"]) == (0.5, 20.0, [5.0, -5.0])
            assert view.get_slot(drums, a) == slot and view.get_slot(drums, b) is None
            replaced = view.set_slot(drums, a, [{"note": 36, "active": True}], step_duration=1.0)
            assert view.config.slots == [replaced] and replaced["step_duration"] == 1.0
            view.set_slot(drums, b, sequencer, swing=5.0)
            assert view.config.slots[1]["swing"] == 5.0
            view.slot_to_sequencer(drums, b, editor)
            assert editor.config.num_voices == 2 and editor.config.length == 4 and editor.config.step_duration == 0.5
            assert editor.config.voices_data == sequencer.config.voices_data and editor.config.groove == [5.0, -5.0]
            with pytest.raises(ValueError, match="no slot"):
                view.slot_to_sequencer(1, a, editor)
            with pytest.raises(ValueError, match="no slot"):
                view.launch(1, a)
            with pytest.raises(IndexError):
                view.launch(drums, 5)
            with pytest.raises(IndexError):
                view.stop_track(7)
            with pytest.raises(IndexError):
                view.launch_scene(2)
            assert isinstance(view.launch_scene(b), int) and isinstance(view.stop_track(drums), int)
            view.config.selected_slot = {"track_index": drums, "scene_index": b}
            view.clear_slot(drums, b)
            assert [s["scene_index"] for s in view.config.slots] == [a] and view.config.selected_slot == {}
        finally:
            view.close()
            sequencer.close()
            editor.close()

    def test_timeline_config_and_view(self):
        config = TimelineConfig(tracks=[{"name": "A"}], clips=[{"name": "c", "track_index": 5, "start": 0, "duration": 4}], current_beat=99)
        assert config.clips[0]["track_index"] == 0 and config.current_beat == 16.0
        view = views.TimelineView(autosync=False)
        try:
            lane = view.add_track("Vocals", armed=True)
            clip = view.add_clip("Take", track_index=lane, start=12.0, duration=8.0)
            assert view.config.selected_clip_id == clip["id"] and view.config.length == 20.0
            midi = view.add_midi_clip("Riff", events=[{"beat": 1.0, "duration": 0.5, "note": 72, "velocity": 90}])
            assert midi["kind"] == "midi" and midi["duration"] == 1.5
            view.export_clip(clip["id"])
            assert view.config.export_clip_id == clip["id"]
            with pytest.raises(ValueError, match="clip not found"):
                view.export_clip("missing")
            with pytest.raises(ValueError, match="no exported clip data"):
                view.write_exported_clip("take.webm")
            imported = view.import_clip(b"abc", "Import", track_index=lane, start=2.0, blob_type="audio/wav")
            assert imported["source"] == "import" and imported["blob_size"] == 3 and imported["duration"] == 4.0
            assert view.config.import_clip_request == {**imported, "measure_duration": True} and view.config.import_clip_data == b"abc"
            with pytest.raises(ValueError):
                view.import_clip(b"")
            view.seek(4.0)
            assert view.config.current_beat == 4.0
            assert isinstance(view.record(), int)
        finally:
            view.close()

    def test_timeline_lane_and_clip_edits(self, tmp_path):
        pytest.importorskip("mido")
        view = views.TimelineView(autosync=False)
        sequencer = views.SequencerView(length=4, autosync=False)
        try:
            mic = view.add_track("Mic")
            keys = view.add_track("Keys", channel_index=3)
            drums = view.add_track("Drums", channel_index=4)
            view.arm_track(keys)
            view.arm_track(drums, exclusive=True)
            assert [t["armed"] for t in view.config.tracks] == [False, False, True]
            with pytest.raises(IndexError):
                view.arm_track(9)
            take = view.add_clip("Take", track_index=mic, start=0.0, duration=2.0)
            sequencer.set_step(0, note=60)
            sequencer.set_step(2, note=64, duration_ticks=2)
            riff = view.add_pattern_clip("riff", sequencer, track_index=keys, start=4.0, step_duration=0.5, repeat=2)
            assert riff["pattern"] == "riff" and riff["duration"] == 4.0
            assert [(e["beat"], e["note"]) for e in riff["events"]] == [(0.0, 60), (1.0, 64), (2.0, 60), (3.0, 64)]
            sequence = view.clip_to_event_sequence(riff["id"])
            assert len(sequence) == 4
            with pytest.raises(ValueError, match="not a MIDI clip"):
                view.clip_to_event_sequence(take["id"])
            path = tmp_path / "riff.mid"
            view.export_midi_clip(riff["id"], path)
            added = view.import_midi(path, track_index=drums, start=8.0)
            assert len(added) == 1 and added[0]["track_index"] == drums and added[0]["start"] == 8.0
            assert [e["note"] for e in added[0]["events"]] == [60, 64, 60, 64]

            view.move_clip(take["id"], track_index=keys, start=1.0)
            view.resize_clip(take["id"], 3.0)
            moved = view.config.clips[0]
            assert (moved["track_index"], moved["start"], moved["duration"]) == (keys, 1.0, 3.0)
            copy = view.duplicate_clip(take["id"])
            assert copy["start"] == 4.0 and copy["id"] != take["id"] and view.config.selected_clip_id == copy["id"]
            view.remove_clip(copy["id"])
            assert view.config.selected_clip_id == "" and len(view.config.clips) == 3
            with pytest.raises(ValueError, match="clip not found"):
                view.move_clip("missing", start=0.0)

            view.remove_track(mic)
            assert [t["name"] for t in view.config.tracks] == ["Keys", "Drums"]
            assert [t["channel_index"] for t in view.config.tracks] == [2, 3]
            assert sorted(c["track_index"] for c in view.config.clips) == [0, 0, 1]
            view.remove_track(0)
            assert [c["name"] for c in view.config.clips] == ["riff"] and view.config.clips[0]["track_index"] == 0
            view.remove_track(5)
        finally:
            view.close()
            sequencer.close()


def browser_writes(view, **values):
    """A browser write to the view's status, as the server applies it after the ownership check."""

    def tagged(value):
        if isinstance(value, bool):
            return {"Bool": value}
        if isinstance(value, int):
            return {"Int": value}
        if isinstance(value, float):
            return {"Float": value}
        if isinstance(value, str):
            return {"Str": value}
        if isinstance(value, bytes):
            return {"Bytes": base64.b64encode(value).decode("ascii")}
        if isinstance(value, list):
            return {"List": [tagged(item) for item in value]}
        return {"Map": {key: tagged(item) for key, item in value.items()}}

    ops = [{"Set": {"path": [{"Key": name}], "value": tagged(value)}} for name, value in values.items()]
    view.session._submit_owned(view.status_id, {"ops": ops})


class TestObservers:
    def test_config_and_status_changes_reach_observers(self):
        view = views.TransportView(autosync=False)
        seen = []
        try:
            stop = view.on_change(lambda v, name, old, new: seen.append((name, old, new)))
            only_bpm = []
            view.on_change(lambda v, name, old, new: only_bpm.append(new), names="bpm")
            view.config.bpm = 140.0
            browser_writes(view, is_playing=True, current_beat=2.5)
            assert view.status.is_playing is True and view.status.current_beat == 2.5
            browser_writes(view, is_playing=True)
            assert seen == [("bpm", 120.0, 140.0), ("is_playing", False, True), ("current_beat", 0.0, 2.5)]
            assert only_bpm == [140.0]
            stop()
            view.config.bpm = 90.0
            assert len(seen) == 3 and only_bpm == [140.0, 90.0]
        finally:
            view.close()

    def test_timeline_collects_exported_clips(self):
        view = views.TimelineView(autosync=False)
        try:
            view.add_track("Mic")
            first = view.add_clip("One", audio_url="blob:one")
            second = view.add_clip("Two", start=4.0, audio_url="blob:two")
            view.add_clip("Silent")
            assert view.export_all_clips() == 2
            assert view.pending_exports == 2 and view.config.export_clip_id == first["id"]
            browser_writes(view, exported_clip={"id": first["id"], "blob_type": "audio/webm"}, exported_clip_data=b"one")
            assert view.clip_audio == {first["id"]: {"data": b"one", "blob_type": "audio/webm"}}
            assert view.pending_exports == 1 and view.config.export_clip_id == second["id"]
            browser_writes(view, exported_clip={"id": second["id"], "blob_type": "audio/wav"}, exported_clip_data=b"two")
            assert view.pending_exports == 0 and view.config.export_clip_id == ""
            assert view.export_all_clips() == 0 and view.export_all_clips(refresh=True) == 2
        finally:
            view.close()

    def test_launcher_slot_editor_follows_the_selection(self):
        launcher = views.LauncherView(autosync=False)
        editor = views.SequencerView(autosync=False)
        try:
            track = launcher.add_track("Drums")
            scene = launcher.add_scene()
            launcher.add_scene()
            launcher.set_slot(track, scene, [{"note": 36, "active": True}, {"note": 38}], name="Beat", step_duration=0.5)
            unbind = launcher.bind_slot_editor(editor)
            assert editor.config.length == 16
            launcher.config.selected_slot = {"track_index": track, "scene_index": scene}
            assert editor.config.length == 2 and editor.config.step_duration == 0.5 and editor.steps[0]["note"] == 36
            editor.set_step(1, note=42)
            editor.config.swing = 15.0
            slot = launcher.get_slot(track, scene)
            assert slot["name"] == "Beat" and slot["voices_data"][0][1]["note"] == 42 and slot["swing"] == 15.0
            launcher.config.selected_slot = {"track_index": track, "scene_index": 1}
            editor.set_step(0, note=60)
            assert launcher.get_slot(track, scene)["voices_data"][0][0]["note"] == 36 and launcher.get_slot(track, 1) is None
            unbind()
            launcher.config.selected_slot = {"track_index": track, "scene_index": scene}
            editor.set_step(0, note=61)
            assert launcher.get_slot(track, scene)["voices_data"][0][0]["note"] == 36
        finally:
            launcher.close()
            editor.close()


class TestSession:
    def test_views_share_the_session_and_follow_the_session_settings(self):
        session = views.Session(bpm=100.0, time_signature=(3, 4), theme="flat")
        try:
            assert session.transport.session is not session.launcher.session
            assert len({view.config.session_id for view in session.views}) == 1
            assert session.timeline.config.bpm == 100.0 and session.launcher.config.time_signature_num == 3
            seq, synth = views.SequencerView(autosync=False), views.SynthView(autosync=False)
            track = session.add_track("Lead", seq, synth)
            assert track.mixer_channel == 0 and seq.config.channel_index == 0 and synth.config.channel_index == 0
            assert seq.config.session_id == session.session_id and synth.config.theme == "flat" and seq.config.bpm == 100.0
            assert session.timeline.config.tracks[0]["input"] == "channel" and session.launcher.config.tracks[0]["name"] == "Lead"
            session.add_track("Vocals", armed=True)
            assert session.timeline.config.tracks[1]["input"] == "microphone" and session.timeline.config.tracks[1]["armed"] is True
            session.bpm = 128.0
            assert seq.config.bpm == 128.0 and session.timeline.config.bpm == 128.0
            session.theme = "grim"
            assert synth.config.theme == "grim" and session.mixer.config.theme == "grim"
            assert isinstance(session.play(), int)
        finally:
            session.close()


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
