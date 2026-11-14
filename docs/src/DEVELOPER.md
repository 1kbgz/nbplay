# nbplay Developer Guide

This guide is the map of nbplay for contributors. It explains how the Python
package, Rust core, PyO3 extension, WebAssembly bindings, TypeScript widgets,
browser audio/MIDI runtime, tests, docs, and distribution pipeline fit together,
in enough detail to add a feature to any component without reading the whole
repository first.

nbplay is a notebook-native digital audio workstation. Users instantiate Python
widgets in a Jupyter kernel; each hosts a pydantic config model, and where the
browser owns state a status model, on a [transports](https://github.com/1kbgz/transports)
session that [spaday](https://github.com/1kbgz/spaday) renders as a custom
element in the output area; the browser uses Web Audio and Web MIDI for
low-latency interaction; Rust provides reusable DSP/data types and compiles both
to a native Python extension and to browser WebAssembly.

## Mental model

The runtime has three cooperating layers:

```text
Jupyter notebook / Lab / VS Code / Colab
  Python kernel
    nbplay/widget.py spaday widgets hosting nbplay/models.py on transports sessions
    nbplay.nbplay native extension from Rust/PyO3
      | transports patches and commands over the widget comm
  Browser output area
    js/src/ts/components/*.ts elements, bound by the spaday tree
    Web Audio API and Web MIDI API
    optional wasm-bindgen bindings from js/src/rust
      | shared Rust source compiled for native and wasm targets
  Rust core
    rust/src audio, MIDI, oscillators, mixer, sampler, sequencer
    native-only cpal audio output and midir MIDI input
```

The important design choice is that configuration lives in kernel-owned,
validated models, browser-derived state (play position, held notes, ports)
lives in browser-owned status models, and real-time interaction lives in the
browser. Rust supports both sides: the Python
package uses PyO3 wrappers for ergonomic Python classes, and the JavaScript
package builds WebAssembly bindings for browser-facing Rust helpers.

## Repository map

| Path                                              | Responsibility                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `nbplay/widget.py`                                | The spaday widgets, session orchestration, and notebook-facing helper APIs.                                |
| `nbplay/models.py`                                | Pydantic config and status models behind every widget, validated on assignment.                            |
| `nbplay/descriptors.py`                           | Descriptor classes and `_normalize_*` helpers the models and widgets share.                                |
| `nbplay/__init__.py`                              | Public Python exports for Rust/PyO3 types and widget classes.                                              |
| `rust/src/`                                       | Shared Rust core library: audio buffers, MIDI, oscillators, mixer, sampler, sequencer, native I/O.         |
| `rust/python/`                                    | PyO3 wrapper classes exposed as the `nbplay.nbplay` native extension.                                      |
| `js/src/ts/`                                      | Browser frontends: `components/` (Lit elements), shared engines, and the spaday package entry.             |
| `js/src/css/`                                     | `components/` (tokens plus one stylesheet per element), theme sets, bundled by lightningcss into one file. |
| `js/src/rust/`                                    | wasm-bindgen browser bindings around selected Rust functionality.                                          |
| `js/tests/`                                       | Playwright browser tests: elements on a mock model and a mock Web Audio context, and spaday end to end.    |
| `nbplay/tests/`                                   | Rust-extension and descriptor tests, the widget and session suite, and the example-notebook runner.        |
| `examples/`                                       | Executable tutorial notebooks used by users and docs builds.                                               |
| `.github/workflows/`                              | CI for build/test/dist and docs publishing.                                                                |
| `pyproject.toml`, `Cargo.toml`, `js/package.json` | Python, Rust, and JavaScript package/build configuration.                                                  |

Generated assets are copied into `nbplay/static/` by the JavaScript build. The
folder is ignored in Git but included in built wheels through Hatch artifact
configuration.

## Runtime data flow

### Python to browser

Each widget in `nbplay/widget.py` extends `InstrumentWidget`, a
`spaday.Widget` that hosts two pydantic models from `nbplay/models.py` in its
own `transports.Session`: a config model the kernel owns (`TransportConfig`,
`SynthConfig`, ...) and, for instruments with browser-derived state, a status
model hosted with `owner="client"` (`TransportStatus`, ...). The spaday tree is
the instrument element with every config field bound two-way to a property on
`nbplay-set` and every status field bound two-way on `nbplay-status`, so a
kernel assignment reaches the element as a property write and an element event
comes back as a patch:

```python
synth.config.frequency = 220.0          # validated, pushed to the browser
session.transport.status.is_playing     # read-only mirror of the browser clock
session.transport.play()                # a command delivered to the owning element
synth.on_change(listener, names="frequency")  # changes from Python or the browser
```

Config models extend `_Validated`, whose `__setattr__` validates a copy of the
model through `model_validate` and assigns every field that changed, so a
browser edit and a Python assignment go through the same validation and derived
fields (the synth waveform, mixer send padding) are recomputed either way.
`config.update(**fields)` validates several fields at once. Status fields are
never assigned from Python: `play()`, `seek()`, `note_on()` and the like are
`session.command(status_id, field, value)` calls, which the `nbplay-wire` child
of the element turns into `element.command(...)` (see "TypeScript widget
architecture"). An element never emits status while it is being constructed,
so rendering a widget never writes back to the kernel.

### Rust to Python

The root Cargo package builds the PyO3 extension from `rust/python/lib.rs` as
the Python module `nbplay.nbplay`. Wrapper types are named `Py*` in Rust but are
exposed to Python without that prefix, for example `PyMixer` becomes `Mixer`.
`nbplay/__init__.py` re-exports those classes at the package top level.

The wrapper layer converts Rust validation errors into Python exceptions, adds
Python conveniences such as properties and `__repr__`, and exposes offline
rendering methods such as oscillator `render_to_buffer()` and mixer `mix_down()`.

### Rust to browser

The JavaScript Cargo package builds `js/src/rust/lib.rs` as a wasm-bindgen
crate. The TypeScript entry `js/src/ts/index.ts` re-exports the generated
bindings from `js/dist/pkg/nbplay`. Browser-facing Rust currently provides:

- `WasmAudioOutput`, a simple oscillator-to-Web-Audio looped-buffer helper.
- `WasmMidiAccess`, MIDI input port enumeration through Web MIDI.
- `request_midi_access()`, `list_midi_ports()`, `default_sample_rate()`, and
  `parse_midi_message()` convenience functions.

Most widget audio behavior is currently implemented directly in TypeScript using
Web Audio. The WASM layer exists for shared Rust functionality that should run in
the browser.

## Runtime libraries and toolchain

### Python runtime

- `spaday[widget]`: the notebook widget that renders a component tree bound to
  transports models; `anywidget` and `ipywidgets` come with it.
- `transports`: hosts the pydantic models, applies validated patches and
  delivers commands between the kernel and the browser.
- `pydantic`: the config and status models in `nbplay/models.py`.

### Rust runtime

- `serde`: serialization derives for several core value types.
- `pyo3`: native Python extension bindings, configured with `abi3`.
- `cpal`: native audio output for non-wasm targets.
- `midir`: native MIDI input for non-wasm targets.
- `wasm-bindgen`, `wasm-bindgen-futures`, `js-sys`, `web-sys`: browser
  bindings for WASM output.

### JavaScript and frontend build

- TypeScript with strict checking and ES modules.
- Lit 3 for the light-DOM elements under `js/src/ts/components/`.
- esbuild for widget and package bundling.
- lightningcss for CSS bundling and modern CSS processing.
- cpy for copying built assets into Python package folders.
- Playwright for browser tests.
- http-server for the local browser test server.
- nodemon for watch-mode rebuilds.
- oxlint and oxfmt for JS/TS/CSS linting and formatting.

### Python build, QA, and release

- hatchling, hatch-js, and hatch-rs build Python wheels that include JS assets
  and the Rust extension.
- uv is the preferred local installer.
- pytest and pytest-cov run Python and extension tests.
- ruff formats and lints Python.
- ty checks Python types.
- cibuildwheel builds platform wheels.
- twine and check-dist validate distributions.
- bump-my-version keeps versions synchronized across package manifests.
- mdformat and codespell check top-level docs.
- yardang builds published documentation.

## Python widget layer

All Python widget classes live in `nbplay/widget.py` and their models in
`nbplay/models.py`. A widget class names its element tag, its models and the
field-to-property maps (`CONFIG`, `STATUS`, and `STATUS_EVENTS` for a status
field written back on an event other than `nbplay-status`); `InstrumentWidget`
hosts the models, builds the tree and the wires. The elements and the shared
stylesheet ship as the spaday component package `nbplay`
(`nbplay/components.py`, assets under `nbplay/static/spaday/`), so the
JavaScript build must run before a source checkout can render widgets.

### Shared Python helpers

These live in `nbplay/descriptors.py`, which does not import pydantic, so
`nbplay/models.py` and `nbplay/widget.py` share them.

- `_default_step()` and `_default_steps(length)` build the sequencer's default
  inactive step dictionaries.
- `_measure_beats(time_signature_num, time_signature_den)` converts a time
  signature into quarter-note beats per measure.
- `_step_duration_for_length(length, measures, time_signature_num, time_signature_den)` infers the musical step duration for an explicit step
  count.
- `_resize_pad_notes(notes, pad_count)` clamps MIDI pad notes to 0-127 and
  preserves or extends the list when sampler pad count changes.
- `AudioClip`, `TimelineTrack`, and their normalizers define the synced
  metadata shape for timeline lanes and browser-recorded clips.
- `PadAction` and `_normalize_pad_actions()` define the shared pad action shape
  used by sampler pads and PadWidget. Note actions are live today; field/event
  actions provide a stable controller-pad path for future automation and MIDI
  learn work.

### Widget config and status fields

| Python class         | Config fields (kernel-owned)                                                                                                                                                                                                                                           | Status fields (browser-owned)                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SynthWidget`        | `oscillator_type`, `frequency`, `amplitude`, `sample_rate`, `waveform`, `session_id`, `channel_index`, `theme`                                                                                                                                                         | `is_playing`                                                                                                                                                                |
| `SettingsWidget`     | `sample_rate`, `channels`, `buffer_size`, `audio_device`, `midi_port`, `theme`                                                                                                                                                                                         | `available_midi_ports`, `midi_event`                                                                                                                                        |
| `MixerWidget`        | `channels`, `returns`, `master_gain`, `master_effects`, `session_id`, `theme`                                                                                                                                                                                          | none                                                                                                                                                                        |
| `SequencerWidget`    | `voices_data`, `num_voices`, `length`, `measures`, `step_duration`, `time_signature_num`, `time_signature_den`, `bpm`, `loop_enabled`, `keyboard_connected`, `follow_transport`, `swing`, `groove`, `automation_lanes`, `session_id`, `channel_index`, `theme`         | `is_playing`, `current_step`                                                                                                                                                |
| `SamplerWidget`      | `sample_name`, `sample_rate`, `sample_length`, `root_note`, `waveform`, `sample_data`, ADSR fields, `max_voices`, `pad_count`, `pad_notes`, `pad_velocities`, `pad_actions`, `sample_slices`, `velocity`, `velocity_sensitive`, `zones`, `session_id`, `channel_index` | `active_pads`, `last_note_event`, `last_pad_event`, `request` (capture commands)                                                                                            |
| `TransportWidget`    | `bpm`, `time_signature_num`, `time_signature_den`, `loop_enabled`, `loop_start_bar`, `loop_end_bar`, `session_id`, `theme`                                                                                                                                             | `is_playing`, `is_recording`, `current_beat`, `bar_number`, `beat_in_bar`, `undo_request`, `redo_request`                                                                   |
| `TimelineWidget`     | `tracks`, `clips`, `length`, `selected_clip_id`, `bpm`, time signature, `count_in_bars`, `auto_extend_recording`, `recording_extend_bars`, `pixels_per_beat`, `current_beat`, `export_clip_id`, `import_clip_request`, `import_clip_data`, `session_id`, `theme`       | `is_playing`, `is_recording`, `recording_track`, `recording_tracks`, `recording_countdown_beats`, `recording_error`, `recorded_clip`, `exported_clip`, `exported_clip_data` |
| `LauncherWidget`     | `tracks`, `scenes`, `slots`, `quantize`, `bpm`, time signature, `selected_slot`, `session_id`, `theme`                                                                                                                                                                 | `is_playing`, `active_slots`, `queued_slots`, `request` (launch commands)                                                                                                   |
| `KeyboardWidget`     | `upper_octave`, `lower_octave`, `velocity`, sustain fields, `sampler_routing`, `session_id`, `channel_index`, `theme`                                                                                                                                                  | `active_notes`, `last_note_event`                                                                                                                                           |
| `MidiKeyboardWidget` | `midi_port`, `sync_clock`, `sampler_routing`, `session_id`, `channel_index`, `theme`                                                                                                                                                                                   | `available_midi_ports`, `active_notes`, `last_note_event`, `control_change`, `clock_bpm`                                                                                    |
| `MidiOutputWidget`   | `midi_port`, `channel`, `forward_notes`, `send_clock`, `session_id`, `theme`                                                                                                                                                                                           | `available_midi_ports`, `request` (send commands)                                                                                                                           |
| `PadWidget`          | `rows`, `cols`, `velocity`, `velocity_sensitive`, `pad_notes`, `pad_velocities`, `pad_actions`, `sampler_routing`, `session_id`, `channel_index`, `theme`                                                                                                              | `active_pads`, `last_note_event`, `last_pad_event`                                                                                                                          |

### Non-rendered Python orchestration types

`Track` is a session lane: a mixer channel plus an optional sequencer and sound
source. The browser clock keeps every widget in a session in step, so a track
carries no kernel-side links.

`Session` creates a shared `session_id`, a `TransportWidget`, a `MixerWidget`,
a `TimelineWidget`, and a `LauncherWidget`. `Session.add_track()` creates a
mixer channel, adds a timeline lane and a launcher row, and writes
`session_id`, `channel_index`, tempo, time signature and theme into the
sequencer and sound source. Browser widgets use those fields to route audio
through the shared mixer bus. `Session` also mirrors mute and solo between
timeline lanes and their mixer channels (by `channel_index`) in both
directions, so a lane's M/S buttons silence the channel's instruments as well
as its clips. `Session.save()` and `Session.load()` persist the whole thing; see
"Session persistence".

## Rust core

The reusable Rust library is in `rust/src/`. It is compiled as an `rlib` and is
used by both the PyO3 extension and the WASM crate. Native-only device modules
are gated out for wasm builds.

| Module            | Key types and behavior                                                                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio.rs`        | `SampleRate`, `ChannelCount`, `AudioFormat`, and interleaved `AudioBuffer`. Buffers support silence allocation, frame count, checked sample get/set, add-mixing, and clearing.                                                                        |
| `midi.rs`         | `MidiChannel`, `Note`, `Velocity`, `ControlNumber`, `MidiMessage`, `MidiEvent`, `note_to_hz()`, `hz_to_note()`, and `parse_midi_bytes()`. Channel range is 0-15; notes, velocity, and controls are 0-127. Note-on with velocity 0 parses as note-off. |
| `oscillator.rs`   | `AudioSource` trait and sine, triangle, square, saw, and deterministic-noise sources. Oscillators render into an `AudioBuffer` and wrap phase into \[0, 1) to avoid drift.                                                                            |
| `mixer.rs`        | `MixerChannel` and `Mixer`. Channels apply gain, mute, solo, and constant-power pan. `Mixer::mix_down()` combines mono channel buffers into interleaved stereo output.                                                                                |
| `sampler.rs`      | `AudioSample`, `Envelope`, polyphonic `Sampler`, `SampleMapping`, and `SampleMap`. The sampler handles pitch ratio, sample-rate ratio, linear interpolation, ADSR, looping, soft clipping, voice stealing, note-off release, and panic/all-notes-off. |
| `sequencer.rs`    | `Step`, `Pattern`, `NoteEvent`, `EventSequence`, `TransportClock`, `TransportState`, and `StepSequencer`. These model fixed step patterns, piano-roll events, beat clocks, and MIDI event generation over beat ranges.                                |
| `audio_output.rs` | Native `AudioOutput` via cpal. Builds a fixed-buffer output stream and fills it through a render callback. Not compiled for wasm.                                                                                                                     |
| `midi_input.rs`   | Native `MidiInput` via midir. Lists ports and connects callbacks that receive parsed `MidiEvent` values. Not compiled for wasm.                                                                                                                       |

### Rust invariants

- `AudioBuffer` stores interleaved `f32` samples. Frame count is sample count
  divided by channel count.
- MIDI wrappers validate ranges at construction time. Python wrappers surface
  invalid values as `ValueError`.
- Mixer `gain` is clamped by Python setters and UI controls to 0.0-2.0. Pan is
  clamped to -1.0 through 1.0.
- `Envelope::new()` clamps attack, decay, and release to non-negative values and
  sustain to 0.0-1.0.
- `StepSequencer::process_beat_range(start, end)` returns timestamped note-on
  and note-off MIDI events for active steps whose beat positions fall in the
  range.
- Native device tests tolerate missing audio/MIDI hardware because CI may be
  headless.

## PyO3 binding layer

PyO3 wrappers live in `rust/python/`. The module registration is centralized in
`rust/python/lib.rs`. Wrapper conventions:

- Internal structs use a `Py` prefix and `#[pyclass(name = "PythonName")]`.
- Each wrapper owns or clones an inner Rust type.
- Constructors convert invalid Rust values into `PyValueError`, `PyIndexError`,
  or `PyRuntimeError` as appropriate.
- Python properties use `#[getter]` and `#[setter]`.
- Debuggability comes from `__repr__`, `__str__`, `__eq__`, and `__len__` where
  useful.
- Device wrappers that hold non-Send platform handles are marked `unsendable`.

The PyO3 classes exposed through `nbplay/__init__.py` are:

- Audio: `AudioFormat`, `AudioBuffer`, `AudioOutput`.
- MIDI: `MidiChannel`, `Note`, `Velocity`, `MidiMessage`, `MidiEvent`,
  `MidiInput`.
- Oscillators: `SineOscillator`, `TriangleOscillator`, `SquareOscillator`,
  `SawOscillator`, `NoiseSource`.
- Mixer: `MixerChannel`, `Mixer`.
- Sequencer: `Step`, `Pattern`, `NoteEvent`, `EventSequence`,
  `TransportClock`, `StepSequencer`.
- Sampler: `AudioSample`, `Envelope`, `SampleMapping`, `SampleMap`, `Sampler`.

## WASM binding layer

The WASM crate is configured by `js/Cargo.toml`. It depends on the shared Rust
core and pins `wasm-bindgen = 0.2.121`, which must match the installed
`wasm-bindgen-cli` used by `pnpm build:wasm-bindgen`.

`js/src/rust/web_audio.rs` exposes `WasmAudioOutput`. It creates a browser
`AudioContext`, renders a looped buffer for a selected oscillator type, connects
through a `GainNode`, and exposes `start()`, `stop()`, `is_playing()`,
`set_gain()`, and `sample_rate()`.

`js/src/rust/web_midi.rs` exposes `WasmMidiAccess` and `parse_midi_message()`.
It calls `navigator.requestMIDIAccess()`, lists MIDI input names, and converts
parsed Rust `MidiMessage` values into plain JavaScript objects.

The generated WASM package is emitted into `js/dist/pkg/`. TypeScript imports it
from `js/src/ts/index.ts` and re-exports the important bindings for consumers.

## TypeScript widget architecture

The browser side has two layers. Elements under `js/src/ts/components/` are Lit
3 classes rendered into the light DOM (no shadow root), registered through
`define(tag, cls)`, which skips a tag that another widget bundle already
defined. They never touch the anywidget model: inputs are properties (scalars
also reflect kebab-case attributes), and outputs are events. Primitives such as
`nbplay-slider`, `nbplay-dial`, `nbplay-fader` and `nbplay-meter` emit `input`
and `change` with `detail.value`; composites such as `nbplay-step-grid`,
`nbplay-strip`, `nbplay-lane` and `nbplay-launcher-grid` emit `change` with
structured detail and named intents (`nbplay-seek`, `nbplay-launch`, ...); and
each widget is one instrument element (`nbplay-transport`, `nbplay-mixer`,
`nbplay-timeline`, ...) that owns its audio engine, session bus binding, Web
MIDI or recording, and emits `nbplay-set` (`{values}`, configuration the user
edited), `nbplay-status` (`{values, save}`, browser-derived state such as play
position) and `nbplay-request` (`{name}`, a nonce request such as undo). Kernel
commands arrive through `element.command(cmd)`.

Each Python widget renders its element through a spaday tree built in
`nbplay/widget.py`: config fields bind two-way on `nbplay-set`, status fields
two-way on `nbplay-status` (or the event a widget names in `STATUS_EVENTS`),
and the `nbplay-wire` child defined in `js/src/ts/spaday.ts` delivers kernel
commands to `element.command()`; see "Transports widgets" below. An element
never emits status during construction or its first property assignment, so
rendering a widget never writes back to the kernel. Non-visual engines the elements share
live beside them: `voices.ts` (fallback sine voices), `midi_access.ts` (Web
MIDI ports), `mixer_bus.ts` (audio graph, effects, meters) and
`sampler_engine.ts` (sample playback).

The component gallery, `js/dist/gallery.html` after a build, renders every
element with a property panel, an event log and a theme switch.

The shared helpers are in `js/src/ts/helpers.ts` (`AnyModel` there is the
model-shaped shim the scheduler and session clock read through):

- `cssVar()` reads Jupyter CSS custom properties for canvas drawing.
- `makeEditable()` implements double-click inline editing with an Enter/blur
  commit guard.
- `toFloat32()` converts binary buffers into `Float32Array`.
- `bindShortcuts()` binds keyboard shortcuts to a widget root (see
  "Keyboard shortcuts" below).
- Gain/pan helpers convert and format linear gain, dB, and pan values.

### Browser APIs used

nbplay calls the browser APIs directly; there is no audio framework in
between:

- Web Audio API: `AudioContext`, `OscillatorNode`, `AudioBuffer`,
  `AudioBufferSourceNode`, `GainNode`, `StereoPannerNode`, `AudioParam`,
  `currentTime`, scheduled starts/stops, ramps, and context `resume()`/`close()`.
- Web MIDI API: `navigator.requestMIDIAccess({ sysex: false })`, `MIDIAccess`,
  `MIDIInput`, `midimessage`, port IDs, port names, and hot refresh.
- Canvas 2D: high-DPI waveform and envelope drawing using `devicePixelRatio`.
- DOM events: `click`, `input`, `change`, `dblclick`, `pointerdown`,
  `pointerup`, `pointercancel`, `wheel`, `keydown`, `keyup`, `blur`, and custom
  events.
- CustomEvent: `nbplay-note`, `nbplay-bus-ready`, and `nbplay-cancel-edit`.
- Timers: `setInterval()` for sequencer lookahead scheduling, transport clock
  ticks, velocity key repeat, and sampler active-voice display.
- `AudioContext.currentTime` as the single transport timebase (the
  `SessionClock` in `js/src/ts/session.ts`); `performance.now()` only for save
  throttling, count-in timers, and MIDI fallback timestamps.
- `globalThis.__nbplay` as a notebook-page-local session bus registry, created
  lazily by `getOrCreateSessionBus()` in `js/src/ts/session.ts`.
- CSS custom properties from JupyterLab, especially `--jp-*` theme variables.

### Instruments on the bus

`bus.instruments[channel]` is a `{ scheduleNote(note, velocity, at, duration) }` that samplers and synths register for their track. The shared scheduler (sequencers and launcher slots) and the timeline's MIDI clips call it when present and fall back to the built-in sine oscillator otherwise; both keep the cancel functions it returns: a stop silences every note still scheduled or sounding, and a seek or tempo change cancels the not-yet-started notes of the old position before realigning. Each widget remembers what it registered, removes its own entries when its channel or session changes or it is disposed, and never deletes another view's entry; the synth also silences its own voices on disposal. The sampler binds its engine to the bus context and channel before registering, so scheduled times refer to the session's clock and audio goes through the mixer.

### Session bus shape

Every widget with a `session_id` shares one bus object, fetched with
`getOrCreateSessionBus()` from `js/src/ts/session.ts`; whichever widget renders
first creates it:

```ts
globalThis.__nbplay[sessionId] = {
  clock,                     // SessionClock: the shared transport timebase
  audioCtx,
  masterGain,
  channels: [{ gain, pan }, ...],
  plugins: { [effectType]: (ctx, effect) => AudioNode | EffectUnit },
  samplers: { [channelIndex]: { triggerNote, releaseNote } },
  noteListeners: [(evt) => void],
  claims: { [channelIndex]: { launcher?: true, timeline?: true } }
};
```

Widgets attach their own properties to the bus in place. The mixer owns
`audioCtx`, `masterGain`, `channels`, and a merged view of the browser insert
effect plugin factories; it adopts an `audioCtx` that another widget created
first. Samplers add `samplers[channelIndex]` so keyboards, pads, and MIDI clips
can trigger them. Keyboard widgets also broadcast `nbplay-note` on `document`,
which lets sequencers and MIDI lanes record notes without a mixer bus. Timeline
clip playback reads `audioCtx` and `channels` from the bus so recorded clips go
through the same channel strip and insert effects as live sources.

A launcher slot, the timeline's MIDI clips and the track's sequencer can all
play one channel, so `claims` decides which one sounds. The launcher claims a
track's channel while a slot on it is launched; the timeline claims the channel
of every track that holds MIDI clips with notes. `channelOwner()` returns
`launcher` over `timeline`, and the scheduler stays silent on a channel owned by
anything but its own claim, so a launched slot plays in place of the track's
clips and either one silences the looping sequencer. The silent grid keeps
running, and the claims stack, so stopping the slot hands the track back in
phase.

Render order can vary in notebooks. SamplerWidget handles this by listening for
`nbplay-bus-ready` and registering again when the mixer attaches its graph.

## Widget deep dives

### SynthWidget

Python class: `SynthWidget`. Element:
`js/src/ts/components/synth.ts`.

SynthWidget exposes oscillator type, frequency, amplitude, sample rate, play
state, and a binary waveform preview. Python renders the preview through the
Rust oscillator classes and stores little-endian float32 bytes in the `waveform`
field. Browser code converts those bytes with `toFloat32()` and draws a high-DPI
canvas waveform.

Browser playback is independent from the Rust preview. The TypeScript engine
creates an `AudioContext`, connects either an `OscillatorNode` or a looped noise
`AudioBufferSourceNode` into a `GainNode`, and updates frequency/amplitude with
smoothed `AudioParam.setTargetAtTime()` calls. The frequency slider uses a log
mapping from 20 Hz to 8000 Hz. Frequency and amplitude values are editable by
double-clicking their readouts.

When extending SynthWidget, update both the Python oscillator/preview path and
the TypeScript playback path if the feature should affect both the picture and
the sound. Add tests in Python for preview/backend behavior and Playwright tests
for DOM and model sync.

With a `session_id` and `channel_index` (set by `Session.add_track()`), the
synth also registers under `bus.instruments` so sequencers, launcher slots, and
MIDI clips on its track play notes with its oscillator type and amplitude
(noise plays a short burst) through the track's mixer channel, instead of the
scheduler's sine fallback. It registers at render, when the routing fields
change, and on `nbplay-bus-ready` when the mixer renders later.

### SettingsWidget

Python class: `SettingsWidget`. Element:
`js/src/ts/components/settings.ts`.

SettingsWidget is a browser configuration panel for sample rate, channel count,
buffer size, audio device label, MIDI port, available MIDI ports, and raw MIDI
events. The audio controls are plain synced selects. The MIDI section requests
Web MIDI access, enumerates input ports, connects to a selected port by ID, and
stores the selected port name in `midi_port`.

Incoming MIDI messages are formatted for a small activity log and packed into
`midi_event` as eight little-endian timestamp bytes followed by raw MIDI data.
The browser uses `DataView` for that binary payload. SettingsWidget does not
currently control the output device for other widgets; it is the state and
monitoring surface for user configuration.

### MixerWidget

Python class: `MixerWidget`. Element:
`js/src/ts/components/mixer.ts`.

MixerWidget owns a list of channel dictionaries with `name`, `gain`, `pan`,
`mute`, `solo`, and optional browser `effects`, plus `master_gain` and
`master_effects`. Python provides convenience methods for adding/removing
channels, setting channel properties, and adding/replacing/clearing channel or
master insert chains. `to_mixer()` creates a Rust `Mixer` for offline mixdown;
browser insert effects are real-time Web Audio only.

Browser code builds one channel strip per channel and a master strip. Faders
show dB labels, pan shows center/left/right labels, and name/gain/pan are
inline editable. Gain input accepts dB strings and converts to linear gain.

Effect descriptors are plain dictionaries. Built-ins are `gain`, `filter`,
`compressor`, `limiter`, `delay`, and `reverb`. A descriptor with
`enabled: false` is bypassed: it stays in the list and in the strip (drawn
struck through) but is left out of the audio chain. Clicking a chip toggles
bypass, ✎ opens an inline parameter editor under it, and × removes the effect;
`set_channel_effect_enabled()` and `set_master_effect_enabled()` do the same
from Python, and `EffectPlugin(..., enabled=False)` builds a bypassed
descriptor. Unknown descriptor types are left intact when their params are
JSON-safe so notebook code can register custom browser plugins on
`globalThis.__nbplayPlugins[type]`. Built-in names are
reserved and win over user registry entries. The mixer exposes a merged plugin
map on the session bus without mutating `globalThis.__nbplayPlugins`. A plugin
factory receives `(audioCtx, descriptor)` and returns either an `AudioNode` or
an `{input, output, dispose?}` unit.

When `session_id` is set, the browser creates the shared `AudioContext`, one
`GainNode` plus `StereoPannerNode` per channel, channel insert chains, a master
`GainNode`, and a master insert chain connected to destination. Mute/solo
affects the channel gain nodes. The bus is registered on `globalThis.__nbplay`
and removed on cleanup.

Send/return buses live in `returns` (`name`, `gain`, `effects`), and every
channel carries one send level per return in `sends` (0-1). Python keeps the
two aligned: `add_return()` and the `returns` validator pad or trim every
channel's `sends`, `set_send()` writes one level, and `remove_return()` drops
the bus and its sends. In the browser each return is an input `GainNode`, an
insert chain, and a return fader feeding the master; each channel owns one
send `GainNode` per return that taps the end of its insert chain (post-fader,
post-insert, so mute and solo silence the sends too) and feeds the return's
input. Return strips sit between the channels and the master with their own
fader, effect chips and editor, meter, and remove button; channel strips show a
small slider per return. The bus exposes `returns` next to `channels` for other
widgets. `to_mixer()` ignores returns; the offline Rust mixer has no buses.

The parameter editor lists each built-in effect's parameters with the same
ranges the Python `EffectPlugin` enforces (a slider plus a number box for
bounded numbers, a select for the filter type) and, for custom plugin types,
every JSON field of the descriptor as a number, text, or checkbox input. Edits
write the descriptor back to `channels[i].effects` or `master_effects` on every
input event. Only a change in chain structure (effect type or bypass) rebuilds
the strip DOM; parameter changes refresh chip labels and open editors in place
so sliders keep focus, and open editors are restored after a rebuild.

Insert chains update in place. Each built-in effect unit exposes
`update(descriptor)`, which writes the new parameters to the existing
`AudioParam`s. A chain is rebuilt only when its structure changes (an effect
added, removed, or retyped), when a custom plugin has no `update`, or when a
unit declines the change (reverb returns false for a new impulse length or
decay), and only that chain is rebuilt.

For the meters, the bus creates an `AnalyserNode` per channel and for the
master, connected from the end of each insert chain. The widget reads peak and
RMS about 30 times per second with `requestAnimationFrame` and sets the height
of `.nbplay-strip-meter-fill` on a 60 dB scale, adds `hot` at clipping, and
writes a `data-peak` attribute on each strip.

### SequencerWidget

Python class: `SequencerWidget`. Element:
`js/src/ts/components/sequencer.ts`.

SequencerWidget models a pattern grid. `voices_data` is one list of step dicts
per voice, kept at `num_voices` by `length` by the config model. The grid can be configured by absolute length
or musically by `measures`, `step_duration`, and time signature. In 4/4, a
`step_duration` of 0.5 is eighth notes, 0.25 is sixteenth notes, and 0.125 is
thirty-second notes. `configure_grid()` on the Python side and the frontend grid
controls both resize the underlying `voices_data` while preserving existing
steps where possible.

Browser playback uses `js/src/ts/scheduler.ts` as a DOM-free lookahead
scheduler. A timer runs every 25 ms and schedules notes up to 100 ms ahead on
the session clock's beat grid, so every sequencer in a session lands on the
same grid. Each active step plays a simple sine oscillator through either the
session mixer channel or a standalone audio context.
`current_step` is updated locally for visual highlighting without saving every
tick.

The scheduler owns timing helpers for step advancement, voice iteration,
oscillator scheduling, duration ticks, swing/groove offsets, per-step
`probability`, and step-quantized `automation_lanes`. `swing` is a 0-100 percent
delay applied to odd steps. `groove` is a repeating list of -50 to 50 percent
step-duration offsets. Automation lanes are dictionaries of `{trait, points}`,
where each point has `{step, value}` and `trait` names a numeric property;
scheduled steps update the element property only, so a tick costs no comm traffic.

The UI includes play, stop, record, BPM, step duration, measure count, loop, a
header row, step rows, and velocity rows. Clicking a cell toggles active state.
Mouse wheel over a step changes note. Mouse wheel over a velocity cell changes
velocity. Double-clicking a cell opens a text field for a note name (`F#3`) or a
MIDI number; Enter or a click elsewhere writes the note and activates the step,
Escape cancels. If a keyboard is connected, double-clicking a cell instead waits
for the next `nbplay-note` event and writes that note into the cell. Recording
arms all voices
or individual voice dots and writes live note-on events into the current step
while playing.

Important extension points are the grid reconciliation helpers, scheduler helper
functions, and the CustomEvent note input path. If you change timing semantics,
update Python `_step_duration_for_length()`, frontend `configuredStepCount()`,
tests for explicit lengths, scheduler behavior tests, and session transport sync
tests.

### SamplerWidget

Python class: `SamplerWidget`. Element:
`js/src/ts/components/sampler.ts`.

SamplerWidget displays sample metadata, waveform bytes, ADSR controls, max
voices, pad count, and per-pad MIDI notes/velocities/actions. Raw mono PCM is
stored in `sample_data`; the decimated canvas preview is stored in `waveform`.
Python `load_sample()` populates both fields. `load_audio_file()` loads WAV via
stdlib `wave` and MP3/OGG/other formats through optional `soundfile`.

Browser code can load audio from a file input or by dropping audio onto the
waveform. It decodes with Web Audio, mixes to mono, writes `sample_data` and the
decimated `waveform`, and uses raw `sample_data` for playback. Each note creates
an `AudioBufferSourceNode`, sets `playbackRate = 2 ** ((note - root_note) / 12)`,
scales gain by velocity, and envelopes it through a `GainNode`. Full samples loop
for sustain; mapped slices use one-shot start/duration windows.

Python sample edits live on SamplerWidget: `trim_sample()`,
`normalize_sample()`, `reverse_sample()`, and `fade_sample()`. `slice_sample()`
creates equal `sample_slices` and maps them to sampler pads. `map_slices_to_pads()`
configures a PadWidget with matching notes/actions and connects sampler routing
when the sampler has a channel index.

Sampler pads and PadWidget both use `pad_actions`. `{"type": "note"}` actions
trigger notes and optional sample slices. `{"type": "trait"}` actions set a
property on the current element, and `{"type": "event"}` actions update
`last_pad_event`. This keeps pad input source-agnostic for future browser MIDI
controller discovery, MIDI learn, and automation control.

When the sampler has a session and channel index, it registers `triggerNote()`
and `releaseNote()` on the session bus so keyboard widgets, MIDI keyboard input,
and PadWidget routes can drive the same sampler/slice map by note, and
`scheduleNote(note, velocity, at, duration)` under `bus.instruments` so
sequencers, launcher slots, and MIDI clips play it at exact audio-clock times
with an automatic release; the returned function cancels a note that has not
sounded yet.

Multi-sample zones live in `zones`: each entry maps a note range and a velocity
range to its own float32 PCM (`data`), root note, and sample rate. When a note
plays, the first matching zone wins over the main sample and plays one-shot at
`2 ** ((note - zone.root_note) / 12)`; notes outside every zone fall back to the
main sample and its slices. Python adds zones with `add_zone()` (floats or
float32 bytes) and `add_zone_file()`, edits them with `set_zone()`, and builds a
Rust `SampleMap` with `to_sample_map()` (zones first, main sample as the
catch-all). The browser shows a key-range bar and a row per zone with editable
low, high, and root notes. Captured audio lands on the pad chosen in the zone
controls, as a zone whose range and root are that pad's note: a file through the
zone file input, a microphone take through the Rec button (`getUserMedia` plus
`MediaRecorder`, decoded with Web Audio), or a timeline clip through
`capture_clip(timeline, clip_id, pad=...)`, which hands the clip's browser URL
and trim to the sampler in a `capture_request`; the sampler fetches, decodes,
and writes the zone back to `zones`. Both widgets have to be rendered in the
same page for that. Session save stores zone PCM as `samples/track-N-zone-M.f32`.

### Transport commands versus status

The transport's play state and position are status: the browser clock writes
`is_playing`, `is_recording`, `current_beat`, `bar_number` and `beat_in_bar`
into the browser-owned status model, and the kernel only reads them, so a
delayed echo of old status can never restart or stop the clock. Kernel code
moves the clock through commands on those fields, `session.command(status_id, "is_playing", True)` behind `play()`, `stop()`, `seek()` and `record()`; the
`nbplay-wire` child maps each onto the element's `{"action": ...}` command and
acknowledges it, and every accepted command re-publishes the clock's real
status. A command issued before the transport has rendered waits in the
transports session until the element connects.

### TransportWidget

Python class: `TransportWidget`. Element:
`js/src/ts/components/transport.ts`.

TransportWidget is the global play/stop and tempo surface. Its config holds
BPM, time signature and loop range; its status mirrors play state and the
bar/beat position. `Session.play()`, `stop()`, and `seek(beat)` are transport
commands, and `session.bpm` and `session.time_signature` write every widget's
config. A beat is a quarter note, so a bar is `numerator * 4 / denominator`
beats long (`barBeats()` in `session.ts`): 3 in 6/8 and 3.5 in 7/8. The
transport's loop range and bar:beat readout, the launcher's bar quantize and the
timeline's ruler, count-in and length all use that length.

In the browser the transport owns the session clock: `bus.clock` on
`globalThis.__nbplay[session_id]`, a `SessionClock` derived from the shared
`AudioContext.currentTime`. Sequencers and the timeline with the same
`session_id` subscribe to that clock, so play, stop, seek, tempo, and record
propagate between widgets without a kernel round-trip. A transport with no
`session_id` uses a private clock.

The browser UI has stop/play/record buttons, a BPM slider and inline edit, a
time signature display, a bar:beat display, and a loop toggle/range. Every
control drives the clock; clock events are mirrored back into the model. A 50 ms
ticker updates `current_beat`, `bar_number`, and `beat_in_bar` locally while
playing and saves at most every 250 ms on beat changes. Loop wrapping between
`loop_start_bar` and `loop_end_bar` and mid-play tempo changes happen inside
the clock. Config writes and commands arriving from the kernel (`bpm`,
loop fields, play, seek) are forwarded to the clock, so Python can start,
stop, and seek the whole session.

### TimelineWidget

Python class: `TimelineWidget`. Element:
`js/src/ts/components/timeline.ts`.

TimelineWidget is the tracking view: multitrack clip lanes and the browser
recorder. Python owns validated `TimelineTrack` and `AudioClip` metadata
dictionaries. Browser code renders track rows, arm/input-monitor/mute/solo
controls and a record-source selector, clip blocks with drag-to-move and trim
handles, play/stop, record/stop, count-in, recording auto-extension, a loop
brace on the ruler, zoom with a shared horizontal scroll, playhead reset,
playhead seek/drag, timeline length, and clip duplicate/delete. The timeline
follows the session clock for position and play state, so its play/stop/seek
controls act on the whole session in the browser. In a `Session`, transport BPM,
time signature, and play/record state are also linked in Python, and
`current_beat` is dlinked one-way from transport to timeline; the transport is
the widget that persists the clock position.

Recording captures every armed lane at once (`recording_tracks`). A lane's
`input` picks the source: `"microphone"` lanes share one
`navigator.mediaDevices.getUserMedia({ audio: true })` stream; `"channel"` lanes
tap their mixer channel through a `MediaStreamAudioDestinationNode`, which
bounces an instrument track to audio; `"midi"` lanes listen for the
`nbplay-note` document events that the keyboard, MIDI keyboard, and pad
widgets broadcast and time each note against the session clock. One
`MediaRecorder` runs per audio lane, all started together after the count-in;
MIDI lanes need no recorder. Each completed audio take creates a browser-local
object URL and appends clip metadata to `clips`. Playback uses an
`HTMLAudioElement` and connects it through
`globalThis.__nbplay[sessionId].channels[channel_index].gain` when the mixer bus
is available, falling back to direct media playback when it is not. A clip's
`offset` (beats into the source audio) is applied when its start edge has been
trimmed.

Clips carry `kind` (`"audio"` or `"midi"`). A MIDI clip stores `events`
(`beat` relative to the clip start, `duration`, `note`, `velocity`).
`add_midi_clip()` accepts dicts, `NoteEvent` objects, or an `EventSequence`,
and `clip_to_event_sequence()` converts back to the Rust type. During
playback a 25 ms lookahead scheduler feeds each MIDI clip's notes to the
lane's sampler on the session bus (`triggerNote` / `releaseNote`) or, when the
lane has no sampler, to a built-in oscillator on the lane's mixer channel.
MIDI clips move, trim (honouring `offset`), duplicate, and persist with the
session like audio clips, but have nothing to export.

Clip audio crosses the comm on request. `export_clip(clip_id)` sets
`export_clip_id`; the browser fetches the object URL and answers with
`exported_clip` and `exported_clip_data` (bytes), which
`write_exported_clip(path)` saves. The kernel clears `export_clip_id` when the
bytes arrive, so `pending_exports` stays above zero until then; the browser
clears it only when the export fails, and either way the next queued clip is
requested. `import_clip(bytes_or_path, ...)` appends
clip metadata immediately, sends `import_clip_data` followed by
`import_clip_request`, and the browser attaches an object URL to the matching
clip, measuring the duration with `decodeAudioData` when none was given.

The loop brace shows the session clock's loop range. The Loop button toggles
it and the handles drag its ends (snapped to bars) through
`clock.setLoop()`; the transport mirrors the range into `loop_*_bar`. Zoom is
`pixels_per_beat` (0 fits the widget width); when set, the ruler and lanes get
an explicit width inside `.nbplay-timeline-scroll` and the playhead keeps
itself in view during playback.

Count-in is stored as `count_in_bars` and displayed through
`recording_countdown_beats`. If the chosen record point has enough timeline
space before it, recording pre-rolls from `current_beat - count_in_bars`; at
beat 0, capture starts after the count-in and the recorded clip begins at 0.
When `auto_extend_recording` is true, the browser extends `length` by
`recording_extend_bars` whenever recording approaches the timeline end. Normal
playback still stops at the end; recording stops only when the user stops it or
the timeline reaches the validated maximum length.

### LauncherWidget

Python class: `LauncherWidget`. Element:
`js/src/ts/components/launcher.ts`.

LauncherWidget is the beats view: a clip-launcher grid with tracks as rows and
scenes as columns. Each filled slot holds a pattern in the sequencer's
`voices_data` shape plus `step_duration`, `swing`, and `groove`. Python fills
slots with `set_slot(track, scene, pattern)` from a `SequencerWidget`, a list
of step dicts, or a list of voices, and issues `launch()`, `launch_scene()`,
`stop_track()`, and `stop_all()` as commands on the status `request` field.
`bind_slot_editor(sequencer)` turns a sequencer into the editor for whichever
slot is selected; edits write back into the slot live, and a selected slot that
is replaced (`set_slot()`, undo) is loaded into the editor again. Each load
gives the sequencer an `edit_token` (`track:scene:serial`). The sequencer
element writes `edit_ack` (the token plus a serial) before every pattern field
it edits, so the kernel sees which pattern a browser edit was made on. An edit
that acks an older token was made before the browser saw the current slot; it
is dropped and the slot is loaded again instead of being overwritten. A change
with no ack came from Python and is written back.

In the browser every track owns one shared-scheduler instance
(`createAudioScheduler` from `scheduler.ts`) fed by a small model adapter over
the active slot, so all playing slots follow the session clock's absolute beat
grid and stay phase-locked. Launches are queued to the next boundary chosen by
`quantize` (`bar`, `beat`, or `none`). A pending launch stores the boundary as
an AudioContext time measured from the current position (a boundary past the
loop end means the loop restart), so a loop wrap cannot strand it, and it is
re-aimed after a seek, tempo, or loop change; a 25 ms queue timer fires it. A
launch from a stopped session starts the clock and begins immediately, while a
stop request alone leaves the clock stopped. A scene launch or Stop All is
applied as one batch at one clock position: tracks with a slot in that scene
launch it, tracks without one stop, all on the same boundary. Transport stop
clears every launched and queued slot, as on a hardware launcher; play alone
resumes nothing, and the next launch starts fresh. Removing a track stops the
performance, since the remaining rows' indices shift. Scene headers show a
fully playing scene (`active`), a partly playing one (`partial`), and a queued
one (`queued`, including scene launches that only stop rows); queued cells
carry a "next" or "stop" marker. Stopping a slot also cancels the notes its
scheduler already handed to Web Audio but that have not sounded yet. A `slots`
write restarts a playing slot only when its own pattern changed. `active_slots` and `queued_slots` (per track: scene index, -1 for stop,
-2 for nothing queued) are mirrored to the kernel. Audio routes through each
track's `channel_index` on the session bus, so a launcher performance can be
captured by timeline lanes with channel-tap inputs.

A launcher displayed twice plays once. `LauncherWidget.tree()` gives every view
of the widget the same `engineKey`, and the elements with one key share an
engine: the first to connect runs the schedulers, and the others render its
slot state and progress and pass their launches to it. When the engine's view
is removed, the next view takes over from the `active_slots` it was showing.

### KeyboardWidget

Python class: `KeyboardWidget`. Element:
`js/src/ts/components/keyboard.ts`.

KeyboardWidget is a four-row musical typing keyboard. The upper zone maps number
row sharps and QWERTY-row naturals; the lower zone maps ASDF-row sharps and
ZXCV-row naturals. Upper and lower octaves are independent. Velocity ranges from
0 to 127 and can be adjusted from the keyboard with repeat acceleration.

Browser code listens at window capture phase so notebook shortcuts do not fire
while the widget or a keyboard-aware sequencer edit has focus. It intentionally
does not capture keys when an input, textarea, or content-editable element is
focused. It uses Web Audio sine oscillators as a fallback sound source, routes
through the session mixer if available, and routes to registered samplers when
`sampler_routing` matches the note zone.

Every note-on and note-off updates `last_note_event`, `active_notes`, and
dispatches `nbplay-note` on `document`. This is the loose coupling that lets the
sequencer record without direct Python links. Sustain can be upper-zone,
lower-zone, or global. Blur releases held and sustained notes to prevent stuck
notes.

Python `connect_sequencer()` marks a sequencer as keyboard-connected. Python
`connect_sampler()` builds a validated `KeyboardRoute` entry for whole-keyboard,
upper/lower zone, octave, single-note, or note-list routing, then syncs its
dictionary form through `sampler_routing`.

### MidiKeyboardWidget

Python class: `MidiKeyboardWidget`. Element: `js/src/ts/components/midi-keyboard.ts`.

MidiKeyboardWidget subclasses KeyboardWidget on the Python side so it shares the
sequencer and sampler connection API. Its browser implementation is separate
and receives notes from an external MIDI input device through Web MIDI.

The browser requests MIDI access with sysex disabled, refreshes input ports,
connects to a selected port by ID, and stores the selected port name in
`midi_port`. It handles note-on, note-off, and note-on with velocity zero as
note-off. MIDI velocity is preserved in `last_note_event`, `active_notes`, the
`nbplay-note` CustomEvent, sampler routing, and fallback oscillator gain.

Zone routing for external MIDI is based on note number: notes below MIDI 60 are
`lower`, and notes 60 or above are `upper`. This lets one MIDI keyboard drive
multiple samplers split by range through the same `connect_sampler()` API.

### MidiOutputWidget

`MidiOutputWidget` (element `js/src/ts/components/midi-output.ts`) is the session's way out to hardware and other software. It lists Web MIDI output ports (`midi_port`, `available_midi_ports`) and sends on one channel (`channel`, 0-15). With a `session_id` it registers on the bus's `noteListeners`, where every note the session plays arrives: keyboards and pads broadcast when a key goes down, and the sequencer scheduler, launcher slots, and timeline MIDI clips emit their notes as they are scheduled, with `at` (AudioContext time) and `duration`. Scheduled notes are converted to Web MIDI timestamps so the hardware plays them at the same time as the browser. Without a session it listens to the document-level `nbplay-note` events instead, never both, so nothing is sent twice. `forward_notes` turns that forwarding off. Python sends through the `send_request` trait (`note_on()`, `note_off()`, `control_change()`, `send()` for raw bytes), each request carrying a nonce so identical messages still fire. Changing port or channel and teardown send all-notes-off first.

### MIDI clock sync

The session can lead or follow external MIDI clock. As leader, `MidiOutputWidget` with `send_clock` on binds to the session clock and sends 24 ticks per beat, scheduled ahead from the clock's AudioContext time and converted to Web MIDI timestamps like the notes, so hardware stays in step with the audio. A play from beat zero sends Start, a play from elsewhere sends Song Position plus Continue, a seek while running sends Song Position, and stop sends Stop; turning the checkbox off mid-run sends Stop too. As follower, `MidiKeyboardWidget` with `sync_clock` on handles the realtime bytes its port receives: Start seeks to zero and plays the session clock, Continue plays from the current position, Stop stops, Song Position seeks (sixteenths over four), and the tick rate over the last beat sets the clock tempo, mirrored to the read-only `clock_bpm` trait and shown in the widget. Once per beat it also pulls the session back onto the device's beat grid when they drift more than a twentieth of a beat, except while a loop is active. Tempo changes in either direction go through the shared clock, so every widget in the session follows.

### MIDI learn

`nbplay/midi_learn.py` maps hardware knobs to widget config fields through the kernel. `MidiKeyboardWidget` reports each control change it receives in its `control_change` status field (`controller`, `value`, `channel`, and a `seq` counter so repeated values still notify). `MidiLearn(source)` subscribes with `on_change`; `map(controller, target, name, low, high, channel)` binds a controller now and `learn(target, name)` binds the next one the hardware sends. Bool fields switch at 64, int and float fields scale the 0-127 value into `[low, high]` (defaulting to 0-127 and 0-1), and the field's annotation on the config model decides which. Values go through the kernel, which is fine for knobs; notes stay in the browser.

### PadWidget

Python class: `PadWidget`. Element: `js/src/ts/components/pads.ts`.

PadWidget renders an on-screen trigger grid with per-pad MIDI notes, velocities,
and shared `pad_actions`. It uses the same `sampler_routing` and `KeyboardRoute`
model as KeyboardWidget, but rejects upper/lower zone routes because pads have no
keyboard halves. Pad routes can target all pads, an octave, one note, or a note
list. When no sampler route matches, note pads use the browser fallback
oscillator. Trait/event pads update `last_pad_event` without producing a note.

Python helpers `configure_grid_for_actions()`, `set_base_note()`, and
`transpose_pads()` provide global note/action setup for sampler slicing and
future external controller layouts.

## Transports widgets

Every widget in `nbplay/widget.py` is an `InstrumentWidget`: a `spaday.Widget`
hosting a config model and, where the browser owns state, a status model from
`nbplay/models.py` in its own `transports.Session`. Each widget has its own
transports session because transports grants a connection ownership of every
client-owned field in the session it joins; widgets sharing one fought over
each other's status. The browser `session_id` is what links the widgets in a
`Session` (the clock and the audio bus), and the kernel-side `bpm`,
`time_signature` and `theme` properties write every widget's config.

Config models extend `_Validated` (see "Python to browser"). Derived fields
live in after-validators and write through `__dict__`: `SynthConfig` renders
`waveform`, `MixerConfig` pads each channel's sends to the return count,
`SequencerConfig` keeps `voices_data` at `num_voices` lists of `length`
normalized steps and recomputes `length` when a grid field changes without an
explicit length, `SamplerConfig` treats `pad_count` as authoritative for the pad
lists, bounds slices by `sample_length` and normalizes zones (whose float32
bytes travel inside the list), `PadsConfig` fits the pad lists to the grid,
`LauncherConfig` normalizes slots with `_normalize_launcher_slot`, and
`TimelineConfig` keeps clips within the lane count and `current_beat` within
`length`. `current_beat` on the timeline stays configuration, so
`TimelineWidget.seek` assigns it while `play`, `stop` and `record` are status
commands.

Commands target client-owned fields. Play state and position are commands on
the transport, sequencer, synth and timeline status fields; the sampler's
`capture` (and `capture_clip` with a timeline clip), the launcher's `launch`,
`launch_scene`, `stop_track` and `stop_all`, and the MIDI output's `note_on`,
`note_off`, `control_change` and `send_raw` are commands on a status `request`
field that exists only for that purpose. `nbplay-wire` maps a status-field
command onto the transport's actions and hands any other command object
straight to `element.command()`, untagging nested transports values
(`{"Map": {...}}`) first.

`widget.on_change(listener, names=None)` reports config and status changes as
`listener(widget, name, old, new)`, from Python and from the browser alike:
config edits arrive through the hosted model's assignment path (`_Validated.update`
notifies its own listeners), while browser status writes arrive as the patches
transports hands to `Session.on_patch`, which the widgets share through one
dispatcher per transports session. `TimelineWidget.export_all_clips` collects
clip bytes into `clip_audio` as the browser exports them, and
`LauncherWidget.bind_slot_editor` loads the selected slot into a
`SequencerWidget` and writes its edits back, both on top of `on_change`.

The spaday tree is the instrument element with every config field bound
two-way on `nbplay-set` and every status field bound two-way on
`nbplay-status`, or the event a widget names in `STATUS_EVENTS` (the
transport's `undo_request` and `redo_request` counts are written back on
`nbplay-request`), so the element's events write the wire store and the store
writes the element's properties. `<nbplay-wire namespace="status">`, a child of
the instrument defined in `js/src/ts/spaday.ts`, requests the wire from the
widget root and applies each command before acknowledging it. The build writes
that bundle and the stylesheet to `nbplay/static/spaday/`, which
`nbplay.components.package` publishes as the spaday component package `nbplay`
(also an installed entry point).

Tests: `nbplay/tests/test_widgets.py` drives a widget through a mocked comm;
`js/tests/spaday.spec.js` renders the spaday widget bundle against real widgets
in a Python subprocess (`nbplay/tests/spaday_bridge.py`), and
`NBPLAY_TEST_PYTHON` names the Python with nbplay installed.

### Web app

`nbplay/app.py` serves a `Session` outside Jupyter. `build(session)` makes a
Starlette app from the same widget objects a notebook displays: each widget's
transports session gets a `WebSocketRoute` at `/ws/<panel>` with its own
`transports.Server` and `autosync` task, the page is a `spaday-regular-layout`
whose frames hold `widget.tree("<panel>.")`, and `widget.wires("<panel>.", url=...)` gives the `Wire` specs that mirror the config and status models under
that panel's namespace in the page's one store. `panel_widgets()` names the
panels (`transport`, `launcher`, `timeline`, `mixer`, then `<track>-sequencer`
and `<track>-synth` or `<track>-sampler`), `panel_titles()` gives each tab its
title (`Mixer`, `Lead synth`) through regular-layout's
`--regular-layout-<name>--title` custom property, and `default_layout()` is the split
tree: the transport across the top, launcher, timeline and mixer in the
middle, the instruments in a tab strip below. A top bar holds the title and a
theme select bound two-way to the transport's `theme`; the `Session` mirrors
that field to every widget, and the page binds it to `data-nbplay-theme` on the
document root, so one select re-themes the chrome and every instrument. A
closed panel is reopened from the palette: `nbplay-palette` lists the panel
names, opens on Ctrl+K or Cmd+K or from the bar's `panels` button
(`nbplay-palette-hint`, which shows the shortcut for the platform), and its
`nbplay-request` event invokes the layout's `openPanel` with the picked name.
The bar's save link downloads `session.nbplay` (`Session.save()`, after asking
the page to export recorded clip audio) and its load button (`nbplay-upload`)
PUTs a picked archive to the same URL. `build()` answers a load by replacing
the session it serves: it rebuilds the app's routes (page, one WebSocket per
panel, probes) for the loaded session, restarts the `autosync` tasks, and the
page reloads. `app.state.session` is the session being served.
`APP_CSS` maps regular-layout's surface, border and muted tokens onto the nbplay
tokens, so the panel chrome matches the instruments. A served page provides its wires to the mounted root the way the notebook
widget does, so `nbplay-wire` finds the client for its panel and kernel commands
(`session.play()`) reach the element unchanged. `python -m nbplay.app` serves
`demo_session()` on port 8020; `--probes` adds the JSON routes the browser test
drives (`/state`, `/command/<panel>/<method>`, `/set/<panel>/<field>`). The
server (`spaday-regular-layout`, `starlette`, `uvicorn`, `websockets`) is part of
the core dependencies.

