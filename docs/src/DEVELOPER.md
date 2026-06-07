# nbplay Developer Guide

This guide is the top-to-bottom map for nbplay contributors. It explains how the
Python package, Rust core, PyO3 extension, WebAssembly bindings, TypeScript
widgets, browser audio/MIDI runtime, tests, docs, and distribution pipeline fit
together. It is meant to be detailed enough that a developer can add a feature
to any component without first reverse-engineering the whole repository.

nbplay is a notebook-native digital audio workstation. Users instantiate Python
objects in a Jupyter kernel; anywidget syncs trait state to browser-side
TypeScript renderers; the browser uses Web Audio and Web MIDI for low-latency
interaction; Rust provides reusable DSP/data types and compiles both to a native
Python extension and to browser WebAssembly.

## Mental model

The runtime has three cooperating layers:

```text
Jupyter notebook / Lab / VS Code / Colab
  Python kernel
    nbplay/widget.py anywidget classes
    nbplay.nbplay native extension from Rust/PyO3
      | traitlets sync over Jupyter comms
  Browser output area
    js/src/ts/*.ts anywidget ESM renderers
    Web Audio API and Web MIDI API
    optional wasm-bindgen bindings from js/src/rust
      | shared Rust source compiled for native and wasm targets
  Rust core
    rust/src audio, MIDI, oscillators, mixer, sampler, sequencer
    native-only cpal audio output and midir MIDI input
```

The important design choice is that notebook state lives in Python traits, while
real-time interaction lives in the browser. Rust supports both sides: the Python
package uses PyO3 wrappers for ergonomic Python classes, and the JavaScript
package builds WebAssembly bindings for browser-facing Rust helpers.

## Repository map

| Path | Responsibility |
| --- | --- |
| `nbplay/widget.py` | Python anywidget classes, session orchestration, and notebook-facing helper APIs. |
| `nbplay/__init__.py` | Public Python exports for Rust/PyO3 types and widget classes. |
| `rust/src/` | Shared Rust core library: audio buffers, MIDI, oscillators, mixer, sampler, sequencer, native I/O. |
| `rust/python/` | PyO3 wrapper classes exposed as the `nbplay.nbplay` native extension. |
| `js/src/ts/` | Browser anywidget renderers, one standalone ESM entry per widget. |
| `js/src/css/` | One scoped stylesheet per widget, processed by lightningcss. |
| `js/src/rust/` | wasm-bindgen browser bindings around selected Rust functionality. |
| `js/tests/` | Playwright browser tests using a mock anywidget model and mock Web Audio context. |
| `nbplay/tests/test_all.py` | Python, Rust-extension, widget, session, and example-notebook regression tests. |
| `examples/` | Executable tutorial notebooks used by users and docs builds. |
| `.github/workflows/` | CI for build/test/dist and docs publishing. |
| `pyproject.toml`, `Cargo.toml`, `js/package.json` | Python, Rust, and JavaScript package/build configuration. |

Generated assets are copied into `nbplay/static/` and `nbplay/extension/` by the
JavaScript build. These folders are ignored in Git but included in built wheels
through Hatch artifact configuration.

## Runtime data flow

### Python to browser

Each rendered widget is an `anywidget.AnyWidget` subclass in `nbplay/widget.py`.
Traits are declared with `traitlets.*.tag(sync=True)`. When Python code sets a
trait, the value is serialized through the Jupyter comm protocol to the browser
model. Browser code reads and writes the same state through the anywidget model
interface:

```ts
model.get("trait_name");
model.set("trait_name", nextValue);
model.save_changes();
model.on("change:trait_name", callback);
```

User-initiated changes call `model.save_changes()` so the kernel receives them.
Render-time resets and very frequent visual updates generally use `model.set()`
without saving to avoid racing other widget initialization or flooding comms.
For example, SynthWidget, SequencerWidget, and TransportWidget force playback to
stopped during render with local `model.set()` calls only.

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

- `anywidget`: provides the notebook widget transport and ESM frontend loading.
- `ipywidgets>=8`: widget runtime foundation used by anywidget.
- `traitlets`: declared indirectly through the widget stack and used directly in
  `nbplay/widget.py` for synced state and links.

### Rust runtime

