"""The nbplay widgets: instruments on transports models, rendered by spaday.

A widget hosts a config model (kernel-owned, validated) and a status model
(browser-owned) in a :class:`transports.Session`, and renders the instrument
element with spaday bindings: config fields bind two-way on ``nbplay-set``,
status fields two-way on ``nbplay-status``, and an ``nbplay-wire`` child
delivers ``session.command`` calls to the element.
"""

import json
import math
import os
import pathlib
import uuid
import weakref
import zipfile
from typing import ClassVar

import transports
from pydantic import BaseModel
from spaday import Widget, Wire, element

from . import __version__
from .audio_files import decode_audio_file
from .descriptors import (
    _PAD_MAX_COUNT,
    _SAMPLER_PAD_STATE,
    _SAMPLER_STATE,
    _SEQUENCER_STATE,
    _SESSION_FORMAT,
    _SESSION_FORMAT_VERSION,
    _SYNTH_STATE,
    _TIMELINE_STATE,
    _TRANSPORT_STATE,
    AudioClip,
    PadAction,
    TimelineTrack,
    _build_route,
    _clamp_int,
    _clamp_midi_note,
    _clamp_velocity,
    _clip_id,
    _decimate_samples,
    _default_steps,
    _json_copy,
    _nonnegative_number,
    _normalize_audio_clip,
    _normalize_effect,
    _normalize_effects,
    _normalize_launcher_slot,
    _normalize_midi_events,
    _normalize_zone,
    _pack_float32,
    _positive_number,
    _set_effect_enabled,
    _slot_voices,
    _step_duration_for_length,
    _steps_to_events,
    _unpack_float32,
)
from .history import History
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
    _Validated,
)

__all__ = (
    "PACKAGE",
    "InstrumentWidget",
    "KeyboardWidget",
    "LauncherWidget",
    "MidiKeyboardWidget",
    "MidiOutputWidget",
    "MixerWidget",
    "PadWidget",
    "SamplerWidget",
    "SequencerWidget",
    "Session",
    "SettingsWidget",
    "SynthWidget",
    "TimelineWidget",
    "Track",
    "TransportWidget",
)

PACKAGE = "nbplay.components:package"

# transports gives a Session one patch callback; widgets sharing a Session share it.
_PATCH_HOOKS = weakref.WeakKeyDictionary()


def _on_session_patch(session, hook):
    """Register ``hook(model_id, patch)`` for the patches a transports Session emits; returns a remover."""
    hooks = _PATCH_HOOKS.get(session)
    if hooks is None:
        hooks = _PATCH_HOOKS[session] = []

        def dispatch(mid, patch):
            for item in hooks:
                item(mid, patch)

        session.on_patch(dispatch)
    hooks.append(hook)

    def remove():
        if hook in hooks:
            hooks.remove(hook)

    return remove


def _pattern_events(voices, step_duration, repeat):
    """MIDI events for ``voices`` played ``repeat`` times, and the total length in beats."""
    step_duration = _positive_number(step_duration, "step_duration", minimum=0.001, maximum=16.0)
    length = max(len(voice) for voice in voices) * step_duration
    base = _steps_to_events(voices, step_duration)
    repeat = max(1, int(repeat))
    events = [{**event, "beat": event["beat"] + cycle * length} for cycle in range(repeat) for event in base]
    return events, length * repeat


class InstrumentWidget(Widget):
    """One instrument element on a config model and, usually, a status model.

    Subclasses set ``TAG``, the model classes, and the trait-to-property
    maps; an instrument with no browser-owned state leaves ``STATUS_MODEL``
    as ``None``. Keyword arguments that name config fields initialise the
    config; the rest go to :class:`spaday.Widget`.
    """

    TAG: ClassVar[str]
    CONFIG_MODEL: ClassVar[type[_Validated]]
    STATUS_MODEL: ClassVar[type[BaseModel] | None] = None
    CONFIG: ClassVar[dict[str, str]]
    STATUS: ClassVar[dict[str, str]] = {}
    #: Status fields written back on an event other than ``nbplay-status``.
    STATUS_EVENTS: ClassVar[dict[str, str]] = {}

    def __init__(self, session=None, *, config=None, **kwargs):
        fields = {name: kwargs.pop(name) for name in list(kwargs) if name in self.CONFIG_MODEL.model_fields}
        self.config = config if config is not None else self.CONFIG_MODEL(**fields)
        self.status = self.STATUS_MODEL() if self.STATUS_MODEL is not None else None
        self.session = session if session is not None else transports.Session()
        self._prepare()
        self.config_id = self.session.host(self.config)
        self.status_id = self.session.host(self.status, owner="client") if self.status is not None else None
        # Config changes come through the model (Python assignments and browser
        # edits alike); status changes come as patches the browser submits.
        self._listeners = []
        self._status_mirror = self.status.model_dump() if self.status is not None else {}
        self._unobserve_config = self.config.on_change(self._on_config_change)
        self._unhook_patches = _on_session_patch(self.session, self._on_patch)
        super().__init__(self.tree(), session=self.session, wires=self.wires(), packages=PACKAGE, **kwargs)

    def tree(self, prefix=""):
        """The instrument element with its bindings; ``prefix`` namespaces them (``"lead."``) on a shared store."""
        node = element(self.TAG)
        for name, prop in self.CONFIG.items():
            node.bind(prop, f"{prefix}config.{name}", mode="two-way", event="nbplay-set")
        if self.status is not None:
            node.child(element("nbplay-wire", namespace=f"{prefix}status"))
            for name, prop in self.STATUS.items():
                node.bind(prop, f"{prefix}status.{name}", mode="two-way", event=self.STATUS_EVENTS.get(name, "nbplay-status"))
        return node

    def wires(self, prefix="", url=None):
        """The wire specs for the hosted models: notebook mappings, or :class:`spaday.Wire` for a served page at ``url``."""
        specs = [(self.config_id, f"{prefix}config")]
        if self.status_id is not None:
            specs.append((self.status_id, f"{prefix}status"))
        if url is None:
            return [{"model": model, "namespace": namespace} for model, namespace in specs]
        return [Wire(url, model=model, namespace=namespace) for model, namespace in specs]

    def _prepare(self):
        """Hook run after the models exist and before they are hosted."""

    def _command(self, field, value):
        if self.status_id is None:
            raise TypeError(f"{type(self).__name__} has no browser-owned status to command")
        return self.session.command(self.status_id, field, value)

    def on_change(self, listener, names=None):
        """Call ``listener(widget, name, old, new)`` when a config or status field changes; returns a remover.

        ``names`` limits the fields. Changes made from Python and from the
        browser both count.
        """
        wanted = None if names is None else frozenset([names] if isinstance(names, str) else names)
        entry = (wanted, listener)
        self._listeners.append(entry)

        def unobserve():
            if entry in self._listeners:
                self._listeners.remove(entry)

        return unobserve

    def _notify(self, name, old, new):
        for wanted, listener in list(self._listeners):
            if wanted is None or name in wanted:
                listener(self, name, old, new)

    def _on_config_change(self, changes):
        for name, (old, new) in changes.items():
            self._notify(name, old, new)

    def _on_patch(self, mid, patch):
        if mid != self.status_id:
            return
        for op in patch.get("ops", []):
            path = op.get("Set", {}).get("path") or []
            name = path[0].get("Key") if path and isinstance(path[0], dict) else None
            if name is None or name not in self._status_mirror:
                continue
            new = getattr(self.status, name)
            old = self._status_mirror[name]
            if new != old:
                self._status_mirror[name] = new
                self._notify(name, old, new)

    def close(self):
        self._unobserve_config()
        self._unhook_patches()
        self._listeners.clear()
        super().close()


