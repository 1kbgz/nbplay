import { html, nothing } from "lit";
import { NbplayElement, define } from "./base.ts";
import { EFFECT_TYPES, type EffectDescriptor } from "./effects.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./effect-rack.ts";
import "./fader.ts";
import "./slider.ts";
import "./toggle.ts";
import "./value.ts";

export type StripKind = "channel" | "return" | "master";

/**
 * `<nbplay-strip>`: a mixer strip. `kind` selects the parts: `channel` has
 * name, fader, pan, mute/solo, sends, effects and remove; `return` has name,
 * fader, effects and remove; `master` has name, fader and effects.
 * Fires `input` and `change` with `{field, value}` (`gain`, `pan`, `mute`,
 * `solo`; sends as `{field: "send", index, value}`; effect parameters as
 * `{field: "effect", index, key, value}`), `nbplay-remove` `{}`, and lets the
 * rack's `nbplay-effect-add` / `nbplay-effect-remove` bubble through.
 */
export class NbplayStrip extends NbplayElement {
  static properties = {
    kind: { type: String, reflect: true },
    name: { type: String },
    gain: { type: Number },
    pan: { type: Number },
    mute: { type: Boolean },
    solo: { type: Boolean },
    sends: { attribute: false },
    sendNames: { attribute: false },
    effects: { attribute: false },
    effectTypes: { attribute: false },
    level: { type: Number },
    rms: { type: Number },
    editable: { type: Boolean },
    disabled: { type: Boolean, reflect: true },
  };

  declare kind: StripKind;
  declare name: string;
  declare gain: number;
  declare pan: number;
  declare mute: boolean;
  declare solo: boolean;
  declare sends: number[];
  declare sendNames: string[];
  declare effects: EffectDescriptor[];
  declare effectTypes: string[];
  declare level: number;
  declare rms: number;
  declare editable: boolean;
  declare disabled: boolean;

  constructor() {
    super();
    this.kind = "channel";
    this.name = "";
    this.gain = 0.8;
    this.pan = 0;
    this.mute = false;
    this.solo = false;
    this.sends = [];
    this.sendNames = [];
    this.effects = [];
    this.effectTypes = EFFECT_TYPES;
    this.level = 0;
    this.rms = 0;
    this.editable = true;
    this.disabled = false;
  }

  render() {
    const channel = this.kind === "channel";
    const stop = (e: Event) => e.stopPropagation();
    return html`<div class="nbplay-strip-name" title=${this.name}>
        ${this.name}
      </div>
      <nbplay-fader
        .value=${this.gain}
        .level=${this.level}
        .rms=${this.rms}
        .editable=${this.editable}
        .disabled=${this.disabled}
        @input=${(e: Event) => this.forward(e, "input", "gain")}
        @change=${(e: Event) => this.forward(e, "change", "gain")}
      ></nbplay-fader>
      ${
        channel
          ? html`<div class="nbplay-strip-pan">
                <nbplay-value
                  kind="pan"
                  .value=${this.pan}
                  .min=${-1}
                  .max=${1}
                  .editable=${this.editable && !this.disabled}
                  @input=${stop}
                  @change=${(e: Event) => this.forward(e, "change", "pan")}
                ></nbplay-value>
                <nbplay-slider
                  .value=${this.pan}
                  .min=${-1}
                  .max=${1}
                  .step=${0.01}
                  .disabled=${this.disabled}
                  @input=${(e: Event) => this.forward(e, "input", "pan")}
                  @change=${(e: Event) => this.forward(e, "change", "pan")}
                ></nbplay-slider>
              </div>
              <div class="nbplay-strip-buttons">
                <nbplay-toggle
                  variant="mute"
                  label="M"
                  title="Mute"
                  .active=${this.mute}
                  .disabled=${this.disabled}
                  @change=${(e: Event) => this.forward(e, "change", "mute")}
                ></nbplay-toggle>
                <nbplay-toggle
                  variant="solo"
                  label="S"
                  title="Solo"
                  .active=${this.solo}
                  .disabled=${this.disabled}
                  @change=${(e: Event) => this.forward(e, "change", "solo")}
                ></nbplay-toggle>
              </div>
              ${
                this.sendNames.length
                  ? html`<div class="nbplay-strip-sends">
                      ${this.sendNames.map(
                        (name, index) =>
                          html`<label
                            class="nbplay-strip-send"
                            title="Send to ${name}"
                          >
                            <span>${name}</span>
                            <nbplay-slider
                              .value=${this.sends[index] ?? 0}
                              .min=${0}
                              .max=${1}
                              .step=${0.01}
                              .disabled=${this.disabled}
                              @input=${(e: Event) => this.forwardSend(e, "input", index)}
                              @change=${(e: Event) => this.forwardSend(e, "change", index)}
                            ></nbplay-slider>
                          </label>`,
                      )}
                    </div>`
                  : nothing
              }`
          : nothing
      }
      <nbplay-effect-rack
        .effects=${this.effects}
        .types=${this.effectTypes}
        .disabled=${this.disabled}
        @input=${stop}
        @change=${(e: Event) => {
          e.stopPropagation();
          const { index, field, value } = (e as CustomEvent).detail;
          this.emitDetail("change", {
            field: "effect",
            index,
            key: field,
            value,
          });
        }}
        @nbplay-effect-editing=${(e: Event) => {
          // The host widens an editing strip; the event also bubbles for it.
          this.classList.toggle(
            "editing",
            (e as CustomEvent).detail.index >= 0,
          );
        }}
      ></nbplay-effect-rack>
      ${
        this.kind === "master"
          ? nothing
          : html`<button
              type="button"
              class="nbplay-strip-remove"
              title=${channel ? "Remove channel" : "Remove return bus"}
              ?disabled=${this.disabled}
              @click=${() => this.emitDetail("nbplay-remove", {})}
            >
              ×
            </button>`
      }`;
  }

  private forward(
    e: Event,
    name: string,
    field: "gain" | "pan" | "mute" | "solo",
  ): void {
    e.stopPropagation();
    const value = (e as CustomEvent).detail.value;
    (this as unknown as Record<string, unknown>)[field] = value;
    this.emitDetail(name, { field, value });
  }

  private forwardSend(e: Event, name: string, index: number): void {
    e.stopPropagation();
    const value = (e as CustomEvent).detail.value as number;
    const sends = [...this.sends];
    sends[index] = value;
    this.sends = sends;
    this.emitDetail(name, { field: "send", index, value });
  }
}

define("nbplay-strip", NbplayStrip);
