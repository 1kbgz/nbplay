import { html, type PropertyValues } from "lit";
import { createAudioContext } from "../helpers.ts";
import {
  getSessionBus,
  type InstrumentBus,
  type SessionBus,
} from "../session.ts";
import { midiToHz } from "../voices.ts";
import { NbplayElement, define } from "./base.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./envelope.ts";
import "./header.ts";
import "./param.ts";
import "./waveform.ts";

/** The sound of one FM voice: a sine carrier whose frequency a sine modulator moves. */
export interface FmPatch {
  amplitude: number;
  /** Modulator frequency over carrier frequency. */
  ratio: number;
  /** Peak frequency deviation over modulator frequency. */
  index: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface FmVoice {
  carrier: OscillatorNode;
  modulator: OscillatorNode;
  depth: GainNode;
  level: GainNode;
}

function createVoice(
  ctx: AudioContext,
  output: AudioNode,
  frequency: number,
  patch: FmPatch,
): FmVoice {
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const depth = ctx.createGain();
  const level = ctx.createGain();
  carrier.frequency.value = frequency;
  modulator.frequency.value = frequency * patch.ratio;
  depth.gain.value = patch.index * frequency * patch.ratio;
  modulator.connect(depth);
  depth.connect(carrier.frequency);
  carrier.connect(level);
  level.connect(output);
  return { carrier, modulator, depth, level };
}

function disposeVoice(voice: FmVoice): void {
  for (const node of [
    voice.modulator,
    voice.depth,
    voice.carrier,
    voice.level,
  ]) {
    try {
      node.disconnect();
    } catch {
      /* already disconnected */
    }
  }
}

/**
 * Play one FM note on `output` at a scheduled time, shaped by the patch's
 * ADSR; the release runs after `duration`. Returns a canceller.
 */
export function scheduleFmNote(
  ctx: AudioContext,
  output: AudioNode,
  patch: FmPatch,
  note: number,
  velocity: number,
  at: number,
  duration: number,
  onEnded: () => void = () => {},
): () => void {
  const peak = Math.max(0, Math.min(1, patch.amplitude)) * (velocity / 127);
  const voice = createVoice(ctx, output, midiToHz(note), patch);
  const attack = Math.min(Math.max(0, patch.attack), duration);
  const decayEnd = Math.min(
    at + attack + Math.max(0, patch.decay),
    at + duration,
  );
  const end = at + duration + Math.max(0.005, patch.release);
  const gain = voice.level.gain;
  gain.setValueAtTime(0, at);
  gain.linearRampToValueAtTime(peak, at + attack);
  gain.linearRampToValueAtTime(
    peak * patch.sustain,
    Math.max(decayEnd, at + attack),
  );
  gain.setValueAtTime(peak * patch.sustain, at + duration);
  gain.linearRampToValueAtTime(0, end);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    disposeVoice(voice);
    onEnded();
  };
  voice.carrier.onended = finish;
  for (const osc of [voice.modulator, voice.carrier]) {
    osc.start(at);
    osc.stop(end);
  }
  return () => {
    for (const osc of [voice.modulator, voice.carrier]) {
      try {
        osc.stop(0);
      } catch {
        /* already stopped */
      }
    }
    finish();
  };
}

/** About three carrier cycles of the patch, for the preview. */
export function fmWaveform(patch: FmPatch, frames = 600): Float32Array {
  const data = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const phase = (i / frames) * 3 * 2 * Math.PI;
    data[i] =
      patch.amplitude *
      Math.sin(phase + patch.index * Math.sin(phase * patch.ratio));
  }
  return data;
}

/** The continuous test tone on a private AudioContext. */
class FmTone {
  private ctx: AudioContext | null = null;
  private voice: FmVoice | null = null;

  start(frequency: number, patch: FmPatch): boolean {
    this.stop();
    const ctx = createAudioContext();
    if (!ctx) return false;
    this.ctx = ctx;
    // Mobile browsers can hand back a suspended context even inside a user
    // gesture; resuming here keeps the tap that started playback.
    if (ctx.state === "suspended") void ctx.resume?.();
    this.voice = createVoice(ctx, ctx.destination, frequency, patch);
    this.voice.level.gain.value = patch.amplitude;
    this.voice.modulator.start();
    this.voice.carrier.start();
    return true;
  }

  update(frequency: number, patch: FmPatch): void {
    if (!this.voice || !this.ctx) return;
    const now = this.ctx.currentTime;
    const { carrier, modulator, depth, level } = this.voice;
    carrier.frequency.setTargetAtTime(frequency, now, 0.01);
    modulator.frequency.setTargetAtTime(frequency * patch.ratio, now, 0.01);
    depth.gain.setTargetAtTime(
      patch.index * frequency * patch.ratio,
      now,
      0.01,
    );
    level.gain.setTargetAtTime(patch.amplitude, now, 0.01);
  }

