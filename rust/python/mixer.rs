use pyo3::prelude::*;

use nbplay::mixer::{Mixer as BaseMixer, MixerChannel as BaseMixerChannel};

#[pyclass(name = "MixerChannel")]
#[derive(Clone)]
pub struct PyMixerChannel {
    pub inner: BaseMixerChannel,
}

#[pymethods]
impl PyMixerChannel {
    #[new]
    #[pyo3(signature = (name="Channel"))]
    fn py_new(name: &str) -> Self {
        PyMixerChannel {
            inner: BaseMixerChannel::new(name),
        }
    }

    #[getter]
    fn name(&self) -> &str {
        &self.inner.name
    }

    #[setter]
    fn set_name(&mut self, name: String) {
        self.inner.name = name;
    }

    #[getter]
    fn gain(&self) -> f32 {
        self.inner.gain
    }

    #[setter]
    fn set_gain(&mut self, gain: f32) {
        self.inner.gain = gain.clamp(0.0, 2.0);
    }

    #[getter]
    fn pan(&self) -> f32 {
        self.inner.pan
    }

    #[setter]
    fn set_pan(&mut self, pan: f32) {
        self.inner.pan = pan.clamp(-1.0, 1.0);
    }

    #[getter]
    fn mute(&self) -> bool {
        self.inner.mute
    }

    #[setter]
    fn set_mute(&mut self, mute: bool) {
        self.inner.mute = mute;
    }

    #[getter]
    fn solo(&self) -> bool {
        self.inner.solo
    }

    #[setter]
    fn set_solo(&mut self, solo: bool) {
        self.inner.solo = solo;
    }

    fn process_sample(&self, sample: f32) -> (f32, f32) {
        self.inner.process_sample(sample)
    }

    fn __repr__(&self) -> String {
        format!(
            "MixerChannel(name='{}', gain={:.2}, pan={:.2}, mute={}, solo={})",
            self.inner.name, self.inner.gain, self.inner.pan, self.inner.mute, self.inner.solo
        )
    }

    fn __eq__(&self, other: &PyMixerChannel) -> bool {
        self.inner == other.inner
    }
}

#[pyclass(name = "Mixer")]
pub struct PyMixer {
    inner: BaseMixer,
}

#[pymethods]
impl PyMixer {
    #[new]
    fn py_new() -> Self {
        PyMixer {
            inner: BaseMixer::new(),
        }
    }

    #[getter]
    fn master_gain(&self) -> f32 {
        self.inner.master_gain
    }

    #[setter]
    fn set_master_gain(&mut self, gain: f32) {
        self.inner.master_gain = gain.clamp(0.0, 2.0);
    }

    fn channel_count(&self) -> usize {
        self.inner.channel_count()
    }

    fn add_channel(&mut self, name: &str) -> usize {
        self.inner.add_channel(name)
    }

    fn remove_channel(&mut self, index: usize) -> Option<PyMixerChannel> {
        self.inner
            .remove_channel(index)
            .map(|ch| PyMixerChannel { inner: ch })
    }

    fn get_channel(&self, index: usize) -> PyResult<PyMixerChannel> {
        self.inner
            .channels
            .get(index)
            .map(|ch| PyMixerChannel { inner: ch.clone() })
            .ok_or_else(|| {
                pyo3::exceptions::PyIndexError::new_err(format!(
                    "Channel index {index} out of range ({})",
                    self.inner.channel_count()
                ))
            })
    }

    fn set_channel_gain(&mut self, index: usize, gain: f32) -> PyResult<()> {
        self.inner
            .channels
            .get_mut(index)
            .map(|ch| ch.gain = gain.clamp(0.0, 2.0))
            .ok_or_else(|| {
                pyo3::exceptions::PyIndexError::new_err(format!(
                    "Channel index {index} out of range"
                ))
            })
    }

    fn set_channel_pan(&mut self, index: usize, pan: f32) -> PyResult<()> {
        self.inner
            .channels
            .get_mut(index)
            .map(|ch| ch.pan = pan.clamp(-1.0, 1.0))
            .ok_or_else(|| {
                pyo3::exceptions::PyIndexError::new_err(format!(
                    "Channel index {index} out of range"
                ))
            })
    }

    fn set_channel_mute(&mut self, index: usize, mute: bool) -> PyResult<()> {
        self.inner
            .channels
            .get_mut(index)
            .map(|ch| ch.mute = mute)
            .ok_or_else(|| {
                pyo3::exceptions::PyIndexError::new_err(format!(
                    "Channel index {index} out of range"
                ))
            })
    }

    fn set_channel_solo(&mut self, index: usize, solo: bool) -> PyResult<()> {
        self.inner
            .channels
            .get_mut(index)
            .map(|ch| ch.solo = solo)
            .ok_or_else(|| {
                pyo3::exceptions::PyIndexError::new_err(format!(
                    "Channel index {index} out of range"
                ))
            })
    }

    /// Mix a list of per-channel mono sample buffers into interleaved stereo output.
    fn mix_down(&self, channel_buffers: Vec<Vec<f32>>) -> PyResult<Vec<f32>> {
        if channel_buffers.len() != self.inner.channel_count() {
            return Err(pyo3::exceptions::PyValueError::new_err(format!(
                "Expected {} buffers, got {}",
                self.inner.channel_count(),
                channel_buffers.len()
            )));
        }
        let refs: Vec<&[f32]> = channel_buffers.iter().map(|v| v.as_slice()).collect();
        Ok(self.inner.mix_down(&refs))
    }

    fn channel_names(&self) -> Vec<String> {
        self.inner.channels.iter().map(|ch| ch.name.clone()).collect()
    }

    fn __repr__(&self) -> String {
        let names: Vec<&str> = self.inner.channels.iter().map(|ch| ch.name.as_str()).collect();
        format!(
            "Mixer(master_gain={:.2}, channels=[{}])",
            self.inner.master_gain,
            names.join(", ")
        )
    }

    fn __len__(&self) -> usize {
        self.inner.channel_count()
    }
}
