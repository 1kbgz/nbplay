import { html, nothing } from "lit";
import { noteName } from "../pads.ts";
import { NbplayElement, define } from "./base.ts";

export type Zone = "upper" | "lower";

interface KeyDef {
  key: string; // computer key label, "" for a gap
  semitone: number; // offset from the zone's octave root
  black: boolean;
}

// Logic Pro musical-typing layout: two computer-keyboard zones, each a sharp
// row above a natural row. Shared with the keyboard instrument's key handling.
export const UPPER_SHARP_ROW: KeyDef[] = [
  { key: "2", semitone: 1, black: true },
  { key: "3", semitone: 3, black: true },
  { key: "", semitone: -1, black: false },
  { key: "5", semitone: 6, black: true },
  { key: "6", semitone: 8, black: true },
  { key: "7", semitone: 10, black: true },
  { key: "", semitone: -1, black: false },
  { key: "9", semitone: 13, black: true },
  { key: "0", semitone: 15, black: true },
];
export const UPPER_NATURAL_ROW: KeyDef[] = [
  { key: "Q", semitone: 0, black: false },
  { key: "W", semitone: 2, black: false },
  { key: "E", semitone: 4, black: false },
  { key: "R", semitone: 5, black: false },
  { key: "T", semitone: 7, black: false },
  { key: "Y", semitone: 9, black: false },
  { key: "U", semitone: 11, black: false },
  { key: "I", semitone: 12, black: false },
  { key: "O", semitone: 14, black: false },
  { key: "P", semitone: 16, black: false },
];
export const LOWER_SHARP_ROW: KeyDef[] = [
  { key: "A", semitone: 1, black: true },
  { key: "S", semitone: 3, black: true },
  { key: "", semitone: -1, black: false },
  { key: "F", semitone: 6, black: true },
  { key: "G", semitone: 8, black: true },
  { key: "H", semitone: 10, black: true },
  { key: "", semitone: -1, black: false },
  { key: "K", semitone: 13, black: true },
  { key: "L", semitone: 15, black: true },
];
export const LOWER_NATURAL_ROW: KeyDef[] = [
  { key: "Z", semitone: 0, black: false },
  { key: "X", semitone: 2, black: false },
  { key: "C", semitone: 4, black: false },
  { key: "V", semitone: 5, black: false },
  { key: "B", semitone: 7, black: false },
  { key: "N", semitone: 9, black: false },
  { key: "M", semitone: 11, black: false },
  { key: ",", semitone: 12, black: false },
  { key: ".", semitone: 14, black: false },
];

const KEY_TO_SEMITONE: Record<string, { semitone: number; zone: Zone }> = {};
for (const [rows, zone] of [
  [[UPPER_SHARP_ROW, UPPER_NATURAL_ROW], "upper"],
  [[LOWER_SHARP_ROW, LOWER_NATURAL_ROW], "lower"],
] as Array<[KeyDef[][], Zone]>) {
  for (const row of rows) {
    for (const def of row) {
      if (def.key) {
        KEY_TO_SEMITONE[def.key.toLowerCase()] = {
          semitone: def.semitone,
          zone,
        };
      }
    }
  }
}

/** Map a computer key to a MIDI note for the given zone octaves, or `null`. */
export function keyToNote(
  key: string,
  upperOctave: number,
  lowerOctave: number,
): { note: number; zone: Zone } | null {
  const hit = KEY_TO_SEMITONE[key.toLowerCase()];
  if (!hit) return null;
  const octave = hit.zone === "upper" ? upperOctave : lowerOctave;
  return { note: (octave + 1) * 12 + hit.semitone, zone: hit.zone };
}

const PIANO_BLACK_AFTER_WHITE: Record<number, number> = {
  1: 0,
  3: 1,
  6: 3,
  8: 4,
  10: 5,
};
const PIANO_WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/**
 * `<nbplay-key-rows>`: playable keys. `layout="rows"` is the four-row
 * computer-keyboard layout (upper and lower zones, each with its own octave);
 * `layout="piano"` is a run of piano octaves. Pointer presses fire
 * `nbplay-note-on` ({note, velocity, zone}) and `nbplay-note-off` ({note, zone});
 * `pressed` highlights notes held elsewhere (computer keys, MIDI).
 */
export class NbplayKeyRows extends NbplayElement {
  static properties = {
    layout: { type: String, reflect: true },
    upperOctave: { type: Number, attribute: "upper-octave" },
    lowerOctave: { type: Number, attribute: "lower-octave" },
    startOctave: { type: Number, attribute: "start-octave" },
    octaves: { type: Number },
    velocity: { type: Number },
    pressed: { attribute: false },
    disabled: { type: Boolean, reflect: true },
  };

  declare layout: "rows" | "piano";
  declare upperOctave: number;
  declare lowerOctave: number;
  declare startOctave: number;
  declare octaves: number;
  declare velocity: number;
  declare pressed: number[];
  declare disabled: boolean;

