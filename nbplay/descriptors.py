"""Validated descriptors and normalizers shared by the widgets and their models.

The widgets in :mod:`nbplay.widget` and the pydantic models in
:mod:`nbplay.models` accept the same dict shapes for effects, mixer channels,
timeline tracks and clips, pad actions, sampler zones and slices, launcher
slots and keyboard routes. The descriptor classes (:class:`EffectPlugin`,
:class:`AudioClip`, :class:`TimelineTrack`, :class:`PadAction`,
:class:`KeyboardRoute`) are the notebook-facing way to build them, and the
``_normalize_*`` functions are what both layers run on assignment.
"""

from __future__ import annotations

import array
import json
import math
import uuid

from nbplay import (
    EventSequence,
    NoiseSource,
    NoteEvent,
    SawOscillator,
    SineOscillator,
    SquareOscillator,
    TriangleOscillator,
)

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


# Numeric parameters as (default, low, high); the browser's effect editor shows the same ranges.
_EFFECT_NUMBERS = {
    "eq": {
        "low": (0.0, -24.0, 24.0),
        "low_freq": (120.0, 20.0, 1000.0),
        "mid": (0.0, -24.0, 24.0),
        "mid_freq": (1000.0, 100.0, 10000.0),
        "mid_q": (1.0, 0.1, 10.0),
        "high": (0.0, -24.0, 24.0),
        "high_freq": (8000.0, 1000.0, 20000.0),
    },
    "distortion": {"drive": (0.4, 0.0, 1.0), "tone": (8000.0, 200.0, 20000.0), "wet": (1.0, 0.0, 1.0)},
    "chorus": {"rate": (1.5, 0.05, 10.0), "depth": (0.003, 0.0, 0.02), "delay": (0.02, 0.001, 0.05), "wet": (0.5, 0.0, 1.0)},
    "phaser": {
        "rate": (0.5, 0.05, 10.0),
        "depth": (0.7, 0.0, 1.0),
        "frequency": (800.0, 100.0, 5000.0),
        "feedback": (0.4, 0.0, 0.9),
        "wet": (0.5, 0.0, 1.0),
    },
    "tremolo": {"rate": (5.0, 0.1, 20.0), "depth": (0.5, 0.0, 1.0)},
}


class EffectPlugin:
    """Validated Web Audio effect descriptor for mixer insert chains."""

    _VALID_TYPES = frozenset({"gain", "filter", "eq", "delay", "reverb", "compressor", "limiter", "distortion", "chorus", "phaser", "tremolo"})
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
        if type in _EFFECT_NUMBERS:
            return {
                name: self._number(params, name, default=default, low=low, high=high) for name, (default, low, high) in _EFFECT_NUMBERS[type].items()
            }
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
    normalized["sends"] = [_clamped_number(level, 0.0, 1.0, "send") for level in normalized.get("sends", []) or []]
    return normalized


def _normalize_return_bus(bus, index=0):
    return {
        "name": str(bus.get("name", f"Return {index + 1}")),
        "gain": _clamped_number(bus.get("gain", 0.8), 0.0, 2.0, "gain"),
        "effects": _normalize_effects(bus.get("effects", [])),
    }


def _pad_sends(sends, count):
    sends = list(sends or [])[:count]
    return sends + [0.0] * (count - len(sends))


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


THEMES = ("", "light", "dark", "studio", "flat", "cube", "one", "grim", "pro", "fruit")


def render_waveform(oscillator_type, frequency, amplitude, sample_rate):
    """The waveform preview for an oscillator as little-endian float32 bytes.

    About three cycles of the periodic oscillators, capped at
    ``_PREVIEW_MAX_FRAMES``; 1024 frames of noise.
    """
    if oscillator_type == "square":
        osc = SquareOscillator(frequency, amplitude, sample_rate)
    elif oscillator_type == "saw":
        osc = SawOscillator(frequency, amplitude, sample_rate)
    elif oscillator_type == "triangle":
        osc = TriangleOscillator(frequency, amplitude, sample_rate)
    elif oscillator_type == "noise":
        osc = NoiseSource(amplitude)
    else:
        osc = SineOscillator(frequency, amplitude, sample_rate)
    if oscillator_type == "noise":
        frames = 1024
    else:
        frames_per_cycle = sample_rate / max(frequency, 1.0)
        frames = max(256, min(_PREVIEW_MAX_FRAMES, int(frames_per_cycle * 3)))
    return array.array("f", osc.render_to_buffer(frames)).tobytes()


_LAUNCH_QUANTIZE = ("bar", "beat", "none")


def _slot_voices(pattern):
    """Coerce a pattern into ``voices_data`` (list of voices, each a list of step dicts)."""
    config = getattr(pattern, "config", pattern)
    if hasattr(config, "voices_data"):  # SequencerWidget or its config
        return [list(steps) for steps in config.voices_data]
    if isinstance(pattern, (list, tuple)):
        if not pattern:
            raise ValueError("pattern must not be empty")
        if all(isinstance(voice, (list, tuple)) for voice in pattern):
            return [list(voice) for voice in pattern]
        if all(isinstance(step, dict) for step in pattern):
            return [list(pattern)]
    raise ValueError("pattern must be a SequencerWidget, list of step dicts, or list of voices")


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


def _default_pad_notes(rows=4, cols=4):
    """Default pad notes starting at MIDI 36 (C2), ascending chromatically."""
    start = 36
    return [start + i for i in range(rows * cols)]


def _positive_pad_dimension(value):
    """Clamp pad grid dimensions to at least one row/column."""
    return max(1, int(value))


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


# The .nbplay archive: session.json plus samples/ and clips/ resources.
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