  stop(): void {
    if (this.voice) {
      for (const osc of [this.voice.modulator, this.voice.carrier]) {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      }
      disposeVoice(this.voice);
      this.voice = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

type PatchField =
  | "frequency"
  | "amplitude"
  | "ratio"
  | "index"
  | "attack"
  | "decay"
  | "sustain"
  | "release";

/**
 * `<nbplay-fm-synth>`: a two-operator FM synth. A sine modulator at
 * `ratio` times the note's frequency moves the frequency of a sine carrier
 * by `index` times the modulator's frequency, and an ADSR shapes each
 * note. The preview shows the patch's waveform; play/stop sounds a test
 * tone at `frequency` on a private AudioContext. As a session instrument
 * (`sessionId`, `channelIndex`) it registers `bus.instruments[channelIndex]`
 * so sequencers, launcher slots and MIDI clips on its track play through
 * it. Parameter edits fire `nbplay-set`; `isPlaying` fires `nbplay-status`.
 */
export class NbplayFmSynth extends NbplayElement {
  static properties = {
    frequency: { type: Number },
    amplitude: { type: Number },
    ratio: { type: Number },
    index: { type: Number },
    attack: { type: Number },
    decay: { type: Number },
    sustain: { type: Number },
    release: { type: Number },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    channelIndex: { type: Number, attribute: "channel-index" },
    isPlaying: { type: Boolean, attribute: "is-playing", reflect: true },
  };

  declare frequency: number;
  declare amplitude: number;
  declare ratio: number;
  declare index: number;
  declare attack: number;
  declare decay: number;
  declare sustain: number;
  declare release: number;
  declare sessionId: string;
  declare channelIndex: number;
  declare isPlaying: boolean;

  private tone = new FmTone();
  private registration: {
    bus: SessionBus;
    idx: number;
    entry: InstrumentBus;
  } | null = null;
  private liveNotes = new Set<() => void>();

  constructor() {
    super();
    this.frequency = 440;
    this.amplitude = 0.5;
    this.ratio = 2;
    this.index = 2;
    this.attack = 0.005;
    this.decay = 0.2;
    this.sustain = 0.6;
    this.release = 0.2;
    this.sessionId = "";
    this.channelIndex = -1;
    this.isPlaying = false;
  }

  /** The current sound, as each scheduled note takes it. */
  patch(): FmPatch {
    return {
      amplitude: Number(this.amplitude) || 0,
      ratio: Number(this.ratio) || 0,
      index: Number(this.index) || 0,
      attack: Number(this.attack) || 0,
      decay: Number(this.decay) || 0,
      sustain: Number(this.sustain) || 0,
      release: Number(this.release) || 0,
    };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-fm-synth");
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
      this.tone.update(this.frequency, this.patch());
    }
  }

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
        const cancel: () => void = scheduleFmNote(
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

  private startTone(): void {
    if (this.tone.start(this.frequency, this.patch())) return;
    this.isPlaying = false;
    this.status();
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

  private param(
    cls: string,
    label: string,
    prop: PatchField,
    kind: string,
    min: number,
    max: number,
    step: number,
    defaultValue: number,
    control: "slider" | "dial" = "slider",
    scale = "linear",
  ) {
    const on = (e: Event) => {
      e.stopPropagation();
      const value = (e as CustomEvent).detail.value as number;
      if (value === this[prop]) return;
      this[prop] = value;
      this.emitDetail("nbplay-set", { values: { [prop]: value } });
    };
    return html`<nbplay-param
      class=${cls}
      .label=${label}
      .kind=${kind}
      .control=${control}
      .scale=${scale}
      .value=${Number(this[prop])}
      .min=${min}
      .max=${max}
      .step=${step}
      .defaultValue=${defaultValue}
      .precision=${2}
      @input=${on}
      @change=${on}
    ></nbplay-param>`;
  }

  render() {
    return html`<nbplay-header badge="fm synth"></nbplay-header>
      <nbplay-waveform
        class="nbplay-fm-waveform"
        variant="glow"
        .data=${fmWaveform(this.patch())}
      ></nbplay-waveform>
      <div class="nbplay-fm-params">
        ${this.param("nbplay-fm-frequency", "Frequency", "frequency", "hz", 20, 8000, 0.1, 440, "slider", "log")}
        ${this.param("nbplay-fm-amplitude", "Amplitude", "amplitude", "float", 0, 1, 0.01, 0.5)}
        ${this.param("nbplay-fm-ratio", "Ratio", "ratio", "float", 0.25, 16, 0.01, 2)}
        ${this.param("nbplay-fm-index", "Index", "index", "float", 0, 20, 0.01, 2)}
      </div>
      <div class="nbplay-fm-envelope">
        <nbplay-envelope
          class="nbplay-fm-env-canvas"
          .attack=${Number(this.attack)}
          .decay=${Number(this.decay)}
          .sustain=${Number(this.sustain)}
          .release=${Number(this.release)}
        ></nbplay-envelope>
        <div class="nbplay-fm-env-controls">
          ${this.param("nbplay-fm-attack", "Attack", "attack", "seconds", 0, 2, 0.001, 0.005, "dial")}
          ${this.param("nbplay-fm-decay", "Decay", "decay", "seconds", 0, 2, 0.001, 0.2, "dial")}
          ${this.param("nbplay-fm-sustain", "Sustain", "sustain", "percent", 0, 1, 0.01, 0.6, "dial")}
          ${this.param("nbplay-fm-release", "Release", "release", "seconds", 0, 5, 0.001, 0.2, "dial")}
        </div>
      </div>
      <div class="nbplay-fm-transport">
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
      </div>`;
  }
}

define("nbplay-fm-synth", NbplayFmSynth);
