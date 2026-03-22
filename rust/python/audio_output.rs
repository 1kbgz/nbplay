use pyo3::prelude::*;

use nbplay::audio_output::{list_audio_devices, AudioOutput as BaseAudioOutput, AudioOutputConfig};

#[pyclass(name = "AudioOutput", unsendable)]
pub struct PyAudioOutput {
    inner: Option<BaseAudioOutput>,
}

#[pymethods]
impl PyAudioOutput {
    #[new]
    #[pyo3(signature = (sample_rate=44100, channels=2, buffer_size=512))]
    fn py_new(sample_rate: u32, channels: u16, buffer_size: u32) -> PyResult<Self> {
        let config = AudioOutputConfig {
            sample_rate,
            channels,
            buffer_size,
        };
        let output = BaseAudioOutput::new(config)
            .map_err(|e| pyo3::exceptions::PyRuntimeError::new_err(e))?;
        Ok(PyAudioOutput {
            inner: Some(output),
        })
    }

    #[staticmethod]
    fn list_devices() -> Vec<String> {
        list_audio_devices()
    }

    fn device_name(&self) -> PyResult<String> {
        match &self.inner {
            Some(output) => Ok(output.device_name()),
            None => Err(pyo3::exceptions::PyRuntimeError::new_err(
                "AudioOutput not initialized",
            )),
        }
    }

    fn is_playing(&self) -> bool {
        self.inner.as_ref().map(|o| o.is_playing()).unwrap_or(false)
    }

    fn stop(&mut self) {
        if let Some(output) = &mut self.inner {
            output.stop();
        }
    }

    fn __repr__(&self) -> String {
        match &self.inner {
            Some(output) => format!(
                "AudioOutput(device='{}', playing={})",
                output.device_name(),
                output.is_playing()
            ),
            None => "AudioOutput(not initialized)".to_string(),
        }
    }
}
