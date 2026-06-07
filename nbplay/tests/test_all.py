import json
import math
import pathlib
import struct
import wave

import pytest

from nbplay import (
    AudioBuffer,
    AudioClip,
    AudioFormat,
    AudioSample,
    EffectPlugin,
    Envelope,
    EventSequence,
    KeyboardRoute,
    KeyboardWidget,
    MidiChannel,
    MidiEvent,
    MidiKeyboardWidget,
    MidiMessage,
    Mixer,
    MixerChannel,
    MixerWidget,
    NoiseSource,
    Note,
    NoteComposer,
    NoteEvent,
    PadAction,
    PadWidget,
    Pattern,
    SampleMap,
    SampleMapping,
    Sampler,
    SamplerWidget,
    SawOscillator,
    SequencerWidget,
    Session,
    SettingsWidget,
    SineOscillator,
    SquareOscillator,
    Step,
    StepSequencer,
    SynthWidget,
    TimelineTrack,
    TimelineWidget,
    Track,
    TransportClock,
    TransportWidget,
    Velocity,
)

#  Audio types


class TestAudioFormat:
    def test_construction(self):
        fmt = AudioFormat(44100, 2)
        assert fmt.sample_rate == 44100
        assert fmt.channels == 2

    def test_defaults(self):
        fmt = AudioFormat()
        assert fmt.sample_rate == 44100
        assert fmt.channels == 2

    def test_repr(self):
        fmt = AudioFormat(48000, 1)
        assert "48000" in repr(fmt)
        assert "1" in repr(fmt)

    def test_str(self):
        fmt = AudioFormat(44100, 2)
        assert "44100" in str(fmt)

    def test_eq(self):
        assert AudioFormat(44100, 2) == AudioFormat(44100, 2)
        assert AudioFormat(44100, 1) != AudioFormat(44100, 2)


class TestAudioBuffer:
    def test_construction(self):
        buf = AudioBuffer(128)
        assert buf.frames == 128
        assert len(buf) == 128  # mono: samples == frames

    def test_stereo(self):
        buf = AudioBuffer(64, 44100, 2)
        assert buf.frames == 64
        assert len(buf) == 128  # stereo: 64 frames * 2 channels

    def test_sample_at_and_set_sample(self):
        buf = AudioBuffer(4, 44100, 1)
        assert buf.sample_at(0, 0) == 0.0
        buf.set_sample(2, 0, 0.75)
        assert buf.sample_at(2, 0) == pytest.approx(0.75)

    def test_out_of_bounds(self):
        buf = AudioBuffer(4, 44100, 1)
        with pytest.raises(IndexError):
            buf.sample_at(4, 0)
        with pytest.raises(IndexError):
            buf.set_sample(4, 0, 1.0)

    def test_clear(self):
        buf = AudioBuffer(4, 44100, 1)
        buf.set_sample(0, 0, 1.0)
        buf.clear()
        assert buf.sample_at(0, 0) == 0.0

    def test_to_list(self):
        buf = AudioBuffer(4, 44100, 1)
        buf.set_sample(1, 0, 0.5)
        lst = buf.to_list()
        assert len(lst) == 4
        assert lst[1] == pytest.approx(0.5)

    def test_format_property(self):
        buf = AudioBuffer(4, 48000, 2)
        fmt = buf.format
        assert fmt.sample_rate == 48000
        assert fmt.channels == 2

    def test_repr(self):
        buf = AudioBuffer(128, 44100, 1)
        r = repr(buf)
        assert "128" in r
        assert "44100" in r


#  MIDI types


class TestMidiChannel:
    def test_valid_range(self):
        for i in range(16):
            ch = MidiChannel(i)
            assert ch.value == i

    def test_invalid_range(self):
        with pytest.raises(ValueError):
            MidiChannel(16)
        with pytest.raises(ValueError):
            MidiChannel(255)

    def test_repr(self):
        assert "0" in repr(MidiChannel(0))

    def test_eq(self):
        assert MidiChannel(0) == MidiChannel(0)
        assert MidiChannel(0) != MidiChannel(1)


class TestNote:
    def test_valid_range(self):
        for i in range(128):
            n = Note(i)
            assert n.value == i

    def test_invalid_range(self):
        with pytest.raises(ValueError):
            Note(128)
        with pytest.raises(ValueError):
            Note(255)

    def test_to_hz_a4(self):
        n = Note(69)
        assert n.to_hz() == pytest.approx(440.0)

    def test_to_hz_c4(self):
        n = Note(60)
        assert n.to_hz() == pytest.approx(261.6256, rel=1e-3)

    def test_to_hz_octave(self):
        a3 = Note(57).to_hz()
        a4 = Note(69).to_hz()
        assert a4 / a3 == pytest.approx(2.0)

    def test_from_hz(self):
        n = Note.from_hz(440.0)
        assert n.value == 69

    def test_repr(self):
        assert "69" in repr(Note(69))


class TestVelocity:
    def test_valid_range(self):
        for i in range(128):
            v = Velocity(i)
            assert v.value == i

    def test_invalid_range(self):
        with pytest.raises(ValueError):
            Velocity(128)

    def test_repr(self):
        assert "100" in repr(Velocity(100))


class TestMidiMessage:
    def test_note_on(self):
        msg = MidiMessage.note_on(0, 69, 100)
        r = repr(msg)
        assert "NoteOn" in r

    def test_note_off(self):
        msg = MidiMessage.note_off(0, 69, 0)
        r = repr(msg)
        assert "NoteOff" in r

    def test_control_change(self):
        msg = MidiMessage.control_change(1, 64, 127)
        assert "ControlChange" in repr(msg)

    def test_program_change(self):
        msg = MidiMessage.program_change(0, 10)
        assert "ProgramChange" in repr(msg)

    def test_pitch_bend(self):
        msg = MidiMessage.pitch_bend(0, 8192)
        assert "PitchBend" in repr(msg)

    def test_clock(self):
        msg = MidiMessage.clock()
        assert "Clock" in repr(msg)

    def test_start(self):
        msg = MidiMessage.start()
        assert "Start" in repr(msg)

    def test_stop(self):
        msg = MidiMessage.stop()
        assert "Stop" in repr(msg)

    def test_eq(self):
        a = MidiMessage.note_on(0, 69, 100)
        b = MidiMessage.note_on(0, 69, 100)
        assert a == b

    def test_invalid_channel(self):
        with pytest.raises(ValueError):
            MidiMessage.note_on(16, 69, 100)

    def test_invalid_note(self):
        with pytest.raises(ValueError):
            MidiMessage.note_on(0, 128, 100)

    def test_invalid_velocity(self):
        with pytest.raises(ValueError):
            MidiMessage.note_on(0, 69, 128)


class TestMidiEvent:
    def test_construction(self):
        msg = MidiMessage.note_on(0, 69, 100)
        evt = MidiEvent(msg, 12345)
        assert evt.timestamp_us == 12345

    def test_message_roundtrip(self):
        msg = MidiMessage.note_on(0, 60, 80)
        evt = MidiEvent(msg, 0)
        assert evt.message == msg

    def test_repr(self):
        msg = MidiMessage.note_on(0, 69, 100)
        evt = MidiEvent(msg, 999)
        r = repr(evt)
        assert "999" in r
        assert "NoteOn" in r


#  Oscillators


class TestSineOscillator:
    def test_construction(self):
        osc = SineOscillator(440.0, 1.0, 44100)
        assert osc.frequency == 440.0
        assert osc.amplitude == 1.0
        assert osc.sample_rate == 44100

    def test_defaults(self):
        osc = SineOscillator()
        assert osc.frequency == 440.0
        assert osc.amplitude == 1.0
        assert osc.sample_rate == 44100

    def test_render_length(self):
        osc = SineOscillator(440.0, 1.0, 44100)
        samples = osc.render_to_buffer(1024)
        assert len(samples) == 1024

    def test_render_peak_amplitude(self):
        osc = SineOscillator(440.0, 1.0, 44100)
        samples = osc.render_to_buffer(44100)
        assert max(samples) > 0.99
        assert min(samples) < -0.99
        assert max(samples) <= 1.001
        assert min(samples) >= -1.001

    def test_render_custom_amplitude(self):
        osc = SineOscillator(440.0, 0.5, 44100)
        samples = osc.render_to_buffer(44100)
        assert max(samples) < 0.51
        assert max(samples) > 0.49

    def test_render_zero_crossings(self):
        osc = SineOscillator(440.0, 1.0, 44100)
        samples = osc.render_to_buffer(44100)
        crossings = sum(1 for i in range(1, len(samples)) if (samples[i - 1] >= 0 and samples[i] < 0) or (samples[i - 1] < 0 and samples[i] >= 0))
        # 440 Hz → 880 zero crossings per second (±2 tolerance)
        assert 878 <= crossings <= 882

    def test_repr(self):
        osc = SineOscillator(440.0, 1.0, 44100)
        assert "440" in repr(osc)


class TestSquareOscillator:
    def test_render_values(self):
        osc = SquareOscillator(1.0, 1.0, 100)
        samples = osc.render_to_buffer(100)
        assert len(samples) == 100
        # First half should be +1.0, second half should be -1.0
        for s in samples[:50]:
            assert s == pytest.approx(1.0)
        for s in samples[50:]:
            assert s == pytest.approx(-1.0)

    def test_repr(self):
        osc = SquareOscillator(440.0, 1.0, 44100)
        assert "SquareOscillator" in repr(osc)


class TestSawOscillator:
    def test_render_ramps(self):
        osc = SawOscillator(1.0, 1.0, 100)
        samples = osc.render_to_buffer(100)
        assert len(samples) == 100
        # Should start at -1.0 and ramp up
        assert samples[0] == pytest.approx(-1.0)
        # Each sample should be greater than the previous (monotonic)
        for i in range(1, len(samples)):
            assert samples[i] > samples[i - 1]

    def test_repr(self):
        osc = SawOscillator(440.0, 1.0, 44100)
        assert "SawOscillator" in repr(osc)


class TestNoiseSource:
    def test_render_range(self):
        noise = NoiseSource(1.0, 42)
        samples = noise.render_to_buffer(1000)
        assert len(samples) == 1000
        assert max(samples) <= 1.0
        assert min(samples) >= -1.0

    def test_render_nonconstant(self):
        noise = NoiseSource(1.0, 42)
        samples = noise.render_to_buffer(100)
        assert len(set(samples)) > 1

    def test_deterministic(self):
        noise1 = NoiseSource(1.0, 42)
        noise2 = NoiseSource(1.0, 42)
        s1 = noise1.render_to_buffer(100)
        s2 = noise2.render_to_buffer(100)
        assert s1 == s2

    def test_repr(self):
        noise = NoiseSource(0.5, 0)
        assert "NoiseSource" in repr(noise)


#  SynthWidget


