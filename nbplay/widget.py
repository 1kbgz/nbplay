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
import math
import pathlib
import uuid
import wave
from typing import ClassVar

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
    return {"note": 60, "velocity": 100, "duration_ticks": 1, "active": False, "probability": 100}


def _default_steps(length):
    return [_default_step() for _ in range(length)]


_DEFAULT_PAD_NOTES = [48, 52, 55, 59, 60, 64, 67, 71]
_PAD_MAX_COUNT = 128


def _clamp_int(value, low, high):
    return max(low, min(high, int(value)))


def _clamp_midi_note(value):
    return _clamp_int(value, 0, 127)


def _clamp_velocity(value):
    return _clamp_int(value, 1, 127)


def _pack_float32(samples):
    buf = array.array("f", [max(-1.0, min(1.0, float(s))) for s in samples])
    return buf.tobytes()


def _unpack_float32(data):
    if not data:
        return []
    buf = array.array("f")
    buf.frombytes(data)
    return list(buf)


def _decimate_samples(samples, max_points=2048):
    if len(samples) <= max_points:
        return list(samples)
    step = len(samples) / max_points
    return [samples[int(i * step)] for i in range(max_points)]


def _resize_number_list(values, count, fill, clamp):
    count = max(1, min(_PAD_MAX_COUNT, int(count)))
    resized = [clamp(v) for v in list(values)[:count]]
    while len(resized) < count:
        resized.append(clamp(fill))
    return resized


def _measure_beats(time_signature_num, time_signature_den):
    return max(0.0, time_signature_num * (4.0 / max(1, time_signature_den)))


def _step_duration_for_length(length, measures=1, time_signature_num=4, time_signature_den=4):
    length = max(1, int(length))
    measures = max(1, int(measures))
    return max(0.001, (measures * _measure_beats(time_signature_num, time_signature_den)) / length)


def _resize_pad_notes(notes, pad_count):
    pad_count = max(1, int(pad_count))
    resized = [_clamp_midi_note(note) for note in list(notes)[:pad_count]]
    next_note = resized[-1] + 1 if resized else _DEFAULT_PAD_NOTES[0]
    while len(resized) < pad_count:
        resized.append(_clamp_midi_note(next_note))
        next_note += 1
    return resized


def _resize_pad_velocities(velocities, pad_count, velocity=100):
    return _resize_number_list(velocities, pad_count, velocity, _clamp_velocity)


def _safe_trait_name(value):
    text = str(value)
    return text.isidentifier() and not text.startswith("_")


class EffectPlugin:
    """Validated Web Audio effect descriptor for mixer insert chains."""

    _VALID_TYPES = frozenset({"gain", "filter", "delay", "reverb", "compressor", "limiter"})
    _FILTER_TYPES = frozenset({"lowpass", "highpass", "bandpass", "notch", "lowshelf", "highshelf", "peaking"})

    def __init__(self, type, **params):
        if type not in self._VALID_TYPES:
            raise ValueError(f"type must be one of {sorted(self._VALID_TYPES)}, got {type!r}")
        self.type = type
        self.params = self._normalize_params(type, params)

    @staticmethod
    def _param(params, *names, default=None):
        for name in names:
            value = params.get(name)
            if value is not None and value != "":
                return value
        return default

    @classmethod
    def _number(cls, params, *names, default, low, high):
        value = cls._param(params, *names, default=default)
        if isinstance(value, bool):
            raise ValueError(f"{names[0]} must be numeric, got bool")  # noqa: TRY004
        numeric = float(value)
        if not math.isfinite(numeric):
            raise ValueError(f"{names[0]} must be finite, got {value!r}")
        return max(low, min(high, numeric))

    def _normalize_params(self, type, params):
        if type == "gain":
            return {"gain": self._number(params, "gain", default=1.0, low=0.0, high=4.0)}
        if type == "filter":
            filter_type = str(self._param(params, "filter_type", "mode", default="lowpass"))
            if filter_type not in self._FILTER_TYPES:
                raise ValueError(f"filter_type must be one of {sorted(self._FILTER_TYPES)}, got {filter_type!r}")
            return {
                "filter_type": filter_type,
                "frequency": self._number(params, "frequency", "cutoff", default=1200.0, low=20.0, high=20000.0),
                "q": self._number(params, "q", "Q", default=1.0, low=0.0001, high=100.0),
            }
        if type == "delay":
            return {
                "time": self._number(params, "time", default=0.25, low=0.0, high=5.0),
                "feedback": self._number(params, "feedback", default=0.25, low=0.0, high=0.95),
                "wet": self._number(params, "wet", default=0.35, low=0.0, high=1.0),
            }
        if type == "reverb":
            return {
                "seconds": self._number(params, "seconds", default=1.5, low=0.01, high=10.0),
                "decay": self._number(params, "decay", default=2.0, low=0.01, high=12.0),
                "wet": self._number(params, "wet", default=0.25, low=0.0, high=1.0),
            }
        if type == "compressor":
            return {
                "threshold": self._number(params, "threshold", default=-24.0, low=-100.0, high=0.0),
                "knee": self._number(params, "knee", default=30.0, low=0.0, high=40.0),
                "ratio": self._number(params, "ratio", default=12.0, low=1.0, high=20.0),
                "attack": self._number(params, "attack", default=0.003, low=0.0, high=1.0),
                "release": self._number(params, "release", default=0.25, low=0.0, high=1.0),
            }
        return {
            "threshold": self._number(params, "threshold", default=-1.0, low=-100.0, high=0.0),
            "release": self._number(params, "release", default=0.05, low=0.0, high=1.0),
        }

    def to_dict(self):
        return {"type": self.type, **self.params}

    def __repr__(self):
        return f"EffectPlugin({self.to_dict()!r})"

    def __eq__(self, other):
        if not isinstance(other, EffectPlugin):
            return NotImplemented
        return self.to_dict() == other.to_dict()

    def __hash__(self):
        return hash(_freeze_effect_value(self.to_dict()))


def _json_safe_effect_value(value, path="effect param"):
    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError(f"{path} must be finite, got {value!r}")
        return value
    if isinstance(value, (list, tuple)):
        return [_json_safe_effect_value(item, path) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_safe_effect_value(item, f"{path}.{key}") for key, item in value.items()}
    raise ValueError(f"{path} must be JSON-serializable, got {type(value).__name__}")


def _freeze_effect_value(value):
    if isinstance(value, dict):
        return tuple(sorted((str(key), _freeze_effect_value(item)) for key, item in value.items()))
    if isinstance(value, list):
        return tuple(_freeze_effect_value(item) for item in value)
    return value


def _normalize_effect(effect):
    if isinstance(effect, EffectPlugin):
        return effect.to_dict()
    if not isinstance(effect, dict):
        raise ValueError(f"effect must be dict or EffectPlugin, got {type(effect).__name__}")  # noqa: TRY004
    kind = str(effect.get("type", ""))
    if not kind or kind.startswith("_"):
        raise ValueError(f"effect type must be a non-private string, got {kind!r}")
    params = {k: v for k, v in effect.items() if k != "type"}
    if kind not in EffectPlugin._VALID_TYPES:
        normalized = {"type": kind}
        for key, value in params.items():
            normalized[str(key)] = _json_safe_effect_value(value, f"{kind}.{key}")
        return normalized
    return EffectPlugin(kind, **params).to_dict()


def _normalize_effects(effects):
    return [_normalize_effect(effect) for effect in list(effects or [])]


def _clamped_number(value, low, high, name):
    if value is None or isinstance(value, bool):
        raise ValueError(f"{name} must be numeric, got {value!r}")
    numeric = float(value)
    if not math.isfinite(numeric):
        raise ValueError(f"{name} must be finite, got {value!r}")
    return max(low, min(high, numeric))


def _normalize_mixer_channel(channel, index=0):
    if not isinstance(channel, dict):
        raise ValueError(f"channel must be dict, got {type(channel).__name__}")  # noqa: TRY004
    normalized = dict(channel)
    normalized["name"] = str(normalized.get("name", f"Ch {index + 1}"))
    normalized["gain"] = _clamped_number(normalized.get("gain", 0.8), 0.0, 2.0, "gain")
    normalized["pan"] = _clamped_number(normalized.get("pan", 0.0), -1.0, 1.0, "pan")
    normalized["mute"] = bool(normalized.get("mute", False))
    normalized["solo"] = bool(normalized.get("solo", False))
    normalized["effects"] = _normalize_effects(normalized.get("effects", []))
    return normalized


