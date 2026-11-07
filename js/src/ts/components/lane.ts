import { html, nothing } from "lit";
import { NbplayElement, clamp, define } from "./base.ts";
import type { ClipKind } from "./clip.ts";
import { beatLabel, capture, snapBeat } from "./ruler.ts";

export interface ClipSpec {
  id: string;
  name: string;
  start: number;
  duration: number;
  offset?: number;
  kind?: ClipKind;
  pattern?: boolean;
  muted?: boolean;
  /** Text under the name; defaults to the start position. */
  detail?: string;
}

export interface LaneInput {
  value: string;
  label: string;
  disabled?: boolean;
}

const CLIP_SNAP_BEATS = 0.25;
const MIN_CLIP_BEATS = 0.25;
const DRAG_THRESHOLD_PX = 3;

type DragMode = "move" | "trim-start" | "trim-end";

/**
 * `<nbplay-lane>`: one timeline track: a header (name, arm/monitor/mute/solo
 * toggles, record-source select) and a clip lane with playhead and
 * `nbplay-clip`s. Clip positions are percentages of `length` beats.
 * Events: `change` `{field, value}` for `armed`, `monitor`, `muted`, `solo`,
 * `input`; `nbplay-seek` `{beat, final}` from the lane surface;
 * `nbplay-clip-select` `{id}`; clip move and trim fire `input` then `change`
 * with `{field: "clip", id, start, duration, offset, clientY}` (`clientY` lets
 * a host move the clip to the lane under the pointer).
 */
export class NbplayLane extends NbplayElement {
  static properties = {
    name: { type: String },
    armed: { type: Boolean },
    monitor: { type: Boolean },
    muted: { type: Boolean },
    solo: { type: Boolean },
    input: { type: String },
    inputs: { attribute: false },
    clips: { attribute: false },
    length: { type: Number },
    beatsPerBar: { type: Number, attribute: "beats-per-bar" },
    beat: { type: Number },
    selected: { type: String },
    recording: { type: Boolean, reflect: true },
    showHeader: { type: Boolean, attribute: "show-header" },
    disabled: { type: Boolean, reflect: true },
  };

  declare name: string;
  declare armed: boolean;
  declare monitor: boolean;
  declare muted: boolean;
  declare solo: boolean;
  declare input: string;
  declare inputs: LaneInput[];
  declare clips: ClipSpec[];
  declare length: number;
  declare beatsPerBar: number;
  declare beat: number;
  declare selected: string;
  declare recording: boolean;
  declare showHeader: boolean;
  declare disabled: boolean;

  private seekFrame: number | null = null;

  constructor() {
    super();
    this.name = "";
    this.armed = false;
    this.monitor = false;
    this.muted = false;
    this.solo = false;
    this.input = "microphone";
    this.inputs = [
      { value: "microphone", label: "Mic" },
      { value: "channel", label: "Channel" },
      { value: "midi", label: "MIDI" },
    ];
    this.clips = [];
    this.length = 16;
    this.beatsPerBar = 4;
    this.beat = 0;
    this.selected = "";
    this.recording = false;
    this.showHeader = true;
    this.disabled = false;
  }

  private pct(beat: number): number {
    return this.length > 0 ? clamp((beat / this.length) * 100, 0, 100) : 0;
  }

  render() {
    return html`${this.showHeader ? this.renderHeader() : nothing}
      <div class="nbplay-lane-clips" @pointerdown=${this.onSeekDown}>
        <div
          class="nbplay-lane-playhead"
          style="left:${this.pct(this.beat)}%"
        ></div>
        ${this.clips.map((clip) => this.renderClip(clip))}
      </div>`;
  }

  private renderHeader() {
    const toggle = (
      field: "armed" | "monitor" | "muted" | "solo",
      variant: string,
      label: string,
      title: string,
    ) =>
      html`<nbplay-toggle
        variant=${variant}
        label=${label}
        title=${title}
        .active=${this[field]}
        .disabled=${this.disabled}
        @change=${(e: Event) => {
          e.stopPropagation();
          const value = (e as CustomEvent).detail.value as boolean;
          this[field] = value;
          this.emitDetail("change", { field, value });
        }}
      ></nbplay-toggle>`;
    return html`<div class="nbplay-lane-header">
      <div class="nbplay-lane-name" title=${this.name}>${this.name}</div>
      <div class="nbplay-lane-buttons">
        ${toggle("armed", "arm", "R", "Arm track")}
        ${toggle("monitor", "monitor", "I", "Input monitor")}
        ${toggle("muted", "mute", "M", "Mute track")}
        ${toggle("solo", "solo", "S", "Solo track")}
      </div>
      <select
        class="nbplay-lane-input"
        title="Record source"
        ?disabled=${this.disabled}
        @input=${(e: Event) => e.stopPropagation()}
        @change=${(e: Event) => {
          e.stopPropagation();
          this.input = (e.target as HTMLSelectElement).value;
          this.emitDetail("change", { field: "input", value: this.input });
        }}
      >
        ${this.inputs.map(
          (opt) =>
            html`<option
              value=${opt.value}
              ?selected=${opt.value === this.input}
              ?disabled=${opt.disabled}
            >
              ${opt.label}
            </option>`,
        )}
      </select>
    </div>`;
  }