class TestSynthWidget:
    def test_defaults(self):
        w = SynthWidget()
        assert w.oscillator_type == "sine"
        assert w.frequency == 440.0
        assert w.amplitude == 0.8
        assert w.sample_rate == 44100
        assert w.is_playing is False

    def test_waveform_generated_on_init(self):
        w = SynthWidget()
        assert len(w.waveform) > 0
        # waveform is packed float32 (4 bytes each)
        assert len(w.waveform) % 4 == 0

    def test_waveform_is_binary_float32(self):
        w = SynthWidget()
        n_samples = len(w.waveform) // 4
        samples = struct.unpack(f"<{n_samples}f", w.waveform)
        # All values should be in [-1, 1] for amplitude=0.8
        assert all(-1.0 <= s <= 1.0 for s in samples)

    def test_waveform_updates_on_type_change(self):
        w = SynthWidget()
        sine_waveform = w.waveform
        w.oscillator_type = "square"
        square_waveform = w.waveform
        assert sine_waveform != square_waveform

    def test_waveform_updates_on_frequency_change(self):
        w = SynthWidget()
        w1 = w.waveform
        w.frequency = 220.0
        w2 = w.waveform
        assert w1 != w2

    def test_waveform_updates_on_amplitude_change(self):
        w = SynthWidget()
        w1 = w.waveform
        w.amplitude = 0.3
        w2 = w.waveform
        assert w1 != w2

    def test_noise_waveform(self):
        w = SynthWidget(oscillator_type="noise")
        n_samples = len(w.waveform) // 4
        assert n_samples == 1024  # fixed size for noise

    def test_custom_init(self):
        w = SynthWidget(
            oscillator_type="saw",
            frequency=880.0,
            amplitude=0.5,
            sample_rate=48000,
        )
        assert w.oscillator_type == "saw"
        assert w.frequency == 880.0
        assert w.amplitude == 0.5
        assert w.sample_rate == 48000
        assert len(w.waveform) > 0


#  SettingsWidget


class TestSettingsWidget:
    def test_defaults(self):
        w = SettingsWidget()
        assert w.sample_rate == 44100
        assert w.channels == 1
        assert w.buffer_size == 512
        assert w.audio_device == ""
        assert w.midi_port == ""
        assert w.available_midi_ports == []
        assert w.midi_event == b""

    def test_custom_init(self):
        w = SettingsWidget(
            sample_rate=48000,
            channels=2,
            buffer_size=1024,
            audio_device="Built-in Audio",
        )
        assert w.sample_rate == 48000
        assert w.channels == 2
        assert w.buffer_size == 1024
        assert w.audio_device == "Built-in Audio"

    def test_set_sample_rate(self):
        w = SettingsWidget()
        w.sample_rate = 96000
        assert w.sample_rate == 96000

    def test_set_channels(self):
        w = SettingsWidget()
        w.channels = 2
        assert w.channels == 2

    def test_set_buffer_size(self):
        w = SettingsWidget()
        w.buffer_size = 2048
        assert w.buffer_size == 2048

    def test_set_midi_port(self):
        w = SettingsWidget()
        w.midi_port = "My MIDI Controller"
        assert w.midi_port == "My MIDI Controller"

    def test_set_available_midi_ports(self):
        w = SettingsWidget()
        w.available_midi_ports = ["Port A", "Port B"]
        assert w.available_midi_ports == ["Port A", "Port B"]

    def test_midi_event_bytes(self):
        w = SettingsWidget()
        w.midi_event = b"\x00" * 8 + b"\x90\x3c\x64"
        assert len(w.midi_event) == 11


#  MixerChannel (Rust)


class TestMixerChannel:
    def test_defaults(self):
        ch = MixerChannel("synth")
        assert ch.name == "synth"
        assert ch.gain == pytest.approx(0.8)
        assert ch.pan == pytest.approx(0.0)
        assert ch.mute is False
        assert ch.solo is False

    def test_setters(self):
        ch = MixerChannel("ch1")
        ch.name = "lead"
        ch.gain = 1.2
        ch.pan = -0.5
        ch.mute = True
        ch.solo = True
        assert ch.name == "lead"
        assert ch.gain == pytest.approx(1.2)
        assert ch.pan == pytest.approx(-0.5)
        assert ch.mute is True
        assert ch.solo is True

    def test_gain_clamped(self):
        ch = MixerChannel()
        ch.gain = 5.0
        assert ch.gain == pytest.approx(2.0)
        ch.gain = -1.0
        assert ch.gain == pytest.approx(0.0)

    def test_pan_clamped(self):
        ch = MixerChannel()
        ch.pan = 3.0
        assert ch.pan == pytest.approx(1.0)
        ch.pan = -3.0
        assert ch.pan == pytest.approx(-1.0)

    def test_process_sample_muted(self):
        ch = MixerChannel("m")
        ch.mute = True
        left, right = ch.process_sample(1.0)
        assert left == 0.0
        assert right == 0.0

    def test_process_sample_center(self):
        ch = MixerChannel("c")
        ch.gain = 1.0
        ch.pan = 0.0
        left, right = ch.process_sample(1.0)
        # Center: L and R should be equal
        assert abs(left - right) < 1e-5

    def test_repr(self):
        ch = MixerChannel("bass")
        r = repr(ch)
        assert "bass" in r
        assert "MixerChannel" in r

    def test_eq(self):
        a = MixerChannel("a")
        b = MixerChannel("a")
        assert a == b
        b.gain = 0.5
        assert a != b


#  Mixer (Rust)


class TestMixer:
    def test_empty(self):
        m = Mixer()
        assert len(m) == 0
        assert m.master_gain == pytest.approx(0.8)

    def test_add_channels(self):
        m = Mixer()
        idx0 = m.add_channel("synth1")
        idx1 = m.add_channel("synth2")
        assert idx0 == 0
        assert idx1 == 1
        assert len(m) == 2
        assert m.channel_names() == ["synth1", "synth2"]

    def test_remove_channel(self):
        m = Mixer()
        m.add_channel("a")
        m.add_channel("b")
        removed = m.remove_channel(0)
        assert removed is not None
        assert removed.name == "a"
        assert len(m) == 1

    def test_remove_out_of_bounds(self):
        m = Mixer()
        assert m.remove_channel(0) is None

    def test_get_channel(self):
        m = Mixer()
        m.add_channel("test")
        ch = m.get_channel(0)
        assert ch.name == "test"

    def test_get_channel_out_of_bounds(self):
        m = Mixer()
        with pytest.raises(IndexError):
            m.get_channel(0)

    def test_set_channel_gain(self):
        m = Mixer()
        m.add_channel("ch")
        m.set_channel_gain(0, 1.5)
        assert m.get_channel(0).gain == pytest.approx(1.5)

    def test_set_channel_pan(self):
        m = Mixer()
        m.add_channel("ch")
        m.set_channel_pan(0, -0.7)
        assert m.get_channel(0).pan == pytest.approx(-0.7)

    def test_set_channel_mute(self):
        m = Mixer()
        m.add_channel("ch")
        m.set_channel_mute(0, True)
        assert m.get_channel(0).mute is True

    def test_set_channel_solo(self):
        m = Mixer()
        m.add_channel("ch")
        m.set_channel_solo(0, True)
        assert m.get_channel(0).solo is True

    def test_master_gain_clamped(self):
        m = Mixer()
        m.master_gain = 5.0
        assert m.master_gain == pytest.approx(2.0)

    def test_mix_down_single(self):
        m = Mixer()
        m.add_channel("ch")
        m.set_channel_gain(0, 1.0)
        m.master_gain = 1.0
        out = m.mix_down([[0.5, -0.5]])
        assert len(out) == 4  # 2 frames * 2 channels (stereo)

    def test_mix_down_muted(self):
        m = Mixer()
        m.add_channel("ch")
        m.set_channel_mute(0, True)
        m.master_gain = 1.0
        out = m.mix_down([[1.0, 1.0]])
        assert all(s == 0.0 for s in out)

    def test_mix_down_wrong_count(self):
        m = Mixer()
        m.add_channel("a")
        m.add_channel("b")
        with pytest.raises(ValueError):
            m.mix_down([[1.0]])

    def test_repr(self):
        m = Mixer()
        m.add_channel("lead")
        r = repr(m)
        assert "Mixer" in r
        assert "lead" in r


#  MixerWidget


class TestMixerWidget:
    def test_defaults(self):
        w = MixerWidget()
        assert w.channels == []
        assert w.master_gain == pytest.approx(0.8)
        assert w.master_effects == []
        assert w.session_id == ""

    def test_add_channel(self):
        w = MixerWidget()
        idx = w.add_channel("Synth 1")
        assert idx == 0
        assert len(w.channels) == 1
        assert w.channels[0]["name"] == "Synth 1"
        assert w.channels[0]["gain"] == pytest.approx(0.8)
        assert w.channels[0]["effects"] == []

    def test_add_multiple_channels(self):
        w = MixerWidget()
        w.add_channel("A")
        w.add_channel("B")
        assert len(w.channels) == 2
        assert w.channels[1]["name"] == "B"

    def test_remove_channel(self):
        w = MixerWidget()
        w.add_channel("A")
        w.add_channel("B")
        w.remove_channel(0)
        assert len(w.channels) == 1
        assert w.channels[0]["name"] == "B"

    def test_remove_out_of_bounds(self):
        w = MixerWidget()
        w.remove_channel(0)  # should not raise
        assert w.channels == []

    def test_set_channel_gain(self):
        w = MixerWidget()
        w.add_channel("ch")
        w.set_channel_gain(0, 1.2)
        assert w.channels[0]["gain"] == pytest.approx(1.2)

    def test_set_channel_gain_clamped(self):
        w = MixerWidget()
        w.add_channel("ch")
        w.set_channel_gain(0, 5.0)
        assert w.channels[0]["gain"] == pytest.approx(2.0)

    def test_set_channel_pan(self):
        w = MixerWidget()
        w.add_channel("ch")
        w.set_channel_pan(0, -0.5)
        assert w.channels[0]["pan"] == pytest.approx(-0.5)

    def test_set_channel_mute(self):
        w = MixerWidget()
        w.add_channel("ch")
        w.set_channel_mute(0, True)
        assert w.channels[0]["mute"] is True

    def test_set_channel_solo(self):
        w = MixerWidget()
        w.add_channel("ch")
        w.set_channel_solo(0, True)
        assert w.channels[0]["solo"] is True

    def test_set_channel_effects(self):
        w = MixerWidget()
        w.add_channel("ch")
        w.set_channel_effects(
            0,
            [
                EffectPlugin("compressor", threshold=-18, ratio=6),
                {"type": "reverb", "seconds": 2.0, "wet": 0.4},
                {"type": "limiter", "threshold": 3},
            ],
        )
        assert w.channels[0]["effects"] == [
            {
                "type": "compressor",
                "threshold": -18.0,
                "knee": 30.0,
                "ratio": 6.0,
                "attack": 0.003,
                "release": 0.25,
            },
            {"type": "reverb", "seconds": 2.0, "decay": 2.0, "wet": 0.4},
            {"type": "limiter", "threshold": 0.0, "release": 0.05},
        ]

    def test_add_and_clear_effects(self):
        w = MixerWidget()
        w.add_channel("ch")
        w.add_channel_effect(0, {"type": "filter", "filter_type": "highpass", "frequency": 30, "q": 0.5})
        w.set_master_effects([EffectPlugin("gain", gain=2.0)])
        assert w.master_effects == [{"type": "gain", "gain": 2.0}]

        w.add_master_effect({"type": "delay", "time": 0.5, "feedback": 0.2, "wet": 0.3})
        assert w.channels[0]["effects"][0] == {
            "type": "filter",
            "filter_type": "highpass",
            "frequency": 30.0,
            "q": 0.5,
        }
        assert w.master_effects == [
            {"type": "gain", "gain": 2.0},
            {"type": "delay", "time": 0.5, "feedback": 0.2, "wet": 0.3},
        ]
        w.clear_channel_effects(0)
        w.clear_master_effects()
        assert w.channels[0]["effects"] == []
        assert w.master_effects == []

    def test_invalid_effect_type_raises(self):
        with pytest.raises(ValueError):
            EffectPlugin("chorus")

    def test_invalid_filter_type_raises(self):
        w = MixerWidget()
        with pytest.raises(ValueError):
            w.add_master_effect({"type": "filter", "filter_type": "comb"})

    def test_effect_plugin_is_hashable(self):
        first = EffectPlugin("compressor", threshold=-18, ratio=4)
        second = EffectPlugin("compressor", threshold=-18, ratio=4)
        assert first == second
        assert len({first, second}) == 1

    def test_direct_channel_assignment_normalizes_effects(self):
        w = MixerWidget()
        w.channels = [
            {
                "name": "raw",
                "gain": 3,
                "pan": -3,
                "mute": 1,
                "solo": 0,
                "effects": [
                    {"type": "limiter", "threshold": 3},
                    {
                        "type": "customDrive",
                        "curve": [0, 0.5, 1],
                        "config": {"enabled": True, "mode": "wide", "none": None},
                    },
                ],
            }
        ]

        assert w.channels[0]["gain"] == pytest.approx(2.0)
        assert w.channels[0]["pan"] == pytest.approx(-1.0)
        assert w.channels[0]["mute"] is True
        assert w.channels[0]["solo"] is False
        assert w.channels[0]["effects"] == [
            {"type": "limiter", "threshold": 0.0, "release": 0.05},
            {
                "type": "customDrive",
                "curve": [0, 0.5, 1],
                "config": {"enabled": True, "mode": "wide", "none": None},
            },
        ]

    def test_invalid_channel_gain_raises(self):
        w = MixerWidget()
        with pytest.raises(ValueError):
            w.channels = [{"gain": None}]
        w.add_channel("raw")
        with pytest.raises(ValueError):
            w.set_channel_gain(0, True)

    def test_invalid_channel_pan_raises(self):
        w = MixerWidget()
        with pytest.raises(ValueError):
            w.channels = [{"pan": math.nan}]

    def test_master_effect_assignment_preserves_json_safe_custom_params(self):
        w = MixerWidget()
        w.master_effects = [
            {
                "type": "customMatrix",
                "matrix": [[1, 0], [0, 1]],
                "labels": ("L", "R"),
                "config": {"enabled": True, "none": None},
            }
        ]

        assert w.master_effects == [
            {
                "type": "customMatrix",
                "matrix": [[1, 0], [0, 1]],
                "labels": ["L", "R"],
                "config": {"enabled": True, "none": None},
            }
        ]

    def test_builtin_effect_none_params_use_defaults(self):
        w = MixerWidget()
        w.master_effects = [{"type": "filter", "filter_type": None, "frequency": None, "q": None}]
        assert w.master_effects == [{"type": "filter", "filter_type": "lowpass", "frequency": 1200.0, "q": 1.0}]

    def test_non_json_safe_effect_param_raises(self):
        w = MixerWidget()
        with pytest.raises(ValueError):
            w.add_master_effect({"type": "custom", "bad": object()})

    def test_non_finite_builtin_effect_param_raises(self):
        w = MixerWidget()
        with pytest.raises(ValueError):
            w.add_master_effect({"type": "gain", "gain": math.nan})

    def test_bool_builtin_effect_param_raises(self):
        w = MixerWidget()
        with pytest.raises(ValueError):
            w.add_master_effect({"type": "delay", "wet": True})

    def test_to_mixer(self):
        w = MixerWidget()
        w.add_channel("Synth")
        w.set_channel_gain(0, 0.6)
        w.set_channel_pan(0, 0.3)
        w.master_gain = 0.9
        m = w.to_mixer()
        assert len(m) == 1
        ch = m.get_channel(0)
        assert ch.name == "Synth"
        assert ch.gain == pytest.approx(0.6)
        assert ch.pan == pytest.approx(0.3)
        assert m.master_gain == pytest.approx(0.9)

    def test_to_mixer_mix_down(self):
        w = MixerWidget()
        w.add_channel("A")
        w.master_gain = 1.0
        m = w.to_mixer()
        m.set_channel_gain(0, 1.0)
        out = m.mix_down([[0.5, 0.5]])
        assert len(out) == 4  # 2 frames * stereo