The same page runs with no server as the standalone Pyodide example, laid out
like the ones in the spaday packages. `js/examples/pyodide.html` is the page,
`js/examples/pyodide-worker.js` the Web Worker, and
`js/examples/build_pyodide_example.py` assembles the site from wheels: it
copies the nbplay, spaday, transports and spaday-regular-layout wheels into
`pypi/`, extracts their browser assets (`runtime/spaday/`,
`components/nbplay/`, `components/regular-layout/`) and writes `wheels.json`.
`make pyodide-example` runs it into `dist/app` with the nbplay wheel from
`make test-pyodide`, and the docs workflow publishes that directory at `/app/`
on the docs site. The worker loads Pyodide, installs the wheels with
micropip and builds `nbplay.app.Standalone(demo_session())`, which holds one
`transports.Server` per panel. The page creates one managed transports client
per panel, attaches it to the worker with `postMessage` (`client.attach(send)`
/ `client.recv(frame)`, the way the notebook widget rides its comm), connects
each model to the shared store under the panel's namespace and provides the
wires to the root for `nbplay-wire`. Every frame from the page is applied by
`Standalone.receive()`, which then flushes every server, because one edit can
change other widgets' models through the session's mirroring. So validation,
derived fields (the Rust waveform, as WebAssembly) and the `Session` logic are
the same Python as in a kernel. `nbplay.call("transport", "play")` in the page
calls a widget method in the worker. `nbplay/app.py` imports Starlette lazily,
so it imports in Pyodide.

