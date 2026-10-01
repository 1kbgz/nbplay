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
import json
import math
import os
import pathlib
import uuid
import wave
import zipfile
from typing import ClassVar

import anywidget
import traitlets

from nbplay import (
    EventSequence,
    NoiseSource,
    NoteEvent,
    SawOscillator,
    SineOscillator,
    SquareOscillator,
    __version__,
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

    def __init__(self, type, enabled=True, **params):
        if type not in self._VALID_TYPES:
            raise ValueError(f"type must be one of {sorted(self._VALID_TYPES)}, got {type!r}")
        self.type = type
        self.enabled = bool(enabled)
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
        # A bypassed effect carries enabled=False; enabled effects stay compact.
        data = {"type": self.type, **self.params}
        if not self.enabled:
            data["enabled"] = False
        return data

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


def _set_effect_enabled(effect, enabled):
    data = {k: v for k, v in dict(effect).items() if k != "enabled"}
    if not enabled:
        data["enabled"] = False
    return _normalize_effect(data)


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


_TIMELINE_INPUTS = frozenset({"microphone", "channel", "midi"})
_CLIP_KINDS = frozenset({"audio", "midi"})


def _normalize_midi_event(event, index=0):
    if isinstance(event, NoteEvent):
        data = {
            "beat": event.beat_position,
            "duration": event.duration,
            "note": event.note,
            "velocity": event.velocity,
        }
    elif isinstance(event, dict):
        data = event
    else:
        raise ValueError(f"midi event {index} must be dict or NoteEvent, got {type(event).__name__}")  # noqa: TRY004
    return {
        "beat": _nonnegative_number(data.get("beat", 0.0), "beat"),
        "duration": _positive_number(data.get("duration", 0.25), "duration", minimum=0.001, maximum=4096.0),
        "note": _clamp_midi_note(int(data.get("note", 60))),
        "velocity": max(1, min(127, int(data.get("velocity", 100)))),
    }


def _normalize_midi_events(events):
    if isinstance(events, EventSequence):
        events = events.events()
    return sorted(
        (_normalize_midi_event(event, index) for index, event in enumerate(events or [])),
        key=lambda item: (item["beat"], item["note"]),
    )


def _steps_to_events(voices_data, step_duration=0.25):
    """Expand sequencer voices (lists of step dicts) into MIDI events in beats."""
    step_duration = max(0.001, float(step_duration))
    events = []
    for voice in voices_data or []:
        for index, step in enumerate(voice or []):
            if not step.get("active", False) or float(step.get("probability", 100)) <= 0:
                continue
            events.append(
                {
                    "beat": index * step_duration,
                    "duration": max(0.001, float(step.get("duration_ticks", 1)) * step_duration),
                    "note": int(step.get("note", 60)),
                    "velocity": int(step.get("velocity", 100)),
                }
            )
    return _normalize_midi_events(events)


def _normalize_timeline_track(track, index=0):
    if isinstance(track, TimelineTrack):
        return track.to_dict()
    if not isinstance(track, dict):
        raise ValueError(f"timeline track must be dict or TimelineTrack, got {type(track).__name__}")  # noqa: TRY004
    channel = int(track.get("channel_index", index))
    source = str(track.get("input", "microphone"))
    if source not in _TIMELINE_INPUTS:
        raise ValueError(f"timeline track input must be one of {sorted(_TIMELINE_INPUTS)}, got {source!r}")
    return {
        "name": str(track.get("name", f"Track {index + 1}")),
        "channel_index": max(-1, channel),
        "armed": bool(track.get("armed", False)),
        "muted": bool(track.get("muted", False)),
        "solo": bool(track.get("solo", False)),
        "input": source,
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

    kind = str(data.get("kind") or ("midi" if data.get("events") is not None else "audio"))
    if kind not in _CLIP_KINDS:
        raise ValueError(f"clip kind must be one of {sorted(_CLIP_KINDS)}, got {kind!r}")
    normalized = {
        "id": str(data.get("id") or _clip_id()),
        "kind": kind,
        "name": str(data.get("name", f"Clip {index + 1}")),
        "track_index": track_index,
        "start": _nonnegative_number(data.get("start", 0.0), "start"),
        "duration": _positive_number(data.get("duration", 4.0), "duration"),
        "loop": bool(data.get("loop", False)),
        "muted": bool(data.get("muted", False)),
        "recorded": bool(data.get("recorded", False)),
        "offset": _nonnegative_number(data.get("offset", 0.0), "offset"),
        "audio_url": str(data.get("audio_url", "")),
        "blob_type": str(data.get("blob_type", "")),
        "source": str(data.get("source", "recording")),
        "sample_rate": max(1, int(data.get("sample_rate", 44100))),
    }
    if kind == "midi":
        normalized["events"] = _normalize_midi_events(data.get("events"))
        if data.get("pattern"):
            normalized["pattern"] = str(data["pattern"])
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
        offset=0.0,
        audio_url="",
        blob_type="",
        source="recording",
        sample_rate=44100,
        blob_size=None,
        color=None,
        kind="audio",
        events=None,
        pattern=None,
    ):
        data = {
            "id": id or _clip_id(),
            "kind": kind,
            "name": name,
            "track_index": track_index,
            "start": start,
            "duration": duration,
            "loop": loop,
            "muted": muted,
            "recorded": recorded,
            "offset": offset,
            "audio_url": audio_url,
            "blob_type": blob_type,
            "source": source,
            "sample_rate": sample_rate,
        }
        if blob_size is not None:
            data["blob_size"] = blob_size
        if color is not None:
            data["color"] = color
        if events is not None:
            data["events"] = events
            data["kind"] = "midi"
        if pattern:
            data["pattern"] = pattern
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


def _normalize_zone(zone, index=0):
    data = zone.get("data", b"")
    if isinstance(data, memoryview):
        data = data.tobytes()
    if not isinstance(data, (bytes, bytearray)):
        raise TypeError(f"zone {index} data must be bytes of little-endian float32 samples")
    data = bytes(data)
    note_low = _clamp_midi_note(zone.get("note_low", 0))
    note_high = _clamp_midi_note(zone.get("note_high", 127))
    velocity_low = _clamp_int(zone.get("velocity_low", 0), 0, 127)
    velocity_high = _clamp_int(zone.get("velocity_high", 127), 0, 127)
    return {
        "id": str(zone.get("id") or uuid.uuid4().hex[:8]),
        "name": str(zone.get("name") or f"Zone {index + 1}"),
        "note_low": min(note_low, note_high),
        "note_high": max(note_low, note_high),
        "velocity_low": min(velocity_low, velocity_high),
        "velocity_high": max(velocity_low, velocity_high),
        "root_note": _clamp_midi_note(zone.get("root_note", 60)),
        "sample_rate": max(1, int(zone.get("sample_rate", 44100))),
        "length": len(data) // 4,
        "data": data,
    }


def _normalize_zones(zones):
    return [_normalize_zone(zone, index) for index, zone in enumerate(zones or [])]


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

    def set_channel_effect_enabled(self, index, effect_index, enabled=True):
        """Bypass (``False``) or re-enable one channel insert effect."""
        chs = list(self.channels)
        if 0 <= index < len(chs):
            effects = _normalize_effects(chs[index].get("effects", []))
            if 0 <= effect_index < len(effects):
                effects[effect_index] = _set_effect_enabled(effects[effect_index], enabled)
                chs[index] = {**chs[index], "effects": effects}
                self.channels = chs

    def set_master_effect_enabled(self, effect_index, enabled=True):
        """Bypass (``False``) or re-enable one master insert effect."""
        effects = list(self.master_effects)
        if 0 <= effect_index < len(effects):
            effects[effect_index] = _set_effect_enabled(effects[effect_index], enabled)
            self.master_effects = effects

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
    # When false the sequencer ignores transport play (its own play button
    # still works), so pattern clips on its lane can drive the track instead.
    follow_transport = traitlets.Bool(True).tag(sync=True)
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
        self.observe(self._on_num_voices_change, names=["num_voices"])
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

    def _on_num_voices_change(self, change):
        """Grow or shrink the composers so every voice has an editor behind it."""
        count = max(1, int(change["new"]))
        if count != change["new"]:
            self.num_voices = count
            return
        if count == len(self._composers):
            return
        while len(self._composers) < count:
            composer = NoteComposer(length=self.length)
            composer.observe(self._on_composer_change, names=["steps"])
            self._composers.append(composer)
        del self._composers[count:]
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

    def to_midi(self, path=None, name="Sequencer"):
        """Export the pattern as a ``mido.MidiFile`` (written to ``path`` if given).

        Every voice's active steps become notes; step index times
        ``step_duration`` gives the beat, ``duration_ticks`` the length. The
        file carries the sequencer's BPM and time signature.
        """
        from nbplay.midi import build_midi, steps_to_events

        midi = build_midi(
            [{"name": name, "events": steps_to_events(self.voices_data, self.step_duration)}],
            bpm=self.bpm,
            time_signature=(self.time_signature_num, self.time_signature_den),
        )
        if path is not None:
            midi.save(os.fspath(path))
        return midi

    def load_midi(self, source, track=None, step_duration=None, max_voices=8):
        """Replace the pattern with notes from a MIDI file.

        ``track`` picks one track by index; by default every track with
        notes is merged. Notes are quantized to ``step_duration`` (defaults
        to the current grid), overlapping notes go to separate voices up to
        ``max_voices``, and the grid grows to fit the last note. The file's
        tempo is applied to ``bpm``. Returns self.
        """
        from nbplay.midi import events_to_voices, read_midi

        data = read_midi(source)
        tracks = data["tracks"]
        if track is not None:
            if track < 0 or track >= len(tracks):
                raise IndexError(f"MIDI track index out of range: {track}")
            tracks = [tracks[track]]
        events = [event for item in tracks for event in item["events"]]
        step = self.step_duration if step_duration is None else float(step_duration)
        voices, length = events_to_voices(events, step, max_voices=max_voices)
        self.bpm = data["bpm"]
        self.step_duration = step
        self.num_voices = len(voices)
        self.length = length
        self.voices_data = voices
        return self

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
    # Multi-sample zones: each maps a note and velocity range to its own PCM
    # (``data``: little-endian float32 bytes). A matching zone wins over the
    # main sample when a note plays.
    zones = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)
    # Ask the browser to decode audio it holds (a timeline clip URL) into a zone.
    capture_request = traitlets.Dict(default_value={}).tag(sync=True)
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
        self.zones = _normalize_zones(self.zones)
        self.observe(self._on_zones_change, names=["zones"])
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

    def _on_zones_change(self, change):
        zones = _normalize_zones(change["new"])
        if zones != self.zones:
            self.zones = zones

    # Multi-sample zones

    def add_zone(self, data, note_low=0, note_high=127, *, velocity_low=0, velocity_high=127, root_note=None, sample_rate=44100, name=None):
        """Add a sample zone covering a note (and velocity) range.

        Args:
            data: Float samples, or float32 bytes.
            note_low, note_high: MIDI note range the zone answers to.
            velocity_low, velocity_high: Velocity range the zone answers to.
            root_note: Note at which the sample plays unpitched (defaults to
                ``note_low`` when the range is one note, else 60).
            sample_rate: Sample rate of ``data``.
            name: Display name.

        Returns:
            The zone dict.
        """
        if isinstance(data, (bytes, bytearray, memoryview)):
            packed = bytes(data)
        else:
            packed = _pack_float32(list(data))
        if root_note is None:
            root_note = note_low if note_low == note_high else 60
        zone = _normalize_zone(
            {
                "name": name or f"Zone {len(self.zones) + 1}",
                "note_low": note_low,
                "note_high": note_high,
                "velocity_low": velocity_low,
                "velocity_high": velocity_high,
                "root_note": root_note,
                "sample_rate": sample_rate,
                "data": packed,
            },
            len(self.zones),
        )
        self.zones = [*self.zones, zone]
        return zone

    def add_zone_file(self, path, note_low=0, note_high=127, **kwargs):
        """Add a zone from an audio file (WAV via stdlib, others via ``soundfile``)."""
        path = pathlib.Path(path)
        samples, sample_rate = self._decode_audio_file(path)
        kwargs.setdefault("name", path.name)
        return self.add_zone(samples, note_low, note_high, sample_rate=sample_rate, **kwargs)

    def set_zone(self, index, **fields):
        """Update fields of one zone (range, root note, name); returns the zone."""
        zones = list(self.zones)
        zone = {**zones[index], **fields}
        zones[index] = _normalize_zone(zone, index)
        self.zones = zones
        return zones[index]

    def remove_zone(self, index):
        """Remove the zone at ``index``."""
        zones = list(self.zones)
        del zones[index]
        self.zones = zones

    def clear_zones(self):
        self.zones = []

    def zone_for(self, note, velocity=100):
        """Return the first zone matching ``note`` and ``velocity``, or None."""
        note = _clamp_midi_note(note)
        velocity = _clamp_velocity(velocity)
        for zone in self.zones:
            if zone["note_low"] <= note <= zone["note_high"] and zone["velocity_low"] <= velocity <= zone["velocity_high"]:
                return zone
        return None

    def zone_samples(self, index):
        """Return one zone's PCM as floats."""
        return _unpack_float32(self.zones[index]["data"])

    def to_sample_map(self):
        """Build a Rust ``SampleMap``: zones in order, then the main sample as the fallback."""
        from nbplay import AudioSample, SampleMap, SampleMapping

        sample_map = SampleMap()
        for zone in self.zones:
            sample = AudioSample(_unpack_float32(zone["data"]), zone["sample_rate"], zone["root_note"])
            sample_map.add_mapping(SampleMapping(sample, zone["note_low"], zone["note_high"], zone["velocity_low"], zone["velocity_high"]))
        if self.sample_length:
            sample = AudioSample(self.get_sample_data(), self.sample_rate, self.root_note)
            sample_map.add_mapping(SampleMapping(sample, 0, 127, 0, 127))
        return sample_map

    def capture_clip(self, timeline, clip_id, pad=None, note=None, name=None):
        """Turn a timeline audio clip into a zone, decoded by the browser.

        With ``pad`` (index) or ``note`` the zone answers to that one note
        and plays unpitched there, so the take sits on a pad; otherwise it
        covers every note. The clip's trim (``offset``/``duration``) is
        honoured. The zone appears in ``zones`` once the browser has decoded
        the audio; both widgets must be rendered in the same page.
        """
        clip_id = str(clip_id)
        clip = next((item for item in timeline.clips if item.get("id") == clip_id), None)
        if clip is None:
            raise ValueError(f"clip not found: {clip_id}")
        if clip.get("kind") == "midi" or not clip.get("audio_url"):
            raise ValueError(f"clip {clip_id} has no audio in the browser")
        if pad is not None:
            note = self.pad_notes[pad]
        if note is not None:
            note = _clamp_midi_note(note)
            note_low = note_high = root_note = note
        else:
            note_low, note_high, root_note = 0, 127, self.root_note
        seconds_per_beat = 60.0 / max(1e-6, float(timeline.bpm))
        self.capture_request = {
            "url": clip["audio_url"],
            "name": name or clip.get("name") or "Take",
            "note_low": note_low,
            "note_high": note_high,
            "root_note": root_note,
            "offset": float(clip.get("offset", 0.0)) * seconds_per_beat,
            "duration": float(clip.get("duration", 0.0)) * seconds_per_beat,
            "nonce": self.capture_request.get("nonce", 0) + 1,
        }
        return self.capture_request

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
        samples, sample_rate = self._decode_audio_file(path)
        self.load_sample(samples, sample_rate=sample_rate, root_note=root_note, name=name or path.name)
        return self

    def _decode_audio_file(self, path):
        if path.suffix.lower() == ".wav":
            return self._read_wav_file(path)
        try:
            import soundfile as sf
        except ImportError as exc:
            raise ValueError("MP3/OGG loading requires optional package 'soundfile'") from exc
        data, sample_rate = sf.read(path, dtype="float32", always_2d=True)
        return [float(sum(frame) / len(frame)) for frame in data], sample_rate

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

    Used as the master clock for a ``Session``. In the browser the transport
    drives the shared session clock on ``globalThis.__nbplay[session_id]``;
    every sequencer and timeline with the same ``session_id`` follows that
    clock directly, so play, seek, and tempo changes never wait on a kernel
    round-trip. The synced traits mirror the clock for Python callers:
    setting ``is_playing``, ``bpm``, or ``current_beat`` from Python moves
    the clock, and ``current_beat`` is updated coarsely while playing.
    """

    _esm = _STATIC / "transport.js"
    _css = _STATIC / "transport.css"

    # Session routing (set by Session so the browser clock is shared)
    session_id = traitlets.Unicode("").tag(sync=True)

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
    as an object URL in the frontend for immediate playback. Use
    :meth:`export_clip` / :meth:`write_exported_clip` to pull a clip's
    audio bytes into Python and :meth:`import_clip` to push audio back.

    Every armed lane records at once against the shared session clock.
    A lane's ``input`` is ``"microphone"`` (browser microphone),
    ``"channel"`` (a tap on the lane's mixer channel, which bounces an
    instrument track to audio), or ``"midi"`` (note events from the
    keyboard, MIDI keyboard, and pad widgets, stored as a MIDI clip that
    plays back through the lane's sampler or a built-in oscillator).
    """

    _esm = _STATIC / "timeline.js"
    _css = _STATIC / "timeline.css"

    session_id = traitlets.Unicode("").tag(sync=True)
    bpm = traitlets.Float(120.0).tag(sync=True)
    is_playing = traitlets.Bool(False).tag(sync=True)
    is_recording = traitlets.Bool(False).tag(sync=True)
    recording_track = traitlets.Int(-1).tag(sync=True)
    recording_tracks = traitlets.List(trait=traitlets.Int(), default_value=[]).tag(sync=True)
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

    # View: horizontal zoom in pixels per beat (0 fits the widget width)
    pixels_per_beat = traitlets.Float(0.0).tag(sync=True)

    # Clip audio transfer. ``export_clip_id`` asks the browser for a clip's
    # bytes; they arrive in ``exported_clip`` / ``exported_clip_data``.
    # ``import_clip_request`` / ``import_clip_data`` push bytes to the
    # browser, which attaches a playable URL to the matching clip.
    export_clip_id = traitlets.Unicode("").tag(sync=True)
    exported_clip = traitlets.Dict(default_value={}).tag(sync=True)
    exported_clip_data = traitlets.Bytes(b"").tag(sync=True)
    import_clip_request = traitlets.Dict(default_value={}).tag(sync=True)
    import_clip_data = traitlets.Bytes(b"").tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Clip audio that has arrived from the browser, by clip id, so a
        # session can be saved with its takes. See export_all_clips().
        self._clip_audio = {}
        self._export_queue = []
        self.observe(self._on_clip_exported, names="exported_clip_data")

    def _on_clip_exported(self, change):
        data = change["new"]
        clip_id = str(self.exported_clip.get("id", ""))
        if not data or not clip_id:
            return
        self._clip_audio[clip_id] = {"data": bytes(data), "blob_type": str(self.exported_clip.get("blob_type", ""))}
        if self.export_clip_id == clip_id:
            self.export_clip_id = ""
        while self._export_queue:
            next_id = self._export_queue.pop(0)
            if any(clip.get("id") == next_id for clip in self.clips):
                self.export_clip(next_id)
                break

    @property
    def clip_audio(self):
        """Clip audio bytes received from the browser, keyed by clip id."""
        return {clip_id: dict(item) for clip_id, item in self._clip_audio.items()}

    @property
    def pending_exports(self):
        """Number of clip exports still waiting on the browser."""
        return len(self._export_queue) + (1 if self.export_clip_id else 0)

    def export_all_clips(self, *, refresh=False):
        """Ask the browser for every clip's audio, one clip at a time.

        Returns the number of clips queued. The bytes accumulate in
        :attr:`clip_audio` as they arrive; wait for :attr:`pending_exports`
        to reach zero before saving the session. Clips whose audio is already
        cached are skipped unless ``refresh`` is true.
        """
        wanted = [clip["id"] for clip in self.clips if clip.get("audio_url") and (refresh or clip["id"] not in self._clip_audio)]
        if not wanted:
            return 0
        self._export_queue = wanted[1:]
        self.export_clip(wanted[0])
        return len(wanted)

    @traitlets.validate("pixels_per_beat")
    def _validate_pixels_per_beat(self, proposal):
        return _nonnegative_number(proposal["value"], "pixels_per_beat", maximum=400.0)

    @traitlets.validate("recording_tracks")
    def _validate_recording_tracks(self, proposal):
        count = len(self.tracks)
        seen = []
        for value in proposal["value"] or []:
            index = int(value)
            if 0 <= index < count and index not in seen:
                seen.append(index)
        return seen

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

    def add_track(self, name="Track", channel_index=None, *, armed=False, monitor=False, input="microphone"):
        """Append a timeline lane and return its index.

        ``input`` selects the record source: ``"microphone"`` captures
        the browser microphone, ``"channel"`` taps the lane's mixer
        channel so instrument output is bounced to an audio clip.
        """
        idx = len(self.tracks)
        track = TimelineTrack(
            name=name,
            channel_index=idx if channel_index is None else channel_index,
            armed=armed,
            monitor=monitor,
            input=input,
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
        self.recording_tracks = [i if i < index else i - 1 for i in self.recording_tracks if i != index]
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

    def add_midi_clip(self, name="MIDI", track_index=0, start=0.0, events=(), duration=None, **kwargs):
        """Append a MIDI clip and return it.

        ``events`` may be dicts (``beat``, ``duration``, ``note``,
        ``velocity``; beats are relative to the clip start), ``NoteEvent``
        objects, or an ``EventSequence``. ``duration`` defaults to the end
        of the last event, at least one beat.
        """
        normalized = _normalize_midi_events(events)
        if duration is None:
            duration = max([1.0, *(event["beat"] + event["duration"] for event in normalized)])
        return self.add_clip(name, track_index=track_index, start=start, duration=duration, kind="midi", events=normalized, **kwargs)

    def add_pattern_clip(self, name, pattern, track_index=0, start=0.0, step_duration=0.25, repeat=1, duration=None, **kwargs):
        """Append a MIDI clip that plays ``pattern`` (steps) ``repeat`` times.

        ``pattern`` is anything ``LauncherWidget.set_slot`` accepts: a
        ``SequencerWidget``, a ``NoteComposer``, a list of step dicts, or a
        list of voices. Active steps become notes at ``step_duration`` beats
        per step; the clip's ``pattern`` field records ``name`` so
        ``Session.update_pattern()`` can regenerate it later.
        """
        voices = _slot_voices(pattern)
        step_duration = _positive_number(step_duration, "step_duration", minimum=0.001, maximum=16.0)
        length = max(len(voice) for voice in voices) * step_duration
        base = _steps_to_events(voices, step_duration)
        repeat = max(1, int(repeat))
        events = [{**event, "beat": event["beat"] + cycle * length} for cycle in range(repeat) for event in base]
        if duration is None:
            duration = length * repeat
        return self.add_midi_clip(name, track_index=track_index, start=start, events=events, duration=duration, pattern=name, **kwargs)

    def export_midi_clip(self, clip_id, path=None):
        """Write one MIDI clip to a ``.mid`` file (or return the ``mido.MidiFile``)."""
        from nbplay.midi import build_midi

        clip_id = str(clip_id)
        for clip in self.clips:
            if clip.get("id") == clip_id:
                if clip.get("kind") != "midi":
                    raise ValueError(f"clip {clip_id} is not a MIDI clip")
                midi = build_midi(
                    [{"name": clip["name"], "events": clip.get("events", [])}],
                    bpm=self.bpm,
                    time_signature=(self.time_signature_num, self.time_signature_den),
                )
                if path is not None:
                    midi.save(os.fspath(path))
                return midi
        raise ValueError(f"clip not found: {clip_id}")

    def import_midi(self, source, track_index=0, start=0.0):
        """Add one MIDI clip per MIDI track with notes, all on one lane at ``start``.

        Returns the clips added. Beats in the file map straight onto the
        timeline; the file's tempo is not applied.
        """
        from nbplay.midi import read_midi

        added = []
        for item in read_midi(source)["tracks"]:
            added.append(self.add_midi_clip(item["name"], track_index=track_index, start=start, events=item["events"]))
        return added

    def clip_to_event_sequence(self, clip_id):
        """Return a MIDI clip's events as a Rust ``EventSequence``."""
        clip_id = str(clip_id)
        for clip in self.clips:
            if clip.get("id") == clip_id:
                if clip.get("kind") != "midi":
                    raise ValueError(f"clip {clip_id} is not a MIDI clip")
                sequence = EventSequence()
                for event in clip.get("events", []):
                    sequence.add_event(NoteEvent(event["beat"], event["duration"], event["note"], event["velocity"]))
                return sequence
        raise ValueError(f"clip not found: {clip_id}")

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

    def duplicate_clip(self, clip_id):
        """Copy a clip onto the same lane right after the original."""
        clip_id = str(clip_id)
        for clip in self.clips:
            if clip.get("id") == clip_id:
                copy = {**clip, "id": _clip_id(), "start": clip["start"] + clip["duration"]}
                copy = _normalize_audio_clip(copy, len(self.clips), len(self.tracks))
                self.clips = [*self.clips, copy]
                self.selected_clip_id = copy["id"]
                self.length = max(self.length, copy["start"] + copy["duration"])
                return copy
        raise ValueError(f"clip not found: {clip_id}")

    def export_clip(self, clip_id):
        """Ask the browser for a clip's audio bytes.

        The bytes arrive asynchronously in ``exported_clip_data`` with
        the clip descriptor in ``exported_clip``; observe either trait
        or call :meth:`write_exported_clip` once they have arrived.
        """
        clip_id = str(clip_id)
        if not any(clip.get("id") == clip_id for clip in self.clips):
            raise ValueError(f"clip not found: {clip_id}")
        self.exported_clip = {}
        self.exported_clip_data = b""
        self.export_clip_id = clip_id

    def write_exported_clip(self, path):
        """Write the most recently exported clip bytes to ``path``."""
        if not self.exported_clip_data:
            raise ValueError("no exported clip data; call export_clip() and wait for the browser")
        with open(path, "wb") as handle:
            handle.write(self.exported_clip_data)
        return self.exported_clip

    def import_clip(self, data, name="Import", track_index=0, start=0.0, duration=None, blob_type="audio/webm", **kwargs):
        """Add a clip backed by audio bytes (or a file path).

        The clip descriptor is appended immediately; the browser attaches
        a playable URL to it once the bytes arrive. When ``duration`` is
        omitted the browser measures the audio and fills it in.
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
        self.import_clip_data = data
        self.import_clip_request = {**clip, "measure_duration": duration is None}
        return clip

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


_LAUNCH_QUANTIZE = ("bar", "beat", "none")


def _slot_voices(pattern):
    """Coerce a pattern into ``voices_data`` (list of voices, each a list of step dicts)."""
    if isinstance(pattern, SequencerWidget):
        return [list(steps) for steps in pattern.voices_data]
    if isinstance(pattern, NoteComposer):
        return [list(pattern.steps)]
    if isinstance(pattern, (list, tuple)):
        if not pattern:
            raise ValueError("pattern must not be empty")
        if all(isinstance(voice, (list, tuple)) for voice in pattern):
            return [list(voice) for voice in pattern]
        if all(isinstance(step, dict) for step in pattern):
            return [list(pattern)]
    raise ValueError("pattern must be a SequencerWidget, NoteComposer, list of step dicts, or list of voices")


def _normalize_launcher_slot(slot):
    voices = []
    for voice in slot.get("voices_data") or []:
        voices.append([dict(step) for step in voice])
    length = max((len(voice) for voice in voices), default=0)
    if length == 0:
        raise ValueError("launcher slot needs at least one step")
    return {
        "track_index": max(0, int(slot.get("track_index", 0))),
        "scene_index": max(0, int(slot.get("scene_index", 0))),
        "name": str(slot.get("name", "Clip")),
        "voices_data": [voice + _default_steps(length - len(voice)) for voice in voices],
        "step_duration": _positive_number(slot.get("step_duration", 0.25), "step_duration", minimum=0.001, maximum=16.0),
        "swing": _clamped_number(slot.get("swing", 0.0), 0.0, 100.0, "swing"),
        "groove": [float(value) for value in (slot.get("groove") or [])],
    }


class LauncherWidget(anywidget.AnyWidget):
    """Beats view: a clip launcher in the session-view style.

    Tracks are rows, scenes are columns, and each filled slot holds a step
    pattern in the same ``voices_data`` shape as :class:`SequencerWidget`.
    Launching a slot starts it on the next quantization boundary of the
    shared session clock, so every playing slot stays phase-locked; a scene
    launches its whole column. Playback runs in the browser through the
    session mixer channel of each track, which means a launcher performance
    can be captured by the timeline through channel-tap lanes.
    """

    _esm = _STATIC / "launcher.js"
    _css = _STATIC / "launcher.css"

    session_id = traitlets.Unicode("").tag(sync=True)
    bpm = traitlets.Float(120.0).tag(sync=True)
    is_playing = traitlets.Bool(False).tag(sync=True)
    time_signature_num = traitlets.Int(4).tag(sync=True)
    time_signature_den = traitlets.Int(4).tag(sync=True)

    # "bar", "beat", or "none": when a launch takes effect
    quantize = traitlets.Unicode("bar").tag(sync=True)

    tracks = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)
    scenes = traitlets.List(trait=traitlets.Unicode(), default_value=[]).tag(sync=True)
    slots = traitlets.List(trait=traitlets.Dict(), default_value=[]).tag(sync=True)

    # Per track: playing scene index or -1; queued scene index, -1 for a
    # queued stop, -2 for nothing queued. Mirrored by the browser.
    active_slots = traitlets.List(trait=traitlets.Int(), default_value=[]).tag(sync=True)
    queued_slots = traitlets.List(trait=traitlets.Int(), default_value=[]).tag(sync=True)
    selected_slot = traitlets.Dict(default_value={}).tag(sync=True)

    # Python -> browser command; the nonce makes repeated commands distinct
    launch_request = traitlets.Dict(default_value={}).tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._request_nonce = 0
        self._editor_links = []

    @traitlets.validate("quantize")
    def _validate_quantize(self, proposal):
        value = str(proposal["value"])
        if value not in _LAUNCH_QUANTIZE:
            raise ValueError(f"quantize must be one of {_LAUNCH_QUANTIZE}, got {value!r}")
        return value

    @traitlets.validate("tracks")
    def _validate_tracks(self, proposal):
        tracks = []
        for index, track in enumerate(proposal["value"] or []):
            tracks.append(
                {
                    "name": str(track.get("name", f"Track {index + 1}")),
                    "channel_index": max(-1, int(track.get("channel_index", index))),
                }
            )
        return tracks

    @traitlets.validate("scenes")
    def _validate_scenes(self, proposal):
        return [str(name) for name in proposal["value"] or []]

    @traitlets.validate("slots")
    def _validate_slots(self, proposal):
        return [_normalize_launcher_slot(slot) for slot in proposal["value"] or []]

    @traitlets.validate("active_slots", "queued_slots")
    def _validate_slot_states(self, proposal):
        floor = -1 if proposal["trait"].name == "active_slots" else -2
        return [max(floor, int(value)) for value in proposal["value"] or []]

    def _find_slot(self, track_index, scene_index):
        for position, slot in enumerate(self.slots):
            if slot["track_index"] == track_index and slot["scene_index"] == scene_index:
                return position
        return -1

    def _check_indices(self, track_index, scene_index=None):
        track_index = int(track_index)
        if track_index < 0 or track_index >= len(self.tracks):
            raise IndexError(f"track index out of range: {track_index}")
        if scene_index is None:
            return track_index, None
        scene_index = int(scene_index)
        if scene_index < 0 or scene_index >= len(self.scenes):
            raise IndexError(f"scene index out of range: {scene_index}")
        return track_index, scene_index

    def add_track(self, name="Track", channel_index=None):
        """Append a track row and return its index."""
        idx = len(self.tracks)
        self.tracks = [*self.tracks, {"name": name, "channel_index": idx if channel_index is None else channel_index}]
        self.active_slots = [*self.active_slots, -1]
        self.queued_slots = [*self.queued_slots, -2]
        return idx

    def add_scene(self, name=None):
        """Append a scene column and return its index."""
        idx = len(self.scenes)
        self.scenes = [*self.scenes, str(name) if name is not None else f"Scene {idx + 1}"]
        return idx

    def set_slot(self, track_index, scene_index, pattern, *, name=None, step_duration=None, swing=0.0, groove=None):
        """Fill a slot with a pattern and return the stored slot.

        ``pattern`` may be a :class:`SequencerWidget`, a :class:`NoteComposer`,
        a list of step dicts (one voice), or a list of voices.
        """
        track_index, scene_index = self._check_indices(track_index, scene_index)
        voices = _slot_voices(pattern)
        if step_duration is None:
            step_duration = pattern.step_duration if isinstance(pattern, SequencerWidget) else 0.25
        if swing == 0.0 and isinstance(pattern, SequencerWidget):
            swing = pattern.swing
        if groove is None and isinstance(pattern, SequencerWidget):
            groove = list(pattern.groove)
        slot = _normalize_launcher_slot(
            {
                "track_index": track_index,
                "scene_index": scene_index,
                "name": name if name is not None else f"{self.tracks[track_index]['name']} {scene_index + 1}",
                "voices_data": voices,
                "step_duration": step_duration,
                "swing": swing,
                "groove": groove or [],
            }
        )
        position = self._find_slot(track_index, scene_index)
        slots = list(self.slots)
        if position >= 0:
            slots[position] = slot
        else:
            slots.append(slot)
        self.slots = slots
        return slot

    def get_slot(self, track_index, scene_index):
        """Return the slot dict at ``(track_index, scene_index)`` or ``None``."""
        position = self._find_slot(int(track_index), int(scene_index))
        return dict(self.slots[position]) if position >= 0 else None

    def clear_slot(self, track_index, scene_index):
        """Empty a slot."""
        track_index, scene_index = self._check_indices(track_index, scene_index)
        self.slots = [slot for slot in self.slots if not (slot["track_index"] == track_index and slot["scene_index"] == scene_index)]
        if self.selected_slot == {"track_index": track_index, "scene_index": scene_index}:
            self.selected_slot = {}

    def _request(self, **payload):
        self._request_nonce += 1
        self.launch_request = {**payload, "nonce": self._request_nonce}

    def launch(self, track_index, scene_index):
        """Launch a slot on the next quantization boundary."""
        track_index, scene_index = self._check_indices(track_index, scene_index)
        if self._find_slot(track_index, scene_index) < 0:
            raise ValueError(f"no slot at track {track_index}, scene {scene_index}")
        self._request(action="launch", track_index=track_index, scene_index=scene_index)

    def stop_track(self, track_index):
        """Stop a track on the next quantization boundary."""
        track_index, _ = self._check_indices(track_index)
        self._request(action="stop", track_index=track_index)

    def launch_scene(self, scene_index):
        """Launch every slot in a scene; tracks with no slot there stop."""
        _, scene_index = self._check_indices(0, scene_index) if self.tracks else (None, int(scene_index))
        if scene_index < 0 or scene_index >= len(self.scenes):
            raise IndexError(f"scene index out of range: {scene_index}")
        self._request(action="scene", scene_index=scene_index)

    def stop_all(self):
        """Stop every track on the next quantization boundary."""
        self._request(action="stop_all")

    def slot_to_sequencer(self, track_index, scene_index, sequencer):
        """Load a slot's pattern into a :class:`SequencerWidget` for editing."""
        slot = self.get_slot(track_index, scene_index)
        if slot is None:
            raise ValueError(f"no slot at track {track_index}, scene {scene_index}")
        voices = [list(voice) for voice in slot["voices_data"]]
        sequencer.step_duration = slot["step_duration"]
        sequencer.swing = slot["swing"]
        sequencer.groove = list(slot["groove"])
        # Voice count first: a one-voice editor given two voices would keep
        # one composer and write the pattern back with a voice missing.
        sequencer.num_voices = max(1, len(voices))
        sequencer.voices_data = voices
        return slot

    def bind_slot_editor(self, sequencer):
        """Use ``sequencer`` as the editor for whichever slot is selected.

        Selecting a slot (by clicking it, or setting ``selected_slot``) loads
        it into the sequencer; edits to the sequencer's steps write back into
        that slot. Returns a function that removes the binding.
        """
        state = {"loading": False}

        def load(_change=None):
            selected = self.selected_slot
            if not selected or self.get_slot(selected["track_index"], selected["scene_index"]) is None:
                return
            state["loading"] = True
            try:
                self.slot_to_sequencer(selected["track_index"], selected["scene_index"], sequencer)
            finally:
                state["loading"] = False

        def write_back(_change=None):
            selected = self.selected_slot
            if state["loading"] or not selected:
                return
            if self._find_slot(selected["track_index"], selected["scene_index"]) < 0:
                return
            current = self.get_slot(selected["track_index"], selected["scene_index"])
            self.set_slot(
                selected["track_index"],
                selected["scene_index"],
                sequencer,
                name=current["name"],
                step_duration=sequencer.step_duration,
                swing=sequencer.swing,
                groove=list(sequencer.groove),
            )

        self.observe(load, names="selected_slot")
        sequencer.observe(write_back, names=["voices_data", "step_duration", "swing", "groove"])
        load()

        def unbind():
            self.unobserve(load, names="selected_slot")
            sequencer.unobserve(write_back, names=["voices_data", "step_duration", "swing", "groove"])

        self._editor_links.append(unbind)
        return unbind

    def __repr__(self):
        return f"LauncherWidget(tracks={len(self.tracks)}, scenes={len(self.scenes)}, slots={len(self.slots)})"


_SESSION_FORMAT = "nbplay-session"
_SESSION_FORMAT_VERSION = 1
_SEQUENCER_STATE = (
    "num_voices",
    "length",
    "measures",
    "step_duration",
    "time_signature_num",
    "time_signature_den",
    "swing",
    "groove",
    "automation_lanes",
    "loop_enabled",
    "follow_transport",
)
_SYNTH_STATE = ("oscillator_type", "frequency", "amplitude", "sample_rate")
_SAMPLER_STATE = (
    "sample_name",
    "sample_rate",
    "root_note",
    "attack",
    "decay",
    "sustain",
    "release",
    "pad_count",
    "max_voices",
    "velocity",
    "velocity_sensitive",
)
_SAMPLER_PAD_STATE = ("pad_notes", "pad_velocities", "pad_actions", "sample_slices")
_TIMELINE_STATE = ("length", "count_in_bars", "auto_extend_recording", "recording_extend_bars", "pixels_per_beat")
_TRANSPORT_STATE = ("bpm", "time_signature_num", "time_signature_den", "loop_enabled", "loop_start_bar", "loop_end_bar")


def _json_copy(value):
    return json.loads(json.dumps(value))


def _widget_state(widget, names):
    return {name: _json_copy(getattr(widget, name)) for name in names}


def _sound_source_to_dict(source, index, resources):
    if source is None:
        return None
    if isinstance(source, SynthWidget):
        return {"type": "SynthWidget", "state": _widget_state(source, _SYNTH_STATE)}
    if isinstance(source, SamplerWidget):
        entry = {
            "type": "SamplerWidget",
            "state": {**_widget_state(source, _SAMPLER_STATE), **_widget_state(source, _SAMPLER_PAD_STATE)},
        }
        if source.sample_data:
            if resources is not None:
                name = f"samples/track-{index}.f32"
                resources[name] = bytes(source.sample_data)
                entry["sample_file"] = name
            entry["sample_length"] = int(source.sample_length)
        if source.zones:
            saved = []
            for zone_index, zone in enumerate(source.zones):
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
                _unpack_float32(resources[sample_file]),
                sample_rate=state.get("sample_rate", 44100),
                root_note=state.get("root_note", 69),
                name=state.get("sample_name", "Sample"),
            )
        for name in _SAMPLER_PAD_STATE:
            if name in state:
                setattr(sampler, name, state[name])
        zones = []
        for zone in entry.get("zones", []):
            sample_file = zone.get("sample_file")
            data = resources.get(sample_file, b"") if sample_file else b""
            zones.append({**{k: v for k, v in zone.items() if k != "sample_file"}, "data": data})
        if zones:
            sampler.zones = zones
        return sampler
    raise ValueError(f"unknown sound source type in session data: {kind!r}")


