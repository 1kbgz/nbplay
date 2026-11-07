import { html, nothing } from "lit";
import { NbplayElement, clamp, define } from "./base.ts";
import { editText, formatValue, parseValue, type ValueKind } from "./format.ts";

// Native input/change from the inner text field must not escape the element:
// only the element's own `change` (with `detail.value`) is the contract.
const stop = (e: Event): void => e.stopPropagation();

/**
 * `<nbplay-value>`: a formatted readout that turns into a text input on
 * double-click. Enter or blur commits, Escape cancels. Fires `change` with the
 * parsed, clamped value.
 */
export class NbplayValue extends NbplayElement {
  static properties = {
    value: { type: Number },
    kind: { type: String },
    min: { type: Number },
    max: { type: Number },
    precision: { type: Number },
    unit: { type: String },
    editable: { type: Boolean },
    editing: { type: Boolean, reflect: true },
  };

  declare value: number;
  declare kind: ValueKind;
  declare min: number;
  declare max: number;
  declare precision: number;
  declare unit: string;
  declare editable: boolean;
  declare editing: boolean;

  constructor() {
    super();
    this.value = 0;
    this.kind = "float";
    this.min = -Infinity;
    this.max = Infinity;
    this.precision = 2;
    this.unit = "";
    this.editable = true;
    this.editing = false;
  }

  /** The formatted text, as shown. */
  get text(): string {
    return formatValue(this.value, this.kind, this.precision, this.unit);
  }

  render() {
    if (this.editing) {
      return html`<input
        type="text"
        class="nbplay-value-input"
        .value=${editText(this.value, this.kind, this.precision)}
        @keydown=${this.onKeydown}
        @blur=${this.commit}
        @input=${stop}
        @change=${stop}
      />`;
    }
    return html`<span
      class="nbplay-value-text"
      title=${this.editable ? "Double-click to edit" : nothing}
      @dblclick=${this.startEdit}
      >${this.text}</span
    >`;
  }

  startEdit(): void {
    if (!this.editable || this.editing) return;
    this.editing = true;
    this.updateComplete.then(() => {
      const input = this.querySelector("input");
      input?.focus();
      input?.select();
    });
  }

  private onKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      this.commit();
    } else if (e.key === "Escape") {
      this.editing = false;
    }
  }

  private commit(): void {
    if (!this.editing) return;
    const input = this.querySelector("input");
    this.editing = false;
    if (!input) return;
    const parsed = parseValue(input.value, this.kind);
    if (parsed === null) return;
    const v = clamp(parsed, this.min, this.max);
    if (v === this.value) return;
    this.value = v;
    this.emit("change", v);
  }
}

define("nbplay-value", NbplayValue);
