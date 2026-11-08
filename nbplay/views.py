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
import os
import pathlib
import uuid
from typing import ClassVar

import transports
from pydantic import BaseModel
from spaday import Widget, element

from .audio_files import decode_audio_file
from .descriptors import (
    _PAD_MAX_COUNT,
    AudioClip,
    PadAction,
    TimelineTrack,
    _clamp_int,
    _clamp_midi_note,
    _clamp_velocity,
    _decimate_samples,
    _normalize_audio_clip,
    _normalize_effect,
    _normalize_effects,
    _normalize_launcher_slot,
    _normalize_midi_events,
    _normalize_zone,
    _pack_float32,
    _set_effect_enabled,
    _slot_voices,
    _step_duration_for_length,
    _unpack_float32,
)
from .models import (
    KeyboardConfig,
    KeyboardStatus,
    LauncherConfig,
    LauncherStatus,
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
    TimelineConfig,
    TimelineStatus,
    TransportConfig,
    TransportStatus,
)

if "session" not in inspect.signature(Widget.__init__).parameters:
    raise ImportError("nbplay.views needs a spaday release with Widget(session=...) support")

__all__ = (
    "PACKAGE",
    "InstrumentView",
    "KeyboardView",
    "LauncherView",
    "MidiKeyboardView",
    "MidiOutputView",
    "MixerView",
    "PadsView",
    "SamplerView",
    "SequencerView",
    "Session",
    "SettingsView",
    "SynthView",
    "TimelineView",
    "Track",
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

    def _update_channel(self, index, **fields):
        channels = list(self.config.channels)
        if 0 <= index < len(channels):
            channels[index] = {**channels[index], **fields}
            self.config.channels = channels

    def set_channel_gain(self, index, gain):
        self._update_channel(index, gain=gain)

    def set_channel_pan(self, index, pan):
        self._update_channel(index, pan=pan)

    def set_channel_mute(self, index, mute):
        self._update_channel(index, mute=bool(mute))

    def set_channel_solo(self, index, solo):
        self._update_channel(index, solo=bool(solo))

    def set_channel_effects(self, index, effects):
        """Replace the insert chain of the channel at ``index``."""
        self._update_channel(index, effects=_normalize_effects(effects))

    def add_channel_effect(self, index, effect):
        """Append an insert effect to the channel at ``index``."""
        if 0 <= index < len(self.config.channels):
            self._update_channel(index, effects=[*self.config.channels[index]["effects"], _normalize_effect(effect)])

    def set_channel_effect_enabled(self, index, effect_index, enabled=True):
        """Bypass (``False``) or re-enable one channel insert effect."""
        if 0 <= index < len(self.config.channels):
            effects = list(self.config.channels[index]["effects"])
            if 0 <= effect_index < len(effects):
                effects[effect_index] = _set_effect_enabled(effects[effect_index], enabled)
                self._update_channel(index, effects=effects)

    def clear_channel_effects(self, index):
        """Remove every insert effect from the channel at ``index``."""
        self.set_channel_effects(index, [])

    def set_master_effects(self, effects):
        """Replace the master bus insert chain."""
        self.config.master_effects = _normalize_effects(effects)

    def add_master_effect(self, effect):
        """Append an insert effect to the master bus."""
        self.config.master_effects = [*self.config.master_effects, _normalize_effect(effect)]

    def set_master_effect_enabled(self, effect_index, enabled=True):
        """Bypass (``False``) or re-enable one master insert effect."""
        effects = list(self.config.master_effects)
        if 0 <= effect_index < len(effects):
            effects[effect_index] = _set_effect_enabled(effects[effect_index], enabled)
            self.config.master_effects = effects

    def clear_master_effects(self):
        """Remove every insert effect from the master bus."""
        self.config.master_effects = []

    def add_return(self, name="Return", effects=(), gain=0.8):
        """Append a send/return bus and return its index; every channel gains a send."""
        self.config.returns = [*self.config.returns, {"name": name, "gain": gain, "effects": list(effects)}]
        return len(self.config.returns) - 1

    def remove_return(self, index):
        """Remove a return bus and every channel's send to it."""
        returns = list(self.config.returns)
        if 0 <= index < len(returns):
            del returns[index]
            channels = [{**ch, "sends": [level for i, level in enumerate(ch["sends"]) if i != index]} for ch in self.config.channels]
            self.config.update(returns=returns, channels=channels)

    def _update_return(self, index, **fields):
        returns = list(self.config.returns)
        if 0 <= index < len(returns):
            returns[index] = {**returns[index], **fields}
            self.config.returns = returns

    def set_return_gain(self, index, gain):
        self._update_return(index, gain=gain)

    def set_return_effects(self, index, effects):
        """Replace a return bus's effect chain."""
        self._update_return(index, effects=_normalize_effects(effects))

    def add_return_effect(self, index, effect):
        """Append an effect to a return bus's chain."""
        if 0 <= index < len(self.config.returns):
            self._update_return(index, effects=[*self.config.returns[index]["effects"], _normalize_effect(effect)])

    def set_return_effect_enabled(self, index, effect_index, enabled=True):
        """Bypass (``False``) or re-enable one return bus effect."""
        if 0 <= index < len(self.config.returns):
            effects = list(self.config.returns[index]["effects"])
            if 0 <= effect_index < len(effects):
                effects[effect_index] = _set_effect_enabled(effects[effect_index], enabled)
                self._update_return(index, effects=effects)

    def set_send(self, channel_index, return_index, level):
        """Set a channel's post-fader send level (0 to 1) to a return bus."""
        if not 0 <= return_index < len(self.config.returns):
            raise IndexError(f"return index out of range: {return_index}")
        if 0 <= channel_index < len(self.config.channels):
            sends = list(self.config.channels[channel_index]["sends"])
            sends[return_index] = level
            self._update_channel(channel_index, sends=sends)

    def to_mixer(self):
        """A Rust ``Mixer`` with this console's channels and master gain."""
        from nbplay import Mixer

        mixer = Mixer()
        for channel in self.config.channels:
            index = mixer.add_channel(channel["name"])
            mixer.set_channel_gain(index, channel["gain"])
            mixer.set_channel_pan(index, channel["pan"])
            mixer.set_channel_mute(index, channel["mute"])
            mixer.set_channel_solo(index, channel["solo"])
        mixer.master_gain = self.config.master_gain
        return mixer


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

    def __init__(self, session=None, *, config=None, **kwargs):
        # An explicit step count without a step duration fills the measures, as in the widget.
        if config is None and "length" in kwargs and "step_duration" not in kwargs:
            kwargs["step_duration"] = _step_duration_for_length(
                kwargs["length"], kwargs.get("measures", 1), kwargs.get("time_signature_num", 4), kwargs.get("time_signature_den", 4)
            )
        super().__init__(session, config=config, **kwargs)

    def configure_grid(self, measures=None, step_duration=None):
        """Set the grid from a measure count and a step duration in beats; the length follows."""
        fields = {}
        if measures is not None:
            fields["measures"] = measures
        if step_duration is not None:
            fields["step_duration"] = step_duration
        self.config.update(**fields)

    @property
    def steps(self):
        """Voice 0's steps."""
        return self.config.voices_data[0]

    @steps.setter
    def steps(self, value):
        self.config.voices_data = [list(value), *self.config.voices_data[1:]]

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

    def to_pattern(self, voice=0):
        """A Rust ``Pattern`` of one voice, or ``None`` when ``voice`` is out of range."""
        from nbplay import Pattern, Step

        if not 0 <= voice < len(self.config.voices_data):
            return None
        steps = self.config.voices_data[voice]
        pattern = Pattern(len(steps))
        for index, data in enumerate(steps):
            step = Step(data["note"], data["velocity"], data["duration_ticks"])
            step.active = data["active"]
            pattern.set_step(index, step)
        pattern.loop_enabled = self.config.loop_enabled
        return pattern

    def to_step_sequencer(self, channel=0, voice=0):
        """A Rust ``StepSequencer`` of one voice on a MIDI channel, or ``None`` when ``voice`` is out of range."""
        from nbplay import StepSequencer

        pattern = self.to_pattern(voice)
        if pattern is None:
            return None
        sequencer = StepSequencer(pattern, channel)
        sequencer.step_duration = self.config.step_duration
        return sequencer

    def to_midi(self, path=None, name="Sequencer"):
        """The pattern as a ``mido.MidiFile``, written to ``path`` when given."""
        from nbplay.midi import build_midi, steps_to_events

        config = self.config
        midi = build_midi(
            [{"name": name, "events": steps_to_events(config.voices_data, config.step_duration)}],
            bpm=config.bpm,
            time_signature=(config.time_signature_num, config.time_signature_den),
        )
        if path is not None:
            midi.save(os.fspath(path))
        return midi

    def load_midi(self, source, track=None, step_duration=None, max_voices=8):
        """Replace the pattern with the notes of a MIDI file; see ``SequencerWidget.load_midi``."""
        from nbplay.midi import events_to_voices, read_midi

        data = read_midi(source)
        tracks = data["tracks"]
        if track is not None:
            if not 0 <= track < len(tracks):
                raise IndexError(f"MIDI track index out of range: {track}")
            tracks = [tracks[track]]
        events = [event for item in tracks for event in item["events"]]
        step = self.config.step_duration if step_duration is None else float(step_duration)
        voices, length = events_to_voices(events, step, max_voices=max_voices)
        self.config.update(bpm=data["bpm"], step_duration=step, num_voices=len(voices), length=length, voices_data=voices)
        return self

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

    def _set_sample_data(self, samples, **fields):
        self.config.update(
            sample_length=len(samples), sample_data=_pack_float32(samples), waveform=_pack_float32(_decimate_samples(samples)), **fields
        )

    def get_sample_data(self):
        """The main sample as floats."""
        return _unpack_float32(self.config.sample_data)

    def load_sample(self, data, sample_rate=44100, root_note=69, name="Sample"):
        """Load mono float samples (or float32 bytes) as the main sample."""
        samples = _unpack_float32(bytes(data)) if isinstance(data, (bytes, bytearray, memoryview)) else list(data)
        self._set_sample_data(samples, sample_name=name, sample_rate=sample_rate, root_note=_clamp_midi_note(root_note))
        return self

    def load_audio_file(self, path, root_note=69, name=None):
        """Load an audio file (WAV through the stdlib, others through ``soundfile``) as the main sample."""
        path = pathlib.Path(path)
        samples, sample_rate = decode_audio_file(path)
        return self.load_sample(samples, sample_rate=sample_rate, root_note=root_note, name=name or path.name)

    def trim_sample(self, start=0, end=None):
        """Keep the frames in ``[start, end)``."""
        samples = self.get_sample_data()
        end = len(samples) if end is None else min(len(samples), int(end))
        start = max(0, int(start))
        if end <= start:
            raise ValueError("trim range must contain at least one frame")
        self._set_sample_data(samples[start:end])
        return self

    def normalize_sample(self, target=1.0):
        """Scale the sample so its peak reaches ``target``."""
        samples = self.get_sample_data()
        peak = max((abs(s) for s in samples), default=0.0)
        if peak:
            gain = max(0.0, min(1.0, float(target))) / peak
            self._set_sample_data([s * gain for s in samples])
        return self

    def reverse_sample(self):
        """Reverse the sample."""
        self._set_sample_data(list(reversed(self.get_sample_data())))
        return self

    def fade_sample(self, fade_in=0, fade_out=0):
        """Apply linear fades of the given frame counts."""
        samples = self.get_sample_data()
        total = len(samples)
        fade_in = max(0, min(total, int(fade_in)))
        fade_out = max(0, min(total, int(fade_out)))
        for i in range(fade_in):
            samples[i] *= i / max(1, fade_in - 1)
        for i in range(fade_out):
            samples[total - fade_out + i] *= 1.0 - i / max(1, fade_out - 1)
        self._set_sample_data(samples)
        return self

    def slice_sample(self, count, start_note=36):
        """Cut the sample into ``count`` equal slices on ascending notes and put them on the pads."""
        count = max(1, min(_PAD_MAX_COUNT, int(count)))
        length = self.config.sample_length
        if length <= 0:
            raise ValueError("load a sample before slicing")
        step = length / count
        slices = [
            {
                "index": i,
                "note": _clamp_midi_note(start_note + i),
                "start": int(i * step),
                "end": length if i == count - 1 else int((i + 1) * step),
                "label": f"S{i + 1}",
            }
            for i in range(count)
        ]
        velocity = self.config.velocity
        self.config.update(
            sample_slices=slices,
            pad_count=count,
            pad_notes=[s["note"] for s in slices],
            pad_actions=[PadAction(note=s["note"], velocity=velocity, label=s["label"], slice_index=s["index"]).to_dict() for s in slices],
        )
        return slices

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

    def add_zone_file(self, path, note_low=0, note_high=127, **kwargs):
        """Add a zone from an audio file (WAV through the stdlib, others through ``soundfile``)."""
        path = pathlib.Path(path)
        samples, sample_rate = decode_audio_file(path)
        kwargs.setdefault("name", path.name)
        return self.add_zone(samples, note_low, note_high, sample_rate=sample_rate, **kwargs)

    def set_zone(self, index, **fields):
        """Update fields of one zone (range, root note, name); returns the zone."""
        zones = list(self.config.zones)
        zones[index] = _normalize_zone({**zones[index], **fields}, index)
        self.config.zones = zones
        return zones[index]

    def remove_zone(self, index):
        """Remove the zone at ``index``."""
        zones = list(self.config.zones)
        del zones[index]
        self.config.zones = zones

    def clear_zones(self):
        self.config.zones = []

    def zone_for(self, note, velocity=100):
        """The first zone answering to ``note`` at ``velocity``, or ``None``."""
        note = _clamp_midi_note(note)
        velocity = _clamp_velocity(velocity)
        for zone in self.config.zones:
            if zone["note_low"] <= note <= zone["note_high"] and zone["velocity_low"] <= velocity <= zone["velocity_high"]:
                return zone
        return None

    def zone_samples(self, index):
        """One zone's PCM as floats."""
        return _unpack_float32(self.config.zones[index]["data"])

    def to_sample_map(self):
        """A Rust ``SampleMap``: the zones in order, then the main sample as the fallback."""
        from nbplay import AudioSample, SampleMap, SampleMapping

        sample_map = SampleMap()
        for zone in self.config.zones:
            sample = AudioSample(_unpack_float32(zone["data"]), zone["sample_rate"], zone["root_note"])
            sample_map.add_mapping(SampleMapping(sample, zone["note_low"], zone["note_high"], zone["velocity_low"], zone["velocity_high"]))
        if self.config.sample_length:
            sample = AudioSample(self.get_sample_data(), self.config.sample_rate, self.config.root_note)
            sample_map.add_mapping(SampleMapping(sample, 0, 127, 0, 127))
        return sample_map

    def to_sampler(self):
        """A Rust ``Sampler`` with the main sample, envelope and polyphony."""
        from nbplay import AudioSample, Envelope, Sampler

        config = self.config
        sampler = Sampler(AudioSample(self.get_sample_data(), config.sample_rate, config.root_note), config.sample_rate, config.max_voices)
        sampler.set_envelope(Envelope(config.attack, config.decay, config.sustain, config.release))
        return sampler

    def capture_clip(self, timeline, clip_id, pad=None, note=None, name=None):
        """Turn a timeline audio clip into a zone, decoded by the owning browser view.

        With ``pad`` (index) or ``note`` the zone answers to that one note and
        plays unpitched there; otherwise it covers every note. The clip's
        trim (``offset`` and ``duration``, in beats) is honoured.
        """
        clip_id = str(clip_id)
        clip = next((item for item in timeline.config.clips if item["id"] == clip_id), None)
        if clip is None:
            raise ValueError(f"clip not found: {clip_id}")
        if clip["kind"] == "midi" or not clip["audio_url"]:
            raise ValueError(f"clip {clip_id} has no audio in the browser")
        if pad is not None:
            note = self.config.pad_notes[pad]
        seconds_per_beat = 60.0 / max(1e-6, float(timeline.config.bpm))
        return self.capture(
            clip["audio_url"],
            name=name or clip["name"] or "Take",
            note=note,
            offset=clip["offset"] * seconds_per_beat,
            duration=clip["duration"] * seconds_per_beat,
        )

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


class LauncherView(InstrumentView):
    """The clip launcher on a transports session.

    Slots hold step patterns in the sequencer's ``voices_data`` shape; the
    browser owns play and slot state, and launches are commands.
    """

    TAG = "nbplay-launcher"
    CONFIG_MODEL = LauncherConfig
    STATUS_MODEL = LauncherStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "tracks": "tracks",
        "scenes": "scenes",
        "slots": "slots",
        "quantize": "quantize",
        "bpm": "bpm",
        "time_signature_num": "timeSignatureNum",
        "selected_slot": "selectedSlot",
        "session_id": "sessionId",
        "theme": "theme",
    }
    STATUS: ClassVar[dict[str, str]] = {
        "is_playing": "isPlaying",
        "active_slots": "activeSlots",
        "queued_slots": "queuedSlots",
    }

    def add_track(self, name="Track", channel_index=None):
        """Append a track row and return its index."""
        index = len(self.config.tracks)
        self.config.tracks = [*self.config.tracks, {"name": name, "channel_index": index if channel_index is None else channel_index}]
        return index

    def add_scene(self, name=None):
        """Append a scene column and return its index."""
        index = len(self.config.scenes)
        self.config.scenes = [*self.config.scenes, str(name) if name is not None else f"Scene {index + 1}"]
        return index

    def set_slot(self, track_index, scene_index, pattern, *, name=None, step_duration=0.25, swing=0.0, groove=None):
        """Fill a slot with a pattern (step dicts, voices, or a sequencer) and return it."""
        tracks, scenes = self.config.tracks, self.config.scenes
        if not 0 <= track_index < len(tracks) or not 0 <= scene_index < len(scenes):
            raise IndexError(f"slot out of range: track {track_index}, scene {scene_index}")
        if isinstance(pattern, SequencerView):
            pattern = pattern.config.voices_data
        slot = _normalize_launcher_slot(
            {
                "track_index": track_index,
                "scene_index": scene_index,
                "name": name if name is not None else f"{tracks[track_index]['name']} {scene_index + 1}",
                "voices_data": _slot_voices(pattern),
                "step_duration": step_duration,
                "swing": swing,
                "groove": groove or [],
            }
        )
        slots = [s for s in self.config.slots if not (s["track_index"] == track_index and s["scene_index"] == scene_index)]
        self.config.slots = [*slots, slot]
        return slot

    def launch(self, track_index, scene_index):
        """Launch a slot on the next quantization boundary."""
        return self._command("request", {"action": "launch", "track_index": int(track_index), "scene_index": int(scene_index)})

    def stop_track(self, track_index):
        """Stop a track's playing slot."""
        return self._command("request", {"action": "stop", "track_index": int(track_index)})

    def launch_scene(self, scene_index):
        """Launch every slot in a scene."""
        return self._command("request", {"action": "scene", "scene_index": int(scene_index)})

    def stop_all(self):
        """Stop every playing slot."""
        return self._command("request", {"action": "stop_all"})


