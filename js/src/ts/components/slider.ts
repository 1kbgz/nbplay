import { html } from "lit";
import { NbplayElement, clamp, define, quantize } from "./base.ts";

/**
 * `<nbplay-slider>`: a range control wrapping a native `<input type="range">`
 * so keyboard and assistive-technology behavior come for free.
 *
 * `scale="log"` maps the native 0..1 position onto `min..max` logarithmically
 * (frequency sliders). While `dragging`, writes to `value` from outside are
 * ignored, so a host that mirrors model state never fights the pointer.
 *
 * Fires `input` continuously and `change` on commit, both with `detail.value`.
 */
export class NbplaySlider extends NbplayElement {
  static properties = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    orientation: { type: String, reflect: true },
    scale: { type: String },
    disabled: { type: Boolean, reflect: true },
    dragging: { type: Boolean, reflect: true },
  };

  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare orientation: "horizontal" | "vertical";
  declare scale: "linear" | "log";
  declare disabled: boolean;
  declare dragging: boolean;

  private internal = false;

  constructor() {
    super();
    this.value = 0;
    this.min = 0;
    this.max = 1;
    this.step = 0.01;
    this.orientation = "horizontal";
    this.scale = "linear";
    this.disabled = false;
    this.dragging = false;
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("value") && this.dragging && !this.internal) {
      this.value = changed.get("value") as number;
    }
  }

  private toPos(v: number): number {
    if (this.scale !== "log") return v;
    const lmin = Math.log(this.min);
    const lmax = Math.log(this.max);
    return (Math.log(Math.max(v, this.min)) - lmin) / (lmax - lmin);
  }

  private fromPos(p: number): number {
    if (this.scale !== "log") return p;
    const lmin = Math.log(this.min);
    const lmax = Math.log(this.max);
    return Math.exp(lmin + p * (lmax - lmin));
  }

  render() {
    const log = this.scale === "log";
    return html`<input
      type="range"
      class="nbplay-slider-input"
      min=${log ? 0 : this.min}
      max=${log ? 1 : this.max}
      step=${log ? 0.001 : this.step}
      .value=${String(this.toPos(this.value))}
      ?disabled=${this.disabled}
      aria-valuemin=${this.min}
      aria-valuemax=${this.max}
      aria-valuenow=${this.value}
      @input=${this.onInput}
      @change=${this.onChange}
      @pointerdown=${this.startDrag}
      @pointerup=${this.endDrag}
      @lostpointercapture=${this.endDrag}
    />`;
  }

  private readValue(e: Event): number {
    const raw = parseFloat((e.target as HTMLInputElement).value);
    return clamp(quantize(this.fromPos(raw), this.step), this.min, this.max);
  }

  private onInput(e: Event): void {
    e.stopPropagation();
    this.internal = true;
    this.value = this.readValue(e);
    this.internal = false;
    this.emit("input", this.value);
  }

  private onChange(e: Event): void {
    e.stopPropagation();
    this.endDrag();
    this.emit("change", this.value);
  }

  private startDrag(): void {
    if (!this.disabled) this.dragging = true;
  }

  private endDrag(): void {
    this.dragging = false;
  }
}

define("nbplay-slider", NbplaySlider);
