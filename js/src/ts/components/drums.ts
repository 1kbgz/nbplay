import { html, nothing, type PropertyValues } from "lit";
import { toFloat32, type AnyModel } from "../helpers.ts";
import { createAudioScheduler, type StepData } from "../scheduler.ts";
import {
  bindElementClock,
  getSessionBus,
  type ClockBinding,
  type ClockEvent,
  type InstrumentBus,
  type SessionBus,
  type SessionClock,
} from "../session.ts";
import {
  DRUM_SOUNDS,
  SYNTH_DEFAULTS,
  scheduleDrumHit,
  scheduleFmNote,
  scheduleSynthNote,
  startSampleVoice,
  type FmPatch,
  type SynthPatch,
} from "../voices.ts";
import { NbplayElement, define } from "./base.ts";
import type { PadSpec } from "./pad-grid.ts";
import { presetRequest, presetSelect } from "./preset-select.ts";
import { decodeToMono, float32ToDataView } from "../sampler_engine.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./drum-grid.ts";
import "./header.ts";
import "./pad-grid.ts";
import "./param.ts";
import "./segmented.ts";

/** One pad: see `DrumMachineConfig` in Python. */
export interface DrumPad {
  name: string;
  note: number;
  sound: string;
  gain: number;
  pan: number;
  choke: number;
  params: Record<string, unknown>;
}

/** A sample a pad plays: mono float32 `data`. */
export interface DrumSample {
  name: string;
  sample_rate: number;
  length?: number;
  data: unknown;
}

const SOUNDS = [...DRUM_SOUNDS, "synth", "fm", "sample", "track"].map(
  (value) => ({
    value,
    label: value === "fm" ? "FM" : value[0].toUpperCase() + value.slice(1),
  }),
);
const STEP_COUNTS = [8, 16, 32];
const STEP_DURATIONS = [0.5, 0.25, 0.125];
const MIN_BPM = 30;
const MAX_BPM = 300;
const FM_DEFAULTS: FmPatch = {
  amplitude: 0.5,
  ratio: 2,
  index: 2,
  attack: 0.005,
  decay: 0.2,
  sustain: 0.6,
  release: 0.2,
};

function camel(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** A synth pad's params (the synth's snake_case fields) as a `SynthPatch`. */
export function padSynthPatch(params: Record<string, unknown>): SynthPatch {
  const patch: Record<string, unknown> = { ...SYNTH_DEFAULTS };
  for (const [key, value] of Object.entries(params)) {
    const field = key === "oscillator_type" ? "type" : camel(key);
    if (field in patch) patch[field] = value;
  }
  return patch as unknown as SynthPatch;
}

function padFmPatch(params: Record<string, unknown>): FmPatch {
  const patch: Record<string, unknown> = { ...FM_DEFAULTS };
  for (const key of Object.keys(FM_DEFAULTS))
    if (key in params) patch[key] = Number(params[key]);
  return patch as unknown as FmPatch;
}

const number = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * `<nbplay-drums>`: a drum machine. A grid of pads, each with its own sound
 * (a built-in kick, snare, hat, clap or tom, a synth patch or an FM patch),
 * an editor for the selected pad, and a pattern with one row per pad. Its
 * pattern follows the session clock named by `sessionId` (a private clock
 * when empty). As a session instrument it registers
 * `bus.instruments[channelIndex]`, so a note from a sequencer, a clip or a
 * launched slot on its track plays the pads that answer to it. Pads with
 * the same nonzero `choke` group cut each other off. Pad, pattern and
 * transport edits fire `nbplay-set`; `isPlaying` and `currentStep` fire
 * `nbplay-status`.
 */
export class NbplayDrums extends NbplayElement {
  static properties = {
    pads: { attribute: false },
    samples: { attribute: false },
    pattern: { attribute: false },
    steps: { type: Number },
    stepDuration: { type: Number, attribute: "step-duration" },
    swing: { type: Number },
    bpm: { type: Number },
    timeSignatureNum: { type: Number, attribute: "time-signature-num" },
    timeSignatureDen: { type: Number, attribute: "time-signature-den" },
    velocity: { type: Number },
    presetNames: { attribute: false },
    presetRequest: { type: String, attribute: "preset-request" },
    soundPresetNames: { attribute: false },
    sessionTracks: { attribute: false },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    channelIndex: { type: Number, attribute: "channel-index" },
    isPlaying: { type: Boolean, attribute: "is-playing", reflect: true },
    currentStep: { type: Number, attribute: false },
    selected: { state: true },
    lit: { state: true },
  };