  private held = new Map<number, { note: number; zone: Zone }>();
  private heldNotes = new Set<number>();

  constructor() {
    super();
    this.layout = "rows";
    this.upperOctave = 3;
    this.lowerOctave = 4;
    this.startOctave = 3;
    this.octaves = 2;
    this.velocity = 100;
    this.pressed = [];
    this.disabled = false;
  }

  private isPressed(note: number): boolean {
    return this.heldNotes.has(note) || this.pressed.includes(note);
  }

  render() {
    return this.layout === "piano" ? this.renderPiano() : this.renderRows();
  }

  private renderRows() {
    const zone = (
      name: Zone,
      label: string,
      sharp: KeyDef[],
      natural: KeyDef[],
    ) => {
      const octave = name === "upper" ? this.upperOctave : this.lowerOctave;
      return html`<div class="nbplay-keys-zone" data-zone=${name}>
        <div class="nbplay-keys-zone-label">${label}</div>
        <div class="nbplay-keys-row nbplay-keys-row-sharp">
          ${sharp.map((d) => this.renderKey(d, octave, name))}
        </div>
        <div class="nbplay-keys-row nbplay-keys-row-natural">
          ${natural.map((d) => this.renderKey(d, octave, name))}
        </div>
      </div>`;
    };
    return html`${zone("upper", "UPPER", UPPER_SHARP_ROW, UPPER_NATURAL_ROW)}
    ${zone("lower", "LOWER", LOWER_SHARP_ROW, LOWER_NATURAL_ROW)}`;
  }

  private renderKey(def: KeyDef, octave: number, zone: Zone) {
    if (!def.key) return html`<div class="nbplay-keys-gap"></div>`;
    const note = (octave + 1) * 12 + def.semitone;
    return html`<div
      class="nbplay-keys-key ${def.black ? "nbplay-keys-black" : "nbplay-keys-white"} ${this.isPressed(note) ? "pressed" : ""}"
      data-key=${def.key.toLowerCase()}
      data-note=${note}
      @pointerdown=${(e: PointerEvent) => this.down(e, note, zone)}
      @pointerup=${this.up}
      @pointercancel=${this.up}
      @lostpointercapture=${this.up}
    >
      <span class="nbplay-keys-key-label">${def.key}</span>
      <span class="nbplay-keys-key-note">${noteName(note)}</span>
    </div>`;
  }

  private renderPiano() {
    const whites: Array<{ note: number }> = [];
    const blacks: Array<{ note: number; index: number }> = [];
    for (let o = 0; o < this.octaves; o++) {
      const root = (this.startOctave + o + 1) * 12;
      for (const s of PIANO_WHITE_SEMITONES) whites.push({ note: root + s });
      for (const [s, after] of Object.entries(PIANO_BLACK_AFTER_WHITE)) {
        blacks.push({ note: root + Number(s), index: o * 7 + after });
      }
    }
    const zoneOf = (note: number): Zone => (note < 60 ? "lower" : "upper");
    const key = (note: number, black: boolean, index?: number) =>
      html`<div
        class="nbplay-keys-key ${black ? "nbplay-keys-black" : "nbplay-keys-white"} ${this.isPressed(note) ? "pressed" : ""}"
        data-note=${note}
        style=${black ? `--nbplay-key-index: ${index}` : nothing}
        @pointerdown=${(e: PointerEvent) => this.down(e, note, zoneOf(note))}
        @pointerup=${this.up}
        @pointercancel=${this.up}
        @lostpointercapture=${this.up}
      >
        ${note % 12 === 0 ? html`<span class="nbplay-keys-key-note">${noteName(note)}</span>` : nothing}
      </div>`;
    return html`<div
      class="nbplay-keys-piano"
      style="--nbplay-key-count: ${whites.length}"
    >
      ${whites.map((w) => key(w.note, false))}
      ${blacks.map((b) => key(b.note, true, b.index))}
    </div>`;
  }

  private down(e: PointerEvent, note: number, zone: Zone): void {
    if (this.disabled || e.button !== 0) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
    if (this.held.has(e.pointerId)) this.release(e.pointerId);
    this.held.set(e.pointerId, { note, zone });
    this.heldNotes.add(note);
    this.requestUpdate();
    this.emitDetail("nbplay-note-on", { note, velocity: this.velocity, zone });
  }

  private up = (e: PointerEvent): void => {
    this.release(e.pointerId);
  };

  private release(pointerId: number): void {
    const held = this.held.get(pointerId);
    if (!held) return;
    this.held.delete(pointerId);
    this.heldNotes.delete(held.note);
    this.requestUpdate();
    this.emitDetail("nbplay-note-off", { note: held.note, zone: held.zone });
  }

  /** Release every pointer-held note (blur, disconnect). */
  releaseAll(): void {
    for (const id of this.held.keys()) this.release(id);
  }
}

define("nbplay-key-rows", NbplayKeyRows);
