"""Views: nbplay instruments on transports models, rendered by spaday.

A view hosts a config model (kernel-owned, validated) and a status model
(browser-owned) in a :class:`transports.Session`, and renders the instrument
element with spaday bindings: config fields bind two-way on ``nbplay-set``,
status fields two-way on ``nbplay-status``, and an ``nbplay-wire`` child
delivers ``session.command`` calls to the element. This is the parallel
layer to the traitlets widgets in :mod:`nbplay.widget`; it needs
``spaday[widget]`` with notebook session support and ``transports`` 0.12.
"""

import inspect
from typing import ClassVar

import transports
from pydantic import BaseModel
from spaday import Widget, element

from .models import (
    KeyboardConfig,
    KeyboardStatus,
    MidiKeyboardConfig,
    MidiKeyboardStatus,
    MidiOutputConfig,
    MidiOutputStatus,
    MixerConfig,
    PadsConfig,
    PadsStatus,
    SamplerConfig,
    SamplerStatus,
    SequencerConfig,
    SequencerStatus,
    SettingsConfig,
    SettingsStatus,
    SynthConfig,
    SynthStatus,
    TransportConfig,
    TransportStatus,
)
from .widget import (
    _clamp_int,
    _clamp_midi_note,
    _clamp_velocity,
    _decimate_samples,
    _normalize_effect,
    _normalize_zone,
    _pack_float32,
)

if "session" not in inspect.signature(Widget.__init__).parameters:
    raise ImportError("nbplay.views needs a spaday release with Widget(session=...) support")

__all__ = (
    "PACKAGE",
    "InstrumentView",
    "KeyboardView",
    "MidiKeyboardView",
    "MidiOutputView",
    "MixerView",
    "PadsView",
    "SamplerView",
    "SequencerView",
    "SettingsView",
    "SynthView",
    "TransportView",
)

PACKAGE = "nbplay.components:package"


class InstrumentView(Widget):
    """One instrument element on a config model and, usually, a status model.

    Subclasses set ``TAG``, the model classes, and the trait-to-property
    maps; an instrument with no browser-owned state leaves ``STATUS_MODEL``
    as ``None``. Keyword arguments that name config fields initialise the
    config; the rest go to :class:`spaday.Widget`.
    """

    TAG: ClassVar[str]
    CONFIG_MODEL: ClassVar[type[BaseModel]]
    STATUS_MODEL: ClassVar[type[BaseModel] | None] = None
    CONFIG: ClassVar[dict[str, str]]
    STATUS: ClassVar[dict[str, str]] = {}

    def __init__(self, session=None, *, config=None, **kwargs):
        fields = {name: kwargs.pop(name) for name in list(kwargs) if name in self.CONFIG_MODEL.model_fields}
        self.config = config if config is not None else self.CONFIG_MODEL(**fields)
        self.status = self.STATUS_MODEL() if self.STATUS_MODEL is not None else None
        self.session = session if session is not None else transports.Session()
        self._prepare()
        self.config_id = self.session.host(self.config)
        # Plain wire mappings: the released Wire requires a websocket url.
        wires = [{"model": self.config_id, "namespace": "config"}]
        node = element(self.TAG)
        for name, prop in self.CONFIG.items():
            node.bind(prop, f"config.{name}", mode="two-way", event="nbplay-set")
        self.status_id = None
        if self.status is not None:
            self.status_id = self.session.host(self.status, owner="client")
            wires.append({"model": self.status_id, "namespace": "status"})
            node.child(element("nbplay-wire", namespace="status"))
            for name, prop in self.STATUS.items():
                node.bind(prop, f"status.{name}", mode="two-way", event="nbplay-status")
        super().__init__(node, session=self.session, wires=wires, packages=PACKAGE, **kwargs)

    def _prepare(self):
        """Hook run after the models exist and before they are hosted."""

    def _command(self, field, value):
        if self.status_id is None:
            raise TypeError(f"{type(self).__name__} has no browser-owned status to command")
        return self.session.command(self.status_id, field, value)