  declare pads: DrumPad[];
  declare samples: Record<string, DrumSample>;
  declare pattern: number[][];
  declare steps: number;
  declare stepDuration: number;
  declare swing: number;
  declare bpm: number;
  declare timeSignatureNum: number;
  declare timeSignatureDen: number;
  declare velocity: number;
  declare presetNames: string[];
  declare presetRequest: string;
  declare soundPresetNames: Record<string, string[]>;
  /** The session's tracks a pad can play: `{channel_index, name}`. */
  declare sessionTracks: { channel_index: number; name: string }[];
  declare sessionId: string;
  declare channelIndex: number;
  declare isPlaying: boolean;
  declare currentStep: number;
  /** The pad the editor shows. */
  declare selected: number;
  /** Pads lit by a hit. */
  declare lit: number[];

  private binding: (ClockBinding & { rebind(): void }) | null = null;
  /** Plays a note on the pads that answer to it; the pattern and the bus use it. */
  private instrument: InstrumentBus = {
    scheduleNote: (note, velocity, at) => this.playNote(note, velocity, at),
    // A pad is a one-shot: a held key plays it once and its release does nothing.
    startNote: (note, velocity, at) => {
      this.playNote(note, velocity, at);
      (this.pads || []).forEach((pad, index) => {
        if (pad.note === note) this.flash(index);
      });
    },
  };
  private scheduler = createAudioScheduler({
    instrument: () => this.instrument,
  });
  private registration: {
    bus: SessionBus;
    idx: number;
    entry: InstrumentBus;
  } | null = null;
  /** Decoded samples by id, for the context they were made on. */
  private buffers = new Map<string, AudioBuffer>();
  private buffersCtx: BaseAudioContext | null = null;
  /** Set while a track pad plays another instrument, so a loop back here stops. */
  private forwarding = false;
  private ringing: Array<{
    choke: number;
    at: number;
    gain: GainNode;
    cancel: () => void;
  }> = [];

  /** The scheduler reads fields by name; present the pattern as voices. */
  private shim: AnyModel = {
    get: (name) => {
      if (name === "voices_data") return this.voices();
      if (name === "loop_enabled") return true;
      if (name === "groove" || name === "automation_lanes") return [];
      return (this as unknown as Record<string, unknown>)[camel(name)];
    },
    set: (name, value) => {
      if (name !== "current_step") return;
      this.currentStep = Number(value);
      this.status(false, { currentStep: this.currentStep });
    },
    save_changes: () => {},
    on: () => {},
  };

  constructor() {
    super();
    this.pads = [];
    this.samples = {};
    this.pattern = [];
    this.steps = 16;
    this.stepDuration = 0.25;
    this.swing = 0;
    this.bpm = 120;
    this.timeSignatureNum = 4;
    this.timeSignatureDen = 4;
    this.velocity = 100;
    this.presetNames = [];
    this.presetRequest = "";
    this.soundPresetNames = {};
    this.sessionTracks = [];
    this.sessionId = "";
    this.channelIndex = -1;
    this.isPlaying = false;
    this.currentStep = -1;
    this.selected = 0;
    this.lit = [];
  }

  // Clock and transport (the sequencer's, without recording or one-shots)

  clock(): SessionClock {
    if (!this.binding) {
      this.binding = bindElementClock(this, this.onClockEvent, this.onRebind);
      const clk = this.binding.clock();
      this.joinTempo(clk);
      this.isPlaying = clk.playing;
      if (clk.playing) this.startScheduler();
    }
    return this.binding.clock();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-drums");
    document.addEventListener("nbplay-bus-ready", this.onBusReady);
    this.clock();
    this.register();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("nbplay-bus-ready", this.onBusReady);
    this.unregister();
    this.scheduler.destroy();
    this.binding?.dispose();
    this.binding = null;
  }

