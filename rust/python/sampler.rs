use pyo3::prelude::*;

use nbplay::midi::{MidiChannel, Note, Velocity};
use nbplay::sampler::{
    AudioSample as BaseAudioSample, Envelope as BaseEnvelope, SampleMap as BaseSampleMap,
    SampleMapping as BaseSampleMapping, Sampler as BaseSampler,
};

// AudioSample

#[pyclass(name = "AudioSample", from_py_object)]
#[derive(Clone)]
pub struct PyAudioSample {
    pub inner: BaseAudioSample,
}

#[pymethods]
impl PyAudioSample {
    #[new]
    #[pyo3(signature = (data, sample_rate=44100, root_note=69))]
    fn py_new(data: Vec<f32>, sample_rate: u32, root_note: u8) -> PyResult<Self> {
        let note = Note::new(root_note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(PyAudioSample {
            inner: BaseAudioSample::new(data, sample_rate, note),
        })
    }

    #[getter]
    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate
    }

    #[getter]
    fn root_note(&self) -> u8 {
        self.inner.root_note.value()
    }

    #[setter]
    fn set_root_note(&mut self, note: u8) -> PyResult<()> {
        self.inner.root_note =
            Note::new(note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(())
    }

    #[getter]
    fn loop_start(&self) -> Option<usize> {
        self.inner.loop_start
    }

    #[setter]
    fn set_loop_start(&mut self, start: Option<usize>) {
        self.inner.loop_start = start;
    }

    #[getter]
    fn loop_end(&self) -> Option<usize> {
        self.inner.loop_end
    }

    #[setter]
    fn set_loop_end(&mut self, end: Option<usize>) {
        self.inner.loop_end = end;
    }

    fn duration_seconds(&self) -> f64 {
        self.inner.duration_seconds()
    }

    fn data(&self) -> Vec<f32> {
        self.inner.data.clone()
    }

    fn __repr__(&self) -> String {
        format!(
            "AudioSample(samples={}, sr={}, root_note={}, duration={:.3}s)",
            self.inner.len(),
            self.inner.sample_rate,
            self.inner.root_note.value(),
            self.inner.duration_seconds(),
        )
    }

    fn __len__(&self) -> usize {
        self.inner.len()
    }
}

// Envelope

#[pyclass(name = "Envelope", from_py_object)]
#[derive(Clone)]
pub struct PyEnvelope {
    pub inner: BaseEnvelope,
}

#[pymethods]
impl PyEnvelope {
    #[new]
    #[pyo3(signature = (attack=0.005, decay=0.1, sustain=0.8, release=0.1))]
    fn py_new(attack: f64, decay: f64, sustain: f64, release: f64) -> Self {
        PyEnvelope {
            inner: BaseEnvelope::new(attack, decay, sustain, release),
        }
    }

    #[getter]
    fn attack(&self) -> f64 {
        self.inner.attack
    }

    #[setter]
    fn set_attack(&mut self, val: f64) {
        self.inner.attack = val.max(0.0);
    }

    #[getter]
    fn decay(&self) -> f64 {
        self.inner.decay
    }

    #[setter]
    fn set_decay(&mut self, val: f64) {
        self.inner.decay = val.max(0.0);
    }

    #[getter]
    fn sustain(&self) -> f64 {
        self.inner.sustain
    }

    #[setter]
    fn set_sustain(&mut self, val: f64) {
        self.inner.sustain = val.clamp(0.0, 1.0);
    }

    #[getter]
    fn release(&self) -> f64 {
        self.inner.release
    }

    #[setter]
    fn set_release(&mut self, val: f64) {
        self.inner.release = val.max(0.0);
    }

    fn __repr__(&self) -> String {
        format!(
            "Envelope(A={:.3}, D={:.3}, S={:.2}, R={:.3})",
            self.inner.attack, self.inner.decay, self.inner.sustain, self.inner.release,
        )
    }

    fn __eq__(&self, other: &PyEnvelope) -> bool {
        self.inner == other.inner
    }
}

// SampleMapping

#[pyclass(name = "SampleMapping", from_py_object)]
#[derive(Clone)]
pub struct PySampleMapping {
    pub inner: BaseSampleMapping,
}

#[pymethods]
impl PySampleMapping {
    #[new]
    fn py_new(
        sample: &PyAudioSample,
        note_low: u8,
        note_high: u8,
        velocity_low: u8,
        velocity_high: u8,
    ) -> PyResult<Self> {
        let nl = Note::new(note_low).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let nh = Note::new(note_high).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let vl =
            Velocity::new(velocity_low).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let vh =
            Velocity::new(velocity_high).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(PySampleMapping {
            inner: BaseSampleMapping::new(sample.inner.clone(), nl, nh, vl, vh),
        })
    }