class TransportView(InstrumentView):
    """The transport instrument on a transports session."""

    TAG = "nbplay-transport"
    CONFIG_MODEL = TransportConfig
    STATUS_MODEL = TransportStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "bpm": "bpm",
        "time_signature_num": "timeSignatureNum",
        "time_signature_den": "timeSignatureDen",
        "loop_enabled": "loopEnabled",
        "loop_start_bar": "loopStartBar",
        "loop_end_bar": "loopEndBar",
        "session_id": "sessionId",
        "theme": "theme",
    }
    STATUS: ClassVar[dict[str, str]] = {
        "is_playing": "isPlaying",
        "is_recording": "isRecording",
        "current_beat": "currentBeat",
        "bar_number": "barNumber",
        "beat_in_bar": "beatInBar",
    }

    def play(self):
        """Start the clock in the owning view."""
        return self._command("is_playing", True)

    def stop(self):
        """Stop the clock in the owning view."""
        return self._command("is_playing", False)

    def seek(self, beat):
        """Move the clock to ``beat``."""
        return self._command("current_beat", float(beat))

    def record(self, on=True):
        """Arm or disarm recording; arming also starts the clock."""
        return self._command("is_recording", bool(on))


class SynthView(InstrumentView):
    """The synth instrument on a transports session.

    :class:`~nbplay.models.SynthConfig` renders the waveform preview as
    part of validation, so kernel and browser edits both refresh it.
    """

    TAG = "nbplay-synth"
    CONFIG_MODEL = SynthConfig
    STATUS_MODEL = SynthStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "oscillator_type": "oscillatorType",
        "frequency": "frequency",
        "amplitude": "amplitude",
        "sample_rate": "sampleRate",
        "waveform": "waveform",
        "session_id": "sessionId",
        "channel_index": "channelIndex",
        "theme": "theme",
    }
    STATUS: ClassVar[dict[str, str]] = {"is_playing": "isPlaying"}

    def play(self):
        """Start the tone in the owning view."""
        return self._command("is_playing", True)

    def stop(self):
        """Stop the tone in the owning view."""
        return self._command("is_playing", False)


class MixerView(InstrumentView):
    """The mixer console on a transports session.

    The console is configuration only: faders, pans, mutes, sends and
    effects live in the kernel model, and the browser builds the Web Audio
    graph from it. Edits in either place are validated by
    :class:`~nbplay.models.MixerConfig`.
    """

    TAG = "nbplay-mixer"
    CONFIG_MODEL = MixerConfig
    CONFIG: ClassVar[dict[str, str]] = {
        "channels": "channels",
        "returns": "returns",
        "master_gain": "masterGain",
        "master_effects": "masterEffects",
        "session_id": "sessionId",
        "theme": "theme",
    }

    def add_channel(self, name="Channel"):
        """Append a channel strip and return its index."""
        self.config.channels = [*self.config.channels, {"name": name}]
        return len(self.config.channels) - 1

    def remove_channel(self, index):
        """Remove the channel at ``index``."""
        channels = list(self.config.channels)
        if 0 <= index < len(channels):
            del channels[index]
            self.config.channels = channels

    def add_return(self, name="Return", effects=(), gain=0.8):
        """Append a send/return bus and return its index; every channel gains a send."""
        self.config.returns = [*self.config.returns, {"name": name, "gain": gain, "effects": list(effects)}]
        return len(self.config.returns) - 1

    def add_channel_effect(self, index, effect):
        """Append an insert effect to the channel at ``index``."""
        channels = list(self.config.channels)
        channels[index] = {**channels[index], "effects": [*channels[index]["effects"], _normalize_effect(effect)]}
        self.config.channels = channels

    def add_master_effect(self, effect):
        """Append an insert effect to the master bus."""
        self.config.master_effects = [*self.config.master_effects, _normalize_effect(effect)]


_ROUTED = {"sampler_routing": "samplerRouting", "session_id": "sessionId", "channel_index": "channelIndex", "theme": "theme"}


class PadsView(InstrumentView):
    """The trigger-pad grid on a transports session; the browser owns the taps."""

    TAG = "nbplay-pads"
    CONFIG_MODEL = PadsConfig
    STATUS_MODEL = PadsStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "rows": "rows",
        "cols": "cols",
        "velocity": "velocity",
        "velocity_sensitive": "velocitySensitive",
        "pad_notes": "padNotes",
        "pad_velocities": "padVelocities",
        "pad_actions": "padActions",
        **_ROUTED,
    }
    STATUS: ClassVar[dict[str, str]] = {
        "active_pads": "activePads",
        "last_note_event": "lastNoteEvent",
        "last_pad_event": "lastPadEvent",
    }


class KeyboardView(InstrumentView):
    """The QWERTY musical-typing keyboard on a transports session."""

    TAG = "nbplay-keyboard"
    CONFIG_MODEL = KeyboardConfig
    STATUS_MODEL = KeyboardStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "upper_octave": "upperOctave",
        "lower_octave": "lowerOctave",
        "velocity": "velocity",
        "sustain_upper": "sustainUpper",
        "sustain_lower": "sustainLower",
        "sustain_global": "sustainGlobal",
        **_ROUTED,
    }
    STATUS: ClassVar[dict[str, str]] = {"active_notes": "activeNotes", "last_note_event": "lastNoteEvent"}