  updated(changed: PropertyValues): void {
    if (changed.has("samples")) this.buffers.clear();
    if (changed.has("sessionId") || changed.has("channelIndex")) {
      this.register();
    }
    if (!this.binding) return;
    // A tempo that arrives with the session id is the model's at render,
    // which joins the clock; a later write is the host setting the tempo.
    const joined =
      changed.has("sessionId") && changed.get("sessionId") !== undefined;
    if (joined) this.binding.rebind();
    const clk = this.clock();
    if (changed.has("bpm") && !joined && Number(this.bpm) !== clk.bpm) {
      clk.setTempo(Number(this.bpm));
    }
    if (changed.has("isPlaying") && changed.get("isPlaying") !== undefined) {
      this.onPlayStateChange(clk);
    }
  }

  private shared(): boolean {
    return Boolean(this.sessionId);
  }

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  private status(save: boolean, values: Record<string, unknown>): void {
    this.emitDetail("nbplay-status", { values, save });
  }

  private startScheduler(): void {
    if (!this.scheduler.isPlaying())
      this.scheduler.start(this.shim, this.clock());
  }

  private stopLocal(save: boolean): void {
    this.scheduler.stop();
    this.isPlaying = false;
    this.currentStep = -1;
    this.status(save, { isPlaying: false, currentStep: -1 });
  }

  private onClockEvent = (event: ClockEvent): void => {
    switch (event.type) {
      case "play":
        this.startScheduler();
        this.isPlaying = true;
        this.status(true, { isPlaying: true });
        break;
      case "stop":
        this.stopLocal(true);
        break;
      case "seek":
      case "loop":
        this.scheduler.realign();
        break;
      case "tempo": {
        this.scheduler.realign();
        const bpm = this.clock().bpm;
        if (Number(this.bpm) !== bpm) {
          this.bpm = bpm;
          this.set({ bpm });
        }
        break;
      }
    }
  };

  private joinTempo(clk: SessionClock): void {
    const bpm = clk.adoptTempo(Number(this.bpm));
    if (bpm !== Number(this.bpm)) {
      this.bpm = bpm;
      this.set({ bpm });
    }
  }

  private onRebind = (clk: SessionClock): void => {
    this.scheduler.stop();
    this.joinTempo(clk);
    this.currentStep = -1;
    if (clk.playing) this.startScheduler();
    this.isPlaying = this.scheduler.isPlaying();
    this.status(false, { isPlaying: this.isPlaying, currentStep: -1 });
  };

  /** `isPlaying` written by the host (a kernel command, or session status). */
  private onPlayStateChange(clk: SessionClock): void {
    if (this.shared()) {
      const running = this.scheduler.isPlaying();
      if (Boolean(this.isPlaying) !== running) {
        this.isPlaying = running;
        this.status(true, { isPlaying: running });
      }
      return;
    }
    if (this.isPlaying) {
      if (clk.playing) this.startScheduler();
      else clk.play();
    } else {
      this.scheduler.stop();
      clk.stop();
    }
  }

  togglePlay(): void {
    const clk = this.clock();
    if (this.isPlaying) {
      if (this.shared()) this.stopLocal(true);
      else clk.stop();
    } else if (clk.playing) {
      this.startScheduler();
      this.isPlaying = true;
      this.status(true, { isPlaying: true });
    } else {
      clk.play();
    }
  }

  stopAndRewind(): void {
    const clk = this.clock();
    if (clk.playing) clk.stop();
    else this.stopLocal(true);
    clk.seek(0);
  }

  /** Stop (kernel disconnect). */
  halt(): void {
    this.scheduler.stop();
    if (!this.shared()) this.clock().stop();
    this.stopLocal(false);
    this.ringing.forEach((hit) => hit.cancel());
  }

  // Session instrument

  private onBusReady = (e: Event): void => {
    if ((e as CustomEvent).detail?.sessionId === this.sessionId)
      this.register();
  };

  private unregister(): void {
    this.ringing.forEach((hit) => hit.cancel());
    if (!this.registration) return;
    const { bus, idx, entry } = this.registration;
    if (bus.instruments?.[idx] === entry) delete bus.instruments[idx];
    this.registration = null;
  }