The standalone page has the same save link and load button, with the page
script and the worker in place of the server. A click on the save link asks
the worker for the archive: it requests the recorded clip audio, waits up to
five seconds for the page to send it, calls `Standalone.save()` and posts the
bytes back for a download. `nbplay-upload` offers a picked file in a cancelable
`nbplay-request` (`{name: "upload", file}`) before it PUTs; the page cancels
it and sends the bytes to the worker, which checks them with
`Standalone.load()`. A refused file shows its error beside the button. An
accepted one is kept in the Cache API and the page reloads; the next worker
takes it out of the cache and builds `Standalone.load(bytes)` in place of the
demo session. The cached archive is used once, so a later reload is the demo
again.

## Styling system

Implementation lives in `js/src/css/components/`: `tokens.css` defines the
role-named `--nbplay-*` custom properties (background, foreground, accent,
fill, indicator, state colors, meter ramp, chart colors, radius, control
sizes, fonts) with values that resolve through JupyterLab's `--jp-*` variables
and carry light and dark fallbacks, and every element has its own stylesheet
scoped under its tag (`nbplay-fader .nbplay-fader-track`). Element CSS uses
only `--nbplay-*` tokens, never `--jp-*` or hex values; canvas drawing reads
them at runtime through `cssVar(el, "--nbplay-*", fallback)`. Semi-transparent
colors use `color-mix()` rather than `rgba()`.

