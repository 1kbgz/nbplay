"""nbplay SynthWidget — an ipywidgets-based synthesizer control panel.

Uses anywidget (built on ipywidgets) so it works in Jupyter Notebook,
JupyterLab, VS Code, and Colab without installing a separate extension.

Waveform preview data is rendered by the Rust backend and sent to the
browser as a binary Float32Array over the widget comm protocol for
low-latency visualisation.  Real-time audio playback uses the Web Audio
API in the browser so latency stays minimal.
"""

from __future__ import annotations

import array
import pathlib
import uuid

import anywidget
import traitlets

from nbplay import (
    NoiseSource,
    SawOscillator,
    SineOscillator,
    SquareOscillator,
)

_STATIC = pathlib.Path(__file__).parent / "static"
_PREVIEW_MAX_FRAMES = 2048


def _default_step():
    return {"note": 60, "velocity": 100, "duration_ticks": 1, "active": False}


def _default_steps(length):
    return [_default_step() for _ in range(length)]


_DEFAULT_PAD_NOTES = [48, 52, 55, 59, 60, 64, 67, 71]


def _measure_beats(time_signature_num, time_signature_den):
    return max(0.0, time_signature_num * (4.0 / max(1, time_signature_den)))


def _step_duration_for_length(length, measures=1, time_signature_num=4, time_signature_den=4):
    length = max(1, int(length))
    measures = max(1, int(measures))
    return max(0.001, (measures * _measure_beats(time_signature_num, time_signature_den)) / length)


def _resize_pad_notes(notes, pad_count):
    pad_count = max(1, int(pad_count))
    resized = [max(0, min(127, int(note))) for note in list(notes)[:pad_count]]
    next_note = resized[-1] + 1 if resized else _DEFAULT_PAD_NOTES[0]
    while len(resized) < pad_count:
        resized.append(max(0, min(127, next_note)))
        next_note += 1
    return resized


class SynthWidget(anywidget.AnyWidget):
    """Interactive synthesizer widget for Jupyter environments.

    Parameters
    ----------
    oscillator_type : str
        One of ``"sine"``, ``"square"``, ``"saw"``, ``"noise"``.
    frequency : float
        Oscillator frequency in Hz (20–8000).
    amplitude : float
        Oscillator amplitude (0.0–1.0).
    sample_rate : int
        Sample rate used for the waveform preview.
    """

    _esm = _STATIC / "widget.js"
    _css = _STATIC / "widget.css"

    oscillator_type = traitlets.Unicode("sine").tag(sync=True)
    frequency = traitlets.Float(440.0).tag(sync=True)
    amplitude = traitlets.Float(0.8).tag(sync=True)
    sample_rate = traitlets.Int(44100).tag(sync=True)
    is_playing = traitlets.Bool(False).tag(sync=True)

    # Binary waveform buffer (Float32Array packed as little-endian bytes).
    # Sent over the widget binary-buffer path for minimal overhead.
    waveform = traitlets.Bytes(b"").tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._update_waveform()
        self.observe(
            self._on_param_change,
            names=["oscillator_type", "frequency", "amplitude", "sample_rate"],
        )

    def _on_param_change(self, change):
        self._update_waveform()

    def _make_oscillator(self):
        t = self.oscillator_type
        if t == "square":
            return SquareOscillator(self.frequency, self.amplitude, self.sample_rate)
        if t == "saw":
            return SawOscillator(self.frequency, self.amplitude, self.sample_rate)
        if t == "noise":
            return NoiseSource(self.amplitude)
        return SineOscillator(self.frequency, self.amplitude, self.sample_rate)

    def _update_waveform(self):
        """Re-render the waveform preview via the Rust oscillator and push
        the result as a binary Float32Array to the frontend."""
        osc = self._make_oscillator()

        if self.oscillator_type == "noise":
            frames = 1024
        else:
            # Show ~3 full cycles so the shape is always clearly visible.
            cycles = 3
            frames_per_cycle = self.sample_rate / max(self.frequency, 1.0)
            frames = max(256, min(_PREVIEW_MAX_FRAMES, int(frames_per_cycle * cycles)))

        samples = osc.render_to_buffer(frames)

        # Pack as little-endian float32 — arrives as an ArrayBuffer in JS.
        buf = array.array("f", samples)
        self.waveform = buf.tobytes()


