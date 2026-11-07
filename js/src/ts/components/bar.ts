import { html } from "lit";
import { NbplayElement, clamp, define, quantize } from "./base.ts";

/**
 * `<nbplay-bar>`: a value bar (velocity, progress). `editable` lists the
 * gestures that change it: `"wheel"`, `"drag"`, or `"wheel drag"`; empty means
 * display only. Fires `input` and `change` with `detail.value`.
 */
export class NbplayBar extends NbplayElement {
  static properties = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    orientation: { type: String, reflect: true },
    editable: { type: String, reflect: true },
    wheelStep: { type: Number, attribute: "wheel-step" },
    disabled: { type: Boolean, reflect: true },
    dragging: { type: Boolean, reflect: true },
  };

  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare orientation: "horizontal" | "vertical";
  declare editable: string;
  declare wheelStep: number;
  declare disabled: boolean;
  declare dragging: boolean;

  constructor() {
    super();
    this.value = 0;
    this.min = 0;
    this.max = 127;
    this.step = 1;
    this.orientation = "vertical";
    this.editable = "";
    this.wheelStep = 1;
    this.disabled = false;
    this.dragging = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("wheel", this.onWheel, { passive: false });
    this.addEventListener("pointerdown", this.onPointerDown);
    this.addEventListener("pointermove", this.onPointerMove);
    this.addEventListener("pointerup", this.onPointerUp);
    this.addEventListener("lostpointercapture", this.onPointerUp);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("wheel", this.onWheel);
    this.removeEventListener("pointerdown", this.onPointerDown);
    this.removeEventListener("pointermove", this.onPointerMove);
    this.removeEventListener("pointerup", this.onPointerUp);
    this.removeEventListener("lostpointercapture", this.onPointerUp);
  }

  private can(gesture: "wheel" | "drag"): boolean {
    return !this.disabled && this.editable.split(/\s+/).includes(gesture);
  }

  get percent(): number {
    return this.max > this.min
      ? clamp((this.value - this.min) / (this.max - this.min), 0, 1) * 100
      : 0;
  }

  render() {
    return html`<div class="nbplay-bar-track">
      <div
        class="nbplay-bar-fill"
        style="--nbplay-bar-fill: ${this.percent}%"
      ></div>
    </div>`;
  }

  private set(v: number, commit: boolean): void {
    const next = clamp(quantize(v, this.step), this.min, this.max);
    if (next !== this.value) {
      this.value = next;
      this.emit("input", next);
    }
    if (commit) this.emit("change", this.value);
  }

  private fromPointer(e: PointerEvent): number {
    const rect = this.getBoundingClientRect();
    const f =
      this.orientation === "vertical"
        ? 1 - (e.clientY - rect.top) / rect.height
        : (e.clientX - rect.left) / rect.width;
    return this.min + clamp(f, 0, 1) * (this.max - this.min);
  }

  private onWheel = (e: WheelEvent): void => {
    if (!this.can("wheel")) return;
    e.preventDefault();
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    if (delta === 0) return;
    this.set(this.value + (delta < 0 ? this.wheelStep : -this.wheelStep), true);
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.can("drag") || e.button !== 0) return;
    e.preventDefault();
    this.setPointerCapture(e.pointerId);
    this.dragging = true;
    this.set(this.fromPointer(e), false);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dragging) this.set(this.fromPointer(e), false);
  };

  private onPointerUp = (): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.emit("change", this.value);
  };
}

define("nbplay-bar", NbplayBar);
