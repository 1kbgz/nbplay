import { html } from "lit";
import { NbplayElement, define } from "./base.ts";
import type { ValueKind } from "./format.ts";

/**
 * `<nbplay-param>`: a labelled parameter: label, a slider or dial, and an
 * editable readout, kept in sync. `kind` picks the readout preset, `scale`
 * the slider mapping. Fires `input` and `change` with `detail.value`.
 * A tempo control is `<nbplay-param label="BPM" kind="bpm" min="30" max="300" step="1">`.
 */
export class NbplayParam extends NbplayElement {
  static properties = {
    label: { type: String },
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    scale: { type: String },
    kind: { type: String },
    control: { type: String, reflect: true },
    precision: { type: Number },
    unit: { type: String },
    editable: { type: Boolean },
    disabled: { type: Boolean, reflect: true },
  };

  declare label: string;
  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare scale: "linear" | "log";
  declare kind: ValueKind;
  declare control: "slider" | "dial";
  declare precision: number;
  declare unit: string;
  declare editable: boolean;
  declare disabled: boolean;

  constructor() {
    super();
    this.label = "";
    this.value = 0;
    this.min = 0;
    this.max = 1;
    this.step = 0.01;
    this.scale = "linear";
    this.kind = "float";
    this.control = "slider";
    this.precision = 2;
    this.unit = "";
    this.editable = true;
    this.disabled = false;
  }

  render() {
    const control =
      this.control === "dial"
        ? html`<nbplay-dial
            .value=${this.value}
            .min=${this.min}
            .max=${this.max}
            .step=${this.step}
            .disabled=${this.disabled}
            @input=${this.onInput}
            @change=${this.onChange}
          ></nbplay-dial>`
        : html`<nbplay-slider
            .value=${this.value}
            .min=${this.min}
            .max=${this.max}
            .step=${this.step}
            .scale=${this.scale}
            .disabled=${this.disabled}
            @input=${this.onInput}
            @change=${this.onChange}
          ></nbplay-slider>`;
    return html`<span class="nbplay-param-label">${this.label}</span>
      ${control}
      <nbplay-value
        .value=${this.value}
        .kind=${this.kind}
        .min=${this.min}
        .max=${this.max}
        .precision=${this.precision}
        .unit=${this.unit}
        .editable=${this.editable && !this.disabled}
        @change=${this.onChange}
      ></nbplay-value>`;
  }

  private onInput(e: Event): void {
    e.stopPropagation();
    this.value = (e as CustomEvent).detail.value as number;
    this.emit("input", this.value);
  }

  private onChange(e: Event): void {
    e.stopPropagation();
    this.value = (e as CustomEvent).detail.value as number;
    this.emit("change", this.value);
  }
}

define("nbplay-param", NbplayParam);
