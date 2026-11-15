import { html } from "lit";
import { type PropertyValues } from "lit";
import { createAudioContext, toFloat32 } from "../helpers.ts";
import {
  getSessionBus,
  type InstrumentBus,
  type SessionBus,
} from "../session.ts";
import {
  SYNTH_DEFAULTS,
  scheduleSynthNote,
  startSynthVoice,
  type SynthPatch,
  type SynthVoice,
} from "../voices.ts";
import { NbplayElement, define } from "./base.ts";
import { presetSelect } from "./preset-select.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./envelope.ts";
import "./header.ts";
import "./param.ts";
import "./segmented.ts";
import "./waveform.ts";

export type OscillatorType = "sine" | "triangle" | "square" | "saw" | "noise";

const OSCILLATORS: Array<{ value: OscillatorType; label: string }> = [
  { value: "sine", label: "Sine" },
  { value: "triangle", label: "Triangle" },
  { value: "square", label: "Square" },
  { value: "saw", label: "Saw" },
  { value: "noise", label: "Noise" },
];
const SECOND_OSCILLATORS = OSCILLATORS.filter(({ value }) => value !== "noise");
const FILTERS = [
  { value: "lowpass", label: "Low pass" },
  { value: "highpass", label: "High pass" },
  { value: "bandpass", label: "Band pass" },
];
const LFO_TARGETS = [
  { value: "off", label: "Off" },
  { value: "pitch", label: "Pitch" },
  { value: "filter", label: "Filter" },
  { value: "amplitude", label: "Level" },
];
const MIN_FREQ = 20;
const MAX_FREQ = 8000;

/** Patch fields edited by a number control, by their element property name. */
type NumberField = Exclude<
  keyof SynthPatch,
  "type" | "osc2Type" | "filterType" | "lfoTarget"
>;

/** The test tone: one held voice of the patch on a private AudioContext at the configured rate. */
class ToneEngine {
  private ctx: AudioContext | null = null;
  private voice: SynthVoice | null = null;

  start(patch: SynthPatch, frequency: number, sampleRate: number): boolean {
    this.stop();
    const ctx = createAudioContext({ sampleRate });
    if (!ctx) return false;
    this.ctx = ctx;
    // Mobile browsers can hand back a suspended context even inside a user
    // gesture; resuming here keeps the tap that started playback.
    if (ctx.state === "suspended") void ctx.resume?.();
    this.voice = startSynthVoice(
      ctx,
      ctx.destination,
      patch,
      frequency,
      patch.amplitude,
      ctx.currentTime,
    );
    return true;
  }

  update(patch: SynthPatch, frequency: number): void {
    this.voice?.update(patch, frequency, patch.amplitude);
  }

