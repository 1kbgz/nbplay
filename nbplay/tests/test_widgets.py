import base64
import json
import struct
import wave
import zipfile
from unittest.mock import Mock

import pytest
import transports
from transports._buffers import join_buffers

import nbplay
from nbplay.descriptors import PadAction
from nbplay.history import History
from nbplay.midi_learn import MidiLearn
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


def ready(widget, name="owner"):
    widget._msg_callbacks(widget, {"ready": True, "ownership": True, "view": name}, [])


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


class TestSynthWidget:
    def test_waveform_follows_the_oscillator_parameters(self):
        with pytest.raises(ValueError):
            SynthConfig.model_validate({"oscillator_type": "triangle"})
        widget = nbplay.SynthWidget(frequency=220.0, autosync=False)
        try:
            first = widget.config.waveform
            assert len(first) == 4 * min(2048, int(44100 / 220 * 3))
            widget.config.frequency = 440.0
            assert len(widget.config.waveform) == 4 * int(44100 / 440 * 3)
            widget.config.oscillator_type = "noise"
            assert len(widget.config.waveform) == 4 * 1024
            assert widget._tree["tag"] == "nbplay-synth"
            assert widget._tree["bindings"]["waveform"]["field"] == "config.waveform"
        finally:
            widget.close()

    def test_waveform_bytes_travel_as_buffers(self):
        widget = nbplay.SynthWidget(autosync=False)
        sent = []
        widget.send = Mock(side_effect=lambda content, buffers=(): sent.append((content, buffers)))
        try:
            ready(widget)
            assert any(buffers for _, buffers in sent)
            command = widget.play()
            assert isinstance(command, int)
        finally:
            widget.close()


class TestMixerWidget:
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
        widget = nbplay.MixerWidget(autosync=False)
        try:
            assert widget.status is None and widget.status_id is None
            assert [w["namespace"] for w in widget._wires] == ["config"]
            assert "nbplay-wire" not in str(widget._tree)
            index = widget.add_channel("Drums")
            widget.add_return("Rev")
            widget.add_channel_effect(index, {"type": "compressor", "threshold": -18})
            widget.add_master_effect({"type": "limiter"})
            assert widget.config.channels[0]["sends"] == [0.0]
            assert widget.config.channels[0]["effects"][0]["type"] == "compressor"
            assert widget.config.master_effects[0]["type"] == "limiter"
            widget.remove_channel(index)
            assert widget.config.channels == []
            with pytest.raises(TypeError):
                widget._command("x", 1)
        finally:
            widget.close()

    def test_strip_send_and_effect_setters(self):
        widget = nbplay.MixerWidget(autosync=False)
        try:
            drums = widget.add_channel("Drums")
            keys = widget.add_channel("Keys")
            widget.set_channel_gain(drums, 5)
            widget.set_channel_pan(drums, -2)
            widget.set_channel_mute(drums, 1)
            widget.set_channel_solo(keys, True)
            channel = widget.config.channels[drums]
            assert (channel["gain"], channel["pan"], channel["mute"]) == (2.0, -1.0, True)
            assert widget.config.channels[keys]["solo"] is True
            widget.set_channel_effects(drums, [{"type": "gain", "gain": 9}, {"type": "limiter"}])
            widget.set_channel_effect_enabled(drums, 1, False)
            assert widget.config.channels[drums]["effects"] == [
                {"type": "gain", "gain": 4.0},
                {"type": "limiter", "threshold": -1.0, "release": 0.05, "enabled": False},
            ]
            widget.set_channel_effect_enabled(drums, 1)
            assert "enabled" not in widget.config.channels[drums]["effects"][1]
            widget.clear_channel_effects(drums)
            assert widget.config.channels[drums]["effects"] == []
            widget.set_master_effects([{"type": "compressor"}, {"type": "limiter"}])
            widget.set_master_effect_enabled(0, False)
            assert widget.config.master_effects[0]["enabled"] is False
            widget.clear_master_effects()
            assert widget.config.master_effects == []

            verb = widget.add_return("Verb")
            delay = widget.add_return("Delay", effects=[{"type": "delay"}])
            widget.set_return_gain(verb, 3)
            widget.add_return_effect(verb, {"type": "reverb", "wet": 2})
            widget.set_return_effect_enabled(verb, 0, False)
            assert widget.config.returns[verb]["gain"] == 2.0
            assert widget.config.returns[verb]["effects"][0]["wet"] == 1.0 and widget.config.returns[verb]["effects"][0]["enabled"] is False
            widget.set_return_effects(delay, [])
            assert widget.config.returns[delay]["effects"] == []
            widget.set_send(drums, verb, 0.5)
            widget.set_send(drums, delay, 7)
            assert widget.config.channels[drums]["sends"] == [0.5, 1.0]
            with pytest.raises(IndexError):
                widget.set_send(drums, 2, 0.1)
            widget.remove_return(verb)
            assert [r["name"] for r in widget.config.returns] == ["Delay"]
            assert widget.config.channels[drums]["sends"] == [1.0] and widget.config.channels[keys]["sends"] == [0.0]

            mixer = widget.to_mixer()
            assert len(mixer) == 2
            assert mixer.get_channel(drums).gain == 2.0 and mixer.get_channel(drums).mute is True
            assert mixer.get_channel(keys).solo is True
            assert mixer.master_gain == pytest.approx(0.8)
        finally:
            widget.close()


class TestEffectPlugin:
    def test_added_effect_types_fill_defaults_and_clamp(self):
        assert nbplay.EffectPlugin("eq").to_dict() == {
            "type": "eq",
            "low": 0.0,
            "low_freq": 120.0,
            "mid": 0.0,
            "mid_freq": 1000.0,
            "mid_q": 1.0,
            "high": 0.0,
            "high_freq": 8000.0,
        }
        assert nbplay.EffectPlugin("eq", low=40, mid_q=0).params["low"] == 24.0
        assert nbplay.EffectPlugin("eq", low=40, mid_q=0).params["mid_q"] == 0.1
        assert nbplay.EffectPlugin("distortion", drive=3).to_dict() == {"type": "distortion", "drive": 1.0, "tone": 8000.0, "wet": 1.0}
        assert nbplay.EffectPlugin("chorus").params == {"rate": 1.5, "depth": 0.003, "delay": 0.02, "wet": 0.5}
        assert nbplay.EffectPlugin("phaser", feedback=2).params["feedback"] == 0.9
        assert nbplay.EffectPlugin("tremolo", enabled=False).to_dict() == {"type": "tremolo", "rate": 5.0, "depth": 0.5, "enabled": False}
        with pytest.raises(ValueError, match="finite"):
            nbplay.EffectPlugin("tremolo", rate=float("nan"))
        with pytest.raises(ValueError, match="type must be one of"):
            nbplay.EffectPlugin("wobble")

    def test_mixer_normalizes_the_added_effects(self):
        widget = nbplay.MixerWidget(autosync=False)
        try:
            channel = widget.add_channel("Lead")
            widget.set_channel_effects(channel, [{"type": "eq", "high": -30}, nbplay.EffectPlugin("phaser")])
            effects = widget.config.channels[channel]["effects"]
            assert effects[0]["high"] == -24.0 and effects[0]["mid_freq"] == 1000.0
            assert effects[1] == {"type": "phaser", "rate": 0.5, "depth": 0.7, "frequency": 800.0, "feedback": 0.4, "wet": 0.5}
        finally:
            widget.close()


