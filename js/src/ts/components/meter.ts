import { html } from "lit";
import { linearToDb } from "../helpers.ts";
import { NbplayElement, clamp, define } from "./base.ts";

/**
 * `<nbplay-meter>`: a level meter. `level` and `rms` are linear amplitudes
 * (0..1); the fill maps `floor-db`..0 dBFS onto 0..100%. `hot` reflects when
 * `level` reaches `hot-threshold`. Hosts update `level` from their own rAF loop.
 */
export class NbplayMeter extends NbplayElement {
  static properties = {
    level: { type: Number },
    rms: { type: Number },
    orientation: { type: String, reflect: true },
    floorDb: { type: Number, attribute: "floor-db" },
    hotThreshold: { type: Number, attribute: "hot-threshold" },
    hot: { type: Boolean, reflect: true },
  };

  declare level: number;
  declare rms: number;
  declare orientation: "horizontal" | "vertical";
  declare floorDb: number;
  declare hotThreshold: number;
  declare hot: boolean;

  constructor() {
    super();
    this.level = 0;
    this.rms = 0;
    this.orientation = "vertical";
    this.floorDb = -60;
    this.hotThreshold = 0.99;
    this.hot = false;
  }

  private percent(linear: number): number {
    if (!(linear > 0)) return 0;
    const db = linearToDb(linear);
    return clamp((db - this.floorDb) / (0 - this.floorDb), 0, 1) * 100;
  }

  protected willUpdate(): void {
    this.hot = this.level >= this.hotThreshold;
  }

  render() {
    return html`<div class="nbplay-meter-track">
      <div
        class="nbplay-meter-rms"
        style="--nbplay-meter-fill: ${this.percent(this.rms)}%"
      ></div>
      <div
        class="nbplay-meter-fill"
        style="--nbplay-meter-fill: ${this.percent(this.level)}%"
      ></div>
    </div>`;
  }
}

define("nbplay-meter", NbplayMeter);