def _clip_id():
    return f"clip-{uuid.uuid4().hex[:8]}"


def _positive_number(value, name, minimum=0.001, maximum=4096.0):
    return _clamped_number(value, minimum, maximum, name)


def _nonnegative_number(value, name, maximum=4096.0):
    return _clamped_number(value, 0.0, maximum, name)


def _normalize_timeline_track(track, index=0):
    if isinstance(track, TimelineTrack):
        return track.to_dict()
    if not isinstance(track, dict):
        raise ValueError(f"timeline track must be dict or TimelineTrack, got {type(track).__name__}")  # noqa: TRY004
    channel = int(track.get("channel_index", index))
    return {
        "name": str(track.get("name", f"Track {index + 1}")),
        "channel_index": max(-1, channel),
        "armed": bool(track.get("armed", False)),
        "muted": bool(track.get("muted", False)),
        "solo": bool(track.get("solo", False)),
        "input": str(track.get("input", "microphone")),
        "monitor": bool(track.get("monitor", False)),
    }


def _normalize_timeline_tracks(tracks):
    return [_normalize_timeline_track(track, index) for index, track in enumerate(tracks or [])]


def _normalize_audio_clip(clip, index=0, track_count=None):
    if isinstance(clip, AudioClip):
        data = clip.to_dict()
    elif isinstance(clip, dict):
        data = dict(clip)
    else:
        raise ValueError(f"audio clip must be dict or AudioClip, got {type(clip).__name__}")  # noqa: TRY004

    track_index = max(0, int(data.get("track_index", 0)))
    if track_count:
        track_index = min(track_index, max(0, int(track_count) - 1))

    normalized = {
        "id": str(data.get("id") or _clip_id()),
        "name": str(data.get("name", f"Clip {index + 1}")),
        "track_index": track_index,
        "start": _nonnegative_number(data.get("start", 0.0), "start"),
        "duration": _positive_number(data.get("duration", 4.0), "duration"),
        "loop": bool(data.get("loop", False)),
        "muted": bool(data.get("muted", False)),
        "recorded": bool(data.get("recorded", False)),
        "audio_url": str(data.get("audio_url", "")),
        "blob_type": str(data.get("blob_type", "")),
        "source": str(data.get("source", "recording")),
        "sample_rate": max(1, int(data.get("sample_rate", 44100))),
    }
    if data.get("blob_size") is not None:
        normalized["blob_size"] = max(0, int(data["blob_size"]))
    if data.get("color") is not None:
        normalized["color"] = str(data["color"])
    return normalized


def _normalize_audio_clips(clips, track_count=None):
    return [_normalize_audio_clip(clip, index, track_count) for index, clip in enumerate(clips or [])]


class AudioClip:
    """Serializable audio clip descriptor for timeline lanes."""

    def __init__(
        self,
        *,
        id=None,
        name="Clip",
        track_index=0,
        start=0.0,
        duration=4.0,
        loop=False,
        muted=False,
        recorded=False,
        audio_url="",
        blob_type="",
        source="recording",
        sample_rate=44100,
        blob_size=None,
        color=None,
    ):
        data = {
            "id": id or _clip_id(),
            "name": name,
            "track_index": track_index,
            "start": start,
            "duration": duration,
            "loop": loop,
            "muted": muted,
            "recorded": recorded,
            "audio_url": audio_url,
            "blob_type": blob_type,
            "source": source,
            "sample_rate": sample_rate,
        }
        if blob_size is not None:
            data["blob_size"] = blob_size
        if color is not None:
            data["color"] = color
        self._data = _normalize_audio_clip(data)

    def to_dict(self):
        return dict(self._data)

    def __repr__(self):
        return f"AudioClip({self._data!r})"

    def __eq__(self, other):
        if not isinstance(other, AudioClip):
            return NotImplemented
        return self.to_dict() == other.to_dict()


class TimelineTrack:
    """Serializable track-lane descriptor for ``TimelineWidget``."""

    def __init__(
        self,
        *,
        name="Track",
        channel_index=0,
        armed=False,
        muted=False,
        solo=False,
        input="microphone",
        monitor=False,
    ):
        self._data = _normalize_timeline_track(
            {
                "name": name,
                "channel_index": channel_index,
                "armed": armed,
                "muted": muted,
                "solo": solo,
                "input": input,
                "monitor": monitor,
            }
        )

    def to_dict(self):
        return dict(self._data)

    def __repr__(self):
        return f"TimelineTrack({self._data!r})"

    def __eq__(self, other):
        if not isinstance(other, TimelineTrack):
            return NotImplemented
        return self.to_dict() == other.to_dict()


class PadAction:
    """Validated pad action descriptor.

    ``type="note"`` is the current playback path. ``type="trait"`` and
    ``type="event"`` provide a stable synced shape for future controller pads.
    """

    _VALID_TYPES = frozenset({"note", "trait", "event"})

    def __init__(
        self,
        *,
        type="note",
        note=60,
        velocity=None,
        trait=None,
        value=None,
        label=None,
        slice_index=None,
    ):
        if type not in self._VALID_TYPES:
            raise ValueError(f"type must be one of {sorted(self._VALID_TYPES)}, got {type!r}")
        self.type = type
        self.note = _clamp_midi_note(note)
        self.velocity = None if velocity is None else _clamp_velocity(velocity)
        self.trait = None
        self.value = value
        self.label = str(label) if label is not None else None
        self.slice_index = None if slice_index is None else max(0, int(slice_index))

        if type == "trait":
            if trait is None or not _safe_trait_name(trait):
                raise ValueError(f"trait must be a public Python identifier, got {trait!r}")
            if not isinstance(value, (int, float, bool, str)):
                raise ValueError("trait pad action value must be int, float, bool, or str")
            self.trait = str(trait)

    def to_dict(self):
        if self.type == "trait":
            data = {"type": "trait", "trait": self.trait, "value": self.value}
        elif self.type == "event":
            data = {"type": "event"}
            if self.value is not None:
                data["value"] = self.value
        else:
            data = {"type": "note", "note": self.note}
            if self.velocity is not None:
                data["velocity"] = self.velocity
            if self.slice_index is not None:
                data["slice"] = self.slice_index
        if self.label is not None:
            data["label"] = self.label
        return data

    def __repr__(self):
        return f"PadAction({self.to_dict()!r})"

    def __eq__(self, other):
        if not isinstance(other, PadAction):
            return NotImplemented
        return self.to_dict() == other.to_dict()


def _normalize_pad_action(action, default_note=60, default_velocity=100, prefer_defaults=False):
    if isinstance(action, PadAction):
        return action.to_dict()
    if not isinstance(action, dict):
        return PadAction(note=default_note, velocity=default_velocity).to_dict()

    kind = action.get("type", "note")
    label = action.get("label")
    if kind == "trait":
        try:
            return PadAction(
                type="trait",
                trait=action.get("trait"),
                value=action.get("value"),
                label=label,
            ).to_dict()
        except ValueError:
            return PadAction(note=default_note, velocity=default_velocity).to_dict()
    if kind == "event":
        return PadAction(type="event", value=action.get("value"), label=label).to_dict()
    return PadAction(
        note=default_note if prefer_defaults else action.get("note", default_note),
        velocity=default_velocity if prefer_defaults else action.get("velocity", default_velocity),
        label=label,
        slice_index=action.get("slice"),
    ).to_dict()


def _normalize_pad_actions(actions, pad_count, pad_notes=None, pad_velocities=None, prefer_defaults=False):
    pad_count = max(1, min(_PAD_MAX_COUNT, int(pad_count)))
    raw_actions = list(actions or [])
    notes = list(pad_notes or [])
    velocities = list(pad_velocities or [])
    normalized = []
    for i in range(pad_count):
        note = notes[i] if i < len(notes) else (notes[-1] + i - len(notes) + 1 if notes else 60)
        velocity = velocities[i] if i < len(velocities) else (velocities[-1] if velocities else 100)
        normalized.append(
            _normalize_pad_action(
                raw_actions[i] if i < len(raw_actions) else None,
                note,
                velocity,
                prefer_defaults=prefer_defaults,
            )
        )
    return normalized


def _normalize_sample_slices(slices, sample_length=0):
    normalized = []
    max_len = max(0, int(sample_length))
    for i, raw in enumerate(slices or []):
        if not isinstance(raw, dict):
            continue
        start = max(0, int(raw.get("start", 0)))
        end = max(0, int(raw.get("end", max_len)))
        if max_len:
            start = min(start, max_len)
            end = min(end, max_len)
        if end <= start:
            continue
        item = {
            "index": max(0, int(raw.get("index", i))),
            "note": _clamp_midi_note(raw.get("note", 36 + i)),
            "start": start,
            "end": end,
        }
        if raw.get("label") is not None:
            item["label"] = str(raw["label"])
        normalized.append(item)
    return normalized


