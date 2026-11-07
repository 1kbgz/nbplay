import { html } from "lit";
import { NbplayElement, define } from "./base.ts";

/** One line for a raw MIDI message. */
export function fmtMidiMsg(data: ArrayLike<number>): string {
  if (!data || data.length === 0) return "";
  const status = data[0];
  const type = status & 0xf0;
  const ch = (status & 0x0f) + 1;

  if (type === 0x90 && data.length >= 3)
    return `NoteOn  ch=${ch} note=${data[1]} vel=${data[2]}`;
  if (type === 0x80 && data.length >= 3)
    return `NoteOff ch=${ch} note=${data[1]} vel=${data[2]}`;
  if (type === 0xb0 && data.length >= 3)
    return `CC      ch=${ch} ctrl=${data[1]} val=${data[2]}`;
  if (type === 0xc0 && data.length >= 2)
    return `PgmChg  ch=${ch} pgm=${data[1]}`;
  if (type === 0xe0 && data.length >= 3) {
    const val = data[1] | (data[2] << 7);
    return `Bend    ch=${ch} val=${val}`;
  }
  if (status === 0xf8) return "Clock";
  if (status === 0xfa) return "Start";
  if (status === 0xfc) return "Stop";
  if (status === 0xfb) return "Continue";
  return `Raw [${Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ")}]`;
}

/**
 * `<nbplay-midi-log>`: the last `max` MIDI messages, newest first. `entries`
 * holds raw messages (byte arrays) or preformatted strings; `push(data)`
 * prepends one and trims. Display only.
 */
export class NbplayMidiLog extends NbplayElement {
  static properties = {
    entries: { attribute: false },
    max: { type: Number },
    label: { type: String },
    emptyText: { type: String, attribute: "empty-text" },
  };

  declare entries: Array<ArrayLike<number> | string>;
  declare max: number;
  declare label: string;
  declare emptyText: string;

  constructor() {
    super();
    this.entries = [];
    this.max = 8;
    this.label = "";
    this.emptyText = "";
  }

  /** Prepend a message and drop the oldest beyond `max`. */
  push(data: ArrayLike<number> | string): void {
    this.entries = [data, ...this.entries].slice(0, this.max);
  }

  render() {
    const shown = this.entries.slice(0, this.max);
    return html`${this.label ? html`<div class="nbplay-midi-log-label">${this.label}</div>` : ""}
      <div class="nbplay-midi-log-entries">
        ${
          shown.length
            ? shown.map(
                (entry) =>
                  html`<div
                    class="nbplay-midi-log-entry"
                    .textContent=${typeof entry === "string" ? entry : fmtMidiMsg(entry)}
                  ></div>`,
              )
            : html`<div class="nbplay-midi-log-empty">${this.emptyText}</div>`
        }
      </div>`;
  }
}

define("nbplay-midi-log", NbplayMidiLog);