class TestKeysWidgets:
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
        for cls, tag in (
            (nbplay.PadWidget, "nbplay-pads"),
            (nbplay.KeyboardWidget, "nbplay-keyboard"),
            (nbplay.MidiKeyboardWidget, "nbplay-midi-keyboard"),
        ):
            widget = cls(autosync=False)
            try:
                assert widget._tree["tag"] == tag
                assert widget.status_id is not None
                assert widget._tree["bindings"]["lastNoteEvent"]["field"] == "status.last_note_event"
                assert widget._tree["bindings"]["theme"]["field"] == "config.theme"
            finally:
                widget.close()

    def test_keyboards_route_to_samplers_and_record_into_sequencers(self):
        keys = nbplay.KeyboardWidget(autosync=False)
        midi = nbplay.MidiKeyboardWidget(autosync=False)
        pads = nbplay.PadWidget(autosync=False)
        drums = nbplay.SamplerWidget(channel_index=2, autosync=False)
        bass = nbplay.SamplerWidget(channel_index=5, autosync=False)
        loose = nbplay.SamplerWidget(autosync=False)
        sequencer = nbplay.SequencerWidget(autosync=False)
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
            for widget in (keys, midi, pads, drums, bass, loose, sequencer):
                widget.close()

    def test_pads_grid_helpers_and_sampler_slices(self):
        pads = nbplay.PadWidget(velocity=90, autosync=False)
        sampler = nbplay.SamplerWidget(channel_index=1, autosync=False)
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


class TestIoWidgets:
    def test_settings_and_midi_output_views(self):
        settings = nbplay.SettingsWidget(sample_rate=48000, autosync=False)
        try:
            assert settings.config.sample_rate == 48000
            assert settings._tree["bindings"]["midiEvent"]["field"] == "status.midi_event"
            with pytest.raises(ValueError):
                settings.config.channels = 3
        finally:
            settings.close()
        out = nbplay.MidiOutputWidget(channel=9, autosync=False)
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