  private register(): void {
    const sid = this.sessionId;
    const idx = Number(this.channelIndex);
    this.unregister();
    if (!sid || !(idx >= 0)) return;
    const bus = getSessionBus(sid);
    if (!bus) return; // the mixer renders later and announces nbplay-bus-ready
    bus.instruments = bus.instruments || {};
    bus.instruments[idx] = this.instrument;
    this.registration = { bus, idx, entry: this.instrument };
  }

  // Sound

  /** The pattern as scheduler voices: one per pad, playing the pad's note. */
  private voices(): StepData[][] {
    const steps = Math.max(1, Math.round(number(this.steps, 16)));
    return (this.pads || []).map((pad, index) => {
      const row = this.pattern?.[index] || [];
      return Array.from({ length: steps }, (_, step) => {
        const velocity = number(row[step], 0);
        return { active: velocity > 0, note: pad.note, velocity };
      });
    });
  }

  private audio(): { ctx: BaseAudioContext; output: AudioNode } | null {
    const ctx = this.clock().context();
    if (!ctx) return null;
    if (ctx.state === "suspended") void ctx.resume();
    const bus = this.sessionId ? getSessionBus(this.sessionId) : undefined;
    const idx = Number(this.channelIndex);
    const output =
      (idx >= 0 ? bus?.channels?.[idx]?.gain : undefined) ||
      bus?.masterGain ||
      ctx.destination;
    return { ctx, output };
  }

  private sampleBuffer(ctx: BaseAudioContext, id: string): AudioBuffer | null {
    if (ctx !== this.buffersCtx) {
      this.buffers.clear();
      this.buffersCtx = ctx;
    }
    const cached = this.buffers.get(id);
    if (cached) return cached;
    const sample = this.samples?.[id];
    const data = sample ? toFloat32(sample.data) : null;
    if (!sample || !data?.length) return null;
    const buffer = ctx.createBuffer(
      1,
      data.length,
      number(sample.sample_rate, 44100),
    );
    buffer.getChannelData(0).set(data);
    this.buffers.set(id, buffer);
    return buffer;
  }

  /** Play every pad that answers to `note`; returns a canceller. */
  playNote(note: number, velocity: number, at?: number): () => void {
    const cancels = (this.pads || []).flatMap((pad, index) =>
      pad.note === note ? [this.hit(index, velocity, at)] : [],
    );
    return () => cancels.forEach((cancel) => cancel());
  }

  /** Play pad `index` at `at` (now when omitted); returns a canceller. */
  hit(index: number, velocity: number, at?: number): () => void {
    const pad = this.pads?.[index];
    const audio = this.audio();
    if (!pad || !audio) return () => {};
    const { ctx, output } = audio;
    const when = at ?? ctx.currentTime;
    if (pad.sound === "track") return this.hitTrack(pad, velocity, when);
    const choke = number(pad.choke, 0);
    if (choke > 0) {
      for (const other of this.ringing) {
        if (other.choke !== choke || other.at >= when) continue;
        other.gain.gain.cancelScheduledValues(when);
        other.gain.gain.setTargetAtTime(0, when, 0.005);
      }
    }
    const gain = ctx.createGain();
    gain.gain.value = number(pad.gain, 1);
    const panner = ctx.createStereoPanner?.();
    if (panner) {
      panner.pan.value = number(pad.pan, 0);
      gain.connect(panner).connect(output);
    } else {
      gain.connect(output);
    }
    const entry = { choke, at: when, gain, cancel: () => {} };
    const done = () => {
      this.ringing = this.ringing.filter((hit) => hit !== entry);
      for (const node of [gain, panner]) {
        try {
          node?.disconnect();
        } catch {
          /* already disconnected */
        }
      }
    };
    const params = pad.params || {};
    if (pad.sound === "sample") {
      const buffer = this.sampleBuffer(ctx, String(params.sample ?? ""));
      if (!buffer) {
        done();
        return () => {};
      }
      const { sourceNode } = startSampleVoice(ctx, gain, {
        buffer,
        playbackRate: 2 ** (number(params.tune, 0) / 12),
        loop: false,
        envelope: { attack: 0, decay: 0, sustain: 1, release: 0.01 },
        peak: Math.max(0, Math.min(127, velocity)) / 127,
        at: when,
        duration: number(params.length, 4),
      });
      sourceNode.onended = done;
      entry.cancel = () => {
        try {
          sourceNode.stop();
        } catch {
          /* already stopped */
        }
        done();
      };
    } else if (pad.sound === "synth" || pad.sound === "fm") {
      const pitch = number(params.pitch, 60);
      const length = number(params.length, 0.25);
      entry.cancel =
        pad.sound === "synth"
          ? scheduleSynthNote(
              ctx,
              gain,
              padSynthPatch(params),
              pitch,
              velocity,
              when,
              length,
              done,
            )
          : scheduleFmNote(
              ctx,
              gain,
              padFmPatch(params),
              pitch,
              velocity,
              when,
              length,
              done,
            );
    } else {
      entry.cancel = scheduleDrumHit(
        ctx,
        gain,
        {
          sound: pad.sound,
          tune: number(params.tune, 0),
          decay: number(params.decay, 0.3),
          tone: number(params.tone, 0.5),
        },
        velocity,
        when,
        done,
      );
    }
    this.ringing.push(entry);
    return entry.cancel;
  }

