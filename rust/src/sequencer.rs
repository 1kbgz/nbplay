use crate::midi::{MidiChannel, MidiEvent, MidiMessage, Note, Velocity};

// ── Step Sequencer Types ─────────────────────────────────────────

/// A single step in a step sequencer pattern.
#[derive(Clone, Debug, PartialEq)]
pub struct Step {
    pub note: Note,
    pub velocity: Velocity,
    pub duration_ticks: u32,
    pub active: bool,
}

impl Step {
    pub fn new(note: Note, velocity: Velocity, duration_ticks: u32) -> Self {
        Step {
            note,
            velocity,
            duration_ticks,
            active: true,
        }
    }

    pub fn inactive(note: Note) -> Self {
        Step {
            note,
            velocity: Velocity::new(0).unwrap(),
            duration_ticks: 1,
            active: false,
        }
    }
}

/// A pattern: a fixed-length sequence of steps with loop control.
#[derive(Clone, Debug, PartialEq)]
pub struct Pattern {
    pub steps: Vec<Step>,
    pub length: usize,
    pub loop_enabled: bool,
}

impl Pattern {
    /// Create a new pattern with the given number of steps (all inactive).
    pub fn new(length: usize) -> Self {
        let steps = (0..length).map(|_| Step::inactive(Note::C4)).collect();
        Pattern {
            steps,
            length,
            loop_enabled: true,
        }
    }

    /// Set a step at the given index.
    pub fn set_step(&mut self, index: usize, step: Step) -> bool {
        if index < self.steps.len() {
            self.steps[index] = step;
            true
        } else {
            false
        }
    }

    /// Toggle the active state of a step.
    pub fn toggle_step(&mut self, index: usize) -> bool {
        if index < self.steps.len() {
            self.steps[index].active = !self.steps[index].active;
            true
        } else {
            false
        }
    }

    /// Get a step at the given index.
    pub fn get_step(&self, index: usize) -> Option<&Step> {
        self.steps.get(index)
    }

    /// Clear all steps (set to inactive).
    pub fn clear(&mut self) {
        for step in &mut self.steps {
            step.active = false;
        }
    }
}

// ── Piano Roll / Event Sequence ──────────────────────────────────

/// A note event positioned in musical time (beats).
#[derive(Clone, Debug, PartialEq)]
pub struct NoteEvent {
    pub beat_position: f64,
    pub duration: f64,
    pub note: Note,
    pub velocity: Velocity,
}

impl NoteEvent {
    pub fn new(beat_position: f64, duration: f64, note: Note, velocity: Velocity) -> Self {
        NoteEvent {
            beat_position,
            duration,
            note,
            velocity,
        }
    }

    /// The beat position where this note ends.
    pub fn end_position(&self) -> f64 {
        self.beat_position + self.duration
    }
}

/// A sorted list of note events, similar to a MIDI track.
#[derive(Clone, Debug, PartialEq)]
pub struct EventSequence {
    events: Vec<NoteEvent>,
}

impl EventSequence {
    pub fn new() -> Self {
        EventSequence { events: Vec::new() }
    }

    /// Add a note event, maintaining sort order by beat position.
    pub fn add_event(&mut self, event: NoteEvent) {
        let pos = self
            .events
            .partition_point(|e| e.beat_position <= event.beat_position);
        self.events.insert(pos, event);
    }

    /// Remove the event at the given index.
    pub fn remove_event(&mut self, index: usize) -> Option<NoteEvent> {
        if index < self.events.len() {
            Some(self.events.remove(index))
        } else {
            None
        }
    }

    /// Get all events.
    pub fn events(&self) -> &[NoteEvent] {
        &self.events
    }

    /// Get the number of events.
    pub fn len(&self) -> usize {
        self.events.len()
    }

    /// Check if the sequence is empty.
    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    /// Get all events that are active during a given beat range [start, end).
    pub fn events_in_range(&self, start: f64, end: f64) -> Vec<&NoteEvent> {
        self.events
            .iter()
            .filter(|e| e.beat_position < end && e.end_position() > start)
            .collect()
    }

    /// Get all events that start within a given beat range [start, end).
    pub fn events_starting_in_range(&self, start: f64, end: f64) -> Vec<&NoteEvent> {
        self.events
            .iter()
            .filter(|e| e.beat_position >= start && e.beat_position < end)
            .collect()
    }