class SettingsWidget(anywidget.AnyWidget):
    """Audio / MIDI configuration widget for Jupyter environments.

    Exposes sample rate, channel count, and buffer size selectors for the
    audio output, and a Web MIDI port selector with a live activity monitor.
    """

    _esm = _STATIC / "settings.js"
    _css = _STATIC / "settings.css"

    sample_rate = traitlets.Int(44100).tag(sync=True)
    channels = traitlets.Int(1).tag(sync=True)
    buffer_size = traitlets.Int(512).tag(sync=True)
    audio_device = traitlets.Unicode("").tag(sync=True)

    midi_port = traitlets.Unicode("").tag(sync=True)
    available_midi_ports = traitlets.List(traitlets.Unicode(), []).tag(sync=True)

    # Raw MIDI event bytes (timestamp f64 LE + MIDI bytes) from frontend.
    midi_event = traitlets.Bytes(b"").tag(sync=True)


class MixerWidget(anywidget.AnyWidget):
    """Mixer console widget with per-channel faders, pan, mute/solo,
    and a master output fader.

    Channels are synced as a JSON list of dicts. Each dict has keys:
    ``name``, ``gain``, ``pan``, ``mute``, ``solo``.

    The ``Mixer`` Rust/Python object can be used for offline rendering
    via ``mix_down()``; this widget provides the interactive UI.
    """

    _esm = _STATIC / "mixer.js"
    _css = _STATIC / "mixer.css"

    # JSON-serialized list of channel dicts
    channels = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)
    master_gain = traitlets.Float(0.8).tag(sync=True)

    # Session routing (set by Session to enable shared AudioContext)
    session_id = traitlets.Unicode("").tag(sync=True)

    def add_channel(self, name="Channel"):
        """Add a new channel strip and return its index."""
        ch = {"name": name, "gain": 0.8, "pan": 0.0, "mute": False, "solo": False}
        self.channels = [*self.channels, ch]
        return len(self.channels) - 1

    def remove_channel(self, index):
        """Remove a channel by index."""
        chs = list(self.channels)
        if 0 <= index < len(chs):
            chs.pop(index)
            self.channels = chs

    def set_channel_gain(self, index, gain):
        chs = list(self.channels)
        if 0 <= index < len(chs):
            chs[index] = {**chs[index], "gain": max(0.0, min(2.0, gain))}
            self.channels = chs

    def set_channel_pan(self, index, pan):
        chs = list(self.channels)
        if 0 <= index < len(chs):
            chs[index] = {**chs[index], "pan": max(-1.0, min(1.0, pan))}
            self.channels = chs

    def set_channel_mute(self, index, mute):
        chs = list(self.channels)
        if 0 <= index < len(chs):
            chs[index] = {**chs[index], "mute": bool(mute)}
            self.channels = chs

    def set_channel_solo(self, index, solo):
        chs = list(self.channels)
        if 0 <= index < len(chs):
            chs[index] = {**chs[index], "solo": bool(solo)}
            self.channels = chs

    def to_mixer(self):
        """Create a Rust ``Mixer`` instance matching the current widget state."""
        from nbplay import Mixer as RustMixer

        m = RustMixer()
        for ch in self.channels:
            idx = m.add_channel(ch.get("name", "Channel"))
            m.set_channel_gain(idx, ch.get("gain", 0.8))
            m.set_channel_pan(idx, ch.get("pan", 0.0))
            m.set_channel_mute(idx, ch.get("mute", False))
            m.set_channel_solo(idx, ch.get("solo", False))
        m.master_gain = self.master_gain
        return m