#  Sequencer: Step


class TestStep:
    def test_construction(self):
        s = Step(60, 100, 2)
        assert s.note == 60
        assert s.velocity == 100
        assert s.duration_ticks == 2
        assert s.active is True

    def test_defaults(self):
        s = Step(69, 80)
        assert s.duration_ticks == 1

    def test_setters(self):
        s = Step(60, 100)
        s.note = 72
        s.velocity = 64
        s.duration_ticks = 4
        s.active = False
        assert s.note == 72
        assert s.velocity == 64
        assert s.duration_ticks == 4
        assert s.active is False

    def test_invalid_note(self):
        with pytest.raises(ValueError):
            Step(128, 100)

    def test_invalid_velocity(self):
        with pytest.raises(ValueError):
            Step(60, 128)

    def test_repr(self):
        s = Step(60, 100, 2)
        r = repr(s)
        assert "Step" in r
        assert "60" in r

    def test_eq(self):
        assert Step(60, 100) == Step(60, 100)
        assert Step(60, 100) != Step(61, 100)


#  Sequencer: Pattern


class TestPattern:
    def test_construction(self):
        p = Pattern(16)
        assert len(p) == 16
        assert p.length == 16
        assert p.loop_enabled is True

    def test_default_length(self):
        p = Pattern()
        assert len(p) == 16

    def test_set_step(self):
        p = Pattern(4)
        s = Step(60, 100, 1)
        assert p.set_step(0, s) is True
        got = p.get_step(0)
        assert got.note == 60

    def test_set_step_out_of_range(self):
        p = Pattern(4)
        assert p.set_step(10, Step(60, 100)) is False

    def test_toggle_step(self):
        p = Pattern(4)
        assert p.toggle_step(0) is True
        assert p.get_step(0).active is True
        assert p.toggle_step(0) is True
        assert p.get_step(0).active is False

    def test_get_step_out_of_range(self):
        p = Pattern(4)
        with pytest.raises(IndexError):
            p.get_step(10)

    def test_clear(self):
        p = Pattern(4)
        p.toggle_step(0)
        p.toggle_step(2)
        p.clear()
        for i in range(4):
            assert p.get_step(i).active is False

    def test_repr(self):
        p = Pattern(8)
        r = repr(p)
        assert "Pattern" in r
        assert "8" in r


#  Sequencer: NoteEvent


class TestNoteEvent:
    def test_construction(self):
        e = NoteEvent(0.0, 0.5, 60, 100)
        assert e.beat_position == pytest.approx(0.0)
        assert e.duration == pytest.approx(0.5)
        assert e.note == 60
        assert e.velocity == 100

    def test_end_position(self):
        e = NoteEvent(1.0, 0.25, 60, 100)
        assert e.end_position() == pytest.approx(1.25)

    def test_setters(self):
        e = NoteEvent(0.0, 0.5, 60, 100)
        e.beat_position = 2.0
        e.duration = 1.0
        e.note = 72
        e.velocity = 64
        assert e.beat_position == pytest.approx(2.0)
        assert e.duration == pytest.approx(1.0)
        assert e.note == 72
        assert e.velocity == 64

    def test_invalid_note(self):
        with pytest.raises(ValueError):
            NoteEvent(0.0, 0.5, 128, 100)

    def test_repr(self):
        e = NoteEvent(1.0, 0.5, 69, 100)
        r = repr(e)
        assert "NoteEvent" in r

    def test_eq(self):
        a = NoteEvent(0.0, 0.5, 60, 100)
        b = NoteEvent(0.0, 0.5, 60, 100)
        assert a == b


#  Sequencer: EventSequence


class TestEventSequence:
    def test_empty(self):
        seq = EventSequence()
        assert len(seq) == 0
        assert seq.duration() == pytest.approx(0.0)

    def test_add_events_sorted(self):
        seq = EventSequence()
        seq.add_event(NoteEvent(2.0, 0.5, 64, 80))
        seq.add_event(NoteEvent(0.0, 0.5, 60, 100))
        seq.add_event(NoteEvent(1.0, 0.5, 62, 90))
        events = seq.events()
        assert len(events) == 3
        assert events[0].beat_position == pytest.approx(0.0)
        assert events[1].beat_position == pytest.approx(1.0)
        assert events[2].beat_position == pytest.approx(2.0)

    def test_remove_event(self):
        seq = EventSequence()
        seq.add_event(NoteEvent(0.0, 0.5, 60, 100))
        seq.add_event(NoteEvent(1.0, 0.5, 62, 90))
        removed = seq.remove_event(0)
        assert removed is not None
        assert removed.note == 60
        assert len(seq) == 1

    def test_events_in_range(self):
        seq = EventSequence()
        seq.add_event(NoteEvent(0.0, 1.0, 60, 100))
        seq.add_event(NoteEvent(1.0, 0.5, 62, 90))
        seq.add_event(NoteEvent(3.0, 0.5, 64, 80))
        # [0.5, 1.2) — C4 still playing, D4 just started
        in_range = seq.events_in_range(0.5, 1.2)
        assert len(in_range) == 2

    def test_events_starting_in_range(self):
        seq = EventSequence()
        seq.add_event(NoteEvent(0.0, 1.0, 60, 100))
        seq.add_event(NoteEvent(1.0, 0.5, 62, 90))
        seq.add_event(NoteEvent(3.0, 0.5, 64, 80))
        starting = seq.events_starting_in_range(0.5, 1.5)
        assert len(starting) == 1
        assert starting[0].note == 62

    def test_duration(self):
        seq = EventSequence()
        seq.add_event(NoteEvent(0.0, 1.0, 60, 100))
        seq.add_event(NoteEvent(2.0, 0.5, 62, 90))
        assert seq.duration() == pytest.approx(2.5)

    def test_clear(self):
        seq = EventSequence()
        seq.add_event(NoteEvent(0.0, 0.5, 60, 100))
        seq.clear()
        assert len(seq) == 0

    def test_repr(self):
        seq = EventSequence()
        r = repr(seq)
        assert "EventSequence" in r


#  Sequencer: TransportClock


class TestTransportClock:
    def test_defaults(self):
        c = TransportClock()
        assert c.bpm == pytest.approx(120.0)
        assert c.position == pytest.approx(0.0)
        assert c.state == "stopped"

    def test_play_stop(self):
        c = TransportClock(120.0)
        c.play()
        assert c.state == "playing"
        c.stop()
        assert c.state == "stopped"
        assert c.position == pytest.approx(0.0)

    def test_pause(self):
        c = TransportClock(120.0)
        c.play()
        c.advance_by_frames(44100, 44100)
        c.pause()
        assert c.state == "paused"
        assert c.position > 0.0

    def test_seek(self):
        c = TransportClock()
        c.seek(4.0)
        assert c.position == pytest.approx(4.0)

    def test_advance(self):
        c = TransportClock(120.0)
        c.play()
        # 120 BPM, 1 second = 2 beats
        result = c.advance_by_frames(44100, 44100)
        assert result is not None
        start, end = result
        assert start == pytest.approx(0.0)
        assert end == pytest.approx(2.0)

    def test_advance_stopped(self):
        c = TransportClock()
        assert c.advance_by_frames(44100, 44100) is None

    def test_beat_time_conversion(self):
        c = TransportClock(120.0)
        assert c.beats_to_seconds(1.0) == pytest.approx(0.5)
        assert c.seconds_to_beats(0.5) == pytest.approx(1.0)

    def test_tick_conversion(self):
        c = TransportClock()
        assert c.beats_to_ticks(1.0) == 480
        assert c.ticks_to_beats(480) == pytest.approx(1.0)

    def test_set_bpm(self):
        c = TransportClock()
        c.bpm = 60.0
        assert c.bpm == pytest.approx(60.0)

    def test_repr(self):
        c = TransportClock(140.0)
        r = repr(c)
        assert "TransportClock" in r
        assert "140" in r


#  Sequencer: StepSequencer


