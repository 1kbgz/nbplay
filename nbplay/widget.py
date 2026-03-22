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

    # --- synced traits ---------------------------------------------------
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

    # --- internals -------------------------------------------------------

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

    # --- audio settings ---------------------------------------------------
    sample_rate = traitlets.Int(44100).tag(sync=True)
    channels = traitlets.Int(1).tag(sync=True)
    buffer_size = traitlets.Int(512).tag(sync=True)
    audio_device = traitlets.Unicode("").tag(sync=True)

    # --- MIDI settings ----------------------------------------------------
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


class SequencerWidget(anywidget.AnyWidget):
    """Step sequencer widget with a grid-based pattern editor,
    transport controls, and BPM setting.

    The pattern is synced as a JSON list of step dicts. Each dict has keys:
    ``note``, ``velocity``, ``duration_ticks``, ``active``.
    """

    _esm = _STATIC / "sequencer.js"
    _css = _STATIC / "sequencer.css"

    # Pattern steps: list of dicts {note, velocity, duration_ticks, active}
    steps = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)
    length = traitlets.Int(16).tag(sync=True)
    bpm = traitlets.Float(120.0).tag(sync=True)
    step_duration = traitlets.Float(0.25).tag(sync=True)
    is_playing = traitlets.Bool(False).tag(sync=True)
    current_step = traitlets.Int(-1).tag(sync=True)
    loop_enabled = traitlets.Bool(True).tag(sync=True)

    # Session routing (set by Session to route audio through mixer)
    session_id = traitlets.Unicode("").tag(sync=True)
    channel_index = traitlets.Int(-1).tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.steps:
            self._init_steps()

    def _init_steps(self):
        """Initialise empty step grid."""
        self.steps = [{"note": 60, "velocity": 100, "duration_ticks": 1, "active": False} for _ in range(self.length)]

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

    def to_pattern(self):
        """Create a Rust ``Pattern`` instance from the current state."""
        from nbplay import Pattern as RustPattern, Step as RustStep

        p = RustPattern(self.length)
        for i, s in enumerate(self.steps):
            step = RustStep(s["note"], s["velocity"], s["duration_ticks"])
            step.active = s["active"]
            p.set_step(i, step)
        p.loop_enabled = self.loop_enabled
        return p

    def to_step_sequencer(self, channel=0):
        """Create a Rust ``StepSequencer`` from the current widget state."""
        from nbplay import StepSequencer as RustStepSequencer

        pattern = self.to_pattern()
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
        default_value=[48, 52, 55, 59, 60, 64, 67, 71],
    ).tag(sync=True)

    # Polyphony
    max_voices = traitlets.Int(8).tag(sync=True)

    # Session routing (set by Session to route audio through mixer)
    session_id = traitlets.Unicode("").tag(sync=True)
    channel_index = traitlets.Int(-1).tag(sync=True)

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
            self.mixer.remove_channel(track.mixer_channel)
            # Adjust mixer_channel indices for remaining tracks
            for t in self.tracks:
                if t.mixer_channel > track.mixer_channel:
                    t.mixer_channel -= 1
                    t.sequencer.channel_index -= 1

    def __repr__(self):
        return f"Session(bpm={self.transport.bpm}, tracks={len(self.tracks)}, channels={len(self.mixer.channels)})"