class MidiKeyboardView(InstrumentView):
    """The Web MIDI keyboard on a transports session; ports and clock are browser-owned."""

    TAG = "nbplay-midi-keyboard"
    CONFIG_MODEL = MidiKeyboardConfig
    STATUS_MODEL = MidiKeyboardStatus
    CONFIG: ClassVar[dict[str, str]] = {"midi_port": "midiPort", "sync_clock": "syncClock", **_ROUTED}
    STATUS: ClassVar[dict[str, str]] = {
        "available_midi_ports": "availableMidiPorts",
        "active_notes": "activeNotes",
        "last_note_event": "lastNoteEvent",
        "control_change": "controlChange",
        "clock_bpm": "clockBpm",
    }


class SettingsView(InstrumentView):
    """Audio and MIDI device settings; the browser owns the port list and MIDI monitor."""

    TAG = "nbplay-settings"
    CONFIG_MODEL = SettingsConfig
    STATUS_MODEL = SettingsStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "sample_rate": "sampleRate",
        "channels": "channels",
        "buffer_size": "bufferSize",
        "audio_device": "audioDevice",
        "midi_port": "midiPort",
        "theme": "theme",
    }
    STATUS: ClassVar[dict[str, str]] = {"available_midi_ports": "availableMidiPorts", "midi_event": "midiEvent"}


class MidiOutputView(InstrumentView):
    """A Web MIDI output; sends are commands delivered to the owning view."""

    TAG = "nbplay-midi-output"
    CONFIG_MODEL = MidiOutputConfig
    STATUS_MODEL = MidiOutputStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "midi_port": "midiPort",
        "channel": "channel",
        "forward_notes": "forwardNotes",
        "send_clock": "sendClock",
        "session_id": "sessionId",
        "theme": "theme",
    }
    STATUS: ClassVar[dict[str, str]] = {"available_midi_ports": "availableMidiPorts"}

    def _request(self, **message):
        return self._command("request", message)

    def note_on(self, note, velocity=100):
        """Send a note-on on the output's channel."""
        return self._request(kind="note_on", note=_clamp_midi_note(note), velocity=max(1, _clamp_velocity(velocity)))

    def note_off(self, note):
        """Send a note-off on the output's channel."""
        return self._request(kind="note_off", note=_clamp_midi_note(note))

    def control_change(self, controller, value):
        """Send a control change (0-127) on the output's channel."""
        return self._request(kind="control_change", controller=_clamp_int(controller, 0, 127), value=_clamp_int(value, 0, 127))

    def send_raw(self, data):
        """Send raw MIDI bytes, for example ``[0xC0, 5]`` for a program change."""
        data = [_clamp_int(b, 0, 255) for b in data]
        if not data:
            raise ValueError("MIDI message must not be empty")
        return self._request(kind="raw", data=data)


class SequencerView(InstrumentView):
    """The step sequencer on a transports session.

    Steps are edited through ``voices_data``; play state and the sounding
    step belong to the browser scheduler.
    """

    TAG = "nbplay-sequencer"
    CONFIG_MODEL = SequencerConfig
    STATUS_MODEL = SequencerStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "voices_data": "voicesData",
        "num_voices": "numVoices",
        "length": "length",
        "measures": "measures",
        "step_duration": "stepDuration",
        "time_signature_num": "timeSignatureNum",
        "time_signature_den": "timeSignatureDen",
        "bpm": "bpm",
        "loop_enabled": "loopEnabled",
        "keyboard_connected": "keyboardConnected",
        "follow_transport": "followTransport",
        "swing": "swing",
        "groove": "groove",
        "automation_lanes": "automationLanes",
        **_ROUTED,
    }
    STATUS: ClassVar[dict[str, str]] = {"is_playing": "isPlaying", "current_step": "currentStep"}

    def set_step(self, index, note=60, velocity=100, duration_ticks=1, active=True, voice=0, probability=100):
        """Set one step of one voice."""
        voices = [list(steps) for steps in self.config.voices_data]
        if 0 <= voice < len(voices) and 0 <= index < len(voices[voice]):
            voices[voice][index] = {
                "note": note,
                "velocity": velocity,
                "duration_ticks": duration_ticks,
                "active": active,
                "probability": probability,
            }
            self.config.voices_data = voices

    def toggle_step(self, index, voice=0):
        """Flip one step's active state."""
        voices = [list(steps) for steps in self.config.voices_data]
        if 0 <= voice < len(voices) and 0 <= index < len(voices[voice]):
            voices[voice][index] = {**voices[voice][index], "active": not voices[voice][index]["active"]}
            self.config.voices_data = voices

    def clear(self):
        """Deactivate every step."""
        self.config.voices_data = [[{**step, "active": False} for step in steps] for steps in self.config.voices_data]

    def play(self):
        """Start playback in the owning view (the session clock when shared)."""
        return self._command("is_playing", True)

    def stop(self):
        """Stop playback in the owning view."""
        return self._command("is_playing", False)