class TestStepSequencer:
    def test_construction(self):
        p = Pattern(4)
        seq = StepSequencer(p)
        assert seq.step_duration == pytest.approx(0.25)
        assert seq.current_step == 0

    def test_process_empty(self):
        p = Pattern(4)
        seq = StepSequencer(p)
        events = seq.process_beat_range(0.0, 1.0)
        assert len(events) == 0  # all steps inactive

    def test_process_active_steps(self):
        p = Pattern(4)
        p.set_step(0, Step(60, 100, 1))
        seq = StepSequencer(p)
        seq.step_duration = 0.25
        events = seq.process_beat_range(0.0, 1.0)
        # Step 0 active -> NoteOn + NoteOff = 2; steps 1-3 inactive
        assert len(events) == 2
        assert events[0][0] == "note_on"
        assert events[0][1] == 60  # note
        assert events[0][2] == 100  # velocity

    def test_reset(self):
        p = Pattern(4)
        seq = StepSequencer(p)
        seq.process_beat_range(0.0, 1.0)
        seq.reset()
        assert seq.current_step == 0

    def test_repr(self):
        p = Pattern(4)
        seq = StepSequencer(p)
        r = repr(seq)
        assert "StepSequencer" in r


#  Sampler: AudioSample


class TestAudioSample:
    def test_construction(self):
        s = AudioSample([0.0, 0.1, 0.2], 44100, 69)
        assert len(s) == 3
        assert s.sample_rate == 44100
        assert s.root_note == 69

    def test_duration(self):
        data = [0.0] * 44100
        s = AudioSample(data, 44100, 69)
        assert s.duration_seconds() == pytest.approx(1.0)

    def test_loop_points(self):
        s = AudioSample([0.0] * 100, 44100, 69)
        s.loop_start = 10
        s.loop_end = 50
        assert s.loop_start == 10
        assert s.loop_end == 50

    def test_data(self):
        s = AudioSample([0.1, 0.2, 0.3], 44100, 60)
        d = s.data()
        assert len(d) == 3
        assert d[0] == pytest.approx(0.1)

    def test_invalid_root_note(self):
        with pytest.raises(ValueError):
            AudioSample([0.0], 44100, 128)

    def test_repr(self):
        s = AudioSample([0.0] * 44100, 44100, 69)
        r = repr(s)
        assert "AudioSample" in r
        assert "44100" in r


#  Sampler: Envelope


class TestEnvelope:
    def test_defaults(self):
        e = Envelope()
        assert e.attack == pytest.approx(0.005)
        assert e.decay == pytest.approx(0.1)
        assert e.sustain == pytest.approx(0.8)
        assert e.release == pytest.approx(0.1)

    def test_custom(self):
        e = Envelope(0.01, 0.05, 0.5, 0.2)
        assert e.attack == pytest.approx(0.01)
        assert e.sustain == pytest.approx(0.5)

    def test_setters(self):
        e = Envelope()
        e.attack = 0.1
        e.decay = 0.2
        e.sustain = 0.6
        e.release = 0.3
        assert e.attack == pytest.approx(0.1)
        assert e.decay == pytest.approx(0.2)
        assert e.sustain == pytest.approx(0.6)
        assert e.release == pytest.approx(0.3)

    def test_sustain_clamped(self):
        e = Envelope()
        e.sustain = 2.0
        assert e.sustain == pytest.approx(1.0)
        e.sustain = -1.0
        assert e.sustain == pytest.approx(0.0)

    def test_repr(self):
        e = Envelope()
        r = repr(e)
        assert "Envelope" in r

    def test_eq(self):
        a = Envelope(0.01, 0.1, 0.8, 0.1)
        b = Envelope(0.01, 0.1, 0.8, 0.1)
        assert a == b


#  Sampler: SampleMapping & SampleMap


class TestSampleMapping:
    def test_construction(self):
        s = AudioSample([0.0] * 100, 44100, 60)
        m = SampleMapping(s, 0, 127, 0, 127)
        assert m.matches(60, 100) is True

    def test_matches_range(self):
        s = AudioSample([0.0] * 100, 44100, 60)
        m = SampleMapping(s, 48, 72, 64, 127)
        assert m.matches(60, 100) is True
        assert m.matches(36, 100) is False
        assert m.matches(60, 32) is False

    def test_repr(self):
        s = AudioSample([0.0] * 100, 44100, 60)
        m = SampleMapping(s, 0, 127, 0, 127)
        r = repr(m)
        assert "SampleMapping" in r


class TestSampleMap:
    def test_empty(self):
        m = SampleMap()
        assert len(m) == 0

    def test_single_sample(self):
        s = AudioSample([0.0] * 100, 44100, 69)
        m = SampleMap.single_sample(s)
        assert len(m) == 1
        found = m.find_sample(60, 100)
        assert found is not None

    def test_multi_sample(self):
        m = SampleMap()
        low = AudioSample([0.1] * 100, 44100, 36)
        high = AudioSample([0.9] * 100, 44100, 72)
        m.add_mapping(SampleMapping(low, 0, 60, 0, 127))
        m.add_mapping(SampleMapping(high, 61, 127, 0, 127))
        assert m.find_sample(50, 100) is not None
        assert m.find_sample(80, 100) is not None

    def test_repr(self):
        m = SampleMap()
        r = repr(m)
        assert "SampleMap" in r


#  Sampler


class TestSampler:
    def _make_sample(self):
        """1 second 440 Hz sine at 44100 Hz."""
        data = [math.sin(2 * math.pi * 440.0 * i / 44100) for i in range(44100)]
        return AudioSample(data, 44100, 69)

    def test_construction(self):
        s = Sampler(self._make_sample())
        assert s.max_voices == 8
        assert s.sample_rate == 44100
        assert s.active_voice_count() == 0

    def test_note_on(self):
        s = Sampler(self._make_sample())
        s.note_on(69, 100)
        assert s.active_voice_count() == 1

    def test_note_on_multiple(self):
        s = Sampler(self._make_sample())
        s.note_on(60, 100)
        s.note_on(64, 80)
        s.note_on(67, 90)
        assert s.active_voice_count() == 3

    def test_note_off(self):
        s = Sampler(self._make_sample())
        s.set_envelope(Envelope(0.0, 0.0, 1.0, 0.001))
        s.note_on(60, 100)
        s.note_off(60)
        # Render enough to finish the release
        s.render(44100)
        assert s.active_voice_count() == 0

    def test_voice_stealing(self):
        s = Sampler(self._make_sample(), max_voices=2)
        s.note_on(60, 100)
        s.note_on(64, 100)
        s.note_on(67, 100)
        # max_voices=2, so oldest should be stolen
        assert s.active_voice_count() <= 2

    def test_render(self):
        s = Sampler(self._make_sample())
        s.set_envelope(Envelope(0.0, 0.0, 1.0, 0.1))
        s.note_on(69, 127)
        output = s.render(512)
        assert len(output) == 512
        assert any(abs(v) > 0.01 for v in output)

    def test_panic(self):
        s = Sampler(self._make_sample())
        s.note_on(60, 100)
        s.panic()
        assert s.active_voice_count() == 0

    def test_all_notes_off(self):
        s = Sampler(self._make_sample())
        s.set_envelope(Envelope(0.0, 0.0, 1.0, 0.001))
        s.note_on(60, 100)
        s.all_notes_off()
        s.render(44100)
        assert s.active_voice_count() == 0

    def test_repr(self):
        s = Sampler(self._make_sample())
        r = repr(s)
        assert "Sampler" in r


#  NoteComposer


class TestNoteComposer:
    def test_defaults(self):
        nc = NoteComposer(length=16)
        assert len(nc.steps) == 16
        for s in nc.steps:
            assert s["active"] is False
            assert s["note"] == 60
            assert s["velocity"] == 100
            assert s["duration_ticks"] == 1
            assert s["probability"] == 100

    def test_custom_length(self):
        nc = NoteComposer(length=8)
        assert len(nc.steps) == 8

    def test_set_step(self):
        nc = NoteComposer(length=16)
        nc.set_step(0, note=72, velocity=80, active=True, probability=75)
        assert nc.steps[0]["note"] == 72
        assert nc.steps[0]["velocity"] == 80
        assert nc.steps[0]["active"] is True
        assert nc.steps[0]["probability"] == 75

    def test_set_step_out_of_bounds(self):
        nc = NoteComposer(length=16)
        nc.set_step(999, note=60)  # should not raise

    def test_toggle_step(self):
        nc = NoteComposer(length=16)
        assert nc.steps[3]["active"] is False
        nc.toggle_step(3)
        assert nc.steps[3]["active"] is True
        nc.toggle_step(3)
        assert nc.steps[3]["active"] is False

    def test_toggle_step_out_of_bounds(self):
        nc = NoteComposer(length=16)
        nc.toggle_step(999)  # should not raise

    def test_clear(self):
        nc = NoteComposer(length=16)
        nc.set_step(0, active=True)
        nc.set_step(5, active=True)
        nc.clear()
        assert all(s["active"] is False for s in nc.steps)

    def test_to_pattern(self):
        nc = NoteComposer(length=16)
        nc.set_step(0, note=60, velocity=100, active=True)
        nc.set_step(4, note=64, velocity=90, active=True)
        p = nc.to_pattern()
        assert len(p) == 16
        s0 = p.get_step(0)
        assert s0.note == 60
        assert s0.active is True
        s4 = p.get_step(4)
        assert s4.note == 64

    def test_repr(self):
        nc = NoteComposer(length=8)
        r = repr(nc)
        assert "NoteComposer" in r
        assert "8" in r


#  SequencerWidget