    fn matches(&self, note: u8, velocity: u8) -> PyResult<bool> {
        let n = Note::new(note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let v = Velocity::new(velocity).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(self.inner.matches(n, v))
    }

    fn __repr__(&self) -> String {
        format!(
            "SampleMapping(notes={}-{}, vel={}-{})",
            self.inner.note_low.value(),
            self.inner.note_high.value(),
            self.inner.velocity_low.value(),
            self.inner.velocity_high.value(),
        )
    }
}

// SampleMap

#[pyclass(name = "SampleMap")]
pub struct PySampleMap {
    pub inner: BaseSampleMap,
}

#[pymethods]
impl PySampleMap {
    #[new]
    fn py_new() -> Self {
        PySampleMap {
            inner: BaseSampleMap::new(),
        }
    }

    #[staticmethod]
    fn single_sample(sample: &PyAudioSample) -> Self {
        PySampleMap {
            inner: BaseSampleMap::single_sample(sample.inner.clone()),
        }
    }

    fn add_mapping(&mut self, mapping: &PySampleMapping) {
        self.inner.add_mapping(mapping.inner.clone());
    }

    fn find_sample(&self, note: u8, velocity: u8) -> PyResult<Option<PyAudioSample>> {
        let n = Note::new(note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let v = Velocity::new(velocity).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(self
            .inner
            .find_sample(n, v)
            .map(|s| PyAudioSample { inner: s.clone() }))
    }

    fn mapping_count(&self) -> usize {
        self.inner.mapping_count()
    }

    fn __repr__(&self) -> String {
        format!("SampleMap(mappings={})", self.inner.mapping_count())
    }

    fn __len__(&self) -> usize {
        self.inner.mapping_count()
    }
}

// Sampler

#[pyclass(name = "Sampler")]
pub struct PySampler {
    inner: BaseSampler,
}

#[pymethods]
impl PySampler {
    #[new]
    #[pyo3(signature = (sample, sample_rate=44100, max_voices=8))]
    fn py_new(sample: &PyAudioSample, sample_rate: u32, max_voices: usize) -> Self {
        PySampler {
            inner: BaseSampler::new(sample.inner.clone(), sample_rate, max_voices),
        }
    }

    #[getter]
    fn max_voices(&self) -> usize {
        self.inner.max_voices
    }

    #[setter]
    fn set_max_voices(&mut self, v: usize) {
        self.inner.max_voices = v;
    }

    #[getter]
    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate
    }

    fn set_envelope(&mut self, envelope: &PyEnvelope) {
        self.inner.envelope = envelope.inner.clone();
    }

    fn note_on(&mut self, note: u8, velocity: u8) -> PyResult<()> {
        let n = Note::new(note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let v = Velocity::new(velocity).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let ch = MidiChannel::new(0).unwrap();
        self.inner.process_midi(&nbplay::MidiMessage::NoteOn {
            channel: ch,
            note: n,
            velocity: v,
        });
        Ok(())
    }

    fn note_off(&mut self, note: u8) -> PyResult<()> {
        let n = Note::new(note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let ch = MidiChannel::new(0).unwrap();
        self.inner.process_midi(&nbplay::MidiMessage::NoteOff {
            channel: ch,
            note: n,
            velocity: Velocity::new(0).unwrap(),
        });
        Ok(())
    }

    fn active_voice_count(&self) -> usize {
        self.inner.active_voice_count()
    }

    fn all_notes_off(&mut self) {
        self.inner.all_notes_off();
    }

    fn panic(&mut self) {
        self.inner.panic();
    }

    /// Render audio into a list of f32 samples (mono).
    fn render(&mut self, frames: usize) -> Vec<f32> {
        use nbplay::audio::{AudioBuffer, AudioFormat, ChannelCount, SampleRate};
        use nbplay::oscillator::AudioSource;

        let format = AudioFormat::new(SampleRate(self.inner.sample_rate), ChannelCount::MONO);
        let mut buffer = AudioBuffer::silence(frames, format);
        self.inner.render(&mut buffer);
        buffer.data
    }

    fn __repr__(&self) -> String {
        format!(
            "Sampler(max_voices={}, active={}, sr={})",
            self.inner.max_voices,
            self.inner.active_voice_count(),
            self.inner.sample_rate,
        )
    }
}