class NoteComposer(traitlets.HasTraits):
    """A single voice's per-step note/velocity/duration assignments.

    This is a lightweight traitlets object (not a rendered widget).
    A monophonic sequencer has one NoteComposer; a polyphonic sequencer
    has N NoteComposers sharing the same step clock.

    Parameters
    ----------
    length : int
        Number of steps.
    """

    steps = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)

    def __init__(self, length=16, **kwargs):
        super().__init__(**kwargs)
        self._length = length
        if not self.steps:
            self.steps = _default_steps(length)

    def resize(self, length):
        """Resize the step list, preserving existing steps where possible."""
        length = max(1, int(length))
        current = [dict(step) for step in self.steps]
        if len(current) < length:
            current.extend(_default_steps(length - len(current)))
        else:
            current = current[:length]
        self._length = length
        self.steps = current

    def set_step(self, index, note=60, velocity=100, duration_ticks=1, active=True):
        """Set a step at the given index."""
        steps = list(self.steps)
        if 0 <= index < len(steps):
            steps[index] = {
                "note": note,
                "velocity": velocity,
                "duration_ticks": duration_ticks,
                "active": active,
            }
            self.steps = steps

    def toggle_step(self, index):
        """Toggle the active state of a step."""
        steps = list(self.steps)
        if 0 <= index < len(steps):
            steps[index] = {**steps[index], "active": not steps[index]["active"]}
            self.steps = steps

    def clear(self):
        """Deactivate all steps."""
        self.steps = [{**s, "active": False} for s in self.steps]

    def to_pattern(self, loop_enabled=True):
        """Create a Rust ``Pattern`` instance from the current state."""
        from nbplay import Pattern as RustPattern, Step as RustStep

        p = RustPattern(len(self.steps))
        for i, s in enumerate(self.steps):
            step = RustStep(s["note"], s["velocity"], s["duration_ticks"])
            step.active = s["active"]
            p.set_step(i, step)
        p.loop_enabled = loop_enabled
        return p

    def __repr__(self):
        active = sum(1 for s in self.steps if s["active"])
        return f"NoteComposer(length={len(self.steps)}, active={active})"