- `serde`: serialization derives for several core value types.
- `pyo3`: native Python extension bindings, configured with `abi3`.
- `cpal`: native audio output for non-wasm targets.
- `midir`: native MIDI input for non-wasm targets.
- `wasm-bindgen`, `wasm-bindgen-futures`, `js-sys`, `web-sys`: browser
  bindings for WASM output.

### JavaScript and frontend build

- TypeScript with strict checking and ES modules.
- esbuild for widget and package bundling.
- lightningcss for CSS bundling and modern CSS processing.
- cpy for copying built assets into Python package folders.
- Playwright for browser tests.
- http-server for the local browser test server.
- nodemon for watch-mode rebuilds.
- prettier for JS/TS/CSS formatting.

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

All Python widget classes live in `nbplay/widget.py`. The `_esm` and `_css`
attributes point to built files under `nbplay/static/`. The JavaScript build must
run before a source checkout can render widgets from Python because those static
files are generated.

### Shared Python helpers

- `_default_step()` and `_default_steps(length)` build the sequencer's default
  inactive step dictionaries.
- `_measure_beats(time_signature_num, time_signature_den)` converts a time
  signature into quarter-note beats per measure.
- `_step_duration_for_length(length, measures, time_signature_num,
  time_signature_den)` infers the musical step duration for an explicit step
  count.
- `_resize_pad_notes(notes, pad_count)` clamps MIDI pad notes to 0-127 and
  preserves or extends the list when sampler pad count changes.
- `AudioClip`, `TimelineTrack`, and their normalizers define the synced
  metadata shape for timeline lanes and browser-recorded clips.
- `PadAction` and `_normalize_pad_actions()` define the shared pad action shape
  used by sampler pads and PadWidget. Note actions are live today; trait/event
  actions provide a stable controller-pad path for future automation and MIDI
  learn work.

### Widget trait summary

| Python class | Browser entry | CSS entry | Key synced traits |
| --- | --- | --- | --- |
| `SynthWidget` | `widget.js` | `widget.css` | `oscillator_type`, `frequency`, `amplitude`, `sample_rate`, `is_playing`, `waveform` |
| `SettingsWidget` | `settings.js` | `settings.css` | `sample_rate`, `channels`, `buffer_size`, `audio_device`, `midi_port`, `available_midi_ports`, `midi_event` |
| `MixerWidget` | `mixer.js` | `mixer.css` | `channels`, `master_gain`, `master_effects`, `session_id` |
| `SequencerWidget` | `sequencer.js` | `sequencer.css` | `length`, `measures`, `time_signature_num`, `time_signature_den`, `bpm`, `step_duration`, `swing`, `groove`, `automation_lanes`, `is_playing`, `current_step`, `loop_enabled`, `num_voices`, `session_id`, `channel_index`, `keyboard_connected`, `voices_data` |
| `SamplerWidget` | `sampler.js` | `sampler.css` | `sample_name`, `sample_rate`, `root_note`, `sample_length`, `waveform`, `sample_data`, ADSR traits, `pad_notes`, `pad_velocities`, `pad_actions`, `sample_slices`, `pad_count`, `velocity`, `velocity_sensitive`, `max_voices`, `session_id`, `channel_index`, `keyboard_connected` |
| `TransportWidget` | `transport.js` | `transport.css` | `bpm`, `is_playing`, `is_recording`, `time_signature_num`, `time_signature_den`, `bar_number`, `beat_in_bar`, `current_beat`, `loop_enabled`, `loop_start_bar`, `loop_end_bar` |
| `TimelineWidget` | `timeline.js` | `timeline.css` | `session_id`, `bpm`, `is_playing`, `is_recording`, `recording_track`, `recording_error`, `recording_countdown_beats`, `count_in_bars`, `auto_extend_recording`, `recording_extend_bars`, `time_signature_num`, `time_signature_den`, `length`, `current_beat`, `tracks`, `clips`, `selected_clip_id`, `recorded_clip` |
| `KeyboardWidget` | `keyboard.js` | `keyboard.css` | `upper_octave`, `lower_octave`, `velocity`, `active_notes`, sustain traits, `last_note_event`, `session_id`, `channel_index`, `sampler_routing` |
| `MidiKeyboardWidget` | `midi_keyboard.js` | `midi_keyboard.css` | Keyboard traits plus `midi_port` and `available_midi_ports` |
| `PadWidget` | `pad.js` | `pad.css` | `rows`, `cols`, `velocity`, `velocity_sensitive`, `pad_notes`, `pad_velocities`, `pad_actions`, `active_pads`, `last_note_event`, `last_pad_event`, `session_id`, `channel_index`, `sampler_routing` |

