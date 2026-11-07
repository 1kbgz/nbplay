import { html } from "lit";
import { cssVar, toFloat32 } from "../helpers.ts";
import { NbplayElement, define } from "./base.ts";

/**
 * `<nbplay-waveform>`: draws sample data on a canvas. `data` accepts a
 * `Float32Array`, an `ArrayBuffer`, or a `DataView` of little-endian `f32`
 * (the widget `waveform` bytes). `variant="glow"` adds the synth's glow pass.
 */
export class NbplayWaveform extends NbplayElement {
  static properties = {
    data: { attribute: false },
    variant: { type: String, reflect: true },
    emptyText: { type: String, attribute: "empty-text" },
  };

  declare data: Float32Array | ArrayBuffer | DataView | null;
  declare variant: "line" | "glow";
  declare emptyText: string;

  private observer?: ResizeObserver;

  constructor() {
    super();
    this.data = null;
    this.variant = "line";
    this.emptyText = "No sample loaded";
  }

  render() {
    return html`<canvas class="nbplay-waveform-canvas"></canvas>`;
  }

  protected firstUpdated(): void {
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
  }

  protected updated(): void {
    this.draw();
  }

  draw(): void {
    const canvas = this.querySelector("canvas");
    if (!canvas) return;
    const w = this.clientWidth;
    const h = this.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = cssVar(this, "--nbplay-chart-bg", "#121214");
    const grid = cssVar(this, "--nbplay-chart-grid", "#2f2f36");
    const line = cssVar(this, "--nbplay-chart-line", "#f28c38");
    const text = cssVar(this, "--nbplay-fg-muted", "#a8a59c");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    for (const f of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(0, f * h);
      ctx.lineTo(w, f * h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const samples = toFloat32(this.data);
    if (!samples || samples.length === 0) {
      ctx.fillStyle = text;
      ctx.font = "12px " + cssVar(this, "--nbplay-font-mono", "monospace");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.emptyText, w / 2, h / 2);
      return;
    }

    ctx.beginPath();
    const mid = h / 2;
    const amp = h * 0.45;
    for (let x = 0; x < w; x++) {
      const i = Math.floor((x / w) * samples.length);
      const y = mid - samples[i] * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (this.variant === "glow") {
      ctx.strokeStyle = line;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

define("nbplay-waveform", NbplayWaveform);
