import { html } from "lit";
import { noteName } from "../pads.ts";
import { NbplayElement, define } from "./base.ts";

export interface ZoneSpan {
  low: number;
  high: number;
  name?: string;
  /** CSS color; defaults to the palette token for the zone's index. */
  color?: string;
}

export const PALETTE_SIZE = 6;

/** Palette token for the n-th categorical item (zones, voices, tracks). */
export function paletteColor(index: number): string {
  return `var(--nbplay-palette-${(index % PALETTE_SIZE) + 1})`;
}

/**
 * `<nbplay-zone-map>`: key ranges over MIDI notes 0..127 as colored spans,
 * with octave ticks at every C. `selected` highlights one zone. Fires
 * `nbplay-zone-select` `{index}` when a span is clicked.
 */
export class NbplayZoneMap extends NbplayElement {
  static properties = {
    zones: { attribute: false },
    selected: { type: Number },
    emptyText: { type: String, attribute: "empty-text" },
  };

  declare zones: ZoneSpan[];
  declare selected: number;
  declare emptyText: string;

  constructor() {
    super();
    this.zones = [];
    this.selected = -1;
    this.emptyText = "No zones";
  }

  render() {
    const ticks = Array.from({ length: 11 }, (_, i) => i * 12);
    return html`<div
      class="nbplay-zone-map-track ${this.zones.length ? "" : "empty"}"
    >
      ${ticks.map(
        (n) =>
          html`<span
            class="nbplay-zone-map-tick"
            style="left:${(n / 128) * 100}%"
            >${noteName(n)}</span
          >`,
      )}
      ${
        this.zones.length
          ? this.zones.map((z, i) => this.renderSpan(z, i))
          : html`<span class="nbplay-zone-map-empty">${this.emptyText}</span>`
      }
    </div>`;
  }

  private renderSpan(zone: ZoneSpan, index: number) {
    const low = Math.min(zone.low, zone.high);
    const high = Math.max(zone.low, zone.high);
    const left = (low / 128) * 100;
    const width = ((high - low + 1) / 128) * 100;
    const label = `${zone.name ?? `Zone ${index + 1}`}: ${noteName(low)}–${noteName(high)}`;
    return html`<button
      type="button"
      class="nbplay-zone-map-span ${index === this.selected ? "selected" : ""}"
      data-index=${index}
      title=${label}
      style="left:${left}%;width:${width}%;background:${zone.color ?? paletteColor(index)}"
      @click=${() => this.emitDetail("nbplay-zone-select", { index })}
    ></button>`;
  }
}

define("nbplay-zone-map", NbplayZoneMap);
