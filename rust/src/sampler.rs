use crate::audio::AudioBuffer;
use crate::midi::{MidiMessage, Note, Velocity};
use crate::oscillator::AudioSource;

/// A loaded audio sample — owns decoded PCM data, sample rate, and root note.
#[derive(Clone, Debug)]
pub struct AudioSample {
    /// Mono PCM data (f32).
    pub data: Vec<f32>,
    pub sample_rate: u32,
    /// The note at which the sample plays at its original pitch.
    pub root_note: Note,
    /// Optional loop start/end in sample frames.
    pub loop_start: Option<usize>,
    pub loop_end: Option<usize>,
}

impl AudioSample {
    pub fn new(data: Vec<f32>, sample_rate: u32, root_note: Note) -> Self {
        AudioSample {
            data,
            sample_rate,
            root_note,
            loop_start: None,
            loop_end: None,
        }
    }

    /// Create a sample with loop points.
    pub fn with_loop(mut self, start: usize, end: usize) -> Self {
        self.loop_start = Some(start);
        self.loop_end = Some(end);
        self
    }

    /// Number of sample frames.
    pub fn len(&self) -> usize {
        self.data.len()
    }

    /// Check if empty.
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// Duration in seconds.
    pub fn duration_seconds(&self) -> f64 {
        if self.sample_rate == 0 {
            return 0.0;
        }
        self.data.len() as f64 / self.sample_rate as f64
    }
}

// ADSR Envelope

/// ADSR envelope parameters (all times in seconds).
#[derive(Clone, Debug, PartialEq)]
pub struct Envelope {
    pub attack: f64,
    pub decay: f64,
    pub sustain: f64, // level 0.0–1.0
    pub release: f64,
}

impl Envelope {
    pub fn new(attack: f64, decay: f64, sustain: f64, release: f64) -> Self {
        Envelope {
            attack: attack.max(0.0),
            decay: decay.max(0.0),
            sustain: sustain.clamp(0.0, 1.0),
            release: release.max(0.0),
        }
    }

    /// Default envelope suitable for most sampler patches.
    pub fn default_sampler() -> Self {
        Envelope {
            attack: 0.005,
            decay: 0.1,
            sustain: 0.8,
            release: 0.1,
        }
    }
}

impl Default for Envelope {
    fn default() -> Self {
        Self::default_sampler()
    }
}

/// Envelope stage tracking.
#[derive(Clone, Debug, PartialEq)]
enum EnvelopeStage {
    Attack,
    Decay,
    Sustain,
    Release,
    Done,
}

/// A running envelope instance.
#[derive(Clone, Debug)]
struct EnvelopeState {
    params: Envelope,
    stage: EnvelopeStage,
    /// Current level (0.0 – 1.0).
    level: f64,
    /// Time elapsed in current stage (seconds).
    stage_time: f64,
    /// Level when release was triggered (for smooth release from any point).
    release_level: f64,
}

impl EnvelopeState {
    fn new(params: Envelope) -> Self {
        EnvelopeState {
            params,
            stage: EnvelopeStage::Attack,
            level: 0.0,
            stage_time: 0.0,
            release_level: 0.0,
        }
    }

    /// Trigger release.
    fn note_off(&mut self) {
        if self.stage != EnvelopeStage::Done {
            self.release_level = self.level;
            self.stage = EnvelopeStage::Release;
            self.stage_time = 0.0;
        }
    }

    /// Process one sample and return the envelope level. Returns None when done.
    fn tick(&mut self, sample_rate: u32) -> Option<f64> {
        let dt = 1.0 / sample_rate as f64;

        match self.stage {
            EnvelopeStage::Attack => {
                if self.params.attack <= 0.0 {
                    self.level = 1.0;
                    self.stage = EnvelopeStage::Decay;
                    self.stage_time = 0.0;
                } else {
                    self.level = self.stage_time / self.params.attack;
                    if self.level >= 1.0 {
                        self.level = 1.0;
                        self.stage = EnvelopeStage::Decay;
                        self.stage_time = 0.0;
                    }
                }
            }
            EnvelopeStage::Decay => {
                if self.params.decay <= 0.0 {
                    self.level = self.params.sustain;
                    self.stage = EnvelopeStage::Sustain;
                } else {
                    self.level =
                        1.0 - (1.0 - self.params.sustain) * (self.stage_time / self.params.decay);
                    if self.level <= self.params.sustain {
                        self.level = self.params.sustain;
                        self.stage = EnvelopeStage::Sustain;
                    }
                }
            }
            EnvelopeStage::Sustain => {
                self.level = self.params.sustain;
            }
            EnvelopeStage::Release => {
                if self.params.release <= 0.0 {
                    self.level = 0.0;
                    self.stage = EnvelopeStage::Done;
                    return None;
                }
                self.level = self.release_level * (1.0 - self.stage_time / self.params.release);
                if self.level <= 0.0 {
                    self.level = 0.0;
                    self.stage = EnvelopeStage::Done;
                    return None;
                }
            }
            EnvelopeStage::Done => return None,
        }

        self.stage_time += dt;
        Some(self.level)
    }