A `data-nbplay-theme` attribute on any ancestor selects a theme set for that
subtree. `light` and `dark` are the default theme's two sets; `studio`, `flat`,
`cube`, `one`, `grim`, `pro` and `fruit` ship as `js/src/css/theme-*.css`, each
redefining every token under `[data-nbplay-theme="<name>"]`. A new set copies
one of these and changes values; it never adds selectors for individual
elements. From Python, every widget has a `theme` config field (validated against
`nbplay.THEMES`) that its element reflects as `data-nbplay-theme` on itself,
and `Session(theme=...)` or `session.theme = ...` sets it on every widget in
the session, including tracks added later; the value is saved with the
session.

The JS build runs `bundle_css("src/css")`, which inlines the `@import`s of
`components.css` into one file under `js/dist/css/`, and copies it to
`nbplay/static/nbplay.css`, the stylesheet every Python widget loads.

## Build pipeline

Top-level commands are in `Makefile`.

```bash
make develop       # Rust tools, JS deps/browser install, Python editable install
make build         # Rust core/native build, JS WASM/widgets, Python wheel build
make test          # Python, Playwright, Rust, and Voila/JupyterLab host tests
make coverage      # Coverage variants of the test suites
make lint          # Rust clippy/fmt, JS oxlint/oxfmt, Python ruff, README docs checks
make fix           # Format/fix Rust, JS, Python, and README docs
make test-notebooks # Notebook regression tests only
make dist          # Full distribution build and checks
```

