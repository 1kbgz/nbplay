import { html } from "lit";
import { NbplayElement, clamp, define } from "./base.ts";
import {
  type EffectDescriptor,
  type ParamSpec,
  paramSpecs,
} from "./effects.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./param.ts";

/**
 * `<nbplay-effect-editor>`: one row per parameter of an effect. Bounded
 * numbers get an `nbplay-param` dial, unbounded numbers a number input,
 * `options` a select, booleans a checkbox, strings a text input. `specs`
 * overrides the built-in table (plugin effects infer specs from their fields).
 * Fires `change` with `{key, value}`.
 */
export class NbplayEffectEditor extends NbplayElement {
  static properties = {
    effect: { attribute: false },
    specs: { attribute: false },
    disabled: { type: Boolean, reflect: true },
  };

  declare effect: EffectDescriptor;
  declare specs: ParamSpec[] | null;
  declare disabled: boolean;

  constructor() {
    super();
    this.effect = { type: "gain" };
    this.specs = null;
    this.disabled = false;
  }

  render() {
    const specs = this.specs ?? paramSpecs(this.effect);
    if (!specs.length) {
      return html`<span class="nbplay-effect-editor-none">No parameters</span>`;
    }
    return html`${specs.map((spec) => this.renderRow(spec))}`;
  }

  private renderRow(spec: ParamSpec) {
    const value = this.effect[spec.key];
    const stop = (e: Event) => e.stopPropagation();
    if (spec.kind === "select") {
      return html`<label class="nbplay-effect-editor-row">
        <span>${spec.label}</span>
        <select
          data-key=${spec.key}
          ?disabled=${this.disabled}
          @input=${stop}
          @change=${(e: Event) => {
            e.stopPropagation();
            this.commit(spec.key, (e.target as HTMLSelectElement).value);
          }}
        >
          ${(spec.options ?? []).map(
            (opt) =>
              html`<option value=${opt} ?selected=${opt === value}>
                ${opt}
              </option>`,
          )}
        </select>
      </label>`;
    }
    if (spec.kind === "bool") {
      return html`<label class="nbplay-effect-editor-row">
        <span>${spec.label}</span>
        <input
          type="checkbox"
          data-key=${spec.key}
          .checked=${Boolean(value)}
          ?disabled=${this.disabled}
          @input=${stop}
          @change=${(e: Event) => {
            e.stopPropagation();
            this.commit(spec.key, (e.target as HTMLInputElement).checked);
          }}
        />
      </label>`;
    }
    if (spec.kind === "text") {
      return html`<label class="nbplay-effect-editor-row">
        <span>${spec.label}</span>
        <input
          type="text"
          data-key=${spec.key}
          .value=${String(value ?? "")}
          ?disabled=${this.disabled}
          @input=${stop}
          @change=${(e: Event) => {
            e.stopPropagation();
            this.commit(spec.key, (e.target as HTMLInputElement).value);
          }}
        />
      </label>`;
    }
    const num = Number(value);
    if (spec.min !== undefined && spec.max !== undefined) {
      return html`<nbplay-param
        class="nbplay-effect-editor-param"
        control="dial"
        data-key=${spec.key}
        .label=${spec.label}
        .value=${Number.isFinite(num) ? num : spec.min}
        .min=${spec.min}
        .max=${spec.max}
        .step=${spec.step ?? 0.01}
        .defaultValue=${spec.default ?? null}
        .precision=${precisionFor(spec.step ?? 0.01)}
        .disabled=${this.disabled}
        @input=${stop}
        @change=${(e: Event) => {
          e.stopPropagation();
          this.commit(spec.key, (e as CustomEvent).detail.value);
        }}
      ></nbplay-param>`;
    }
    return html`<label class="nbplay-effect-editor-row">
      <span>${spec.label}</span>
      <input
        type="number"
        step="any"
        data-key=${spec.key}
        .value=${String(Number.isFinite(num) ? num : 0)}
        ?disabled=${this.disabled}
        @input=${stop}
        @change=${(e: Event) => {
          e.stopPropagation();
          const n = parseFloat((e.target as HTMLInputElement).value);
          if (Number.isFinite(n)) this.commit(spec.key, n);
        }}
      />
    </label>`;
  }

  private commit(key: string, value: unknown): void {
    const spec = (this.specs ?? paramSpecs(this.effect)).find(
      (s) => s.key === key,
    );
    if (spec?.kind === "number" && typeof value === "number") {
      value = clamp(value, spec.min ?? -Infinity, spec.max ?? Infinity);
    }
    this.effect = { ...this.effect, [key]: value };
    this.emitDetail("change", { key, value });
  }
}

function precisionFor(step: number): number {
  return Math.max(0, Math.ceil(-Math.log10(step)));
}

define("nbplay-effect-editor", NbplayEffectEditor);