    #[cfg(test)]
    fn is_done(&self) -> bool {
        self.stage == EnvelopeStage::Done
    }
}

// Sampler Voice

/// A single voice rendering one instance of a sample with pitch shifting and envelope.
#[derive(Clone, Debug)]
struct SamplerVoice {
    /// The sample being played.
    sample: AudioSample,
    /// The note this voice is playing (used for pitch ratio).
    note: Note,
    velocity_gain: f64,
    /// Fractional playhead position within the sample.
    playhead: f64,
    /// Playback rate (1.0 = original pitch).
    rate: f64,
    envelope: EnvelopeState,
    active: bool,
}

impl SamplerVoice {
    fn new(
        sample: AudioSample,
        note: Note,
        velocity: Velocity,
        envelope: Envelope,
        output_sample_rate: u32,
    ) -> Self {
        use crate::midi::note_to_hz;

        let root_hz = note_to_hz(sample.root_note.value());
        let target_hz = note_to_hz(note.value());
        let pitch_ratio = target_hz / root_hz;

        // Also account for sample rate difference
        let sr_ratio = sample.sample_rate as f64 / output_sample_rate as f64;
        let rate = pitch_ratio * sr_ratio;

        let velocity_gain = velocity.value() as f64 / 127.0;

        SamplerVoice {
            sample,
            note,
            velocity_gain,
            playhead: 0.0,
            rate,
            envelope: EnvelopeState::new(envelope),
            active: true,
        }
    }

    fn note(&self) -> Note {
        self.note
    }

    fn note_off(&mut self) {
        self.envelope.note_off();
    }

    /// Render one sample. Returns None if the voice is done.
    fn render_sample(&mut self, sample_rate: u32) -> Option<f32> {
        if !self.active {
            return None;
        }

        let env_level = match self.envelope.tick(sample_rate) {
            Some(l) => l,
            None => {
                self.active = false;
                return None;
            }
        };

        // Linear interpolation for fractional playhead
        let idx = self.playhead as usize;
        if idx >= self.sample.data.len() {
            // Check for loop
            if let (Some(loop_start), Some(loop_end)) =
                (self.sample.loop_start, self.sample.loop_end)
            {
                if loop_end > loop_start && loop_end <= self.sample.data.len() {
                    let loop_len = (loop_end - loop_start) as f64;
                    self.playhead =
                        loop_start as f64 + ((self.playhead - loop_start as f64) % loop_len);
                } else {
                    self.active = false;
                    return None;
                }
            } else {
                self.active = false;
                return None;
            }
        }

        let idx = self.playhead as usize;
        if idx >= self.sample.data.len() {
            self.active = false;
            return None;
        }

        let frac = self.playhead - idx as f64;
        let s0 = self.sample.data[idx];
        let s1 = if idx + 1 < self.sample.data.len() {
            self.sample.data[idx + 1]
        } else {
            s0
        };
        let interpolated = s0 + (s1 - s0) * frac as f32;

        self.playhead += self.rate;

        Some(interpolated * env_level as f32 * self.velocity_gain as f32)
    }

    fn is_active(&self) -> bool {
        self.active
    }
}

// Sampler (polyphonic)

/// A polyphonic sampler that manages voices, responds to MIDI events,
/// and implements AudioSource.
pub struct Sampler {
    /// The sample to use for all notes (single-sample mode).
    sample: AudioSample,
    /// Active voices.
    voices: Vec<SamplerVoice>,
    /// Maximum polyphony.
    pub max_voices: usize,
    /// Envelope for new voices.
    pub envelope: Envelope,
    /// Output sample rate.
    pub sample_rate: u32,
}

