import { html, nothing } from "lit";
import { NbplayElement, define } from "./base.ts";
import {
  EFFECT_TYPES,
  type EffectDescriptor,
  effectEnabled,
  effectLabel,
} from "./effects.ts";

/**
 * `<nbplay-effect-rack>`: an insert chain. An add row (type select and
 * button), one chip per effect (click toggles bypass, ✎ opens an inline
 * `nbplay-effect-editor`, × removes). `types` lists the addable types.
 * Events: `nbplay-effect-add` `{type}`, `nbplay-effect-remove` `{index}`,
 * `change` `{index, field, value}` for bypass (`field: "enabled"`) and for
 * parameter edits (`field` is the parameter key).
 */
export class NbplayEffectRack extends NbplayElement {
  static properties = {
    effects: { attribute: false },
    types: { attribute: false },
    editing: { type: Number },
    disabled: { type: Boolean, reflect: true },
  };

  declare effects: EffectDescriptor[];
  declare types: string[];
  declare editing: number;
  declare disabled: boolean;

  constructor() {
    super();
    this.effects = [];
    this.types = EFFECT_TYPES;
    this.editing = -1;
    this.disabled = false;
  }

  render() {
    const stop = (e: Event) => e.stopPropagation();
    return html`<div class="nbplay-effect-rack-add">
        <select
          class="nbplay-effect-rack-type"
          title="Effect type"
          ?disabled=${this.disabled}
          @input=${stop}
          @change=${stop}
        >
          ${this.types.map((t) => html`<option value=${t}>${t}</option>`)}
        </select>
        <button
          type="button"
          class="nbplay-effect-rack-add-btn"
          title="Add effect"
          ?disabled=${this.disabled}
          @click=${this.add}
        >
          +
        </button>
      </div>
      <div class="nbplay-effect-rack-list">
        ${this.effects.map((fx, i) => this.renderItem(fx, i))}
      </div>`;
  }

  private renderItem(fx: EffectDescriptor, index: number) {
    const enabled = effectEnabled(fx);
    const open = this.editing === index;
    return html`<div class="nbplay-effect-rack-item" data-index=${index}>
      <div class="nbplay-effect-rack-chip-row">
        <button
          type="button"
          class="nbplay-effect-rack-chip ${enabled ? "" : "bypassed"}"
          title=${enabled ? "Bypass effect" : "Enable effect"}
          ?disabled=${this.disabled}
          @click=${() => this.emitDetail("change", { index, field: "enabled", value: !enabled })}
        >
          ${effectLabel(fx)}
        </button>
        <button
          type="button"
          class="nbplay-effect-rack-edit ${open ? "active" : ""}"
          title="Edit effect"
          ?disabled=${this.disabled}
          @click=${() => (this.editing = open ? -1 : index)}
        >
          ✎
        </button>
        <button
          type="button"
          class="nbplay-effect-rack-remove"
          title="Remove effect"
          ?disabled=${this.disabled}
          @click=${() => this.emitDetail("nbplay-effect-remove", { index })}
        >
          ×
        </button>
      </div>
      ${
        open
          ? html`<nbplay-effect-editor
              .effect=${fx}
              .disabled=${this.disabled}
              @input=${(e: Event) => e.stopPropagation()}
              @change=${(e: Event) => {
                e.stopPropagation();
                const { key, value } = (e as CustomEvent).detail;
                this.emitDetail("change", { index, field: key, value });
              }}
            ></nbplay-effect-editor>`
          : nothing
      }
    </div>`;
  }

  private add(): void {
    const select = this.querySelector(
      ".nbplay-effect-rack-type",
    ) as HTMLSelectElement | null;
    const type = select?.value || this.types[0];
    if (type) this.emitDetail("nbplay-effect-add", { type });
  }
}

define("nbplay-effect-rack", NbplayEffectRack);
