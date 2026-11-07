import { html } from "lit";
import { NbplayElement, define } from "./base.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./launcher-slot.ts";

export interface LauncherTrack {
  name: string;
  detail?: string;
}

export interface LauncherSlotSpec {
  track: number;
  scene: number;
  name: string;
}

export const STOP_QUEUED = -2;

/**
 * `<nbplay-launcher-grid>`: tracks × scenes of `nbplay-launcher-slot`. The
 * scene row launches whole scenes and stops everything; each track row ends
 * in a stop button. Per-track state arrays are host-owned: `active[t]` is the
 * playing scene or -1, `queued[t]` the queued scene, -1 for none or
 * `STOP_QUEUED` (-2) for a queued stop, `progress[t]` the clip position 0..1.
 * Events: `nbplay-launch` `{track, scene}`, `nbplay-launch-scene` `{scene}`,
 * `nbplay-stop-track` `{track}`, `nbplay-stop-all` `{}`.
 */
export class NbplayLauncherGrid extends NbplayElement {
  static properties = {
    tracks: { attribute: false },
    scenes: { attribute: false },
    slots: { attribute: false },
    active: { attribute: false },
    queued: { attribute: false },
    progress: { attribute: false },
    selected: { attribute: false },
    playing: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  declare tracks: LauncherTrack[];
  declare scenes: string[];
  declare slots: LauncherSlotSpec[];
  declare active: number[];
  declare queued: number[];
  declare progress: number[];
  declare selected: { track: number; scene: number } | null;
  declare playing: boolean;
  declare disabled: boolean;

  constructor() {
    super();
    this.tracks = [];
    this.scenes = [];
    this.slots = [];
    this.active = [];
    this.queued = [];
    this.progress = [];
    this.selected = null;
    this.playing = false;
    this.disabled = false;
  }

  private sceneState(scene: number) {
    const withSlot = this.tracks.filter((_, t) =>
      this.slots.some((s) => s.track === t && s.scene === scene),
    ).length;
    const playingCount = this.tracks.filter(
      (_, t) => this.active[t] === scene,
    ).length;
    return {
      active: withSlot > 0 && playingCount === withSlot,
      partial: playingCount > 0 && playingCount < withSlot,
      queued: this.tracks.some((_, t) => this.queued[t] === scene),
    };
  }

  render() {
    return html`<div
        class="nbplay-launcher-grid-row nbplay-launcher-grid-scenes"
      >
        <div class="nbplay-launcher-grid-corner">
          ${this.playing ? "▶" : "■"}
        </div>
        ${this.scenes.map((name, scene) => {
          const s = this.sceneState(scene);
          return html`<button
            type="button"
            class="nbplay-launcher-grid-scene ${s.active ? "active" : ""} ${s.partial ? "partial" : ""} ${s.queued ? "queued" : ""}"
            data-scene=${scene}
            title="Launch scene"
            ?disabled=${this.disabled}
            @click=${() => this.emitDetail("nbplay-launch-scene", { scene })}
          >
            ${name}
          </button>`;
        })}
        <button
          type="button"
          class="nbplay-launcher-grid-stop-all"
          title="Stop all tracks"
          ?disabled=${this.disabled}
          @click=${() => this.emitDetail("nbplay-stop-all", {})}
        >
          ■ All
        </button>
      </div>
      ${
        this.tracks.length
          ? this.tracks.map((track, t) => this.renderTrack(track, t))
          : html`<div class="nbplay-launcher-grid-empty">No tracks</div>`
      }`;
  }

  private renderTrack(track: LauncherTrack, t: number) {
    const queued = this.queued[t] ?? -1;
    return html`<div class="nbplay-launcher-grid-row" data-track=${t}>
      <div class="nbplay-launcher-grid-track">
        <span class="nbplay-launcher-grid-track-name">${track.name}</span>
        ${track.detail ? html`<small>${track.detail}</small>` : ""}
      </div>
      ${this.scenes.map((_, scene) => {
        const slot = this.slots.find((s) => s.track === t && s.scene === scene);
        return html`<nbplay-launcher-slot
          data-track=${t}
          data-scene=${scene}
          .name=${slot?.name ?? ""}
          .active=${this.active[t] === scene}
          .queued=${queued === scene || (queued === STOP_QUEUED && !slot)}
          .selected=${this.selected?.track === t && this.selected?.scene === scene}
          .progress=${this.progress[t] ?? 0}
          .disabled=${this.disabled}
          @nbplay-launch=${(e: Event) => {
            e.stopPropagation();
            this.emitDetail("nbplay-launch", { track: t, scene });
          }}
        ></nbplay-launcher-slot>`;
      })}
      <button
        type="button"
        class="nbplay-launcher-grid-track-stop ${queued === STOP_QUEUED ? "queued" : ""}"
        title="Stop track"
        ?disabled=${this.disabled}
        @click=${() => this.emitDetail("nbplay-stop-track", { track: t })}
      >
        ■
      </button>
    </div>`;
  }
}

define("nbplay-launcher-grid", NbplayLauncherGrid);