impl Sampler {
    pub fn new(sample: AudioSample, sample_rate: u32, max_voices: usize) -> Self {
        Sampler {
            sample,
            voices: Vec::new(),
            max_voices,
            envelope: Envelope::default(),
            sample_rate,
        }
    }

    /// Process a MIDI message (NoteOn, NoteOff).
    pub fn process_midi(&mut self, message: &MidiMessage) {
        match message {
            MidiMessage::NoteOn { note, velocity, .. } => {
                // Voice stealing: if at max, remove the oldest voice
                if self.voices.len() >= self.max_voices {
                    // Find oldest active voice (first in list)
                    if !self.voices.is_empty() {
                        self.voices.remove(0);
                    }
                }

                let voice = SamplerVoice::new(
                    self.sample.clone(),
                    *note,
                    *velocity,
                    self.envelope.clone(),
                    self.sample_rate,
                );
                self.voices.push(voice);
            }
            MidiMessage::NoteOff { note, .. } => {
                // Trigger release on all voices playing this note
                for voice in &mut self.voices {
                    if voice.note() == *note {
                        voice.note_off();
                    }
                }
            }
            _ => {} // Ignore other messages
        }
    }

    /// Number of currently active voices.
    pub fn active_voice_count(&self) -> usize {
        self.voices.iter().filter(|v| v.is_active()).count()
    }

    /// Remove all voices.
    pub fn all_notes_off(&mut self) {
        for voice in &mut self.voices {
            voice.note_off();
        }
    }

    /// Immediately silence all voices.
    pub fn panic(&mut self) {
        self.voices.clear();
    }
}

impl AudioSource for Sampler {
    fn render(&mut self, buffer: &mut AudioBuffer) {
        let frames = buffer.frames();
        let channels = buffer.format.channels.0 as usize;
        let sr = buffer.format.sample_rate.0;

        for frame in 0..frames {
            let mut sum = 0.0_f32;
            for voice in &mut self.voices {
                if let Some(s) = voice.render_sample(sr) {
                    sum += s;
                }
            }
            // Soft clip to avoid harsh clipping
            let out = sum.clamp(-1.0, 1.0);
            for ch in 0..channels {
                buffer.set_sample(frame, ch, out);
            }
        }

        // Remove finished voices
        self.voices.retain(|v| v.is_active());
    }
}

// Sample Map (multi-sample support)

/// Maps a note range and velocity range to a sample.
#[derive(Clone, Debug)]
pub struct SampleMapping {
    pub sample: AudioSample,
    pub note_low: Note,
    pub note_high: Note,
    pub velocity_low: Velocity,
    pub velocity_high: Velocity,
}

impl SampleMapping {
    pub fn new(
        sample: AudioSample,
        note_low: Note,
        note_high: Note,
        velocity_low: Velocity,
        velocity_high: Velocity,
    ) -> Self {
        SampleMapping {
            sample,
            note_low,
            note_high,
            velocity_low,
            velocity_high,
        }
    }

    /// Check if a note/velocity falls within this mapping.
    pub fn matches(&self, note: Note, velocity: Velocity) -> bool {
        note.value() >= self.note_low.value()
            && note.value() <= self.note_high.value()
            && velocity.value() >= self.velocity_low.value()
            && velocity.value() <= self.velocity_high.value()
    }
}

/// A sample map that contains multiple mappings for note/velocity zones.
#[derive(Clone, Debug)]
pub struct SampleMap {
    mappings: Vec<SampleMapping>,
}

impl SampleMap {
    pub fn new() -> Self {
        SampleMap {
            mappings: Vec::new(),
        }
    }

    /// Create a single-sample map that covers all notes and velocities.
    pub fn single_sample(sample: AudioSample) -> Self {
        let mut map = SampleMap::new();
        map.add_mapping(SampleMapping::new(
            sample,
            Note::new(0).unwrap(),
            Note::new(127).unwrap(),
            Velocity::new(0).unwrap(),
            Velocity::new(127).unwrap(),
        ));
        map
    }

    pub fn add_mapping(&mut self, mapping: SampleMapping) {
        self.mappings.push(mapping);
    }

