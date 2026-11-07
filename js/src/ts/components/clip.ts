import { html } from "lit";
import { NbplayElement, define } from "./base.ts";

export type ClipKind = "audio" | "midi";

/**
 * `<nbplay-clip>`: one clip block: name, detail line, start and end trim
 * handles. Presentational: the lane positions it (`left`/`width`) and owns the
 * move and trim gestures, because only the lane knows the beat scale.
 * `kind`, `pattern`, `selected`, `muted`, `dragging` reflect for styling.
 */
export class NbplayClip extends NbplayElement {
  static properties = {
    clipId: { type: String, attribute: "clip-id", reflect: true },
    name: { type: String },
    detail: { type: String },
    kind: { type: String, reflect: true },
    pattern: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
    muted: { type: Boolean, reflect: true },
    dragging: { type: Boolean, reflect: true },
  };

  declare clipId: string;
  declare name: string;
  declare detail: string;
  declare kind: ClipKind;
  declare pattern: boolean;
  declare selected: boolean;
  declare muted: boolean;
  declare dragging: boolean;

  constructor() {
    super();
    this.clipId = "";
    this.name = "";
    this.detail = "";
    this.kind = "audio";
    this.pattern = false;
    this.selected = false;
    this.muted = false;
    this.dragging = false;
  }

  render() {
    return html`<i class="nbplay-clip-handle start"></i>
      <span class="nbplay-clip-name">${this.name}</span>
      <small class="nbplay-clip-detail">${this.detail}</small>
      <i class="nbplay-clip-handle end"></i>`;
  }
}

define("nbplay-clip", NbplayClip);
