import { html, nothing } from "lit";
import { NbplayElement, define } from "./base.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./meter.ts";
import "./slider.ts";
import "./value.ts";

/**
 * `<nbplay-fader>`: a mixer fader: level meter, vertical gain slider (linear
 * 0..2) and an editable dB readout. `level`/`rms` feed the meter. Fires `input`
 * and `change` with the linear gain in `detail.value`.
 */
export class NbplayFader extends NbplayElement {
  static properties = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    level: { type: Number },
    rms: { type: Number },
    label: { type: String },
    editable: { type: Boolean },
    disabled: { type: Boolean, reflect: true },
  };

  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare level: number;
  declare rms: number;
  declare label: string;
  declare editable: boolean;
  declare disabled: boolean;

  constructor() {
    super();
    this.value = 0.8;
    this.min = 0;
    this.max = 2;
    this.step = 0.01;
    this.level = 0;
    this.rms = 0;
    this.label = "";
    this.editable = true;
    this.disabled = false;
  }

  render() {
    return html`${this.label ? html`<span class="nbplay-fader-label">${this.label}</span>` : nothing}
      <div class="nbplay-fader-body">
        <nbplay-meter .level=${this.level} .rms=${this.rms}></nbplay-meter>
        <nbplay-slider
          orientation="vertical"
          .value=${this.value}
          .min=${this.min}
          .max=${this.max}
          .step=${this.step}
          .disabled=${this.disabled}
          @input=${this.onInput}
          @change=${this.onChange}
        ></nbplay-slider>
      </div>
      <nbplay-value
        kind="db"
        .value=${this.value}
        .min=${this.min}
        .max=${this.max}
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

define("nbplay-fader", NbplayFader);
