import { html, nothing } from "lit";
import { NbplayElement, define } from "./base.ts";

export type ToggleVariant =
  | "mute"
  | "solo"
  | "arm"
  | "monitor"
  | "record"
  | "play"
  | "loop"
  | "default";

/**
 * `<nbplay-toggle>`: a latching button. `variant` picks the active color
 * (mute, solo, arm, monitor, record, play, loop). Fires `change` with
 * `detail.value` set to the new `active` state.
 */
export class NbplayToggle extends NbplayElement {
  static properties = {
    active: { type: Boolean, reflect: true },
    variant: { type: String, reflect: true },
    label: { type: String },
    title: { type: String },
    disabled: { type: Boolean, reflect: true },
  };

  declare active: boolean;
  declare variant: ToggleVariant;
  declare label: string;
  declare title: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.active = false;
    this.variant = "default";
    this.label = "";
    this.title = "";
    this.disabled = false;
  }

  render() {
    return html`<button
      type="button"
      class="nbplay-toggle-button"
      aria-pressed=${String(this.active)}
      title=${this.title || nothing}
      ?disabled=${this.disabled}
      @click=${this.toggle}
    >
      ${this.label}
    </button>`;
  }

  toggle(): void {
    if (this.disabled) return;
    this.active = !this.active;
    this.emit("change", this.active);
  }
}

define("nbplay-toggle", NbplayToggle);
