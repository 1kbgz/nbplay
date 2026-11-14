import { html } from "lit";
import { type PropertyValues } from "lit";
import { createAudioContext, toFloat32 } from "../helpers.ts";
import {
  getSessionBus,
  type InstrumentBus,
  type SessionBus,
} from "../session.ts";
import { midiToHz } from "../voices.ts";
import { NbplayElement, define } from "./base.ts";
// Register the elements this one renders, for bundles that import only this module.
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
const MIN_FREQ = 20;
const MAX_FREQ = 8000;

/**
 * Play one note of an oscillator type on the session bus at a scheduled
 * time; noise plays a short burst. Returns a canceller.
 */
function scheduleSynthNote(
  ctx: AudioContext,
  output: AudioNode,
  type: string,
  amplitude: number,
  note: number,
  velocity: number,
  at: number,
  duration: number,
  onEnded: () => void,
): () => void {
  const level = Math.max(0, Math.min(1, amplitude)) * (velocity / 127);
  const attack = 0.005;
  const release = Math.min(0.05, duration * 0.2);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + attack);
  gain.gain.linearRampToValueAtTime(
    0,
    at + Math.max(attack, duration - release),
  );
  gain.connect(output);
  let source: AudioScheduledSourceNode;
  if (type === "noise") {
    const frames = Math.max(1, Math.round(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    source = node;
  } else {
    const osc = ctx.createOscillator();
    osc.type = (
      type === "square" || type === "saw" || type === "triangle"
        ? type.replace("saw", "sawtooth")
        : "sine"
    ) as globalThis.OscillatorType;
    osc.frequency.value = midiToHz(note);
    source = osc;
  }
  source.connect(gain);
  source.onended = () => {
    try {
      gain.disconnect();
    } catch {
      /* already disconnected */
    }
    onEnded();
  };
  source.start(at);
  source.stop(at + duration);
  return () => {
    try {
      source.stop(0);
      gain.disconnect();
    } catch {
      /* already stopped */
    }
    onEnded();
  };
}

/** The continuous tone: a private AudioContext at the configured rate. */
class ToneEngine {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | OscillatorNode | null = null;
  private gain: GainNode | null = null;

  start(type: string, freq: number, amp: number, sampleRate: number): boolean {
    this.stop();
    const ctx = createAudioContext({ sampleRate });
    if (!ctx) return false;
    this.ctx = ctx;
    // Mobile browsers can hand back a suspended context even inside a user
    // gesture; resuming here keeps the tap that started playback.
    if (ctx.state === "suspended") void ctx.resume?.();
    const gain = ctx.createGain();
    gain.gain.value = amp;
    gain.connect(ctx.destination);
    this.gain = gain;
    if (type === "noise") {
      const buf = ctx.createBuffer(1, sampleRate * 2, sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.connect(gain);
      s.start();
      this.source = s;
    } else {
      const osc = ctx.createOscillator();
      osc.type = (
        type === "saw" ? "sawtooth" : type
      ) as globalThis.OscillatorType;
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start();
      this.source = osc;
    }
    return true;
  }

  stop(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* already stopped */
      }
      this.source.disconnect();
      this.source = null;
    }
    if (this.gain) {
      this.gain.disconnect();
      this.gain = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  setFrequency(f: number): void {
    const osc = this.source as OscillatorNode | null;
    if (osc?.frequency && this.ctx) {
      osc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.01);
    }
  }

  setAmplitude(a: number): void {
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(a, this.ctx.currentTime, 0.01);
    }
  }
}

/**
 * `<nbplay-synth>`: the synth instrument: waveform preview, oscillator type,
 * frequency and amplitude, play/stop. The tone plays on a private
 * AudioContext at `sampleRate`; as a session instrument (`sessionId`,
 * `channelIndex`) it also registers `bus.instruments[channelIndex]` so
 * sequencers and clips on its track play through it. `oscillatorType`,
 * `frequency` and `amplitude` edits fire `nbplay-set`; `isPlaying` fires
 * `nbplay-status` (a start that fails without Web Audio reports `false`).
 * `waveform` is the preview samples (`Float32Array` or little-endian bytes).
 */
export class NbplaySynth extends NbplayElement {
  static properties = {
    oscillatorType: { type: String, attribute: "oscillator-type" },
    frequency: { type: Number },
    amplitude: { type: Number },
    sampleRate: { type: Number, attribute: "sample-rate" },
    waveform: { attribute: false },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    channelIndex: { type: Number, attribute: "channel-index" },
    isPlaying: { type: Boolean, attribute: "is-playing", reflect: true },
  };

  declare oscillatorType: OscillatorType;
  declare frequency: number;
  declare amplitude: number;
  declare sampleRate: number;
  declare waveform: unknown;
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
    this.oscillatorType = "sine";
    this.frequency = 440;
    this.amplitude = 0.5;
    this.sampleRate = 44100;
    this.waveform = null;
    this.sessionId = "";
    this.channelIndex = -1;
    this.isPlaying = false;
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
    }
  }

  // Session instrument: sequencers, launcher slots, and MIDI clips on this
  // synth's track play through it with its oscillator type and amplitude.

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
          this.oscillatorType || "sine",
          Number(this.amplitude) || 0,
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
      this.oscillatorType,
      this.frequency,
      this.amplitude,
      this.sampleRate,
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

  render() {
    const noise = this.oscillatorType === "noise";
    const onFreq = (e: Event) => {
      e.stopPropagation();
      const value = (e as CustomEvent).detail.value as number;
      if (value === this.frequency) return;
      this.frequency = value;
      this.tone.setFrequency(value);
      this.set({ frequency: value });
    };
    const onAmp = (e: Event) => {
      e.stopPropagation();
      const value = (e as CustomEvent).detail.value as number;
      if (value === this.amplitude) return;
      this.amplitude = value;
      this.tone.setAmplitude(value);
      this.set({ amplitude: value });
    };
    return html`<nbplay-header badge="synth"></nbplay-header>
      <nbplay-waveform
        class="nbplay-synth-waveform"
        variant="glow"
        .data=${toFloat32(this.waveform)}
      ></nbplay-waveform>
      <nbplay-segmented
        class="nbplay-osc"
        label="Oscillator"
        .options=${OSCILLATORS}
        .value=${this.oscillatorType}
        @change=${(e: Event) => {
          e.stopPropagation();
          this.oscillatorType = (e as CustomEvent).detail.value;
          this.set({ oscillatorType: this.oscillatorType });
          if (this.isPlaying) this.startTone();
        }}
      ></nbplay-segmented>
      <div class="nbplay-synth-params">
        <nbplay-param
          class="nbplay-freq"
          label="Frequency"
          kind="hz"
          scale="log"
          .value=${this.frequency}
          .min=${MIN_FREQ}
          .max=${MAX_FREQ}
          .step=${0.1}
          .defaultValue=${440}
          .disabled=${noise}
          @input=${onFreq}
          @change=${onFreq}
        ></nbplay-param>
        <nbplay-param
          class="nbplay-amp"
          label="Amplitude"
          kind="float"
          .value=${this.amplitude}
          .min=${0}
          .max=${1}
          .step=${0.01}
          .defaultValue=${0.8}
          .precision=${2}
          @input=${onAmp}
          @change=${onAmp}
        ></nbplay-param>
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
