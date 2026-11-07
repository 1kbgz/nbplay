import { html, nothing } from "lit";
import { NbplayElement, define } from "./base.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./bar.ts";

/**
 * `<nbplay-launcher-slot>`: one clip-launcher cell. `name` empty means an
 * empty slot (launching it stops the track). `active`, `queued`, `selected`
 * are host-owned display state; `progress` (0..1) fills the bar while the
 * clip plays. Fires `nbplay-launch` `{}` on click.
 */
export class NbplayLauncherSlot extends NbplayElement {
  static properties = {
    name: { type: String },
    active: { type: Boolean, reflect: true },
    queued: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
    progress: { type: Number },
    disabled: { type: Boolean, reflect: true },
  };

  declare name: string;
  declare active: boolean;
  declare queued: boolean;
  declare selected: boolean;
  declare progress: number;
  declare disabled: boolean;

  constructor() {
    super();
    this.name = "";
    this.active = false;
    this.queued = false;
    this.selected = false;
    this.progress = 0;
    this.disabled = false;
  }

  render() {
    const filled = this.name !== "";
    return html`<button
      type="button"
      class="nbplay-launcher-slot-button ${filled ? "filled" : "empty"}"
      title=${filled ? "Launch clip" : "Stop track"}
      ?disabled=${this.disabled}
      @click=${() => this.emitDetail("nbplay-launch", {})}
    >
      <nbplay-bar
        class="nbplay-launcher-slot-progress"
        orientation="horizontal"
        .value=${this.active ? this.progress : 0}
        .min=${0}
        .max=${1}
        .step=${0.001}
      ></nbplay-bar>
      <span class="nbplay-launcher-slot-name">
        ${filled ? this.name : html`<span class="nbplay-launcher-slot-empty-mark">■</span>`}
      </span>
      ${
        this.queued
          ? html`<span class="nbplay-launcher-slot-next"
              >${filled ? "next" : "stop"}</span
            >`
          : nothing
      }
    </button>`;
  }
}

define("nbplay-launcher-slot", NbplayLauncherSlot);
