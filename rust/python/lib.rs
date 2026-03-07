use pyo3::prelude::*;

mod audio;
mod midi;
mod mixer;
mod oscillator;
mod sampler;
mod sequencer;
mod audio_output;
mod midi_input;

#[pymodule]
fn nbplay(_py: Python, m: &Bound<PyModule>) -> PyResult<()> {
    // Audio types
    m.add_class::<audio::PyAudioFormat>()?;
    m.add_class::<audio::PyAudioBuffer>()?;

    // MIDI types
    m.add_class::<midi::PyMidiChannel>()?;
    m.add_class::<midi::PyNote>()?;
    m.add_class::<midi::PyVelocity>()?;
    m.add_class::<midi::PyMidiMessage>()?;
    m.add_class::<midi::PyMidiEvent>()?;

    // Oscillators
    m.add_class::<oscillator::PySineOscillator>()?;
    m.add_class::<oscillator::PySquareOscillator>()?;
    m.add_class::<oscillator::PySawOscillator>()?;
    m.add_class::<oscillator::PyNoiseSource>()?;

    // Mixer
    m.add_class::<mixer::PyMixerChannel>()?;
    m.add_class::<mixer::PyMixer>()?;

    // Sequencer
    m.add_class::<sequencer::PyStep>()?;
    m.add_class::<sequencer::PyPattern>()?;
    m.add_class::<sequencer::PyNoteEvent>()?;
    m.add_class::<sequencer::PyEventSequence>()?;
    m.add_class::<sequencer::PyTransportClock>()?;
    m.add_class::<sequencer::PyStepSequencer>()?;

    // Sampler
    m.add_class::<sampler::PyAudioSample>()?;
    m.add_class::<sampler::PyEnvelope>()?;
    m.add_class::<sampler::PySampleMapping>()?;
    m.add_class::<sampler::PySampleMap>()?;
    m.add_class::<sampler::PySampler>()?;

    // Audio output
    m.add_class::<audio_output::PyAudioOutput>()?;

    // MIDI input
    m.add_class::<midi_input::PyMidiInput>()?;

    Ok(())
}