### Non-rendered Python orchestration types

`NoteComposer` is a traitlets object that owns one voice of sequencer step data.
It is not rendered directly. A `SequencerWidget` owns one composer per voice and
syncs all composers into `voices_data`, a list of step lists. The `steps`
property remains a backward-compatible alias for voice 0.

`Track` binds a sequencer, a sound source, and a mixer channel. It links BPM and
time signature bidirectionally between a session transport and the sequencer,
and dlinks `is_playing` from transport to sequencer so a non-looping sequencer
cannot stop every track.

`Session` creates a shared `session_id`, a `TransportWidget`, a `MixerWidget`,
and a `TimelineWidget`. `Session.add_track()` creates a mixer channel, links
transport state, adds a timeline lane, and writes `session_id` and
`channel_index` into the sequencer and sound source. Browser widgets use those
fields to route audio through the shared mixer bus.

## Rust core

The reusable Rust library is in `rust/src/`. It is compiled as an `rlib` and is
used by both the PyO3 extension and the WASM crate. Native-only device modules
are gated out for wasm builds.

| Module | Key types and behavior |
| --- | --- |
| `audio.rs` | `SampleRate`, `ChannelCount`, `AudioFormat`, and interleaved `AudioBuffer`. Buffers support silence allocation, frame count, checked sample get/set, add-mixing, and clearing. |
| `midi.rs` | `MidiChannel`, `Note`, `Velocity`, `ControlNumber`, `MidiMessage`, `MidiEvent`, `note_to_hz()`, `hz_to_note()`, and `parse_midi_bytes()`. Channel range is 0-15; notes, velocity, and controls are 0-127. Note-on with velocity 0 parses as note-off. |
| `oscillator.rs` | `AudioSource` trait and sine, square, saw, and deterministic-noise sources. Oscillators render into an `AudioBuffer` and wrap phase into [0, 1) to avoid drift. |
| `mixer.rs` | `MixerChannel` and `Mixer`. Channels apply gain, mute, solo, and constant-power pan. `Mixer::mix_down()` combines mono channel buffers into interleaved stereo output. |
| `sampler.rs` | `AudioSample`, `Envelope`, polyphonic `Sampler`, `SampleMapping`, and `SampleMap`. The sampler handles pitch ratio, sample-rate ratio, linear interpolation, ADSR, looping, soft clipping, voice stealing, note-off release, and panic/all-notes-off. |
| `sequencer.rs` | `Step`, `Pattern`, `NoteEvent`, `EventSequence`, `TransportClock`, `TransportState`, and `StepSequencer`. These model fixed step patterns, piano-roll events, beat clocks, and MIDI event generation over beat ranges. |
| `audio_output.rs` | Native `AudioOutput` via cpal. Builds a fixed-buffer output stream and fills it through a render callback. Not compiled for wasm. |
| `midi_input.rs` | Native `MidiInput` via midir. Lists ports and connects callbacks that receive parsed `MidiEvent` values. Not compiled for wasm. |

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
- Oscillators: `SineOscillator`, `SquareOscillator`, `SawOscillator`,
  `NoiseSource`.
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

Every browser widget file in `js/src/ts/` exports the anywidget shape:

```ts
function render({ model, el }: { model: AnyModel; el: HTMLElement }): () => void {
  // build DOM, attach event listeners, sync model state
  return () => {
    // cleanup audio, timers, global listeners, and bus registrations
  };
}

export default { render };
```

The shared `AnyModel` type and helpers are in `js/src/ts/helpers.ts`:

- `onKernelDisconnect()` polls the widget model for comm loss and calls a
  cleanup callback after a delay. Widgets use it to stop audio when the kernel
  restarts or shuts down.
