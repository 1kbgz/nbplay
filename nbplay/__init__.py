__version__ = "0.1.1"

from nbplay.nbplay import (
    AudioBuffer,
    AudioFormat,
    AudioSample,
    Envelope,
    EventSequence,
    MidiChannel,
    MidiEvent,
    MidiMessage,
    Mixer,
    MixerChannel,
    NoiseSource,
    Note,
    NoteEvent,
    Pattern,
    SampleMap,
    SampleMapping,
    Sampler,
    SawOscillator,
    SineOscillator,
    SquareOscillator,
    Step,
    StepSequencer,
    TransportClock,
    Velocity,
)

# Native audio output and MIDI input need cpal/midir; the Pyodide wheel has neither.
try:
    from nbplay.nbplay import AudioOutput, MidiInput
except ImportError:  # pragma: no cover - only on wasm32 builds
    AudioOutput = None
    MidiInput = None

from nbplay.widget import (
    AudioClip,
    EffectPlugin,
    KeyboardRoute,
    KeyboardWidget,
    LauncherWidget,
    MidiKeyboardWidget,
    MixerWidget,
    NoteComposer,
    PadAction,
    PadWidget,
    SamplerWidget,
    SequencerWidget,
    Session,
    SettingsWidget,
    SynthWidget,
    TimelineTrack,
    TimelineWidget,
    Track,
    TransportWidget,
)