def _sequencer_from_dict(state):
    if state is None:
        return None
    ctor = {k: state[k] for k in ("num_voices", "length", "measures", "step_duration", "time_signature_num", "time_signature_den") if k in state}
    sequencer = SequencerWidget(**ctor)
    for name in ("swing", "groove", "automation_lanes", "loop_enabled", "follow_transport"):
        if name in state:
            setattr(sequencer, name, state[name])
    if state.get("voices_data"):
        sequencer.voices_data = _json_copy(state["voices_data"])
    return sequencer


def _session_to_dict(session, resources=None):
    tracks = []
    for index, track in enumerate(session.tracks):
        sequencer = None
        if track.sequencer is not None:
            sequencer = {**_widget_state(track.sequencer, _SEQUENCER_STATE), "voices_data": _json_copy(track.sequencer.voices_data)}
        tracks.append(
            {
                "name": track.name,
                "sequencer": sequencer,
                "sound_source": _sound_source_to_dict(track.sound_source, index, resources),
            }
        )
    clips = []
    cached = session.timeline.clip_audio
    for clip in session.timeline.clips:
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
        "transport": _widget_state(session.transport, _TRANSPORT_STATE),
        "mixer": _widget_state(session.mixer, ("channels", "master_gain", "master_effects")),
        "tracks": tracks,
        "timeline": {**_widget_state(session.timeline, _TIMELINE_STATE), "tracks": _json_copy(session.timeline.tracks), "clips": clips},
        "launcher": _widget_state(session.launcher, ("quantize", "scenes", "slots")),
        "patterns": _json_copy(session.patterns),
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
    )
    for name in ("loop_enabled", "loop_start_bar", "loop_end_bar"):
        if name in transport:
            setattr(session.transport, name, transport[name])

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
    if mixer.get("channels"):
        session.mixer.channels = mixer["channels"]
    if "master_gain" in mixer:
        session.mixer.master_gain = mixer["master_gain"]
    if "master_effects" in mixer:
        session.mixer.master_effects = mixer["master_effects"]

    timeline = session.timeline
    for name in _TIMELINE_STATE:
        if name in timeline_data:
            setattr(timeline, name, timeline_data[name])
    if saved_lanes:
        timeline.tracks = saved_lanes
    for clip in timeline_data.get("clips", []):
        fields = {k: v for k, v in clip.items() if k not in ("audio_file",)}
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
    timeline.selected_clip_id = ""

    launcher_data = data.get("launcher", {})
    for name in launcher_data.get("scenes", []):
        session.launcher.add_scene(name)
    if launcher_data.get("slots"):
        session.launcher.slots = launcher_data["slots"]
    if "quantize" in launcher_data:
        session.launcher.quantize = launcher_data["quantize"]
    for name, pattern in data.get("patterns", {}).items():
        session.add_pattern(name, pattern.get("voices_data", []), step_duration=pattern.get("step_duration", 0.25))
    return session


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

    # Last control change received: ``{"controller", "value", "channel", "seq"}``.
    # ``seq`` increases per message so repeated identical values still notify.
    control_change = traitlets.Dict({}).tag(sync=True)