class SamplerView(InstrumentView):
    """The sampler on a transports session.

    Sample PCM travels as bytes; zones carry their own bytes. Capturing a
    browser-side clip is a command the owning view decodes.
    """

    TAG = "nbplay-sampler"
    CONFIG_MODEL = SamplerConfig
    STATUS_MODEL = SamplerStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "sample_name": "sampleName",
        "sample_rate": "sampleRate",
        "sample_length": "sampleLength",
        "root_note": "rootNote",
        "waveform": "waveform",
        "sample_data": "sampleData",
        "attack": "attack",
        "decay": "decay",
        "sustain": "sustain",
        "release": "release",
        "max_voices": "maxVoices",
        "pad_count": "padCount",
        "pad_notes": "padNotes",
        "pad_velocities": "padVelocities",
        "pad_actions": "padActions",
        "sample_slices": "sampleSlices",
        "velocity": "velocity",
        "velocity_sensitive": "velocitySensitive",
        "zones": "zones",
        **_ROUTED,
    }
    STATUS: ClassVar[dict[str, str]] = {
        "active_pads": "activePads",
        "last_note_event": "lastNoteEvent",
        "last_pad_event": "lastPadEvent",
    }

    def load_sample(self, data, sample_rate=44100, root_note=69, name="Sample"):
        """Load mono float samples (or float32 bytes) as the main sample."""
        samples = list(data) if not isinstance(data, (bytes, bytearray, memoryview)) else None
        packed = _pack_float32(samples) if samples is not None else bytes(data)
        if samples is None:
            samples = memoryview(packed).cast("f").tolist()
        config = self.config
        config.sample_name = name
        config.sample_rate = sample_rate
        config.root_note = _clamp_midi_note(root_note)
        config.sample_length = len(samples)
        config.sample_data = packed
        config.waveform = _pack_float32(_decimate_samples(samples))
        return self

    def configure_pads(self, pad_count=None, pad_notes=None, pad_velocities=None, pad_actions=None):
        """Set the pad count and per-pad notes, velocities or actions."""
        config = self.config
        if pad_count is None and pad_notes is not None:
            pad_count = len(pad_notes)
        if pad_count is not None:
            config.pad_count = max(1, int(pad_count))
        if pad_notes is not None:
            config.pad_notes = list(pad_notes)
        if pad_velocities is not None:
            config.pad_velocities = list(pad_velocities)
        if pad_actions is not None:
            config.pad_actions = list(pad_actions)

    def add_zone(self, data, note_low=0, note_high=127, *, velocity_low=0, velocity_high=127, root_note=None, sample_rate=44100, name=None):
        """Add a sample zone covering a note and velocity range; returns the zone."""
        packed = bytes(data) if isinstance(data, (bytes, bytearray, memoryview)) else _pack_float32(list(data))
        if root_note is None:
            root_note = note_low if note_low == note_high else 60
        zone = _normalize_zone(
            {
                "name": name or f"Zone {len(self.config.zones) + 1}",
                "note_low": note_low,
                "note_high": note_high,
                "velocity_low": velocity_low,
                "velocity_high": velocity_high,
                "root_note": root_note,
                "sample_rate": sample_rate,
                "data": packed,
            },
            len(self.config.zones),
        )
        self.config.zones = [*self.config.zones, zone]
        return zone

    def capture(self, url, *, name="Take", note=None, offset=0.0, duration=0.0):
        """Ask the owning view to decode a browser-side audio URL into a zone.

        With ``note`` the zone answers to that one note and plays unpitched
        there; otherwise it covers every note at the sampler's root note.
        ``offset`` and ``duration`` are seconds into the source.
        """
        if note is not None:
            note = _clamp_midi_note(note)
            low, high, root = note, note, note
        else:
            low, high, root = 0, 127, self.config.root_note
        return self._command(
            "request",
            {
                "url": str(url),
                "name": name,
                "note_low": low,
                "note_high": high,
                "root_note": root,
                "offset": float(offset),
                "duration": float(duration),
            },
        )
