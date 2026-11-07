import { html } from "lit";
import { NbplayElement, define } from "./base.ts";

export interface MidiPortSpec {
  id: string;
  name: string;
}

export type MidiPortStatus = "idle" | "connected" | "unsupported" | "error";

/**
 * `<nbplay-midi-port>`: a MIDI port picker: select, refresh button and a
 * status pill. `ports` is the enumerated list, `value` the selected port id
 * (empty for none). Fires `change` with `detail.value` (port id) and
 * `nbplay-refresh` when the host should re-enumerate.
 */
export class NbplayMidiPort extends NbplayElement {
  static properties = {
    ports: { attribute: false },
    value: { type: String },
    status: { type: String, reflect: true },
    label: { type: String },
    emptyText: { type: String, attribute: "empty-text" },
    disabled: { type: Boolean, reflect: true },
  };

  declare ports: MidiPortSpec[];
  declare value: string;
  declare status: MidiPortStatus;
  declare label: string;
  declare emptyText: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.ports = [];
    this.value = "";
    this.status = "idle";
    this.label = "";
    this.emptyText = "Not connected";
    this.disabled = false;
  }

  render() {
    const stop = (e: Event) => e.stopPropagation();
    const statusText = {
      idle: "Idle",
      connected: "Connected",
      unsupported: "Web MIDI unavailable",
      error: "Error",
    }[this.status];
    return html`${
        this.label
          ? html`<span class="nbplay-midi-port-label">${this.label}</span>`
          : ""
      }
      <select
        class="nbplay-midi-port-select"
        title="MIDI port"
        ?disabled=${this.disabled || this.status === "unsupported"}
        @input=${stop}
        @change=${(e: Event) => {
          e.stopPropagation();
          this.value = (e.target as HTMLSelectElement).value;
          this.emit("change", this.value);
        }}
      >
        <option value="" ?selected=${!this.value}>${this.emptyText}</option>
        ${this.ports.map(
          (p) =>
            html`<option
              value=${p.id}
              ?selected=${p.id === this.value}
              .textContent=${p.name}
            ></option>`,
        )}
      </select>
      <button
        type="button"
        class="nbplay-midi-port-refresh"
        title="Refresh ports"
        ?disabled=${this.disabled}
        @click=${() => this.emitDetail("nbplay-refresh", {})}
      >
        ↻
      </button>
      <span class="nbplay-midi-port-status">${statusText}</span>`;
  }

  updated(): void {
    // Keep the native select on the current id when `ports` arrives after `value`.
    const select = this.querySelector(
      ".nbplay-midi-port-select",
    ) as HTMLSelectElement | null;
    if (select && select.value !== this.value) select.value = this.value;
  }
}

define("nbplay-midi-port", NbplayMidiPort);