- `cssVar()` reads Jupyter CSS custom properties for canvas drawing.
- `makeEditable()` implements double-click inline editing with an Enter/blur
  commit guard.
- `toFloat32()` converts anywidget binary buffers into `Float32Array`.
- Gain/pan helpers convert and format linear gain, dB, and pan values.

### Browser APIs used

nbplay uses browser capabilities directly rather than relying on a web audio
framework:

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
- `performance.now()` for transport position and MIDI fallback timestamps.
- `globalThis.__nbplay` as a notebook-page-local session bus registry.
- CSS custom properties from JupyterLab, especially `--jp-*` theme variables.

### Session bus shape

When a `MixerWidget` has a `session_id`, it registers a bus at:

```ts
globalThis.__nbplay[sessionId] = {
  audioCtx,
  masterGain,
  channels: [{ gain, pan }, ...],
  plugins: { [effectType]: (ctx, effect) => AudioNode | EffectUnit },
  samplers: { [channelIndex]: { triggerNote, releaseNote } },
  noteListeners: [(evt) => void]
};
```

The exact properties are created lazily by participating widgets. The mixer owns
`audioCtx`, `masterGain`, `channels`, and a fresh merged view of browser insert
effect plugin factories. Samplers add `samplers[channelIndex]` so KeyboardWidget
and MidiKeyboardWidget can trigger them. Keyboard widgets also broadcast
`nbplay-note` on `document`, which lets sequencers record notes even without a
shared mixer bus. Timeline clip playback reads `audioCtx` and `channels` from
the bus so recorded clips can route through the same mixer channel strip and
insert effects as live sources.

Render order can vary in notebooks. SamplerWidget handles this by listening for
`nbplay-bus-ready` and registering again when the mixer creates the bus.

## Widget deep dives

### SynthWidget

Python class: `SynthWidget`. Browser file: `js/src/ts/widget.ts`. CSS file:
`js/src/css/widget.css`.

SynthWidget exposes oscillator type, frequency, amplitude, sample rate, play
state, and a binary waveform preview. Python renders the preview through the
Rust oscillator classes and stores little-endian float32 bytes in the `waveform`
trait. Browser code converts those bytes with `toFloat32()` and draws a high-DPI
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

### SettingsWidget

Python class: `SettingsWidget`. Browser file: `js/src/ts/settings.ts`. CSS
file: `js/src/css/settings.css`.

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

Python class: `MixerWidget`. Browser file: `js/src/ts/mixer.ts`. CSS file:
`js/src/css/mixer.css`.

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
`compressor`, `limiter`, `delay`, and `reverb`. Unknown descriptor types are
left intact when their params are JSON-safe so notebook code can register
custom browser plugins on `globalThis.__nbplayPlugins[type]`. Built-in names are
reserved and win over user registry entries. The mixer exposes a merged plugin
map on the session bus without mutating `globalThis.__nbplayPlugins`. A plugin
factory receives `(audioCtx, descriptor)` and returns either an `AudioNode` or
an `{input, output, dispose?}` unit.

When `session_id` is set, the browser creates the shared `AudioContext`, one
`GainNode` plus `StereoPannerNode` per channel, channel insert chains, a master
`GainNode`, and a master insert chain connected to destination. Mute/solo
affects the channel gain nodes. The bus is registered on `globalThis.__nbplay`
and removed on cleanup.

### SequencerWidget

Python class: `SequencerWidget`. Browser file: `js/src/ts/sequencer.ts`. CSS
file: `js/src/css/sequencer.css`.

SequencerWidget models a pattern grid. Python owns one `NoteComposer` per voice
and syncs them as `voices_data`. The grid can be configured by absolute length
or musically by `measures`, `step_duration`, and time signature. In 4/4, a
`step_duration` of 0.5 is eighth notes, 0.25 is sixteenth notes, and 0.125 is
thirty-second notes. `configure_grid()` on the Python side and the frontend grid
controls both resize the underlying `voices_data` while preserving existing
steps where possible.

Browser playback uses `js/src/ts/scheduler.ts` as a DOM-free lookahead
scheduler. A timer runs every 25 ms and schedules notes up to 100 ms ahead using
`AudioContext.currentTime`. Each active step plays a simple sine oscillator
through either the session mixer channel or a standalone audio context.
`current_step` is updated locally for visual highlighting without saving every
tick.