class TestSequencerWidget:
    def test_defaults(self):
        w = SequencerWidget()
        assert w.length == 16
        assert w.measures == 1
        assert w.time_signature_num == 4
        assert w.time_signature_den == 4
        assert w.bpm == 120.0
        assert w.step_duration == 0.25
        assert w.is_playing is False
        assert w.current_step == -1
        assert w.loop_enabled is True
        assert w.swing == 0.0
        assert w.groove == []
        assert w.automation_lanes == []
        assert w.session_id == ""
        assert w.channel_index == -1
        assert w.num_voices == 1

    def test_steps_initialised(self):
        w = SequencerWidget()
        assert len(w.steps) == 16
        for s in w.steps:
            assert s["active"] is False
            assert s["note"] == 60
            assert s["velocity"] == 100
            assert s["duration_ticks"] == 1
            assert s["probability"] == 100

    def test_voices_initialised(self):
        """Default monophonic sequencer has one voice whose steps match .steps."""
        w = SequencerWidget()
        assert len(w.voices) == 1
        assert w.voices[0] is w.composers[0]
        assert w.voices[0].steps == w.steps

    def test_polyphonic_voices(self):
        """Polyphonic sequencer with N voices."""
        w = SequencerWidget(num_voices=4, length=8)
        assert len(w.voices) == 4
        assert len(w.composers) == 4
        for v in w.voices:
            assert isinstance(v, NoteComposer)
            assert len(v.steps) == 8

    def test_steps_is_voice_zero(self):
        """The .steps property is an alias for voices[0].steps."""
        w = SequencerWidget()
        w.set_step(0, note=72, active=True)
        assert w.voices[0].steps[0]["note"] == 72
        assert w.voices[0].steps[0]["active"] is True

    def test_voices_trait_synced(self):
        """The voices_data trait contains step lists for all voices."""
        w = SequencerWidget(num_voices=2, length=4)
        vd = w.voices_data
        assert len(vd) == 2
        assert len(vd[0]) == 4
        assert len(vd[1]) == 4

    def test_custom_length(self):
        w = SequencerWidget(length=8)
        assert w.length == 8
        assert len(w.steps) == 8

    def test_custom_length_derives_matching_step_duration(self):
        w = SequencerWidget(length=8)
        assert w.measures == 1
        assert w.step_duration == pytest.approx(0.5)
        assert w.length == 8
        assert len(w.steps) == 8

    def test_configure_grid_one_measure_of_eighth_notes(self):
        w = SequencerWidget()
        w.set_step(0, note=72, velocity=88, active=True)

        w.configure_grid(measures=1, step_duration=0.5)

        assert w.measures == 1
        assert w.step_duration == pytest.approx(0.5)
        assert w.length == 8
        assert len(w.steps) == 8
        assert w.steps[0]["note"] == 72
        assert w.steps[0]["velocity"] == 88
        assert w.steps[0]["active"] is True

    def test_configure_grid_four_measures_of_sixteenth_notes_for_all_voices(self):
        w = SequencerWidget(num_voices=2, length=16)
        w.set_step(15, note=67, velocity=110, active=True, voice=1)

        w.configure_grid(measures=4, step_duration=0.25)

        assert w.measures == 4
        assert w.step_duration == pytest.approx(0.25)
        assert w.length == 64
        assert len(w.voices_data) == 2
        assert [len(voice) for voice in w.voices_data] == [64, 64]
        assert w.voices[1].steps[15]["note"] == 67
        assert w.voices[1].steps[15]["active"] is True

    def test_length_assignment_resizes_all_voices(self):
        w = SequencerWidget(num_voices=2, length=16)
        w.set_step(0, note=64, active=True, voice=0)
        w.set_step(1, note=72, active=True, voice=1)

        w.length = 8

        assert [len(voice.steps) for voice in w.voices] == [8, 8]
        assert w.voices[0].steps[0]["note"] == 64
        assert w.voices[1].steps[1]["note"] == 72

    def test_set_step(self):
        w = SequencerWidget()
        w.set_step(0, note=72, velocity=80, active=True, probability=25)
        assert w.steps[0]["note"] == 72
        assert w.steps[0]["velocity"] == 80
        assert w.steps[0]["active"] is True
        assert w.steps[0]["probability"] == 25

    def test_set_step_probability_clamped(self):
        w = SequencerWidget()
        w.set_step(0, probability=999)
        w.set_step(1, probability=-5)
        assert w.steps[0]["probability"] == 100
        assert w.steps[1]["probability"] == 0

    def test_swing_clamped(self):
        w = SequencerWidget(swing=150)
        assert w.swing == 100
        w.swing = -10
        assert w.swing == 0

    def test_groove_clamped(self):
        w = SequencerWidget(groove=[-99, 0, 99])
        assert w.groove == [-50, 0, 50]

    def test_automation_lanes_normalized(self):
        w = SequencerWidget(
            automation_lanes=[
                {"trait": "bpm", "points": [{"step": 2, "value": "150"}, {"step": "0", "value": 120}]},
                {"trait": "bad trait!", "points": [{"step": 0, "value": 1}]},
                {"trait": "swing", "points": [{"step": -1, "value": 25}, {"step": 4, "value": "bad"}]},
            ]
        )
        assert w.automation_lanes == [
            {"trait": "bpm", "points": [{"step": 0, "value": 120.0}, {"step": 2, "value": 150.0}]},
            {"trait": "swing", "points": [{"step": 0, "value": 25.0}]},
        ]

    def test_set_step_voice(self):
        """set_step with voice kwarg targets a specific voice."""
        w = SequencerWidget(num_voices=3, length=8)
        w.set_step(0, note=64, active=True, voice=1)
        assert w.voices[1].steps[0]["note"] == 64
        assert w.voices[1].steps[0]["active"] is True
        # Voice 0 unchanged
        assert w.voices[0].steps[0]["active"] is False

    def test_set_step_out_of_bounds(self):
        w = SequencerWidget()
        w.set_step(999, note=60)  # should not raise

    def test_toggle_step(self):
        w = SequencerWidget()
        assert w.steps[3]["active"] is False
        w.toggle_step(3)
        assert w.steps[3]["active"] is True
        w.toggle_step(3)
        assert w.steps[3]["active"] is False

    def test_toggle_step_voice(self):
        """toggle_step with voice kwarg targets a specific voice."""
        w = SequencerWidget(num_voices=2, length=8)
        w.toggle_step(2, voice=1)
        assert w.voices[1].steps[2]["active"] is True
        assert w.voices[0].steps[2]["active"] is False

    def test_toggle_step_out_of_bounds(self):
        w = SequencerWidget()
        w.toggle_step(999)  # should not raise

    def test_clear(self):
        w = SequencerWidget()
        w.set_step(0, active=True)
        w.set_step(5, active=True)
        w.clear()
        assert all(s["active"] is False for s in w.steps)

    def test_clear_all_voices(self):
        """clear() deactivates all steps across all voices."""
        w = SequencerWidget(num_voices=2, length=8)
        w.set_step(0, active=True, voice=0)
        w.set_step(3, active=True, voice=1)
        w.clear()
        for v in w.voices:
            assert all(s["active"] is False for s in v.steps)

    def test_to_pattern(self):
        w = SequencerWidget()
        w.set_step(0, note=60, velocity=100, active=True)
        w.set_step(4, note=64, velocity=90, active=True)
        p = w.to_pattern()
        assert len(p) == 16
        s0 = p.get_step(0)
        assert s0.note == 60
        assert s0.active is True
        s4 = p.get_step(4)
        assert s4.note == 64

    def test_to_step_sequencer(self):
        w = SequencerWidget()
        w.set_step(0, active=True)
        seq = w.to_step_sequencer(channel=1)
        assert seq is not None

    def test_bpm_change(self):
        w = SequencerWidget()
        w.bpm = 140.0
        assert w.bpm == 140.0

    def test_transport(self):
        w = SequencerWidget()
        w.is_playing = True
        assert w.is_playing is True
        w.current_step = 3
        assert w.current_step == 3


#  SamplerWidget


class TestSamplerWidget:
    def test_defaults(self):
        w = SamplerWidget()
        assert w.sample_name == "(no sample)"
        assert w.sample_rate == 44100
        assert w.root_note == 69
        assert w.sample_length == 0
        assert w.waveform == b""
        assert w.sample_data == b""
        assert w.pad_notes == [48, 52, 55, 59, 60, 64, 67, 71]
        assert w.pad_velocities == [100] * 8
        assert w.pad_actions[0] == {"type": "note", "note": 48, "velocity": 100}
        assert w.sample_slices == []
        assert w.velocity == 100
        assert w.velocity_sensitive is True
        assert w.active_pads == []
        assert w.last_note_event == {}
        assert w.last_pad_event == {}
        assert w.max_voices == 8
        assert w.session_id == ""
        assert w.channel_index == -1

    def test_envelope_defaults(self):
        w = SamplerWidget()
        assert w.attack == pytest.approx(0.005)
        assert w.decay == pytest.approx(0.1)
        assert w.sustain == pytest.approx(0.8)
        assert w.release == pytest.approx(0.1)

    def test_load_sample(self):
        w = SamplerWidget()
        data = [0.0, 0.5, 1.0, 0.5, 0.0, -0.5, -1.0, -0.5]
        w.load_sample(data, sample_rate=22050, root_note=60, name="Test")
        assert w.sample_name == "Test"
        assert w.sample_rate == 22050
        assert w.root_note == 60
        assert w.sample_length == 8
        assert len(w.waveform) > 0
        assert len(w.sample_data) == 8 * 4
        # waveform is packed float32
        assert len(w.waveform) % 4 == 0

    def test_load_sample_decimation(self):
        """Large samples should be decimated to max 2048 points."""
        w = SamplerWidget()
        data = [float(i) / 10000 for i in range(10000)]
        w.load_sample(data, name="Big")
        n_points = len(w.waveform) // 4
        assert n_points == 2048
        assert len(w.sample_data) == 10000 * 4

    def test_load_sample_small(self):
        """Small samples are not decimated."""
        w = SamplerWidget()
        data = [0.1, 0.2, 0.3]
        w.load_sample(data, name="Tiny")
        n_points = len(w.waveform) // 4
        assert n_points == 3

    def test_envelope_change(self):
        w = SamplerWidget()
        w.attack = 0.1
        w.decay = 0.5
        w.sustain = 0.6
        w.release = 0.3
        assert w.attack == pytest.approx(0.1)
        assert w.decay == pytest.approx(0.5)
        assert w.sustain == pytest.approx(0.6)
        assert w.release == pytest.approx(0.3)

    def test_max_voices(self):
        w = SamplerWidget()
        w.max_voices = 16
        assert w.max_voices == 16

    def test_pad_count_resizes_pad_notes(self):
        w = SamplerWidget(pad_count=4)
        assert w.pad_count == 4
        assert w.pad_notes == [48, 52, 55, 59]

        w.configure_pads(10)

        assert w.pad_count == 10
        assert len(w.pad_notes) == 10
        assert w.pad_notes[:4] == [48, 52, 55, 59]

    def test_pad_notes_assignment_updates_pad_count(self):
        w = SamplerWidget()
        w.pad_notes = [36, 38, 42]
        assert w.pad_count == 3
        assert w.pad_actions == [
            {"type": "note", "note": 36, "velocity": 100},
            {"type": "note", "note": 38, "velocity": 100},
            {"type": "note", "note": 42, "velocity": 100},
        ]

    def test_load_audio_file_wav(self, tmp_path):
        path = tmp_path / "tone.wav"
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(8000)
            frames = struct.pack("<hhhh", 0, 32767, -32768, 0)
            wav.writeframes(frames)

        w = SamplerWidget()
        w.load_audio_file(path, root_note=60)

        assert w.sample_name == "tone.wav"
        assert w.sample_rate == 8000
        assert w.root_note == 60
        assert w.sample_length == 4
        assert w.get_sample_data()[1] == pytest.approx(32767 / 32768)

    def test_sample_edit_operations(self):
        w = SamplerWidget()
        w.load_sample([0.25, -0.5, 0.75, -1.0])

        w.trim_sample(1, 4)
        assert w.sample_length == 3
        assert w.get_sample_data() == pytest.approx([-0.5, 0.75, -1.0])

        w.normalize_sample(0.5)
        assert max(abs(s) for s in w.get_sample_data()) == pytest.approx(0.5)

        w.reverse_sample()
        assert w.get_sample_data()[0] == pytest.approx(-0.5)

        w.fade_sample(fade_in=2, fade_out=2)
        data = w.get_sample_data()
        assert data[0] == pytest.approx(0.0)
        assert data[-1] == pytest.approx(0.0)

    def test_slice_sample_maps_sampler_pads(self):
        w = SamplerWidget(velocity=90)
        w.load_sample([0.1] * 100)

        slices = w.slice_sample(4, start_note=36)

        assert slices == [
            {"index": 0, "note": 36, "start": 0, "end": 25, "label": "S1"},
            {"index": 1, "note": 37, "start": 25, "end": 50, "label": "S2"},
            {"index": 2, "note": 38, "start": 50, "end": 75, "label": "S3"},
            {"index": 3, "note": 39, "start": 75, "end": 100, "label": "S4"},
        ]
        assert w.pad_count == 4
        assert w.pad_notes == [36, 37, 38, 39]
        assert w.pad_actions[0] == {"type": "note", "note": 36, "velocity": 90, "slice": 0, "label": "S1"}

    def test_map_slices_to_pad_widget(self):
        sampler = SamplerWidget(channel_index=2)
        sampler.load_sample([0.1] * 80)
        pads = PadWidget()

        sampler.map_slices_to_pads(pads, count=4, start_note=40)

        assert pads.rows == 1
        assert pads.cols == 4
        assert pads.pad_notes == [40, 41, 42, 43]
        assert pads.pad_actions[0] == {"type": "note", "note": 40, "velocity": 100, "slice": 0, "label": "S1"}
        assert pads.sampler_routing == [{"channel_index": 2, "match": "all"}]

    def test_custom_init(self):
        w = SamplerWidget(
            attack=0.01,
            decay=0.2,
            sustain=0.5,
            release=0.5,
            max_voices=4,
        )
        assert w.attack == pytest.approx(0.01)
        assert w.max_voices == 4

    def test_to_sampler(self):
        w = SamplerWidget()
        w.attack = 0.01
        w.decay = 0.2
        w.sustain = 0.7
        w.release = 0.3
        s = w.to_sampler()
        assert s is not None