  /**
   * Play a track pad's note on the instrument of the track it names, through
   * that track's channel. Its gain scales the velocity.
   */
  private hitTrack(pad: DrumPad, velocity: number, at: number): () => void {
    const params = pad.params || {};
    const bus = this.sessionId ? getSessionBus(this.sessionId) : undefined;
    const target = bus?.instruments?.[number(params.track, -1)];
    if (!target || this.forwarding) return () => {};
    const scaled = Math.max(
      1,
      Math.min(127, Math.round(velocity * number(pad.gain, 1))),
    );
    this.forwarding = true;
    try {
      const cancel = target.scheduleNote(
        number(params.pitch, 60),
        scaled,
        at,
        number(params.length, 0.25),
      );
      return cancel || (() => {});
    } finally {
      this.forwarding = false;
    }
  }

  // Editing

  private editPad(
    index: number,
    fields: Partial<DrumPad>,
    added: Record<string, DrumSample> = {},
  ): void {
    const pads = (this.pads || []).map((pad) => ({ ...pad }));
    if (!pads[index]) return;
    pads[index] = { ...pads[index], ...fields };
    this.pads = pads;
    // Drop the samples no pad plays any more, in the same edit.
    const all = { ...this.samples, ...added };
    const used = new Set(
      pads.filter((p) => p.sound === "sample").map((p) => p.params?.sample),
    );
    const samples = Object.fromEntries(
      Object.entries(all).filter(([id]) => used.has(id)),
    );
    if (
      Object.keys(samples).length === Object.keys(this.samples || {}).length &&
      !Object.keys(added).length
    ) {
      this.set({ pads });
      return;
    }
    this.samples = samples;
    this.set({ pads, samples });
  }

  /** Decode an audio file and make pad `index` play it. */
  async loadPadFile(index: number, file: File): Promise<void> {
    const decoded = await decodeToMono(await file.arrayBuffer());
    const pad = this.pads?.[index];
    if (!decoded || !pad) return;
    const id = Math.random().toString(16).slice(2, 10);
    const keep = pad.sound === "sample" ? pad.params : {};
    this.editPad(
      index,
      {
        sound: "sample",
        params: { tune: keep.tune ?? 0, length: keep.length ?? 4, sample: id },
      },
      {
        [id]: {
          name: file.name,
          sample_rate: decoded.sampleRate,
          data: float32ToDataView(decoded.samples),
        },
      },
    );
  }

  private editParams(index: number, params: Record<string, unknown>): void {
    const pad = this.pads?.[index];
    if (pad) this.editPad(index, { params: { ...pad.params, ...params } });
  }

  private onPatternChange = (e: Event): void => {
    e.stopPropagation();
    const { pad, step, value } = (e as CustomEvent).detail;
    const steps = Math.max(1, Math.round(number(this.steps, 16)));
    const pattern = (this.pads || []).map((_, index) => {
      const row = (this.pattern?.[index] || []).slice(0, steps);
      while (row.length < steps) row.push(0);
      return row;
    });
    if (!pattern[pad]) return;
    pattern[pad][step] = value;
    this.pattern = pattern;
    this.set({ pattern });
  };

