use pyo3::prelude::*;

use nbplay::midi_input::MidiInput as BaseMidiInput;

#[pyclass(name = "MidiInput", unsendable)]
pub struct PyMidiInput {
    inner: Option<BaseMidiInput>,
}

#[pymethods]
impl PyMidiInput {
    #[new]
    #[pyo3(signature = (client_name="nbplay"))]
    fn py_new(client_name: &str) -> PyResult<Self> {
        let input = BaseMidiInput::new(client_name)
            .map_err(|e| pyo3::exceptions::PyRuntimeError::new_err(e))?;
        Ok(PyMidiInput {
            inner: Some(input),
        })
    }

    fn list_ports(&self) -> Vec<String> {
        self.inner
            .as_ref()
            .map(|i| i.list_ports())
            .unwrap_or_default()
    }

    fn __repr__(&self) -> String {
        match &self.inner {
            Some(input) => {
                let ports = input.list_ports();
                format!("MidiInput(ports={})", ports.len())
            }
            None => "MidiInput(connected)".to_string(),
        }
    }
}