  stop(): void {
    this.voice?.stop();
    this.voice = null;
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

/**
 * `<nbplay-synth>`: the synth instrument. Two oscillators and noise go
 * through a filter with its own envelope and an amplitude envelope, with an
 * LFO on the pitch, the cutoff or the level (see `SynthPatch`); the
 * preview shows the oscillators. Play/stop sounds the patch at `frequency`
 * on a private AudioContext at `sampleRate`. As a session instrument
 * (`sessionId`, `channelIndex`) it also registers
 * `bus.instruments[channelIndex]` so sequencers and clips on its track play
 * through it. Patch and `frequency` edits fire `nbplay-set`; `isPlaying`
 * fires `nbplay-status` (a start that fails without Web Audio reports
 * `false`). `waveform` is the preview samples (`Float32Array` or
 * little-endian bytes).
 */
export class NbplaySynth extends NbplayElement {
  static properties = {
    oscillatorType: { type: String, attribute: "oscillator-type" },
    frequency: { type: Number },
    amplitude: { type: Number },
    sampleRate: { type: Number, attribute: "sample-rate" },
    osc2Type: { type: String, attribute: "osc2-type" },
    osc2Level: { type: Number, attribute: "osc2-level" },
    osc2Semitones: { type: Number, attribute: "osc2-semitones" },
    osc2Detune: { type: Number, attribute: "osc2-detune" },
    noiseLevel: { type: Number, attribute: "noise-level" },
    filterType: { type: String, attribute: "filter-type" },
    cutoff: { type: Number },
    resonance: { type: Number },
    filterEnv: { type: Number, attribute: "filter-env" },
    filterAttack: { type: Number, attribute: "filter-attack" },
    filterDecay: { type: Number, attribute: "filter-decay" },
    filterSustain: { type: Number, attribute: "filter-sustain" },
    filterRelease: { type: Number, attribute: "filter-release" },
    attack: { type: Number },
    decay: { type: Number },
    sustain: { type: Number },
    release: { type: Number },
    lfoTarget: { type: String, attribute: "lfo-target" },
    lfoRate: { type: Number, attribute: "lfo-rate" },
    lfoDepth: { type: Number, attribute: "lfo-depth" },
    waveform: { attribute: false },
    presetNames: { attribute: false },
    presetRequest: { type: String, attribute: "preset-request" },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    channelIndex: { type: Number, attribute: "channel-index" },
    isPlaying: { type: Boolean, attribute: "is-playing", reflect: true },
  };

  declare oscillatorType: OscillatorType;
  declare frequency: number;
  declare amplitude: number;
  declare sampleRate: number;
  declare osc2Type: OscillatorType;
  declare osc2Level: number;
  declare osc2Semitones: number;
  declare osc2Detune: number;
  declare noiseLevel: number;
  declare filterType: string;
  declare cutoff: number;
  declare resonance: number;
  declare filterEnv: number;
  declare filterAttack: number;
  declare filterDecay: number;
  declare filterSustain: number;
  declare filterRelease: number;
  declare attack: number;
  declare decay: number;
  declare sustain: number;
  declare release: number;
  declare lfoTarget: string;
  declare lfoRate: number;
  declare lfoDepth: number;
  declare waveform: unknown;
  /** The shipped presets' names for the header's picker. */
  declare presetNames: string[];
  /** The preset the picker asked for (status); the kernel loads it. */
  declare presetRequest: string;
  declare sessionId: string;
  declare channelIndex: number;
  declare isPlaying: boolean;

  private tone = new ToneEngine();
  private registration: {
    bus: SessionBus;
    idx: number;
    entry: InstrumentBus;
  } | null = null;
  private liveNotes = new Set<() => void>();

  constructor() {
    super();
    const { type, ...rest } = SYNTH_DEFAULTS;
    Object.assign(this, rest);
    this.oscillatorType = type as OscillatorType;
    this.frequency = 440;
    this.amplitude = 0.5;
    this.sampleRate = 44100;
    this.waveform = null;
    this.presetNames = [];
    this.presetRequest = "";
    this.sessionId = "";
    this.channelIndex = -1;
    this.isPlaying = false;
  }

  /** The current sound, as each note takes it. */
  patch(): SynthPatch {
    const number = (value: unknown, fallback: number) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };
    const patch = { ...SYNTH_DEFAULTS };
    for (const key of Object.keys(SYNTH_DEFAULTS) as (keyof SynthPatch)[]) {
      if (key === "type") continue;
      const value = (this as unknown as Record<string, unknown>)[key];
      (patch as Record<string, unknown>)[key] =
        typeof SYNTH_DEFAULTS[key] === "number"
          ? number(value, SYNTH_DEFAULTS[key] as number)
          : String(value ?? SYNTH_DEFAULTS[key]);
    }
    patch.type = this.oscillatorType || "sine";
    return patch;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-synth");
    document.addEventListener("nbplay-bus-ready", this.onBusReady);
    this.register();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("nbplay-bus-ready", this.onBusReady);
    this.unregister();
    this.tone.stop();
  }

  updated(changed: PropertyValues): void {
    if (changed.has("sessionId") || changed.has("channelIndex")) {
      this.register();
    }
    if (changed.has("isPlaying") && changed.get("isPlaying") !== undefined) {
      if (this.isPlaying) this.startTone();
      else this.tone.stop();
    } else if (this.isPlaying) {
      // Switching the first oscillator between a tone and noise needs a new
      // voice; anything else moves the one that is sounding.
      if (changed.has("oscillatorType")) this.startTone();
      else this.tone.update(this.patch(), Number(this.frequency));
    }
  }

  // Session instrument: sequencers, launcher slots, and MIDI clips on this
  // synth's track play through it with its current patch.

  private onBusReady = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    if (detail?.sessionId === this.sessionId) this.register();
  };