  private flash(index: number): void {
    this.lit = [...this.lit.filter((i) => i !== index), index];
    setTimeout(() => {
      this.lit = this.lit.filter((i) => i !== index);
    }, 120);
  }

  // Render

  private param(
    cls: string,
    label: string,
    value: number,
    kind: string,
    min: number,
    max: number,
    step: number,
    defaultValue: number,
    onValue: (value: number) => void,
    options: { scale?: string; unit?: string; control?: string } = {},
  ) {
    const on = (e: Event) => {
      e.stopPropagation();
      const next = (e as CustomEvent).detail.value as number;
      if (next !== value) onValue(next);
    };
    return html`<nbplay-param
      class=${cls}
      .label=${label}
      .kind=${kind}
      .control=${options.control ?? "dial"}
      .scale=${options.scale ?? "linear"}
      .unit=${options.unit ?? ""}
      .value=${value}
      .min=${min}
      .max=${max}
      .step=${step}
      .defaultValue=${defaultValue}
      .precision=${2}
      @input=${on}
      @change=${on}
    ></nbplay-param>`;
  }

  private renderTrackParams(index: number, params: Record<string, unknown>) {
    const setParam = (key: string) => (value: number) =>
      this.editParams(index, { [key]: value });
    const track = number(params.track, -1);
    // A pad cannot play its own track.
    const tracks = (this.sessionTracks || []).filter(
      (t) => t.channel_index !== Number(this.channelIndex),
    );
    return html`<label class="nbplay-drums-preset">
        <span>Track</span>
        <select
          class="nbplay-drums-track-select"
          @input=${(e: Event) => e.stopPropagation()}
          @change=${(e: Event) => {
            e.stopPropagation();
            const value = parseInt((e.target as HTMLSelectElement).value, 10);
            this.editParams(index, { track: value });
          }}
        >
          <option value="-1" ?selected=${track < 0}>—</option>
          ${tracks.map(
            (t) =>
              html`<option
                value=${t.channel_index}
                ?selected=${t.channel_index === track}
              >
                ${t.name}
              </option>`,
          )}
        </select>
      </label>
      ${this.param("nbplay-drums-pitch", "Pitch", number(params.pitch, 60), "note", 0, 127, 1, 60, setParam("pitch"))}
      ${this.param("nbplay-drums-length", "Length", number(params.length, 0.25), "seconds", 0.01, 4, 0.01, 0.25, setParam("length"), { scale: "log" })}`;
  }

  private renderSampleParams(index: number, params: Record<string, unknown>) {
    const sample = this.samples?.[String(params.sample ?? "")];
    const setParam = (key: string) => (value: number) =>
      this.editParams(index, { [key]: value });
    return html`<div class="nbplay-drums-sample">
        <span class="nbplay-drums-sample-name"
          >${sample?.name ?? "No sample"}</span
        >
        <label class="nbplay-drums-sample-load" title="Load an audio file"
          >Load…<input
            type="file"
            class="nbplay-drums-sample-file"
            aria-label="Sample file"
            accept="audio/*"
            @input=${(e: Event) => e.stopPropagation()}
            @change=${(e: Event) => {
              e.stopPropagation();
              const input = e.target as HTMLInputElement;
              const file = input.files?.[0];
              input.value = "";
              if (file) void this.loadPadFile(index, file);
            }}
        /></label>
      </div>
      ${this.param("nbplay-drums-tune", "Tune", number(params.tune, 0), "float", -24, 24, 0.1, 0, setParam("tune"), { unit: " st" })}
      ${this.param("nbplay-drums-length", "Length", number(params.length, 4), "seconds", 0.01, 4, 0.01, 4, setParam("length"), { scale: "log" })}`;
  }

