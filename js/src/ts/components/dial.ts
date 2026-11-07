import { html, svg } from "lit";
import { NbplayElement, clamp, define, quantize } from "./base.ts";

const SWEEP = 270; // degrees of travel
const START = -135; // angle of `min`, measured clockwise from 12 o'clock
const DRAG_PIXELS = 150; // vertical pixels for a full min..max sweep

function polar(angleDeg: number, r: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
}

function arc(a0: number, a1: number, r: number): string {
  const [x0, y0] = polar(a0, r);
  const [x1, y1] = polar(a1, r);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/**
 * `<nbplay-dial>`: a rotary control. Drag vertically (Shift for fine), scroll,
 * or use the arrow, Page, Home and End keys. Fires `input` while moving and
 * `change` on release, both with `detail.value`. A double-click resets to
 * `default-value` when one is set.
 */
export class NbplayDial extends NbplayElement {
  static properties = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    defaultValue: { type: Number, attribute: "default-value" },
    disabled: { type: Boolean, reflect: true },
    dragging: { type: Boolean, reflect: true },
  };

  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare defaultValue: number | null;
  declare disabled: boolean;
  declare dragging: boolean;

  private startY = 0;
  private startValue = 0;

  constructor() {
    super();
    this.value = 0;
    this.min = 0;
    this.max = 1;
    this.step = 0.01;
    this.defaultValue = null;
    this.disabled = false;
    this.dragging = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    this.setAttribute("role", "slider");
    this.addEventListener("pointerdown", this.onPointerDown);
    this.addEventListener("pointermove", this.onPointerMove);
    this.addEventListener("pointerup", this.onPointerUp);
    this.addEventListener("lostpointercapture", this.onPointerUp);
    this.addEventListener("wheel", this.onWheel, { passive: false });
    this.addEventListener("keydown", this.onKeydown);
    this.addEventListener("dblclick", this.onDblclick);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("pointerdown", this.onPointerDown);
    this.removeEventListener("pointermove", this.onPointerMove);
    this.removeEventListener("pointerup", this.onPointerUp);
    this.removeEventListener("lostpointercapture", this.onPointerUp);
    this.removeEventListener("wheel", this.onWheel);
    this.removeEventListener("keydown", this.onKeydown);
    this.removeEventListener("dblclick", this.onDblclick);
  }

  protected updated(): void {
    this.setAttribute("aria-valuemin", String(this.min));
    this.setAttribute("aria-valuemax", String(this.max));
    this.setAttribute("aria-valuenow", String(this.value));
    this.setAttribute("aria-disabled", String(this.disabled));
  }

  private fraction(): number {
    return this.max > this.min
      ? clamp((this.value - this.min) / (this.max - this.min), 0, 1)
      : 0;
  }

  render() {
    const angle = START + this.fraction() * SWEEP;
    const [ix, iy] = polar(angle, 30);
    return html`<svg
      class="nbplay-dial-svg"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      ${svg`<path class="nbplay-dial-track" d=${arc(START, START + SWEEP, 40)} />`}
      ${svg`<path class="nbplay-dial-arc" d=${arc(START, Math.max(angle, START + 0.01), 40)} />`}
      ${svg`<circle class="nbplay-dial-cap" cx="50" cy="50" r="30" />`}
      ${svg`<line class="nbplay-dial-indicator" x1="50" y1="50" x2=${ix} y2=${iy} />`}
    </svg>`;
  }

  private set(v: number, commit: boolean): void {
    const next = clamp(quantize(v, this.step), this.min, this.max);
    if (next !== this.value) {
      this.value = next;
      this.emit("input", next);
    }
    if (commit) this.emit("change", this.value);
  }

  /** Reset to `defaultValue`, emitting `input` and `change`, when one is set. */
  reset(): void {
    if (this.disabled || this.defaultValue === null) return;
    this.dragging = false;
    this.set(this.defaultValue, true);
  }

  private onDblclick = (): void => this.reset();

  private onPointerDown = (e: PointerEvent): void => {
    if (this.disabled || e.button !== 0) return;
    e.preventDefault();
    this.focus();
    this.setPointerCapture(e.pointerId);
    this.dragging = true;
    this.startY = e.clientY;
    this.startValue = this.value;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const pixels = e.shiftKey ? DRAG_PIXELS * 4 : DRAG_PIXELS;
    const delta = ((this.startY - e.clientY) / pixels) * (this.max - this.min);
    this.set(this.startValue + delta, false);
  };

  private onPointerUp = (): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.emit("change", this.value);
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.disabled) return;
    e.preventDefault();
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    if (delta === 0) return;
    this.set(this.value + (delta < 0 ? this.step : -this.step), true);
  };

  private onKeydown = (e: KeyboardEvent): void => {
    if (this.disabled) return;
    const big = this.step * 10;
    const moves: Record<string, number> = {
      ArrowUp: this.step,
      ArrowRight: this.step,
      ArrowDown: -this.step,
      ArrowLeft: -this.step,
      PageUp: big,
      PageDown: -big,
    };
    let next: number | undefined;
    if (e.key in moves) next = this.value + moves[e.key];
    else if (e.key === "Home") next = this.min;
    else if (e.key === "End") next = this.max;
    if (next === undefined) return;
    e.preventDefault();
    this.set(next, true);
  };
}

define("nbplay-dial", NbplayDial);
