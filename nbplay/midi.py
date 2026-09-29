"""MIDI file import and export.

Everything here works in beats (quarter notes), the unit the widgets use, and
converts to and from MIDI ticks at the file boundary. The file reader and
writer come from `mido`, an optional dependency: ``pip install nbplay[midi]``.
"""

from __future__ import annotations

import io
import os

TICKS_PER_BEAT = 480


def _mido():
    try:
        import mido
    except ImportError as exc:  # pragma: no cover - exercised only without the extra
        raise ImportError("MIDI file support needs the 'mido' package: pip install 'nbplay[midi]'") from exc
    return mido


def _normalize_events(events):
    from nbplay.widget import _normalize_midi_events

    return _normalize_midi_events(events)


def steps_to_events(voices_data, step_duration=0.25):
    """Turn sequencer voices (lists of step dicts) into MIDI events in beats.

    Inactive steps and steps with ``probability`` 0 are skipped. A step's
    ``duration_ticks`` counts steps, so a duration of 2 at eighth-note
    resolution is one beat.
    """
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
    return _normalize_events(events)


def events_to_voices(events, step_duration=0.25, length=None, max_voices=8):
    """Quantize MIDI events onto a step grid, one voice per overlapping note.

    Returns ``(voices_data, length)``. Notes are snapped to the nearest step;
    when two notes land on the same step they go to separate voices, up to
    ``max_voices``, and anything beyond that is dropped.
    """
    from nbplay.widget import _default_step, _default_steps

    step_duration = max(0.001, float(step_duration))
    normalized = _normalize_events(events)
    placed = []
    for event in normalized:
        index = round(event["beat"] / step_duration)
        ticks = max(1, round(event["duration"] / step_duration))
        placed.append((index, ticks, event))
    if length is None:
        length = max([index + 1 for index, _, _ in placed], default=1)
    length = max(1, int(length))
    voices = []
    for index, ticks, event in placed:
        if index >= length:
            continue
        for voice in voices:
            if not voice[index]["active"]:
                target = voice
                break
        else:
            if len(voices) >= max_voices:
                continue
            voices.append(_default_steps(length))
            target = voices[-1]
        target[index] = {
            **_default_step(),
            "note": event["note"],
            "velocity": event["velocity"],
            "duration_ticks": ticks,
            "active": True,
        }
    if not voices:
        voices.append(_default_steps(length))
    return voices, length


def build_midi(tracks, bpm=120.0, time_signature=(4, 4), ticks_per_beat=TICKS_PER_BEAT):
    """Build a ``mido.MidiFile`` from tracks of beat-based events.

    ``tracks`` is an iterable of dicts with ``name``, ``events`` (beat,
    duration, note, velocity), and an optional ``channel`` (0-15).
    """
    mido = _mido()
    midi = mido.MidiFile(ticks_per_beat=ticks_per_beat)
    meta = mido.MidiTrack()
    meta.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(float(bpm)), time=0))
    meta.append(
        mido.MetaMessage(
            "time_signature",
            numerator=int(time_signature[0]),
            denominator=int(time_signature[1]),
            time=0,
        )
    )
    meta.append(mido.MetaMessage("end_of_track", time=0))
    midi.tracks.append(meta)

    for track in tracks:
        channel = max(0, min(15, int(track.get("channel", 0))))
        messages = []
        for event in _normalize_events(track.get("events", [])):
            on = round(event["beat"] * ticks_per_beat)
            off = max(on + 1, round((event["beat"] + event["duration"]) * ticks_per_beat))
            messages.append((on, 1, mido.Message("note_on", note=event["note"], velocity=event["velocity"], channel=channel)))
            messages.append((off, 0, mido.Message("note_off", note=event["note"], velocity=0, channel=channel)))
        # Note-offs sort before note-ons at the same tick so retriggers work.
        messages.sort(key=lambda item: (item[0], item[1]))
        out = mido.MidiTrack()
        out.append(mido.MetaMessage("track_name", name=str(track.get("name", "nbplay")), time=0))
        last = 0
        for tick, _, message in messages:
            message.time = tick - last
            out.append(message)
            last = tick
        out.append(mido.MetaMessage("end_of_track", time=0))
        midi.tracks.append(out)
    return midi


def write_midi(tracks, path, **kwargs):
    """Write tracks of beat-based events to a ``.mid`` file and return the path."""
    midi = build_midi(tracks, **kwargs)
    midi.save(os.fspath(path))
    return path


def read_midi(source):
    """Read a MIDI file (path, bytes, or file object) into beat-based tracks.

    Returns ``{"bpm", "time_signature", "ticks_per_beat", "tracks"}`` where
    each track is ``{"name", "channel", "events"}``. Tracks without notes are
    left out. Beats are counted from the file's ticks, so tempo changes do not
    move notes; the first tempo and time signature are reported.
    """
    mido = _mido()
    if isinstance(source, (bytes, bytearray)):
        midi = mido.MidiFile(file=io.BytesIO(bytes(source)))
    elif hasattr(source, "read"):
        midi = mido.MidiFile(file=source)
    else:
        midi = mido.MidiFile(os.fspath(source))
    ticks_per_beat = max(1, int(midi.ticks_per_beat or TICKS_PER_BEAT))

    bpm = 120.0
    time_signature = (4, 4)
    seen_tempo = seen_signature = False
    tracks = []
    for index, track in enumerate(midi.tracks):
        tick = 0
        name = ""
        channel = None
        open_notes = {}
        events = []
        for message in track:
            tick += int(message.time)
            if message.is_meta:
                if message.type == "track_name" and not name:
                    name = message.name
                elif message.type == "set_tempo" and not seen_tempo:
                    bpm = round(float(mido.tempo2bpm(message.tempo)), 3)
                    seen_tempo = True
                elif message.type == "time_signature" and not seen_signature:
                    time_signature = (int(message.numerator), int(message.denominator))
                    seen_signature = True
                continue
            if message.type == "note_on" and message.velocity > 0:
                channel = message.channel if channel is None else channel
                open_notes[(message.channel, message.note)] = (tick, message.velocity)
            elif message.type in ("note_off", "note_on"):
                key = (message.channel, message.note)
                if key in open_notes:
                    start, velocity = open_notes.pop(key)
                    events.append(
                        {
                            "beat": start / ticks_per_beat,
                            "duration": max(1, tick - start) / ticks_per_beat,
                            "note": message.note,
                            "velocity": max(1, velocity),
                        }
                    )
        for (_, note), (start, velocity) in open_notes.items():
            events.append({"beat": start / ticks_per_beat, "duration": 1 / ticks_per_beat, "note": note, "velocity": velocity})
        if events:
            tracks.append(
                {
                    "name": name or f"Track {index + 1}",
                    "channel": 0 if channel is None else int(channel),
                    "events": _normalize_events(events),
                }
            )
    return {"bpm": bpm, "time_signature": time_signature, "ticks_per_beat": ticks_per_beat, "tracks": tracks}