class TimelineView(InstrumentView):
    """The tracking view on a transports session.

    Lanes and clips are kernel configuration; play, record and transfer
    state belong to the browser. Clip audio export and import go through
    the config fields the element watches.
    """

    TAG = "nbplay-timeline"
    CONFIG_MODEL = TimelineConfig
    STATUS_MODEL = TimelineStatus
    CONFIG: ClassVar[dict[str, str]] = {
        "tracks": "tracks",
        "clips": "clips",
        "length": "length",
        "selected_clip_id": "selectedClipId",
        "bpm": "bpm",
        "time_signature_num": "timeSignatureNum",
        "count_in_bars": "countInBars",
        "auto_extend_recording": "autoExtendRecording",
        "recording_extend_bars": "recordingExtendBars",
        "pixels_per_beat": "pixelsPerBeat",
        "current_beat": "currentBeat",
        "export_clip_id": "exportClipId",
        "import_clip_request": "importClipRequest",
        "import_clip_data": "importClipData",
        "session_id": "sessionId",
        "theme": "theme",
    }
    STATUS: ClassVar[dict[str, str]] = {
        "is_playing": "isPlaying",
        "is_recording": "isRecording",
        "recording_track": "recordingTrack",
        "recording_tracks": "recordingTracks",
        "recording_countdown_beats": "recordingCountdownBeats",
        "recording_error": "recordingError",
        "recorded_clip": "recordedClip",
        "exported_clip": "exportedClip",
        "exported_clip_data": "exportedClipData",
    }

    def add_track(self, name="Track", channel_index=None, *, armed=False, monitor=False, input="microphone"):
        """Append a lane and return its index."""
        index = len(self.config.tracks)
        track = TimelineTrack(
            name=name,
            channel_index=index if channel_index is None else channel_index,
            armed=armed,
            monitor=monitor,
            input=input,
        ).to_dict()
        self.config.tracks = [*self.config.tracks, track]
        return index

    def add_clip(self, name="Clip", track_index=0, start=0.0, duration=4.0, **kwargs):
        """Append a clip, select it, and grow the timeline to fit it."""
        clip = _normalize_audio_clip(
            AudioClip(name=name, track_index=track_index, start=start, duration=duration, **kwargs).to_dict(),
            len(self.config.clips),
            len(self.config.tracks),
        )
        config = self.config
        config.clips = [*config.clips, clip]
        config.selected_clip_id = clip["id"]
        config.length = max(config.length, clip["start"] + clip["duration"])
        return clip

    def add_midi_clip(self, name="MIDI", track_index=0, start=0.0, events=(), duration=None, **kwargs):
        """Append a MIDI clip; ``duration`` defaults to the end of the last event."""
        normalized = _normalize_midi_events(events)
        if duration is None:
            duration = max([1.0, *(event["beat"] + event["duration"] for event in normalized)])
        return self.add_clip(name, track_index=track_index, start=start, duration=duration, kind="midi", events=normalized, **kwargs)

    def export_clip(self, clip_id):
        """Ask the browser for a clip's audio; it arrives in ``status.exported_clip_data``."""
        self.config.export_clip_id = str(clip_id)

    def import_clip(self, clip_id, data, blob_type="audio/webm", *, measure_duration=False):
        """Hand clip audio bytes to the browser; it attaches them to the clip."""
        self.config.import_clip_data = bytes(data)
        self.config.import_clip_request = {
            "id": str(clip_id),
            "blob_type": blob_type,
            "blob_size": len(data),
            "measure_duration": bool(measure_duration),
        }

    def seek(self, beat):
        """Move a standalone timeline's playhead (a session seeks through its transport)."""
        self.config.current_beat = float(beat)

    def play(self):
        """Start playback in the owning view."""
        return self._command("is_playing", True)

    def stop(self):
        """Stop playback in the owning view."""
        return self._command("is_playing", False)

    def record(self, on=True):
        """Start or stop recording the armed lanes."""
        return self._command("is_recording", bool(on))