class SequencerWidget(anywidget.AnyWidget):
    """Step sequencer widget with a grid-based pattern editor,
    transport controls, and BPM setting.

    Supports monophonic (default, ``num_voices=1``) and polyphonic
    (``num_voices=N``) modes.  In monophonic mode, the API is fully
    backward-compatible with the original single-voice sequencer.

    Internally, each voice is a ``NoteComposer`` instance.  The ``steps``
    property is a convenience alias for ``voices[0].steps``.
    """

    _esm = _STATIC / "sequencer.js"
    _css = _STATIC / "sequencer.css"

    # Timing / transport (the "SequencerBase" concerns)
    length = traitlets.Int(16).tag(sync=True)
    measures = traitlets.Int(1).tag(sync=True)
    time_signature_num = traitlets.Int(4).tag(sync=True)
    time_signature_den = traitlets.Int(4).tag(sync=True)
    bpm = traitlets.Float(120.0).tag(sync=True)
    step_duration = traitlets.Float(0.25).tag(sync=True)
    is_playing = traitlets.Bool(False).tag(sync=True)
    current_step = traitlets.Int(-1).tag(sync=True)
    loop_enabled = traitlets.Bool(True).tag(sync=True)
    num_voices = traitlets.Int(1).tag(sync=True)

    # Session routing (set by Session to route audio through mixer)
    session_id = traitlets.Unicode("").tag(sync=True)
    channel_index = traitlets.Int(-1).tag(sync=True)

    # Keyboard integration — set by KeyboardWidget.connect_sequencer()
    keyboard_connected = traitlets.Bool(False).tag(sync=True)

    # All voices' step data, synced to browser as list-of-lists.
    # voices_data[i] == composers[i].steps
    voices_data = traitlets.List(
        trait=traitlets.List(trait=traitlets.Dict()),
        default_value=[],
    ).tag(sync=True)

    def __init__(self, **kwargs):
        num_voices = kwargs.pop("num_voices", 1)
        explicit_length = "length" in kwargs
        explicit_step_duration = "step_duration" in kwargs
        length = kwargs.get("length", 16)
        if explicit_length and not explicit_step_duration:
            kwargs["step_duration"] = _step_duration_for_length(
                length,
                kwargs.get("measures", 1),
                kwargs.get("time_signature_num", 4),
                kwargs.get("time_signature_den", 4),
            )
        super().__init__(num_voices=num_voices, **kwargs)
        self._composers = [NoteComposer(length=length) for _ in range(num_voices)]
        self._syncing = False
        self._configuring_grid = False
        for i, c in enumerate(self._composers):
            c.observe(self._on_composer_change, names=["steps"])
        self.observe(self._on_voices_data_change, names=["voices_data"])
        self.observe(self._on_length_change, names=["length"])
        self.observe(
            self._on_grid_config_change,
            names=["measures", "step_duration", "time_signature_num", "time_signature_den"],
        )
        self._sync_voices_data()

    def _on_composer_change(self, change):
        """Keep voices_data in sync when any composer's steps change."""
        if not self._syncing:
            self._syncing = True
            try:
                self._sync_voices_data()
            finally:
                self._syncing = False

    def _on_voices_data_change(self, change):
        """When voices_data is set from the browser, update composers."""
        if not self._syncing:
            self._syncing = True
            try:
                for i, c in enumerate(self._composers):
                    if i < len(self.voices_data):
                        c.steps = list(self.voices_data[i])
                if self.voices_data and len(self.voices_data[0]) != self.length:
                    self.length = len(self.voices_data[0])
            finally:
                self._syncing = False

    def _sync_voices_data(self):
        """Push all composer step-lists into the synced voices_data trait."""
        self.voices_data = [list(c.steps) for c in self._composers]

    def _measure_beats(self):
        return _measure_beats(self.time_signature_num, self.time_signature_den)

    def _configured_length(self):
        step_duration = max(0.001, float(self.step_duration))
        measures = max(1, int(self.measures))
        return max(1, int(round((measures * self._measure_beats()) / step_duration)))

    def _resize_composers(self, length):
        for composer in self._composers:
            composer.resize(length)
        self._sync_voices_data()

    def _on_length_change(self, change):
        length = max(1, int(change["new"]))
        if length != change["new"]:
            self.length = length
            return
        self._resize_composers(length)

    def _on_grid_config_change(self, change):
        if self._configuring_grid:
            return
        self.configure_grid()

    def configure_grid(self, measures=None, step_duration=None):
        """Configure pattern length from measure count and musical step duration.

        ``step_duration`` is measured in quarter-note beats. In 4/4, ``0.5``
        produces eighth-note steps and ``0.25`` produces sixteenth-note steps.
        """
        self._configuring_grid = True
        try:
            if measures is not None:
                self.measures = max(1, int(measures))
            if step_duration is not None:
                self.step_duration = max(0.001, float(step_duration))
        finally:
            self._configuring_grid = False

        length = self._configured_length()
        if self.length != length:
            self.length = length
        else:
            self._resize_composers(length)

    #  Voice accessors

    @property
    def composers(self):
        """List of ``NoteComposer`` objects, one per voice."""
        return list(self._composers)

    @property
    def voices(self):
        """Alias for ``composers``."""
        return self.composers

    #  Backward-compatible steps property (voice 0)

    @property
    def steps(self):
        """Steps for voice 0 (backward-compatible with monophonic API)."""
        return self._composers[0].steps

    @steps.setter
    def steps(self, value):
        self._composers[0].steps = value

    #  Step manipulation (voice-aware)

    def set_step(self, index, note=60, velocity=100, duration_ticks=1, active=True, voice=0):
        """Set a step at the given index on the given voice."""
        if 0 <= voice < len(self._composers):
            self._composers[voice].set_step(index, note, velocity, duration_ticks, active)

    def toggle_step(self, index, voice=0):
        """Toggle the active state of a step on the given voice."""
        if 0 <= voice < len(self._composers):
            self._composers[voice].toggle_step(index)

    def clear(self):
        """Deactivate all steps across all voices."""
        for c in self._composers:
            c.clear()

    def to_pattern(self, voice=0):
        """Create a Rust ``Pattern`` instance from the given voice."""
        if 0 <= voice < len(self._composers):
            return self._composers[voice].to_pattern(loop_enabled=self.loop_enabled)
        return None

    def to_step_sequencer(self, channel=0, voice=0):
        """Create a Rust ``StepSequencer`` from the given voice."""
        from nbplay import StepSequencer as RustStepSequencer

        pattern = self.to_pattern(voice=voice)
        if pattern is None:
            return None
        seq = RustStepSequencer(pattern, channel)
        seq.step_duration = self.step_duration
        return seq