The JavaScript build in `js/package.json` is ordered as:

1. `pnpm build:clean`: remove `js/dist/`.
1. `pnpm build:rust`: compile the WASM crate for `wasm32-unknown-unknown`.
1. `pnpm build:wasm-bindgen`: generate JS glue and `.wasm` under
   `js/dist/pkg/`.
1. `pnpm build:prod`: run `js/build.mjs`, which bundles TypeScript entries,
   processes CSS, and copies widget JS/CSS into `nbplay/static/`.
1. `pnpm build:types`: emit TypeScript declarations under `js/dist/esm/`.

The Python build uses Hatch hooks:

- hatch-js runs the JavaScript build from `js/` and expects
  `nbplay/static/spaday/index.js`.
- hatch-rs builds the PyO3 extension from the root Cargo package.
- `nbplay/static` is a declared build artifact so wheels include the generated
  assets even though they are ignored in Git.

## Testing strategy

### Python tests

`nbplay/tests/test_all.py` covers the Rust/PyO3 types, the descriptor classes,
the pure MIDI-file helpers and the example notebooks (metadata and top-to-bottom
execution). `nbplay/tests/test_widgets.py` covers the models and every widget:
validation, the Python methods, browser edits and status writes through a mocked
comm (`browser_writes`), `on_change`, `Session`, persistence, history and MIDI
learn.

