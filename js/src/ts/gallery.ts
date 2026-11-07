// Component gallery: every primitive on its own, with live property controls
// and an event log. Served from dist/gallery.html; no widget backend involved.

import "./components/index.ts";

type Control =
  | { name: string; type: "number"; step?: number }
  | { name: string; type: "boolean" }
  | { name: string; type: "text" }
  | { name: string; type: "select"; options: string[] };

interface Variant {
  label: string;
  props: Record<string, unknown>;
  wide?: boolean;
}

interface Section {
  tag: string;
  title: string;
  desc: string;
  events: string[];
  controls: Control[];
  variants: Variant[];
  animate?: (el: HTMLElement) => void;
}

function sineBurst(n = 1024): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    out[i] = Math.sin(t * Math.PI * 24) * Math.exp(-t * 3) * 0.9;
  }
  return out;
}

const SECTIONS: Section[] = [
  {
    tag: "nbplay-slider",
    title: "nbplay-slider",
    desc: "Range control over a native input. Log scale for frequencies; writes are ignored while dragging.",
    events: ["input", "change"],
    controls: [
      { name: "value", type: "number", step: 0.01 },
      { name: "min", type: "number" },
      { name: "max", type: "number" },
      { name: "step", type: "number", step: 0.001 },
      {
        name: "orientation",
        type: "select",
        options: ["horizontal", "vertical"],
      },
      { name: "scale", type: "select", options: ["linear", "log"] },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      { label: "gain 0–2", props: { value: 0.8, min: 0, max: 2, step: 0.01 } },
      {
        label: "fader",
        props: {
          value: 0.8,
          min: 0,
          max: 2,
          step: 0.01,
          orientation: "vertical",
        },
      },
      {
        label: "log 20–8k Hz",
        props: { value: 440, min: 20, max: 8000, step: 0.1, scale: "log" },
      },
      { label: "disabled", props: { value: 0.5, disabled: true } },
    ],
  },
  {
    tag: "nbplay-dial",
    title: "nbplay-dial",
    desc: "Rotary control. Drag vertically (Shift for fine), scroll, or use arrow, Page, Home and End keys.",
    events: ["input", "change"],
    controls: [
      { name: "value", type: "number", step: 0.01 },
      { name: "min", type: "number" },
      { name: "max", type: "number" },
      { name: "step", type: "number", step: 0.001 },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      { label: "0–1", props: { value: 0.35 } },
      {
        label: "attack 0–2 s",
        props: { value: 0.25, min: 0, max: 2, step: 0.001 },
      },
      { label: "disabled", props: { value: 0.6, disabled: true } },
    ],
  },
  {
    tag: "nbplay-value",
    title: "nbplay-value",
    desc: "Formatted readout; double-click to edit. Presets carry the widget formatters and parsers.",
    events: ["change"],
    controls: [
      { name: "value", type: "number", step: 0.01 },
      {
        name: "kind",
        type: "select",
        options: [
          "int",
          "float",
          "db",
          "pan",
          "hz",
          "bpm",
          "seconds",
          "percent",
          "note",
        ],
      },
      { name: "min", type: "number" },
      { name: "max", type: "number" },
      { name: "precision", type: "number" },
      { name: "unit", type: "text" },
      { name: "editable", type: "boolean" },
    ],
    variants: [
      { label: "db", props: { value: 0.8, kind: "db", min: 0, max: 2 } },
      { label: "pan", props: { value: -0.25, kind: "pan", min: -1, max: 1 } },
      { label: "hz", props: { value: 1234.5, kind: "hz", min: 20, max: 8000 } },
      { label: "bpm", props: { value: 120, kind: "bpm", min: 30, max: 300 } },
      {
        label: "seconds",
        props: { value: 0.005, kind: "seconds", min: 0, max: 5 },
      },
      {
        label: "percent",
        props: { value: 0.8, kind: "percent", min: 0, max: 1 },
      },
      { label: "note", props: { value: 60, kind: "note", min: 0, max: 127 } },
      {
        label: "read-only",
        props: { value: 44100, kind: "int", unit: " Hz", editable: false },
      },
    ],
  },
  {
    tag: "nbplay-toggle",
    title: "nbplay-toggle",
    desc: "Latching button. The variant picks the active color.",
    events: ["change"],
    controls: [
      { name: "active", type: "boolean" },
      {
        name: "variant",
        type: "select",
        options: [
          "default",
          "mute",
          "solo",
          "arm",
          "monitor",
          "record",
          "play",
          "loop",
        ],
      },
      { name: "label", type: "text" },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      { label: "mute", props: { label: "M", variant: "mute", active: true } },
      { label: "solo", props: { label: "S", variant: "solo", active: true } },
      { label: "arm", props: { label: "R", variant: "arm", active: true } },
      {
        label: "monitor",
        props: { label: "I", variant: "monitor", active: true },
      },
      {
        label: "record",
        props: { label: "●", variant: "record", active: true },
      },
      { label: "play", props: { label: "▶", variant: "play", active: true } },
      { label: "loop", props: { label: "↻", variant: "loop", active: true } },
      { label: "off", props: { label: "M", variant: "mute" } },
    ],
  },
  {
    tag: "nbplay-meter",
    title: "nbplay-meter",
    desc: "Level meter driven by a property. The first instance is animated by the gallery.",
    events: [],
    controls: [
      { name: "level", type: "number", step: 0.01 },
      { name: "rms", type: "number", step: 0.01 },
      {
        name: "orientation",
        type: "select",
        options: ["vertical", "horizontal"],
      },
      { name: "floorDb", type: "number" },
    ],
    variants: [
      { label: "animated", props: { level: 0.5 } },
      { label: "-6 dB", props: { level: 0.5, rms: 0.35 } },
      { label: "hot", props: { level: 1 } },
      { label: "horizontal", props: { level: 0.7, orientation: "horizontal" } },
    ],
    animate: (el) => {
      let t = 0;
      const tick = () => {
        t += 0.05;
        const level =
          0.55 + 0.45 * Math.abs(Math.sin(t)) * Math.abs(Math.sin(t * 0.21));
        (el as unknown as { level: number; rms: number }).level = level;
        (el as unknown as { level: number; rms: number }).rms = level * 0.7;
        requestAnimationFrame(tick);
      };
      tick();
    },
  },
  {
    tag: "nbplay-bar",
    title: "nbplay-bar",
    desc: "Value bar. Set editable to wheel, drag, or both.",
    events: ["input", "change"],
    controls: [
      { name: "value", type: "number" },
      { name: "min", type: "number" },
      { name: "max", type: "number" },
      {
        name: "orientation",
        type: "select",
        options: ["vertical", "horizontal"],
      },
      {
        name: "editable",
        type: "select",
        options: ["", "wheel", "drag", "wheel drag"],
      },
      { name: "wheelStep", type: "number" },
    ],
    variants: [
      {
        label: "velocity, drag+wheel",
        props: { value: 100, editable: "wheel drag", wheelStep: 5 },
      },
      { label: "wheel only", props: { value: 64, editable: "wheel" } },
      { label: "display", props: { value: 32 } },
      {
        label: "progress",
        props: { value: 0.6, max: 1, step: 0.01, orientation: "horizontal" },
      },
    ],
  },
  {
    tag: "nbplay-position",
    title: "nbplay-position",
    desc: "Bar and beat readout. The first instance is animated by the gallery.",
    events: [],
    controls: [
      { name: "beat", type: "number", step: 0.25 },
      { name: "beatsPerBar", type: "number" },
      { name: "format", type: "select", options: ["bar:beat", "bar.beat"] },
      { name: "pad", type: "number" },
    ],
    variants: [
      { label: "transport", props: { beat: 0 } },
      { label: "timeline", props: { beat: 13, format: "bar.beat" } },
      { label: "6/8", props: { beat: 17, beatsPerBar: 6 } },
    ],
    animate: (el) => {
      const start = performance.now();
      const tick = () => {
        (el as unknown as { beat: number }).beat =
          ((performance.now() - start) / 500) % 64;
        requestAnimationFrame(tick);
      };
      tick();
    },
  },
  {
    tag: "nbplay-waveform",
    title: "nbplay-waveform",
    desc: "Canvas waveform from Float32Array or little-endian f32 bytes.",
    events: [],
    controls: [
      { name: "variant", type: "select", options: ["line", "glow"] },
      { name: "emptyText", type: "text" },
    ],
    variants: [
      { label: "line", props: { data: sineBurst() }, wide: true },
      {
        label: "glow",
        props: { data: sineBurst(256), variant: "glow" },
        wide: true,
      },
      { label: "empty", props: { data: null }, wide: true },
    ],
  },
  {
    tag: "nbplay-envelope",
    title: "nbplay-envelope",
    desc: "ADSR shape. Times in seconds, sustain 0–1.",
    events: [],
    controls: [
      { name: "attack", type: "number", step: 0.001 },
      { name: "decay", type: "number", step: 0.001 },
      { name: "sustain", type: "number", step: 0.01 },
      { name: "release", type: "number", step: 0.001 },
    ],
    variants: [
      { label: "default", props: {} },
      {
        label: "pad",
        props: { attack: 0.8, decay: 0.4, sustain: 0.6, release: 1.2 },
      },
      {
        label: "pluck",
        props: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.05 },
      },
    ],
  },
  {
    tag: "nbplay-param",
    title: "nbplay-param",
    desc: "Label, slider or dial, and an editable readout kept in sync. A tempo control is a param with kind=bpm.",
    events: ["input", "change"],
    controls: [
      { name: "label", type: "text" },
      { name: "value", type: "number", step: 0.01 },
      { name: "min", type: "number" },
      { name: "max", type: "number" },
      { name: "step", type: "number", step: 0.001 },
      {
        name: "kind",
        type: "select",
        options: [
          "int",
          "float",
          "db",
          "pan",
          "hz",
          "bpm",
          "seconds",
          "percent",
          "note",
        ],
      },
      { name: "scale", type: "select", options: ["linear", "log"] },
      { name: "control", type: "select", options: ["slider", "dial"] },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      {
        label: "tempo",
        props: {
          label: "BPM",
          value: 120,
          min: 30,
          max: 300,
          step: 1,
          kind: "bpm",
        },
      },
      {
        label: "frequency (log)",
        props: {
          label: "Freq",
          value: 440,
          min: 20,
          max: 8000,
          step: 0.1,
          kind: "hz",
          scale: "log",
        },
      },
      {
        label: "attack dial",
        props: {
          label: "Attack",
          value: 0.25,
          min: 0,
          max: 2,
          step: 0.001,
          kind: "seconds",
          control: "dial",
        },
      },
      {
        label: "sustain dial",
        props: {
          label: "Sustain",
          value: 0.8,
          min: 0,
          max: 1,
          step: 0.01,
          kind: "percent",
          control: "dial",
        },
      },
    ],
  },
  {
    tag: "nbplay-transport-buttons",
    title: "nbplay-transport-buttons",
    desc: "Stop, play/pause, record. The host owns the state and answers the events.",
    events: ["nbplay-stop", "nbplay-play", "nbplay-record"],
    controls: [
      { name: "playing", type: "boolean" },
      { name: "recording", type: "boolean" },
      { name: "showRecord", type: "boolean" },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      { label: "stopped", props: {} },
      { label: "playing", props: { playing: true } },
      { label: "recording", props: { playing: true, recording: true } },
      { label: "no record", props: { showRecord: false } },
    ],
  },
  {
    tag: "nbplay-fader",
    title: "nbplay-fader",
    desc: "Meter, vertical gain slider (linear 0–2) and a dB readout. The first instance is animated by the gallery.",
    events: ["input", "change"],
    controls: [
      { name: "label", type: "text" },
      { name: "value", type: "number", step: 0.01 },
      { name: "level", type: "number", step: 0.01 },
      { name: "rms", type: "number", step: 0.01 },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      { label: "channel", props: { label: "Kick", value: 0.8 } },
      {
        label: "unity",
        props: { label: "Master", value: 1, level: 0.9, rms: 0.6 },
      },
      { label: "muted", props: { label: "Bass", value: 0, level: 0 } },
    ],
    animate: (el) => {
      let t = 0;
      const tick = () => {
        t += 0.06;
        const level =
          0.5 + 0.5 * Math.abs(Math.sin(t)) * Math.abs(Math.sin(t * 0.17));
        (el as unknown as { level: number; rms: number }).level = level;
        (el as unknown as { level: number; rms: number }).rms = level * 0.7;
        requestAnimationFrame(tick);
      };
      tick();
    },
  },
  {
    tag: "nbplay-key-rows",
    title: "nbplay-key-rows",
    desc: "Playable keys: the four-row musical-typing layout with two octave zones, or a piano.",
    events: ["nbplay-note-on", "nbplay-note-off"],
    controls: [
      { name: "layout", type: "select", options: ["rows", "piano"] },
      { name: "upperOctave", type: "number" },
      { name: "lowerOctave", type: "number" },
      { name: "startOctave", type: "number" },
      { name: "octaves", type: "number" },
      { name: "velocity", type: "number" },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      { label: "rows", props: { pressed: [60, 64, 67] }, wide: true },
      {
        label: "piano",
        props: {
          layout: "piano",
          startOctave: 3,
          octaves: 2,
          pressed: [60, 64, 67],
        },
        wide: true,
      },
    ],
  },
  {
    tag: "nbplay-pad-grid",
    title: "nbplay-pad-grid",
    desc: "Trigger pads. Tap (bottom is louder), drag vertically for velocity, wheel for note, Shift+wheel for velocity, double-click the label to edit.",
    events: ["nbplay-note-on", "nbplay-note-off", "input", "change"],
    controls: [
      { name: "rows", type: "number" },
      { name: "cols", type: "number" },
      { name: "velocitySensitive", type: "boolean" },
      { name: "hold", type: "boolean" },
      { name: "editable", type: "boolean" },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      {
        label: "4×4",
        props: {
          rows: 4,
          cols: 4,
          pads: Array.from({ length: 16 }, (_, i) => ({
            note: 36 + i,
            velocity: 100,
          })),
          active: [5],
        },
      },
      {
        label: "2×4 hold, labels",
        props: {
          rows: 2,
          cols: 4,
          hold: true,
          pads: [
            { note: 36, velocity: 127, label: "KICK" },
            { note: 38, velocity: 110, label: "SNARE" },
            { note: 42, velocity: 80, label: "HAT" },
            { note: 46, velocity: 90, label: "OPEN" },
            { note: 48, velocity: 100 },
            { note: 50, velocity: 100 },
            { note: 52, velocity: 100 },
            { note: 55, velocity: 100 },
          ],
        },
      },
    ],
  },
  {
    tag: "nbplay-step-grid",
    title: "nbplay-step-grid",
    desc: "Beat grid: a step row and a velocity row per voice. Click toggles, wheel moves the note, Shift-free wheel on the bars sets velocity. The first instance is animated.",
    events: ["change", "nbplay-arm", "nbplay-step-pick"],
    controls: [
      { name: "currentStep", type: "number" },
      { name: "showArm", type: "boolean" },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      {
        label: "2 voices, 16 steps",
        props: {
          showArm: true,
          armed: [1],
          cursor: { voice: 0, step: 3 },
          pending: { voice: 1, step: 7 },
          voices: [
            Array.from({ length: 16 }, (_, i) => ({
              active: i % 4 === 0,
              note: 36,
              velocity: i % 8 === 0 ? 127 : 90,
            })),
            Array.from({ length: 16 }, (_, i) => ({
              active: i % 4 === 2,
              note: 38,
              velocity: 100,
              probability: 0.75,
            })),
          ],
        },
        wide: true,
      },
      {
        label: "1 voice, 8 steps",
        props: {
          voices: [
            Array.from({ length: 8 }, (_, i) => ({
              active: i % 2 === 0,
              note: 60 + (i % 5) * 2,
              velocity: 80 + i * 5,
            })),
          ],
        },
        wide: true,
      },
    ],
    animate: (el) => {
      let step = 0;
      setInterval(() => {
        step = (step + 1) % 16;
        (el as unknown as { currentStep: number }).currentStep = step;
      }, 250);
    },
  },
  {
    tag: "nbplay-segmented",
    title: "nbplay-segmented",
    desc: "One-of-N button group: oscillator type, launch quantize, step resolution.",
    events: ["change"],
    controls: [
      { name: "value", type: "text" },
      { name: "label", type: "text" },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      {
        label: "oscillator",
        props: {
          label: "OSC",
          options: ["sine", "square", "saw", "noise"],
          value: "sine",
        },
      },
      {
        label: "quantize",
        props: {
          options: [
            { value: "bar", label: "Bar" },
            { value: "beat", label: "Beat" },
            { value: "none", label: "Off" },
          ],
          value: "bar",
        },
      },
      {
        label: "resolution",
        props: {
          options: ["1/4", "1/8", "1/16", "1/32"],
          value: "1/16",
        },
      },
    ],
  },
  {
    tag: "nbplay-header",
    title: "nbplay-header",
    desc: "Shared widget header: title, badge, status, and any children as actions.",
    events: [],
    controls: [
      { name: "title", type: "text" },
      { name: "badge", type: "text" },
      { name: "status", type: "text" },
    ],
    variants: [
      { label: "sequencer", props: { badge: "sequencer" }, wide: true },
      {
        label: "with status",
        props: { badge: "timeline", status: "2 tracks \u00b7 16 bars" },
        wide: true,
      },
    ],
  },
  {
    tag: "nbplay-effect-editor",
    title: "nbplay-effect-editor",
    desc: "Parameter rows from the effect spec table: sliders for bounded numbers, selects, checkboxes, text.",
    events: ["change"],
    controls: [{ name: "disabled", type: "boolean" }],
    variants: [
      {
        label: "filter",
        props: {
          effect: {
            type: "filter",
            filter_type: "lowpass",
            frequency: 1200,
            q: 0.7,
          },
        },
        wide: true,
      },
      {
        label: "compressor",
        props: {
          effect: {
            type: "compressor",
            threshold: -24,
            knee: 30,
            ratio: 4,
            attack: 0.003,
            release: 0.25,
          },
        },
        wide: true,
      },
      {
        label: "plugin (inferred)",
        props: {
          effect: { type: "bitcrush", bits: 8, dither: true, mode: "soft" },
        },
        wide: true,
      },
    ],
  },
  {
    tag: "nbplay-effect-rack",
    title: "nbplay-effect-rack",
    desc: "Insert chain: add row, chips (click bypasses, \u270e edits inline, \u00d7 removes).",
    events: ["change", "nbplay-effect-add", "nbplay-effect-remove"],
    controls: [
      { name: "editing", type: "number" },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      {
        label: "three inserts",
        props: {
          effects: [
            { type: "filter", filter_type: "highpass", frequency: 120, q: 0.7 },
            {
              type: "compressor",
              threshold: -18,
              knee: 20,
              ratio: 3,
              attack: 0.01,
              release: 0.2,
            },
            {
              type: "reverb",
              seconds: 1.5,
              decay: 2,
              wet: 0.25,
              enabled: false,
            },
          ],
        },
      },
      { label: "empty", props: {} },
    ],
  },
  {
    tag: "nbplay-strip",
    title: "nbplay-strip",
    desc: "Mixer strip. kind=channel adds pan, mute/solo and sends; return and master drop them.",
    events: [
      "input",
      "change",
      "nbplay-remove",
      "nbplay-effect-add",
      "nbplay-effect-remove",
    ],
    controls: [
      { name: "name", type: "text" },
      { name: "gain", type: "number", step: 0.01 },
      { name: "pan", type: "number", step: 0.01 },
      { name: "mute", type: "boolean" },
      { name: "solo", type: "boolean" },
      { name: "level", type: "number", step: 0.01 },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      {
        label: "channel",
        props: {
          name: "Drums",
          gain: 0.9,
          pan: -0.2,
          sends: [0.3, 0],
          sendNames: ["Rev", "Dly"],
          effects: [
            {
              type: "compressor",
              threshold: -18,
              knee: 20,
              ratio: 3,
              attack: 0.01,
              release: 0.2,
            },
          ],
          level: 0.6,
        },
      },
      {
        label: "return",
        props: {
          kind: "return",
          name: "Rev",
          gain: 1,
          effects: [{ type: "reverb", seconds: 2, decay: 3, wet: 1 }],
          level: 0.3,
        },
      },
      {
        label: "master",
        props: {
          kind: "master",
          name: "Master",
          gain: 1,
          level: 0.8,
          rms: 0.5,
        },
      },
    ],
    animate: (el) => {
      let t = 0;
      setInterval(() => {
        t += 0.12;
        const strip = el as unknown as { level: number; rms: number };
        strip.level = 0.5 + 0.45 * Math.abs(Math.sin(t));
        strip.rms = strip.level * 0.6;
      }, 50);
    },
  },
  {
    tag: "nbplay-midi-port",
    title: "nbplay-midi-port",
    desc: "MIDI port picker: select, refresh, status pill. The host enumerates ports.",
    events: ["change", "nbplay-refresh"],
    controls: [
      { name: "value", type: "text" },
      {
        name: "status",
        type: "select",
        options: ["idle", "connected", "unsupported", "error"],
      },
      { name: "label", type: "text" },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      {
        label: "connected",
        props: {
          label: "Input",
          ports: [
            { id: "in-1", name: "Launchkey Mini" },
            { id: "in-2", name: "IAC Driver Bus 1" },
          ],
          value: "in-1",
          status: "connected",
        },
      },
      {
        label: "idle",
        props: { ports: [{ id: "in-1", name: "Launchkey Mini" }] },
      },
      { label: "unsupported", props: { status: "unsupported" } },
    ],
  },
  {
    tag: "nbplay-midi-log",
    title: "nbplay-midi-log",
    desc: "Last N MIDI messages, newest first. Feed raw bytes with push().",
    events: [],
    controls: [
      { name: "max", type: "number" },
      { name: "label", type: "text" },
    ],
    variants: [
      {
        label: "activity",
        props: {
          label: "Activity",
          entries: [
            [0x90, 60, 100],
            [0x80, 60, 0],
            [0xb0, 1, 64],
            [0xe0, 0, 64],
            [0xf8],
          ],
        },
        wide: true,
      },
      { label: "empty", props: { emptyText: "No messages" }, wide: true },
    ],
    animate: (el) => {
      const log = el as unknown as { push: (d: number[]) => void };
      let n = 0;
      setInterval(() => {
        const note = 48 + ((n * 7) % 24);
        log.push(n % 2 ? [0x80, note, 0] : [0x90, note, 60 + (n % 5) * 12]);
        n++;
      }, 900);
    },
  },
  {
    tag: "nbplay-launcher-slot",
    title: "nbplay-launcher-slot",
    desc: "One clip-launcher cell: name, progress fill, next/stop pill. Click launches.",
    events: ["nbplay-launch"],
    controls: [
      { name: "name", type: "text" },
      { name: "active", type: "boolean" },
      { name: "queued", type: "boolean" },
      { name: "selected", type: "boolean" },
      { name: "progress", type: "number", step: 0.01 },
    ],
    variants: [
      {
        label: "playing",
        props: { name: "Beat A", active: true, progress: 0.4 },
      },
      { label: "queued", props: { name: "Beat B", queued: true } },
      { label: "selected", props: { name: "Fill", selected: true } },
      { label: "empty", props: {} },
    ],
    animate: (el) => {
      let p = 0;
      setInterval(() => {
        p = (p + 0.02) % 1;
        (el as unknown as { progress: number }).progress = p;
      }, 80);
    },
  },
  {
    tag: "nbplay-launcher-grid",
    title: "nbplay-launcher-grid",
    desc: "Tracks \u00d7 scenes of launcher slots with scene launch, stop-all and per-track stop.",
    events: [
      "nbplay-launch",
      "nbplay-launch-scene",
      "nbplay-stop-track",
      "nbplay-stop-all",
    ],
    controls: [
      { name: "playing", type: "boolean" },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      {
        label: "2 tracks \u00d7 3 scenes",
        props: {
          tracks: [
            { name: "Drums", detail: "Ch 1" },
            { name: "Bass", detail: "Ch 2" },
          ],
          scenes: ["Intro", "Verse", "Drop"],
          slots: [
            { track: 0, scene: 0, name: "Kick" },
            { track: 0, scene: 1, name: "Full kit" },
            { track: 1, scene: 1, name: "Bass A" },
            { track: 1, scene: 2, name: "Bass B" },
          ],
          active: [1, 1],
          queued: [-1, 2],
          progress: [0.3, 0.3],
          selected: { track: 0, scene: 1 },
          playing: true,
        },
        wide: true,
      },
    ],
    animate: (el) => {
      let p = 0;
      setInterval(() => {
        p = (p + 0.02) % 1;
        (el as unknown as { progress: number[] }).progress = [p, p];
      }, 80);
    },
  },
  {
    tag: "nbplay-ruler",
    title: "nbplay-ruler",
    desc: "Bar ruler with loop brace (drag the handles, snapped to bars), playhead and a seek surface.",
    events: ["nbplay-seek", "input", "change"],
    controls: [
      { name: "length", type: "number" },
      { name: "beatsPerBar", type: "number" },
      { name: "beat", type: "number", step: 0.25 },
      { name: "loopStart", type: "number" },
      { name: "loopEnd", type: "number" },
      { name: "loopEnabled", type: "boolean" },
    ],
    variants: [
      {
        label: "8 bars, loop 2\u20134",
        props: {
          length: 32,
          beat: 5,
          loopStart: 4,
          loopEnd: 12,
          loopEnabled: true,
        },
        wide: true,
      },
    ],
    animate: (el) => {
      setInterval(() => {
        const r = el as unknown as { beat: number; length: number };
        r.beat = (r.beat + 0.05) % r.length;
      }, 50);
    },
  },
  {
    tag: "nbplay-clip",
    title: "nbplay-clip",
    desc: "A clip block: name, detail, trim handles. The lane positions it and owns the gestures.",
    events: [],
    controls: [
      { name: "name", type: "text" },
      { name: "detail", type: "text" },
      { name: "kind", type: "select", options: ["audio", "midi"] },
      { name: "pattern", type: "boolean" },
      { name: "selected", type: "boolean" },
      { name: "muted", type: "boolean" },
    ],
    variants: [
      {
        label: "audio",
        props: {
          name: "Vocal take 3",
          detail: "1.1",
          style: "position:relative;width:160px;height:44px",
        },
      },
      {
        label: "midi",
        props: {
          name: "Chords",
          detail: "5.1 \u00b7 12 notes",
          kind: "midi",
          style: "position:relative;width:160px;height:44px",
        },
      },
      {
        label: "pattern, selected",
        props: {
          name: "Beat A",
          detail: "9.1 \u00b7 pattern",
          pattern: true,
          selected: true,
          style: "position:relative;width:160px;height:44px",
        },
      },
    ],
  },
  {
    tag: "nbplay-lane",
    title: "nbplay-lane",
    desc: "A timeline track: header with arm/monitor/mute/solo and record source, clip lane with playhead. Drag clips to move, drag their edges to trim.",
    events: ["change", "input", "nbplay-seek", "nbplay-clip-select"],
    controls: [
      { name: "name", type: "text" },
      { name: "armed", type: "boolean" },
      { name: "muted", type: "boolean" },
      { name: "recording", type: "boolean" },
      { name: "beat", type: "number", step: 0.25 },
      { name: "selected", type: "text" },
    ],
    variants: [
      {
        label: "audio track",
        props: {
          name: "Vocals",
          armed: true,
          length: 32,
          beat: 6,
          selected: "c2",
          clips: [
            { id: "c1", name: "Take 1", start: 0, duration: 8 },
            { id: "c2", name: "Take 2", start: 10, duration: 6 },
            {
              id: "c3",
              name: "Chords",
              start: 20,
              duration: 8,
              kind: "midi",
              detail: "6.1 \u00b7 12 notes",
            },
          ],
        },
        wide: true,
      },
    ],
  },
  {
    tag: "nbplay-zone-map",
    title: "nbplay-zone-map",
    desc: "Key ranges over MIDI notes 0\u2013127 with octave ticks; spans use the categorical palette tokens.",
    events: ["nbplay-zone-select"],
    controls: [{ name: "selected", type: "number" }],
    variants: [
      {
        label: "three zones",
        props: {
          zones: [
            { name: "Kick", low: 36, high: 47 },
            { name: "Snare", low: 48, high: 59 },
            { name: "Keys", low: 60, high: 96 },
          ],
          selected: 1,
        },
        wide: true,
      },
      { label: "empty", props: {}, wide: true },
    ],
  },
  {
    tag: "nbplay-zone-list",
    title: "nbplay-zone-list",
    desc: "Sampler zone rows: swatch, name, low/high/root as editable note names, info, remove.",
    events: ["change", "nbplay-zone-remove", "nbplay-zone-select"],
    controls: [
      { name: "selected", type: "number" },
      { name: "disabled", type: "boolean" },
    ],
    variants: [
      {
        label: "three zones",
        props: {
          zones: [
            { name: "Kick", low: 36, high: 47, root: 36, info: "0.42 s" },
            { name: "Snare", low: 48, high: 59, root: 50, info: "0.31 s" },
            { name: "Keys", low: 60, high: 96, root: 72, info: "2.10 s" },
          ],
          selected: 1,
        },
        wide: true,
      },
    ],
  },
  {
    tag: "nbplay-transport",
    title: "nbplay-transport",
    desc: "The transport instrument on a private clock: play, stop, record, tempo, time signature, position and loop. Focus it for Space, Shift+Space, R, L and arrow shortcuts.",
    events: ["nbplay-set", "nbplay-status", "nbplay-request"],
    controls: [
      { name: "bpm", type: "number" },
      { name: "timeSignatureNum", type: "number" },
      { name: "timeSignatureDen", type: "number" },
      { name: "loopEnabled", type: "boolean" },
      { name: "loopStartBar", type: "number" },
      { name: "loopEndBar", type: "number" },
      { name: "isPlaying", type: "boolean" },
    ],
    variants: [{ label: "standalone", props: { bpm: 120 }, wide: true }],
  },
  {
    tag: "nbplay-pads",
    title: "nbplay-pads",
    desc: "The pad instrument on fallback sine voices: velocity control, velocity-sensitive switch, pad grid, info line. Tap pads, drag for velocity, scroll for note, double-click a label to rename.",
    events: ["nbplay-set", "nbplay-status"],
    controls: [
      { name: "rows", type: "number" },
      { name: "cols", type: "number" },
      { name: "velocity", type: "number" },
      { name: "velocitySensitive", type: "boolean" },
    ],
    variants: [
      {
        label: "4 × 4",
        props: {
          padVelocities: Array.from({ length: 16 }, (_, i) => 60 + i * 4),
          style: "width: 320px",
        },
        wide: true,
      },
    ],
  },
  {
    tag: "nbplay-synth",
    title: "nbplay-synth",
    desc: "The synth instrument: waveform preview, oscillator type, log frequency, amplitude, play/stop on a private AudioContext.",
    events: ["nbplay-set", "nbplay-status"],
    controls: [
      {
        name: "oscillatorType",
        type: "select",
        options: ["sine", "square", "saw", "noise"],
      },
      { name: "frequency", type: "number", step: 0.1 },
      { name: "amplitude", type: "number", step: 0.01 },
      { name: "sampleRate", type: "number" },
      { name: "isPlaying", type: "boolean" },
    ],
    variants: [
      {
        label: "sine 440",
        props: { waveform: sineBurst(512), amplitude: 0.5 },
        wide: true,
      },
    ],
  },
  {
    tag: "nbplay-keyboard",
    title: "nbplay-keyboard",
    desc: "The musical-typing instrument on fallback sine voices. Click it, then play Q–P / Z–. rows; [ ] and ; ' shift octaves, - = nudge velocity, ` / Space hold sustains.",
    events: ["nbplay-set", "nbplay-status"],
    controls: [
      { name: "upperOctave", type: "number" },
      { name: "lowerOctave", type: "number" },
      { name: "velocity", type: "number" },
      { name: "sustainGlobal", type: "boolean" },
    ],
    variants: [{ label: "default", props: {}, wide: true }],
  },
  {
    tag: "nbplay-midi-keyboard",
    title: "nbplay-midi-keyboard",
    desc: "Web MIDI note input: port picker, device-clock follow with measured tempo, last-event monitor. Needs a browser with Web MIDI and a device.",
    events: ["nbplay-set", "nbplay-status"],
    controls: [
      { name: "midiPort", type: "text" },
      { name: "syncClock", type: "boolean" },
      { name: "clockBpm", type: "number", step: 0.1 },
    ],
    variants: [{ label: "default", props: {}, wide: true }],
  },
  {
    tag: "nbplay-settings",
    title: "nbplay-settings",
    desc: "Audio output settings and a MIDI input picker with an activity log of incoming messages.",
    events: ["nbplay-set", "nbplay-status"],
    controls: [
      { name: "sampleRate", type: "number" },
      { name: "channels", type: "number" },
      { name: "bufferSize", type: "number" },
      { name: "audioDevice", type: "text" },
    ],
    variants: [
      { label: "default", props: { audioDevice: "USB Audio" }, wide: true },
    ],
  },
  {
    tag: "nbplay-midi-output",
    title: "nbplay-midi-output",
    desc: "Sends session notes and kernel requests to a Web MIDI output; can lead an external device with MIDI clock from the session clock.",
    events: ["nbplay-set", "nbplay-status"],
    controls: [
      { name: "channel", type: "number" },
      { name: "forwardNotes", type: "boolean" },
      { name: "sendClock", type: "boolean" },
    ],
    variants: [{ label: "default", props: {}, wide: true }],
  },
  {
    tag: "nbplay-sequencer",
    title: "nbplay-sequencer",
    desc: "The step sequencer on a private clock with a built-in oscillator: transport bar, resolution, bars, loop, step grid. Focus it for Space, arrows, Enter/X and Escape.",
    events: ["nbplay-set", "nbplay-status"],
    controls: [
      { name: "bpm", type: "number" },
      { name: "measures", type: "number" },
      { name: "stepDuration", type: "number", step: 0.125 },
      { name: "loopEnabled", type: "boolean" },
      { name: "keyboardConnected", type: "boolean" },
    ],
    variants: [
      {
        label: "two voices",
        props: {
          voicesData: [
            Array.from({ length: 16 }, (_, i) => ({
              active: i % 4 === 0,
              note: 36,
              velocity: 110,
            })),
            Array.from({ length: 16 }, (_, i) => ({
              active: i % 2 === 1,
              note: 42,
              velocity: 70 + (i % 4) * 10,
            })),
          ],
          numVoices: 2,
          length: 16,
          stepDuration: 0.25,
        },
        wide: true,
      },
    ],
  },
  {
    tag: "nbplay-launcher",
    title: "nbplay-launcher",
    desc: "The beats view on a private clock: tracks × scenes of step patterns, quantized launches, scene and stop controls. Focus it for Space, 1–9 and Escape.",
    events: ["nbplay-set", "nbplay-status"],
    controls: [
      { name: "quantize", type: "select", options: ["bar", "beat", "none"] },
      { name: "bpm", type: "number" },
    ],
    variants: [
      {
        label: "2 tracks × 2 scenes",
        props: {
          tracks: [
            { name: "Drums", channel_index: -1 },
            { name: "Bass", channel_index: -1 },
          ],
          scenes: ["Intro", "Drop"],
          slots: [
            {
              track_index: 0,
              scene_index: 0,
              name: "Kick",
              voices_data: [
                Array.from({ length: 8 }, (_, i) => ({
                  active: i % 2 === 0,
                  note: 36,
                  velocity: 100,
                })),
              ],
              step_duration: 0.5,
            },
            {
              track_index: 1,
              scene_index: 0,
              name: "Root",
              voices_data: [
                Array.from({ length: 8 }, () => ({
                  active: true,
                  note: 40,
                  velocity: 90,
                })),
              ],
              step_duration: 0.5,
            },
            {
              track_index: 0,
              scene_index: 1,
              name: "Snare",
              voices_data: [
                Array.from({ length: 8 }, (_, i) => ({
                  active: i % 4 === 2,
                  note: 38,
                  velocity: 110,
                })),
              ],
              step_duration: 0.5,
            },
          ],
          quantize: "beat",
        },
        wide: true,
      },
    ],
  },
  {
    tag: "nbplay-mixer",
    title: "nbplay-mixer",
    desc: "The mixer instrument: channel strips with pan, mute/solo, sends and insert effects, return buses and the master. Without a session id there is no audio graph, only the console.",
    events: ["nbplay-set"],
    controls: [{ name: "masterGain", type: "number", step: 0.01 }],
    variants: [
      {
        label: "two channels, one return",
        props: {
          channels: [
            {
              name: "Drums",
              gain: 0.9,
              pan: -0.2,
              mute: false,
              solo: false,
              sends: [0.3],
              effects: [
                {
                  type: "compressor",
                  threshold: -18,
                  knee: 20,
                  ratio: 3,
                  attack: 0.01,
                  release: 0.2,
                },
              ],
            },
            {
              name: "Bass",
              gain: 0.7,
              pan: 0.1,
              mute: false,
              solo: false,
              sends: [0],
              effects: [],
            },
          ],
          returns: [
            {
              name: "Rev",
              gain: 0.8,
              effects: [{ type: "reverb", seconds: 2, decay: 3, wet: 1 }],
            },
          ],
          masterGain: 0.85,
          masterEffects: [{ type: "limiter", threshold: -1, release: 0.05 }],
        },
        wide: true,
      },
    ],
  },
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function applyProps(target: HTMLElement, props: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(props)) {
    (target as unknown as Record<string, unknown>)[k] = v;
  }
}

