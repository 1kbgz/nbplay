import { html } from "lit";
import { NbplayElement, clamp, define } from "./base.ts";

/**
 * `<nbplay-drum-grid>`: a drum pattern, one row per pad. `pattern` holds a
 * velocity per pad per step (0 is off) and `names` labels the rows. A click
 * toggles a step between off and `velocity`; the wheel on a step that is on
 * moves its velocity by 5. Both fire `change` with `{pad, step, value}`. A
 * click on a row's name fires `nbplay-select` with `{pad}`. Every `group`
 * steps start a new beat. `current-step` and `selected` are display state
 * owned by the host.
 */
export class NbplayDrumGrid extends NbplayElement {
  static properties = {
    pattern: { attribute: false },
    names: { attribute: false },
    currentStep: { type: Number, attribute: "current-step" },
    selected: { type: Number },
    velocity: { type: Number },
    group: { type: Number },
  };

  declare pattern: number[][];
  declare names: string[];
  declare currentStep: number;
  declare selected: number;
  declare velocity: number;
  declare group: number;

  constructor() {
    super();
    this.pattern = [];
    this.names = [];
    this.currentStep = -1;
    this.selected = -1;
    this.velocity = 100;
    this.group = 4;
  }

  render() {
    const steps = this.pattern[0]?.length ?? 0;
    const group = Math.max(1, Math.round(Number(this.group) || 4));
    return html`${this.pattern.map(
      (row, pad) =>
        html`<div
          class="nbplay-drum-grid-row ${pad === this.selected ? "selected" : ""}"
          data-pad=${pad}
        >
          <button
            type="button"
            class="nbplay-drum-grid-name"
            title=${this.names[pad] ?? `Pad ${pad + 1}`}
            @click=${() => this.emitDetail("nbplay-select", { pad })}
          >
            ${this.names[pad] ?? `Pad ${pad + 1}`}
          </button>
          ${Array.from({ length: steps }, (_, step) => {
            const value = row[step] ?? 0;
            const classes = [
              "nbplay-drum-grid-cell",
              value > 0 ? "on" : "",
              step === this.currentStep ? "current" : "",
              step % group === 0 ? "beat" : "",
            ].join(" ");
            return html`<div
              class=${classes}
              data-step=${step}
              style=${value > 0 ? `--nbplay-drum-velocity: ${value / 127}` : ""}
              title="${this.names[pad] ?? `Pad ${pad + 1}`} step ${step + 1}${value > 0 ? `: ${value}` : ""}"
              @click=${() => this.set(pad, step, value > 0 ? 0 : this.velocity)}
              @wheel=${(e: WheelEvent) => this.onWheel(e, pad, step, value)}
            ></div>`;
          })}
        </div>`,
    )}`;
  }

  private set(pad: number, step: number, value: number): void {
    const pattern = this.pattern.map((row) => row.slice());
    if (!pattern[pad] || pattern[pad][step] === value) return;
    pattern[pad][step] = value;
    this.pattern = pattern;
    this.emitDetail("change", { pad, step, value });
  }

  private onWheel(e: WheelEvent, pad: number, step: number, value: number) {
    if (value <= 0) return;
    e.preventDefault();
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    if (delta === 0) return;
    this.set(pad, step, clamp(value + (delta < 0 ? 5 : -5), 1, 127));
  }
}

define("nbplay-drum-grid", NbplayDrumGrid);