Run:

```bash
python -m pytest -v nbplay/tests
python -m pytest -v nbplay/tests/test_all.py -k "TestDemoNotebook"
```

### JavaScript tests

Playwright tests live in `js/tests/`. The harness at
`js/tests/fixtures/harness.html` provides a mock `AudioContext` and
`createMockModel()` implementation with `get`, `set`, `save_changes`, `on`, and
manual trigger helpers; `js/tests/support/instruments.ts` (bundled to
`dist/tests/instruments.js`, never shipped) binds an instrument element to such
a model through the same trait maps the Python widgets use, so the widget specs
drive each element through traits. Tests cover DOM rendering, synced model
state, user interactions, inline editing, keyboard capture, MIDI input,
scheduler state, and session integration.

Run:

```bash
cd js
pnpm test
```

### Web app test

`pnpm run test:app` (also part of `pnpm test`) boots `python -m nbplay.app --probes` (config:
`js/playwright.app.config.js`) and checks that every instrument renders in its
panel, a kernel assignment and a browser edit meet in the transport's model,
play from the browser reaches the kernel's status on every panel, and kernel
commands stop and start the clock through `nbplay-wire`.

`make test-pyodide-example` builds the standalone Pyodide example and runs
`pnpm run test:pyodide` (config: `js/playwright.pyodide.config.js`) against
`dist/app`: the page comes up from Pyodide, pydantic rejects an out-of-range
edit, a valid one re-renders the waveform, the session mirrors mute and theme
across panels, Python calls start and stop the clock, and a saved session
comes back after a load. Pyodide and nbplay's
pure-Python dependencies come from their CDNs, so the test needs network
access. The page imports `provideWires` from the spaday runtime in the spaday
wheel, so the pinned spaday in the make target must be a release that exports
it.

