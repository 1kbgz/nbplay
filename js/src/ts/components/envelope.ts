import { html } from "lit";
import { cssVar } from "../helpers.ts";
import { NbplayElement, define } from "./base.ts";

const HOLD = 0.3; // seconds of sustain drawn between decay and release

/** `<nbplay-envelope>`: an ADSR shape display. Times are seconds, sustain 0..1. */
export class NbplayEnvelope extends NbplayElement {
  static properties = {
    attack: { type: Number },
    decay: { type: Number },
    sustain: { type: Number },
    release: { type: Number },
  };

  declare attack: number;
  declare decay: number;
  declare sustain: number;
  declare release: number;

  private observer?: ResizeObserver;

  constructor() {
    super();
    this.attack = 0.005;
    this.decay = 0.1;
    this.sustain = 0.8;
    this.release = 0.1;
  }

  render() {
    return html`<canvas class="nbplay-envelope-canvas"></canvas>`;
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
    const line = cssVar(this, "--nbplay-chart-line", "#f28c38");
    const text = cssVar(this, "--nbplay-fg-muted", "#a8a59c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const total = this.attack + this.decay + HOLD + this.release || 1;
    const sx = w / total;
    const top = 8;
    const bottom = h - 14;
    const sy = (level: number) => bottom - level * (bottom - top);
    const a = this.attack * sx;
    const d = a + this.decay * sx;
    const s = d + HOLD * sx;

    ctx.beginPath();
    ctx.moveTo(0, bottom);
    ctx.lineTo(a, sy(1));
    ctx.lineTo(d, sy(this.sustain));
    ctx.lineTo(s, sy(this.sustain));
    ctx.lineTo(w, bottom);
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.lineTo(0, bottom);
    ctx.closePath();
    ctx.fillStyle = line;
    ctx.globalAlpha = 0.15;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = text;
    ctx.font = "10px " + cssVar(this, "--nbplay-font-mono", "monospace");
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const labels: Array<[string, number]> = [
      ["A", a / 2],
      ["D", (a + d) / 2],
      ["S", (d + s) / 2],
      ["R", (s + w) / 2],
    ];
    for (const [label, x] of labels) {
      ctx.fillText(label, Math.min(Math.max(x, 6), w - 6), h - 2);
    }
  }
}

define("nbplay-envelope", NbplayEnvelope);