function buildControls(target: HTMLElement, controls: Control[]): HTMLElement {
  const grid = el("div", "gallery-props");
  const subject = target as unknown as Record<string, unknown>;
  for (const c of controls) {
    grid.appendChild(el("label", undefined, c.name));
    let input: HTMLInputElement | HTMLSelectElement;
    if (c.type === "select") {
      input = el("select");
      for (const opt of c.options) {
        const o = el("option", undefined, opt || "(none)");
        o.value = opt;
        input.appendChild(o);
      }
      input.value = String(subject[c.name] ?? "");
    } else {
      input = el("input");
      if (c.type === "boolean") {
        input.type = "checkbox";
        input.checked = Boolean(subject[c.name]);
      } else if (c.type === "number") {
        input.type = "number";
        input.step = String(c.step ?? 1);
        input.value = String(subject[c.name] ?? "");
      } else {
        input.type = "text";
        input.value = String(subject[c.name] ?? "");
      }
    }
    input.name = c.name;
    input.addEventListener("input", () => {
      if (c.type === "boolean")
        subject[c.name] = (input as HTMLInputElement).checked;
      else if (c.type === "number") subject[c.name] = parseFloat(input.value);
      else subject[c.name] = input.value;
    });
    target.addEventListener("input", () => syncFrom(subject, c, input));
    target.addEventListener("change", () => syncFrom(subject, c, input));
    grid.appendChild(input);
  }
  return grid;
}

