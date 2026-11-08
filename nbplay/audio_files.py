"""Decode audio files into mono float samples for the samplers."""

import pathlib
import wave


def read_wav(path):
    """Mono float samples and the sample rate of a WAV file, through the stdlib."""
    with wave.open(str(path), "rb") as handle:
        channels = handle.getnchannels()
        sample_width = handle.getsampwidth()
        sample_rate = handle.getframerate()
        raw = handle.readframes(handle.getnframes())

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
            value = chunk[0] - 128 if sample_width == 1 else int.from_bytes(chunk, "little", signed=True)
            total += value / max_values[sample_width]
        samples.append(total / channels)
    return samples, sample_rate


def decode_audio_file(path):
    """Mono float samples and the sample rate of an audio file.

    WAV goes through the stdlib; other formats need the optional
    ``soundfile`` package.
    """
    path = pathlib.Path(path)
    if path.suffix.lower() == ".wav":
        return read_wav(path)
    try:
        import soundfile as sf  # ty: ignore
    except ImportError as exc:
        raise ValueError("MP3/OGG loading requires optional package 'soundfile'") from exc
    data, sample_rate = sf.read(path, dtype="float32", always_2d=True)
    return [float(sum(frame) / len(frame)) for frame in data], sample_rate