class SynthWidget(anywidget.AnyWidget):
    """Interactive synthesizer widget for Jupyter environments.

    Args:
        oscillator_type: One of ``"sine"``, ``"square"``, ``"saw"``, ``"noise"``.
        frequency: Oscillator frequency in Hz (20–8000).
        amplitude: Oscillator amplitude (0.0–1.0).
        sample_rate: Sample rate used for the waveform preview.
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
    """Mixer console with per-channel faders, pan, mute/solo, and master fader.

    Channels are synced as a JSON list of dicts with keys
    ``name``, ``gain``, ``pan``, ``mute``, ``solo``.

    The ``Mixer`` Rust object can be used for offline rendering
    via ``mix_down()``; this widget provides the interactive UI.
    """

    _esm = _STATIC / "mixer.js"
    _css = _STATIC / "mixer.css"

    # JSON-serialized list of channel dicts
    channels = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)
    master_gain = traitlets.Float(0.8).tag(sync=True)
    master_effects = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)

    # Session routing (set by Session to enable shared AudioContext)
    session_id = traitlets.Unicode("").tag(sync=True)

    @traitlets.validate("channels")
    def _validate_channels(self, proposal):
        return [_normalize_mixer_channel(channel, index) for index, channel in enumerate(proposal["value"] or [])]

    @traitlets.validate("master_effects")
    def _validate_master_effects(self, proposal):
        return _normalize_effects(proposal["value"])

    def add_channel(self, name="Channel"):
        """Add a new channel strip.

        Args:
            name: Display name for the channel.

        Returns:
            Index of the new channel.
        """
        ch = {"name": name, "gain": 0.8, "pan": 0.0, "mute": False, "solo": False, "effects": []}
        self.channels = [*self.channels, ch]
        return len(self.channels) - 1

    def remove_channel(self, index):
        """Remove a channel by index.

        Args:
            index: Zero-based channel index.
        """
        chs = list(self.channels)
        if 0 <= index < len(chs):
            chs.pop(index)
            self.channels = chs

    def set_channel_gain(self, index, gain):
        chs = list(self.channels)
        if 0 <= index < len(chs):
            chs[index] = {**chs[index], "gain": _clamped_number(gain, 0.0, 2.0, "gain")}
            self.channels = chs

    def set_channel_pan(self, index, pan):
        chs = list(self.channels)
        if 0 <= index < len(chs):
            chs[index] = {**chs[index], "pan": _clamped_number(pan, -1.0, 1.0, "pan")}
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

    def set_channel_effects(self, index, effects):
        """Replace a channel's browser insert effect chain."""
        chs = list(self.channels)
        if 0 <= index < len(chs):
            chs[index] = {**chs[index], "effects": _normalize_effects(effects)}
            self.channels = chs

    def add_channel_effect(self, index, effect):
        """Append one effect descriptor to a channel insert chain."""
        chs = list(self.channels)
        if 0 <= index < len(chs):
            effects = _normalize_effects(chs[index].get("effects", []))
            effects.append(_normalize_effect(effect))
            chs[index] = {**chs[index], "effects": effects}
            self.channels = chs

    def clear_channel_effects(self, index):
        """Remove all browser insert effects from a channel."""
        self.set_channel_effects(index, [])

    def set_master_effects(self, effects):
        """Replace the master bus browser insert effect chain."""
        self.master_effects = _normalize_effects(effects)

    def add_master_effect(self, effect):
        """Append one effect descriptor to the master bus effect chain."""
        self.master_effects = [*self.master_effects, _normalize_effect(effect)]

    def clear_master_effects(self):
        """Remove all browser insert effects from the master bus."""
        self.master_effects = []

    def to_mixer(self):
        """Build a Rust ``Mixer`` matching the current widget state.

        Returns:
            A new ``nbplay.Mixer`` instance.
        """
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
    A monophonic sequencer has one composer; a polyphonic sequencer
    has *N* composers sharing the same step clock.

    Args:
        length: Number of steps.
    """

    steps = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)

    def __init__(self, length=16, **kwargs):
        super().__init__(**kwargs)
        self._length = length
        if not self.steps:
            self.steps = _default_steps(length)

    def resize(self, length):
        """Resize the step list, preserving existing steps where possible.

        Args:
            length: New step count (truncates or extends with defaults).
        """
        length = max(1, int(length))
        current = [dict(step) for step in self.steps]
        if len(current) < length:
            current.extend(_default_steps(length - len(current)))
        else:
            current = current[:length]
        self._length = length
        self.steps = current

    def set_step(self, index, note=60, velocity=100, duration_ticks=1, active=True, probability=100):
        """Set a step at the given index.

        Args:
            index: Zero-based step index.
            note: MIDI note number (0–127).
            velocity: MIDI velocity (1–127).
            duration_ticks: Step duration in ticks.
            active: Whether the step is active.
            probability: Trigger probability (0–100).
        """
        steps = list(self.steps)
        if 0 <= index < len(steps):
            steps[index] = {
                "note": note,
                "velocity": velocity,
                "duration_ticks": duration_ticks,
                "active": active,
                "probability": max(0, min(100, float(probability))),
            }
            self.steps = steps

    def toggle_step(self, index):
        """Toggle the active state of a step.

        Args:
            index: Zero-based step index.
        """
        steps = list(self.steps)
        if 0 <= index < len(steps):
            steps[index] = {**steps[index], "active": not steps[index]["active"]}
            self.steps = steps

    def clear(self):
        """Deactivate all steps."""
        self.steps = [{**s, "active": False} for s in self.steps]

    def to_pattern(self, loop_enabled=True):
        """Build a Rust ``Pattern`` from the current state.

        Args:
            loop_enabled: Whether the pattern should loop.

        Returns:
            A new ``nbplay.Pattern`` instance.
        """
        from nbplay import Pattern as RustPattern, Step as RustStep

        p = RustPattern(len(self.steps))
        for i, s in enumerate(self.steps):
            step = RustStep(s["note"], s["velocity"], s.get("duration_ticks", 1))
            step.active = s.get("active", False)
            p.set_step(i, step)
        p.loop_enabled = loop_enabled
        return p

    def __repr__(self):
        active = sum(1 for s in self.steps if s["active"])
        return f"NoteComposer(length={len(self.steps)}, active={active})"


class SequencerWidget(anywidget.AnyWidget):
    """Step sequencer widget with a grid-based pattern editor.

    Supports monophonic (``num_voices=1``) and polyphonic
    (``num_voices=N``) modes. Internally each voice is a
    ``NoteComposer``; the ``steps`` property aliases ``voices[0].steps``.

    Args:
        num_voices: Number of voices (1 = monophonic, N = polyphonic).
        length: Number of steps.
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
    swing = traitlets.Float(0.0).tag(sync=True)
    groove = traitlets.List(trait=traitlets.Float(), default_value=[]).tag(sync=True)
    automation_lanes = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)
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

    @traitlets.validate("swing")
    def _validate_swing(self, proposal):
        return max(0.0, min(100.0, float(proposal["value"])))

    @traitlets.validate("groove")
    def _validate_groove(self, proposal):
        return [max(-50.0, min(50.0, float(v))) for v in proposal["value"]]

    @traitlets.validate("automation_lanes")
    def _validate_automation_lanes(self, proposal):
        lanes = []
        for lane in proposal["value"]:
            if not isinstance(lane, dict):
                continue
            trait = str(lane.get("trait", "")).strip()
            if not trait or not all(ch.isalnum() or ch == "_" for ch in trait):
                continue
            points = []
            for point in lane.get("points", []):
                if not isinstance(point, dict):
                    continue
                try:
                    step = max(0, int(point["step"]))
                    value = float(point["value"])
                except (KeyError, TypeError, ValueError):
                    continue
                points.append({"step": step, "value": value})
            if points:
                lanes.append({"trait": trait, "points": sorted(points, key=lambda p: p["step"])})
        return lanes

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
        return max(1, round((measures * self._measure_beats()) / step_duration))

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
        """Configure pattern length from measure count and step duration.

        ``step_duration`` is in quarter-note beats. In 4/4, ``0.5``
        gives eighth-notes and ``0.25`` gives sixteenth-notes.

        Args:
            measures: Number of measures (bars).
            step_duration: Step duration in quarter-note beats.
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

    def set_step(self, index, note=60, velocity=100, duration_ticks=1, active=True, voice=0, probability=100):
        """Set a step at the given index on the given voice.

        Args:
            index: Zero-based step index.
            note: MIDI note number (0–127).
            velocity: MIDI velocity (1–127).
            duration_ticks: Step duration in ticks.
            active: Whether the step is active.
            voice: Voice index (0-based).
            probability: Trigger probability (0–100).
        """
        if 0 <= voice < len(self._composers):
            self._composers[voice].set_step(index, note, velocity, duration_ticks, active, probability)

    def toggle_step(self, index, voice=0):
        """Toggle the active state of a step on the given voice.

        Args:
            index: Zero-based step index.
            voice: Voice index (0-based).
        """
        if 0 <= voice < len(self._composers):
            self._composers[voice].toggle_step(index)

    def clear(self):
        """Deactivate all steps across all voices."""
        for c in self._composers:
            c.clear()

    def to_pattern(self, voice=0):
        """Build a Rust ``Pattern`` from the given voice.

        Args:
            voice: Voice index (0-based).

        Returns:
            A ``nbplay.Pattern``, or ``None`` if voice is out of range.
        """
        if 0 <= voice < len(self._composers):
            return self._composers[voice].to_pattern(loop_enabled=self.loop_enabled)
        return None

    def to_step_sequencer(self, channel=0, voice=0):
        """Build a Rust ``StepSequencer`` from the given voice.

        Args:
            channel: MIDI channel.
            voice: Voice index (0-based).

        Returns:
            A ``nbplay.StepSequencer``, or ``None`` if voice is out of range.
        """
        from nbplay import StepSequencer as RustStepSequencer

        pattern = self.to_pattern(voice=voice)
        if pattern is None:
            return None
        seq = RustStepSequencer(pattern, channel)
        seq.step_duration = self.step_duration
        return seq


class SamplerWidget(anywidget.AnyWidget):
    """Sampler widget with waveform display, envelope, and trigger pads.

    Sample data is synced as binary Float32Array bytes for
    waveform visualisation. Envelope parameters are synced
    as individual traits.
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
    sample_data = traitlets.Bytes(b"").tag(sync=True)

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
    pad_velocities = traitlets.List(trait=traitlets.Int(), default_value=[]).tag(sync=True)
    pad_actions = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)
    sample_slices = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)
    pad_count = traitlets.Int(8).tag(sync=True)
    velocity = traitlets.Int(100).tag(sync=True)
    velocity_sensitive = traitlets.Bool(True).tag(sync=True)
    active_pads = traitlets.List(trait=traitlets.Int(), default_value=[]).tag(sync=True)
    last_note_event = traitlets.Dict(default_value={}).tag(sync=True)
    last_pad_event = traitlets.Dict(default_value={}).tag(sync=True)

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
        self.pad_velocities = _resize_pad_velocities(self.pad_velocities, self.pad_count, self.velocity)
        self.pad_actions = _normalize_pad_actions(self.pad_actions, self.pad_count, self.pad_notes, self.pad_velocities)
        self.sample_slices = _normalize_sample_slices(self.sample_slices, self.sample_length)
        self.observe(self._on_pad_count_change, names=["pad_count"])
        self.observe(self._on_pad_notes_change, names=["pad_notes"])
        self.observe(self._on_pad_velocities_change, names=["pad_velocities"])
        self.observe(self._on_pad_actions_change, names=["pad_actions"])
        self.observe(self._on_sample_slices_change, names=["sample_slices"])

    @traitlets.validate("velocity")
    def _validate_velocity(self, proposal):
        return _clamp_velocity(proposal["value"])

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
            self.pad_velocities = _resize_pad_velocities(self.pad_velocities, pad_count, self.velocity)
            self.pad_actions = _normalize_pad_actions(
                self.pad_actions,
                pad_count,
                self.pad_notes,
                self.pad_velocities,
                prefer_defaults=True,
            )
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
            self.pad_velocities = _resize_pad_velocities(self.pad_velocities, len(notes), self.velocity)
            self.pad_actions = _normalize_pad_actions(
                self.pad_actions,
                len(notes),
                self.pad_notes,
                self.pad_velocities,
                prefer_defaults=True,
            )
        finally:
            self._syncing_pads = False

    def _on_pad_velocities_change(self, change):
        if self._syncing_pads:
            return
        velocities = _resize_pad_velocities(change["new"], self.pad_count, self.velocity)
        self._syncing_pads = True
        try:
            if velocities != self.pad_velocities:
                self.pad_velocities = velocities
            self.pad_actions = _normalize_pad_actions(
                self.pad_actions,
                self.pad_count,
                self.pad_notes,
                self.pad_velocities,
                prefer_defaults=True,
            )
        finally:
            self._syncing_pads = False

    def _on_pad_actions_change(self, change):
        if self._syncing_pads:
            return
        actions = _normalize_pad_actions(change["new"], self.pad_count, self.pad_notes, self.pad_velocities)
        self._syncing_pads = True
        try:
            if actions != self.pad_actions:
                self.pad_actions = actions
        finally:
            self._syncing_pads = False

    def _on_sample_slices_change(self, change):
        slices = _normalize_sample_slices(change["new"], self.sample_length)
        if slices != self.sample_slices:
            self.sample_slices = slices

    def _set_sample_data(self, samples):
        self.sample_length = len(samples)
        self.sample_data = _pack_float32(samples)
        self.waveform = _pack_float32(_decimate_samples(samples))
        self.sample_slices = _normalize_sample_slices(self.sample_slices, self.sample_length)

    def get_sample_data(self):
        """Return decoded mono PCM sample data as floats."""
        return _unpack_float32(self.sample_data)

    def _read_wav_file(self, path):
        with wave.open(str(path), "rb") as wav:
            channels = wav.getnchannels()
            sample_width = wav.getsampwidth()
            sample_rate = wav.getframerate()
            frames = wav.getnframes()
            raw = wav.readframes(frames)

        max_values = {1: 128.0, 2: 32768.0, 3: 8388608.0, 4: 2147483648.0}
        if sample_width not in max_values:
            raise ValueError(f"unsupported WAV sample width: {sample_width}")

        samples = []
        frame_width = sample_width * channels
        for frame_start in range(0, len(raw), frame_width):
            total = 0.0
            for channel in range(channels):
                start = frame_start + channel * sample_width
                chunk = raw[start : start + sample_width]
                if sample_width == 1:
                    value = chunk[0] - 128
                else:
                    value = int.from_bytes(chunk, "little", signed=True)
                total += value / max_values[sample_width]
            samples.append(total / channels)
        return samples, sample_rate

    def load_audio_file(self, path, root_note=69, name=None):
        """Load a local audio file into the sampler.

        WAV uses Python's stdlib. MP3/OGG/other formats
        require the optional ``soundfile`` package.

        Args:
            path: Path to the audio file.
            root_note: MIDI root note for pitch shifting.
            name: Display name (defaults to filename).

        Returns:
            Self for chaining.

        Raises:
            ValueError: If format is unsupported and ``soundfile``
                is not installed, or if WAV format is invalid.
        """
        path = pathlib.Path(path)
        suffix = path.suffix.lower()
        if suffix == ".wav":
            samples, sample_rate = self._read_wav_file(path)
        else:
            try:
                import soundfile as sf
            except ImportError as exc:
                raise ValueError("MP3/OGG loading requires optional package 'soundfile'") from exc
            data, sample_rate = sf.read(path, dtype="float32", always_2d=True)
            samples = [float(sum(frame) / len(frame)) for frame in data]
        self.load_sample(samples, sample_rate=sample_rate, root_note=root_note, name=name or path.name)
        return self

    def configure_pads(self, pad_count=None, pad_notes=None, pad_velocities=None, pad_actions=None):
        """Configure sampler trigger pads.

        Args:
            pad_count: Number of pads.
            pad_notes: MIDI note for each pad.
            pad_velocities: Velocity for each pad.
            pad_actions: Action descriptors for each pad.
        """
        if pad_notes is not None:
            notes = _resize_pad_notes(pad_notes, max(1, len(pad_notes)))
            self.pad_notes = notes
            if pad_count is None:
                self.pad_count = len(notes)
        if pad_velocities is not None:
            self.pad_velocities = _resize_pad_velocities(pad_velocities, max(1, len(pad_velocities)), self.velocity)
            if pad_count is None:
                self.pad_count = len(self.pad_velocities)
        if pad_actions is not None:
            count = pad_count or self.pad_count
            self.pad_actions = _normalize_pad_actions(pad_actions, count, self.pad_notes, self.pad_velocities)
        if pad_count is not None:
            self.pad_count = max(1, int(pad_count))

    def load_sample(self, data, sample_rate=44100, root_note=69, name="Sample"):
        """Load sample PCM data into the widget.

        Args:
            data: List of float samples.
            sample_rate: Sample rate in Hz.
            root_note: MIDI root note for pitch shifting.
            name: Display name for the sample.

        Returns:
            Self for chaining.
        """
        self.sample_name = name
        self.sample_rate = sample_rate
        self.root_note = _clamp_midi_note(root_note)
        self._set_sample_data(list(data))
        return self

    def trim_sample(self, start=0, end=None):
        """Trim sample data to frame range [start, end).

        Args:
            start: Start frame index.
            end: End frame index (defaults to sample length).

        Returns:
            Self for chaining.

        Raises:
            ValueError: If the trim range is empty.
        """
        samples = self.get_sample_data()
        end = len(samples) if end is None else int(end)
        start = max(0, int(start))
        end = min(len(samples), end)
        if end <= start:
            raise ValueError("trim range must contain at least one frame")
        self._set_sample_data(samples[start:end])
        return self

    def normalize_sample(self, target=1.0):
        """Scale sample data so peak absolute amplitude reaches target.

        Args:
            target: Target peak amplitude (0.0–1.0).

        Returns:
            Self for chaining.
        """
        samples = self.get_sample_data()
        peak = max((abs(s) for s in samples), default=0.0)
        if peak == 0.0:
            return self
        gain = max(0.0, min(1.0, float(target))) / peak
        self._set_sample_data([s * gain for s in samples])
        return self

    def reverse_sample(self):
        """Reverse sample data in place.

        Returns:
            Self for chaining.
        """
        self._set_sample_data(list(reversed(self.get_sample_data())))
        return self

    def fade_sample(self, fade_in=0, fade_out=0):
        """Apply linear fade-in/fade-out in sample frames.

        Args:
            fade_in: Number of frames to fade in.
            fade_out: Number of frames to fade out.

        Returns:
            Self for chaining.
        """
        samples = self.get_sample_data()
        total = len(samples)
        fade_in = max(0, min(total, int(fade_in)))
        fade_out = max(0, min(total, int(fade_out)))
        edited = list(samples)
        for i in range(fade_in):
            edited[i] *= i / max(1, fade_in - 1)
        for i in range(fade_out):
            idx = total - fade_out + i
            edited[idx] *= 1.0 - i / max(1, fade_out - 1)
        self._set_sample_data(edited)
        return self

    def slice_sample(self, count, start_note=36):
        """Create equal sample slices mapped to ascending notes.

        Args:
            count: Number of slices.
            start_note: MIDI note for the first slice.

        Returns:
            List of slice dicts with ``index``, ``note``, ``start``, ``end``.

        Raises:
            ValueError: If no sample is loaded.
        """
        count = max(1, min(_PAD_MAX_COUNT, int(count)))
        if self.sample_length <= 0:
            raise ValueError("load a sample before slicing")
        step = self.sample_length / count
        slices = []
        for i in range(count):
            start = int(i * step)
            end = self.sample_length if i == count - 1 else int((i + 1) * step)
            note = _clamp_midi_note(start_note + i)
            slices.append({"index": i, "note": note, "start": start, "end": end, "label": f"S{i + 1}"})
        self.sample_slices = slices
        self.configure_pads(
            pad_count=count,
            pad_notes=[s["note"] for s in slices],
            pad_actions=[PadAction(note=s["note"], velocity=self.velocity, label=s["label"], slice_index=s["index"]).to_dict() for s in slices],
        )
        return slices

    def map_slices_to_pads(self, pads, count=None, start_note=36):
        """Map sampler slices to a ``PadWidget``.

        Args:
            pads: Target ``PadWidget``.
            count: Number of slices (defaults to pad count).
            start_note: MIDI note for the first slice.

        Returns:
            The ``PadWidget`` with notes and actions configured.
        """
        slices = self.sample_slices
        if count is not None or not slices:
            slices = self.slice_sample(count or pads.rows * pads.cols, start_note=start_note)
        notes = [s["note"] for s in slices]
        actions = [PadAction(note=s["note"], velocity=pads.velocity, label=s.get("label"), slice_index=s["index"]).to_dict() for s in slices]
        pads.configure_grid_for_actions(notes=notes, actions=actions)
        if self.channel_index >= 0:
            pads.connect_sampler(self)
        return pads

    def to_sampler(self):
        """Build a Rust ``Sampler`` from the current widget state.

        Returns:
            A new ``nbplay.Sampler`` instance.
        """
        from nbplay import AudioSample, Envelope, Sampler

        sample = AudioSample(self.get_sample_data(), self.sample_rate, self.root_note)
        env = Envelope(self.attack, self.decay, self.sustain, self.release)
        s = Sampler(sample, self.sample_rate, self.max_voices)
        s.set_envelope(env)
        return s