### Host compatibility tests

`pnpm run test:hosts` (also part of `pnpm test`) boots real Jupyter hosts with
a live kernel and drives the rendered widgets through Playwright:

- `tests/voila.spec.js` serves `tests/fixtures/host_smoke.ipynb` with
  `python -m voila` on port 8866.
- `tests/jupyterlab.spec.js` opens the same notebook in `jupyter lab` on port
  8899 and in `jupyter notebook` (Notebook 7) on port 8898, runs every cell,
  and then interacts with the outputs. Each editor gets its own scratch copy of
  the notebook so their autosaves do not collide.

The smoke notebook builds a `Session` (transport, sequencer track, launcher,
timeline, mixer) plus a kernel-side probe: an `ipywidgets.HTML` label that a
`transport.observe()` callback updates, and an `ipywidgets.Button` that calls
`session.stop()`. Each host test asserts that every widget renders, that
pressing play propagates through the browser clock to the sequencer and
timeline, that the kernel probe flips to "playing" (browser to kernel), and
that the kernel button stops everything (kernel to browser). Page errors are
collected only after the widgets have rendered, because host startup noise
from third-party lab extensions is unrelated to nbplay. `voila` and
`notebook` are `develop` extras so CI has them; JupyterLab and Notebook 7 come
with the ipywidgets lab manager.

### Pyodide wheel

`make test-pyodide` builds a `cp314-pyodide_wasm32` wheel with cibuildwheel
and smoke-tests it in Pyodide; CI runs the same target in the `pyodide` matrix
entry. hatch-rs cross-compiles the PyO3 extension to
`wasm32-unknown-emscripten`; the native-only `AudioOutput` and `MidiInput`
classes (cpal and midir) are compiled out on wasm32 and import as `None` in
Python, so `nbplay.AudioOutput is None` is the check for that platform. The
`[tool.cibuildwheel.pyodide]` section removes any host extension from the
package directory before the build so only the Emscripten module ships, and
replaces the pytest suite (which needs a live kernel) with an import and
session smoke test. The wheel is the basis for running the widgets in
JupyterLite.

### JupyterLite demo

`make lite` builds the browser-only demo into `docs/html/lite` and the docs
workflow publishes it at `/lite/` on the docs site. `docs/lite/prepare.py`
stages the example notebooks in `docs/lite/contents` with one extra leading
cell, `%pip install -q nbplay`, which piplite resolves from the bundled Pyodide
wheel (the repository notebooks are untouched, since that line would reach
PyPI in a regular kernel). It also writes `jupyter_lite_config.json` listing
the lab extensions the site needs when `jupyter lite build` cannot discover
them from `sys.prefix`: the Pyodide kernel, the ipywidgets manager, and
anywidget's frontend module. Without the last one the widgets fail with
"No version of module anywidget is registered".

`make test-lite` (also run by the `pyodide` CI job) serves the built site and
runs `js/tests/jupyterlite.spec.js`: it opens the synth notebook on the
Pyodide kernel, runs every cell, and waits for an nbplay widget to render.
Pyodide itself is fetched from its CDN at runtime.

### Keyboard shortcuts

`bindShortcuts(root, handlers)` in `helpers.ts` scopes shortcuts to a widget:
they fire only while focus is inside the widget's root (clicking a widget
focuses it), never while a text field has focus, and never with Ctrl, Meta,
or Alt held. Consumed keys call `preventDefault()`, which also stops Space
from activating a focused button a second time.

| Widget    | Keys                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport | `Space` play/pause, `Shift+Space` stop and rewind, `R` record, `L` loop, `↑`/`↓` BPM ±1, `Shift+↑`/`Shift+↓` BPM ±10                                       |
| Sequencer | `Space` play/pause, `Shift+Space` stop, arrows move the step cursor, `Enter`/`X` toggle the cursor step, `Esc` clears the cursor and any pending note edit |
| Timeline  | `Space` play/pause, `Shift+Space` stop and rewind, `R` record, `L` loop, `D` duplicate clip, `Delete`/`Backspace` delete clip                              |
| Launcher  | `Space` play/pause, `1`–`9` launch scene, `0`/`Esc` stop all                                                                                               |

The QWERTY `KeyboardWidget` captures keys at window level when it, or a
sequencer that is recording or waiting for a note, has focus; in that state
its bindings (including `Space` as global sustain) win.

### Session persistence

`Session.save(path)` writes a `.nbplay` zip archive and `Session.load(path)`
rebuilds the session from it. `Session.to_dict()` / `Session.from_dict()` are
the JSON layer underneath. The archive holds:

- `session.json`: transport (tempo, time signature, loop), mixer (channels
  with effects, master gain and effects), tracks (name, sequencer state,
  sound source type and state), timeline (length, count-in, zoom, lanes,
  clips without their browser-local `audio_url`), and launcher (quantize,
  scenes, slots).
- `samples/track-N.f32`: a sampler track's PCM as little-endian float32.
- `clips/<clip id>.bin`: timeline clip audio that has arrived from the
  browser.

Sound sources are limited to `SynthWidget` and `SamplerWidget` (or none);
saving another type raises. Clip audio lives in the browser, so before saving
call `session.timeline.export_all_clips()`, which queues one `export_clip()`
request per clip and caches each answer in `timeline.clip_audio`; wait for
`timeline.pending_exports` to reach zero. On load, cached clips go back through
`import_clip()` so the browser reattaches playable audio, and other clips keep
their metadata. Loading creates fresh widgets with a new `session_id`.

### Undo and redo

