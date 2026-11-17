import { html, nothing } from "lit";
import { noteName } from "../pads.ts";
import { NbplayElement, clamp, define } from "./base.ts";

/** One note of a MIDI clip, in beats from the clip's start. */
export interface RollNote {
  beat: number;
  duration: number;
  note: number;
  velocity: number;
}

/** Snap every note's start, and its length, to the `grid` (beats). */
export function quantizeNotes(notes: RollNote[], grid: number): RollNote[] {
  const step = Math.max(1 / 64, grid);
  const snap = (beat: number) => Math.round(beat / step) * step;
  return sortNotes(
    notes.map((n) => ({
      ...n,
      beat: Math.max(0, snap(n.beat)),
      duration: Math.max(step, snap(n.duration)),
    })),
  );
}

function sortNotes(notes: RollNote[]): RollNote[] {
  return [...notes].sort((a, b) => a.beat - b.beat || a.note - b.note);
}

const GRIDS = [
  { value: 1, label: "1/4" },
  { value: 0.5, label: "1/8" },
  { value: 0.25, label: "1/16" },
  { value: 0.125, label: "1/32" },
];
/** Pixels per beat and per row. */
const BEAT_PX = 48;
const ROW_PX = 14;
/** The right edge of a note, in pixels, that resizes it. */
const EDGE_PX = 6;

/**
 * `<nbplay-piano-roll>`: a MIDI clip's note editor. Rows are pitches (the
 * notes' range plus a margin, two octaves at least), columns are beats up to
 * `length`, split by `grid` (beats). A click on an empty cell adds a note one
 * grid step long; dragging a note moves it (snapped to the grid and to a row),
 * dragging its right edge resizes it, a double-click or Delete removes it, and
 * the wheel on a note moves its velocity by 5. Quantize snaps every note to
 * the grid. Each edit fires `change` with `{events}`, the clip's notes
 * sorted by beat; `grid` changes fire `nbplay-grid` with `{grid}`.
 */
export class NbplayPianoRoll extends NbplayElement {
  static properties = {
    events: { attribute: false },
    length: { type: Number },
    grid: { type: Number },
    selected: { state: true },
  };

  declare events: RollNote[];
  declare length: number;
  declare grid: number;
  /** The note Delete and the wheel act on. */
  declare selected: number;

  private drag?: {
    index: number;
    mode: "move" | "resize";
    pointerId: number;
    x: number;
    y: number;
    origin: RollNote;
    moved: boolean;
  };

