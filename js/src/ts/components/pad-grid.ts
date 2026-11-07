import { html } from "lit";
import { clampMidiNote, clampVelocity, noteName } from "../pads.ts";
import { NbplayElement, clamp, define } from "./base.ts";
import type { NbplayValue } from "./value.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./bar.ts";

export interface PadSpec {
  note: number;
  velocity: number;
  /** A fixed label (trait and event actions); omitted pads show the note name. */
  label?: string;
}

const DRAG_THRESHOLD = 5; // px before a press becomes a velocity drag
const LABEL_TAP_DELAY_MS = 300; // so a double-click on the label can start an edit

/**
 * `<nbplay-pad-grid>`: a grid of trigger pads. A tap fires `nbplay-note-on`
 * ({index, note, velocity}) then `nbplay-note-off` on the next frame; with
 * `hold`, note-off waits for the pointer to lift. When `editable`, a vertical
 * drag sets the pad velocity (`input` while dragging, `change` on release),
 * the wheel moves the note by one (Shift: velocity by five), and a double-click
 * on the label edits the note name. `change` carries `{index, field, value}`.
 */
export class NbplayPadGrid extends NbplayElement {
  static properties = {
    rows: { type: Number },
    cols: { type: Number },
    pads: { attribute: false },
    active: { attribute: false },
    velocitySensitive: { type: Boolean, attribute: "velocity-sensitive" },
    hold: { type: Boolean },
    editable: { type: Boolean },
    disabled: { type: Boolean, reflect: true },
  };

  declare rows: number;
  declare cols: number;
  declare pads: PadSpec[];
  declare active: number[];
  declare velocitySensitive: boolean;
  declare hold: boolean;
  declare editable: boolean;
  declare disabled: boolean;

  private held = new Set<number>();
  private pendingTap?: ReturnType<typeof setTimeout>;
  private press?: {
    index: number;
    pointerId: number;
    startY: number;
    onLabel: boolean;
    dragging: boolean;
    cell: HTMLElement;
  };

  constructor() {
    super();
    this.rows = 4;
    this.cols = 4;
    this.pads = [];
    this.active = [];
    this.velocitySensitive = true;
    this.hold = false;
    this.editable = true;
    this.disabled = false;
  }

  private pad(index: number): PadSpec {
    return this.pads[index] ?? { note: 60 + index, velocity: 100 };
  }

  render() {
    const count = this.rows * this.cols;
    return html`<div
      class="nbplay-pad-grid-cells"
      style="grid-template-columns: repeat(${this.cols}, 1fr); grid-template-rows: repeat(${this.rows}, 1fr)"
    >
      ${Array.from({ length: count }, (_, i) => this.renderCell(i))}
    </div>`;
  }

  private renderCell(index: number) {
    const pad = this.pad(index);
    const lit = this.held.has(index) || this.active.includes(index);
    const title = `Pad ${index + 1}: ${pad.label ?? noteName(pad.note)}  vel=${pad.velocity}`;
    return html`<div
      class="nbplay-pad-cell ${lit ? "active" : ""}"
      data-index=${index}
      title=${title}
      @pointerdown=${(e: PointerEvent) => this.onPointerDown(e, index)}
      @pointermove=${this.onPointerMove}
      @pointerup=${this.onPointerUp}
      @pointercancel=${this.onPointerCancel}
      @lostpointercapture=${this.onPointerCancel}
      @wheel=${(e: WheelEvent) => this.onWheel(e, index)}
    >
      <nbplay-bar
        class="nbplay-pad-vel"
        .value=${pad.velocity}
        .max=${127}
        .min=${0}
      ></nbplay-bar>
      ${
        pad.label !== undefined
          ? html`<span class="nbplay-pad-label">${pad.label}</span>`
          : html`<nbplay-value
              class="nbplay-pad-label"
              kind="note"
              .value=${pad.note}
              .min=${0}
              .max=${127}
              .editable=${this.editable}
              @dblclick=${() => clearTimeout(this.pendingTap)}
              @change=${(e: Event) => this.onLabelChange(e, index)}
            ></nbplay-value>`
      }
    </div>`;
  }

  private tapVelocity(
    e: PointerEvent,
    cell: HTMLElement,
    index: number,
  ): number {
    const max = this.pad(index).velocity;
    if (!this.velocitySensitive) return max;
    const rect = cell.getBoundingClientRect();
    const frac = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    return clampVelocity(Math.round(20 + frac * (max - 20)));
  }