    /// Total duration in beats (end of the last event).
    pub fn duration(&self) -> f64 {
        self.events
            .iter()
            .map(|e| e.end_position())
            .fold(0.0_f64, f64::max)
    }

    /// Clear all events.
    pub fn clear(&mut self) {
        self.events.clear();
    }
}

impl Default for EventSequence {
    fn default() -> Self {
        Self::new()
    }
}

// ── Transport Clock ──────────────────────────────────────────────

/// Transport state.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TransportState {
    Stopped,
    Playing,
    Paused,
}

/// A transport clock that tracks beat position based on BPM.
#[derive(Clone, Debug)]
pub struct TransportClock {
    pub bpm: f64,
    /// Current position in beats.
    position: f64,
    state: TransportState,
    /// Ticks per beat (resolution). Default: 480 (standard MIDI PPQ).
    pub ticks_per_beat: u32,
}

impl TransportClock {
    pub fn new(bpm: f64) -> Self {
        TransportClock {
            bpm,
            position: 0.0,
            state: TransportState::Stopped,
            ticks_per_beat: 480,
        }
    }

    pub fn state(&self) -> TransportState {
        self.state
    }

    pub fn position(&self) -> f64 {
        self.position
    }

    pub fn play(&mut self) {
        self.state = TransportState::Playing;
    }

    pub fn pause(&mut self) {
        self.state = TransportState::Paused;
    }

    pub fn stop(&mut self) {
        self.state = TransportState::Stopped;
        self.position = 0.0;
    }

    pub fn seek(&mut self, beat: f64) {
        self.position = beat.max(0.0);
    }

    pub fn set_bpm(&mut self, bpm: f64) {
        self.bpm = bpm.max(1.0);
    }

    /// Advance the clock by a given number of audio frames at the given sample rate.
    /// Returns the beat range [old_position, new_position) that was covered.
    pub fn advance_by_frames(&mut self, frames: usize, sample_rate: u32) -> Option<(f64, f64)> {
        if self.state != TransportState::Playing {
            return None;
        }
        let old = self.position;
        let seconds = frames as f64 / sample_rate as f64;
        let beats = seconds * self.bpm / 60.0;
        self.position += beats;
        Some((old, self.position))
    }

    /// Convert a beat position to a time in seconds.
    pub fn beats_to_seconds(&self, beats: f64) -> f64 {
        beats * 60.0 / self.bpm
    }

    /// Convert a time in seconds to beats.
    pub fn seconds_to_beats(&self, seconds: f64) -> f64 {
        seconds * self.bpm / 60.0
    }

    /// Convert beats to ticks at the current resolution.
    pub fn beats_to_ticks(&self, beats: f64) -> u64 {
        (beats * self.ticks_per_beat as f64).round() as u64
    }

    /// Convert ticks to beats.
    pub fn ticks_to_beats(&self, ticks: u64) -> f64 {
        ticks as f64 / self.ticks_per_beat as f64
    }
}

// ── Step Sequencer Engine ────────────────────────────────────────

/// A step sequencer that triggers MIDI events from a pattern.
pub struct StepSequencer {
    pub pattern: Pattern,
    pub channel: MidiChannel,
    /// Current step index (the last step that was triggered).
    current_step: usize,
    /// Beat position of the last triggered step.
    last_trigger_beat: f64,
    /// Beats per step (e.g., 0.25 for sixteenth notes at 4/4).
    pub step_duration: f64,
}

impl StepSequencer {
    pub fn new(pattern: Pattern, channel: MidiChannel) -> Self {
        StepSequencer {
            pattern,
            channel,
            current_step: 0,
            last_trigger_beat: -1.0,
            step_duration: 0.25, // sixteenth notes
        }
    }

    /// Reset playback position to the beginning.
    pub fn reset(&mut self) {
        self.current_step = 0;
        self.last_trigger_beat = -1.0;
    }