  private renderClip(clip: ClipSpec) {
    const left = this.pct(clip.start);
    const width = Math.max(1, Math.min(100 - left, this.pct(clip.duration)));
    return html`<nbplay-clip
      clip-id=${clip.id}
      .name=${clip.name}
      .detail=${clip.detail ?? beatLabel(clip.start, this.beatsPerBar)}
      .kind=${clip.kind ?? "audio"}
      .pattern=${Boolean(clip.pattern)}
      .muted=${Boolean(clip.muted)}
      .selected=${clip.id === this.selected}
      style="left:${left}%;width:${width}%"
      @pointerdown=${(e: PointerEvent) => this.onClipDown(e, clip)}
    ></nbplay-clip>`;
  }

  private beatAt(e: PointerEvent, surface: HTMLElement): number {
    const rect = surface.getBoundingClientRect();
    const ratio =
      rect.width <= 0 ? 0 : clamp((e.clientX - rect.left) / rect.width, 0, 1);
    return ratio * this.length;
  }

  private onSeekDown = (e: PointerEvent): void => {
    if (this.disabled || e.button !== 0) return;
    if ((e.target as Element).closest("nbplay-clip")) return;
    e.preventDefault();
    const surface = e.currentTarget as HTMLElement;
    capture(surface, e.pointerId);
    let latest = this.beatAt(e, surface);
    this.emitDetail("nbplay-seek", { beat: latest, final: false });
    const onMove = (m: PointerEvent) => {
      latest = this.beatAt(m, surface);
      if (this.seekFrame !== null) return;
      this.seekFrame = requestAnimationFrame(() => {
        this.seekFrame = null;
        this.emitDetail("nbplay-seek", { beat: latest, final: false });
      });
    };
    const onUp = () => {
      if (this.seekFrame !== null) {
        cancelAnimationFrame(this.seekFrame);
        this.seekFrame = null;
      }
      this.emitDetail("nbplay-seek", { beat: latest, final: true });
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerup", onUp);
      surface.removeEventListener("pointercancel", onUp);
    };
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerup", onUp);
    surface.addEventListener("pointercancel", onUp);
  };

  private onClipDown(e: PointerEvent, clip: ClipSpec): void {
    if (this.disabled || e.button !== 0) return;
    const element = e.currentTarget as HTMLElement & { dragging: boolean };
    const lane = element.parentElement as HTMLElement;
    const laneWidth = lane.getBoundingClientRect().width;
    if (laneWidth <= 0) return;
    const target = e.target as Element | null;
    const mode: DragMode = target?.closest(".nbplay-clip-handle.start")
      ? "trim-start"
      : target?.closest(".nbplay-clip-handle.end")
        ? "trim-end"
        : "move";
    e.preventDefault();
    e.stopPropagation();
    capture(element, e.pointerId);
    const pixelsPerBeat = laneWidth / this.length;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    let next = {
      start: clip.start,
      duration: clip.duration,
      offset: clip.offset ?? 0,
    };

    const patch = (m: PointerEvent) => {
      const delta = snapBeat(
        (m.clientX - startX) / pixelsPerBeat,
        CLIP_SNAP_BEATS,
      );
      const offset = clip.offset ?? 0;
      if (mode === "move") {
        return {
          start: Math.max(0, clip.start + delta),
          duration: clip.duration,
          offset,
        };
      }
      if (mode === "trim-start") {
        const d = Math.max(
          -Math.min(offset, clip.start),
          Math.min(delta, clip.duration - MIN_CLIP_BEATS),
        );
        return {
          start: clip.start + d,
          duration: clip.duration - d,
          offset: offset + d,
        };
      }
      return {
        start: clip.start,
        duration: Math.max(MIN_CLIP_BEATS, clip.duration + delta),
        offset,
      };
    };
    const detail = (m: PointerEvent) => ({
      field: "clip",
      id: clip.id,
      ...next,
      clientY: m.clientY,
    });

    const onMove = (m: PointerEvent) => {
      if (
        !moved &&
        Math.abs(m.clientX - startX) < DRAG_THRESHOLD_PX &&
        Math.abs(m.clientY - startY) < DRAG_THRESHOLD_PX
      )
        return;
      moved = true;
      element.dragging = true;
      next = patch(m);
      const left = this.pct(next.start);
      element.style.left = `${left}%`;
      element.style.width = `${Math.max(1, Math.min(100 - left, this.pct(next.duration)))}%`;
      this.emitDetail("input", detail(m));
    };
    const onUp = (u: PointerEvent) => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      element.dragging = false;
      if (moved) this.emitDetail("change", detail(u));
      else this.emitDetail("nbplay-clip-select", { id: clip.id });
    };
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
  }
}

define("nbplay-lane", NbplayLane);