  constructor() {
    super();
    this.events = [];
    this.length = 4;
    this.grid = 0.25;
    this.selected = -1;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.tabIndex = 0;
    this.addEventListener("keydown", this.onKey);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this.onKey);
  }

  private notes(): RollNote[] {
    return Array.isArray(this.events) ? this.events : [];
  }

  /** The pitches shown, highest first. */
  private rows(): number[] {
    const notes = this.notes().map((n) => n.note);
    let low = notes.length ? Math.min(...notes) - 4 : 48;
    let high = notes.length ? Math.max(...notes) + 4 : 71;
    while (high - low < 23) {
      low -= 1;
      high += 1;
    }
    low = clamp(low, 0, 127);
    high = clamp(high, 0, 127);
    return Array.from({ length: high - low + 1 }, (_, i) => high - i);
  }

  private step(): number {
    return Math.max(1 / 64, Number(this.grid) || 0.25);
  }

  private snap(beat: number): number {
    const step = this.step();
    return Math.max(0, Math.floor(beat / step + 1e-6) * step);
  }

  private write(notes: RollNote[]): void {
    const events = sortNotes(notes);
    this.events = events;
    this.emitDetail("change", { events });
  }

  private onKey = (e: KeyboardEvent): void => {
    if ((e.key !== "Delete" && e.key !== "Backspace") || this.selected < 0)
      return;
    e.preventDefault();
    this.removeNote(this.selected);
  };

  private removeNote(index: number): void {
    this.selected = -1;
    this.write(this.notes().filter((_, i) => i !== index));
  }

  private onGridDown(e: PointerEvent, rows: number[]): void {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const beat = this.snap((e.clientX - rect.left) / BEAT_PX);
    const row = Math.floor((e.clientY - rect.top) / ROW_PX);
    const note = rows[clamp(row, 0, rows.length - 1)];
    if (beat >= Number(this.length)) return;
    this.write([
      ...this.notes(),
      { beat, duration: this.step(), note, velocity: 100 },
    ]);
    this.selected = this.notes().findIndex(
      (n) => n.beat === beat && n.note === note,
    );
  }

  private onNoteDown(e: PointerEvent, index: number): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
    this.selected = index;
    this.focus();
    this.drag = {
      index,
      mode: rect.right - e.clientX <= EDGE_PX ? "resize" : "move",
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      origin: { ...this.notes()[index] },
      moved: false,
    };
  }

  private onNoteMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || d.pointerId !== e.pointerId) return;
    const beats = (e.clientX - d.x) / BEAT_PX;
    const rows = Math.round((e.clientY - d.y) / ROW_PX);
    if (
      !d.moved &&
      Math.abs(e.clientX - d.x) < 3 &&
      Math.abs(e.clientY - d.y) < 3
    )
      return;
    d.moved = true;
    const step = this.step();
    const notes = this.notes().map((n) => ({ ...n }));
    const target = notes[d.index];
    if (!target) return;
    if (d.mode === "move") {
      target.beat = clamp(
        Math.round((d.origin.beat + beats) / step) * step,
        0,
        Math.max(0, Number(this.length) - step),
      );
      target.note = clamp(d.origin.note - rows, 0, 127);
    } else {
      target.duration = Math.max(
        step,
        Math.round((d.origin.duration + beats) / step) * step,
      );
    }
    // Shown while dragging; written when the pointer lifts.
    this.events = notes;
  }

  private onNoteUp(e: PointerEvent): void {
    const d = this.drag;
    if (!d || d.pointerId !== e.pointerId) return;
    this.drag = undefined;
    if (!d.moved) return;
    const moved = this.notes()[d.index];
    this.write(this.notes());
    this.selected = this.notes().indexOf(moved);
  }

  private onNoteWheel(e: WheelEvent, index: number): void {
    e.preventDefault();
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    if (delta === 0) return;
    const notes = this.notes().map((n) => ({ ...n }));
    notes[index].velocity = clamp(
      notes[index].velocity + (delta < 0 ? 5 : -5),
      1,
      127,
    );
    this.selected = index;
    this.write(notes);
  }

  render() {
    const rows = this.rows();
    const length = Math.max(1, Number(this.length) || 4);
    const step = this.step();
    const width = length * BEAT_PX;
    const top = rows[0];
    return html`<div class="nbplay-roll-bar">
        <label class="nbplay-roll-field">
          <span>Grid</span>
          <select
            class="nbplay-roll-grid-select"
            @input=${(e: Event) => e.stopPropagation()}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.grid = parseFloat((e.target as HTMLSelectElement).value);
              this.emitDetail("nbplay-grid", { grid: this.grid });
            }}
          >
            ${GRIDS.map(
              (g) =>
                html`<option value=${g.value} ?selected=${g.value === step}>
                  ${g.label}
                </option>`,
            )}
          </select>
        </label>
        <button
          type="button"
          class="nbplay-roll-quantize"
          title="Snap every note to the grid"
          @click=${() => this.write(quantizeNotes(this.notes(), step))}
        >
          Quantize
        </button>
        <span class="nbplay-roll-count">${this.notes().length} notes</span>
      </div>
      <div class="nbplay-roll-body">
        <div class="nbplay-roll-keys">
          ${rows.map(
            (note) =>
              html`<div
                class="nbplay-roll-key ${[1, 3, 6, 8, 10].includes(note % 12) ? "black" : ""}"
              >
                ${note % 12 === 0 ? noteName(note) : nothing}
              </div>`,
          )}
        </div>
        <div class="nbplay-roll-scroll">
          <div
            class="nbplay-roll-grid"
            style="width: ${width}px; height: ${rows.length * ROW_PX}px; --nbplay-roll-step: ${step * BEAT_PX}px; --nbplay-roll-beat: ${BEAT_PX}px; --nbplay-roll-row: ${ROW_PX}px;"
            @pointerdown=${(e: PointerEvent) => this.onGridDown(e, rows)}
          >
            ${this.notes().map((n, index) => {
              if (n.note > top || n.note < rows[rows.length - 1])
                return nothing;
              return html`<div
                class="nbplay-roll-note ${index === this.selected ? "selected" : ""}"
                data-index=${index}
                title="${noteName(n.note)} at ${n.beat} for ${n.duration} beats, velocity ${n.velocity}"
                style="left: ${n.beat * BEAT_PX}px; top: ${(top - n.note) * ROW_PX}px; width: ${Math.max(4, n.duration * BEAT_PX - 1)}px; --nbplay-roll-velocity: ${n.velocity / 127};"
                @pointerdown=${(e: PointerEvent) => this.onNoteDown(e, index)}
                @pointermove=${(e: PointerEvent) => this.onNoteMove(e)}
                @pointerup=${(e: PointerEvent) => this.onNoteUp(e)}
                @pointercancel=${(e: PointerEvent) => this.onNoteUp(e)}
                @dblclick=${() => this.removeNote(index)}
                @wheel=${(e: WheelEvent) => this.onNoteWheel(e, index)}
              ></div>`;
            })}
          </div>
        </div>
      </div>`;
  }
}

define("nbplay-piano-roll", NbplayPianoRoll);