    /// Process a beat range and return any MIDI events that should fire.
    /// Returns pairs of (timestamp_in_beats, MidiEvent).
    pub fn process_beat_range(&mut self, start: f64, end: f64) -> Vec<MidiEvent> {
        if self.pattern.steps.is_empty() || start >= end {
            return Vec::new();
        }

        let mut events = Vec::new();
        let length = self.pattern.length;

        // Find which steps fall within [start, end)
        // First step index that could trigger at or after `start`
        let first_step_beat = if self.last_trigger_beat < 0.0 {
            0.0
        } else {
            // Next step after last trigger
            self.last_trigger_beat + self.step_duration
        };

        let mut beat = first_step_beat;
        while beat < end {
            if beat >= start {
                let step_index = ((beat / self.step_duration).floor() as usize) % length;
                let step = &self.pattern.steps[step_index];

                if step.active {
                    let timestamp_us = (beat * 1_000_000.0) as u64;

                    // NoteOn
                    events.push(MidiEvent::new(
                        MidiMessage::NoteOn {
                            channel: self.channel,
                            note: step.note,
                            velocity: step.velocity,
                        },
                        timestamp_us,
                    ));

                    // NoteOff after duration
                    let off_us = ((beat + step.duration_ticks as f64 * self.step_duration)
                        * 1_000_000.0) as u64;
                    events.push(MidiEvent::new(
                        MidiMessage::NoteOff {
                            channel: self.channel,
                            note: step.note,
                            velocity: Velocity::new(0).unwrap(),
                        },
                        off_us,
                    ));
                }

                self.current_step = step_index;
                self.last_trigger_beat = beat;
            }
            beat += self.step_duration;
        }

        events
    }