function syncFrom(
  subject: Record<string, unknown>,
  c: Control,
  input: HTMLInputElement | HTMLSelectElement,
): void {
  if (document.activeElement === input) return;
  if (c.type === "boolean")
    (input as HTMLInputElement).checked = Boolean(subject[c.name]);
  else input.value = String(subject[c.name] ?? "");
}

function buildSection(section: Section): HTMLElement {
  const root = el("section", "gallery-section");
  root.id = section.tag;
  root.appendChild(el("h2", undefined, `<${section.tag}>`));
  root.appendChild(el("p", "gallery-desc", section.desc));

  const stage = el("div", "gallery-stage");
  const log = el("div", "gallery-log");
  let first: HTMLElement | undefined;
  section.variants.forEach((variant, i) => {
    const wrap = el("div", "gallery-variant");
    if (variant.wide) wrap.dataset.wide = "";
    const instance = document.createElement(section.tag);
    instance.dataset.variant = variant.label;
    applyProps(instance, variant.props);
    wrap.appendChild(instance);
    wrap.appendChild(el("small", undefined, variant.label));
    stage.appendChild(wrap);
    if (i === 0) first = instance;
  });
  for (const name of section.events) {
    stage.addEventListener(name, (e) => {
      const target = e.target as HTMLElement;
      const raw = (e as CustomEvent).detail;
      // Primitives carry {value}; composites carry structured detail.
      const detail =
        raw && Object.keys(raw).length === 1 && "value" in raw
          ? raw.value
          : raw;
      const line = el(
        "div",
        undefined,
        `${target.dataset.variant ?? section.tag} ${name} ${JSON.stringify(detail)}`,
      );
      log.prepend(line);
      while (log.childElementCount > 40) log.lastElementChild?.remove();
    });
  }

  const side = el("div", "gallery-side");
  if (first) {
    side.appendChild(
      el("div", undefined, `props of "${section.variants[0].label}"`),
    );
    side.appendChild(buildControls(first, section.controls));
    if (section.animate) section.animate(first);
  }
  if (section.events.length) side.appendChild(log);

  root.appendChild(stage);
  root.appendChild(side);
  return root;
}

