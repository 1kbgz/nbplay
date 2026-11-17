import { html, nothing } from "lit";
import { NbplayElement, clamp, define } from "./base.ts";
import { trackPress } from "./cells.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./bar.ts";

/**
 * `<nbplay-drum-grid>`: a step pattern, one row per pad (or note). `pattern`
 * holds a velocity per row per step (0 is off) and `names` labels the rows.
 * Its steps are the pad grid's squares, smaller, with the same gestures
 * (`cells.ts`): a click toggles a step between off and `velocity`, a vertical
 * drag sets its velocity (top is loudest) and turns it on, firing `input`
 * while it moves, and the wheel on a step that is on moves its velocity by 5.
 * Every edit ends in `change` with `{pad, step, value}`. A click on a row's
 * name fires `nbplay-select` with `{pad}`. Every `group`
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
              title="${this.names[pad] ?? `Pad ${pad + 1}`} step ${step + 1}${value > 0 ? `: ${value}` : ""}"
              @pointerdown=${(e: PointerEvent) => this.onPress(e, pad, step, value)}
              @wheel=${(e: WheelEvent) => this.onWheel(e, pad, step, value)}
            >
              ${
                value > 0
                  ? html`<nbplay-bar
                      class="nbplay-drum-grid-vel"
                      .value=${value}
                      .min=${0}
                      .max=${127}
                    ></nbplay-bar>`
                  : nothing
              }
            </div>`;
          })}
        </div>`,
    )}`;
  }

  private onPress(e: PointerEvent, pad: number, step: number, value: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    trackPress(e, e.currentTarget as HTMLElement, {
      onTap: () => this.set(pad, step, value > 0 ? 0 : this.velocity),
      onDrag: (velocity) => this.set(pad, step, velocity, "input"),
      onDrop: (velocity) => this.set(pad, step, velocity, "change", true),
    });
  }

  private set(
    pad: number,
    step: number,
    value: number,
    event: "input" | "change" = "change",
    force = false,
  ): void {
    const pattern = this.pattern.map((row) => row.slice());
    if (!pattern[pad] || (pattern[pad][step] === value && !force)) return;
    pattern[pad][step] = value;
    this.pattern = pattern;
    this.emitDetail(event, { pad, step, value });
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
