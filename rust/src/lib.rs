pub mod audio;
#[cfg(not(target_arch = "wasm32"))]
pub mod audio_output;
pub mod midi;
#[cfg(not(target_arch = "wasm32"))]
pub mod midi_input;
pub mod mixer;
pub mod oscillator;
pub mod sampler;
pub mod sequencer;

// Re-export core types at crate root for convenience
pub use audio::{AudioBuffer, AudioFormat, ChannelCount, SampleRate};
pub use midi::{
    ControlNumber, MidiChannel, MidiEvent, MidiMessage, Note, Velocity, hz_to_note, note_to_hz,
};
#[cfg(not(target_arch = "wasm32"))]
pub use midi_input::MidiInput;
pub use mixer::{Mixer, MixerChannel};
pub use oscillator::{AudioSource, NoiseSource, SawOscillator, SineOscillator, SquareOscillator};
pub use sampler::{AudioSample, Envelope, SampleMap, SampleMapping, Sampler};
pub use sequencer::{
    EventSequence, NoteEvent, Pattern, Step, StepSequencer, TransportClock, TransportState,
};