  private renderEditor(index: number) {
    const pad = this.pads?.[index];
    if (!pad) return nothing;
    const params = pad.params || {};
    const set = (fields: Partial<DrumPad>) => this.editPad(index, fields);
    const setParam = (key: string) => (value: number) =>
      this.editParams(index, { [key]: value });
    const patchSound = pad.sound === "synth" || pad.sound === "fm";
    const presets = this.soundPresetNames?.[pad.sound] || [];
    return html`<div class="nbplay-drums-editor">
      <div class="nbplay-drums-editor-head">
        <input
          type="text"
          class="nbplay-drums-pad-name"
          aria-label="Pad name"
          .value=${pad.name}
          @input=${(e: Event) => e.stopPropagation()}
          @change=${(e: Event) => {
            e.stopPropagation();
            const name = (e.target as HTMLInputElement).value.trim();
            if (name && name !== pad.name) set({ name });
          }}
        />
        ${this.param("nbplay-drums-note", "Note", number(pad.note, 36), "note", 0, 127, 1, 36, (note) => set({ note }), { control: "slider" })}
      </div>
      <nbplay-segmented
        class="nbplay-drums-sound"
        label="Sound"
        .options=${SOUNDS}
        .value=${pad.sound}
        @change=${(e: Event) => {
          e.stopPropagation();
          const sound = (e as CustomEvent).detail.value;
          // A new sound starts from its defaults; the kernel fills them in.
          if (sound !== pad.sound) set({ sound, params: {} });
        }}
      ></nbplay-segmented>
      <div class="nbplay-drums-params">
        ${
          patchSound
            ? html`<label class="nbplay-drums-preset">
                  <span>Preset</span>
                  <select
                    class="nbplay-drums-preset-select"
                    @input=${(e: Event) => e.stopPropagation()}
                    @change=${(e: Event) => {
                      e.stopPropagation();
                      const preset = (e.target as HTMLSelectElement).value;
                      // The kernel fills the patch in from the shipped preset.
                      if (preset)
                        set({
                          params: {
                            preset,
                            pitch: params.pitch,
                            length: params.length,
                          },
                        });
                    }}
                  >
                    <option value="" ?selected=${!params.preset}>—</option>
                    ${presets.map(
                      (name) =>
                        html`<option
                          value=${name}
                          ?selected=${params.preset === name}
                        >
                          ${name}
                        </option>`,
                    )}
                  </select>
                </label>
                ${this.param("nbplay-drums-pitch", "Pitch", number(params.pitch, 60), "note", 0, 127, 1, 60, setParam("pitch"))}
                ${this.param("nbplay-drums-length", "Length", number(params.length, 0.25), "seconds", 0.01, 4, 0.01, 0.25, setParam("length"), { scale: "log" })}`
            : pad.sound === "sample"
              ? this.renderSampleParams(index, params)
              : pad.sound === "track"
                ? this.renderTrackParams(index, params)
                : html`${this.param("nbplay-drums-tune", "Tune", number(params.tune, 0), "float", -24, 24, 0.1, 0, setParam("tune"), { unit: " st" })}
                  ${this.param("nbplay-drums-decay", "Decay", number(params.decay, 0.3), "seconds", 0.01, 4, 0.01, 0.3, setParam("decay"), { scale: "log" })}
                  ${this.param("nbplay-drums-tone", "Tone", number(params.tone, 0.5), "percent", 0, 1, 0.01, 0.5, setParam("tone"))}`
        }
        ${this.param("nbplay-drums-gain", "Gain", number(pad.gain, 1), "db", 0, 2, 0.01, 1, (gain) => set({ gain }))}
        ${
          // A track pad plays through its track's channel: no pan or choke here.
          pad.sound === "track"
            ? nothing
            : html`${this.param("nbplay-drums-pan", "Pan", number(pad.pan, 0), "pan", -1, 1, 0.01, 0, (pan) => set({ pan }))}
              ${this.param("nbplay-drums-choke", "Choke", number(pad.choke, 0), "int", 0, 8, 1, 0, (choke) => set({ choke: Math.round(choke) }))}`
        }
      </div>
    </div>`;
  }