class TransportWidget(anywidget.AnyWidget):
    """Global transport controls: play/stop, BPM, time signature, bar/beat.

    Used as the master clock for a ``Session``. All connected
    ``SequencerWidget`` instances sync their BPM and play state
    to this transport via ``traitlets.link``.
    """

    _esm = _STATIC / "transport.js"
    _css = _STATIC / "transport.css"

    # Transport state
    bpm = traitlets.Float(120.0).tag(sync=True)
    is_playing = traitlets.Bool(False).tag(sync=True)
    is_recording = traitlets.Bool(False).tag(sync=True)

    # Time signature
    time_signature_num = traitlets.Int(4).tag(sync=True)
    time_signature_den = traitlets.Int(4).tag(sync=True)

    # Position (updated by browser-side clock)
    bar_number = traitlets.Int(0).tag(sync=True)
    beat_in_bar = traitlets.Int(0).tag(sync=True)
    current_beat = traitlets.Float(0.0).tag(sync=True)

    # Loop
    loop_enabled = traitlets.Bool(False).tag(sync=True)
    loop_start_bar = traitlets.Int(0).tag(sync=True)
    loop_end_bar = traitlets.Int(4).tag(sync=True)


class TimelineWidget(anywidget.AnyWidget):
    """Multi-track clip timeline with browser recording controls.

    Clips are synced as JSON metadata. Browser-recorded audio is kept
    as an object URL in the frontend for immediate playback; durable
    binary persistence is intentionally left to an export/import path.
    """

    _esm = _STATIC / "timeline.js"
    _css = _STATIC / "timeline.css"

    session_id = traitlets.Unicode("").tag(sync=True)
    bpm = traitlets.Float(120.0).tag(sync=True)
    is_playing = traitlets.Bool(False).tag(sync=True)
    is_recording = traitlets.Bool(False).tag(sync=True)
    recording_track = traitlets.Int(-1).tag(sync=True)
    recording_error = traitlets.Unicode("").tag(sync=True)

    time_signature_num = traitlets.Int(4).tag(sync=True)
    time_signature_den = traitlets.Int(4).tag(sync=True)
    length = traitlets.Float(16.0).tag(sync=True)
    current_beat = traitlets.Float(0.0).tag(sync=True)
    count_in_bars = traitlets.Float(0.0).tag(sync=True)
    recording_countdown_beats = traitlets.Float(0.0).tag(sync=True)
    auto_extend_recording = traitlets.Bool(True).tag(sync=True)
    recording_extend_bars = traitlets.Float(8.0).tag(sync=True)

    tracks = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)
    clips = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)
    selected_clip_id = traitlets.Unicode("").tag(sync=True)
    recorded_clip = traitlets.Dict(default_value={}).tag(sync=True)

    @traitlets.validate("length")
    def _validate_length(self, proposal):
        return _positive_number(proposal["value"], "length", minimum=1.0, maximum=4096.0)

    @traitlets.validate("current_beat")
    def _validate_current_beat(self, proposal):
        return min(self.length, _nonnegative_number(proposal["value"], "current_beat"))

    @traitlets.validate("count_in_bars")
    def _validate_count_in_bars(self, proposal):
        return _nonnegative_number(proposal["value"], "count_in_bars", maximum=8.0)

    @traitlets.validate("recording_countdown_beats")
    def _validate_recording_countdown_beats(self, proposal):
        return _nonnegative_number(proposal["value"], "recording_countdown_beats")

    @traitlets.validate("recording_extend_bars")
    def _validate_recording_extend_bars(self, proposal):
        return _positive_number(proposal["value"], "recording_extend_bars", minimum=1.0, maximum=256.0)

    @traitlets.validate("tracks")
    def _validate_tracks(self, proposal):
        return _normalize_timeline_tracks(proposal["value"])

    @traitlets.validate("clips")
    def _validate_clips(self, proposal):
        return _normalize_audio_clips(proposal["value"], len(self.tracks))

    @traitlets.validate("recording_track")
    def _validate_recording_track(self, proposal):
        track = int(proposal["value"])
        if track < 0 or not self.tracks:
            return -1
        return min(track, len(self.tracks) - 1)

    def add_track(self, name="Track", channel_index=None, *, armed=False, monitor=False):
        """Append a timeline lane and return its index."""
        idx = len(self.tracks)
        track = TimelineTrack(
            name=name,
            channel_index=idx if channel_index is None else channel_index,
            armed=armed,
            monitor=monitor,
        ).to_dict()
        self.tracks = [*self.tracks, track]
        return idx

    def remove_track(self, index):
        """Remove a lane, dropping its clips and shifting later lanes."""
        index = int(index)
        if index < 0 or index >= len(self.tracks):
            return
        removed = self.tracks[index]
        removed_channel = int(removed.get("channel_index", index))
        next_tracks = []
        for i, track in enumerate(self.tracks):
            if i == index:
                continue
            item = dict(track)
            if removed_channel >= 0 and int(item.get("channel_index", -1)) > removed_channel:
                item["channel_index"] = int(item["channel_index"]) - 1
            next_tracks.append(_normalize_timeline_track(item, len(next_tracks)))
        next_clips = []
        for clip in self.clips:
            item = dict(clip)
            track_index = int(item.get("track_index", 0))
            if track_index == index:
                continue
            if track_index > index:
                item["track_index"] = track_index - 1
            next_clips.append(item)
        self.tracks = next_tracks
        self.clips = _normalize_audio_clips(next_clips, len(next_tracks))
        if self.recording_track == index:
            self.recording_track = -1
            self.is_recording = False
        elif self.recording_track > index:
            self.recording_track -= 1

    def arm_track(self, index, armed=True, *, exclusive=False):
        """Set lane arm state."""
        index = int(index)
        if index < 0 or index >= len(self.tracks):
            raise IndexError(f"track index out of range: {index}")
        tracks = []
        for i, track in enumerate(self.tracks):
            item = dict(track)
            if exclusive and i != index:
                item["armed"] = False
            elif i == index:
                item["armed"] = bool(armed)
            tracks.append(item)
        self.tracks = tracks
        if not any(track.get("armed") for track in tracks):
            self.recording_track = -1

    def add_clip(self, name="Clip", track_index=0, start=0.0, duration=4.0, **kwargs):
        """Append a clip descriptor and return it."""
        clip = AudioClip(
            name=name,
            track_index=track_index,
            start=start,
            duration=duration,
            **kwargs,
        ).to_dict()
        clip = _normalize_audio_clip(clip, len(self.clips), len(self.tracks))
        self.clips = [*self.clips, clip]
        self.selected_clip_id = clip["id"]
        self.length = max(self.length, clip["start"] + clip["duration"])
        return clip

    def remove_clip(self, clip_id):
        """Remove a clip by id."""
        clip_id = str(clip_id)
        self.clips = [clip for clip in self.clips if clip.get("id") != clip_id]
        if self.selected_clip_id == clip_id:
            self.selected_clip_id = ""

    def move_clip(self, clip_id, *, track_index=None, start=None):
        """Move a clip to a new lane and/or beat position."""
        clip_id = str(clip_id)
        next_clips = []
        found = False
        for clip in self.clips:
            item = dict(clip)
            if item.get("id") == clip_id:
                found = True
                if track_index is not None:
                    item["track_index"] = int(track_index)
                if start is not None:
                    item["start"] = start
            next_clips.append(item)
        if not found:
            raise ValueError(f"clip not found: {clip_id}")
        self.clips = _normalize_audio_clips(next_clips, len(self.tracks))

    def resize_clip(self, clip_id, duration):
        """Set a clip duration in beats."""
        clip_id = str(clip_id)
        next_clips = []
        found = False
        for clip in self.clips:
            item = dict(clip)
            if item.get("id") == clip_id:
                found = True
                item["duration"] = duration
            next_clips.append(item)
        if not found:
            raise ValueError(f"clip not found: {clip_id}")
        self.clips = _normalize_audio_clips(next_clips, len(self.tracks))


