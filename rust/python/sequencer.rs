use pyo3::prelude::*;

use nbplay::midi::{MidiChannel, Note, Velocity};
use nbplay::sequencer::{
    EventSequence as BaseEventSequence, NoteEvent as BaseNoteEvent, Pattern as BasePattern,
    Step as BaseStep, StepSequencer as BaseStepSequencer, TransportClock as BaseTransportClock,
    TransportState,
};

// Step

#[pyclass(name = "Step", from_py_object)]
#[derive(Clone)]
pub struct PyStep {
    pub inner: BaseStep,
}

#[pymethods]
impl PyStep {
    #[new]
    #[pyo3(signature = (note, velocity, duration_ticks=1))]
    fn py_new(note: u8, velocity: u8, duration_ticks: u32) -> PyResult<Self> {
        let n = Note::new(note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let v = Velocity::new(velocity).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(PyStep {
            inner: BaseStep::new(n, v, duration_ticks),
        })
    }

    #[getter]
    fn note(&self) -> u8 {
        self.inner.note.value()
    }

    #[setter]
    fn set_note(&mut self, note: u8) -> PyResult<()> {
        self.inner.note =
            Note::new(note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(())
    }

    #[getter]
    fn velocity(&self) -> u8 {
        self.inner.velocity.value()
    }

    #[setter]
    fn set_velocity(&mut self, velocity: u8) -> PyResult<()> {
        self.inner.velocity =
            Velocity::new(velocity).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(())
    }

    #[getter]
    fn duration_ticks(&self) -> u32 {
        self.inner.duration_ticks
    }

    #[setter]
    fn set_duration_ticks(&mut self, ticks: u32) {
        self.inner.duration_ticks = ticks;
    }

    #[getter]
    fn active(&self) -> bool {
        self.inner.active
    }

    #[setter]
    fn set_active(&mut self, active: bool) {
        self.inner.active = active;
    }

    fn __repr__(&self) -> String {
        format!(
            "Step(note={}, velocity={}, duration_ticks={}, active={})",
            self.inner.note.value(),
            self.inner.velocity.value(),
            self.inner.duration_ticks,
            self.inner.active,
        )
    }

    fn __eq__(&self, other: &PyStep) -> bool {
        self.inner == other.inner
    }
}

// Pattern

#[pyclass(name = "Pattern", from_py_object)]
#[derive(Clone)]
pub struct PyPattern {
    pub inner: BasePattern,
}

#[pymethods]
impl PyPattern {
    #[new]
    #[pyo3(signature = (length=16))]
    fn py_new(length: usize) -> Self {
        PyPattern {
            inner: BasePattern::new(length),
        }
    }

    #[getter]
    fn length(&self) -> usize {
        self.inner.length
    }

    #[getter]
    fn loop_enabled(&self) -> bool {
        self.inner.loop_enabled
    }

    #[setter]
    fn set_loop_enabled(&mut self, enabled: bool) {
        self.inner.loop_enabled = enabled;
    }

    fn set_step(&mut self, index: usize, step: &PyStep) -> bool {
        self.inner.set_step(index, step.inner.clone())
    }

    fn toggle_step(&mut self, index: usize) -> bool {
        self.inner.toggle_step(index)
    }

    fn get_step(&self, index: usize) -> PyResult<PyStep> {
        self.inner
            .get_step(index)
            .map(|s| PyStep { inner: s.clone() })
            .ok_or_else(|| {
                pyo3::exceptions::PyIndexError::new_err(format!(
                    "Step index {index} out of range ({})",
                    self.inner.length
                ))
            })
    }

    fn clear(&mut self) {
        self.inner.clear();
    }

    fn __repr__(&self) -> String {
        let active_count = self.inner.steps.iter().filter(|s| s.active).count();
        format!(
            "Pattern(length={}, active_steps={}, loop={})",
            self.inner.length, active_count, self.inner.loop_enabled,
        )
    }

    fn __len__(&self) -> usize {
        self.inner.length
    }
}

// NoteEvent

#[pyclass(name = "NoteEvent", from_py_object)]
#[derive(Clone)]
pub struct PyNoteEvent {
    pub inner: BaseNoteEvent,
}

#[pymethods]
impl PyNoteEvent {
    #[new]
    fn py_new(beat_position: f64, duration: f64, note: u8, velocity: u8) -> PyResult<Self> {
        let n = Note::new(note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let v = Velocity::new(velocity).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(PyNoteEvent {
            inner: BaseNoteEvent::new(beat_position, duration, n, v),
        })
    }

    #[getter]
    fn beat_position(&self) -> f64 {
        self.inner.beat_position
    }

    #[setter]
    fn set_beat_position(&mut self, pos: f64) {
        self.inner.beat_position = pos;
    }

    #[getter]
    fn duration(&self) -> f64 {
        self.inner.duration
    }

    #[setter]
    fn set_duration(&mut self, dur: f64) {
        self.inner.duration = dur;
    }

    #[getter]
    fn note(&self) -> u8 {
        self.inner.note.value()
    }

    #[setter]
    fn set_note(&mut self, note: u8) -> PyResult<()> {
        self.inner.note =
            Note::new(note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(())
    }

    #[getter]
    fn velocity(&self) -> u8 {
        self.inner.velocity.value()
    }

    #[setter]
    fn set_velocity(&mut self, velocity: u8) -> PyResult<()> {
        self.inner.velocity =
            Velocity::new(velocity).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(())
    }

    fn end_position(&self) -> f64 {
        self.inner.end_position()
    }

    fn __repr__(&self) -> String {
        format!(
            "NoteEvent(beat={:.3}, dur={:.3}, note={}, vel={})",
            self.inner.beat_position,
            self.inner.duration,
            self.inner.note.value(),
            self.inner.velocity.value(),
        )
    }

    fn __eq__(&self, other: &PyNoteEvent) -> bool {
        self.inner == other.inner
    }
}

// EventSequence

#[pyclass(name = "EventSequence")]
pub struct PyEventSequence {
    inner: BaseEventSequence,
}

#[pymethods]
impl PyEventSequence {
    #[new]
    fn py_new() -> Self {
        PyEventSequence {
            inner: BaseEventSequence::new(),
        }
    }

    fn add_event(&mut self, event: &PyNoteEvent) {
        self.inner.add_event(event.inner.clone());
    }

    fn remove_event(&mut self, index: usize) -> Option<PyNoteEvent> {
        self.inner
            .remove_event(index)
            .map(|e| PyNoteEvent { inner: e })
    }

    fn events(&self) -> Vec<PyNoteEvent> {
        self.inner
            .events()
            .iter()
            .map(|e| PyNoteEvent { inner: e.clone() })
            .collect()
    }

    fn events_in_range(&self, start: f64, end: f64) -> Vec<PyNoteEvent> {
        self.inner
            .events_in_range(start, end)
            .into_iter()
            .map(|e| PyNoteEvent { inner: e.clone() })
            .collect()
    }

    fn events_starting_in_range(&self, start: f64, end: f64) -> Vec<PyNoteEvent> {
        self.inner
            .events_starting_in_range(start, end)
            .into_iter()
            .map(|e| PyNoteEvent { inner: e.clone() })
            .collect()
    }

    fn duration(&self) -> f64 {
        self.inner.duration()
    }

    fn clear(&mut self) {
        self.inner.clear();
    }

    fn __repr__(&self) -> String {
        format!(
            "EventSequence(events={}, duration={:.3})",
            self.inner.len(),
            self.inner.duration(),
        )
    }

    fn __len__(&self) -> usize {
        self.inner.len()
    }
}

// TransportClock

#[pyclass(name = "TransportClock")]
pub struct PyTransportClock {
    inner: BaseTransportClock,
}

#[pymethods]
impl PyTransportClock {
    #[new]
    #[pyo3(signature = (bpm=120.0))]
    fn py_new(bpm: f64) -> Self {
        PyTransportClock {
            inner: BaseTransportClock::new(bpm),
        }
    }

    #[getter]
    fn bpm(&self) -> f64 {
        self.inner.bpm
    }

    #[setter]
    fn set_bpm(&mut self, bpm: f64) {
        self.inner.set_bpm(bpm);
    }

    #[getter]
    fn position(&self) -> f64 {
        self.inner.position()
    }

    #[getter]
    fn ticks_per_beat(&self) -> u32 {
        self.inner.ticks_per_beat
    }

    #[setter]
    fn set_ticks_per_beat(&mut self, tpb: u32) {
        self.inner.ticks_per_beat = tpb;
    }

    #[getter]
    fn state(&self) -> &str {
        match self.inner.state() {
            TransportState::Stopped => "stopped",
            TransportState::Playing => "playing",
            TransportState::Paused => "paused",
        }
    }

    fn play(&mut self) {
        self.inner.play();
    }

    fn pause(&mut self) {
        self.inner.pause();
    }

    fn stop(&mut self) {
        self.inner.stop();
    }

    fn seek(&mut self, beat: f64) {
        self.inner.seek(beat);
    }

    fn advance_by_frames(&mut self, frames: usize, sample_rate: u32) -> Option<(f64, f64)> {
        self.inner.advance_by_frames(frames, sample_rate)
    }

    fn beats_to_seconds(&self, beats: f64) -> f64 {
        self.inner.beats_to_seconds(beats)
    }

    fn seconds_to_beats(&self, seconds: f64) -> f64 {
        self.inner.seconds_to_beats(seconds)
    }

    fn beats_to_ticks(&self, beats: f64) -> u64 {
        self.inner.beats_to_ticks(beats)
    }

    fn ticks_to_beats(&self, ticks: u64) -> f64 {
        self.inner.ticks_to_beats(ticks)
    }

    fn __repr__(&self) -> String {
        format!(
            "TransportClock(bpm={:.1}, position={:.3}, state='{}')",
            self.inner.bpm,
            self.inner.position(),
            self.state(),
        )
    }
}

// StepSequencer

#[pyclass(name = "StepSequencer")]
pub struct PyStepSequencer {
    inner: BaseStepSequencer,
}

#[pymethods]
impl PyStepSequencer {
    #[new]
    #[pyo3(signature = (pattern, channel=0))]
    fn py_new(pattern: &PyPattern, channel: u8) -> PyResult<Self> {
        let ch =
            MidiChannel::new(channel).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(PyStepSequencer {
            inner: BaseStepSequencer::new(pattern.inner.clone(), ch),
        })
    }

    #[getter]
    fn step_duration(&self) -> f64 {
        self.inner.step_duration
    }

    #[setter]
    fn set_step_duration(&mut self, dur: f64) {
        self.inner.step_duration = dur;
    }

    #[getter]
    fn current_step(&self) -> usize {
        self.inner.current_step()
    }

    fn set_pattern(&mut self, pattern: &PyPattern) {
        self.inner.pattern = pattern.inner.clone();
    }

    fn reset(&mut self) {
        self.inner.reset();
    }

    /// Process a beat range and return MIDI events as dicts.
    fn process_beat_range(&mut self, start: f64, end: f64) -> Vec<(String, u8, u8, u64)> {
        let events = self.inner.process_beat_range(start, end);
        events
            .into_iter()
            .map(|e| match &e.message {
                nbplay::MidiMessage::NoteOn { note, velocity, .. } => (
                    "note_on".to_string(),
                    note.value(),
                    velocity.value(),
                    e.timestamp_us,
                ),
                nbplay::MidiMessage::NoteOff { note, velocity, .. } => (
                    "note_off".to_string(),
                    note.value(),
                    velocity.value(),
                    e.timestamp_us,
                ),
                _ => ("other".to_string(), 0, 0, e.timestamp_us),
            })
            .collect()
    }

    fn __repr__(&self) -> String {
        format!(
            "StepSequencer(step_duration={:.3}, current_step={})",
            self.inner.step_duration,
            self.inner.current_step(),
        )
    }
}