  private unregister(): void {
    this.liveNotes.forEach((cancel) => cancel());
    this.liveNotes.clear();
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
    const instruments = bus.instruments || {};
    bus.instruments = instruments;
    const entry: InstrumentBus = {
      scheduleNote: (note, velocity, at, duration) => {
        const ctx = bus.audioCtx;
        const output = bus.channels?.[idx]?.gain || bus.masterGain;
        if (!ctx || !output) return;
        const cancel: () => void = scheduleSynthNote(
          ctx,
          output,
          this.patch(),
          note,
          velocity,
          at,
          duration,
          () => this.liveNotes.delete(cancel),
        );
        this.liveNotes.add(cancel);
        return cancel;
      },
    };
    instruments[idx] = entry;
    this.registration = { bus, idx, entry };
  }

  // Tone

  private startTone(): void {
    const started = this.tone.start(
      this.patch(),
      Number(this.frequency),
      Number(this.sampleRate),
    );
    if (!started) {
      this.isPlaying = false;
      this.status();
    }
  }

  /** Stop the tone (kernel disconnect). */
  stop(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.tone.stop();
    this.status();
  }

  private status(): void {
    this.emitDetail("nbplay-status", {
      values: { isPlaying: this.isPlaying },
      save: true,
    });
  }

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  private choice(
    cls: string,
    label: string,
    prop: "oscillatorType" | "osc2Type" | "filterType" | "lfoTarget",
    options: Array<{ value: string; label: string }>,
  ) {
    return html`<nbplay-segmented
      class=${cls}
      label=${label}
      .options=${options}
      .value=${this[prop]}
      @change=${(e: Event) => {
        e.stopPropagation();
        const value = (e as CustomEvent).detail.value;
        if (value === this[prop]) return;
        (this as Record<string, unknown>)[prop] = value;
        this.set({ [prop]: value });
      }}
    ></nbplay-segmented>`;
  }

  private param(
    cls: string,
    label: string,
    prop: NumberField | "frequency",
    kind: string,
    min: number,
    max: number,
    step: number,
    defaultValue: number,
    options: {
      control?: "slider" | "dial";
      scale?: string;
      unit?: string;
      precision?: number;
      disabled?: boolean;
    } = {},
  ) {
    const on = (e: Event) => {
      e.stopPropagation();
      const value = (e as CustomEvent).detail.value as number;
      if (value === this[prop]) return;
      this[prop] = value;
      this.set({ [prop]: value });
    };
    return html`<nbplay-param
      class=${cls}
      .label=${label}
      .kind=${kind}
      .control=${options.control ?? "slider"}
      .scale=${options.scale ?? "linear"}
      .unit=${options.unit ?? ""}
      .value=${Number(this[prop])}
      .min=${min}
      .max=${max}
      .step=${step}
      .defaultValue=${defaultValue}
      .precision=${options.precision ?? 2}
      .disabled=${options.disabled ?? false}
      @input=${on}
      @change=${on}
    ></nbplay-param>`;
  }

  private envelopeSection(
    cls: string,
    title: string,
    fields: [NumberField, NumberField, NumberField, NumberField],
    defaults: [number, number, number, number],
  ) {
    const [a, d, s, r] = fields;
    return html`<div class="nbplay-synth-envelope ${cls}">
      <span class="nbplay-synth-section-title">${title}</span>
      <nbplay-envelope
        .attack=${Number(this[a])}
        .decay=${Number(this[d])}
        .sustain=${Number(this[s])}
        .release=${Number(this[r])}
      ></nbplay-envelope>
      <div class="nbplay-synth-env-controls">
        ${this.param(`${cls}-attack`, "Attack", a, "seconds", 0, 2, 0.001, defaults[0], { control: "dial" })}
        ${this.param(`${cls}-decay`, "Decay", d, "seconds", 0, 2, 0.001, defaults[1], { control: "dial" })}
        ${this.param(`${cls}-sustain`, "Sustain", s, "percent", 0, 1, 0.01, defaults[2], { control: "dial" })}
        ${this.param(`${cls}-release`, "Release", r, "seconds", 0, 5, 0.001, defaults[3], { control: "dial" })}
      </div>
    </div>`;
  }

  /**
   * Ask the kernel for a shipped preset. `presetRequest` is status:
   * `<time>:<name>`, so asking for the same name again is still a change.
   */
  private requestPreset(name: string): void {
    this.presetRequest = `${Date.now()}:${name}`;
    this.emitDetail("nbplay-status", {
      values: { presetRequest: this.presetRequest },
      save: true,
    });
  }

