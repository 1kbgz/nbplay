use pyo3::prelude::*;

use nbplay::audio::{
    AudioBuffer as BaseAudioBuffer, AudioFormat as BaseAudioFormat, ChannelCount, SampleRate,
};

#[pyclass(name = "AudioFormat", from_py_object)]
#[derive(Clone)]
pub struct PyAudioFormat {
    pub inner: BaseAudioFormat,
}

#[pymethods]
impl PyAudioFormat {
    #[new]
    #[pyo3(signature = (sample_rate=44100, channels=2))]
    fn py_new(sample_rate: u32, channels: u16) -> Self {
        PyAudioFormat {
            inner: BaseAudioFormat::new(SampleRate(sample_rate), ChannelCount(channels)),
        }
    }

    #[getter]
    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate.0
    }

    #[getter]
    fn channels(&self) -> u16 {
        self.inner.channels.0
    }

    fn __repr__(&self) -> String {
        format!(
            "AudioFormat(sample_rate={}, channels={})",
            self.inner.sample_rate.0, self.inner.channels.0
        )
    }

    fn __str__(&self) -> String {
        format!("{}Hz {}ch", self.inner.sample_rate.0, self.inner.channels.0)
    }

    fn __eq__(&self, other: &PyAudioFormat) -> bool {
        self.inner == other.inner
    }
}

#[pyclass(name = "AudioBuffer")]
pub struct PyAudioBuffer {
    pub inner: BaseAudioBuffer,
}

#[pymethods]
impl PyAudioBuffer {
    #[new]
    #[pyo3(signature = (frames, sample_rate=44100, channels=1))]
    fn py_new(frames: usize, sample_rate: u32, channels: u16) -> Self {
        let format = BaseAudioFormat::new(SampleRate(sample_rate), ChannelCount(channels));
        PyAudioBuffer {
            inner: BaseAudioBuffer::silence(frames, format),
        }
    }

    #[getter]
    fn frames(&self) -> usize {
        self.inner.frames()
    }

    fn __len__(&self) -> usize {
        self.inner.data.len()
    }

    fn sample_at(&self, frame: usize, channel: usize) -> PyResult<f32> {
        self.inner
            .sample_at(frame, channel)
            .ok_or_else(|| pyo3::exceptions::PyIndexError::new_err("Index out of bounds"))
    }

    fn set_sample(&mut self, frame: usize, channel: usize, value: f32) -> PyResult<()> {
        if self.inner.set_sample(frame, channel, value) {
            Ok(())
        } else {
            Err(pyo3::exceptions::PyIndexError::new_err(
                "Index out of bounds",
            ))
        }
    }

    fn clear(&mut self) {
        self.inner.clear();
    }

    fn to_list(&self) -> Vec<f32> {
        self.inner.data.clone()
    }

    #[getter]
    fn format(&self) -> PyAudioFormat {
        PyAudioFormat {
            inner: self.inner.format,
        }
    }

    fn __repr__(&self) -> String {
        format!(
            "AudioBuffer(frames={}, sample_rate={}, channels={})",
            self.inner.frames(),
            self.inner.format.sample_rate.0,
            self.inner.format.channels.0
        )
    }
}