class Track:
    """A session lane: a mixer channel plus an optional sequencer and sound source."""

    def __init__(self, name, sequencer=None, sound_source=None, mixer_channel=0):
        self.name = name
        self.sequencer = sequencer
        self.sound_source = sound_source
        self.mixer_channel = mixer_channel

    def __repr__(self):
        return f"Track(name={self.name!r}, channel={self.mixer_channel})"


class Session:
    """Transport, mixer, timeline and launcher views sharing one browser session.

    Every view carries the same ``session_id``, so the browser gives them
    one audio bus and one clock, which keeps play state, position and tempo
    consistent across them. Each view hosts its models in its own transports
    ``Session``: transports grants a connection ownership of every
    client-owned field in the session it connects to, so views that shared
    one would fight over each other's status. In the kernel the :attr:`bpm`,
    :attr:`time_signature` and :attr:`theme` properties write every view's
    config. Undo, patterns, MIDI files and persistence stay with the
    traitlets :class:`nbplay.widget.Session` for now.
    """

    def __init__(self, bpm=120.0, time_signature=(4, 4), theme=""):
        self._session_id = f"nbplay-{uuid.uuid4().hex[:8]}"
        num, den = time_signature
        common = {"session_id": self._session_id, "bpm": bpm, "time_signature_num": num, "theme": theme}
        self.transport = TransportView(time_signature_den=den, **common)
        self.mixer = MixerView(session_id=self._session_id, theme=theme)
        self.timeline = TimelineView(time_signature_den=den, **common)
        self.launcher = LauncherView(time_signature_den=den, **common)
        self.tracks = []

    @property
    def session_id(self):
        """The browser session id every view shares."""
        return self._session_id

    @property
    def views(self):
        """Every view in the session, including track instruments."""
        views = [self.transport, self.mixer, self.timeline, self.launcher]
        for track in self.tracks:
            views.extend(view for view in (track.sequencer, track.sound_source) if isinstance(view, InstrumentView))
        return views

    @property
    def bpm(self):
        return self.transport.config.bpm

    @bpm.setter
    def bpm(self, value):
        for view in self.views:
            if "bpm" in view.CONFIG:
                view.config.bpm = value

    @property
    def time_signature(self):
        return (self.transport.config.time_signature_num, self.transport.config.time_signature_den)

    @time_signature.setter
    def time_signature(self, value):
        num, den = value
        for view in self.views:
            if "time_signature_num" in view.CONFIG:
                view.config.time_signature_num = num
            if "time_signature_den" in view.CONFIG_MODEL.model_fields:
                view.config.time_signature_den = den

    @property
    def theme(self):
        return self.transport.config.theme

    @theme.setter
    def theme(self, value):
        for view in self.views:
            view.config.theme = value

    def play(self):
        """Start the shared clock."""
        return self.transport.play()

    def stop(self):
        """Stop the shared clock."""
        return self.transport.stop()

    def seek(self, beat):
        """Move the shared clock."""
        return self.transport.seek(beat)

    def add_track(self, name, sequencer=None, sound_source=None, *, input=None, armed=False):
        """Add a track: a mixer channel, a timeline lane, a launcher row, and the instruments' routing."""
        channel = self.mixer.add_channel(name)
        for view in (sequencer, sound_source):
            if isinstance(view, InstrumentView):
                view.config.session_id = self._session_id
                view.config.channel_index = channel
                view.config.theme = self.theme
                if "bpm" in view.CONFIG:
                    view.config.bpm = self.bpm
        if input is None:
            input = "channel" if (sequencer is not None or sound_source is not None) else "microphone"
        self.timeline.add_track(name, channel, armed=armed, input=input)
        self.launcher.add_track(name, channel)
        track = Track(name, sequencer, sound_source, channel)
        self.tracks.append(track)
        return track

    def close(self):
        """Close every view."""
        for view in self.views:
            view.close()
