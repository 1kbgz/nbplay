import { html } from "lit";
import { NbplayElement, define } from "./base.ts";

/**
 * `<nbplay-position>`: a bar and beat readout. `format="bar:beat"` pads the
 * bar to `pad` digits with a `:` separator (transport); `"bar.beat"` is the
 * compact timeline form.
 */
export class NbplayPosition extends NbplayElement {
  static properties = {
    beat: { type: Number },
    beatsPerBar: { type: Number, attribute: "beats-per-bar" },
    format: { type: String, reflect: true },
    pad: { type: Number },
  };

  declare beat: number;
  declare beatsPerBar: number;
  declare format: "bar:beat" | "bar.beat";
  declare pad: number;

  constructor() {
    super();
    this.beat = 0;
    this.beatsPerBar = 4;
    this.format = "bar:beat";
    this.pad = 3;
  }

  get bar(): number {
    return (
      Math.floor(Math.max(0, this.beat) / Math.max(1, this.beatsPerBar)) + 1
    );
  }

  get beatInBar(): number {
    return (
      (Math.floor(Math.max(0, this.beat)) % Math.max(1, this.beatsPerBar)) + 1
    );
  }

  render() {
    const padded =
      this.format === "bar:beat"
        ? String(this.bar).padStart(this.pad, "0")
        : String(this.bar);
    const sep = this.format === "bar:beat" ? ":" : ".";
    return html`<span class="nbplay-position-bar">${padded}</span
      ><span class="nbplay-position-sep">${sep}</span
      ><span class="nbplay-position-beat">${this.beatInBar}</span>`;
  }
}

define("nbplay-position", NbplayPosition);
