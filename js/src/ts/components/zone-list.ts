import { html } from "lit";
import { NbplayElement, define } from "./base.ts";
import { paletteColor } from "./zone-map.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./value.ts";

export interface ZoneRow {
  name: string;
  low: number;
  high: number;
  root: number;
  /** Preformatted info text (sample length). */
  info?: string;
  color?: string;
}

/**
 * `<nbplay-zone-list>`: one row per sampler zone: color swatch, name, low /
 * high / root as editable note names, info text, remove. Fires `change`
 * `{index, field, value}` (`name`, `low`, `high`, `root`),
 * `nbplay-zone-remove` `{index}`, and `nbplay-zone-select` `{index}` when a
 * row is clicked.
 */
export class NbplayZoneList extends NbplayElement {
  static properties = {
    zones: { attribute: false },
    selected: { type: Number },
    disabled: { type: Boolean, reflect: true },
  };

  declare zones: ZoneRow[];
  declare selected: number;
  declare disabled: boolean;

  constructor() {
    super();
    this.zones = [];
    this.selected = -1;
    this.disabled = false;
  }

  render() {
    return html`${this.zones.map((zone, index) => this.renderRow(zone, index))}`;
  }

  private renderRow(zone: ZoneRow, index: number) {
    const stop = (e: Event) => e.stopPropagation();
    const note = (field: "low" | "high" | "root", label: string) =>
      html`<label class="nbplay-zone-list-note">
        <span>${label}</span>
        <nbplay-value
          kind="note"
          .value=${zone[field]}
          .min=${0}
          .max=${127}
          .editable=${!this.disabled}
          @input=${stop}
          @change=${(e: Event) => {
            e.stopPropagation();
            this.commit(index, field, (e as CustomEvent).detail.value);
          }}
        ></nbplay-value>
      </label>`;
    return html`<div
      class="nbplay-zone-list-row ${index === this.selected ? "selected" : ""}"
      data-index=${index}
      @click=${() => this.emitDetail("nbplay-zone-select", { index })}
    >
      <span
        class="nbplay-zone-list-swatch"
        style="background:${zone.color ?? paletteColor(index)}"
      ></span>
      <input
        type="text"
        class="nbplay-zone-list-name"
        title="Zone name"
        .value=${zone.name}
        ?disabled=${this.disabled}
        @input=${stop}
        @change=${(e: Event) => {
          e.stopPropagation();
          this.commit(index, "name", (e.target as HTMLInputElement).value);
        }}
      />
      ${note("low", "Low")} ${note("high", "High")} ${note("root", "Root")}
      <span class="nbplay-zone-list-info">${zone.info ?? ""}</span>
      <button
        type="button"
        class="nbplay-zone-list-remove"
        title="Remove zone"
        ?disabled=${this.disabled}
        @click=${(e: Event) => {
          e.stopPropagation();
          this.emitDetail("nbplay-zone-remove", { index });
        }}
      >
        ×
      </button>
    </div>`;
  }

  private commit(index: number, field: keyof ZoneRow, value: unknown): void {
    const zones = [...this.zones];
    zones[index] = { ...zones[index], [field]: value };
    this.zones = zones;
    this.emitDetail("change", { index, field, value });
  }
}

define("nbplay-zone-list", NbplayZoneList);