const THEMES = [
  "light",
  "dark",
  "studio",
  "flat",
  "cube",
  "one",
  "grim",
  "pro",
  "fruit",
];

function redrawCanvases(): void {
  for (const c of document.querySelectorAll(
    "nbplay-waveform, nbplay-envelope",
  )) {
    (c as unknown as { draw: () => void }).draw();
  }
}

function buildHeader(root: HTMLElement): HTMLElement {
  const header = el("div", "gallery-header");
  header.appendChild(el("h1", undefined, "nbplay components"));
  header.appendChild(el("p", undefined, "UI primitives, standalone"));

  const label = el("label", "gallery-header-controls", "theme");
  const select = el("select", "gallery-theme");
  select.dataset.testid = "theme";
  for (const name of THEMES) {
    const o = el("option", undefined, name);
    o.value = name;
    select.appendChild(o);
  }
  select.value = root.dataset.nbplayTheme ?? "light";
  select.addEventListener("change", () => {
    root.dataset.nbplayTheme = select.value;
    try {
      localStorage.setItem("nbplay.theme", select.value);
    } catch {
      /* storage unavailable */
    }
    redrawCanvases();
  });
  label.appendChild(select);
  header.appendChild(label);
  return header;
}

function initialTheme(root: HTMLElement): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem("nbplay.theme");
  } catch {
    /* storage unavailable */
  }
  root.dataset.nbplayTheme =
    saved && THEMES.includes(saved)
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

const root = document.getElementById("gallery");
if (root) {
  initialTheme(root);
  root.appendChild(buildHeader(root));
  const nav = el("nav", "gallery-nav");
  for (const s of SECTIONS) {
    const a = el("a", undefined, s.tag);
    a.href = `#${s.tag}`;
    nav.appendChild(a);
  }
  root.appendChild(nav);
  for (const s of SECTIONS) root.appendChild(buildSection(s));
}
