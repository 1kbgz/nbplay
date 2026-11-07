import { html } from "lit";
import { NbplayElement, define } from "./base.ts";

export interface SegmentOption {
  value: string;
  label?: string;
  title?: string;
  disabled?: boolean;
}

/**
 * `<nbplay-segmented>`: one-of-N button group (oscillator type, quantize,
 * step resolution). `options` are strings or `{value, label, title}`;
 * `value` is the selected option. Fires `change` with `detail.value`.
 */
export class NbplaySegmented extends NbplayElement {
  static properties = {
    options: { attribute: false },
    value: { type: String, reflect: true },
    label: { type: String },
    disabled: { type: Boolean, reflect: true },
  };

  declare options: Array<string | SegmentOption>;
  declare value: string;
  declare label: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.options = [];
    this.value = "";
    this.label = "";
    this.disabled = false;
  }

  render() {
    const opts = this.options.map((o) =>
      typeof o === "string" ? { value: o } : o,
    );
    return html`${
        this.label
          ? html`<span class="nbplay-segmented-label">${this.label}</span>`
          : ""
      }
      <div
        class="nbplay-segmented-group"
        role="radiogroup"
        aria-label=${this.label}
      >
        ${opts.map(
          (o) =>
            html`<button
              type="button"
              class="nbplay-segmented-option ${o.value === this.value ? "active" : ""}"
              role="radio"
              aria-checked=${String(o.value === this.value)}
              data-value=${o.value}
              title=${o.title ?? ""}
              ?disabled=${this.disabled || o.disabled}
              @click=${() => this.select(o.value)}
            >
              ${o.label ?? o.value}
            </button>`,
        )}
      </div>`;
  }

  private select(value: string): void {
    if (this.disabled || value === this.value) return;
    this.value = value;
    this.emit("change", value);
  }
}

define("nbplay-segmented", NbplaySegmented);