  render() {
    const noise = this.oscillatorType === "noise";
    const D = SYNTH_DEFAULTS;
    return html`<nbplay-header badge="synth"
        >${presetSelect(this.presetNames, (name) => {
          this.requestPreset(name);
        })}</nbplay-header
      >
      <nbplay-waveform
        class="nbplay-synth-waveform"
        variant="glow"
        .data=${toFloat32(this.waveform)}
      ></nbplay-waveform>
      ${this.choice("nbplay-osc", "Oscillator", "oscillatorType", OSCILLATORS)}
      <div class="nbplay-synth-params">
        ${this.param("nbplay-freq", "Frequency", "frequency", "hz", MIN_FREQ, MAX_FREQ, 0.1, 440, { scale: "log", disabled: noise })}
        ${this.param("nbplay-amp", "Amplitude", "amplitude", "float", 0, 1, 0.01, 0.8)}
      </div>
      <div class="nbplay-synth-section nbplay-synth-osc2">
        <span class="nbplay-synth-section-title">Oscillator 2</span>
        ${this.choice("nbplay-osc2", "Wave", "osc2Type", SECOND_OSCILLATORS)}
        <div class="nbplay-synth-params">
          ${this.param("nbplay-osc2-level", "Level", "osc2Level", "percent", 0, 1, 0.01, D.osc2Level)}
          ${this.param("nbplay-osc2-semitones", "Semitones", "osc2Semitones", "int", -24, 24, 1, D.osc2Semitones, { unit: " st" })}
          ${this.param("nbplay-osc2-detune", "Detune", "osc2Detune", "int", -100, 100, 1, D.osc2Detune, { unit: " ct" })}
          ${this.param("nbplay-noise-level", "Noise", "noiseLevel", "percent", 0, 1, 0.01, D.noiseLevel)}
        </div>
      </div>
      <div class="nbplay-synth-section nbplay-synth-filter">
        <span class="nbplay-synth-section-title">Filter</span>
        ${this.choice("nbplay-filter-type", "Type", "filterType", FILTERS)}
        <div class="nbplay-synth-params">
          ${this.param("nbplay-cutoff", "Cutoff", "cutoff", "hz", 20, 20000, 1, D.cutoff, { scale: "log" })}
          ${this.param("nbplay-resonance", "Resonance", "resonance", "float", 0.1, 20, 0.01, D.resonance)}
          ${this.param("nbplay-filter-env", "Envelope", "filterEnv", "float", -6, 6, 0.1, D.filterEnv, { unit: " oct", precision: 1 })}
        </div>
      </div>
      ${this.envelopeSection(
        "nbplay-filter-envelope",
        "Filter envelope",
        ["filterAttack", "filterDecay", "filterSustain", "filterRelease"],
        [D.filterAttack, D.filterDecay, D.filterSustain, D.filterRelease],
      )}
      ${this.envelopeSection(
        "nbplay-amp-envelope",
        "Amplitude envelope",
        ["attack", "decay", "sustain", "release"],
        [D.attack, D.decay, D.sustain, D.release],
      )}
      <div class="nbplay-synth-section nbplay-synth-lfo">
        <span class="nbplay-synth-section-title">LFO</span>
        ${this.choice("nbplay-lfo-target", "Target", "lfoTarget", LFO_TARGETS)}
        <div class="nbplay-synth-params">
          ${this.param("nbplay-lfo-rate", "Rate", "lfoRate", "hz", 0.05, 20, 0.01, D.lfoRate, { scale: "log" })}
          ${this.param("nbplay-lfo-depth", "Depth", "lfoDepth", "percent", 0, 1, 0.01, D.lfoDepth)}
        </div>
      </div>
      <div class="nbplay-synth-transport">
        <button
          type="button"
          class="nbplay-play-btn ${this.isPlaying ? "playing" : ""}"
          @click=${() => {
            this.isPlaying = !this.isPlaying;
            this.status();
          }}
        >
          ${this.isPlaying ? "■  Stop" : "▶  Play"}
        </button>
        <span class="nbplay-info">${this.sampleRate} Hz</span>
      </div>`;
  }
}

define("nbplay-synth", NbplaySynth);