#  TransportWidget


class TestTransportWidget:
    def test_defaults(self):
        t = TransportWidget()
        assert t.bpm == 120.0
        assert t.is_playing is False
        assert t.is_recording is False
        assert t.time_signature_num == 4
        assert t.time_signature_den == 4
        assert t.bar_number == 0
        assert t.beat_in_bar == 0
        assert t.current_beat == pytest.approx(0.0)
        assert t.loop_enabled is False
        assert t.loop_start_bar == 0
        assert t.loop_end_bar == 4

    def test_custom_bpm(self):
        t = TransportWidget(bpm=140.0)
        assert t.bpm == pytest.approx(140.0)

    def test_set_bpm(self):
        t = TransportWidget()
        t.bpm = 90.0
        assert t.bpm == pytest.approx(90.0)

    def test_time_signature(self):
        t = TransportWidget(time_signature_num=3, time_signature_den=8)
        assert t.time_signature_num == 3
        assert t.time_signature_den == 8

    def test_play_state(self):
        t = TransportWidget()
        t.is_playing = True
        assert t.is_playing is True
        t.is_recording = True
        assert t.is_recording is True
        t.is_playing = False
        assert t.is_playing is False

    def test_position(self):
        t = TransportWidget()
        t.bar_number = 5
        t.beat_in_bar = 2
        t.current_beat = 22.5
        assert t.bar_number == 5
        assert t.beat_in_bar == 2
        assert t.current_beat == pytest.approx(22.5)

    def test_loop(self):
        t = TransportWidget()
        t.loop_enabled = True
        t.loop_start_bar = 2
        t.loop_end_bar = 8
        assert t.loop_enabled is True
        assert t.loop_start_bar == 2
        assert t.loop_end_bar == 8


#  KeyboardWidget


class TestKeyboardRoute:
    def test_all(self):
        r = KeyboardRoute(0, match="all")
        assert r.to_dict() == {"channel_index": 0, "match": "all"}

    def test_zone_upper(self):
        r = KeyboardRoute(1, match="zone", zone="upper")
        assert r.to_dict() == {"channel_index": 1, "match": "zone", "zone": "upper"}

    def test_zone_lower(self):
        r = KeyboardRoute(2, match="zone", zone="lower")
        assert r.to_dict() == {"channel_index": 2, "match": "zone", "zone": "lower"}

    def test_octave(self):
        r = KeyboardRoute(3, match="octave", octave=4)
        assert r.to_dict() == {"channel_index": 3, "match": "octave", "octave": 4}

    def test_note(self):
        r = KeyboardRoute(4, match="note", note=60)
        assert r.to_dict() == {"channel_index": 4, "match": "note", "note": 60}

    def test_notes(self):
        r = KeyboardRoute(5, match="notes", notes=[60, 62, 64])
        assert r.to_dict() == {
            "channel_index": 5,
            "match": "notes",
            "notes": [60, 62, 64],
        }

    def test_invalid_match(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="invalid")

    def test_invalid_zone(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="zone", zone="middle")

    def test_invalid_octave_too_low(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="octave", octave=-1)

    def test_invalid_octave_too_high(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="octave", octave=10)

    def test_invalid_note_too_high(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="note", note=128)

    def test_invalid_note_too_low(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="note", note=-1)

    def test_invalid_notes_empty(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="notes", notes=[])

    def test_invalid_notes_oob(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="notes", notes=[60, 128])

    def test_invalid_channel_index(self):
        with pytest.raises(ValueError):
            KeyboardRoute(-1, match="all")

    def test_invalid_float_octave(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="octave", octave=4.5)

    def test_invalid_float_note(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="note", note=60.5)

    def test_invalid_float_in_notes(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="notes", notes=[60, 62.5])

    def test_equality(self):
        a = KeyboardRoute(0, match="all")
        b = KeyboardRoute(0, match="all")
        assert a == b
        assert a != KeyboardRoute(0, match="zone", zone="upper")
        assert a != "not a route"

    def test_repr(self):
        r = KeyboardRoute(0, match="zone", zone="upper")
        s = repr(r)
        assert "KeyboardRoute" in s
        assert "ch=0" in s
        assert "zone=upper" in s


class TestKeyboardWidget:
    def test_defaults(self):
        kb = KeyboardWidget()
        assert kb.upper_octave == 3
        assert kb.lower_octave == 4
        assert kb.velocity == 100
        assert kb.active_notes == []
        assert kb.sustain_upper is False
        assert kb.sustain_lower is False
        assert kb.sustain_global is False
        assert kb.last_note_event == {}
        assert kb.session_id == ""
        assert kb.channel_index == -1
        assert kb.sampler_routing == []

    def test_custom_octaves(self):
        kb = KeyboardWidget(upper_octave=5, lower_octave=6)
        assert kb.upper_octave == 5
        assert kb.lower_octave == 6

    def test_set_velocity(self):
        kb = KeyboardWidget()
        kb.velocity = 80
        assert kb.velocity == 80

    def test_sustain(self):
        kb = KeyboardWidget()
        kb.sustain_upper = True
        assert kb.sustain_upper is True
        kb.sustain_global = True
        assert kb.sustain_global is True
        kb.sustain_lower = True
        assert kb.sustain_lower is True

    def test_connect_sequencer(self):
        kb = KeyboardWidget()
        seq = SequencerWidget()
        assert seq.keyboard_connected is False
        kb.connect_sequencer(seq)
        assert seq.keyboard_connected is True
        # Duplicate connect is idempotent
        kb.connect_sequencer(seq)
        assert len(kb._connected_sequencers) == 1

    def test_disconnect_sequencer(self):
        kb = KeyboardWidget()
        seq = SequencerWidget()
        kb.connect_sequencer(seq)
        assert seq.keyboard_connected is True
        kb.disconnect_sequencer(seq)
        assert seq.keyboard_connected is False
        assert len(kb._connected_sequencers) == 0

    def test_connect_sampler_all(self):
        kb = KeyboardWidget()
        samp = SamplerWidget(channel_index=0)
        kb.connect_sampler(samp)
        assert samp.keyboard_connected is True
        assert len(kb.sampler_routing) == 1
        assert kb.sampler_routing[0]["match"] == "all"
        assert kb.sampler_routing[0]["channel_index"] == 0

    def test_connect_sampler_all_explicit(self):
        kb = KeyboardWidget()
        samp = SamplerWidget(channel_index=0)
        kb.connect_sampler(samp, zone="all")
        assert kb.sampler_routing[0]["match"] == "all"

    def test_connect_sampler_split(self):
        kb = KeyboardWidget()
        upper = SamplerWidget(channel_index=0)
        lower = SamplerWidget(channel_index=1)
        kb.connect_sampler(upper, zone="upper")
        kb.connect_sampler(lower, zone="lower")
        assert len(kb.sampler_routing) == 2
        matches = {r["match"] for r in kb.sampler_routing}
        assert "zone" in matches
        zones = {r["zone"] for r in kb.sampler_routing if "zone" in r}
        assert zones == {"upper", "lower"}

    def test_connect_sampler_per_octave(self):
        kb = KeyboardWidget()
        samp = SamplerWidget(channel_index=0)
        kb.connect_sampler(samp, octave=4)
        assert len(kb.sampler_routing) == 1
        assert kb.sampler_routing[0]["match"] == "octave"
        assert kb.sampler_routing[0]["octave"] == 4

    def test_connect_sampler_per_note(self):
        kb = KeyboardWidget()
        samp = SamplerWidget(channel_index=0)
        kb.connect_sampler(samp, note=60)
        assert kb.sampler_routing[0]["match"] == "note"
        assert kb.sampler_routing[0]["note"] == 60

    def test_connect_sampler_per_notes(self):
        kb = KeyboardWidget()
        samp = SamplerWidget(channel_index=0)
        kb.connect_sampler(samp, notes=[60, 62, 64])
        assert kb.sampler_routing[0]["match"] == "notes"
        assert kb.sampler_routing[0]["notes"] == [60, 62, 64]

    def test_connect_sampler_layered(self):
        kb = KeyboardWidget()
        s1 = SamplerWidget(channel_index=0)
        s2 = SamplerWidget(channel_index=1)
        kb.connect_sampler(s1, zone="upper")
        kb.connect_sampler(s2, zone="upper")
        assert len(kb.sampler_routing) == 2

    def test_disconnect_sampler(self):
        kb = KeyboardWidget()
        samp = SamplerWidget(channel_index=2)
        kb.connect_sampler(samp)
        assert len(kb.sampler_routing) == 1
        kb.disconnect_sampler(samp)
        assert samp.keyboard_connected is False
        assert len(kb.sampler_routing) == 0

    def test_connect_sampler_replaces_same_channel(self):
        """Re-connecting the same sampler updates route, doesn't duplicate."""
        kb = KeyboardWidget()
        samp = SamplerWidget(channel_index=0)
        kb.connect_sampler(samp, zone="upper")
        kb.connect_sampler(samp, zone="lower")
        assert len(kb.sampler_routing) == 1
        assert kb.sampler_routing[0]["match"] == "zone"
        assert kb.sampler_routing[0]["zone"] == "lower"

    def test_session_routing(self):
        kb = KeyboardWidget(session_id="test-session", channel_index=3)
        assert kb.session_id == "test-session"
        assert kb.channel_index == 3


class TestMidiKeyboardWidget:
    def test_defaults(self):
        kb = MidiKeyboardWidget()
        assert kb.midi_port == ""
        assert kb.available_midi_ports == []
        assert kb.active_notes == []
        assert kb.last_note_event == {}
        assert kb.session_id == ""
        assert kb.channel_index == -1
        assert kb.sampler_routing == []

    def test_connect_sequencer(self):
        kb = MidiKeyboardWidget()
        seq = SequencerWidget()
        kb.connect_sequencer(seq)
        assert seq.keyboard_connected is True

    def test_connect_sampler(self):
        kb = MidiKeyboardWidget()
        sampler = SamplerWidget(channel_index=1)
        kb.connect_sampler(sampler, zone="upper")
        assert sampler.keyboard_connected is True
        assert kb.sampler_routing == [{"channel_index": 1, "match": "zone", "zone": "upper"}]


#  PadWidget


class TestPadAction:
    def test_note_action(self):
        action = PadAction(note=999, velocity=0, label="Kick", slice_index=2)
        assert action.to_dict() == {"type": "note", "note": 127, "velocity": 1, "slice": 2, "label": "Kick"}

    def test_trait_action(self):
        action = PadAction(type="trait", trait="swing", value=50)
        assert action.to_dict() == {"type": "trait", "trait": "swing", "value": 50}

    def test_invalid_trait_name(self):
        with pytest.raises(ValueError):
            PadAction(type="trait", trait="bad trait", value=1)