class MidiOutputWidget(anywidget.AnyWidget):
    """Send notes and control changes to a browser Web MIDI output port.

    With a ``session_id`` the widget forwards every note the session plays
    (keyboards, sequencers, launcher slots, MIDI clips) to the selected
    port, at the scheduled time. Without one it forwards the notes that
    keyboards and pads broadcast. ``forward_notes`` switches that off so
    only messages sent from Python go out.
    """

    _esm = _STATIC / "midi_output.js"
    _css = _STATIC / "midi_output.css"

    session_id = traitlets.Unicode("").tag(sync=True)
    midi_port = traitlets.Unicode("").tag(sync=True)
    available_midi_ports = traitlets.List(traitlets.Unicode(), []).tag(sync=True)
    channel = traitlets.Int(0, min=0, max=15).tag(sync=True)
    forward_notes = traitlets.Bool(True).tag(sync=True)
    send_request = traitlets.Dict({}).tag(sync=True)

    def _request(self, **message):
        message["nonce"] = self.send_request.get("nonce", 0) + 1
        self.send_request = message

    def note_on(self, note, velocity=100):
        """Send a note-on on the widget's channel."""
        self._request(kind="note_on", note=_clamp_midi_note(note), velocity=max(1, _clamp_velocity(velocity)))

    def note_off(self, note):
        """Send a note-off on the widget's channel."""
        self._request(kind="note_off", note=_clamp_midi_note(note))

    def control_change(self, controller, value):
        """Send a control change (0-127) on the widget's channel."""
        self._request(kind="control_change", controller=_clamp_int(controller, 0, 127), value=_clamp_int(value, 0, 127))

    def send(self, data):
        """Send raw MIDI bytes, for example ``[0xC0, 5]`` for a program change."""
        data = [_clamp_int(b, 0, 255) for b in data]
        if not data:
            raise ValueError("MIDI message must not be empty")
        self._request(kind="raw", data=data)


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
    """A session lane: a mixer channel plus an optional instrument.

    A track may carry a sequencer and a sound source (an instrument
    lane), only a sound source (a sampler or keyboard lane), or neither
    (an audio lane that records from the microphone into the timeline).
    When a sequencer is present, ``traitlets.link()`` propagates BPM
    and play state from the ``Session`` transport to it.

    Args:
        name: Track display name.
        sequencer: A ``SequencerWidget`` or ``None``.
        sound_source: A widget that produces audio, or ``None``.
        mixer_channel: Zero-based mixer channel index.
    """

    def __init__(self, name, sequencer=None, sound_source=None, mixer_channel=0):
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
        end does not stop every other sequencer. Tracks without a
        sequencer have nothing to link.

        Args:
            transport: A ``TransportWidget``.
        """
        if self.sequencer is None:
            return
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
        src_type = type(self.sound_source).__name__ if self.sound_source is not None else "audio"
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
            session_id=self._session_id,
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
        self.launcher = LauncherWidget(
            session_id=self._session_id,
            bpm=bpm,
            time_signature_num=time_signature[0],
            time_signature_den=time_signature[1],
        )
        self._launcher_links = [
            traitlets.link((self.transport, "bpm"), (self.launcher, "bpm")),
            traitlets.link((self.transport, "time_signature_num"), (self.launcher, "time_signature_num")),
            traitlets.link((self.transport, "time_signature_den"), (self.launcher, "time_signature_den")),
            traitlets.link((self.transport, "is_playing"), (self.launcher, "is_playing")),
        ]
        self._timeline_links = [
            traitlets.link((self.transport, "bpm"), (self.timeline, "bpm")),
            traitlets.link((self.transport, "time_signature_num"), (self.timeline, "time_signature_num")),
            traitlets.link((self.transport, "time_signature_den"), (self.timeline, "time_signature_den")),
            traitlets.link((self.transport, "is_playing"), (self.timeline, "is_playing")),
            traitlets.link((self.transport, "is_recording"), (self.timeline, "is_recording")),
            # One-way: the transport persists the shared clock position.
            # Timeline seeks reach the transport through the browser clock.
            traitlets.dlink((self.transport, "current_beat"), (self.timeline, "current_beat")),
        ]
        self.tracks = []
        # Named patterns for the tracking view: name -> {voices_data, step_duration}.
        self.patterns = {}
        # Lane mute/solo and mixer channel mute/solo are the same control
        # from the user's side; keep them mirrored by channel index.
        self._mirroring_mute_solo = False
        self.timeline.observe(self._on_timeline_tracks, names="tracks")
        self.mixer.observe(self._on_mixer_channels, names="channels")

    def _on_timeline_tracks(self, change):
        if self._mirroring_mute_solo:
            return
        channels = [dict(channel) for channel in self.mixer.channels]
        changed = False
        for track in change["new"] or []:
            index = int(track.get("channel_index", -1))
            if 0 <= index < len(channels):
                for lane_key, channel_key in (("muted", "mute"), ("solo", "solo")):
                    value = bool(track.get(lane_key, False))
                    if channels[index].get(channel_key) != value:
                        channels[index][channel_key] = value
                        changed = True
        if changed:
            self._mirroring_mute_solo = True
            try:
                self.mixer.channels = channels
            finally:
                self._mirroring_mute_solo = False

    def _on_mixer_channels(self, change):
        if self._mirroring_mute_solo:
            return
        channels = change["new"] or []
        tracks = [dict(track) for track in self.timeline.tracks]
        changed = False
        for track in tracks:
            index = int(track.get("channel_index", -1))
            if 0 <= index < len(channels):
                for lane_key, channel_key in (("muted", "mute"), ("solo", "solo")):
                    value = bool(channels[index].get(channel_key, False))
                    if track.get(lane_key) != value:
                        track[lane_key] = value
                        changed = True
        if changed:
            self._mirroring_mute_solo = True
            try:
                self.timeline.tracks = tracks
            finally:
                self._mirroring_mute_solo = False

    @property
    def session_id(self):
        """Identifier shared by every widget on this session's browser bus."""
        return self._session_id

    def play(self):
        """Start the shared transport."""
        self.transport.is_playing = True

    def stop(self):
        """Stop the shared transport, keeping the playhead position."""
        self.transport.is_playing = False

    def seek(self, beat):
        """Move the shared playhead to ``beat`` (quarter-note units)."""
        self.transport.current_beat = float(beat)

    def add_track(self, name, sequencer=None, sound_source=None, *, input=None, armed=False):
        """Add a track, create a mixer channel, and link transport state.

        Every track gets a mixer channel and a timeline lane. Tracks with
        an instrument (a sequencer and/or a sound source) default their
        timeline input to ``"channel"`` so the instrument's output can be
        bounced to audio; tracks with neither default to ``"microphone"``.

        Args:
            name: Track display name.
            sequencer: A ``SequencerWidget``, or ``None`` for a lane
                without a step sequencer.
            sound_source: A widget that produces audio, or ``None`` for
                an audio-only lane.
            input: Timeline record source, ``"microphone"`` or
                ``"channel"``. Defaults by instrument presence.
            armed: Arm the timeline lane for recording.

        Returns:
            The new ``Track`` object.
        """
        channel_idx = self.mixer.add_channel(name)
        track = Track(name, sequencer, sound_source, channel_idx)
        track._link_transport(self.transport)
        # Set audio routing metadata so JS can route through mixer
        if sequencer is not None:
            sequencer.session_id = self._session_id
            sequencer.channel_index = channel_idx
        # Also set routing on sound source (e.g. SamplerWidget) so it
        # can register on the session bus for keyboard integration.
        if hasattr(sound_source, "session_id"):
            sound_source.session_id = self._session_id
        if hasattr(sound_source, "channel_index"):
            sound_source.channel_index = channel_idx
        self.tracks.append(track)
        if input is None:
            input = "channel" if (sequencer is not None or sound_source is not None) else "microphone"
        self.timeline.add_track(name, channel_idx, armed=armed, input=input)
        self.launcher.add_track(name, channel_idx)
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
            if track.sequencer is not None:
                track.sequencer.session_id = ""
                track.sequencer.channel_index = -1
            if hasattr(track.sound_source, "session_id"):
                track.sound_source.session_id = ""
            if hasattr(track.sound_source, "channel_index"):
                track.sound_source.channel_index = -1
            self.mixer.remove_channel(track.mixer_channel)
            self.timeline.remove_track(index)
            self._remove_launcher_track(index)
            # Adjust mixer_channel indices for remaining tracks
            for t in self.tracks:
                if t.mixer_channel > track.mixer_channel:
                    t.mixer_channel -= 1
                    if t.sequencer is not None:
                        t.sequencer.channel_index -= 1
                    if hasattr(t.sound_source, "channel_index"):
                        t.sound_source.channel_index -= 1

    # Pattern chaining

    def _track_index(self, track):
        if isinstance(track, Track):
            index = self.tracks.index(track)
        elif isinstance(track, str):
            names = [item.name for item in self.tracks]
            if track not in names:
                raise ValueError(f"no track named {track!r}")
            index = names.index(track)
        else:
            index = int(track)
            if not 0 <= index < len(self.tracks):
                raise IndexError(f"track index out of range: {index}")
        return index

    def add_pattern(self, name, pattern, step_duration=None):
        """Register a named pattern for chaining; returns its stored form.

        ``pattern`` is a ``SequencerWidget`` (its grid and step duration are
        used), a ``NoteComposer``, a list of step dicts, or a list of voices.
        """
        voices = _slot_voices(pattern)
        if step_duration is None:
            step_duration = pattern.step_duration if isinstance(pattern, SequencerWidget) else 0.25
        length = max(len(voice) for voice in voices)
        entry = {
            "voices_data": [[dict(step) for step in voice] + _default_steps(length - len(voice)) for voice in voices],
            "step_duration": _positive_number(step_duration, "step_duration", minimum=0.001, maximum=16.0),
        }
        self.patterns[str(name)] = entry
        return entry

    def remove_pattern(self, name):
        """Forget a pattern; clips already placed keep playing as MIDI clips."""
        del self.patterns[str(name)]

    def chain(self, track, names, start=0.0, repeat=1):
        """Place named patterns back to back on a track's lane; returns the clips.

        Each name becomes one pattern clip that plays ``repeat`` times. A
        track with a sequencer stops following the transport
        (``follow_transport = False``) so the arrangement drives it; the
        clips play through the track's sampler or the built-in oscillator.
        """
        index = self._track_index(track)
        item = self.tracks[index]
        missing = [name for name in names if str(name) not in self.patterns]
        if missing:
            raise ValueError(f"unknown pattern(s): {', '.join(map(str, missing))}")
        if item.sequencer is not None:
            item.sequencer.follow_transport = False
        clips = []
        position = _nonnegative_number(start, "start")
        for name in names:
            pattern = self.patterns[str(name)]
            clip = self.timeline.add_pattern_clip(
                str(name),
                pattern["voices_data"],
                track_index=index,
                start=position,
                step_duration=pattern["step_duration"],
                repeat=repeat,
            )
            clips.append(clip)
            position += clip["duration"]
        end = max(self.timeline.length, math.ceil(position))
        self.timeline.length = max(self.timeline.length, end)
        return clips

    def update_pattern(self, name, pattern, step_duration=None):
        """Replace a pattern and regenerate every clip placed from it."""
        name = str(name)
        entry = self.add_pattern(name, pattern, step_duration=step_duration)
        scratch = TimelineWidget()
        clips = []
        for clip in self.timeline.clips:
            if clip.get("pattern") != name:
                clips.append(clip)
                continue
            length = max(len(voice) for voice in entry["voices_data"]) * entry["step_duration"]
            repeat = max(1, round(clip["duration"] / length)) if length > 0 else 1
            rebuilt = scratch.add_pattern_clip(
                name,
                entry["voices_data"],
                track_index=clip["track_index"],
                start=clip["start"],
                step_duration=entry["step_duration"],
                repeat=repeat,
                duration=clip["duration"],
                id=clip["id"],
                muted=clip.get("muted", False),
            )
            clips.append(rebuilt)
        self.timeline.clips = clips
        return entry

    # MIDI files

    def export_midi(self, path=None):
        """Export the session's sequencer patterns and MIDI clips as one MIDI file.

        Each sequencer track becomes one MIDI track from beat 0; each MIDI
        clip becomes one MIDI track placed at its timeline position. Returns
        the ``mido.MidiFile`` (written to ``path`` if given).
        """
        from nbplay.midi import build_midi, steps_to_events

        tracks = []
        for track in self.tracks:
            if track.sequencer is not None:
                events = steps_to_events(track.sequencer.voices_data, track.sequencer.step_duration)
                tracks.append({"name": track.name, "events": events, "channel": min(15, max(0, track.mixer_channel))})
        for clip in self.timeline.clips:
            if clip.get("kind") == "midi" and clip.get("events"):
                offset = float(clip.get("offset", 0.0))
                events = [
                    {**event, "beat": clip["start"] + event["beat"] - offset}
                    for event in clip["events"]
                    if event["beat"] >= offset and event["beat"] - offset < clip["duration"]
                ]
                lane = self.timeline.tracks[clip["track_index"]] if clip["track_index"] < len(self.timeline.tracks) else {}
                channel = min(15, max(0, int(lane.get("channel_index", 0))))
                tracks.append({"name": clip["name"], "events": events, "channel": channel})
        midi = build_midi(
            tracks,
            bpm=self.transport.bpm,
            time_signature=(self.transport.time_signature_num, self.transport.time_signature_den),
        )
        if path is not None:
            midi.save(os.fspath(path))
        return midi

    def import_midi(self, source, *, apply_tempo=True):
        """Add one MIDI lane per MIDI track with notes, each holding the track as a clip.

        Returns the new ``Track`` objects. With ``apply_tempo`` the file's
        tempo and time signature are written to the transport.
        """
        from nbplay.midi import read_midi

        data = read_midi(source)
        if apply_tempo:
            self.transport.bpm = data["bpm"]
            self.transport.time_signature_num, self.transport.time_signature_den = data["time_signature"]
        added = []
        for item in data["tracks"]:
            track = self.add_track(item["name"], input="midi")
            self.timeline.add_midi_clip(item["name"], track_index=len(self.timeline.tracks) - 1, start=0.0, events=item["events"])
            added.append(track)
        return added

    # Persistence

    def to_dict(self):
        """Serialize the session to a JSON-safe dict (no binary payloads).

        Sampler audio and timeline clip audio are written separately by
        :meth:`save`; this dict references them by archive path.
        """
        return _session_to_dict(self)

    def save(self, path):
        """Write the session to a ``.nbplay`` zip archive.

        The archive holds ``session.json`` plus ``samples/`` (sampler PCM as
        little-endian float32) and ``clips/`` (timeline clip audio that has
        arrived from the browser; call ``session.timeline.export_all_clips()``
        first and wait for ``pending_exports`` to reach zero).

        Returns:
            The path written.
        """
        data, resources = _session_to_dict(self, resources={})
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("session.json", json.dumps(data, indent=1))
            for name, payload in resources.items():
                archive.writestr(name, payload)
        return path

    @classmethod
    def load(cls, path):
        """Rebuild a session from an archive written by :meth:`save`."""
        with zipfile.ZipFile(path) as archive:
            data = json.loads(archive.read("session.json"))
            resources = {name: archive.read(name) for name in archive.namelist() if name != "session.json"}
        return cls.from_dict(data, resources)

    @classmethod
    def from_dict(cls, data, resources=None):
        """Rebuild a session from :meth:`to_dict` output plus binary resources."""
        return _session_from_dict(cls, data, resources or {})

    def _remove_launcher_track(self, index):
        launcher = self.launcher
        if index < 0 or index >= len(launcher.tracks):
            return
        removed_channel = launcher.tracks[index]["channel_index"]
        tracks = []
        for i, track in enumerate(launcher.tracks):
            if i == index:
                continue
            item = dict(track)
            if removed_channel >= 0 and item["channel_index"] > removed_channel:
                item["channel_index"] -= 1
            tracks.append(item)
        slots = []
        for slot in launcher.slots:
            if slot["track_index"] == index:
                continue
            item = dict(slot)
            if item["track_index"] > index:
                item["track_index"] -= 1
            slots.append(item)
        launcher.tracks = tracks
        launcher.slots = slots
        launcher.active_slots = [v for i, v in enumerate(launcher.active_slots) if i != index]
        launcher.queued_slots = [v for i, v in enumerate(launcher.queued_slots) if i != index]
        if launcher.selected_slot.get("track_index") == index:
            launcher.selected_slot = {}

    def __repr__(self):
        return f"Session(bpm={self.transport.bpm}, tracks={len(self.tracks)}, channels={len(self.mixer.channels)})"