The scheduler owns timing helpers for step advancement, voice iteration,
oscillator scheduling, duration ticks, swing/groove offsets, per-step
`probability`, and step-quantized `automation_lanes`. `swing` is a 0-100 percent
delay applied to odd steps. `groove` is a repeating list of -50 to 50 percent
step-duration offsets. Automation lanes are dictionaries of `{trait, points}`,
where each point has `{step, value}`; scheduled steps update numeric traits with
`model.set()` only, avoiding comm traffic on every tick.

The UI includes play, stop, record, BPM, step duration, measure count, loop, a
header row, step rows, and velocity rows. Clicking a cell toggles active state.
Mouse wheel over a step changes note. Mouse wheel over a velocity cell changes
velocity. If a keyboard is connected, double-clicking a cell waits for the next
`nbplay-note` event and writes that note into the cell. Recording arms all voices
or individual voice dots and writes live note-on events into the current step
while playing.

Important extension points are the grid reconciliation helpers, scheduler helper
functions, and the CustomEvent note input path. If you change timing semantics,
update Python `_step_duration_for_length()`, frontend `configuredStepCount()`,
tests for explicit lengths, scheduler behavior tests, and session transport sync
tests.

### SamplerWidget

Python class: `SamplerWidget`. Browser file: `js/src/ts/sampler.ts`. CSS file:
`js/src/css/sampler.css`.

SamplerWidget displays sample metadata, waveform bytes, ADSR controls, max
voices, pad count, and per-pad MIDI notes/velocities/actions. Raw mono PCM is
stored in `sample_data`; the decimated canvas preview is stored in `waveform`.
Python `load_sample()` populates both traits. `load_audio_file()` loads WAV via
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
trait on the current widget, and `{"type": "event"}` actions update
`last_pad_event`. This keeps pad input source-agnostic for future browser MIDI
controller discovery, MIDI learn, and automation control.

When the sampler has a session and channel index, it registers `triggerNote()`
and `releaseNote()` on the session bus so keyboard widgets, MIDI keyboard input,
sequencers, and PadWidget routes can drive the same sampler/slice map by note.

### TransportWidget

Python class: `TransportWidget`. Browser file: `js/src/ts/transport.ts`. CSS
file: `js/src/css/transport.css`.

TransportWidget is the global play/stop and tempo surface. It syncs BPM, play
state, time signature, bar/beat position, and loop range. In a `Session`, tracks
link their sequencers to transport BPM and time signature, and dlink transport
play state into sequencers.

The browser UI has stop/play buttons, a BPM slider and inline edit, a time
signature display, a bar:beat display, and a loop toggle/range. Its position
clock uses `performance.now()` and a 50 ms interval to compute elapsed beats.
When the displayed bar or beat changes, it updates and saves `bar_number` and
`beat_in_bar`. Looping wraps the displayed position between `loop_start_bar` and
`loop_end_bar` when enabled.

### TimelineWidget

Python class: `TimelineWidget`. Browser file: `js/src/ts/timeline.ts`. CSS
file: `js/src/css/timeline.css`.

TimelineWidget is the multitrack clip lane and browser recorder. Python owns
validated `TimelineTrack` and `AudioClip` metadata dictionaries. Browser code
renders track rows, arm/input-monitor/mute/solo controls, clip blocks,
play/stop, record/stop, count-in, recording auto-extension, playhead reset,
playhead seek/drag, timeline length, and selected-clip deletion. In a `Session`, transport BPM, time
signature, play/record state, and `current_beat` are linked with the timeline so
either surface can control global playback and seek position.

Recording uses `navigator.mediaDevices.getUserMedia({ audio: true })` and
`MediaRecorder` when the browser exposes them. A completed take creates a
browser-local object URL and appends clip metadata to `clips`; the binary audio
blob is not persisted through traitlets. Playback uses an `HTMLAudioElement` and
connects it through `globalThis.__nbplay[sessionId].channels[channel_index].gain`
when the mixer bus is available, falling back to direct media playback when it
is not.