class KeyboardRoute:
    """Validated route descriptor for keyboard → sampler mapping.

    Determines which MIDI notes a ``KeyboardWidget`` or
    ``MidiKeyboardWidget`` routes to a specific sampler.

    Args:
        channel_index: The sampler's channel index on the session bus (≥ 0).
        match: One of ``"all"``, ``"zone"``, ``"octave"``, ``"note"``, ``"notes"``.
        zone: Required when *match="zone"*. ``"upper"`` or ``"lower"``.
        octave: Required when *match="octave"*. MIDI octave 0–9.
        note: Required when *match="note"*. Single MIDI note 0–127.
        notes: Required when *match="notes"*. Non-empty list of MIDI notes 0–127.
    """

    _VALID_MATCHES = frozenset({"all", "zone", "octave", "note", "notes"})
    _VALID_ZONES = frozenset({"upper", "lower"})

    def __init__(
        self,
        channel_index: int,
        *,
        match: str = "all",
        zone: str | None = None,
        octave: int | None = None,
        note: int | None = None,
        notes: list[int] | None = None,
    ):
        if match not in self._VALID_MATCHES:
            raise ValueError(f"match must be one of {sorted(self._VALID_MATCHES)}, got {match!r}")
        if not isinstance(channel_index, int):
            raise ValueError(f"channel_index must be int, got {type(channel_index).__name__}")  # noqa: TRY004
        if match == "zone":
            if zone not in self._VALID_ZONES:
                raise ValueError(f"zone must be one of {sorted(self._VALID_ZONES)}, got {zone!r}")
        elif match == "octave":
            if octave is None or not isinstance(octave, int) or not (0 <= octave <= 9):
                raise ValueError(f"octave must be int 0–9, got {octave!r}")
        elif match == "note":
            if note is None or not isinstance(note, int) or not (0 <= note <= 127):
                raise ValueError(f"note must be int 0–127, got {note!r}")
        elif match == "notes" and (not notes or not all(isinstance(n, int) and 0 <= n <= 127 for n in notes)):
            raise ValueError(f"notes must be a non-empty list of ints 0–127, got {notes!r}")
        if channel_index < 0:
            raise ValueError(f"channel_index must be >= 0, got {channel_index}")

        self.channel_index = channel_index
        self.match = match
        self.zone = zone
        self.octave = octave
        self.note = note
        self.notes = notes

    def to_dict(self) -> dict:
        """Serialize to the dict format stored in ``sampler_routing``.

        Returns:
            Dict with keys ``channel_index``, ``match``, and optional fields.
        """
        d: dict = {"channel_index": self.channel_index, "match": self.match}
        if self.zone is not None:
            d["zone"] = self.zone
        if self.octave is not None:
            d["octave"] = self.octave
        if self.note is not None:
            d["note"] = self.note
        if self.notes is not None:
            d["notes"] = list(self.notes)
        return d

    def __repr__(self) -> str:
        parts = [f"ch={self.channel_index}", f"match={self.match}"]
        if self.zone is not None:
            parts.append(f"zone={self.zone}")
        if self.octave is not None:
            parts.append(f"octave={self.octave}")
        if self.note is not None:
            parts.append(f"note={self.note}")
        if self.notes is not None:
            parts.append(f"notes={self.notes}")
        return f"KeyboardRoute({', '.join(parts)})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, KeyboardRoute):
            return NotImplemented
        return self.to_dict() == other.to_dict()

    def __hash__(self) -> int:
        return hash(
            (
                self.channel_index,
                self.match,
                self.zone,
                self.octave,
                self.note,
                tuple(self.notes) if self.notes is not None else None,
            )
        )


