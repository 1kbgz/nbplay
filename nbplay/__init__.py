__version__ = "0.4.0"

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
    TriangleOscillator,
    Velocity,
)

# Native audio output and MIDI input need cpal/midir; the Pyodide wheel has neither.
try:
    from nbplay.nbplay import AudioOutput, MidiInput
except ImportError:  # pragma: no cover - only on wasm32 builds
    AudioOutput = None
    MidiInput = None

from nbplay.descriptors import (
    THEMES,
    AudioClip,
    EffectPlugin,
    KeyboardRoute,
    PadAction,
    TimelineTrack,
)
from nbplay.history import History
from nbplay.midi_learn import MidiLearn
from nbplay.widget import (
    KeyboardWidget,
    LauncherWidget,
    MidiKeyboardWidget,
    MidiOutputWidget,
    MixerWidget,
    PadWidget,
    SamplerWidget,
    SequencerWidget,
    Session,
    SettingsWidget,
    SpectrumWidget,
    SynthWidget,
    TimelineWidget,
    Track,
    TransportWidget,
)