Count-in is stored as `count_in_bars` and displayed through
`recording_countdown_beats`. If the chosen record point has enough timeline
space before it, recording pre-rolls from `current_beat - count_in_bars`; at
beat 0, capture starts after the count-in and the recorded clip begins at 0.
When `auto_extend_recording` is true, the browser extends `length` by
`recording_extend_bars` whenever recording approaches the timeline end. Normal
playback still stops at the end; recording stops only when the user stops it or
the timeline reaches the validated maximum length.

### KeyboardWidget

Python class: `KeyboardWidget`. Browser file: `js/src/ts/keyboard.ts`. CSS
file: `js/src/css/keyboard.css`.

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

Python class: `MidiKeyboardWidget`. Browser file: `js/src/ts/midi_keyboard.ts`.
CSS file: `js/src/css/midi_keyboard.css`.

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

### PadWidget

Python class: `PadWidget`. Browser file: `js/src/ts/pad.ts`.
CSS file: `js/src/css/pad.css`.

PadWidget renders an on-screen trigger grid with per-pad MIDI notes, velocities,
and shared `pad_actions`. It uses the same `sampler_routing` and `KeyboardRoute`
model as KeyboardWidget, but rejects upper/lower zone routes because pads have no
keyboard halves. Pad routes can target all pads, an octave, one note, or a note
list. When no sampler route matches, note pads use the browser fallback
oscillator. Trait/event pads update `last_pad_event` without producing a note.

Python helpers `configure_grid_for_actions()`, `set_base_note()`, and
`transpose_pads()` provide global note/action setup for sampler slicing and
future external controller layouts.

## Styling system

The visual conventions are described in `DESIGN.md`. Implementation lives in
`js/src/css/` with one stylesheet per widget plus `index.css`. CSS rules are
scoped under widget root classes such as `.nbplay-synth`, `.nbplay-mixer`, and
`.nbplay-midi-keyboard` to avoid leaking into the notebook.

Colors should come from JupyterLab CSS custom properties, usually `--jp-*`, with
fallbacks. CSS uses `var(--jp-*, fallback)`. Canvas drawing reads theme values
at runtime through `cssVar()`. Semi-transparent colors should use `color-mix()`
instead of hard-coded `rgba()` values when editing CSS.

The JS build runs `bundle_css("src/css")`, writes bundled CSS into
`js/dist/css/`, and copies per-widget CSS files into `nbplay/static/` for the
Python package.

## Build pipeline

Top-level commands are in `Makefile`.

```bash
make develop       # Rust tools, JS deps/browser install, Python editable install
make build         # Rust core/native build, JS WASM/widgets, Python wheel build
make test          # Python, Playwright, and Rust tests
make coverage      # Coverage variants of the test suites
make lint          # Rust clippy/fmt, JS prettier, Python ruff, README docs checks
make fix           # Format/fix Rust, JS, Python, and README docs
make test-notebooks # Notebook regression tests only
make dist          # Full distribution build and checks
```

The JavaScript build in `js/package.json` is ordered as:

1. `pnpm build:rust`: compile the WASM crate for `wasm32-unknown-unknown`.
2. `pnpm build:wasm-bindgen`: generate JS glue and `.wasm` under
   `js/dist/pkg/`.
3. `pnpm build:prod`: run `js/build.mjs`, which bundles TypeScript entries,
   processes CSS, copies extension assets, and copies widget JS/CSS into
   `nbplay/static/`.

The Python build uses Hatch hooks:

- hatch-js runs the JavaScript build from `js/` and expects
  `nbplay/extension/cdn/index.js`.
- hatch-rs builds the PyO3 extension from the root Cargo package.
- `nbplay/static` and `nbplay/extension` are declared build artifacts so wheels
  include generated assets even though they are ignored in Git.

## Testing strategy

### Python tests

`nbplay/tests/test_all.py` covers Rust/PyO3 types, Python widget classes,
session behavior, and example notebooks. Tests check construction, defaults,
validation, repr/equality, oscillator output, mixer mixdown, sampler rendering,
sequencer conversion, widget trait defaults, `Session.add_track()`, keyboard and
sampler connections, MIDI keyboard traits, and notebook metadata/execution.

Run:

```bash
python -m pytest -v nbplay/tests
python -m pytest -v nbplay/tests/test_all.py -k "TestDemoNotebook"
```

### JavaScript tests

