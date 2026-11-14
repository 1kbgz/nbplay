import { html, type PropertyValues } from "lit";
import { cssVar } from "../helpers.ts";
import { getSessionBus } from "../session.ts";
import { NbplayElement, define } from "./base.ts";
import "./header.ts";

export const FFT_SIZES = [256, 512, 1024, 2048, 4096, 8192, 16384];

export interface SpectrumScale {
  width: number;
  height: number;
  minDb: number;
  maxDb: number;
  minFrequency: number;
  maxFrequency: number;
}

/** The x position of `frequency` on a log axis from `minFrequency` to `maxFrequency`. */
export function frequencyX(frequency: number, scale: SpectrumScale): number {
  const span = Math.log(scale.maxFrequency / scale.minFrequency);
  return (Math.log(frequency / scale.minFrequency) / span) * scale.width;
}

/**
 * One y per pixel column for analyser `bins` (dB per FFT bin up to half
 * `sampleRate`). A column that covers several bins shows the loudest one;
 * between bins, at the low end, the level is interpolated.
 */
export function spectrumLine(
  bins: Float32Array,
  sampleRate: number,
  scale: SpectrumScale,
): number[] {
  const binHz = sampleRate / 2 / bins.length;
  const ratio = scale.maxFrequency / scale.minFrequency;
  const at = (x: number) => scale.minFrequency * ratio ** (x / scale.width);
  const level = (index: number) =>
    bins[Math.max(0, Math.min(bins.length - 1, index))];
  const line: number[] = [];
  for (let x = 0; x < scale.width; x++) {
    const from = at(x) / binHz;
    const to = at(x + 1) / binHz;
    let db: number;
    if (Math.floor(to) > Math.floor(from)) {
      db = -Infinity;
      for (let i = Math.ceil(from); i <= Math.floor(to); i++)
        db = Math.max(db, level(i));
    } else {
      const low = Math.floor(from);
      db = level(low) + (level(low + 1) - level(low)) * (from - low);
    }
    const height = (db - scale.minDb) / (scale.maxDb - scale.minDb);
    line.push(scale.height * (1 - Math.max(0, Math.min(1, height))));
  }
  return line;
}

/** The loudest bin between the scale's frequency limits, or null below `minDb`. */
export function spectrumPeak(
  bins: Float32Array,
  sampleRate: number,
  scale: SpectrumScale,
): { frequency: number; db: number } | null {
  const binHz = sampleRate / 2 / bins.length;
  let best = -1;
  for (let i = 1; i < bins.length; i++) {
    const frequency = i * binHz;
    if (frequency < scale.minFrequency || frequency > scale.maxFrequency)
      continue;
    if (best < 0 || bins[i] > bins[best]) best = i;
  }
  if (best < 0 || !(bins[best] > scale.minDb)) return null;
  return { frequency: best * binHz, db: bins[best] };
}

function formatHz(frequency: number): string {
  return frequency >= 1000
    ? `${(frequency / 1000).toFixed(frequency >= 10000 ? 1 : 2)} kHz`
    : `${Math.round(frequency)} Hz`;
}

/**
 * `<nbplay-spectrum>`: a spectrum analyzer for a session's master bus, or
 * for mixer channel `channelIndex` when it is zero or more. It listens after
 * the insert chain, on the mixer's own meter tap, so it adds nothing to the
 * signal path. The curve is drawn on a log-frequency, dB grid with the
 * loudest frequency read out below; an `fftSize` pick fires `nbplay-set`.
 * Outside a session, or before the mixer exists, it shows the empty grid.
 */
export class NbplaySpectrum extends NbplayElement {
  static properties = {
    fftSize: { type: Number, attribute: "fft-size" },
    smoothing: { type: Number },
    minDb: { type: Number, attribute: "min-db" },
    maxDb: { type: Number, attribute: "max-db" },
    minFrequency: { type: Number, attribute: "min-frequency" },
    maxFrequency: { type: Number, attribute: "max-frequency" },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    channelIndex: { type: Number, attribute: "channel-index" },
    peak: { state: true },
  };

  declare fftSize: number;
  declare smoothing: number;
  declare minDb: number;
  declare maxDb: number;
  declare minFrequency: number;
  declare maxFrequency: number;
  declare sessionId: string;
  declare channelIndex: number;
  /** The loudest frequency of the last frame, or null when it is silent. */
  declare peak: { frequency: number; db: number } | null;

  private tapped: { source: AudioNode; analyser: AnalyserNode } | null = null;
  private bins = new Float32Array(0);
  private frame = 0;
  private observer?: ResizeObserver;

  constructor() {
    super();
    this.fftSize = 2048;
    this.smoothing = 0.8;
    this.minDb = -100;
    this.maxDb = -20;
    this.minFrequency = 20;
    this.maxFrequency = 20000;
    this.sessionId = "";
    this.channelIndex = -1;
    this.peak = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-spectrum");
    document.addEventListener("nbplay-bus-ready", this.onBusReady);
    this.tap();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("nbplay-bus-ready", this.onBusReady);
    this.observer?.disconnect();
    this.observer = undefined;
    this.untap();
  }

  protected firstUpdated(): void {
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(this);
  }

  updated(changed: PropertyValues): void {
    if (changed.has("sessionId") || changed.has("channelIndex")) this.tap();
    else if (changed.has("fftSize") || changed.has("smoothing"))
      this.configure();
    if (!changed.has("peak")) this.draw();
  }