class SamplerWidget(anywidget.AnyWidget):
    """Sampler widget showing loaded sample info, envelope controls,
    and a waveform display.

    The sample data is synced as binary Float32Array bytes for waveform
    visualisation. Envelope parameters are synced as individual traits.
    """

    _esm = _STATIC / "sampler.js"
    _css = _STATIC / "sampler.css"

    # Sample info
    sample_name = traitlets.Unicode("(no sample)").tag(sync=True)
    sample_rate = traitlets.Int(44100).tag(sync=True)
    root_note = traitlets.Int(69).tag(sync=True)
    sample_length = traitlets.Int(0).tag(sync=True)

    # Waveform display data (decimated Float32Array)
    waveform = traitlets.Bytes(b"").tag(sync=True)

    # Envelope (ADSR)
    attack = traitlets.Float(0.005).tag(sync=True)
    decay = traitlets.Float(0.1).tag(sync=True)
    sustain = traitlets.Float(0.8).tag(sync=True)
    release = traitlets.Float(0.1).tag(sync=True)

    # Trigger pad notes (MIDI note numbers)
    pad_notes = traitlets.List(
        trait=traitlets.Int(),
        default_value=_DEFAULT_PAD_NOTES,
    ).tag(sync=True)
    pad_count = traitlets.Int(8).tag(sync=True)

    # Polyphony
    max_voices = traitlets.Int(8).tag(sync=True)

    # Session routing (set by Session to route audio through mixer)
    session_id = traitlets.Unicode("").tag(sync=True)
    channel_index = traitlets.Int(-1).tag(sync=True)

    # Keyboard integration — set by KeyboardWidget.connect_sampler()
    keyboard_connected = traitlets.Bool(False).tag(sync=True)

    def __init__(self, **kwargs):
        explicit_pad_notes = "pad_notes" in kwargs
        explicit_pad_count = "pad_count" in kwargs
        if explicit_pad_notes and not explicit_pad_count:
            kwargs["pad_count"] = max(1, len(kwargs["pad_notes"]))
        super().__init__(**kwargs)
        self._syncing_pads = False
        self.pad_notes = _resize_pad_notes(self.pad_notes, self.pad_count)
        self.observe(self._on_pad_count_change, names=["pad_count"])
        self.observe(self._on_pad_notes_change, names=["pad_notes"])

    def _on_pad_count_change(self, change):
        if self._syncing_pads:
            return
        pad_count = max(1, int(change["new"]))
        if pad_count != change["new"]:
            self.pad_count = pad_count
            return
        self._syncing_pads = True
        try:
            self.pad_notes = _resize_pad_notes(self.pad_notes, pad_count)
        finally:
            self._syncing_pads = False

    def _on_pad_notes_change(self, change):
        if self._syncing_pads:
            return
        notes = _resize_pad_notes(change["new"], max(1, len(change["new"])))
        self._syncing_pads = True
        try:
            if notes != self.pad_notes:
                self.pad_notes = notes
            self.pad_count = len(notes)
        finally:
            self._syncing_pads = False

    def configure_pads(self, pad_count=None, pad_notes=None):
        """Configure the number of sampler trigger pads, preserving notes."""
        if pad_notes is not None:
            notes = _resize_pad_notes(pad_notes, max(1, len(pad_notes)))
            self.pad_notes = notes
            if pad_count is None:
                self.pad_count = len(notes)
        if pad_count is not None:
            self.pad_count = max(1, int(pad_count))

    def load_sample(self, data, sample_rate=44100, root_note=69, name="Sample"):
        """Load sample PCM data (list of floats) into the widget."""
        self.sample_name = name
        self.sample_rate = sample_rate
        self.root_note = root_note
        self.sample_length = len(data)

        # Decimate for waveform display (max 2048 points)
        max_points = 2048
        if len(data) > max_points:
            step = len(data) / max_points
            decimated = [data[int(i * step)] for i in range(max_points)]
        else:
            decimated = list(data)

        buf = array.array("f", decimated)
        self.waveform = buf.tobytes()

    def to_sampler(self):
        """Create a Rust ``Sampler`` from the current widget state."""
        from nbplay import AudioSample, Envelope, Sampler

        # Re-create sample from stored waveform (display copy)
        # For real usage, users should create the Sampler directly
        # with their original sample data. This is a convenience bridge.
        sample = AudioSample([], self.sample_rate, self.root_note)
        env = Envelope(self.attack, self.decay, self.sustain, self.release)
        s = Sampler(sample, self.sample_rate, self.max_voices)
        s.set_envelope(env)
        return s