    pub fn current_step(&self) -> usize {
        self.current_step
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::midi::{MidiChannel, Note, Velocity};

    // ── Step tests ───────────────────────────────────────────────

    #[test]
    fn test_step_new() {
        let step = Step::new(Note::C4, Velocity::new(100).unwrap(), 2);
        assert_eq!(step.note, Note::C4);
        assert_eq!(step.velocity, Velocity::new(100).unwrap());
        assert_eq!(step.duration_ticks, 2);
        assert!(step.active);
    }

    #[test]
    fn test_step_inactive() {
        let step = Step::inactive(Note::A4);
        assert_eq!(step.note, Note::A4);
        assert!(!step.active);
    }

    // ── Pattern tests ────────────────────────────────────────────

    #[test]
    fn test_pattern_new() {
        let pattern = Pattern::new(16);
        assert_eq!(pattern.length, 16);
        assert_eq!(pattern.steps.len(), 16);
        assert!(pattern.loop_enabled);
        // All steps should be inactive
        for step in &pattern.steps {
            assert!(!step.active);
        }
    }

    #[test]
    fn test_pattern_set_step() {
        let mut pattern = Pattern::new(4);
        let step = Step::new(Note::C4, Velocity::new(80).unwrap(), 1);
        assert!(pattern.set_step(0, step.clone()));
        assert_eq!(pattern.get_step(0), Some(&step));
        assert!(!pattern.set_step(10, Step::inactive(Note::C4)));
    }

    #[test]
    fn test_pattern_toggle_step() {
        let mut pattern = Pattern::new(4);
        assert!(!pattern.steps[0].active);
        assert!(pattern.toggle_step(0));
        assert!(pattern.steps[0].active);
        assert!(pattern.toggle_step(0));
        assert!(!pattern.steps[0].active);
        assert!(!pattern.toggle_step(10));
    }

    #[test]
    fn test_pattern_clear() {
        let mut pattern = Pattern::new(4);
        pattern.steps[0].active = true;
        pattern.steps[2].active = true;
        pattern.clear();
        for step in &pattern.steps {
            assert!(!step.active);
        }
    }

    // ── NoteEvent tests ──────────────────────────────────────────

    #[test]
    fn test_note_event_end_position() {
        let event = NoteEvent::new(1.0, 0.5, Note::C4, Velocity::new(100).unwrap());
        assert!((event.end_position() - 1.5).abs() < 1e-10);
    }

    // ── EventSequence tests ──────────────────────────────────────

    #[test]
    fn test_event_sequence_add_sorted() {
        let mut seq = EventSequence::new();
        seq.add_event(NoteEvent::new(
            2.0,
            0.5,
            Note::E4,
            Velocity::new(80).unwrap(),
        ));
        seq.add_event(NoteEvent::new(
            0.0,
            0.5,
            Note::C4,
            Velocity::new(100).unwrap(),
        ));
        seq.add_event(NoteEvent::new(
            1.0,
            0.5,
            Note::D4,
            Velocity::new(90).unwrap(),
        ));

        let events = seq.events();
        assert_eq!(events.len(), 3);
        assert!((events[0].beat_position - 0.0).abs() < 1e-10);
        assert!((events[1].beat_position - 1.0).abs() < 1e-10);
        assert!((events[2].beat_position - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_event_sequence_remove() {
        let mut seq = EventSequence::new();
        seq.add_event(NoteEvent::new(
            0.0,
            0.5,
            Note::C4,
            Velocity::new(100).unwrap(),
        ));
        seq.add_event(NoteEvent::new(
            1.0,
            0.5,
            Note::D4,
            Velocity::new(90).unwrap(),
        ));
        assert_eq!(seq.len(), 2);
        let removed = seq.remove_event(0).unwrap();
        assert_eq!(removed.note, Note::C4);
        assert_eq!(seq.len(), 1);
        assert!(seq.remove_event(5).is_none());
    }

    #[test]
    fn test_event_sequence_events_in_range() {
        let mut seq = EventSequence::new();
        seq.add_event(NoteEvent::new(
            0.0,
            1.0,
            Note::C4,
            Velocity::new(100).unwrap(),
        )); // 0.0 - 1.0
        seq.add_event(NoteEvent::new(
            1.0,
            0.5,
            Note::D4,
            Velocity::new(90).unwrap(),
        )); // 1.0 - 1.5
        seq.add_event(NoteEvent::new(
            3.0,
            0.5,
            Note::E4,
            Velocity::new(80).unwrap(),
        )); // 3.0 - 3.5

        // Range [0.5, 1.2) should include C4 (still playing) and D4 (just started)
        let in_range = seq.events_in_range(0.5, 1.2);
        assert_eq!(in_range.len(), 2);

        // Range [2.0, 2.5) should include nothing
        let in_range = seq.events_in_range(2.0, 2.5);
        assert_eq!(in_range.len(), 0);
    }

    #[test]
    fn test_event_sequence_events_starting_in_range() {
        let mut seq = EventSequence::new();
        seq.add_event(NoteEvent::new(
            0.0,
            1.0,
            Note::C4,
            Velocity::new(100).unwrap(),
        ));
        seq.add_event(NoteEvent::new(
            1.0,
            0.5,
            Note::D4,
            Velocity::new(90).unwrap(),
        ));
        seq.add_event(NoteEvent::new(
            3.0,
            0.5,
            Note::E4,
            Velocity::new(80).unwrap(),
        ));

        let starting = seq.events_starting_in_range(0.5, 1.5);
        assert_eq!(starting.len(), 1);
        assert_eq!(starting[0].note, Note::D4);
    }

    #[test]
    fn test_event_sequence_duration() {
        let mut seq = EventSequence::new();
        assert!((seq.duration() - 0.0).abs() < 1e-10);
        seq.add_event(NoteEvent::new(
            0.0,
            1.0,
            Note::C4,
            Velocity::new(100).unwrap(),
        ));
        seq.add_event(NoteEvent::new(
            2.0,
            0.5,
            Note::D4,
            Velocity::new(90).unwrap(),
        ));
        assert!((seq.duration() - 2.5).abs() < 1e-10);
    }

    #[test]
    fn test_event_sequence_clear() {
        let mut seq = EventSequence::new();
        seq.add_event(NoteEvent::new(
            0.0,
            1.0,
            Note::C4,
            Velocity::new(100).unwrap(),
        ));
        seq.clear();
        assert!(seq.is_empty());
    }

    // ── TransportClock tests ─────────────────────────────────────

    #[test]
    fn test_transport_clock_new() {
        let clock = TransportClock::new(120.0);
        assert!((clock.bpm - 120.0).abs() < 1e-10);
        assert!((clock.position() - 0.0).abs() < 1e-10);
        assert_eq!(clock.state(), TransportState::Stopped);
    }

    #[test]
    fn test_transport_play_pause_stop() {
        let mut clock = TransportClock::new(120.0);
        clock.play();
        assert_eq!(clock.state(), TransportState::Playing);
        clock.pause();
        assert_eq!(clock.state(), TransportState::Paused);
        clock.play();
        // Advance a bit
        clock.advance_by_frames(44100, 44100); // 1 second
        assert!(clock.position() > 0.0);
        let pos = clock.position();
        clock.stop();
        assert_eq!(clock.state(), TransportState::Stopped);
        assert!((clock.position() - 0.0).abs() < 1e-10);
        // Seek
        clock.seek(4.0);
        assert!((clock.position() - 4.0).abs() < 1e-10);
    }

    #[test]
    fn test_transport_advance() {
        let mut clock = TransportClock::new(120.0);
        // Not playing — should return None
        assert!(clock.advance_by_frames(44100, 44100).is_none());

        clock.play();
        // 120 BPM = 2 beats per second. 1 second at 44100 Hz = 44100 frames
        let range = clock.advance_by_frames(44100, 44100).unwrap();
        assert!((range.0 - 0.0).abs() < 1e-10);
        assert!((range.1 - 2.0).abs() < 1e-10); // 2 beats
    }

    #[test]
    fn test_transport_beat_time_conversion() {
        let clock = TransportClock::new(120.0);
        // 120 BPM: 1 beat = 0.5 seconds
        assert!((clock.beats_to_seconds(1.0) - 0.5).abs() < 1e-10);
        assert!((clock.seconds_to_beats(0.5) - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_transport_tick_conversion() {
        let clock = TransportClock::new(120.0);
        assert_eq!(clock.beats_to_ticks(1.0), 480);
        assert!((clock.ticks_to_beats(480) - 1.0).abs() < 1e-10);
        assert_eq!(clock.beats_to_ticks(0.25), 120); // sixteenth note
    }

    #[test]
    fn test_transport_set_bpm() {
        let mut clock = TransportClock::new(120.0);
        clock.set_bpm(60.0);
        assert!((clock.bpm - 60.0).abs() < 1e-10);
        // Clamp to minimum
        clock.set_bpm(0.0);
        assert!((clock.bpm - 1.0).abs() < 1e-10);
    }

    // ── StepSequencer tests ──────────────────────────────────────

    #[test]
    fn test_step_sequencer_empty_pattern() {
        let pattern = Pattern::new(0);
        let mut seq = StepSequencer::new(pattern, MidiChannel::new(0).unwrap());
        let events = seq.process_beat_range(0.0, 1.0);
        assert!(events.is_empty());
    }

    #[test]
    fn test_step_sequencer_inactive_steps() {
        let pattern = Pattern::new(4);
        let mut seq = StepSequencer::new(pattern, MidiChannel::new(0).unwrap());
        let events = seq.process_beat_range(0.0, 1.0);
        assert!(events.is_empty());
    }

    #[test]
    fn test_step_sequencer_triggers_active_steps() {
        let mut pattern = Pattern::new(4);
        pattern.set_step(0, Step::new(Note::C4, Velocity::new(100).unwrap(), 1));
        pattern.set_step(2, Step::new(Note::E4, Velocity::new(80).unwrap(), 1));

        let mut seq = StepSequencer::new(pattern, MidiChannel::new(0).unwrap());
        seq.step_duration = 0.25; // sixteenth notes

        // Process first beat: steps 0, 1, 2, 3 at beats 0.0, 0.25, 0.5, 0.75
        let events = seq.process_beat_range(0.0, 1.0);

        // Step 0 (active): NoteOn + NoteOff = 2 events
        // Step 1 (inactive): 0 events
        // Step 2 (active): NoteOn + NoteOff = 2 events
        // Step 3 (inactive): 0 events
        assert_eq!(events.len(), 4);

        // First event should be NoteOn C4
        match &events[0].message {
            MidiMessage::NoteOn { note, velocity, .. } => {
                assert_eq!(*note, Note::C4);
                assert_eq!(*velocity, Velocity::new(100).unwrap());
            }
            _ => panic!("Expected NoteOn"),
        }

        // Third event should be NoteOn E4
        match &events[2].message {
            MidiMessage::NoteOn { note, .. } => {
                assert_eq!(*note, Note::E4);
            }
            _ => panic!("Expected NoteOn"),
        }
    }

    #[test]
    fn test_step_sequencer_reset() {
        let pattern = Pattern::new(4);
        let mut seq = StepSequencer::new(pattern, MidiChannel::new(0).unwrap());
        seq.process_beat_range(0.0, 1.0);
        seq.reset();
        assert_eq!(seq.current_step(), 0);
    }

    #[test]
    fn test_step_sequencer_wraps_pattern() {
        let mut pattern = Pattern::new(4);
        // Activate all 4 steps
        for i in 0..4 {
            pattern.set_step(i, Step::new(Note::C4, Velocity::new(100).unwrap(), 1));
        }

        let mut seq = StepSequencer::new(pattern, MidiChannel::new(0).unwrap());
        seq.step_duration = 0.25;

        // Process 2 beats (8 steps with the 4-step pattern)
        let events = seq.process_beat_range(0.0, 2.0);

        // 8 active steps × 2 (NoteOn + NoteOff) = 16 events
        assert_eq!(events.len(), 16);
    }
}
