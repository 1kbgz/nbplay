use pyo3::prelude::*;

use nbplay::audio::{AudioBuffer, AudioFormat, ChannelCount, SampleRate};
use nbplay::oscillator::{
    AudioSource, NoiseSource as BaseNoiseSource, SawOscillator as BaseSawOscillator,
    SineOscillator as BaseSineOscillator, SquareOscillator as BaseSquareOscillator,
};

#[pyclass(name = "SineOscillator")]
pub struct PySineOscillator {
    inner: BaseSineOscillator,
}

#[pymethods]
impl PySineOscillator {
    #[new]
    #[pyo3(signature = (frequency=440.0, amplitude=1.0, sample_rate=44100))]
    fn py_new(frequency: f64, amplitude: f64, sample_rate: u32) -> Self {
        PySineOscillator {
            inner: BaseSineOscillator::new(frequency, amplitude, sample_rate),
        }
    }

    #[getter]
    fn frequency(&self) -> f64 {
        self.inner.frequency
    }

    #[getter]
    fn amplitude(&self) -> f64 {
        self.inner.amplitude
    }

    #[getter]
    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate
    }

    fn render_to_buffer(&mut self, frames: usize) -> Vec<f32> {
        let format = AudioFormat::new(SampleRate(self.inner.sample_rate), ChannelCount::MONO);
        let mut buffer = AudioBuffer::silence(frames, format);
        self.inner.render(&mut buffer);
        buffer.data
    }

    fn __repr__(&self) -> String {
        format!(
            "SineOscillator(frequency={}, amplitude={}, sample_rate={})",
            self.inner.frequency, self.inner.amplitude, self.inner.sample_rate
        )
    }
}

#[pyclass(name = "SquareOscillator")]
pub struct PySquareOscillator {
    inner: BaseSquareOscillator,
}

#[pymethods]
impl PySquareOscillator {
    #[new]
    #[pyo3(signature = (frequency=440.0, amplitude=1.0, sample_rate=44100))]
    fn py_new(frequency: f64, amplitude: f64, sample_rate: u32) -> Self {
        PySquareOscillator {
            inner: BaseSquareOscillator::new(frequency, amplitude, sample_rate),
        }
    }

    #[getter]
    fn frequency(&self) -> f64 {
        self.inner.frequency
    }

    #[getter]
    fn amplitude(&self) -> f64 {
        self.inner.amplitude
    }

    #[getter]
    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate
    }

    fn render_to_buffer(&mut self, frames: usize) -> Vec<f32> {
        let format = AudioFormat::new(SampleRate(self.inner.sample_rate), ChannelCount::MONO);
        let mut buffer = AudioBuffer::silence(frames, format);
        self.inner.render(&mut buffer);
        buffer.data
    }

    fn __repr__(&self) -> String {
        format!(
            "SquareOscillator(frequency={}, amplitude={}, sample_rate={})",
            self.inner.frequency, self.inner.amplitude, self.inner.sample_rate
        )
    }
}

#[pyclass(name = "SawOscillator")]
pub struct PySawOscillator {
    inner: BaseSawOscillator,
}

#[pymethods]
impl PySawOscillator {
    #[new]
    #[pyo3(signature = (frequency=440.0, amplitude=1.0, sample_rate=44100))]
    fn py_new(frequency: f64, amplitude: f64, sample_rate: u32) -> Self {
        PySawOscillator {
            inner: BaseSawOscillator::new(frequency, amplitude, sample_rate),
        }
    }

    #[getter]
    fn frequency(&self) -> f64 {
        self.inner.frequency
    }

    #[getter]
    fn amplitude(&self) -> f64 {
        self.inner.amplitude
    }

    #[getter]
    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate
    }

    fn render_to_buffer(&mut self, frames: usize) -> Vec<f32> {
        let format = AudioFormat::new(SampleRate(self.inner.sample_rate), ChannelCount::MONO);
        let mut buffer = AudioBuffer::silence(frames, format);
        self.inner.render(&mut buffer);
        buffer.data
    }

    fn __repr__(&self) -> String {
        format!(
            "SawOscillator(frequency={}, amplitude={}, sample_rate={})",
            self.inner.frequency, self.inner.amplitude, self.inner.sample_rate
        )
    }
}

#[pyclass(name = "NoiseSource")]
pub struct PyNoiseSource {
    inner: BaseNoiseSource,
}

#[pymethods]
impl PyNoiseSource {
    #[new]
    #[pyo3(signature = (amplitude=1.0, seed=42))]
    fn py_new(amplitude: f64, seed: u64) -> Self {
        PyNoiseSource {
            inner: BaseNoiseSource::new(amplitude, seed),
        }
    }

    #[getter]
    fn amplitude(&self) -> f64 {
        self.inner.amplitude
    }

    fn render_to_buffer(&mut self, frames: usize) -> Vec<f32> {
        let format = AudioFormat::new(SampleRate(44100), ChannelCount::MONO);
        let mut buffer = AudioBuffer::silence(frames, format);
        self.inner.render(&mut buffer);
        buffer.data
    }

    fn __repr__(&self) -> String {
        format!("NoiseSource(amplitude={})", self.inner.amplitude)
    }
}