class TestSequencerAndSamplerWidgets:
    def test_sequencer_config_fits_voices(self):
        config = SequencerConfig(length=4, num_voices=2)
        assert [len(v) for v in config.voices_data] == [4, 4]
        assert config.voices_data[0][0] == {"note": 60, "velocity": 100, "duration_ticks": 1, "active": False, "probability": 100.0}
        config.voices_data = [[{"note": 200, "velocity": 0, "active": True}]]
        assert config.voices_data[0][0]["note"] == 127 and config.voices_data[0][0]["velocity"] == 1
        assert [len(v) for v in config.voices_data] == [4, 4]
        config.length = 2
        assert [len(v) for v in config.voices_data] == [2, 2]
        widget = nbplay.SequencerWidget(length=8, autosync=False)
        try:
            widget.set_step(2, note=48, active=True)
            widget.toggle_step(3)
            assert widget.config.voices_data[0][2]["note"] == 48 and widget.config.voices_data[0][3]["active"] is True
            widget.clear()
            assert not any(step["active"] for step in widget.config.voices_data[0])
            assert isinstance(widget.play(), int)
        finally:
            widget.close()

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
        widget = nbplay.SequencerWidget(length=8, autosync=False)
        try:
            assert widget.config.step_duration == 0.5
            widget.configure_grid(measures=2, step_duration=0.25)
            assert widget.config.length == 32
            widget.steps = [{"note": 48, "active": True}]
            assert widget.steps[0]["note"] == 48 and widget.steps[0]["active"] is True and len(widget.steps) == 32
        finally:
            widget.close()

    def test_sequencer_rust_and_midi_exports(self, tmp_path):
        pytest.importorskip("mido")
        widget = nbplay.SequencerWidget(length=8, num_voices=2, step_duration=0.5, bpm=132.0, autosync=False)
        other = nbplay.SequencerWidget(autosync=False)
        try:
            widget.set_step(0, note=60, velocity=90)
            widget.set_step(0, note=64, velocity=80, voice=1)
            widget.set_step(3, note=67, duration_ticks=2)
            pattern = widget.to_pattern()
            assert len(pattern) == 8 and pattern.get_step(3).note == 67 and pattern.get_step(1).active is False
            assert widget.to_pattern(voice=2) is None and widget.to_step_sequencer(voice=2) is None
            sequencer = widget.to_step_sequencer(channel=3, voice=1)
            assert sequencer.step_duration == 0.5

            path = tmp_path / "pattern.mid"
            midi = widget.to_midi(path, name="Lead")
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
            widget.close()
            other.close()

    def test_sampler_config_and_view(self):
        config = SamplerConfig(pad_count=3)
        assert config.pad_notes == [48, 49, 50] and config.pad_velocities == [100] * 3 and len(config.pad_actions) == 3
        config.pad_count = 2
        assert len(config.pad_notes) == 2 and len(config.pad_actions) == 2
        widget = nbplay.SamplerWidget(autosync=False)
        try:
            widget.load_sample([0.0, 0.5, -0.5, 1.5], sample_rate=22050, root_note=200, name="click")
            assert widget.config.sample_length == 4 and widget.config.root_note == 127
            assert len(widget.config.sample_data) == 16 and len(widget.config.waveform) == 16
            widget.configure_pads(pad_notes=[60, 64])
            assert widget.config.pad_count == 2 and widget.config.pad_notes == [60, 64]
            zone = widget.add_zone([0.1, 0.2], 40, 40)
            assert zone["root_note"] == 40 and len(widget.config.zones) == 1 and widget.config.zones[0]["data"] == zone["data"]
            assert isinstance(widget.capture("blob:x", note=60, duration=1.5), int)
        finally:
            widget.close()

    def test_sampler_edits_slices_and_files(self, tmp_path):
        path = tmp_path / "tone.wav"
        with wave.open(str(path), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(8000)
            handle.writeframes(struct.pack("<4h", 0, 32767, -32768, 0))
        widget = nbplay.SamplerWidget(velocity=90, autosync=False)
        try:
            widget.load_audio_file(path, root_note=60)
            assert widget.config.sample_name == "tone.wav" and widget.config.sample_rate == 8000 and widget.config.root_note == 60
            assert widget.config.sample_length == 4 and widget.get_sample_data()[1] == pytest.approx(32767 / 32768)
            widget.load_sample([0.25, -0.5, 0.75, -1.0])
            widget.trim_sample(1, 4)
            assert widget.config.sample_length == 3 and widget.get_sample_data() == pytest.approx([-0.5, 0.75, -1.0])
            widget.normalize_sample(0.5)
            assert max(abs(s) for s in widget.get_sample_data()) == pytest.approx(0.5)
            widget.reverse_sample()
            assert widget.get_sample_data()[0] == pytest.approx(-0.5)
            widget.fade_sample(fade_in=2, fade_out=2)
            assert widget.get_sample_data()[0] == 0.0 and widget.get_sample_data()[-1] == 0.0
            assert len(widget.config.waveform) == 12
            with pytest.raises(ValueError):
                widget.trim_sample(3, 3)

            widget.load_sample([0.1] * 100)
            slices = widget.slice_sample(4, start_note=36)
            assert [(s["start"], s["end"], s["note"]) for s in slices] == [(0, 25, 36), (25, 50, 37), (50, 75, 38), (75, 100, 39)]
            assert widget.config.pad_count == 4 and widget.config.pad_notes == [36, 37, 38, 39]
            assert widget.config.pad_actions[0] == {"type": "note", "note": 36, "velocity": 90, "slice": 0, "label": "S1"}
            assert widget.config.sample_slices == slices
            sampler = widget.to_sampler()
            assert sampler.max_voices == 8
            with pytest.raises(ValueError):
                nbplay.SamplerWidget(autosync=False).slice_sample(2)
        finally:
            widget.close()

    def test_sampler_zones_and_capture(self, tmp_path):
        path = tmp_path / "hit.wav"
        with wave.open(str(path), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(8000)
            handle.writeframes(struct.pack("<3h", 0, 16384, -16384))
        widget = nbplay.SamplerWidget(pad_notes=[36, 38, 42, 46], autosync=False)
        timeline = nbplay.TimelineWidget(bpm=120.0, autosync=False)
        sent = []
        widget.send = Mock(side_effect=lambda content, buffers=(): sent.append((content, buffers)))
        try:
            assert widget.zone_for(60) is None
            low = widget.add_zone([0.1, 0.2, 0.3], 0, 59, sample_rate=22050, name="Low")
            high = widget.add_zone(struct.pack("<2f", 0.5, -0.5), 60, 127, root_note=72)
            hit = widget.add_zone_file(path, 36, 36)
            assert low["root_note"] == 60 and high["name"] == "Zone 2" and high["length"] == 2
            assert hit["name"] == "hit.wav" and hit["sample_rate"] == 8000 and hit["root_note"] == 36
            assert widget.zone_samples(2) == pytest.approx([0.0, 0.5, -0.5])
            assert widget.zone_for(48)["id"] == low["id"] and widget.zone_for(72)["id"] == high["id"]
            widget.set_zone(2, note_low=40, note_high=38, name="Kick")
            assert (widget.config.zones[2]["note_low"], widget.config.zones[2]["note_high"], widget.config.zones[2]["name"]) == (38, 40, "Kick")
            widget.load_sample([0.0, 0.1], root_note=60)
            sample_map = widget.to_sample_map()
            assert len(sample_map) == 4 and sample_map.find_sample(72, 100).root_note == 72
            widget.remove_zone(0)
            assert [z["name"] for z in widget.config.zones] == ["Zone 2", "Kick"]
            widget.clear_zones()
            assert widget.config.zones == [] and widget.to_sample_map().find_sample(90, 100).root_note == 60

            timeline.add_track("Mic")
            clip = timeline.add_clip("Take 1", start=0.0, duration=2.0, offset=0.5, audio_url="blob:take")
            widget.capture_clip(timeline, clip["id"], pad=1)
            widget.capture_clip(timeline, clip["id"], name="Vox")
            ready(widget)
            commands = [m for m in messages(sent) if m["t"] == "command"]
            request = commands[0]["value"]["Map"]
            assert request["url"] == {"Str": "blob:take"} and request["name"] == {"Str": "Take 1"}
            assert request["note_low"] == request["root_note"] == {"Int": 38}
            assert request["offset"] == {"Float": 0.25} and request["duration"] == {"Float": 1.0}
            with pytest.raises(ValueError, match="clip not found"):
                widget.capture_clip(timeline, "missing")
            midi = timeline.add_midi_clip("Riff", events=[])
            with pytest.raises(ValueError, match="no audio"):
                widget.capture_clip(timeline, midi["id"])
        finally:
            widget.close()
            timeline.close()


class TestArrangementWidgets:
    def test_launcher_config_and_view(self):
        with pytest.raises(ValueError):
            LauncherConfig.model_validate({"quantize": "tick"})
        widget = nbplay.LauncherWidget(autosync=False)
        try:
            # Every view of one widget carries the same engine key; another widget has its own.
            key = widget.tree().to_node()["props"]["engineKey"]
            other = nbplay.LauncherWidget(autosync=False)
            assert key == widget.tree("lead.").to_node()["props"]["engineKey"] != other.tree().to_node()["props"]["engineKey"]
            other.close()
            track = widget.add_track("Drums")
            scene = widget.add_scene()
            slot = widget.set_slot(track, scene, [{"note": 36, "active": True}, {"note": 38}])
            assert slot["name"] == "Drums 1" and len(slot["voices_data"][0]) == 2
            assert widget.config.slots == [slot] and widget.config.tracks[0]["channel_index"] == 0
            with pytest.raises(IndexError):
                widget.set_slot(1, 0, [{"note": 36}])
            sequencer = nbplay.SequencerWidget(autosync=False, length=4)
            try:
                sequencer.set_step(2, note=42)
                from_view = widget.set_slot(track, scene, sequencer, name="From widget")
            finally:
                sequencer.close()
            assert from_view["voices_data"] == sequencer.config.voices_data
            assert widget.config.slots == [from_view]
            assert isinstance(widget.launch(track, scene), int)
            assert isinstance(widget.stop_all(), int)
        finally:
            widget.close()

    def test_launcher_slots_round_trip_through_a_sequencer_view(self):
        widget = nbplay.LauncherWidget(autosync=False)
        sequencer = nbplay.SequencerWidget(length=4, num_voices=2, step_duration=0.5, swing=20.0, groove=[5.0, -5.0], autosync=False)
        editor = nbplay.SequencerWidget(autosync=False)
        try:
            drums = widget.add_track("Drums")
            widget.add_track("Keys")
            a = widget.add_scene("A")
            b = widget.add_scene()
            sequencer.set_step(1, note=38, voice=1)
            slot = widget.set_slot(drums, a, sequencer)
            assert (slot["step_duration"], slot["swing"], slot["groove"]) == (0.5, 20.0, [5.0, -5.0])
            assert widget.get_slot(drums, a) == slot and widget.get_slot(drums, b) is None
            replaced = widget.set_slot(drums, a, [{"note": 36, "active": True}], step_duration=1.0)
            assert widget.config.slots == [replaced] and replaced["step_duration"] == 1.0
            widget.set_slot(drums, b, sequencer, swing=5.0)
            assert widget.config.slots[1]["swing"] == 5.0
            widget.slot_to_sequencer(drums, b, editor)
            assert editor.config.num_voices == 2 and editor.config.length == 4 and editor.config.step_duration == 0.5
            assert editor.config.voices_data == sequencer.config.voices_data and editor.config.groove == [5.0, -5.0]
            with pytest.raises(ValueError, match="no slot"):
                widget.slot_to_sequencer(1, a, editor)
            with pytest.raises(ValueError, match="no slot"):
                widget.launch(1, a)
            with pytest.raises(IndexError):
                widget.launch(drums, 5)
            with pytest.raises(IndexError):
                widget.stop_track(7)
            with pytest.raises(IndexError):
                widget.launch_scene(2)
            assert isinstance(widget.launch_scene(b), int) and isinstance(widget.stop_track(drums), int)
            widget.config.selected_slot = {"track_index": drums, "scene_index": b}
            widget.clear_slot(drums, b)
            assert [s["scene_index"] for s in widget.config.slots] == [a] and widget.config.selected_slot == {}
        finally:
            widget.close()
            sequencer.close()
            editor.close()

    def test_timeline_config_and_view(self):
        config = TimelineConfig(tracks=[{"name": "A"}], clips=[{"name": "c", "track_index": 5, "start": 0, "duration": 4}], current_beat=99)
        assert config.clips[0]["track_index"] == 0 and config.current_beat == 16.0
        widget = nbplay.TimelineWidget(autosync=False)
        try:
            lane = widget.add_track("Vocals", armed=True)
            clip = widget.add_clip("Take", track_index=lane, start=12.0, duration=8.0)
            assert widget.config.selected_clip_id == clip["id"] and widget.config.length == 20.0
            midi = widget.add_midi_clip("Riff", events=[{"beat": 1.0, "duration": 0.5, "note": 72, "velocity": 90}])
            assert midi["kind"] == "midi" and midi["duration"] == 1.5
            widget.export_clip(clip["id"])
            assert widget.config.export_clip_id == clip["id"]
            with pytest.raises(ValueError, match="clip not found"):
                widget.export_clip("missing")
            with pytest.raises(ValueError, match="no exported clip data"):
                widget.write_exported_clip("take.webm")
            imported = widget.import_clip(b"abc", "Import", track_index=lane, start=2.0, blob_type="audio/wav")
            assert imported["source"] == "import" and imported["blob_size"] == 3 and imported["duration"] == 4.0
            assert widget.config.import_clip_request == {**imported, "measure_duration": True} and widget.config.import_clip_data == b"abc"
            with pytest.raises(ValueError):
                widget.import_clip(b"")
            widget.seek(4.0)
            assert widget.config.current_beat == 4.0
            assert isinstance(widget.record(), int)
        finally:
            widget.close()

    def test_timeline_lane_and_clip_edits(self, tmp_path):
        pytest.importorskip("mido")
        widget = nbplay.TimelineWidget(autosync=False)
        sequencer = nbplay.SequencerWidget(length=4, autosync=False)
        try:
            mic = widget.add_track("Mic")
            keys = widget.add_track("Keys", channel_index=3)
            drums = widget.add_track("Drums", channel_index=4)
            widget.arm_track(keys)
            widget.arm_track(drums, exclusive=True)
            assert [t["armed"] for t in widget.config.tracks] == [False, False, True]
            with pytest.raises(IndexError):
                widget.arm_track(9)
            take = widget.add_clip("Take", track_index=mic, start=0.0, duration=2.0)
            sequencer.set_step(0, note=60)
            sequencer.set_step(2, note=64, duration_ticks=2)
            riff = widget.add_pattern_clip("riff", sequencer, track_index=keys, start=4.0, step_duration=0.5, repeat=2)
            assert riff["pattern"] == "riff" and riff["duration"] == 4.0
            assert [(e["beat"], e["note"]) for e in riff["events"]] == [(0.0, 60), (1.0, 64), (2.0, 60), (3.0, 64)]
            sequence = widget.clip_to_event_sequence(riff["id"])
            assert len(sequence) == 4
            with pytest.raises(ValueError, match="not a MIDI clip"):
                widget.clip_to_event_sequence(take["id"])
            path = tmp_path / "riff.mid"
            widget.export_midi_clip(riff["id"], path)
            added = widget.import_midi(path, track_index=drums, start=8.0)
            assert len(added) == 1 and added[0]["track_index"] == drums and added[0]["start"] == 8.0
            assert [e["note"] for e in added[0]["events"]] == [60, 64, 60, 64]

            widget.move_clip(take["id"], track_index=keys, start=1.0)
            widget.resize_clip(take["id"], 3.0)
            moved = widget.config.clips[0]
            assert (moved["track_index"], moved["start"], moved["duration"]) == (keys, 1.0, 3.0)
            copy = widget.duplicate_clip(take["id"])
            assert copy["start"] == 4.0 and copy["id"] != take["id"] and widget.config.selected_clip_id == copy["id"]
            widget.remove_clip(copy["id"])
            assert widget.config.selected_clip_id == "" and len(widget.config.clips) == 3
            with pytest.raises(ValueError, match="clip not found"):
                widget.move_clip("missing", start=0.0)

            widget.remove_track(mic)
            assert [t["name"] for t in widget.config.tracks] == ["Keys", "Drums"]
            assert [t["channel_index"] for t in widget.config.tracks] == [2, 3]
            assert sorted(c["track_index"] for c in widget.config.clips) == [0, 0, 1]
            widget.remove_track(0)
            assert [c["name"] for c in widget.config.clips] == ["riff"] and widget.config.clips[0]["track_index"] == 0
            widget.remove_track(5)
        finally:
            widget.close()
            sequencer.close()


def browser_writes(widget, **values):
    """A browser write to the widget's status, as the server applies it after the ownership check."""

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
    widget.session._submit_owned(widget.status_id, {"ops": ops})


class TestObservers:
    def test_config_and_status_changes_reach_observers(self):
        widget = nbplay.TransportWidget(autosync=False)
        seen = []
        try:
            stop = widget.on_change(lambda v, name, old, new: seen.append((name, old, new)))
            only_bpm = []
            widget.on_change(lambda v, name, old, new: only_bpm.append(new), names="bpm")
            widget.config.bpm = 140.0
            browser_writes(widget, is_playing=True, current_beat=2.5)
            assert widget.status.is_playing is True and widget.status.current_beat == 2.5
            browser_writes(widget, is_playing=True)
            assert seen == [("bpm", 120.0, 140.0), ("is_playing", False, True), ("current_beat", 0.0, 2.5)]
            assert only_bpm == [140.0]
            stop()
            widget.config.bpm = 90.0
            assert len(seen) == 3 and only_bpm == [140.0, 90.0]
        finally:
            widget.close()

    def test_timeline_collects_exported_clips(self):
        widget = nbplay.TimelineWidget(autosync=False)
        try:
            widget.add_track("Mic")
            first = widget.add_clip("One", audio_url="blob:one")
            second = widget.add_clip("Two", start=4.0, audio_url="blob:two")
            widget.add_clip("Silent")
            assert widget.export_all_clips() == 2
            assert widget.pending_exports == 2 and widget.config.export_clip_id == first["id"]
            browser_writes(widget, exported_clip={"id": first["id"], "blob_type": "audio/webm"}, exported_clip_data=b"one")
            assert widget.clip_audio == {first["id"]: {"data": b"one", "blob_type": "audio/webm"}}
            assert widget.pending_exports == 1 and widget.config.export_clip_id == second["id"]
            browser_writes(widget, exported_clip={"id": second["id"], "blob_type": "audio/wav"}, exported_clip_data=b"two")
            assert widget.pending_exports == 0 and widget.config.export_clip_id == ""
            assert widget.export_all_clips() == 0 and widget.export_all_clips(refresh=True) == 2
        finally:
            widget.close()

    def test_timeline_moves_on_when_the_browser_gives_up_on_an_export(self):
        widget = nbplay.TimelineWidget(autosync=False)
        try:
            widget.add_track("Mic")
            widget.add_clip("One", audio_url="blob:one")
            second = widget.add_clip("Two", start=4.0, audio_url="blob:two")
            assert widget.export_all_clips() == 2
            # The browser clears the request when it cannot read a clip's audio.
            widget.config.export_clip_id = ""
            assert widget.pending_exports == 1 and widget.config.export_clip_id == second["id"]
            browser_writes(widget, exported_clip={"id": second["id"], "blob_type": "audio/wav"}, exported_clip_data=b"two")
            assert widget.pending_exports == 0 and list(widget.clip_audio) == [second["id"]]
        finally:
            widget.close()

    def test_slot_editor_drops_stale_browser_edits_and_reloads_a_replaced_slot(self):
        launcher = nbplay.LauncherWidget(autosync=False)
        editor = nbplay.SequencerWidget(autosync=False)

        def browser_edits(token, serial, note):
            # The element acks the token it edited on, then sends the pattern field.
            editor.config.edit_ack = f"{token}#{serial}"
            voices = [[dict(step) for step in voice] for voice in editor.config.voices_data]
            voices[0][0]["note"] = note
            editor.config.voices_data = voices

        def first_note(scene):
            return launcher.get_slot(0, scene)["voices_data"][0][0]["note"]

        try:
            launcher.add_track("Drums")
            launcher.add_scene()
            launcher.add_scene()
            launcher.set_slot(0, 0, [{"note": 36, "active": True}, {"note": 38}])
            launcher.set_slot(0, 1, [{"note": 48, "active": True}, {"note": 50}])
            unbind = launcher.bind_slot_editor(editor)
            launcher.config.selected_slot = {"track_index": 0, "scene_index": 0}
            first = editor.config.edit_token
            assert first.startswith("0:0:")
            browser_edits(first, 1, 37)
            assert first_note(0) == 37

            # The user selects the other slot while an edit of the first is still on its way.
            launcher.config.selected_slot = {"track_index": 0, "scene_index": 1}
            second = editor.config.edit_token
            assert second.startswith("0:1:") and second != first and editor.steps[0]["note"] == 48
            browser_edits(first, 2, 99)
            assert first_note(1) == 48 and first_note(0) == 37
            assert editor.steps[0]["note"] == 48 and editor.config.edit_token == second
            # Edits made on the slot the browser now shows land on it, and so does a Python edit.
            browser_edits(second, 3, 49)
            assert first_note(1) == 49
            editor.set_step(1, note=51)
            assert launcher.get_slot(0, 1)["voices_data"][0][1]["note"] == 51

            # Replacing the selected slot from Python reloads the editor under a new token.
            launcher.set_slot(0, 1, [{"note": 72, "active": True}])
            third = editor.config.edit_token
            assert editor.config.length == 1 and editor.steps[0]["note"] == 72 and third not in (first, second)
            browser_edits(second, 4, 10)
            assert first_note(1) == 72 and editor.steps[0]["note"] == 72
            # Replacing a slot that is not selected leaves the editor alone.
            launcher.set_slot(0, 0, [{"note": 40}])
            assert editor.config.edit_token == third and editor.steps[0]["note"] == 72

            unbind()
            assert editor.config.edit_token == ""
            editor.set_step(0, note=73)
            assert first_note(1) == 72
        finally:
            launcher.close()
            editor.close()

    def test_launcher_slot_editor_follows_the_selection(self):
        launcher = nbplay.LauncherWidget(autosync=False)
        editor = nbplay.SequencerWidget(autosync=False)
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
    def test_widgets_share_the_session_and_follow_the_session_settings(self):
        session = nbplay.Session(bpm=100.0, time_signature=(3, 4), theme="flat")
        try:
            assert session.transport.session is not session.launcher.session
            assert len({widget.config.session_id for widget in session.widgets}) == 1
            assert session.timeline.config.bpm == 100.0 and session.launcher.config.time_signature_num == 3
            seq, synth = nbplay.SequencerWidget(autosync=False), nbplay.SynthWidget(autosync=False)
            track = session.add_track("Lead", seq, synth)
            assert track.mixer_channel == 0 and seq.config.channel_index == 0 and synth.config.channel_index == 0
            assert seq.config.session_id == session.session_id and synth.config.theme == "flat" and seq.config.bpm == 100.0
            assert (seq.config.time_signature_num, seq.config.time_signature_den) == (3, 4) and seq.config.length == 12
            assert session.timeline.config.tracks[0]["input"] == "channel" and session.launcher.config.tracks[0]["name"] == "Lead"
            session.add_track("Vocals", armed=True)
            assert session.timeline.config.tracks[1]["input"] == "microphone" and session.timeline.config.tracks[1]["armed"] is True
            session.bpm = 128.0
            assert seq.config.bpm == 128.0 and session.timeline.config.bpm == 128.0
            session.theme = "grim"
            assert synth.config.theme == "grim" and session.mixer.config.theme == "grim"
            session.transport.config.theme = "pro"
            assert session.theme == "pro" and synth.config.theme == "pro" and session.launcher.config.theme == "pro"
            # A tempo edit on the transport (the browser's clock writes it there) reaches every widget's model.
            session.history.mark()
            session.transport.config.bpm = 141.0
            assert session.bpm == 141.0 and session.launcher.config.bpm == 141.0
            assert seq.config.bpm == 141.0 and session.timeline.config.bpm == 141.0
            assert session.undo() and session.launcher.config.bpm == 128.0 and session.transport.config.bpm == 128.0
            assert isinstance(session.play(), int)
            # Every widget that counts bars gets both halves of the time signature.
            for widget in (session.transport, session.launcher, session.timeline, seq):
                bindings = widget.tree().to_node()["bindings"]
                assert bindings["timeSignatureNum"]["field"] == "config.time_signature_num"
                assert bindings["timeSignatureDen"]["field"] == "config.time_signature_den"
        finally:
            session.close()

    def test_session_undo_covers_views_but_not_track_structure(self):
        session = nbplay.Session()
        seq, synth = nbplay.SequencerWidget(length=4, autosync=False), nbplay.SynthWidget(autosync=False)
        try:
            track = session.add_track("Lead", seq, synth)
            assert len(session.history) == 0
            session.mixer.set_channel_gain(track.mixer_channel, 0.3)
            session.history.mark()
            seq.set_step(1, note=64)
            session.history.mark()
            synth.config.oscillator_type = "square"
            session.history.mark()
            session.bpm = 99.0
            session.history.mark()
            session.timeline.add_clip("Take", track_index=0, start=0.0, duration=2.0)
            assert len(session.history) == 5
            assert session.undo() and session.timeline.config.clips == []
            assert session.undo() and session.bpm == 120.0 and seq.config.bpm == 120.0 and session.launcher.config.bpm == 120.0
            assert session.undo() and synth.config.oscillator_type == "sine"
            assert session.undo() and seq.config.voices_data[0][1]["active"] is False
            assert session.undo() and session.mixer.config.channels[0]["gain"] == 0.8
            assert session.undo() is False
            assert session.redo() and session.mixer.config.channels[0]["gain"] == 0.3
            session.history.clear()
            session.add_track("Keys")
            assert len(session.history) == 0
        finally:
            session.close()

    def test_transport_shortcut_requests_undo_and_redo(self):
        session = nbplay.Session()
        try:
            binding = session.transport._tree["bindings"]["undoRequest"]
            assert binding["field"] == "status.undo_request" and binding["event"] == "nbplay-request"
            session.bpm = 99.0
            session.history.mark()
            browser_writes(session.transport, undo_request=1)
            assert session.bpm == 120.0
            browser_writes(session.transport, redo_request=1)
            assert session.bpm == 99.0
            browser_writes(session.transport, redo_request=2)
            assert session.bpm == 99.0 and len(session.history) == 1
        finally:
            session.close()

    def test_lane_and_channel_mute_solo_mirror_each_other(self):
        session = nbplay.Session()
        try:
            session.add_track("Drums")
            session.add_track("Keys")
            session.timeline.config.tracks = [{**session.timeline.config.tracks[0], "muted": True}, session.timeline.config.tracks[1]]
            assert [c["mute"] for c in session.mixer.config.channels] == [True, False]
            session.mixer.set_channel_solo(1, True)
            session.mixer.set_channel_mute(0, False)
            assert [(t["muted"], t["solo"]) for t in session.timeline.config.tracks] == [(False, False), (False, True)]
        finally:
            session.close()


class TestSessionArrangement:
    def test_remove_track_shifts_channels_lanes_and_rows(self):
        session = nbplay.Session()
        seq, sampler = nbplay.SequencerWidget(autosync=False), nbplay.SamplerWidget(autosync=False)
        try:
            session.add_track("Audio")
            inst = session.add_track("Inst", seq, sampler)
            session.launcher.add_scene()
            session.launcher.set_slot(0, 0, [{"note": 36, "active": True}])
            session.launcher.set_slot(1, 0, [{"note": 40, "active": True}])
            session.launcher.config.selected_slot = {"track_index": 0, "scene_index": 0}
            session.timeline.add_clip("Take", track_index=0)
            session.timeline.add_clip("Riff", track_index=1)
            session.history.clear()
            session.remove_track(0)
            assert session.tracks == [inst] and inst.mixer_channel == 0
            assert seq.config.channel_index == 0 and sampler.config.channel_index == 0
            assert [c["name"] for c in session.mixer.config.channels] == ["Inst"]
            assert [t["name"] for t in session.timeline.config.tracks] == ["Inst"] and session.timeline.config.tracks[0]["channel_index"] == 0
            assert [c["name"] for c in session.timeline.config.clips] == ["Riff"] and session.timeline.config.clips[0]["track_index"] == 0
            assert session.launcher.config.selected_slot == {} and [s["track_index"] for s in session.launcher.config.slots] == [0]
            assert len(session.history) == 0
            session.remove_track(5)
            session.remove_track(0)
            assert session.tracks == [] and seq.config.session_id == "" and seq.config.channel_index == -1
        finally:
            session.close()

    def test_patterns_chain_and_update_as_single_steps(self):
        session = nbplay.Session()
        seq = nbplay.SequencerWidget(length=4, step_duration=1.0, autosync=False)
        try:
            seq.set_step(0, note=36)
            drums = session.add_track("Drums", seq, nbplay.SamplerWidget(autosync=False))
            session.history.clear()
            entry = session.add_pattern("a", seq)
            assert entry["step_duration"] == 1.0 and len(entry["voices_data"][0]) == 4
            with pytest.raises(ValueError, match="unknown pattern"):
                session.chain(drums, ["b"])
            clips = session.chain("Drums", ["a", "a"], start=0.0)
            assert len(clips) == 2 and clips[1]["start"] == 4.0 and clips[1]["pattern"] == "a"
            assert len(session.history) == 1 and seq.config.follow_transport is False
            session.update_pattern("a", [{"note": 40, "active": True}], step_duration=2.0)
            assert len(session.history) == 2
            assert [c["events"][0]["note"] for c in session.timeline.config.clips] == [40, 40]
            assert session.undo() and session.timeline.config.clips[0]["events"][0]["note"] == 36
            assert session.undo() and session.timeline.config.clips == [] and seq.config.follow_transport is True
            assert session.redo() and len(session.timeline.config.clips) == 2
            session.remove_pattern("a")
            assert session.patterns == {}
            with pytest.raises(IndexError):
                session.chain(3, [])
        finally:
            session.close()

    def test_midi_round_trip(self, tmp_path):
        pytest.importorskip("mido")
        session = nbplay.Session(bpm=100.0, time_signature=(3, 4))
        seq = nbplay.SequencerWidget(length=4, step_duration=1.0, autosync=False)
        loaded = nbplay.Session()
        try:
            seq.set_step(0, note=60)
            session.add_track("Lead", seq, nbplay.SynthWidget(autosync=False))
            keys = session.add_track("Keys", input="midi")
            session.timeline.add_midi_clip("Riff", track_index=keys.mixer_channel, start=2.0, events=[{"beat": 0.5, "duration": 0.5, "note": 72}])
            path = tmp_path / "song.mid"
            midi = session.export_midi(path)
            assert [t.name for t in midi.tracks[1:]] == ["Lead", "Riff"]
            added = loaded.import_midi(path)
            assert [t.name for t in added] == ["Lead", "Riff"] and loaded.bpm == 100.0 and loaded.time_signature == (3, 4)
            clips = loaded.timeline.config.clips
            assert clips[0]["events"][0]["note"] == 60 and clips[1]["events"][0]["beat"] == 2.5
            assert loaded.timeline.config.tracks[1]["input"] == "midi" and len(loaded.history) == 0
        finally:
            session.close()
            loaded.close()


def arranged_session():
    session = nbplay.Session(bpm=132.0, time_signature=(3, 4), theme="pro")
    session.transport.config.update(loop_enabled=True, loop_end_bar=8)
    seq = nbplay.SequencerWidget(length=8, num_voices=2, step_duration=0.5, swing=15, autosync=False)
    seq.set_step(0, note=60, velocity=90)
    seq.set_step(3, note=67, velocity=70, voice=1)
    synth = nbplay.SynthWidget(oscillator_type="saw", frequency=220.0, amplitude=0.3, autosync=False)
    lead = session.add_track("Lead", seq, synth)
    sampler = nbplay.SamplerWidget(pad_count=4, attack=0.02, release=0.4, autosync=False)
    sampler.load_sample([0.0, 0.5, -0.5, 0.25], sample_rate=22050, root_note=48, name="Blip")
    sampler.configure_pads(pad_notes=[48, 50, 52, 53])
    sampler.add_zone([0.25, -0.25], 36, 36, sample_rate=8000, name="Kick")
    drums = session.add_track("Drums", sound_source=sampler, armed=True)
    session.add_track("Vocals")
    session.mixer.set_channel_gain(lead.mixer_channel, 0.6)
    session.mixer.add_channel_effect(lead.mixer_channel, {"type": "filter", "filter_type": "lowpass", "frequency": 2000, "q": 0.8})
    session.mixer.config.master_gain = 0.7
    session.mixer.add_master_effect({"type": "limiter", "threshold": -2})
    session.mixer.add_return("Verb", effects=[{"type": "reverb", "wet": 1.0}], gain=0.9)
    session.mixer.set_send(lead.mixer_channel, 0, 0.35)
    session.timeline.config.update(length=32, count_in_bars=1, pixels_per_beat=24)
    take = session.timeline.add_clip("Take", track_index=2, start=4.0, duration=2.5, offset=0.5, audio_url="blob:take")
    browser_writes(session.timeline, exported_clip={"id": take["id"], "blob_type": "audio/wav"}, exported_clip_data=b"RIFF-take")
    session.launcher.add_scene("Intro")
    session.launcher.add_scene("Drop")
    session.launcher.set_slot(drums.mixer_channel, 1, [{"note": 36, "active": True}, {"note": 38, "active": True}], name="Kit")
    session.launcher.config.quantize = "beat"
    session.add_pattern("hook", [{"note": 60, "active": True}], step_duration=1.0)
    session.chain("Lead", ["hook"], start=8.0)
    return session


class TestSessionPersistence:
    def test_to_dict_is_json_safe(self):
        session = arranged_session()
        try:
            data = session.to_dict()
            json.dumps(data)
            assert data["format"] == "nbplay-session" and data["transport"]["bpm"] == 132.0
            assert [t["name"] for t in data["tracks"]] == ["Lead", "Drums", "Vocals"]
            assert data["tracks"][0]["sound_source"]["type"] == "SynthWidget" and data["tracks"][1]["sequencer"] is None
            assert "audio_url" not in data["timeline"]["clips"][0] and "sample_file" not in data["tracks"][1]["sound_source"]
            keys = nbplay.KeyboardWidget(autosync=False)
            session.add_track("Keys", sound_source=keys)
            with pytest.raises(ValueError, match="cannot save sound source"):
                session.to_dict()
        finally:
            session.close()

    def test_save_and_load_round_trip(self, tmp_path):
        session = arranged_session()
        loaded = None
        try:
            take = session.timeline.config.clips[0]
            path = session.save(tmp_path / "song.nbplay")
            with zipfile.ZipFile(path) as archive:
                names = set(archive.namelist())
            assert {"session.json", "samples/track-1.f32", "samples/track-1-zone-0.f32", f"clips/{take['id']}.bin"} <= names
            loaded = nbplay.Session.load(path)
            assert loaded.bpm == 132.0 and loaded.time_signature == (3, 4) and loaded.theme == "pro"
            assert loaded.transport.config.loop_enabled is True and loaded.transport.config.loop_end_bar == 8
            assert [t.name for t in loaded.tracks] == ["Lead", "Drums", "Vocals"]
            seq = loaded.tracks[0].sequencer
            assert seq.config.num_voices == 2 and seq.config.swing == 15.0 and seq.config.follow_transport is False
            assert seq.config.voices_data == session.tracks[0].sequencer.config.voices_data and seq.config.theme == "pro"
            assert seq.config.session_id == loaded.session_id and seq.config.channel_index == 0
            synth = loaded.tracks[0].sound_source
            assert isinstance(synth, nbplay.SynthWidget) and synth.config.oscillator_type == "saw" and synth.config.frequency == 220.0
            sampler = loaded.tracks[1].sound_source
            assert isinstance(sampler, nbplay.SamplerWidget) and loaded.tracks[1].sequencer is None
            assert sampler.get_sample_data() == pytest.approx([0.0, 0.5, -0.5, 0.25]) and sampler.config.sample_name == "Blip"
            assert sampler.config.pad_notes == [48, 50, 52, 53] and sampler.config.attack == 0.02
            assert sampler.zone_samples(0) == pytest.approx([0.25, -0.25]) and sampler.config.zones[0]["name"] == "Kick"
            mixer = loaded.mixer.config
            assert mixer.channels[0]["gain"] == 0.6 and mixer.channels[0]["effects"][0]["type"] == "filter" and mixer.channels[0]["sends"] == [0.35]
            assert mixer.master_gain == 0.7 and mixer.returns[0]["name"] == "Verb"
            timeline = loaded.timeline.config
            assert timeline.length == 32 and timeline.count_in_bars == 1 and timeline.pixels_per_beat == 24
            assert timeline.tracks[1]["armed"] is True and timeline.selected_clip_id == ""
            restored = next(c for c in timeline.clips if c["name"] == "Take")
            assert restored["id"] == take["id"] and restored["offset"] == 0.5 and restored["blob_type"] == "audio/wav"
            assert timeline.import_clip_data == b"RIFF-take" and timeline.import_clip_request["id"] == take["id"]
            hook = [c for c in timeline.clips if c.get("pattern") == "hook"]
            assert len(hook) == 1 and hook[0]["start"] == 8.0 and loaded.patterns == session.patterns
            launcher = loaded.launcher.config
            assert launcher.scenes == ["Intro", "Drop"] and launcher.quantize == "beat" and launcher.slots[0]["name"] == "Kit"
            assert len(loaded.history) == 0
        finally:
            session.close()
            if loaded is not None:
                loaded.close()


class TestHistoryAndMidiLearn:
    def test_history_tracks_config_fields_and_skips_transient_ones(self):
        widget = nbplay.TransportWidget(autosync=False)
        history = History(group_window=0)
        try:
            history.attach(widget)
            widget.config.session_id = "nbplay-x"
            assert len(history) == 0
            widget.config.bpm = 100.0
            widget.config.loop_enabled = True
            assert history.steps == [[(widget.config, "bpm")], [(widget.config, "loop_enabled")]]
            assert history.undo() and widget.config.loop_enabled is False
            assert history.undo() and widget.config.bpm == 120.0
            assert history.redo() and widget.config.bpm == 100.0
            history.detach(widget)
            widget.config.bpm = 90.0
            assert len(history) == 0
        finally:
            widget.close()

    def test_midi_learn_maps_controllers_to_view_fields(self):
        source = nbplay.MidiKeyboardWidget(autosync=False)
        synth = nbplay.SynthWidget(autosync=False)
        transport = nbplay.TransportWidget(autosync=False)
        keys = nbplay.KeyboardWidget(autosync=False)
        try:
            with pytest.raises(TypeError):
                MidiLearn(synth)
            learn = MidiLearn(source)
            learn.map(74, synth, "frequency", low=100.0, high=1000.0)
            learn.map(21, transport, "loop_enabled")
            learn.map(20, keys, "upper_octave", low=0, high=9)
            with pytest.raises(ValueError):
                learn.map(1, synth, "missing")
            with pytest.raises(TypeError):
                learn.map(1, synth, "oscillator_type")
            browser_writes(source, control_change={"controller": 74, "value": 127, "channel": 0, "seq": 1})
            browser_writes(source, control_change={"controller": 21, "value": 64, "channel": 0, "seq": 2})
            browser_writes(source, control_change={"controller": 20, "value": 127, "channel": 0, "seq": 3})
            assert synth.config.frequency == 1000.0 and transport.config.loop_enabled is True and keys.config.upper_octave == 9
            learn.learn(synth, "amplitude", low=0.0, high=0.5)
            browser_writes(source, control_change={"controller": 11, "value": 127, "channel": 0, "seq": 4})
            assert learn.mappings[11]["name"] == "amplitude" and synth.config.amplitude == 0.5
            learn.close()
            browser_writes(source, control_change={"controller": 74, "value": 0, "channel": 0, "seq": 5})
            assert synth.config.frequency == 1000.0
        finally:
            for widget in (source, synth, transport, keys):
                widget.close()

    def test_history_groups_transactions_and_skips_paused_changes(self):
        seq = nbplay.SequencerWidget(length=4, autosync=False)
        history = History(limit=3, group_window=0)
        try:
            history.attach(seq)
            assert history.can_undo is False and history.undo() is False
            with history.transaction():
                seq.set_step(0, note=60)
                seq.config.swing = 20.0
                with history.transaction():
                    seq.config.loop_enabled = False
            assert len(history) == 1
            history.undo()
            assert seq.config.swing == 0.0 and seq.config.loop_enabled is True and not seq.config.voices_data[0][0]["active"]
            with history.paused():
                seq.config.swing = 50.0
            assert history.can_redo is True and len(history) == 0
            for value in (1.0, 2.0, 3.0, 4.0, 5.0):
                seq.config.swing = value
            assert len(history) == 3 and history.can_redo is False
            history.clear()
            assert len(history) == 0
            history.attach(None)
            history.attach(object())
            assert history.steps == []
        finally:
            seq.close()

    def test_history_rapid_changes_share_a_step_and_detach_drops_entries(self):
        a, b = nbplay.SynthWidget(autosync=False), nbplay.SynthWidget(autosync=False)
        history = History()
        try:
            history.attach(a)
            history.attach(b)
            a.config.frequency = 100.0
            a.config.amplitude = 0.1
            assert len(history) == 1
            history.mark()
            b.config.frequency = 200.0
            assert len(history) == 2
            history.undo()
            assert b.config.frequency == 440.0
            history.undo()
            assert a.config.frequency == 440.0 and a.config.amplitude == 0.8
            history.redo()
            history.redo()
            history.detach(a)
            assert history.steps == [[(b.config, "frequency")]]
        finally:
            a.close()
            b.close()

    def test_history_binds_ipython_cell_boundaries(self):
        class Events:
            def __init__(self):
                self.registered = []

            def register(self, name, callback):
                self.registered.append((name, callback))

        class Shell:
            events = Events()

        synth = nbplay.SynthWidget(autosync=False)
        history = History()
        try:
            history.attach(synth)
            shell = Shell()
            assert history.bind_ipython(shell) is True
            ((name, callback),) = shell.events.registered
            assert name == "post_run_cell"
            synth.config.frequency = 100.0
            callback(object())
            synth.config.frequency = 200.0
            assert len(history) == 2
            assert history.bind_ipython(object()) is False
        finally:
            synth.close()

    def test_sampler_load_is_one_undo_step(self):
        session = nbplay.Session()
        sampler = nbplay.SamplerWidget(autosync=False)
        try:
            session.add_track("Drums", sound_source=sampler)
            sampler.load_sample([0.1, 0.2], sample_rate=8000, root_note=40, name="Blip")
            assert len(session.history) == 1
            session.undo()
            assert sampler.config.sample_length == 0 and sampler.config.root_note == 69
            session.redo()
            assert sampler.get_sample_data() == pytest.approx([0.1, 0.2])
        finally:
            session.close()

    def test_midi_learn_scales_ints_and_bools_and_filters_channels(self):
        source = nbplay.MidiKeyboardWidget(autosync=False)
        seq = nbplay.SequencerWidget(autosync=False)
        synth = nbplay.SynthWidget(amplitude=0.3, autosync=False)
        try:
            learn = MidiLearn(source)
            learn.map(20, seq, "length", low=1, high=16)
            learn.map(21, seq, "loop_enabled")
            learn.map(1, synth, "amplitude", channel=2)
            with pytest.raises(ValueError):
                learn.map(128, synth, "amplitude")
            browser_writes(source, control_change={"controller": 20, "value": 127, "channel": 0, "seq": 1})
            browser_writes(source, control_change={"controller": 21, "value": 63, "channel": 0, "seq": 2})
            assert seq.config.length == 16 and seq.config.loop_enabled is False
            browser_writes(source, control_change={"controller": 20, "value": 0, "channel": 0, "seq": 3})
            browser_writes(source, control_change={"controller": 21, "value": 64, "channel": 0, "seq": 4})
            assert seq.config.length == 1 and seq.config.loop_enabled is True
            browser_writes(source, control_change={"controller": 1, "value": 127, "channel": 0, "seq": 5})
            assert synth.config.amplitude == 0.3
            browser_writes(source, control_change={"controller": 1, "value": 127, "channel": 2, "seq": 6})
            assert synth.config.amplitude == 1.0
            assert learn.apply(20, 200) == 16 and learn.apply(99, 10) is None
            assert learn.unmap(1) is True and learn.unmap(1) is False
            learn.learn(synth, "frequency")
            assert learn.learning is True
            learn.cancel()
            assert learn.learning is False
            browser_writes(source, control_change={"controller": 12, "value": 1, "channel": 0, "seq": 7})
            assert 12 not in learn.mappings
            with pytest.raises(ValueError):
                learn.learn(synth, "missing")
            learn.close()
            assert learn.mappings == {}
        finally:
            for widget in (source, seq, synth):
                widget.close()


class TestTransportWidget:
    def test_hosts_config_and_status_and_binds_the_element(self):
        widget = nbplay.TransportWidget(bpm=100.0, theme="flat", autosync=False)
        try:
            assert widget.config.bpm == 100.0 and widget.config.theme == "flat"
            assert widget.config_id != widget.status_id
            tree = widget._tree
            assert tree["tag"] == "nbplay-transport"
            assert tree["bindings"]["bpm"] == {"field": "config.bpm", "mode": "two-way", "event": "nbplay-set"}
            assert tree["bindings"]["isPlaying"] == {"field": "status.is_playing", "mode": "two-way", "event": "nbplay-status"}
            assert [w["namespace"] for w in widget._wires] == ["config", "status"]
            assert [p["name"] for p in widget._packages] == ["nbplay"]
        finally:
            widget.close()

    def test_commands_reach_the_owning_view(self):
        widget = nbplay.TransportWidget(autosync=False)
        sent = []
        widget.send = Mock(side_effect=lambda content, buffers=(): sent.append((content, buffers)))
        try:
            command = widget.play()
            assert isinstance(command, int)
            ready(widget)
            kinds = [m["t"] for m in messages(sent)]
            assert kinds.count("snapshot") == 2
            commands = [m for m in messages(sent) if m["t"] == "command"]
            assert len(commands) == 1
            assert commands[0]["field"] == "is_playing" and commands[0]["value"] == {"Bool": True}
            assert commands[0]["id"] == widget.status_id
        finally:
            widget.close()

    def test_config_assignment_syncs(self):
        widget = nbplay.TransportWidget(autosync=False)
        sent = []
        widget.send = Mock(side_effect=lambda content, buffers=(): sent.append((content, buffers)))
        try:
            ready(widget)
            sent.clear()
            widget.config.bpm = 140.0
            transports.sync(widget.server)
            patches = [m for m in messages(sent) if m["t"] == "patch"]
            assert patches and json.dumps(patches[-1]).count("140") >= 1
        finally:
            widget.close()
