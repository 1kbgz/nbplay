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

**Try it in your browser:** the [live demo](https://1kbgz.github.io/nbplay/lite/lab/index.html?path=13_daw_playground.ipynb)
runs the example notebooks on JupyterLite with nbplay compiled to WebAssembly.
Nothing to install; open a notebook and run it top to bottom.

nbplay is a set of Jupyter widgets that together form a small DAW in the
browser: synths, samplers, step sequencers, a QWERTY and a MIDI keyboard,
trigger pads, a transport, a multitrack timeline that records audio and MIDI,
a clip launcher, and a mixer. Every widget in a session follows one clock that
lives in the browser, so play, seek, and tempo changes never wait on the
kernel. The widgets are plain [anywidget](https://anywidget.dev) classes with
no extension to install; they work in JupyterLab, Notebook, VS Code, Voila, and
JupyterLite. A session can be saved to a `.nbplay` archive and loaded back:

```python
session.timeline.export_all_clips()   # pull recorded takes from the browser
# ... once session.timeline.pending_exports == 0
session.save("song.nbplay")
session = nb.Session.load("song.nbplay")
```

Mixer channels and the master bus have Web Audio insert chains with built-in
gain, filter, compressor, limiter, delay, and reverb effects; you can register
your own browser plugin factories as well. Effect descriptors must be JSON-safe,
and the built-in effect names are reserved. When Web Audio or Web MIDI is
unavailable the widgets still render and their controls keep working; they are
silent until the browser provides those APIs.

```python
import nbplay as nb

session = nb.Session(bpm=120)
drums = session.add_track("Drums", nb.SequencerWidget(num_voices=2), nb.SamplerWidget())
vocals = session.add_track("Vocals", armed=True)      # microphone lane
keys = session.add_track("Keys", input="midi", armed=True)  # records note events

session.mixer.add_channel_effect(
    drums.mixer_channel,
    nb.EffectPlugin("compressor", threshold=-18, ratio=4),
)
session.mixer.add_master_effect(nb.EffectPlugin("limiter", threshold=-1))

session.timeline.length = 64
session.timeline.count_in_bars = 1
session.launcher.add_scene("Intro")
session.launcher.set_slot(drums.mixer_channel, 0, drums.sequencer, name="Beat")

session.play()   # or press play on any widget; they share the clock
```

Song structure comes from named patterns: `session.add_pattern("verse", drums.sequencer)`, then `session.chain(drums, ["verse", "verse", "chorus"])` lays them out as clips on the track's timeline lane, and the sequencer stops looping on its own so the arrangement drives it.

Samplers hold one main sample plus `zones`, each mapping a key and velocity range to its own audio: `sampler.add_zone_file("kick.wav", 36, 36)`, or press Rec in the sampler to record the microphone straight onto a pad, or `sampler.capture_clip(session.timeline, clip_id, pad=0)` to move a recorded take onto one.

`MidiOutputWidget` sends what the session plays to a hardware synth or another app over Web MIDI, and `MidiLearn` maps hardware knobs to widget traits (`MidiLearn(midi_keyboard).learn(synth, "frequency", low=100, high=2000)`, then turn a knob). The session can lead external gear with MIDI clock (`send_clock` on the output widget) or follow a device's clock (`sync_clock` on the MIDI keyboard). Patterns and MIDI clips move in and out of `.mid` files (`pip install "nbplay[midi]"`): `sequencer.to_midi("lead.mid")`, `sequencer.load_midi(path)`,
`session.export_midi("song.mid")`, and `session.import_midi(path)`.

Every change to a session widget is undoable: `session.undo()` and `session.redo()`, or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z with the transport focused. Adding and removing tracks is the exception.

The example notebooks in `examples/` walk through each widget and end with a
full DAW playground and the beats view.

> [!NOTE]
> This library was generated using [copier](https://copier.readthedocs.io/en/stable/) from the [Base Python Project Template repository](https://github.com/python-project-templates/base).
