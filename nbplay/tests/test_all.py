import json
import math
import pathlib

import pytest

from nbplay import (
    AudioBuffer,
    AudioClip,
    AudioFormat,
    AudioSample,
    Envelope,
    EventSequence,
    KeyboardRoute,
    MidiChannel,
    MidiEvent,
    MidiMessage,
    Mixer,
    MixerChannel,
    NoiseSource,
    Note,
    NoteEvent,
    PadAction,
    Pattern,
    SampleMap,
    SampleMapping,
    Sampler,
    SawOscillator,
    SineOscillator,
    SquareOscillator,
    Step,
    StepSequencer,
    TimelineTrack,
    TransportClock,
    TriangleOscillator,
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


class TestTriangleOscillator:
    def test_render_rises_and_falls(self):
        osc = TriangleOscillator(1.0, 0.5, 100)
        samples = osc.render_to_buffer(100)
        assert len(samples) == 100
        # Zero at the start and the half, the peaks a quarter and three quarters in.
        assert [samples[i] for i in (0, 25, 50, 75)] == pytest.approx([0.0, 0.5, 0.0, -0.5], abs=1e-6)
        assert all(abs(samples[i] - samples[i - 1]) == pytest.approx(0.02, abs=1e-6) for i in range(1, 100))

    def test_repr(self):
        osc = TriangleOscillator(440.0, 1.0, 44100)
        assert "TriangleOscillator" in repr(osc)


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

    def test_invalid_channel_index_type(self):
        with pytest.raises(ValueError, match="channel_index must be int"):
            KeyboardRoute("0", match="all")  # ty: ignore[invalid-argument-type]

    def test_invalid_float_octave(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="octave", octave=4.5)  # ty: ignore[invalid-argument-type]

    def test_invalid_float_note(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="note", note=60.5)  # ty: ignore[invalid-argument-type]

    def test_invalid_float_in_notes(self):
        with pytest.raises(ValueError):
            KeyboardRoute(0, match="notes", notes=[60, 62.5])  # ty: ignore[invalid-argument-type]

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


#  MIDI files


class TestMidiFiles:
    def test_read_midi_handles_running_note_ons_and_empty_tracks(self, tmp_path):
        import mido

        from nbplay.midi import read_midi

        midi = mido.MidiFile(ticks_per_beat=96)
        track = mido.MidiTrack()
        track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(150), time=0))
        track.append(mido.MetaMessage("time_signature", numerator=3, denominator=4, time=0))
        track.append(mido.Message("note_on", note=60, velocity=100, time=0))
        track.append(mido.Message("note_on", note=60, velocity=0, time=48))  # velocity-0 note-off
        track.append(mido.Message("note_on", note=72, velocity=50, time=48))  # never closed
        midi.tracks.append(track)
        midi.tracks.append(mido.MidiTrack())  # no notes
        path = tmp_path / "raw.mid"
        midi.save(path)

        data = read_midi(path)
        assert data["bpm"] == pytest.approx(150.0)
        assert data["time_signature"] == (3, 4)
        assert len(data["tracks"]) == 1
        events = data["tracks"][0]["events"]
        assert events[0] == {"beat": 0.0, "duration": 0.5, "note": 60, "velocity": 100}
        assert events[1]["note"] == 72 and events[1]["beat"] == pytest.approx(1.0)
        assert read_midi(path.read_bytes())["tracks"][0]["events"] == events

    def test_events_to_voices_edge_cases(self, tmp_path):
        from nbplay.descriptors import _default_steps
        from nbplay.midi import events_to_voices, read_midi, write_midi

        voices, length = events_to_voices([], step_duration=0.25)
        assert length == 1
        assert voices == [_default_steps(1)]
        events = [{"beat": 0, "duration": 0.25, "note": 60, "velocity": 100}, {"beat": 4, "duration": 0.25, "note": 62, "velocity": 100}]
        voices, length = events_to_voices(events, step_duration=0.25, length=8)
        assert length == 8
        assert [i for i, st in enumerate(voices[0]) if st["active"]] == [0]

        path = tmp_path / "obj.mid"
        write_midi([{"name": "A", "events": events}], path)
        with open(path, "rb") as handle:
            assert len(read_midi(handle)["tracks"][0]["events"]) == 2


class TestDemoNotebook:
    def test_prefixed_example_notebooks_have_language_metadata(self):
        examples_dir = pathlib.Path(__file__).resolve().parents[2] / "examples"
        for notebook_path in sorted(examples_dir.glob("[0-9][0-9]_*.ipynb")):
            notebook = json.loads(notebook_path.read_text())
            assert notebook.get("cells")
            for cell in notebook["cells"]:
                assert "metadata" in cell
                assert "language" in cell["metadata"], f"{notebook_path.name}: cell missing 'language' in metadata"
                assert "id" in cell["metadata"], f"{notebook_path.name}: cell missing 'id' in metadata"

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
            except Exception as exc:  # noqa: BLE001  # pragma: no cover
                pytest.fail(f"{notebook_path.name} cell {i} failed:\n{src}\n\n{exc}")