    /// Find the best matching sample for a note/velocity pair.
    /// Returns the first match (mappings should be ordered by priority).
    pub fn find_sample(&self, note: Note, velocity: Velocity) -> Option<&AudioSample> {
        self.mappings
            .iter()
            .find(|m| m.matches(note, velocity))
            .map(|m| &m.sample)
    }

    pub fn mapping_count(&self) -> usize {
        self.mappings.len()
    }

    pub fn is_empty(&self) -> bool {
        self.mappings.is_empty()
    }
}

impl Default for SampleMap {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::{AudioFormat, ChannelCount, SampleRate};
    use crate::midi::{MidiChannel, Note, Velocity};

    fn test_sample() -> AudioSample {
        // A simple 1-second 440 Hz sine wave at 44100 Hz
        let sr = 44100;
        let data: Vec<f32> = (0..sr)
            .map(|i| {
                let t = i as f64 / sr as f64;
                (t * 440.0 * 2.0 * std::f64::consts::PI).sin() as f32
            })
            .collect();
        AudioSample::new(data, sr as u32, Note::A4)
    }

    fn mono_44100() -> AudioFormat {
        AudioFormat::new(SampleRate::SR_44100, ChannelCount::MONO)
    }

    // AudioSample tests

    #[test]
    fn test_audio_sample_new() {
        let sample = test_sample();
        assert_eq!(sample.len(), 44100);
        assert!(!sample.is_empty());
        assert_eq!(sample.sample_rate, 44100);
        assert_eq!(sample.root_note, Note::A4);
    }