  render() {
    const pads = this.pads || [];
    const cols = 4;
    const rows = Math.max(1, Math.ceil(pads.length / cols));
    const selected = Math.min(this.selected, Math.max(0, pads.length - 1));
    const padSpecs: PadSpec[] = Array.from({ length: rows * cols }, (_, i) =>
      pads[i]
        ? {
            note: pads[i].note,
            velocity: number(this.velocity, 100),
            label: pads[i].name,
          }
        : { note: 0, velocity: 0, label: "" },
    );
    const steps = Math.max(1, Math.round(number(this.steps, 16)));
    const stepCounts = STEP_COUNTS.includes(steps)
      ? STEP_COUNTS
      : [...STEP_COUNTS, steps].sort((a, b) => a - b);
    const stepsPerBeat = Math.max(
      1,
      Math.round(1 / number(this.stepDuration, 0.25)),
    );
    return html`<nbplay-header badge="drums"
        >${presetSelect(this.presetNames, (name) => {
          // Status, `<token>:<name>`, like the synth's preset picker.
          this.presetRequest = presetRequest(name, this.presetRequest);
          this.status(true, { presetRequest: this.presetRequest });
        })}</nbplay-header
      >
      <div class="nbplay-drums-transport">
        <button
          type="button"
          class="nbplay-drums-btn nbplay-drums-play ${this.isPlaying ? "playing" : ""}"
          title="Play/Stop"
          @click=${() => this.togglePlay()}
        >
          ${this.isPlaying ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          class="nbplay-drums-btn nbplay-drums-stop"
          title="Stop"
          @click=${() => this.stopAndRewind()}
        >
          ■
        </button>
        ${this.param("nbplay-drums-bpm", "BPM", number(this.bpm, 120), "bpm", MIN_BPM, MAX_BPM, 1, 120, (bpm) => this.clock().setTempo(bpm), { control: "slider" })}
        <label class="nbplay-drums-field">
          <span>Steps</span>
          <select
            class="nbplay-drums-steps"
            @input=${(e: Event) => e.stopPropagation()}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.steps = parseInt((e.target as HTMLSelectElement).value, 10);
              this.set({ steps: this.steps });
            }}
          >
            ${stepCounts.map(
              (count) =>
                html`<option value=${count} ?selected=${count === steps}>
                  ${count}
                </option>`,
            )}
          </select>
        </label>
        <label class="nbplay-drums-field">
          <span>Step</span>
          <select
            class="nbplay-drums-step-duration"
            @input=${(e: Event) => e.stopPropagation()}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.stepDuration = parseFloat(
                (e.target as HTMLSelectElement).value,
              );
              this.set({ stepDuration: this.stepDuration });
            }}
          >
            ${STEP_DURATIONS.map(
              (d) =>
                html`<option
                  value=${d}
                  ?selected=${d === number(this.stepDuration, 0.25)}
                >
                  1/${4 / d}
                </option>`,
            )}
          </select>
        </label>
        ${this.param(
          "nbplay-drums-swing",
          "Swing",
          number(this.swing, 0),
          "int",
          0,
          100,
          1,
          0,
          (swing) => {
            this.swing = swing;
            this.set({ swing });
          },
          { control: "slider", unit: "%" },
        )}
      </div>
      <div class="nbplay-drums-main">
        <nbplay-pad-grid
          .rows=${rows}
          .cols=${cols}
          .pads=${padSpecs}
          .active=${this.lit}
          @nbplay-note-on=${(e: Event) => {
            e.stopPropagation();
            const { index, velocity } = (e as CustomEvent).detail;
            // Cells past the last pad fill out the grid's last row.
            if (index >= pads.length) return;
            this.selected = index;
            this.hit(index, velocity);
            this.flash(index);
          }}
          @nbplay-note-off=${(e: Event) => e.stopPropagation()}
        ></nbplay-pad-grid>
        ${this.renderEditor(selected)}
      </div>
      <nbplay-drum-grid
        .pattern=${this.voices().map((row) => row.map((s) => (s.active ? s.velocity : 0)))}
        .names=${pads.map((pad) => pad.name)}
        .currentStep=${this.currentStep}
        .selected=${selected}
        .velocity=${number(this.velocity, 100)}
        .group=${stepsPerBeat}
        @input=${(e: Event) => e.stopPropagation()}
        @change=${this.onPatternChange}
        @nbplay-select=${(e: Event) => {
          e.stopPropagation();
          this.selected = (e as CustomEvent).detail.pad;
        }}
      ></nbplay-drum-grid>`;
  }
}

define("nbplay-drums", NbplayDrums);