Playwright tests live in `js/tests/`. The harness at
`js/tests/fixtures/harness.html` provides a mock `AudioContext` and
`createMockModel()` implementation with `get`, `set`, `save_changes`, `on`, and
manual trigger helpers. Tests cover DOM rendering, synced model state, user
interactions, inline editing, keyboard capture, MIDI input, scheduler state, and
session integration.

Run:

```bash
cd js
pnpm test
```

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
22. It installs Rust, Node, and Python dependencies, installs Linux ALSA headers,
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
2. Re-export the type from `rust/src/lib.rs` if it should be public.
3. Add a PyO3 wrapper in `rust/python/<module>.rs` using the existing `Py*`
   naming pattern.
4. Register the class in `rust/python/lib.rs` with `m.add_class::<...>()?`.
5. Re-export it from `nbplay/__init__.py`.
6. Add Python tests in `nbplay/tests/test_all.py` for construction, validation,
   repr/equality, and behavior.
7. Run `make build-rs`, `make build-py`, and focused tests.

### Add a Rust feature exposed to the browser

1. Implement reusable logic in `rust/src/` when possible.
2. Add wasm-bindgen wrappers in `js/src/rust/`.
3. Re-export from `js/src/rust/lib.rs` and `js/src/ts/index.ts` if the binding
   should be public to JS consumers.
4. Ensure required `web-sys` features are listed in `js/Cargo.toml`.
5. Rebuild with `cd js && pnpm build` and add Playwright coverage if a widget
   uses the new binding.

### Add a new widget

1. Add a Python class in `nbplay/widget.py` extending `anywidget.AnyWidget`.
2. Give it `_esm = _STATIC / "<name>.js"` and `_css = _STATIC / "<name>.css"`.
3. Define synced traits with `.tag(sync=True)` and keep defaults valid.
4. Create `js/src/ts/<name>.ts` exporting `default { render }`.
5. Create `js/src/css/<name>.css` scoped under a unique `.nbplay-*` root class.
6. Add `<name>` to `WIDGET_NAMES` in `js/build.mjs`.
7. Re-export the widget from `nbplay/__init__.py`.
8. Add Python widget tests and Playwright tests.
9. Add or update an example notebook when the widget is user-facing.
10. Run `cd js && pnpm build`, then focused Python and JS tests.

### Modify an existing widget trait

1. Update the Python trait default and validation/coercion logic.
2. Update the TypeScript model reads, writes, and `change:<trait>` listeners.
3. Update CSS if the trait changes layout or visible state.
4. Update `nbplay/static` by rebuilding JS before testing Python rendering from
   source.
5. Add Python tests for the trait default/API and Playwright tests for browser
   interaction.
6. Update examples and this guide when the feature changes developer workflow.

### Modify audio routing

1. Check whether the feature should use a standalone `AudioContext` fallback, a
   session mixer bus, or both.
2. Preserve render-order tolerance. If a widget depends on the mixer bus, listen
   for `nbplay-bus-ready` or retry registration when `session_id` changes.
3. Clean up every node, timer, event listener, and bus entry in the render
   cleanup function.
4. Avoid creating multiple owned `AudioContext` instances when routing through a
   session bus.
5. Add integration tests under `js/tests/integration.spec.js` when multiple
   widgets are involved.

### Modify keyboard or MIDI behavior

1. Keep `last_note_event` shape as `{ note, velocity, type }` unless every
   consumer is updated.
2. Preserve `nbplay-note` CustomEvent dispatch for sequencer recording.
3. Preserve sampler routing semantics: `all`, `upper`, and `lower` zones.
4. MIDI note-on with velocity zero should remain equivalent to note-off.
5. Add tests for active notes, velocity, note-off, sampler routing, and event
   dispatch.

## Common pitfalls and invariants

- Do not call `save_changes()` during initial render resets. It can race with
  Session trait links while multiple widgets are being initialized.
- Always return a cleanup function from a widget renderer. Stop audio, clear
  intervals, remove global event listeners, disconnect MIDI ports, and unregister
  session bus entries.
- Treat `nbplay/static/` and `nbplay/extension/` as generated outputs. Rebuild
  them when testing widget rendering, but do not hand-edit them.
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