class TestPadWidget:
    def test_defaults(self):
        p = PadWidget()
        assert p.rows == 4
        assert p.cols == 4
        assert p.velocity == 100
        assert p.velocity_sensitive is True
        assert len(p.pad_notes) == 16
        assert p.pad_notes[0] == 36  # C2
        assert len(p.pad_velocities) == 16
        assert p.pad_velocities[0] == 100
        assert len(p.pad_actions) == 16
        assert p.pad_actions[0] == {"type": "note", "note": 36, "velocity": 100}
        assert p.active_pads == []
        assert p.last_note_event == {}
        assert p.last_pad_event == {}
        assert p.session_id == ""
        assert p.channel_index == -1
        assert p.sampler_routing == []

    def test_custom_dimensions(self):
        p = PadWidget(rows=2, cols=8)
        assert p.rows == 2
        assert p.cols == 8
        assert len(p.pad_notes) == 16

    def test_grid_dimensions_clamped_on_init(self):
        p = PadWidget(rows=0, cols=-4)
        assert p.rows == 1
        assert p.cols == 1
        assert len(p.pad_notes) == 1
        assert len(p.pad_velocities) == 1

    def test_grid_dimensions_clamped_on_assignment(self):
        p = PadWidget(rows=2, cols=2)
        p.rows = 0
        p.cols = -4
        assert p.rows == 1
        assert p.cols == 1
        assert len(p.pad_notes) == 1
        assert len(p.pad_velocities) == 1

    def test_grid_resize_extends_notes(self):
        p = PadWidget(rows=2, cols=2)
        assert len(p.pad_notes) == 4
        p.rows = 4
        p.cols = 4
        assert len(p.pad_notes) == 16  # auto-resized

    def test_grid_resize_truncates_notes(self):
        p = PadWidget(rows=4, cols=4)
        assert len(p.pad_notes) == 16
        p.rows = 2
        p.cols = 2
        assert len(p.pad_notes) == 4

    def test_custom_pad_notes(self):
        p = PadWidget(rows=2, cols=2, pad_notes=[60, 62, 64, 65])
        assert p.pad_notes == [60, 62, 64, 65]

    def test_velocity(self):
        p = PadWidget()
        p.velocity = 50
        assert p.velocity == 50

    def test_velocity_sensitive(self):
        p = PadWidget()
        p.velocity_sensitive = False
        assert p.velocity_sensitive is False

    def test_connect_sampler(self):
        p = PadWidget()
        samp = SamplerWidget(channel_index=0)
        p.connect_sampler(samp)
        assert len(p.sampler_routing) == 1
        assert p.sampler_routing[0]["match"] == "all"

    def test_connect_sampler_rejects_zone(self):
        p = PadWidget()
        samp = SamplerWidget(channel_index=0)
        with pytest.raises(ValueError, match="zone"):
            p.connect_sampler(samp, zone="upper")

    def test_disconnect_sampler(self):
        p = PadWidget()
        samp = SamplerWidget(channel_index=0)
        p.connect_sampler(samp)
        p.disconnect_sampler(samp)
        assert len(p.sampler_routing) == 0

    def test_active_pads(self):
        p = PadWidget()
        p.active_pads = [0, 3]
        assert p.active_pads == [0, 3]

    def test_last_note_event(self):
        p = PadWidget()
        p.last_note_event = {"note": 60, "velocity": 100, "type": "on"}
        assert p.last_note_event["note"] == 60

    def test_pad_velocities_default(self):
        p = PadWidget()
        assert len(p.pad_velocities) == 16
        assert p.pad_velocities[0] == 100

    def test_pad_velocities_custom(self):
        p = PadWidget(rows=2, cols=2, pad_velocities=[80, 90, 100, 110])
        assert p.pad_velocities == [80, 90, 100, 110]

    def test_pad_velocities_resize_extends(self):
        p = PadWidget(rows=2, cols=2)
        assert len(p.pad_velocities) == 4
        p.rows = 4
        p.cols = 4
        assert len(p.pad_velocities) == 16

    def test_pad_velocities_set_individually(self):
        p = PadWidget()
        p.pad_velocities = [p.pad_velocities[0]] * 15 + [50]
        assert p.pad_velocities[15] == 50

    def test_velocity_change_resets_pad_velocities(self):
        p = PadWidget(rows=1, cols=2, pad_velocities=[70, 90])
        p.velocity = 64
        assert p.pad_velocities == [64, 64]
        assert [action["velocity"] for action in p.pad_actions] == [64, 64]

    def test_velocity_clamped(self):
        p = PadWidget(velocity=999)
        assert p.velocity == 127
        p.velocity = -5
        assert p.velocity == 1

    def test_pad_notes_clamped(self):
        p = PadWidget(rows=1, cols=1, pad_notes=[999])
        assert p.pad_notes == [127]

    def test_pad_velocities_clamped(self):
        p = PadWidget(rows=1, cols=1, pad_velocities=[200])
        assert p.pad_velocities == [127]

    def test_configure_grid_for_actions(self):
        p = PadWidget()
        p.configure_grid_for_actions(
            notes=[36, 37, 38],
            actions=[PadAction(note=36, label="S1").to_dict(), {"type": "trait", "trait": "velocity", "value": 80}],
        )
        assert p.rows == 1
        assert p.cols == 3
        assert p.pad_notes == [36, 37, 38]
        assert p.pad_actions[0] == {"type": "note", "note": 36, "velocity": 100, "label": "S1"}
        assert p.pad_actions[1] == {"type": "trait", "trait": "velocity", "value": 80}

    def test_set_base_note_and_transpose(self):
        p = PadWidget(rows=1, cols=3)
        p.set_base_note(60)
        assert p.pad_notes == [60, 61, 62]
        p.transpose_pads(12)
        assert p.pad_notes == [72, 73, 74]


#  Timeline


class TestTimelineDescriptors:
    def test_audio_clip_defaults(self):
        clip = AudioClip(name="Vox", track_index=1, start=2.0, duration=3.5)
        data = clip.to_dict()
        assert data["id"].startswith("clip-")
        assert data["name"] == "Vox"
        assert data["track_index"] == 1
        assert data["start"] == pytest.approx(2.0)
        assert data["duration"] == pytest.approx(3.5)
        assert data["sample_rate"] == 44100

    def test_audio_clip_clamps_ranges(self):
        clip = AudioClip(track_index=-4, start=-2.0, duration=-1.0, sample_rate=-10)
        data = clip.to_dict()
        assert data["track_index"] == 0
        assert data["start"] == pytest.approx(0.0)
        assert data["duration"] == pytest.approx(0.001)
        assert data["sample_rate"] == 1

    def test_audio_clip_requires_numeric_duration(self):
        with pytest.raises(ValueError):
            AudioClip(duration=True)

    def test_timeline_track_defaults(self):
        track = TimelineTrack(name="Vocals", channel_index=2, armed=True)
        assert track.to_dict() == {
            "name": "Vocals",
            "channel_index": 2,
            "armed": True,
            "muted": False,
            "solo": False,
            "input": "microphone",
            "monitor": False,
        }


class TestTimelineWidget:
    def test_defaults(self):
        timeline = TimelineWidget()
        assert timeline.bpm == pytest.approx(120.0)
        assert timeline.length == pytest.approx(16.0)
        assert timeline.tracks == []
        assert timeline.clips == []
        assert timeline.recording_track == -1
        assert timeline.is_recording is False
        assert timeline.count_in_bars == pytest.approx(0.0)
        assert timeline.recording_countdown_beats == pytest.approx(0.0)
        assert timeline.auto_extend_recording is True
        assert timeline.recording_extend_bars == pytest.approx(8.0)

    def test_add_track(self):
        timeline = TimelineWidget()
        idx = timeline.add_track("Vox", channel_index=3, armed=True, monitor=True)
        assert idx == 0
        assert timeline.tracks[0]["name"] == "Vox"
        assert timeline.tracks[0]["channel_index"] == 3
        assert timeline.tracks[0]["armed"] is True
        assert timeline.tracks[0]["monitor"] is True

    def test_count_in_validation(self):
        timeline = TimelineWidget(count_in_bars=12)
        assert timeline.count_in_bars == pytest.approx(8.0)
        timeline.recording_countdown_beats = 3.5
        assert timeline.recording_countdown_beats == pytest.approx(3.5)

    def test_auto_extend_recording_validation(self):
        timeline = TimelineWidget(recording_extend_bars=0)
        assert timeline.recording_extend_bars == pytest.approx(1.0)
        timeline.recording_extend_bars = 300
        assert timeline.recording_extend_bars == pytest.approx(256.0)

    def test_arm_track_exclusive(self):
        timeline = TimelineWidget()
        timeline.add_track("A", armed=True)
        timeline.add_track("B", armed=False)
        timeline.arm_track(1, True, exclusive=True)
        assert [track["armed"] for track in timeline.tracks] == [False, True]

    def test_arm_track_out_of_range(self):
        timeline = TimelineWidget()
        with pytest.raises(IndexError):
            timeline.arm_track(0)

    def test_add_clip(self):
        timeline = TimelineWidget()
        timeline.add_track("Vox")
        clip = timeline.add_clip("Take", track_index=0, start=1.0, duration=2.0, recorded=True)
        assert len(timeline.clips) == 1
        assert timeline.selected_clip_id == clip["id"]
        assert timeline.clips[0]["recorded"] is True
        assert timeline.length == pytest.approx(16.0)

    def test_add_clip_extends_length(self):
        timeline = TimelineWidget(length=4.0)
        timeline.add_track("Vox")
        timeline.add_clip("Long", start=3.0, duration=4.0)
        assert timeline.length == pytest.approx(7.0)

    def test_move_and_resize_clip(self):
        timeline = TimelineWidget()
        timeline.add_track("A")
        timeline.add_track("B")
        clip = timeline.add_clip("Take", track_index=0)
        timeline.move_clip(clip["id"], track_index=1, start=6.0)
        timeline.resize_clip(clip["id"], 1.5)
        assert timeline.clips[0]["track_index"] == 1
        assert timeline.clips[0]["start"] == pytest.approx(6.0)
        assert timeline.clips[0]["duration"] == pytest.approx(1.5)

    def test_missing_clip_raises(self):
        timeline = TimelineWidget()
        with pytest.raises(ValueError):
            timeline.move_clip("missing", start=1.0)
        with pytest.raises(ValueError):
            timeline.resize_clip("missing", 2.0)

    def test_remove_clip_clears_selection(self):
        timeline = TimelineWidget()
        timeline.add_track("A")
        clip = timeline.add_clip("Take")
        timeline.remove_clip(clip["id"])
        assert timeline.clips == []
        assert timeline.selected_clip_id == ""

    def test_remove_track_drops_clips_and_shifts(self):
        timeline = TimelineWidget()
        timeline.add_track("A", channel_index=0)
        timeline.add_track("B", channel_index=1)
        timeline.add_track("C", channel_index=2)
        timeline.add_clip("A1", track_index=0)
        timeline.add_clip("B1", track_index=1)
        timeline.add_clip("C1", track_index=2)
        timeline.remove_track(1)
        assert [track["name"] for track in timeline.tracks] == ["A", "C"]
        assert [track["channel_index"] for track in timeline.tracks] == [0, 1]
        assert [clip["name"] for clip in timeline.clips] == ["A1", "C1"]
        assert timeline.clips[1]["track_index"] == 1

    def test_remove_unrouted_track_does_not_shift_channels(self):
        timeline = TimelineWidget()
        timeline.add_track("Scratch", channel_index=-1)
        timeline.add_track("A", channel_index=0)
        timeline.add_track("B", channel_index=1)
        timeline.remove_track(0)
        assert [track["channel_index"] for track in timeline.tracks] == [0, 1]


#  Track


