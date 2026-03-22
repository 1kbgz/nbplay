use pyo3::prelude::*;

use nbplay::midi::{
    hz_to_note, note_to_hz, ControlNumber, MidiChannel, MidiEvent as BaseMidiEvent,
    MidiMessage as BaseMidiMessage, Note, Velocity,
};

#[pyclass(name = "MidiChannel", from_py_object)]
#[derive(Clone)]
pub struct PyMidiChannel {
    pub inner: MidiChannel,
}

#[pymethods]
impl PyMidiChannel {
    #[new]
    fn py_new(value: u8) -> PyResult<Self> {
        MidiChannel::new(value)
            .map(|ch| PyMidiChannel { inner: ch })
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
    }

    #[getter]
    fn value(&self) -> u8 {
        self.inner.value()
    }

    fn __repr__(&self) -> String {
        format!("MidiChannel({})", self.inner.value())
    }

    fn __str__(&self) -> String {
        format!("{}", self.inner.value())
    }

    fn __eq__(&self, other: &PyMidiChannel) -> bool {
        self.inner == other.inner
    }
}

#[pyclass(name = "Note", from_py_object)]
#[derive(Clone)]
pub struct PyNote {
    pub inner: Note,
}

#[pymethods]
impl PyNote {
    #[new]
    fn py_new(value: u8) -> PyResult<Self> {
        Note::new(value)
            .map(|n| PyNote { inner: n })
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
    }

    #[getter]
    fn value(&self) -> u8 {
        self.inner.value()
    }

    fn to_hz(&self) -> f64 {
        note_to_hz(self.inner.value())
    }

    #[staticmethod]
    fn from_hz(hz: f64) -> PyResult<Self> {
        let note_num = hz_to_note(hz);
        Note::new(note_num)
            .map(|n| PyNote { inner: n })
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
    }

    fn __repr__(&self) -> String {
        format!("Note({})", self.inner.value())
    }

    fn __str__(&self) -> String {
        format!("{}", self.inner.value())
    }

    fn __eq__(&self, other: &PyNote) -> bool {
        self.inner == other.inner
    }
}

#[pyclass(name = "Velocity", from_py_object)]
#[derive(Clone)]
pub struct PyVelocity {
    pub inner: Velocity,
}

#[pymethods]
impl PyVelocity {
    #[new]
    fn py_new(value: u8) -> PyResult<Self> {
        Velocity::new(value)
            .map(|v| PyVelocity { inner: v })
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
    }

    #[getter]
    fn value(&self) -> u8 {
        self.inner.value()
    }

    fn __repr__(&self) -> String {
        format!("Velocity({})", self.inner.value())
    }

    fn __str__(&self) -> String {
        format!("{}", self.inner.value())
    }

    fn __eq__(&self, other: &PyVelocity) -> bool {
        self.inner == other.inner
    }
}

#[pyclass(name = "MidiMessage", from_py_object)]
#[derive(Clone)]
pub struct PyMidiMessage {
    pub inner: BaseMidiMessage,
}

#[pymethods]
impl PyMidiMessage {
    #[staticmethod]
    fn note_on(channel: u8, note: u8, velocity: u8) -> PyResult<Self> {
        let ch =
            MidiChannel::new(channel).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let n = Note::new(note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let v = Velocity::new(velocity).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(PyMidiMessage {
            inner: BaseMidiMessage::NoteOn {
                channel: ch,
                note: n,
                velocity: v,
            },
        })
    }

    #[staticmethod]
    fn note_off(channel: u8, note: u8, velocity: u8) -> PyResult<Self> {
        let ch =
            MidiChannel::new(channel).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let n = Note::new(note).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let v = Velocity::new(velocity).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(PyMidiMessage {
            inner: BaseMidiMessage::NoteOff {
                channel: ch,
                note: n,
                velocity: v,
            },
        })
    }

    #[staticmethod]
    fn control_change(channel: u8, control: u8, value: u8) -> PyResult<Self> {
        let ch =
            MidiChannel::new(channel).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        let ctrl =
            ControlNumber::new(control).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(PyMidiMessage {
            inner: BaseMidiMessage::ControlChange {
                channel: ch,
                control: ctrl,
                value,
            },
        })
    }

    #[staticmethod]
    fn program_change(channel: u8, program: u8) -> PyResult<Self> {
        let ch =
            MidiChannel::new(channel).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(PyMidiMessage {
            inner: BaseMidiMessage::ProgramChange {
                channel: ch,
                program,
            },
        })
    }

    #[staticmethod]
    fn pitch_bend(channel: u8, value: u16) -> PyResult<Self> {
        let ch =
            MidiChannel::new(channel).map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
        Ok(PyMidiMessage {
            inner: BaseMidiMessage::PitchBend { channel: ch, value },
        })
    }

    #[staticmethod]
    fn clock() -> Self {
        PyMidiMessage {
            inner: BaseMidiMessage::Clock,
        }
    }

    #[staticmethod]
    fn start() -> Self {
        PyMidiMessage {
            inner: BaseMidiMessage::Start,
        }
    }

    #[staticmethod]
    fn stop() -> Self {
        PyMidiMessage {
            inner: BaseMidiMessage::Stop,
        }
    }

    fn __repr__(&self) -> String {
        format!("MidiMessage({:?})", self.inner)
    }

    fn __str__(&self) -> String {
        format!("{:?}", self.inner)
    }

    fn __eq__(&self, other: &PyMidiMessage) -> bool {
        self.inner == other.inner
    }
}

#[pyclass(name = "MidiEvent", from_py_object)]
#[derive(Clone)]
pub struct PyMidiEvent {
    pub inner: BaseMidiEvent,
}

#[pymethods]
impl PyMidiEvent {
    #[new]
    fn py_new(message: &PyMidiMessage, timestamp_us: u64) -> Self {
        PyMidiEvent {
            inner: BaseMidiEvent::new(message.inner.clone(), timestamp_us),
        }
    }

    #[getter]
    fn message(&self) -> PyMidiMessage {
        PyMidiMessage {
            inner: self.inner.message.clone(),
        }
    }

    #[getter]
    fn timestamp_us(&self) -> u64 {
        self.inner.timestamp_us
    }

    fn __repr__(&self) -> String {
        format!(
            "MidiEvent({:?}, timestamp_us={})",
            self.inner.message, self.inner.timestamp_us
        )
    }
}
