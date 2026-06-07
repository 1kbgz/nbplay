# nbplay

let's play!

[![Build Status](https://github.com/1kbgz/nbplay/actions/workflows/build.yaml/badge.svg?branch=main&event=push)](https://github.com/1kbgz/nbplay/actions/workflows/build.yaml)
[![codecov](https://codecov.io/gh/1kbgz/nbplay/branch/main/graph/badge.svg)](https://codecov.io/gh/1kbgz/nbplay)
[![License](https://img.shields.io/github/license/1kbgz/nbplay)](https://github.com/1kbgz/nbplay)
[![PyPI](https://img.shields.io/pypi/v/nbplay.svg)](https://pypi.python.org/pypi/nbplay)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/1kbgz/nbplay/main?urlpath=lab)

## Overview

> [!WARNING]
> This library is in early development and the API is subject to change without deprecation. Feedback and contributions are very welcome!

[![Music composition widgets in a jupyter notebook](https://raw.githubusercontent.com/1kbgz/nbplay/refs/heads/main/docs/img/sample.gif)](https://raw.githubusercontent.com/1kbgz/nbplay/refs/heads/main/docs/img/sample.gif)

nbplay provides composable Jupyter widgets for a browser-backed DAW: synths,
samplers, sequencers, keyboards, pads, transport, timeline recording, and
mixer/session routing.
Mixer channels and the master bus support Web Audio insert chains with built-in
gain, filter, compressor, limiter, delay, and reverb effects, plus custom browser
plugin factories. Custom effect descriptors must be JSON-safe; built-in effect
names are reserved. Widgets render non-crashing fallback states when Web Audio or
Web MIDI is unavailable.

```python
import nbplay as nb

session = nb.Session()
seq = nb.SequencerWidget(num_voices=2)
sampler = nb.SamplerWidget()
track = session.add_track("Drums", seq, sampler)

session.mixer.add_channel_effect(
    track.mixer_channel,
    nb.EffectPlugin("compressor", threshold=-18, ratio=4),
)
session.mixer.add_master_effect(nb.EffectPlugin("limiter", threshold=-1))

session.timeline.length = 64
session.timeline.count_in_bars = 1
session.timeline.auto_extend_recording = True
session.timeline.recording_extend_bars = 16
session.timeline.arm_track(track.mixer_channel, True, exclusive=True)
timeline_tracks = [dict(track) for track in session.timeline.tracks]
timeline_tracks[track.mixer_channel]["monitor"] = True
session.timeline.tracks = timeline_tracks
session.timeline.add_clip("Kick loop", track_index=track.mixer_channel, start=0, duration=4)
```

> [!NOTE]
> This library was generated using [copier](https://copier.readthedocs.io/en/stable/) from the [Base Python Project Template repository](https://github.com/python-project-templates/base).