class TestTrack:
    def test_creation(self):
        seq = SequencerWidget()
        synth = SynthWidget()
        track = Track("Lead", seq, synth, 0)
        assert track.name == "Lead"
        assert track.sequencer is seq
        assert track.sound_source is synth
        assert track.mixer_channel == 0

    def test_link_transport(self):
        """Transport config syncs to sequencer."""
        transport = TransportWidget(bpm=140.0, time_signature_num=3, time_signature_den=8)
        seq = SequencerWidget()
        synth = SynthWidget()
        track = Track("Test", seq, synth, 0)
        track._link_transport(transport)

        assert seq.time_signature_num == 3
        assert seq.time_signature_den == 8

        # BPM propagates
        transport.bpm = 100.0
        assert seq.bpm == pytest.approx(100.0)

        # Time signature propagates
        transport.time_signature_num = 5
        transport.time_signature_den = 4
        assert seq.time_signature_num == 5
        assert seq.time_signature_den == 4

        # Play state propagates
        transport.is_playing = True
        assert seq.is_playing is True

        # Bi-directional: sequencer → transport
        seq.bpm = 80.0
        assert transport.bpm == pytest.approx(80.0)
        seq.time_signature_num = 7
        assert transport.time_signature_num == 7

    def test_unlink(self):
        transport = TransportWidget(bpm=120.0)
        seq = SequencerWidget()
        synth = SynthWidget()
        track = Track("Test", seq, synth, 0)
        track._link_transport(transport)

        # Verify linked
        transport.bpm = 90.0
        assert seq.bpm == pytest.approx(90.0)

        # Unlink
        track._unlink()

        # Changes no longer propagate
        transport.bpm = 60.0
        assert seq.bpm == pytest.approx(90.0)  # stays at 90

    def test_repr(self):
        seq = SequencerWidget()
        synth = SynthWidget()
        track = Track("Lead", seq, synth, 0)
        r = repr(track)
        assert "Lead" in r
        assert "ch=0" in r
        assert "SynthWidget" in r

    def test_sampler_source(self):
        seq = SequencerWidget()
        samp = SamplerWidget()
        track = Track("Drums", seq, samp, 1)
        assert track.name == "Drums"
        assert isinstance(track.sound_source, SamplerWidget)
        r = repr(track)
        assert "SamplerWidget" in r


#  Session


class TestSession:
    def test_defaults(self):
        s = Session()
        assert s.transport.bpm == pytest.approx(120.0)
        assert s.transport.time_signature_num == 4
        assert s.transport.time_signature_den == 4
        assert len(s.tracks) == 0
        assert len(s.mixer.channels) == 0
        assert s._session_id.startswith("nbplay-")
        assert s.mixer.session_id == s._session_id
        assert s.timeline.session_id == s._session_id
        assert s.timeline.tracks == []

    def test_custom_bpm(self):
        s = Session(bpm=140.0)
        assert s.transport.bpm == pytest.approx(140.0)
        assert s.timeline.bpm == pytest.approx(140.0)

    def test_custom_time_signature(self):
        s = Session(time_signature=(3, 8))
        assert s.transport.time_signature_num == 3
        assert s.transport.time_signature_den == 8
        assert s.timeline.time_signature_num == 3
        assert s.timeline.time_signature_den == 8

    def test_add_track_syncs_transport_time_signature(self):
        s = Session(time_signature=(3, 8))
        seq = SequencerWidget()
        s.add_track("Lead", seq, SynthWidget())

        assert seq.time_signature_num == 3
        assert seq.time_signature_den == 8

        s.transport.time_signature_num = 6
        s.transport.time_signature_den = 8
        assert seq.time_signature_num == 6
        assert seq.time_signature_den == 8

    def test_add_track(self):
        s = Session()
        seq = SequencerWidget()
        synth = SynthWidget()
        track = s.add_track("Lead", seq, synth)
        assert len(s.tracks) == 1
        assert track.name == "Lead"
        assert track.mixer_channel == 0
        assert len(s.mixer.channels) == 1
        assert s.mixer.channels[0]["name"] == "Lead"
        assert len(s.timeline.tracks) == 1
        assert s.timeline.tracks[0]["name"] == "Lead"
        assert s.timeline.tracks[0]["channel_index"] == 0
        # Session routing metadata set on sequencer
        assert seq.session_id == s._session_id
        assert seq.channel_index == 0

    def test_add_track_sets_sound_source_routing(self):
        """add_track sets session_id and channel_index on the sound source."""
        s = Session()
        sampler = SamplerWidget()
        s.add_track("Drums", SequencerWidget(), sampler)
        assert sampler.session_id == s._session_id
        assert sampler.channel_index == 0

    def test_add_multiple_tracks(self):
        s = Session()
        s.add_track("Lead", SequencerWidget(), SynthWidget())
        s.add_track("Bass", SequencerWidget(), SynthWidget())
        s.add_track("Drums", SequencerWidget(), SamplerWidget())
        assert len(s.tracks) == 3
        assert len(s.mixer.channels) == 3
        assert len(s.timeline.tracks) == 3
        assert s.tracks[0].mixer_channel == 0
        assert s.tracks[1].mixer_channel == 1
        assert s.tracks[2].mixer_channel == 2

    def test_bpm_sync(self):
        """Transport BPM propagates to all sequencers via traitlets.link."""
        s = Session(bpm=120.0)
        seq1 = SequencerWidget()
        seq2 = SequencerWidget()
        s.add_track("A", seq1, SynthWidget())
        s.add_track("B", seq2, SynthWidget())

        s.transport.bpm = 90.0
        assert seq1.bpm == pytest.approx(90.0)
        assert seq2.bpm == pytest.approx(90.0)
        assert s.timeline.bpm == pytest.approx(90.0)

    def test_timeline_transport_sync(self):
        s = Session()
        s.timeline.bpm = 132.0
        assert s.transport.bpm == pytest.approx(132.0)
        s.timeline.is_playing = True
        assert s.transport.is_playing is True
        s.transport.is_playing = False
        assert s.timeline.is_playing is False
        s.transport.is_recording = True
        assert s.timeline.is_recording is True
        s.transport.current_beat = 7.25
        assert s.timeline.current_beat == pytest.approx(7.25)
        s.timeline.current_beat = 3.5
        assert s.transport.current_beat == pytest.approx(3.5)

    def test_play_sync(self):
        """Transport play state propagates to all sequencers."""
        s = Session()
        seq1 = SequencerWidget()
        seq2 = SequencerWidget()
        s.add_track("A", seq1, SynthWidget())
        s.add_track("B", seq2, SynthWidget())

        s.transport.is_playing = True
        assert seq1.is_playing is True
        assert seq2.is_playing is True

        s.transport.is_playing = False
        assert seq1.is_playing is False
        assert seq2.is_playing is False

    def test_remove_track(self):
        s = Session()
        s.add_track("A", SequencerWidget(), SynthWidget())
        seq_b = SequencerWidget()
        s.add_track("B", seq_b, SynthWidget())
        seq_c = SequencerWidget()
        s.add_track("C", seq_c, SynthWidget())

        s.remove_track(1)  # remove "B"
        assert len(s.tracks) == 2
        assert len(s.mixer.channels) == 2
        assert len(s.timeline.tracks) == 2
        assert s.tracks[0].name == "A"
        assert s.tracks[1].name == "C"
        assert [track["name"] for track in s.timeline.tracks] == ["A", "C"]
        # Channel indices adjusted
        assert s.tracks[0].mixer_channel == 0
        assert s.tracks[1].mixer_channel == 1
        assert s.timeline.tracks[1]["channel_index"] == 1
        # Removed track's sequencer has routing cleared
        assert seq_b.session_id == ""
        assert seq_b.channel_index == -1
        # Remaining track's sequencer has adjusted channel_index
        assert seq_c.channel_index == 1

    def test_remove_track_clears_sound_source_routing(self):
        """remove_track clears session_id/channel_index on the sound source."""
        s = Session()
        sampler = SamplerWidget()
        s.add_track("A", SequencerWidget(), sampler)
        assert sampler.session_id == s._session_id
        s.remove_track(0)
        assert sampler.session_id == ""
        assert sampler.channel_index == -1

    def test_remove_middle_track_adjusts_sound_source_indices(self):
        """remove_track adjusts channel_index on remaining sound sources."""
        s = Session()
        samp0 = SamplerWidget()
        samp1 = SamplerWidget()
        samp2 = SamplerWidget()
        s.add_track("A", SequencerWidget(), samp0)
        s.add_track("B", SequencerWidget(), samp1)
        s.add_track("C", SequencerWidget(), samp2)
        assert samp0.channel_index == 0
        assert samp1.channel_index == 1
        assert samp2.channel_index == 2

        s.remove_track(1)  # remove B
        assert samp1.session_id == ""
        assert samp1.channel_index == -1
        # Remaining: A stays 0, C adjusts from 2 to 1
        assert samp0.channel_index == 0
        assert samp2.channel_index == 1

    def test_add_track_non_sampler_sound_source_no_error(self):
        """add_track with SynthWidget (no session_id attr) does not error."""
        s = Session()
        synth = SynthWidget()
        track = s.add_track("Lead", SequencerWidget(), synth)
        assert track.name == "Lead"
        assert not hasattr(synth, "session_id")
        assert not hasattr(synth, "channel_index")

    def test_remove_track_unlinks(self):
        """Removed track no longer syncs with transport."""
        s = Session()
        seq = SequencerWidget()
        s.add_track("A", seq, SynthWidget())

        s.transport.bpm = 100.0
        assert seq.bpm == pytest.approx(100.0)

        s.remove_track(0)

        s.transport.bpm = 80.0
        assert seq.bpm == pytest.approx(100.0)  # no longer linked
        assert seq.session_id == ""
        assert seq.channel_index == -1

    def test_remove_track_out_of_bounds(self):
        s = Session()
        s.remove_track(5)  # no-op, no crash
        assert len(s.tracks) == 0

    def test_repr(self):
        s = Session(bpm=140.0)
        s.add_track("Lead", SequencerWidget(), SynthWidget())
        r = repr(s)
        assert "140.0" in r
        assert "tracks=1" in r
        assert "channels=1" in r


class TestDemoNotebook:
    def test_prefixed_example_notebooks_have_language_metadata(self):
        examples_dir = pathlib.Path(__file__).resolve().parents[2] / "examples"
        for notebook_path in sorted(examples_dir.glob("[0-9][0-9]_*.ipynb")):
            notebook = json.loads(notebook_path.read_text())
            assert notebook.get("cells")
            for cell in notebook["cells"]:
                assert "metadata" in cell
                assert "language" in cell["metadata"], f"{notebook_path.name}: cell missing 'language' in metadata"

    def test_prefixed_example_notebooks_have_code_cell_output_fields(self):
        examples_dir = pathlib.Path(__file__).resolve().parents[2] / "examples"
        for notebook_path in sorted(examples_dir.glob("[0-9][0-9]_*.ipynb")):
            notebook = json.loads(notebook_path.read_text())
            for index, cell in enumerate(notebook["cells"], start=1):
                if cell["cell_type"] != "code":
                    continue
                assert "execution_count" in cell, f"{notebook_path.name} cell {index} missing execution_count"
                assert "outputs" in cell, f"{notebook_path.name} cell {index} missing outputs"
                assert isinstance(cell["outputs"], list), f"{notebook_path.name} cell {index} outputs must be a list"

    @pytest.mark.parametrize(
        "notebook_path",
        sorted((pathlib.Path(__file__).resolve().parents[2] / "examples").glob("[0-9][0-9]_*.ipynb")),
        ids=lambda p: p.stem,
    )
    def test_notebook_code_cells_run(self, notebook_path):
        """Execute every code cell top-to-bottom in an isolated namespace."""
        notebook = json.loads(notebook_path.read_text())
        ns: dict = {}
        for i, cell in enumerate(notebook["cells"]):
            if cell["cell_type"] != "code":
                continue
            src = "".join(cell["source"])
            try:
                code = compile(src, f"{notebook_path.name}[{i}]", "exec")
                exec(code, ns)  # noqa: S102
            except Exception as exc:
                pytest.fail(f"{notebook_path.name} cell {i} failed:\n{src}\n\n{exc}")