class TransportWidget(InstrumentWidget):
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
        "undo_request": "undoRequest",
        "redo_request": "redoRequest",
    }
    STATUS_EVENTS: ClassVar[dict[str, str]] = {"undo_request": "nbplay-request", "redo_request": "nbplay-request"}

    def play(self):
        """Start the clock in the owning widget."""
        return self._command("is_playing", True)

    def stop(self):
        """Stop the clock in the owning widget."""
        return self._command("is_playing", False)

    def seek(self, beat):
        """Move the clock to ``beat``."""
        return self._command("current_beat", float(beat))

    def record(self, on=True):
        """Arm or disarm recording; arming also starts the clock."""
        return self._command("is_recording", bool(on))


class SynthWidget(InstrumentWidget):
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
        """Start the tone in the owning widget."""
        return self._command("is_playing", True)

    def stop(self):
        """Stop the tone in the owning widget."""
        return self._command("is_playing", False)


class MixerWidget(InstrumentWidget):
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


class _NoteSource(InstrumentWidget):
    """A widget that plays notes into samplers through ``sampler_routing``."""

    def connect_sampler(self, sampler, *, zone=None, octave=None, note=None, notes=None):
        """Route notes to ``sampler`` (a :class:`SamplerWidget` on the session bus); see :class:`KeyboardRoute`."""
        channel = sampler.config.channel_index
        route = _build_route(channel, zone=zone, octave=octave, note=note, notes=notes).to_dict()
        self.config.sampler_routing = [*(r for r in self.config.sampler_routing if r.get("channel_index") != channel), route]

    def disconnect_sampler(self, sampler):
        """Drop the route to ``sampler``."""
        channel = sampler.config.channel_index
        self.config.sampler_routing = [r for r in self.config.sampler_routing if r.get("channel_index") != channel]


class _Keys(_NoteSource):
    """A keyboard widget: it can also record into sequencers."""

    def connect_sequencer(self, sequencer):
        """Let ``sequencer`` (a :class:`SequencerWidget`) record this keyboard."""
        sequencer.config.keyboard_connected = True

    def disconnect_sequencer(self, sequencer):
        sequencer.config.keyboard_connected = False