class TransportWidget(anywidget.AnyWidget):
    """Global transport controls — play/stop, BPM, time signature, bar/beat counter.

    Used as the master clock for a Session.  All connected SequencerWidgets
    sync their BPM and play state to this transport via ``traitlets.link``.
    """

    _esm = _STATIC / "transport.js"
    _css = _STATIC / "transport.css"

    # Transport state
    bpm = traitlets.Float(120.0).tag(sync=True)
    is_playing = traitlets.Bool(False).tag(sync=True)

    # Time signature
    time_signature_num = traitlets.Int(4).tag(sync=True)
    time_signature_den = traitlets.Int(4).tag(sync=True)

    # Position (updated by browser-side clock)
    bar_number = traitlets.Int(0).tag(sync=True)
    beat_in_bar = traitlets.Int(0).tag(sync=True)

    # Loop
    loop_enabled = traitlets.Bool(False).tag(sync=True)
    loop_start_bar = traitlets.Int(0).tag(sync=True)
    loop_end_bar = traitlets.Int(4).tag(sync=True)


class KeyboardWidget(anywidget.AnyWidget):
    """Musical typing keyboard widget (Logic Pro style).

    4-row QWERTY layout across two independent octave halves.
    Triggers audio via Web Audio, emits note events for sequencer
    recording and sampler triggering.

    Key mapping:
        Upper: 2 3 _ 5 6 7 _ 9 0 (sharps) / Q W E R T Y U I O P (naturals)
        Lower: A S _ F G H _ K L (sharps) / Z X C V B N M , . (naturals)
        [ ] octave shift upper, ; ' octave shift lower
        - = velocity down/up (hold to accelerate)
        ` sustain upper, / sustain lower, Space global sustain
    """

    _esm = _STATIC / "keyboard.js"
    _css = _STATIC / "keyboard.css"

    upper_octave = traitlets.Int(3).tag(sync=True)
    lower_octave = traitlets.Int(4).tag(sync=True)
    velocity = traitlets.Int(100).tag(sync=True)
    active_notes = traitlets.List(trait=traitlets.Int(), default_value=[]).tag(sync=True)
    sustain_upper = traitlets.Bool(False).tag(sync=True)
    sustain_lower = traitlets.Bool(False).tag(sync=True)
    sustain_global = traitlets.Bool(False).tag(sync=True)
    last_note_event = traitlets.Dict(default_value={}).tag(sync=True)

    # Session routing
    session_id = traitlets.Unicode("").tag(sync=True)
    channel_index = traitlets.Int(-1).tag(sync=True)

    # Sampler routing: list of {channel_index, zone} dicts
    sampler_routing = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)

    # Internal references (not synced)
    _connected_sequencers = []
    _connected_samplers = []

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._connected_sequencers = []
        self._connected_samplers = []

    def connect_sequencer(self, sequencer):
        """Link this keyboard to a sequencer for recording and note input."""
        if sequencer not in self._connected_sequencers:
            self._connected_sequencers.append(sequencer)
            sequencer.keyboard_connected = True

    def disconnect_sequencer(self, sequencer):
        """Unlink this keyboard from a sequencer."""
        if sequencer in self._connected_sequencers:
            self._connected_sequencers.remove(sequencer)
            sequencer.keyboard_connected = False

    def connect_sampler(self, sampler, zone="all"):
        """Connect a sampler to the keyboard.

        Parameters
        ----------
        sampler : SamplerWidget
            The sampler to connect.
        zone : str
            ``"all"`` (whole keyboard), ``"upper"`` (QWERTY rows),
            or ``"lower"`` (ZXCV rows).
        """
        if sampler not in self._connected_samplers:
            self._connected_samplers.append(sampler)
            sampler.keyboard_connected = True
        routing = list(self.sampler_routing)
        entry = {"channel_index": sampler.channel_index, "zone": zone}
        # Avoid duplicate entries for the same channel
        routing = [r for r in routing if r.get("channel_index") != sampler.channel_index]
        routing.append(entry)
        self.sampler_routing = routing

    def disconnect_sampler(self, sampler):
        """Disconnect a sampler from the keyboard."""
        if sampler in self._connected_samplers:
            self._connected_samplers.remove(sampler)
            sampler.keyboard_connected = False
            routing = [r for r in self.sampler_routing if r.get("channel_index") != sampler.channel_index]
            self.sampler_routing = routing