class KeyboardWidget(anywidget.AnyWidget):
    r"""Musical typing keyboard widget (Logic Pro style).

    4-row QWERTY layout across two independent octave halves.
    Triggers audio via Web Audio and emits note events for
    sequencer recording and sampler triggering.

    Key mapping:
        - Upper sharps: **2 3 _ 5 6 7 _ 9 0**
        - Upper naturals: **Q W E R T Y U I O P**
        - Lower sharps: **A S _ F G H _ K L**
        - Lower naturals: **Z X C V B N M , .**
        - ``[ ]`` octave shift upper, ``; '`` octave shift lower
        - ``- =`` velocity down/up (hold to accelerate)
        - ``\` `` sustain upper, ``/`` sustain lower, ``Space`` global sustain
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

    # Sampler routing: validated KeyboardRoute dictionaries
    sampler_routing = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)

    # Internal references (not synced)
    _connected_sequencers: ClassVar[list] = []
    _connected_samplers: ClassVar[list] = []

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._connected_sequencers = []
        self._connected_samplers = []

    def connect_sequencer(self, sequencer):
        """Link this keyboard to a sequencer for recording and note input.

        Args:
            sequencer: A ``SequencerWidget`` to connect.
        """
        if sequencer not in self._connected_sequencers:
            self._connected_sequencers.append(sequencer)
            sequencer.keyboard_connected = True

    def disconnect_sequencer(self, sequencer):
        """Unlink this keyboard from a sequencer.

        Args:
            sequencer: A ``SequencerWidget`` to disconnect.
        """
        if sequencer in self._connected_sequencers:
            self._connected_sequencers.remove(sequencer)
            sequencer.keyboard_connected = False

    def connect_sampler(
        self,
        sampler,
        zone=None,
        octave=None,
        note=None,
        notes=None,
    ):
        """Connect a sampler to the keyboard.

        Args:
            sampler: The ``SamplerWidget`` to connect.
            zone: ``"upper"``, ``"lower"``, or ``None`` (whole keyboard).
            octave: Route all notes in this MIDI octave (0–9).
            note: Route a single MIDI note (0–127).
            notes: Route specific MIDI notes.
        """
        # Build and validate route BEFORE mutating connection state
        route = _build_route(sampler.channel_index, zone=zone, octave=octave, note=note, notes=notes)
        if sampler not in self._connected_samplers:
            self._connected_samplers.append(sampler)
            sampler.keyboard_connected = True
        routing = [r for r in self.sampler_routing if r.get("channel_index") != sampler.channel_index]
        routing.append(route.to_dict())
        self.sampler_routing = routing

    def disconnect_sampler(self, sampler):
        """Disconnect a sampler.

        Args:
            sampler: The ``SamplerWidget`` to disconnect.
        """
        if sampler in self._connected_samplers:
            self._connected_samplers.remove(sampler)
            sampler.keyboard_connected = False
            routing = [r for r in self.sampler_routing if r.get("channel_index") != sampler.channel_index]
            self.sampler_routing = routing


class MidiKeyboardWidget(KeyboardWidget):
    """Browser Web MIDI keyboard input widget.

    Uses the same sequencer and sampler connection API as
    ``KeyboardWidget``, but receives note events from a
    selected browser MIDI input device.
    """

    _esm = _STATIC / "midi_keyboard.js"
    _css = _STATIC / "midi_keyboard.css"

    midi_port = traitlets.Unicode("").tag(sync=True)
    available_midi_ports = traitlets.List(traitlets.Unicode(), []).tag(sync=True)


def _default_pad_notes(rows=4, cols=4):
    """Default pad notes starting at MIDI 36 (C2), ascending chromatically."""
    start = 36
    return [start + i for i in range(rows * cols)]


def _positive_pad_dimension(value):
    """Clamp pad grid dimensions to at least one row/column."""
    return max(1, int(value))


class PadWidget(anywidget.AnyWidget):
    """On-screen trigger-pad grid.

    A grid of clickable, velocity-sensitive pads that send MIDI notes
    through the session bus, using the same ``sampler_routing``
    infrastructure as ``KeyboardWidget``. Falls back to a built-in
    sine-wave oscillator when no sampler is connected.

    Args:
        rows: Number of pad rows (default 4).
        cols: Number of pad columns (default 4).
        velocity: Default velocity for pad triggers (1–127).
        velocity_sensitive: If True, vertical click position maps to
            velocity (top = soft, bottom = hard).
        pad_notes: MIDI note assignments (row-major). Defaults to
            [36, 37, ...] starting at C2.
        pad_velocities: Per-pad velocity values (1–127). Shift+scroll
            on a pad adjusts its individual velocity.
    """

    _esm = _STATIC / "pad.js"
    _css = _STATIC / "pad.css"

    rows = traitlets.Int(4).tag(sync=True)
    cols = traitlets.Int(4).tag(sync=True)
    velocity = traitlets.Int(100).tag(sync=True)
    velocity_sensitive = traitlets.Bool(True).tag(sync=True)
    pad_notes = traitlets.List(trait=traitlets.Int()).tag(sync=True)
    pad_velocities = traitlets.List(trait=traitlets.Int()).tag(sync=True)
    pad_actions = traitlets.List(trait=traitlets.Dict()).tag(sync=True)
    active_pads = traitlets.List(trait=traitlets.Int(), default_value=[]).tag(sync=True)
    last_note_event = traitlets.Dict(default_value={}).tag(sync=True)
    last_pad_event = traitlets.Dict(default_value={}).tag(sync=True)

    # Session routing (same API as KeyboardWidget)
    session_id = traitlets.Unicode("").tag(sync=True)
    channel_index = traitlets.Int(-1).tag(sync=True)
    sampler_routing = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)

    _connected_samplers: ClassVar[list] = []

    @traitlets.validate("velocity")
    def _validate_velocity(self, proposal):
        return max(1, min(127, int(proposal["value"])))

    @traitlets.validate("rows", "cols")
    def _validate_grid_dimension(self, proposal):
        return _positive_pad_dimension(proposal["value"])

    @traitlets.validate("pad_notes")
    def _validate_pad_notes(self, proposal):
        return [max(0, min(127, int(n))) for n in proposal["value"]]

    @traitlets.validate("pad_velocities")
    def _validate_pad_velocities(self, proposal):
        return [max(1, min(127, int(v))) for v in proposal["value"]]

    @traitlets.validate("pad_actions")
    def _validate_pad_actions(self, proposal):
        return _normalize_pad_actions(
            proposal["value"],
            self.rows * self.cols,
            self.pad_notes,
            self.pad_velocities,
        )

    def __init__(self, **kwargs):
        rows = _positive_pad_dimension(kwargs.get("rows", 4))
        cols = _positive_pad_dimension(kwargs.get("cols", 4))
        kwargs["rows"] = rows
        kwargs["cols"] = cols
        if "pad_notes" not in kwargs:
            kwargs["pad_notes"] = _default_pad_notes(rows, cols)
        velocity = kwargs.get("velocity", 100)
        if "pad_velocities" not in kwargs:
            total = rows * cols
            if "pad_notes" in kwargs:
                total = max(total, len(kwargs["pad_notes"]))
            kwargs["pad_velocities"] = [velocity] * total
        if "pad_actions" not in kwargs:
            kwargs["pad_actions"] = _normalize_pad_actions(
                [],
                rows * cols,
                kwargs["pad_notes"],
                kwargs["pad_velocities"],
            )
        super().__init__(**kwargs)
        self._connected_samplers = []

    @traitlets.observe("rows", "cols")
    def _on_grid_change(self, change):
        """Resize pad_notes and pad_velocities when grid dimensions change."""
        total = self.rows * self.cols
        velocity = self.velocity

        current_notes = list(self.pad_notes)
        if len(current_notes) < total:
            last = current_notes[-1] if current_notes else 35
            current_notes.extend(last + 1 + i for i in range(total - len(current_notes)))
        elif len(current_notes) > total:
            current_notes = current_notes[:total]

        current_vels = list(self.pad_velocities)
        if len(current_vels) < total:
            current_vels.extend(velocity for _ in range(total - len(current_vels)))
        elif len(current_vels) > total:
            current_vels = current_vels[:total]

        if list(self.pad_notes) != current_notes:
            self.pad_notes = current_notes
        if list(self.pad_velocities) != current_vels:
            self.pad_velocities = current_vels
        actions = _normalize_pad_actions(self.pad_actions, total, current_notes, current_vels, prefer_defaults=True)
        if list(self.pad_actions) != actions:
            self.pad_actions = actions

    @traitlets.observe("pad_notes", "pad_velocities")
    def _on_pad_values_change(self, change):
        total = self.rows * self.cols
        actions = _normalize_pad_actions(
            self.pad_actions,
            total,
            self.pad_notes,
            self.pad_velocities,
            prefer_defaults=True,
        )
        if list(self.pad_actions) != actions:
            self.pad_actions = actions

    @traitlets.observe("velocity")
    def _on_velocity_change(self, change):
        if change.get("old", traitlets.Undefined) is traitlets.Undefined:
            return
        total = self.rows * self.cols
        count = max(total, len(self.pad_velocities))
        velocities = [self.velocity] * count
        if list(self.pad_velocities) != velocities:
            self.pad_velocities = velocities
        actions = _normalize_pad_actions(
            self.pad_actions,
            total,
            self.pad_notes,
            self.pad_velocities,
            prefer_defaults=True,
        )
        if list(self.pad_actions) != actions:
            self.pad_actions = actions

    def configure_grid_for_actions(self, notes=None, velocities=None, actions=None, rows=None, cols=None):
        """Configure pad grid from note/control actions.

        Args:
            notes: MIDI note assignments.
            velocities: Per-pad velocity values.
            actions: ``PadAction`` descriptors.
            rows: Grid row count.
            cols: Grid column count.

        Returns:
            Self for chaining.
        """
        explicit_count = max(len(actions or []), len(notes or []), len(velocities or []))
        count = explicit_count or len(self.pad_notes)
        count = max(1, count)
        if cols is None:
            cols = min(4, count)
        if rows is None:
            rows = max(1, (count + cols - 1) // cols)
        self.rows = _positive_pad_dimension(rows)
        self.cols = _positive_pad_dimension(cols)
        total = self.rows * self.cols
        if notes is not None:
            self.pad_notes = _resize_pad_notes(notes, total)
        if velocities is not None:
            self.pad_velocities = _resize_pad_velocities(velocities, total, self.velocity)
        else:
            self.pad_velocities = _resize_pad_velocities(self.pad_velocities, total, self.velocity)
        self.pad_actions = _normalize_pad_actions(actions, total, self.pad_notes, self.pad_velocities)
        return self

    def set_base_note(self, note):
        """Set pads to ascending chromatic notes.

        Args:
            note: Starting MIDI note.

        Returns:
            Self for chaining.
        """
        start = _clamp_midi_note(note)
        self.pad_notes = [_clamp_midi_note(start + i) for i in range(self.rows * self.cols)]
        return self

    def transpose_pads(self, semitones):
        """Transpose current note pads by semitones.

        Args:
            semitones: Number of semitones to transpose (positive or negative).

        Returns:
            Self for chaining.
        """
        delta = int(semitones)
        self.pad_notes = [_clamp_midi_note(note + delta) for note in self.pad_notes]
        return self

    def connect_sampler(self, sampler, **kwargs):
        """Connect a sampler to all pads.

        Uses the same ``KeyboardRoute`` routing model as
        ``KeyboardWidget.connect_sampler``. By default routes
        all pads to the sampler (``match="all"``).

        Pads do not have keyboard zones; ``zone="upper"`` and
        ``zone="lower"`` raise ``ValueError``. Use
        ``match="all"``, ``match="octave"``, ``match="note"``,
        or ``match="notes"`` instead.

        Args:
            sampler: The ``SamplerWidget`` to connect.
            **kwargs: Passed to ``KeyboardRoute``.
        """
        # Pads don't have zones — validate before mutating state
        zone = kwargs.get("zone")
        if zone is not None and zone != "all":
            raise ValueError(f"PadWidget does not support zone routing (got zone={zone!r}). Use match='all', 'octave', 'note', or 'notes'.")
        route = _build_route(sampler.channel_index, **kwargs)
        if sampler not in self._connected_samplers:
            self._connected_samplers.append(sampler)
            sampler.keyboard_connected = True
        routing = [r for r in self.sampler_routing if r.get("channel_index") != sampler.channel_index]
        routing.append(route.to_dict())
        self.sampler_routing = routing

    def disconnect_sampler(self, sampler):
        """Disconnect a sampler from the pads.

        Args:
            sampler: The ``SamplerWidget`` to disconnect.
        """
        if sampler in self._connected_samplers:
            self._connected_samplers.remove(sampler)
            sampler.keyboard_connected = False
            routing = [r for r in self.sampler_routing if r.get("channel_index") != sampler.channel_index]
            self.sampler_routing = routing


def _build_route(channel_index, zone=None, octave=None, note=None, notes=None):
    """Build a ``KeyboardRoute`` from kwargs.

    Shared by ``KeyboardWidget`` and ``PadWidget``.

    Args:
        channel_index: Sampler channel index.
        zone: ``None``, ``"all"``, ``"upper"``, or ``"lower"``.
            Invalid values raise ``ValueError``.
        octave: MIDI octave (0–9).
        note: Single MIDI note (0–127).
        notes: Non-empty list of MIDI notes.

    Returns:
        A validated ``KeyboardRoute``.
    """
    if notes is not None:
        return KeyboardRoute(channel_index, match="notes", notes=notes)
    if note is not None:
        return KeyboardRoute(channel_index, match="note", note=note)
    if octave is not None:
        return KeyboardRoute(channel_index, match="octave", octave=octave)
    if zone is not None:
        if zone in ("upper", "lower"):
            return KeyboardRoute(channel_index, match="zone", zone=zone)
        if zone == "all":
            return KeyboardRoute(channel_index, match="all")
        raise ValueError(f"zone must be None, 'all', 'upper', or 'lower', got {zone!r}")
    return KeyboardRoute(channel_index, match="all")


class Track:
    """Binds a sequencer to a sound source and a mixer channel.

    Uses ``traitlets.link()`` to propagate BPM and play state
    from the ``Session`` transport to the sequencer.

    Args:
        name: Track display name.
        sequencer: A ``SequencerWidget``.
        sound_source: A widget that produces audio.
        mixer_channel: Zero-based mixer channel index.
    """

    def __init__(self, name, sequencer, sound_source, mixer_channel):
        self.name = name
        self.sequencer = sequencer
        self.sound_source = sound_source
        self.mixer_channel = mixer_channel
        self._links = []

    def _link_transport(self, transport):
        """Link this track's sequencer BPM and play state to the transport.

        BPM is bidirectional so editing BPM on either widget stays
        in sync. ``is_playing`` is one-directional (transport →
        sequencer) so a single non-looping sequencer reaching its
        end does not stop every other sequencer.

        Args:
            transport: A ``TransportWidget``.
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

    Manages ``traitlets.link`` connections between the transport
    and all track sequencers, and assigns mixer channels for
    audio routing.

    Args:
        bpm: Initial tempo in beats per minute.
        time_signature: ``(numerator, denominator)`` tuple.
    """

    def __init__(self, bpm=120.0, time_signature=(4, 4)):
        self._session_id = f"nbplay-{uuid.uuid4().hex[:8]}"
        self.transport = TransportWidget(
            bpm=bpm,
            time_signature_num=time_signature[0],
            time_signature_den=time_signature[1],
        )
        self.mixer = MixerWidget(session_id=self._session_id)
        self.timeline = TimelineWidget(
            session_id=self._session_id,
            bpm=bpm,
            time_signature_num=time_signature[0],
            time_signature_den=time_signature[1],
        )
        self._timeline_links = [
            traitlets.link((self.transport, "bpm"), (self.timeline, "bpm")),
            traitlets.link((self.transport, "time_signature_num"), (self.timeline, "time_signature_num")),
            traitlets.link((self.transport, "time_signature_den"), (self.timeline, "time_signature_den")),
            traitlets.link((self.transport, "is_playing"), (self.timeline, "is_playing")),
            traitlets.link((self.transport, "is_recording"), (self.timeline, "is_recording")),
            traitlets.link((self.transport, "current_beat"), (self.timeline, "current_beat")),
        ]
        self.tracks = []

    def add_track(self, name, sequencer, sound_source):
        """Add a track, create a mixer channel, and link transport state.

        Args:
            name: Track display name.
            sequencer: A ``SequencerWidget``.
            sound_source: A widget that produces audio.

        Returns:
            The new ``Track`` object.
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
        self.timeline.add_track(name, channel_idx)
        return track

    def remove_track(self, index):
        """Remove a track, unlinking transport and removing mixer channel.

        Args:
            index: Zero-based track index.
        """
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
            self.timeline.remove_track(index)
            # Adjust mixer_channel indices for remaining tracks
            for t in self.tracks:
                if t.mixer_channel > track.mixer_channel:
                    t.mixer_channel -= 1
                    t.sequencer.channel_index -= 1
                    if hasattr(t.sound_source, "channel_index"):
                        t.sound_source.channel_index -= 1

    def __repr__(self):
        return f"Session(bpm={self.transport.bpm}, tracks={len(self.tracks)}, channels={len(self.mixer.channels)})"