`nbplay/history.py` keeps an undo stack over widget config. `History.attach(widget)` subscribes to the widget's config model with `on_change`, so browser edits count too, and ignores the transient fields listed in `TRANSIENT_TRAITS` (selection, request counts, derived data such as the waveform preview); browser-owned status never reaches a config model. Each change becomes an entry `(config, field, old, new)`; changes within `group_window` seconds of the previous one (0.3 s by default, so a fader drag or a method that writes several fields is one step) share a step, `transaction()` groups a block explicitly, `paused()` hides a block, and `mark()` ends the current step. A session also registers `mark()` on IPython's `post_run_cell` event (`bind_ipython()`), so two cells never share a step even when Run All executes them within the window. `undo()` restores the step's old values in reverse order by assigning the config fields, and moves the step to the redo stack; a new change clears redo.

A `Session` owns one `History`, attaches the transport, mixer, timeline, and launcher, and attaches each track's sequencer and sound source as `add_track()` runs. Adding or removing a track, and `import_midi()`, run paused: they create or drop Python objects and mixer channels together, which a field-level undo cannot replay consistently, so they are documented as not undoable. `chain()` and `update_pattern()` run as transactions so one undo reverts the whole arrangement change. `session.undo()` and `session.redo()` are the entry points; in the browser, Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl/Cmd+Y) with the transport focused bump its `undo_request` / `redo_request` status counts, which the session answers.

### Pattern chaining

`Session.patterns` holds named patterns (`voices_data` plus a `step_duration`) registered with `add_pattern()` from a sequencer, a `NoteComposer`, or step lists. `chain(track, names, start, repeat)` lays the named patterns back to back on the track's timeline lane as MIDI clips generated by `TimelineWidget.add_pattern_clip()`, which expands active steps into note events (tiled `repeat` times) and tags the clip with `pattern`. The tracking view plays them through its usual MIDI clip path (the lane's bus sampler or the built-in oscillator) and draws them in the pattern colour. A track with a sequencer gets `follow_transport = False` so the sequencer's own loop does not double the arrangement: the browser ignores the clock's play event for that sequencer, while its own play button still works. `update_pattern()` regenerates every clip placed from a name, keeping ids, positions, and durations; `remove_pattern()` only forgets the registry entry. Patterns are saved in `session.json` and the clips carry their `pattern` tag through the normal clip persistence.

### MIDI files

`nbplay/midi.py` reads and writes `.mid` files through `mido`, an optional dependency installed with `pip install "nbplay[midi]"`. Everything works in beats, the unit the widgets use, and converts to ticks (480 per beat) only at the file boundary. `read_midi()` turns a path, bytes, or file object into beat-based tracks (`name`, `channel`, `events`), pairing note-ons with note-offs and treating velocity-zero note-ons as note-offs; tracks without notes are left out, and the first tempo and time signature are reported. `build_midi()` / `write_midi()` go the other way, with a tempo and time signature meta track first.

On top of that: `SequencerWidget.to_midi()` exports a pattern (step index times `step_duration` is the beat, `duration_ticks` the length) and `load_midi()` quantizes a file onto the grid, one voice per overlapping note up to `max_voices`, growing `length` to fit. `TimelineWidget.export_midi_clip()` and `import_midi()` move MIDI clips in and out. `Session.export_midi()` writes one track per sequencer plus one per MIDI clip at its timeline position, and `Session.import_midi()` adds one MIDI lane per track with the track as a clip, applying the file's tempo unless told not to.

### Rust tests

Rust unit tests live beside the implementation modules under `rust/src/` and in
the JS crate where relevant. They validate core DSP/data behavior and tolerate
missing native devices where CI is headless.

Run:

```bash
make -C rust test
make -C rust coverage
```

### Docs and notebooks

Example notebooks are part of the docs surface. Prefixed notebooks under
`examples/` must be valid JSON and every cell must have `metadata.language` and
`metadata.id`. Code cells must include `execution_count` and an `outputs` list,
even if empty. The docs workflow validates these fields before `yardang build`.

Run:

```bash
make test-notebooks
yardang build
```

## CI and publishing

The build workflow runs on Ubuntu, macOS, and Windows with Python 3.11 and Node
22\. It installs Rust, Node, and Python dependencies, installs Linux ALSA headers,
runs lint/checks on Ubuntu, builds the project, runs coverage, uploads JUnit XML,
uploads coverage to Codecov, builds distribution artifacts, and smoke-tests the
wheel/sdist on Ubuntu.

The docs workflow runs after a successful build on main or by manual dispatch.
It installs from the built wheel for workflow-run builds or from source for
manual builds, validates example notebooks, runs `yardang build`, and publishes
`docs/html` to `gh-pages`.

Version bumps use `bump-my-version` and update Python, JavaScript, Rust, and
Binder version references in one commit/tag:

```bash
make show-version
make patch
make minor
make major
```

## Adding or changing features

### Add a new Rust core type exposed to Python

1. Implement the type in `rust/src/<module>.rs`. Keep validation in constructors
   or setters and add Rust unit tests near the implementation.
1. Re-export the type from `rust/src/lib.rs` if it should be public.
1. Add a PyO3 wrapper in `rust/python/<module>.rs` using the existing `Py*`
   naming pattern.
1. Register the class in `rust/python/lib.rs` with `m.add_class::<...>()?`.
1. Re-export it from `nbplay/__init__.py`.
1. Add Python tests in `nbplay/tests/test_all.py` for construction, validation,
   repr/equality, and behavior.
1. Run `make build-rs`, `make build-py`, and focused tests.

### Add a Rust feature exposed to the browser

1. Implement reusable logic in `rust/src/` when possible.
1. Add wasm-bindgen wrappers in `js/src/rust/`.
1. Re-export from `js/src/rust/lib.rs` and `js/src/ts/index.ts` if the binding
   should be public to JS consumers.
1. Ensure required `web-sys` features are listed in `js/Cargo.toml`.
1. Rebuild with `cd js && pnpm build` and add Playwright coverage if a widget
   uses the new binding.

### Add a new widget

1. Add a config model (and a status model when the browser owns state) in
   `nbplay/models.py`, with valid defaults and validators.
1. Add a class in `nbplay/widget.py` extending `InstrumentWidget` with `TAG`,
   `CONFIG_MODEL`, `STATUS_MODEL`, and the `CONFIG` and `STATUS` field-to-property maps.
1. Create the element in `js/src/ts/components/<name>.ts`: extend
   `NbplayElement`, compose existing primitives and composites, emit
   `nbplay-set`, `nbplay-status` and `nbplay-request`, and `define("nbplay-<name>", ...)`.
   Export it from `components/index.ts` and add a section to `gallery.ts`.
1. Create `js/src/css/components/<name>.css` scoped under the tag and add it to
   `js/src/css/components.css`.
1. Add the element's trait maps to `INSTRUMENTS` in `js/tests/support/instruments.ts`
   so the widget specs can drive it.
1. Re-export the widget from `nbplay/__init__.py`.
1. Add Python widget tests and Playwright tests.
1. Add or update an example notebook when the widget is user-facing.
1. Run `cd js && pnpm build`, then focused Python and JS tests.

### Modify an existing widget field

1. Update the field's default and validation on the config or status model.
1. Add the field to the widget's `CONFIG` or `STATUS` map in `nbplay/widget.py`,
   the matching property to the element, and the trait map in `js/tests/support/instruments.ts`.
1. Update CSS if the field changes layout or visible state.
1. Update `nbplay/static` by rebuilding JS before testing Python rendering from
   source.
1. Add Python tests for the field default/API and Playwright tests for browser
   interaction.
1. Update examples and this guide when the feature changes developer workflow.

### Modify audio routing

1. Check whether the feature should use a standalone `AudioContext` fallback, a
   session mixer bus, or both.
1. Preserve render-order tolerance. If a widget depends on the mixer bus, listen
   for `nbplay-bus-ready` or retry registration when `session_id` changes.
1. Clean up every node, timer, event listener, and bus entry in the render
   cleanup function.
1. Avoid creating multiple owned `AudioContext` instances when routing through a
   session bus.
1. Add integration tests under `js/tests/integration.spec.js` when multiple
   widgets are involved.

### Modify keyboard or MIDI behavior

1. Keep `last_note_event` shape as `{ note, velocity, type }` unless every
   consumer is updated.
1. Preserve `nbplay-note` CustomEvent dispatch for sequencer recording.
1. Preserve sampler routing semantics: `all`, `upper`, and `lower` zones.
1. MIDI note-on with velocity zero should remain equivalent to note-off.
1. Add tests for active notes, velocity, note-off, sampler routing, and event
   dispatch.

## Common pitfalls and invariants

- Never emit `nbplay-status` from an element during construction or its first
  property assignment; the kernel must not see a write before the widget's
  ready handshake.
- Always return a cleanup function from a widget renderer. Stop audio, clear
  intervals, remove global event listeners, disconnect MIDI ports, and unregister
  session bus entries.
- Treat `nbplay/static/` as generated output. Rebuild it when testing widget
  rendering, but do not hand-edit it.
- Keep CSS scoped under a widget root class. Notebook pages are shared DOMs.
- Use Jupyter theme variables for colors. Canvas code should read CSS variables
  through `cssVar()`.
- Binary waveform traits are little-endian float32 bytes. Python writes them
  with `array.array("f").tobytes()` and TypeScript reads them with `toFloat32()`.
- If a feature depends on notebook examples, validate notebook JSON and required
  cell fields before committing.
- Browser MIDI requires user/browser permission and may be unavailable. UI code
  should handle missing `navigator.requestMIDIAccess` gracefully.
- Native audio/MIDI devices may be unavailable in CI. Tests should accept that
  when testing device enumeration or construction.
- Keep Python, Rust, TypeScript, CSS, tests, examples, and docs in sync. Widget
  features almost always cross at least two layers.

## Release checklist for a feature

Use the smallest focused verification first, then broaden before release:

```bash
# Python/widget API
python -m pytest -v nbplay/tests/test_all.py -k "<focused pattern>"

# Browser widget behavior
cd js
pnpm test -- <focused spec>

# Rust core changes
make -C rust test

# Notebook edits
make test-notebooks

# Full local confidence pass
make lint
make test
make build
```

For release work, also run distribution checks:

```bash
make dist-check
python -m twine check dist/*
```