class MidiKeyboardWidget(KeyboardWidget):
    """Browser Web MIDI keyboard input widget.

    Uses the same sequencer and sampler connection API as ``KeyboardWidget``,
    but receives note events from a selected browser MIDI input device.
    """

    _esm = _STATIC / "midi_keyboard.js"
    _css = _STATIC / "midi_keyboard.css"

    midi_port = traitlets.Unicode("").tag(sync=True)
    available_midi_ports = traitlets.List(traitlets.Unicode(), []).tag(sync=True)


class Track:
    """Binds a sequencer to a sound source and a mixer channel.

    Uses ``traitlets.link()`` to propagate BPM and play state from the
    Session's transport to the sequencer.
    """

    def __init__(self, name, sequencer, sound_source, mixer_channel):
        self.name = name
        self.sequencer = sequencer
        self.sound_source = sound_source
        self.mixer_channel = mixer_channel
        self._links = []

    def _link_transport(self, transport):
        """Link this track's sequencer BPM and play state to the transport.

        BPM is bidirectional so editing BPM on either widget stays in
        sync.  ``is_playing`` is one-directional (transport → sequencer)
        so that a single sequencer reaching its end (non-loop) does not
        propagate ``is_playing=False`` back to the transport and stop
        every other sequencer.
        """
        self._links.append(traitlets.link((transport, "bpm"), (self.sequencer, "bpm")))
        self._links.append(traitlets.link((transport, "time_signature_num"), (self.sequencer, "time_signature_num")))
        self._links.append(traitlets.link((transport, "time_signature_den"), (self.sequencer, "time_signature_den")))
        self._links.append(traitlets.dlink((transport, "is_playing"), (self.sequencer, "is_playing")))

    def _unlink(self):
        """Remove all traitlets links."""
        for lnk in self._links:
            lnk.unlink()
        self._links.clear()

    def __repr__(self):
        src_type = type(self.sound_source).__name__
        return f"Track({self.name!r}, ch={self.mixer_channel}, source={src_type})"


class Session:
    """A collection of tracks with a shared transport and mixer.

    Manages ``traitlets.link`` connections between the transport and all
    track sequencers, and assigns mixer channels for audio routing.
    """

    def __init__(self, bpm=120.0, time_signature=(4, 4)):
        self._session_id = f"nbplay-{uuid.uuid4().hex[:8]}"
        self.transport = TransportWidget(
            bpm=bpm,
            time_signature_num=time_signature[0],
            time_signature_den=time_signature[1],
        )
        self.mixer = MixerWidget(session_id=self._session_id)
        self.tracks = []

    def add_track(self, name, sequencer, sound_source):
        """Add a track, create a mixer channel, and link transport state.

        Returns the new ``Track`` object.
        """
        channel_idx = self.mixer.add_channel(name)
        track = Track(name, sequencer, sound_source, channel_idx)
        track._link_transport(self.transport)
        # Set audio routing metadata so JS can route through mixer
        sequencer.session_id = self._session_id
        sequencer.channel_index = channel_idx
        # Also set routing on sound source (e.g. SamplerWidget) so it
        # can register on the session bus for keyboard integration.
        if hasattr(sound_source, "session_id"):
            sound_source.session_id = self._session_id
        if hasattr(sound_source, "channel_index"):
            sound_source.channel_index = channel_idx
        self.tracks.append(track)
        return track

    def remove_track(self, index):
        """Remove a track by index, unlinking transport and removing mixer channel."""
        if 0 <= index < len(self.tracks):
            track = self.tracks.pop(index)
            track._unlink()
            # Clear routing metadata
            track.sequencer.session_id = ""
            track.sequencer.channel_index = -1
            if hasattr(track.sound_source, "session_id"):
                track.sound_source.session_id = ""
            if hasattr(track.sound_source, "channel_index"):
                track.sound_source.channel_index = -1
            self.mixer.remove_channel(track.mixer_channel)
            # Adjust mixer_channel indices for remaining tracks
            for t in self.tracks:
                if t.mixer_channel > track.mixer_channel:
                    t.mixer_channel -= 1
                    t.sequencer.channel_index -= 1
                    if hasattr(t.sound_source, "channel_index"):
                        t.sound_source.channel_index -= 1

    def __repr__(self):
        return f"Session(bpm={self.transport.bpm}, tracks={len(self.tracks)}, channels={len(self.mixer.channels)})"