  private onBusReady = (e: Event): void => {
    if ((e as CustomEvent).detail?.sessionId === this.sessionId) this.tap();
  };

  // The mixer keeps a meter analyser at the end of every chain; an analyser
  // passes its input through, so a second one fed from it hears the same
  // signal and survives the chain being rebuilt.
  private tap(): void {
    this.untap();
    const bus = this.sessionId ? getSessionBus(this.sessionId) : undefined;
    const index = Number(this.channelIndex);
    const source =
      index >= 0 ? bus?.channels?.[index]?.analyser : bus?.masterAnalyser;
    if (!bus?.audioCtx?.createAnalyser || !source) return;
    const analyser = bus.audioCtx.createAnalyser();
    source.connect(analyser);
    this.tapped = { source, analyser };
    this.configure();
    this.frame = requestAnimationFrame(this.tick);
  }

  private untap(): void {
    cancelAnimationFrame(this.frame);
    if (!this.tapped) return;
    try {
      this.tapped.source.disconnect(this.tapped.analyser);
    } catch {
      // The mixer already disconnected its tap.
    }
    this.tapped = null;
    this.peak = null;
  }

  private configure(): void {
    if (!this.tapped) return;
    const { analyser } = this.tapped;
    analyser.fftSize = FFT_SIZES.includes(this.fftSize) ? this.fftSize : 2048;
    analyser.smoothingTimeConstant = Math.max(
      0,
      Math.min(0.99, Number(this.smoothing) || 0),
    );
    this.bins = new Float32Array(analyser.frequencyBinCount);
  }

  private tick = (): void => {
    this.draw();
    this.frame = requestAnimationFrame(this.tick);
  };

  private scale(width: number, height: number): SpectrumScale {
    return {
      width,
      height,
      minDb: this.minDb,
      maxDb: this.maxDb,
      minFrequency: this.minFrequency,
      maxFrequency: this.maxFrequency,
    };
  }

  private draw(): void {
    const canvas = this.querySelector("canvas");
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr))
      canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr))
      canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = this.scale(w, h);

    ctx.fillStyle = cssVar(this, "--nbplay-chart-bg", "#121214");
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = cssVar(this, "--nbplay-chart-grid", "#2f2f36");
    ctx.fillStyle = cssVar(this, "--nbplay-fg-muted", "#a8a59c");
    ctx.font = "10px " + cssVar(this, "--nbplay-font-mono", "monospace");
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.textBaseline = "top";
    for (const frequency of [100, 1000, 10000]) {
      if (frequency <= this.minFrequency || frequency >= this.maxFrequency)
        continue;
      const x = Math.round(frequencyX(frequency, scale)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.fillText(
        frequency >= 1000 ? `${frequency / 1000}k` : `${frequency}`,
        x + 3,
        2,
      );
    }
    ctx.textBaseline = "bottom";
    for (let db = Math.ceil(this.minDb / 20) * 20; db < this.maxDb; db += 20) {
      if (db <= this.minDb) continue;
      const y =
        Math.round(h * (1 - (db - this.minDb) / (this.maxDb - this.minDb))) +
        0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillText(`${db} dB`, 3, y - 1);
    }
    ctx.setLineDash([]);

    if (!this.tapped || this.bins.length === 0) return;
    const { analyser } = this.tapped;
    analyser.getFloatFrequencyData(this.bins);
    const sampleRate = analyser.context.sampleRate;
    const line = spectrumLine(this.bins, sampleRate, scale);
    const color = cssVar(this, "--nbplay-chart-line", "#f28c38");
    ctx.beginPath();
    ctx.moveTo(0, h);
    line.forEach((y, x) => ctx.lineTo(x, y));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    line.forEach((y, x) => (x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    const peak = spectrumPeak(this.bins, sampleRate, scale);
    // Re-render the readout only when it would read differently.
    if (
      Math.round(peak?.frequency ?? -1) !==
        Math.round(this.peak?.frequency ?? -1) ||
      Math.round((peak?.db ?? 0) * 10) !== Math.round((this.peak?.db ?? 0) * 10)
    )
      this.peak = peak;
  }

  render() {
    const source =
      Number(this.channelIndex) >= 0
        ? `Channel ${Number(this.channelIndex) + 1}`
        : "Master";
    return html`<nbplay-header badge="spectrum"></nbplay-header>
      <canvas class="nbplay-spectrum-canvas"></canvas>
      <div class="nbplay-spectrum-info">
        <span class="nbplay-spectrum-source">${source}</span>
        <span class="nbplay-spectrum-peak"
          >${
            this.peak
              ? `${formatHz(this.peak.frequency)}  ${this.peak.db.toFixed(1)} dB`
              : "—"
          }</span
        >
        <label class="nbplay-spectrum-fft">
          FFT
          <select
            @change=${(e: Event) => {
              this.fftSize = Number((e.target as HTMLSelectElement).value);
              this.emitDetail("nbplay-set", {
                values: { fftSize: this.fftSize },
              });
            }}
          >
            ${FFT_SIZES.map(
              (size) =>
                html`<option value=${size} ?selected=${size === this.fftSize}>
                  ${size}
                </option>`,
            )}
          </select>
        </label>
      </div>`;
  }
}

define("nbplay-spectrum", NbplaySpectrum);