    #[test]
    fn test_audio_sample_duration() {
        let sample = test_sample();
        assert!((sample.duration_seconds() - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_audio_sample_with_loop() {
        let sample = test_sample().with_loop(1000, 2000);
        assert_eq!(sample.loop_start, Some(1000));
        assert_eq!(sample.loop_end, Some(2000));
    }

    // Envelope tests

    #[test]
    fn test_envelope_default() {
        let env = Envelope::default();
        assert!(env.attack > 0.0);
        assert!(env.sustain > 0.0 && env.sustain <= 1.0);
        assert!(env.release > 0.0);
    }

    #[test]
    fn test_envelope_state_attack() {
        let env = Envelope::new(0.01, 0.0, 1.0, 0.0);
        let mut state = EnvelopeState::new(env);
        let sr = 44100;

        // After some ticks during attack, level should be rising
        let mut levels = Vec::new();
        for _ in 0..441 {
            // ~0.01s
            if let Some(l) = state.tick(sr) {
                levels.push(l);
            }
        }
        assert!(!levels.is_empty());
        // Levels should be increasing
        for i in 1..levels.len() {
            assert!(levels[i] >= levels[i - 1] - 1e-6);
        }
    }

    #[test]
    fn test_envelope_full_cycle() {
        let env = Envelope::new(0.01, 0.01, 0.5, 0.01);
        let mut state = EnvelopeState::new(env);
        let sr = 44100;

        // Run through attack + decay + some sustain
        for _ in 0..4410 {
            // ~0.1s
            state.tick(sr);
        }
        // By now should be in sustain, level ~0.5
        assert!((state.level - 0.5).abs() < 0.05);

        // Trigger release
        state.note_off();
        for _ in 0..4410 {
            if state.tick(sr).is_none() {
                break;
            }
        }
        assert!(state.is_done());
    }

    // Sampler Voice tests

    #[test]
    fn test_sampler_voice_plays_sample() {
        let sample = test_sample();
        let env = Envelope::new(0.0, 0.0, 1.0, 0.1);
        let mut voice =
            SamplerVoice::new(sample, Note::A4, Velocity::new(127).unwrap(), env, 44100);

        // Playing at root note should give rate ~1.0
        assert!((voice.rate - 1.0).abs() < 1e-6);

        let s = voice.render_sample(44100);
        assert!(s.is_some());
    }

    #[test]
    fn test_sampler_voice_pitch_shift() {
        let sample = test_sample(); // root = A4 (69)
        let env = Envelope::new(0.0, 0.0, 1.0, 0.1);

        // Play one octave up (A5 = 81)
        let voice = SamplerVoice::new(
            sample,
            Note::new(81).unwrap(),
            Velocity::new(127).unwrap(),
            env,
            44100,
        );

        // Should play at 2x speed
        assert!((voice.rate - 2.0).abs() < 1e-6);
    }

    #[test]
    fn test_sampler_voice_velocity_scaling() {
        let sample = test_sample();
        let env = Envelope::new(0.0, 0.0, 1.0, 0.1);

        // Full velocity
        let mut voice_loud = SamplerVoice::new(
            sample.clone(),
            Note::A4,
            Velocity::new(127).unwrap(),
            env.clone(),
            44100,
        );
        let s_loud = voice_loud.render_sample(44100).unwrap();

        // Half velocity
        let mut voice_soft =
            SamplerVoice::new(sample, Note::A4, Velocity::new(64).unwrap(), env, 44100);
        let s_soft = voice_soft.render_sample(44100).unwrap();

        // Soft should be quieter (approximately half)
        assert!(s_soft.abs() < s_loud.abs() + 1e-6);
    }

    #[test]
    fn test_sampler_voice_note_off() {
        let sample = test_sample();
        let env = Envelope::new(0.0, 0.0, 1.0, 0.001);
        let mut voice =
            SamplerVoice::new(sample, Note::A4, Velocity::new(127).unwrap(), env, 44100);

        // Play a few samples
        for _ in 0..100 {
            voice.render_sample(44100);
        }
        assert!(voice.is_active());

        // Note off
        voice.note_off();
        // Should eventually deactivate
        for _ in 0..44100 {
            if voice.render_sample(44100).is_none() {
                break;
            }
        }
        assert!(!voice.is_active());
    }

    // Sampler tests

    #[test]
    fn test_sampler_note_on_off() {
        let sample = test_sample();
        let mut sampler = Sampler::new(sample, 44100, 8);

        assert_eq!(sampler.active_voice_count(), 0);

        sampler.process_midi(&MidiMessage::NoteOn {
            channel: MidiChannel::new(0).unwrap(),
            note: Note::C4,
            velocity: Velocity::new(100).unwrap(),
        });
        assert_eq!(sampler.active_voice_count(), 1);

        sampler.process_midi(&MidiMessage::NoteOn {
            channel: MidiChannel::new(0).unwrap(),
            note: Note::E4,
            velocity: Velocity::new(80).unwrap(),
        });
        assert_eq!(sampler.active_voice_count(), 2);
    }

    #[test]
    fn test_sampler_voice_stealing() {
        let sample = test_sample();
        let mut sampler = Sampler::new(sample, 44100, 2);

        // Play 3 notes with max_voices=2
        for note_val in [60, 62, 64] {
            sampler.process_midi(&MidiMessage::NoteOn {
                channel: MidiChannel::new(0).unwrap(),
                note: Note::new(note_val).unwrap(),
                velocity: Velocity::new(100).unwrap(),
            });
        }

        // Should have stolen the oldest voice
        assert!(sampler.voices.len() <= 2);
    }

    #[test]
    fn test_sampler_render() {
        let sample = test_sample();
        let mut sampler = Sampler::new(sample, 44100, 4);
        sampler.envelope = Envelope::new(0.0, 0.0, 1.0, 0.1);

        sampler.process_midi(&MidiMessage::NoteOn {
            channel: MidiChannel::new(0).unwrap(),
            note: Note::A4,
            velocity: Velocity::new(127).unwrap(),
        });

        let mut buffer = AudioBuffer::silence(512, mono_44100());
        sampler.render(&mut buffer);

        // Buffer should have non-zero samples
        let max = buffer
            .data
            .iter()
            .cloned()
            .fold(0.0_f32, |a, b| a.max(b.abs()));
        assert!(max > 0.01, "Expected non-zero audio, max was {max}");
    }

    #[test]
    fn test_sampler_multiple_voices_mix() {
        let sample = test_sample();
        let mut sampler = Sampler::new(sample, 44100, 4);
        sampler.envelope = Envelope::new(0.0, 0.0, 1.0, 0.1);

        // Play a chord
        for note_val in [60, 64, 67] {
            sampler.process_midi(&MidiMessage::NoteOn {
                channel: MidiChannel::new(0).unwrap(),
                note: Note::new(note_val).unwrap(),
                velocity: Velocity::new(100).unwrap(),
            });
        }

        let mut buffer = AudioBuffer::silence(512, mono_44100());
        sampler.render(&mut buffer);

        let max = buffer
            .data
            .iter()
            .cloned()
            .fold(0.0_f32, |a, b| a.max(b.abs()));
        assert!(
            max > 0.01,
            "Expected non-zero audio from chord, max was {max}"
        );
    }

    #[test]
    fn test_sampler_all_notes_off() {
        let sample = test_sample();
        let mut sampler = Sampler::new(sample, 44100, 4);

        sampler.process_midi(&MidiMessage::NoteOn {
            channel: MidiChannel::new(0).unwrap(),
            note: Note::C4,
            velocity: Velocity::new(100).unwrap(),
        });
        assert_eq!(sampler.active_voice_count(), 1);

        sampler.all_notes_off();
        // Voices are in release stage, but still "active" until envelope ends
        // Render enough to finish the release
        let mut buffer = AudioBuffer::silence(44100, mono_44100());
        sampler.render(&mut buffer);
        assert_eq!(sampler.active_voice_count(), 0);
    }

    #[test]
    fn test_sampler_panic() {
        let sample = test_sample();
        let mut sampler = Sampler::new(sample, 44100, 4);

        sampler.process_midi(&MidiMessage::NoteOn {
            channel: MidiChannel::new(0).unwrap(),
            note: Note::C4,
            velocity: Velocity::new(100).unwrap(),
        });
        sampler.panic();
        assert_eq!(sampler.active_voice_count(), 0);
    }

    // SampleMap tests

    #[test]
    fn test_sample_map_single() {
        let sample = test_sample();
        let map = SampleMap::single_sample(sample);
        assert_eq!(map.mapping_count(), 1);

        let found = map.find_sample(Note::C4, Velocity::new(100).unwrap());
        assert!(found.is_some());
    }

    #[test]
    fn test_sample_map_multi() {
        let mut map = SampleMap::new();

        let low_sample = AudioSample::new(vec![0.1; 100], 44100, Note::new(36).unwrap());
        let high_sample = AudioSample::new(vec![0.9; 100], 44100, Note::new(72).unwrap());

        map.add_mapping(SampleMapping::new(
            low_sample,
            Note::new(0).unwrap(),
            Note::new(60).unwrap(),
            Velocity::new(0).unwrap(),
            Velocity::new(127).unwrap(),
        ));
        map.add_mapping(SampleMapping::new(
            high_sample,
            Note::new(61).unwrap(),
            Note::new(127).unwrap(),
            Velocity::new(0).unwrap(),
            Velocity::new(127).unwrap(),
        ));

        // Low note should match first mapping
        let found = map.find_sample(Note::C4, Velocity::new(100).unwrap()); // C4 = 60
        assert!(found.is_some());
        assert_eq!(found.unwrap().root_note, Note::new(36).unwrap());

        // High note should match second mapping
        let found = map.find_sample(Note::new(72).unwrap(), Velocity::new(100).unwrap());
        assert!(found.is_some());
        assert_eq!(found.unwrap().root_note, Note::new(72).unwrap());
    }

    #[test]
    fn test_sample_mapping_velocity_layers() {
        let mut map = SampleMap::new();

        let soft_sample = AudioSample::new(vec![0.1; 100], 44100, Note::C4);
        let loud_sample = AudioSample::new(vec![0.9; 100], 44100, Note::C4);

        map.add_mapping(SampleMapping::new(
            soft_sample,
            Note::new(0).unwrap(),
            Note::new(127).unwrap(),
            Velocity::new(0).unwrap(),
            Velocity::new(63).unwrap(),
        ));
        map.add_mapping(SampleMapping::new(
            loud_sample,
            Note::new(0).unwrap(),
            Note::new(127).unwrap(),
            Velocity::new(64).unwrap(),
            Velocity::new(127).unwrap(),
        ));

        // Soft velocity
        let found = map.find_sample(Note::C4, Velocity::new(32).unwrap());
        assert!(found.is_some());
        assert!((found.unwrap().data[0] - 0.1).abs() < 1e-6);

        // Loud velocity
        let found = map.find_sample(Note::C4, Velocity::new(100).unwrap());
        assert!(found.is_some());
        assert!((found.unwrap().data[0] - 0.9).abs() < 1e-6);
    }
}