  private noteOn(index: number, velocity: number): void {
    this.held.add(index);
    this.requestUpdate();
    this.emitDetail("nbplay-note-on", {
      index,
      note: this.pad(index).note,
      velocity,
    });
  }

  private noteOff(index: number): void {
    if (!this.held.delete(index)) return;
    this.requestUpdate();
    this.emitDetail("nbplay-note-off", { index, note: this.pad(index).note });
  }

  private onPointerDown(e: PointerEvent, index: number): void {
    if (this.disabled || e.button !== 0) return;
    const cell = e.currentTarget as HTMLElement;
    const onLabel = (e.target as HTMLElement).closest("nbplay-value") !== null;
    if (!onLabel) {
      e.preventDefault();
      try {
        cell.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointer */
      }
    }
    this.press = {
      index,
      pointerId: e.pointerId,
      startY: e.clientY,
      onLabel,
      dragging: false,
      cell,
    };
    if (this.hold) this.noteOn(index, this.tapVelocity(e, cell, index));
  }

  private onPointerMove = (e: PointerEvent): void => {
    const p = this.press;
    if (!p || p.pointerId !== e.pointerId || !this.editable || this.hold)
      return;
    if (!p.dragging && Math.abs(e.clientY - p.startY) < DRAG_THRESHOLD) return;
    p.dragging = true;
    const rect = p.cell.getBoundingClientRect();
    const velocity = clampVelocity(
      Math.round((1 - (e.clientY - rect.top) / rect.height) * 127),
    );
    this.setPad(p.index, "velocity", velocity, "input");
  };

  private onPointerUp = (e: PointerEvent): void => {
    const p = this.press;
    if (!p || p.pointerId !== e.pointerId) return;
    this.press = undefined;
    if (this.hold) {
      this.noteOff(p.index);
      return;
    }
    if (p.dragging) {
      this.emitDetail("change", {
        index: p.index,
        field: "velocity",
        value: this.pad(p.index).velocity,
      });
      return;
    }
    const velocity = this.tapVelocity(e, p.cell, p.index);
    const tap = () => {
      this.noteOn(p.index, velocity);
      requestAnimationFrame(() => this.noteOff(p.index));
    };
    if (!p.onLabel) {
      tap();
      return;
    }
    const label = p.cell.querySelector("nbplay-value") as NbplayValue | null;
    clearTimeout(this.pendingTap);
    this.pendingTap = setTimeout(() => {
      this.pendingTap = undefined;
      if (!label?.editing) tap();
    }, LABEL_TAP_DELAY_MS);
  };

  private onPointerCancel = (e: PointerEvent): void => {
    const p = this.press;
    if (!p || p.pointerId !== e.pointerId) return;
    this.press = undefined;
    if (this.hold) this.noteOff(p.index);
    else if (p.dragging) {
      this.emitDetail("change", {
        index: p.index,
        field: "velocity",
        value: this.pad(p.index).velocity,
      });
    }
  };

  private onWheel(e: WheelEvent, index: number): void {
    if (!this.editable || this.disabled) return;
    e.preventDefault();
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    if (delta === 0) return;
    const pad = this.pad(index);
    if (e.shiftKey) {
      this.setPad(
        index,
        "velocity",
        clampVelocity(pad.velocity + (delta < 0 ? 5 : -5)),
        "change",
      );
    } else {
      this.setPad(
        index,
        "note",
        clampMidiNote(pad.note + (delta < 0 ? 1 : -1)),
        "change",
      );
    }
  }

  private onLabelChange(e: Event, index: number): void {
    e.stopPropagation();
    const value = (e as CustomEvent).detail?.value as number;
    this.setPad(index, "note", clampMidiNote(value), "change");
  }

  private setPad(
    index: number,
    field: "note" | "velocity",
    value: number,
    event: "input" | "change",
  ): void {
    const pad = this.pad(index);
    if (pad[field] === value) return;
    const pads = this.pads.slice();
    pads[index] = { ...pad, [field]: value };
    this.pads = pads;
    this.emitDetail(event, { index, field, value });
  }
}

define("nbplay-pad-grid", NbplayPadGrid);