class PadWidget(_NoteSource):
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

    def configure_grid_for_actions(self, notes=None, velocities=None, actions=None, rows=None, cols=None):
        """Size the grid for the given notes, velocities or actions and apply them."""
        config = self.config
        count = max(1, max(len(actions or []), len(notes or []), len(velocities or [])) or len(config.pad_notes))
        if cols is None:
            cols = min(4, count)
        if rows is None:
            rows = max(1, (count + cols - 1) // cols)
        fields = {"rows": max(1, int(rows)), "cols": max(1, int(cols))}
        if notes is None and actions is not None:
            notes = [
                a.get("note", config.pad_notes[i] if i < len(config.pad_notes) else 60) if isinstance(a, dict) else a.note
                for i, a in enumerate(actions)
            ]
        if notes is not None:
            fields["pad_notes"] = list(notes)
        if velocities is not None:
            fields["pad_velocities"] = list(velocities)
        if actions is not None:
            fields["pad_actions"] = [a.to_dict() if isinstance(a, PadAction) else a for a in actions]
        config.update(**fields)
        return self

    def set_base_note(self, note):
        """Lay the pads out chromatically from ``note``."""
        start = _clamp_midi_note(note)
        self.config.pad_notes = [_clamp_midi_note(start + i) for i in range(self.config.rows * self.config.cols)]
        return self

    def transpose_pads(self, semitones):
        """Shift every pad note by ``semitones``."""
        delta = int(semitones)
        self.config.pad_notes = [_clamp_midi_note(note + delta) for note in self.config.pad_notes]
        return self

    def connect_sampler(self, sampler, **kwargs):
        """Route the pads to ``sampler``; pads have no zones, so ``zone`` must be ``None`` or ``"all"``."""
        zone = kwargs.get("zone")
        if zone is not None and zone != "all":
            raise ValueError(f"PadWidget does not support zone routing (got zone={zone!r}). Use match='all', 'octave', 'note', or 'notes'.")
        super().connect_sampler(sampler, **kwargs)


class KeyboardWidget(_Keys):
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


class MidiKeyboardWidget(_Keys):
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


class SettingsWidget(InstrumentWidget):
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


class MidiOutputWidget(InstrumentWidget):
    """A Web MIDI output; sends are commands delivered to the owning widget."""

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


class SequencerWidget(InstrumentWidget):
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
        """Start playback in the owning widget (the session clock when shared)."""
        return self._command("is_playing", True)

    def stop(self):
        """Stop playback in the owning widget."""
        return self._command("is_playing", False)


class SamplerWidget(InstrumentWidget):
    """The sampler on a transports session.

    Sample PCM travels as bytes; zones carry their own bytes. Capturing a
    browser-side clip is a command the owning widget decodes.
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

    def map_slices_to_pads(self, pads, count=None, start_note=36):
        """Put the slices on a :class:`PadWidget` (slicing first when needed) and route the pads here."""
        slices = self.config.sample_slices
        if count is not None or not slices:
            slices = self.slice_sample(count or pads.config.rows * pads.config.cols, start_note=start_note)
        velocity = pads.config.velocity
        pads.configure_grid_for_actions(
            notes=[s["note"] for s in slices],
            actions=[PadAction(note=s["note"], velocity=velocity, label=s.get("label"), slice_index=s["index"]) for s in slices],
        )
        if self.config.channel_index >= 0:
            pads.connect_sampler(self)
        return pads

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
        """Turn a timeline audio clip into a zone, decoded by the owning browser widget.

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
        """Ask the owning widget to decode a browser-side audio URL into a zone.

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


class LauncherWidget(InstrumentWidget):
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

    def tree(self, prefix=""):
        """The launcher element; every view of this widget carries one engine key, so displaying it twice plays once."""
        if not hasattr(self, "_engine_key"):
            self._engine_key = uuid.uuid4().hex
        return super().tree(prefix).prop("engineKey", self._engine_key)

    def add_track(self, name="Track", channel_index=None):
        """Append a track row and return its index."""
        index = len(self.config.tracks)
        self.config.tracks = [*self.config.tracks, {"name": name, "channel_index": index if channel_index is None else channel_index}]
        return index

    def remove_track(self, index):
        """Remove a track row, dropping its slots and shifting later rows."""
        index = int(index)
        tracks = self.config.tracks
        if not 0 <= index < len(tracks):
            return
        removed_channel = tracks[index]["channel_index"]
        next_tracks = []
        for i, track in enumerate(tracks):
            if i == index:
                continue
            item = dict(track)
            if removed_channel >= 0 and item["channel_index"] > removed_channel:
                item["channel_index"] -= 1
            next_tracks.append(item)
        slots = [
            {**slot, "track_index": slot["track_index"] - 1} if slot["track_index"] > index else slot
            for slot in self.config.slots
            if slot["track_index"] != index
        ]
        fields = {"tracks": next_tracks, "slots": slots}
        if self.config.selected_slot.get("track_index") == index:
            fields["selected_slot"] = {}
        self.config.update(**fields)

    def add_scene(self, name=None):
        """Append a scene column and return its index."""
        index = len(self.config.scenes)
        self.config.scenes = [*self.config.scenes, str(name) if name is not None else f"Scene {index + 1}"]
        return index

    def _check_indices(self, track_index, scene_index=None):
        track_index = int(track_index)
        if not 0 <= track_index < len(self.config.tracks):
            raise IndexError(f"track index out of range: {track_index}")
        if scene_index is None:
            return track_index, None
        scene_index = int(scene_index)
        if not 0 <= scene_index < len(self.config.scenes):
            raise IndexError(f"scene index out of range: {scene_index}")
        return track_index, scene_index

    def _find_slot(self, track_index, scene_index):
        for position, slot in enumerate(self.config.slots):
            if slot["track_index"] == track_index and slot["scene_index"] == scene_index:
                return position
        return -1

    def set_slot(self, track_index, scene_index, pattern, *, name=None, step_duration=None, swing=0.0, groove=None):
        """Fill a slot with a pattern and return it.

        ``pattern`` may be a :class:`SequencerWidget` (whose grid, swing and
        groove fill the unspecified arguments), a list of step dicts, or a
        list of voices.
        """
        track_index, scene_index = self._check_indices(track_index, scene_index)
        if isinstance(pattern, SequencerWidget):
            config = pattern.config
            step_duration = config.step_duration if step_duration is None else step_duration
            swing = config.swing if swing == 0.0 else swing
            groove = list(config.groove) if groove is None else groove
            pattern = config.voices_data
        slot = _normalize_launcher_slot(
            {
                "track_index": track_index,
                "scene_index": scene_index,
                "name": name if name is not None else f"{self.config.tracks[track_index]['name']} {scene_index + 1}",
                "voices_data": _slot_voices(pattern),
                "step_duration": 0.25 if step_duration is None else step_duration,
                "swing": swing,
                "groove": groove or [],
            }
        )
        slots = list(self.config.slots)
        position = self._find_slot(track_index, scene_index)
        if position >= 0:
            slots[position] = slot
        else:
            slots.append(slot)
        self.config.slots = slots
        return slot

    def get_slot(self, track_index, scene_index):
        """The slot at ``(track_index, scene_index)``, or ``None``."""
        position = self._find_slot(int(track_index), int(scene_index))
        return dict(self.config.slots[position]) if position >= 0 else None

    def clear_slot(self, track_index, scene_index):
        """Empty a slot."""
        track_index, scene_index = self._check_indices(track_index, scene_index)
        slots = [s for s in self.config.slots if not (s["track_index"] == track_index and s["scene_index"] == scene_index)]
        fields = {"slots": slots}
        if self.config.selected_slot == {"track_index": track_index, "scene_index": scene_index}:
            fields["selected_slot"] = {}
        self.config.update(**fields)

    def bind_slot_editor(self, sequencer):
        """Edit whichever slot is selected in ``sequencer`` (a :class:`SequencerWidget`); returns an unbinder.

        Selecting a slot, in the browser or by assigning ``config.selected_slot``,
        loads it into the sequencer; the sequencer's step, grid, swing and
        groove edits write back into that slot.
        """
        state = {"loading": False}

        def load(*_):
            selected = self.config.selected_slot
            if not selected or self.get_slot(selected["track_index"], selected["scene_index"]) is None:
                return
            state["loading"] = True
            try:
                self.slot_to_sequencer(selected["track_index"], selected["scene_index"], sequencer)
            finally:
                state["loading"] = False

        def write_back(*_):
            selected = self.config.selected_slot
            if state["loading"] or not selected:
                return
            current = self.get_slot(selected["track_index"], selected["scene_index"])
            if current is not None:
                self.set_slot(selected["track_index"], selected["scene_index"], sequencer, name=current["name"])

        stop_select = self.on_change(load, names="selected_slot")
        stop_edit = sequencer.on_change(write_back, names=("voices_data", "step_duration", "swing", "groove"))
        load()

        def unbind():
            stop_select()
            stop_edit()

        return unbind

    def slot_to_sequencer(self, track_index, scene_index, sequencer):
        """Load a slot's pattern, grid, swing and groove into a :class:`SequencerWidget`."""
        slot = self.get_slot(track_index, scene_index)
        if slot is None:
            raise ValueError(f"no slot at track {track_index}, scene {scene_index}")
        voices = [list(voice) for voice in slot["voices_data"]]
        sequencer.config.update(
            step_duration=slot["step_duration"],
            swing=slot["swing"],
            groove=list(slot["groove"]),
            num_voices=max(1, len(voices)),
            length=max(len(voice) for voice in voices),
            voices_data=voices,
        )
        return slot

    def launch(self, track_index, scene_index):
        """Launch a slot on the next quantization boundary."""
        track_index, scene_index = self._check_indices(track_index, scene_index)
        if self._find_slot(track_index, scene_index) < 0:
            raise ValueError(f"no slot at track {track_index}, scene {scene_index}")
        return self._command("request", {"action": "launch", "track_index": track_index, "scene_index": scene_index})

    def stop_track(self, track_index):
        """Stop a track's playing slot."""
        track_index, _ = self._check_indices(track_index)
        return self._command("request", {"action": "stop", "track_index": track_index})

    def launch_scene(self, scene_index):
        """Launch every slot in a scene; tracks with no slot there stop."""
        scene_index = int(scene_index)
        if not 0 <= scene_index < len(self.config.scenes):
            raise IndexError(f"scene index out of range: {scene_index}")
        return self._command("request", {"action": "scene", "scene_index": scene_index})

    def stop_all(self):
        """Stop every playing slot."""
        return self._command("request", {"action": "stop_all"})


class TimelineWidget(InstrumentWidget):
    """The tracking widget on a transports session.

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

    def __init__(self, session=None, *, config=None, **kwargs):
        super().__init__(session, config=config, **kwargs)
        # Clip audio that has arrived from the browser, by clip id, so a
        # session can be saved with its takes. See export_all_clips().
        self._clip_audio = {}
        self._export_queue = []
        self.on_change(self._on_clip_exported, names="exported_clip_data")

    def _on_clip_exported(self, widget, name, old, data):
        exported = self.status.exported_clip
        clip_id = str(exported.get("id", ""))
        if not data or not clip_id:
            return
        self._clip_audio[clip_id] = {"data": bytes(data), "blob_type": str(exported.get("blob_type", ""))}
        if self.config.export_clip_id == clip_id:
            self.config.export_clip_id = ""
        while self._export_queue:
            next_id = self._export_queue.pop(0)
            if any(clip["id"] == next_id for clip in self.config.clips):
                self.export_clip(next_id)
                break

    @property
    def clip_audio(self):
        """Clip audio bytes received from the browser, keyed by clip id."""
        return {clip_id: dict(item) for clip_id, item in self._clip_audio.items()}

    @property
    def pending_exports(self):
        """Number of clip exports still waiting on the browser."""
        return len(self._export_queue) + (1 if self.config.export_clip_id else 0)

    def export_all_clips(self, *, refresh=False):
        """Ask the browser for every clip's audio, one clip at a time; returns the number queued.

        The bytes accumulate in :attr:`clip_audio` as they arrive; wait for
        :attr:`pending_exports` to reach zero before saving. Clips whose audio
        is already cached are skipped unless ``refresh`` is true.
        """
        wanted = [clip["id"] for clip in self.config.clips if clip["audio_url"] and (refresh or clip["id"] not in self._clip_audio)]
        if not wanted:
            return 0
        self._export_queue = wanted[1:]
        self.export_clip(wanted[0])
        return len(wanted)

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

    def remove_track(self, index):
        """Remove a lane, dropping its clips and shifting later lanes."""
        index = int(index)
        tracks = self.config.tracks
        if not 0 <= index < len(tracks):
            return
        removed_channel = tracks[index]["channel_index"]
        next_tracks = []
        for i, track in enumerate(tracks):
            if i == index:
                continue
            item = dict(track)
            if removed_channel >= 0 and item["channel_index"] > removed_channel:
                item["channel_index"] -= 1
            next_tracks.append(item)
        next_clips = []
        for clip in self.config.clips:
            if clip["track_index"] == index:
                continue
            next_clips.append({**clip, "track_index": clip["track_index"] - 1} if clip["track_index"] > index else clip)
        self.config.update(tracks=next_tracks, clips=next_clips)

    def arm_track(self, index, armed=True, *, exclusive=False):
        """Arm or disarm a lane; ``exclusive`` disarms every other lane."""
        index = int(index)
        if not 0 <= index < len(self.config.tracks):
            raise IndexError(f"track index out of range: {index}")
        tracks = []
        for i, track in enumerate(self.config.tracks):
            if i == index:
                tracks.append({**track, "armed": bool(armed)})
            elif exclusive:
                tracks.append({**track, "armed": False})
            else:
                tracks.append(track)
        self.config.tracks = tracks

    def _find_clip(self, clip_id):
        clip_id = str(clip_id)
        for clip in self.config.clips:
            if clip["id"] == clip_id:
                return clip
        raise ValueError(f"clip not found: {clip_id}")

    def _midi_clip(self, clip_id):
        clip = self._find_clip(clip_id)
        if clip["kind"] != "midi":
            raise ValueError(f"clip {clip_id} is not a MIDI clip")
        return clip

    def _append_clip(self, clip):
        config = self.config
        config.update(clips=[*config.clips, clip], selected_clip_id=clip["id"], length=max(config.length, clip["start"] + clip["duration"]))
        return clip

    def add_clip(self, name="Clip", track_index=0, start=0.0, duration=4.0, **kwargs):
        """Append a clip, select it, and grow the timeline to fit it."""
        clip = _normalize_audio_clip(
            AudioClip(name=name, track_index=track_index, start=start, duration=duration, **kwargs).to_dict(),
            len(self.config.clips),
            len(self.config.tracks),
        )
        return self._append_clip(clip)

    def add_midi_clip(self, name="MIDI", track_index=0, start=0.0, events=(), duration=None, **kwargs):
        """Append a MIDI clip; ``duration`` defaults to the end of the last event."""
        normalized = _normalize_midi_events(events)
        if duration is None:
            duration = max([1.0, *(event["beat"] + event["duration"] for event in normalized)])
        return self.add_clip(name, track_index=track_index, start=start, duration=duration, kind="midi", events=normalized, **kwargs)

    def add_pattern_clip(self, name, pattern, track_index=0, start=0.0, step_duration=0.25, repeat=1, duration=None, **kwargs):
        """Append a MIDI clip that plays ``pattern`` (a :class:`SequencerWidget`, step dicts or voices) ``repeat`` times."""
        if isinstance(pattern, SequencerWidget):
            pattern = pattern.config.voices_data
        events, total = _pattern_events(_slot_voices(pattern), step_duration, repeat)
        if duration is None:
            duration = total
        return self.add_midi_clip(name, track_index=track_index, start=start, events=events, duration=duration, pattern=name, **kwargs)

    def export_midi_clip(self, clip_id, path=None):
        """One MIDI clip as a ``mido.MidiFile``, written to ``path`` when given."""
        from nbplay.midi import build_midi

        clip = self._midi_clip(clip_id)
        config = self.config
        midi = build_midi(
            [{"name": clip["name"], "events": clip["events"]}],
            bpm=config.bpm,
            time_signature=(config.time_signature_num, config.time_signature_den),
        )
        if path is not None:
            midi.save(os.fspath(path))
        return midi

    def import_midi(self, source, track_index=0, start=0.0):
        """Add one MIDI clip per MIDI track with notes, all on one lane at ``start``; returns the clips."""
        from nbplay.midi import read_midi

        return [self.add_midi_clip(item["name"], track_index=track_index, start=start, events=item["events"]) for item in read_midi(source)["tracks"]]

    def clip_to_event_sequence(self, clip_id):
        """A MIDI clip's events as a Rust ``EventSequence``."""
        from nbplay import EventSequence, NoteEvent

        sequence = EventSequence()
        for event in self._midi_clip(clip_id)["events"]:
            sequence.add_event(NoteEvent(event["beat"], event["duration"], event["note"], event["velocity"]))
        return sequence

    def remove_clip(self, clip_id):
        """Remove a clip by id."""
        clip_id = str(clip_id)
        fields = {"clips": [clip for clip in self.config.clips if clip["id"] != clip_id]}
        if self.config.selected_clip_id == clip_id:
            fields["selected_clip_id"] = ""
        self.config.update(**fields)

    def _edit_clip(self, clip_id, **fields):
        clip = self._find_clip(clip_id)
        self.config.clips = [{**item, **fields} if item is clip else item for item in self.config.clips]

    def move_clip(self, clip_id, *, track_index=None, start=None):
        """Move a clip to another lane or beat position."""
        fields = {}
        if track_index is not None:
            fields["track_index"] = int(track_index)
        if start is not None:
            fields["start"] = start
        self._edit_clip(clip_id, **fields)

    def resize_clip(self, clip_id, duration):
        """Set a clip's duration in beats."""
        self._edit_clip(clip_id, duration=duration)

    def duplicate_clip(self, clip_id):
        """Copy a clip onto the same lane right after the original; returns the copy."""
        clip = self._find_clip(clip_id)
        copy = _normalize_audio_clip(
            {**clip, "id": _clip_id(), "start": clip["start"] + clip["duration"]}, len(self.config.clips), len(self.config.tracks)
        )
        return self._append_clip(copy)

    def export_clip(self, clip_id):
        """Ask the browser for a clip's audio; it arrives in ``status.exported_clip_data``."""
        self._find_clip(clip_id)
        self.config.export_clip_id = str(clip_id)

    def write_exported_clip(self, path):
        """Write the most recently exported clip's bytes to ``path``; returns the clip."""
        if not self.status.exported_clip_data:
            raise ValueError("no exported clip data; call export_clip() and wait for the browser")
        with open(path, "wb") as handle:
            handle.write(self.status.exported_clip_data)
        return self.status.exported_clip

    def import_clip(self, data, name="Import", track_index=0, start=0.0, duration=None, blob_type="audio/webm", **kwargs):
        """Add a clip backed by audio bytes (or a file path); the browser attaches a playable URL.

        When ``duration`` is omitted the browser measures the audio and fills it in.
        """
        if isinstance(data, (str, os.PathLike)):
            with open(data, "rb") as handle:
                data = handle.read()
        data = bytes(data)
        if not data:
            raise ValueError("import_clip requires non-empty audio bytes")
        clip = self.add_clip(
            name,
            track_index=track_index,
            start=start,
            duration=duration if duration is not None else 4.0,
            source="import",
            blob_type=blob_type,
            blob_size=len(data),
            **kwargs,
        )
        # Bytes first, then the descriptor: the browser acts on the
        # descriptor change and expects the matching bytes to be present.
        self.config.import_clip_data = data
        self.config.import_clip_request = {**clip, "measure_duration": duration is None}
        return clip

    def seek(self, beat):
        """Move a standalone timeline's playhead (a session seeks through its transport)."""
        self.config.current_beat = float(beat)

    def play(self):
        """Start playback in the owning widget."""
        return self._command("is_playing", True)

    def stop(self):
        """Stop playback in the owning widget."""
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
    """Transport, mixer, timeline and launcher widgets sharing one browser session.

    Every widget carries the same ``session_id``, so the browser gives them
    one audio bus and one clock, which keeps play state, position and tempo
    consistent across them. Each widget hosts its models in its own transports
    ``Session``: transports grants a connection ownership of every
    client-owned field in the session it connects to, so widgets that shared
    one would fight over each other's status. In the kernel the :attr:`bpm`,
    :attr:`time_signature` and :attr:`theme` properties write every widget's
    config, :attr:`history` records every widget's config edits for
    :meth:`undo` and :meth:`redo`, and lane mute and solo mirror the mixer
    channels. :meth:`add_pattern` and :meth:`chain` lay named patterns out
    as clips, and :meth:`export_midi` and :meth:`import_midi` move the
    arrangement through ``.mid`` files, and :meth:`save` and :meth:`load`
    read and write the same ``.nbplay`` archive as the traitlets
    :class:`nbplay.widget.Session`.
    """

    def __init__(self, bpm=120.0, time_signature=(4, 4), theme=""):
        self._session_id = f"nbplay-{uuid.uuid4().hex[:8]}"
        num, den = time_signature
        common = {"session_id": self._session_id, "bpm": bpm, "time_signature_num": num, "theme": theme}
        self.transport = TransportWidget(time_signature_den=den, **common)
        self.mixer = MixerWidget(session_id=self._session_id, theme=theme)
        self.timeline = TimelineWidget(time_signature_den=den, **common)
        self.launcher = LauncherWidget(time_signature_den=den, **common)
        self.tracks = []
        # Named patterns for the tracking widget: name -> {voices_data, step_duration}.
        self.patterns = {}
        # Undo/redo over every widget's config; new tracks attach their
        # sequencer and sound source as they are added.
        self.history = History()
        for widget in (self.transport, self.mixer, self.timeline, self.launcher):
            self.history.attach(widget)
        self.history.bind_ipython()
        # Ctrl/Cmd+Z in the browser bumps the transport's request counts.
        self.transport.on_change(lambda widget, name, old, new: self.undo(), names="undo_request")
        self.transport.on_change(lambda widget, name, old, new: self.redo(), names="redo_request")
        # The transport's theme is the session theme, so a browser theme
        # switch bound to it re-themes every widget.
        self.transport.on_change(lambda widget, name, old, new: setattr(self, "theme", new), names="theme")
        # The browser clock carries a tempo edit to every rendered element, but
        # a widget that is not on the page (or does not write the clock's tempo
        # back, like the launcher) would keep its old tempo in the kernel.
        self.transport.on_change(lambda widget, name, old, new: setattr(self, "bpm", new), names="bpm")
        # Lane mute/solo and mixer channel mute/solo are the same control
        # from the user's side; keep them mirrored by channel index.
        self._mirroring_mute_solo = False
        self.timeline.on_change(self._on_timeline_tracks, names="tracks")
        self.mixer.on_change(self._on_mixer_channels, names="channels")

    def _on_timeline_tracks(self, widget, name, old, tracks):
        if self._mirroring_mute_solo:
            return
        channels = [dict(channel) for channel in self.mixer.config.channels]
        changed = False
        for track in tracks:
            index = track["channel_index"]
            if 0 <= index < len(channels):
                for lane_key, channel_key in (("muted", "mute"), ("solo", "solo")):
                    if channels[index][channel_key] != track[lane_key]:
                        channels[index][channel_key] = track[lane_key]
                        changed = True
        if changed:
            self._mirroring_mute_solo = True
            try:
                self.mixer.config.channels = channels
            finally:
                self._mirroring_mute_solo = False

    def _on_mixer_channels(self, widget, name, old, channels):
        if self._mirroring_mute_solo:
            return
        tracks = [dict(track) for track in self.timeline.config.tracks]
        changed = False
        for track in tracks:
            index = track["channel_index"]
            if 0 <= index < len(channels):
                for lane_key, channel_key in (("muted", "mute"), ("solo", "solo")):
                    if track[lane_key] != channels[index][channel_key]:
                        track[lane_key] = channels[index][channel_key]
                        changed = True
        if changed:
            self._mirroring_mute_solo = True
            try:
                self.timeline.config.tracks = tracks
            finally:
                self._mirroring_mute_solo = False

    def undo(self):
        """Revert the latest change to any widget; False when nothing to undo."""
        return self.history.undo()

    def redo(self):
        """Reapply the latest undone change; False when nothing to redo."""
        return self.history.redo()

    @property
    def session_id(self):
        """The browser session id every widget shares."""
        return self._session_id

    @property
    def widgets(self):
        """Every widget in the session, including track instruments."""
        widgets = [self.transport, self.mixer, self.timeline, self.launcher]
        for track in self.tracks:
            widgets.extend(widget for widget in (track.sequencer, track.sound_source) if isinstance(widget, InstrumentWidget))
        return widgets

    @property
    def bpm(self):
        return self.transport.config.bpm

    @bpm.setter
    def bpm(self, value):
        for widget in self.widgets:
            if "bpm" in widget.CONFIG:
                widget.config.bpm = value

    @property
    def time_signature(self):
        return (self.transport.config.time_signature_num, self.transport.config.time_signature_den)

    @time_signature.setter
    def time_signature(self, value):
        num, den = value
        for widget in self.widgets:
            if "time_signature_num" in widget.CONFIG:
                widget.config.time_signature_num = num
            if "time_signature_den" in widget.CONFIG_MODEL.model_fields:
                widget.config.time_signature_den = den

    @property
    def theme(self):
        return self.transport.config.theme

    @theme.setter
    def theme(self, value):
        for widget in self.widgets:
            widget.config.theme = value

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
        with self.history.paused():
            return self._add_track(name, sequencer, sound_source, input=input, armed=armed)

    def _add_track(self, name, sequencer, sound_source, *, input, armed):
        channel = self.mixer.add_channel(name)
        for widget in (sequencer, sound_source):
            if isinstance(widget, InstrumentWidget):
                widget.config.session_id = self._session_id
                widget.config.channel_index = channel
                widget.config.theme = self.theme
                if "bpm" in widget.CONFIG:
                    widget.config.bpm = self.bpm
                if "time_signature_num" in widget.CONFIG:
                    num, den = self.time_signature
                    widget.config.update(time_signature_num=num, time_signature_den=den)
        if input is None:
            input = "channel" if (sequencer is not None or sound_source is not None) else "microphone"
        self.timeline.add_track(name, channel, armed=armed, input=input)
        self.launcher.add_track(name, channel)
        track = Track(name, sequencer, sound_source, channel)
        self.tracks.append(track)
        self.history.attach(sequencer)
        self.history.attach(sound_source)
        return track

    def remove_track(self, index):
        """Remove a track with its mixer channel, timeline lane and launcher row; later tracks shift down."""
        if not 0 <= index < len(self.tracks):
            return
        with self.history.paused():
            track = self.tracks.pop(index)
            self.history.detach(track.sequencer)
            self.history.detach(track.sound_source)
            for widget in (track.sequencer, track.sound_source):
                if isinstance(widget, InstrumentWidget):
                    widget.config.update(session_id="", channel_index=-1)
            self.mixer.remove_channel(track.mixer_channel)
            self.timeline.remove_track(index)
            self.launcher.remove_track(index)
            for item in self.tracks:
                if item.mixer_channel > track.mixer_channel:
                    item.mixer_channel -= 1
                    for widget in (item.sequencer, item.sound_source):
                        if isinstance(widget, InstrumentWidget):
                            widget.config.channel_index -= 1

    def _track_index(self, track):
        if isinstance(track, Track):
            return self.tracks.index(track)
        if isinstance(track, str):
            names = [item.name for item in self.tracks]
            if track not in names:
                raise ValueError(f"no track named {track!r}")
            return names.index(track)
        index = int(track)
        if not 0 <= index < len(self.tracks):
            raise IndexError(f"track index out of range: {index}")
        return index

    def add_pattern(self, name, pattern, step_duration=None):
        """Register a named pattern for chaining; returns its stored form.

        ``pattern`` is a :class:`SequencerWidget` (whose step duration is used),
        a list of step dicts, or a list of voices.
        """
        if isinstance(pattern, SequencerWidget):
            step_duration = pattern.config.step_duration if step_duration is None else step_duration
            pattern = pattern.config.voices_data
        voices = _slot_voices(pattern)
        length = max(len(voice) for voice in voices)
        entry = {
            "voices_data": [[dict(step) for step in voice] + _default_steps(length - len(voice)) for voice in voices],
            "step_duration": _positive_number(0.25 if step_duration is None else step_duration, "step_duration", minimum=0.001, maximum=16.0),
        }
        self.patterns[str(name)] = entry
        return entry

    def remove_pattern(self, name):
        """Forget a pattern; clips already placed keep playing as MIDI clips."""
        del self.patterns[str(name)]

    def chain(self, track, names, start=0.0, repeat=1):
        """Place named patterns back to back on a track's lane; returns the clips.

        A track with a sequencer stops following the transport so the
        arrangement drives it. The whole chain is one undo step.
        """
        index = self._track_index(track)
        item = self.tracks[index]
        missing = [name for name in names if str(name) not in self.patterns]
        if missing:
            raise ValueError(f"unknown pattern(s): {', '.join(map(str, missing))}")
        with self.history.transaction():
            if item.sequencer is not None:
                item.sequencer.config.follow_transport = False
            clips = []
            position = _nonnegative_number(start, "start")
            for name in names:
                pattern = self.patterns[str(name)]
                clip = self.timeline.add_pattern_clip(
                    str(name), pattern["voices_data"], track_index=index, start=position, step_duration=pattern["step_duration"], repeat=repeat
                )
                clips.append(clip)
                position += clip["duration"]
            self.timeline.config.length = max(self.timeline.config.length, math.ceil(position))
            return clips

    def update_pattern(self, name, pattern, step_duration=None):
        """Replace a pattern and regenerate every clip placed from it, as one undo step."""
        name = str(name)
        entry = self.add_pattern(name, pattern, step_duration=step_duration)
        with self.history.transaction():
            clips = []
            for clip in self.timeline.config.clips:
                if clip.get("pattern") != name:
                    clips.append(clip)
                    continue
                length = max(len(voice) for voice in entry["voices_data"]) * entry["step_duration"]
                repeat = max(1, round(clip["duration"] / length)) if length > 0 else 1
                events, _ = _pattern_events(entry["voices_data"], entry["step_duration"], repeat)
                clips.append({**clip, "events": events})
            self.timeline.config.clips = clips
        return entry

    def export_midi(self, path=None):
        """The sequencer patterns and MIDI clips as one ``mido.MidiFile``, written to ``path`` when given.

        Each sequencer track becomes one MIDI track from beat 0; each MIDI
        clip becomes one MIDI track at its timeline position.
        """
        from nbplay.midi import build_midi, steps_to_events

        tracks = []
        for track in self.tracks:
            if track.sequencer is not None:
                config = track.sequencer.config
                events = steps_to_events(config.voices_data, config.step_duration)
                tracks.append({"name": track.name, "events": events, "channel": min(15, max(0, track.mixer_channel))})
        lanes = self.timeline.config.tracks
        for clip in self.timeline.config.clips:
            if clip["kind"] == "midi" and clip["events"]:
                offset = clip["offset"]
                events = [
                    {**event, "beat": clip["start"] + event["beat"] - offset}
                    for event in clip["events"]
                    if event["beat"] >= offset and event["beat"] - offset < clip["duration"]
                ]
                channel = lanes[clip["track_index"]]["channel_index"] if clip["track_index"] < len(lanes) else 0
                tracks.append({"name": clip["name"], "events": events, "channel": min(15, max(0, channel))})
        midi = build_midi(tracks, bpm=self.bpm, time_signature=self.time_signature)
        if path is not None:
            midi.save(os.fspath(path))
        return midi

    def import_midi(self, source, *, apply_tempo=True):
        """Add one MIDI lane per MIDI track with notes, each holding the track as a clip; returns the tracks.

        With ``apply_tempo`` the file's tempo and time signature are applied.
        """
        from nbplay.midi import read_midi

        data = read_midi(source)
        added = []
        with self.history.paused():
            if apply_tempo:
                self.bpm = data["bpm"]
                self.time_signature = tuple(data["time_signature"])
            for item in data["tracks"]:
                track = self.add_track(item["name"], input="midi")
                self.timeline.add_midi_clip(item["name"], track_index=len(self.timeline.config.tracks) - 1, start=0.0, events=item["events"])
                added.append(track)
        return added

    def to_dict(self):
        """The session as a JSON-safe dict (no binary payloads); see :meth:`save`."""
        return _session_to_dict(self)

    def save(self, path):
        """Write the session to a ``.nbplay`` zip archive; returns the path.

        The archive holds ``session.json`` plus ``samples/`` (sampler PCM as
        little-endian float32) and ``clips/`` (timeline clip audio that has
        arrived from the browser; call ``session.timeline.export_all_clips()``
        first and wait for ``pending_exports`` to reach zero). The widget
        session reads the same archive.
        """
        data, resources = _session_to_dict(self, resources={})
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("session.json", json.dumps(data, indent=1))
            for name, payload in resources.items():
                archive.writestr(name, payload)
        return path

    @classmethod
    def load(cls, path):
        """Rebuild a session from an archive written by :meth:`save` (of either session class)."""
        with zipfile.ZipFile(path) as archive:
            data = json.loads(archive.read("session.json"))
            resources = {name: archive.read(name) for name in archive.namelist() if name != "session.json"}
        return cls.from_dict(data, resources)

    @classmethod
    def from_dict(cls, data, resources=None):
        """Rebuild a session from :meth:`to_dict` output plus binary resources."""
        return _session_from_dict(cls, data, resources or {})

    def close(self):
        """Close every widget."""
        for widget in self.widgets:
            widget.close()


def _dump(config, names):
    return _json_copy(config.model_dump(include=set(names)))


def _sound_source_to_dict(source, index, resources):
    if source is None:
        return None
    if isinstance(source, SynthWidget):
        return {"type": "SynthWidget", "state": _dump(source.config, _SYNTH_STATE)}
    if isinstance(source, SamplerWidget):
        config = source.config
        entry = {"type": "SamplerWidget", "state": _dump(config, _SAMPLER_STATE + _SAMPLER_PAD_STATE)}
        if config.sample_data:
            if resources is not None:
                name = f"samples/track-{index}.f32"
                resources[name] = bytes(config.sample_data)
                entry["sample_file"] = name
            entry["sample_length"] = config.sample_length
        if config.zones:
            saved = []
            for zone_index, zone in enumerate(config.zones):
                item = {k: v for k, v in zone.items() if k != "data"}
                if resources is not None:
                    name = f"samples/track-{index}-zone-{zone_index}.f32"
                    resources[name] = bytes(zone["data"])
                    item["sample_file"] = name
                saved.append(item)
            entry["zones"] = saved
        return entry
    raise ValueError(f"cannot save sound source of type {type(source).__name__}; use SynthWidget or SamplerWidget")


def _sound_source_from_dict(entry, resources):
    if entry is None:
        return None
    kind = entry.get("type")
    state = dict(entry.get("state", {}))
    if kind == "SynthWidget":
        return SynthWidget(**{k: v for k, v in state.items() if k in _SYNTH_STATE})
    if kind == "SamplerWidget":
        sampler = SamplerWidget(**{k: v for k, v in state.items() if k in _SAMPLER_STATE})
        sample_file = entry.get("sample_file")
        if sample_file and sample_file in resources:
            sampler.load_sample(
                resources[sample_file],
                sample_rate=state.get("sample_rate", 44100),
                root_note=state.get("root_note", 69),
                name=state.get("sample_name", "Sample"),
            )
        sampler.config.update(**{name: state[name] for name in _SAMPLER_PAD_STATE if name in state})
        zones = []
        for zone in entry.get("zones", []):
            sample_file = zone.get("sample_file")
            data = resources.get(sample_file, b"") if sample_file else b""
            zones.append({**{k: v for k, v in zone.items() if k != "sample_file"}, "data": data})
        if zones:
            sampler.config.zones = zones
        return sampler
    raise ValueError(f"unknown sound source type in session data: {kind!r}")


def _sequencer_from_dict(state):
    if state is None:
        return None
    ctor = {k: state[k] for k in ("num_voices", "length", "measures", "step_duration", "time_signature_num", "time_signature_den") if k in state}
    sequencer = SequencerWidget(**ctor)
    fields = {name: state[name] for name in ("swing", "groove", "automation_lanes", "loop_enabled", "follow_transport") if name in state}
    if state.get("voices_data"):
        fields["voices_data"] = _json_copy(state["voices_data"])
    sequencer.config.update(**fields)
    return sequencer


def _session_to_dict(session, resources=None):
    tracks = []
    for index, track in enumerate(session.tracks):
        sequencer = None
        if track.sequencer is not None:
            sequencer = _dump(track.sequencer.config, (*_SEQUENCER_STATE, "voices_data"))
        tracks.append({"name": track.name, "sequencer": sequencer, "sound_source": _sound_source_to_dict(track.sound_source, index, resources)})
    clips = []
    cached = session.timeline.clip_audio
    for clip in session.timeline.config.clips:
        item = {k: v for k, v in clip.items() if k != "audio_url"}
        audio = cached.get(clip["id"])
        if audio and resources is not None:
            name = f"clips/{clip['id']}.bin"
            resources[name] = audio["data"]
            item["audio_file"] = name
            if audio.get("blob_type"):
                item["blob_type"] = audio["blob_type"]
        clips.append(_json_copy(item))
    data = {
        "format": _SESSION_FORMAT,
        "version": _SESSION_FORMAT_VERSION,
        "nbplay": __version__,
        "transport": _dump(session.transport.config, _TRANSPORT_STATE),
        "mixer": _dump(session.mixer.config, ("channels", "master_gain", "master_effects", "returns")),
        "tracks": tracks,
        "timeline": {**_dump(session.timeline.config, _TIMELINE_STATE), "tracks": _json_copy(session.timeline.config.tracks), "clips": clips},
        "launcher": _dump(session.launcher.config, ("quantize", "scenes", "slots")),
        "patterns": _json_copy(session.patterns),
        "theme": session.theme,
    }
    return (data, resources) if resources is not None else data


def _session_from_dict(cls, data, resources):
    if data.get("format") != _SESSION_FORMAT:
        raise ValueError(f"not an nbplay session: format={data.get('format')!r}")
    if int(data.get("version", 0)) > _SESSION_FORMAT_VERSION:
        raise ValueError(f"session format version {data['version']} is newer than this nbplay supports")
    transport = data.get("transport", {})
    session = cls(
        bpm=transport.get("bpm", 120.0),
        time_signature=(transport.get("time_signature_num", 4), transport.get("time_signature_den", 4)),
        theme=data.get("theme", ""),
    )
    session.transport.config.update(**{name: transport[name] for name in ("loop_enabled", "loop_start_bar", "loop_end_bar") if name in transport})

    timeline_data = data.get("timeline", {})
    saved_lanes = timeline_data.get("tracks", [])
    for index, track in enumerate(data.get("tracks", [])):
        lane = saved_lanes[index] if index < len(saved_lanes) else {}
        session.add_track(
            track.get("name", f"Track {index + 1}"),
            _sequencer_from_dict(track.get("sequencer")),
            _sound_source_from_dict(track.get("sound_source"), resources),
            input=lane.get("input"),
            armed=bool(lane.get("armed", False)),
        )

    mixer = data.get("mixer", {})
    session.mixer.config.update(**{name: mixer[name] for name in ("returns", "channels", "master_gain", "master_effects") if name in mixer})

    timeline = session.timeline
    fields = {name: timeline_data[name] for name in _TIMELINE_STATE if name in timeline_data}
    if saved_lanes:
        fields["tracks"] = saved_lanes
    timeline.config.update(**fields)
    for clip in timeline_data.get("clips", []):
        fields = {k: v for k, v in clip.items() if k != "audio_file"}
        audio_file = clip.get("audio_file")
        if audio_file and audio_file in resources:
            timeline.import_clip(
                resources[audio_file],
                name=fields.pop("name", "Clip"),
                track_index=fields.pop("track_index", 0),
                start=fields.pop("start", 0.0),
                duration=fields.pop("duration", 4.0),
                blob_type=fields.pop("blob_type", "audio/webm"),
                **{k: v for k, v in fields.items() if k not in ("blob_size", "source")},
            )
        else:
            timeline.add_clip(
                fields.pop("name", "Clip"),
                track_index=fields.pop("track_index", 0),
                start=fields.pop("start", 0.0),
                duration=fields.pop("duration", 4.0),
                **fields,
            )
    timeline.config.selected_clip_id = ""

    launcher_data = data.get("launcher", {})
    for name in launcher_data.get("scenes", []):
        session.launcher.add_scene(name)
    session.launcher.config.update(**{name: launcher_data[name] for name in ("slots", "quantize") if name in launcher_data})
    for name, pattern in data.get("patterns", {}).items():
        session.add_pattern(name, pattern.get("voices_data", []), step_duration=pattern.get("step_duration", 0.25))
    session.history.clear()
    return session
