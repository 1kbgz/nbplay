import { html, nothing } from "lit";
import { NbplayElement, clamp, define } from "./base.ts";

/** Beat → "bar.beat", 1-based. */
export function beatLabel(beat: number, beatsPerBar: number): string {
  const bar = Math.floor(beat / beatsPerBar) + 1;
  const beatInBar = Math.floor(beat % beatsPerBar) + 1;
  return `${bar}.${beatInBar}`;
}

export function snapBeat(beat: number, step: number): number {
  return step > 0 ? Math.round(beat / step) * step : beat;
}

/**
 * `<nbplay-ruler>`: timeline bar ruler: bar numbers, loop brace with two
 * handles, playhead, seek surface. Positions are percentages of `length`
 * beats, so the host sets the width (zoom). Events: `nbplay-seek`
 * `{beat, final}` while scrubbing (final on release); loop handle drags fire
 * `input` then `change` with `{field: "loopStart" | "loopEnd", value}`,
 * snapped to bars and at least one bar apart.
 */
export class NbplayRuler extends NbplayElement {
  static properties = {
    length: { type: Number },
    beatsPerBar: { type: Number, attribute: "beats-per-bar" },
    beat: { type: Number },
    loopStart: { type: Number, attribute: "loop-start" },
    loopEnd: { type: Number, attribute: "loop-end" },
    loopEnabled: { type: Boolean, attribute: "loop-enabled", reflect: true },
    width: { type: Number },
    disabled: { type: Boolean, reflect: true },
  };

  declare length: number;
  declare beatsPerBar: number;
  declare beat: number;
  declare loopStart: number;
  declare loopEnd: number;
  declare loopEnabled: boolean;
  /** Fixed track width in px (zoom); 0 fits the element. */
  declare width: number;
  declare disabled: boolean;

  private seekFrame: number | null = null;

  constructor() {
    super();
    this.length = 16;
    this.beatsPerBar = 4;
    this.beat = 0;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.loopEnabled = false;
    this.width = 0;
    this.disabled = false;
  }

  private pct(beat: number): number {
    return this.length > 0 ? clamp((beat / this.length) * 100, 0, 100) : 0;
  }

  render() {
    const bars = Math.max(1, Math.ceil(this.length / this.beatsPerBar));
    const loop = this.loopEnabled && this.loopEnd > this.loopStart;
    return html`<div
      class="nbplay-ruler-track"
      style=${this.width > 0 ? `width: ${this.width}px;` : nothing}
      @pointerdown=${this.onSeekDown}
    >
      ${Array.from({ length: bars }, (_, i) => {
        const left = this.pct(i * this.beatsPerBar);
        return html`<span class="nbplay-ruler-bar" style="left: ${left}%;"
          >${i + 1}</span
        >`;
      })}
      ${
        loop
          ? html`<div
                class="nbplay-ruler-loop"
                style="left: ${this.pct(this.loopStart)}%; width: ${this.pct(this.loopEnd) - this.pct(this.loopStart)}%;"
              ></div>
              <div
                class="nbplay-ruler-loop-handle start"
                data-edge="start"
                style="left: ${this.pct(this.loopStart)}%;"
                @pointerdown=${this.onHandleDown}
              ></div>
              <div
                class="nbplay-ruler-loop-handle end"
                data-edge="end"
                style="left: ${this.pct(this.loopEnd)}%;"
                @pointerdown=${this.onHandleDown}
              ></div>`
          : nothing
      }
      <div
        class="nbplay-ruler-playhead"
        style="left: ${this.pct(this.beat)}%;"
      ></div>
    </div>`;
  }

  private beatAt(e: PointerEvent): number {
    const surface = this.querySelector(".nbplay-ruler-track") as HTMLElement;
    const rect = surface.getBoundingClientRect();
    const ratio =
      rect.width <= 0 ? 0 : clamp((e.clientX - rect.left) / rect.width, 0, 1);
    return ratio * this.length;
  }

  private onSeekDown = (e: PointerEvent): void => {
    if (this.disabled || e.button !== 0) return;
    if ((e.target as Element).closest(".nbplay-ruler-loop-handle")) return;
    e.preventDefault();
    const surface = e.currentTarget as HTMLElement;
    capture(surface, e.pointerId);
    let latest = this.beatAt(e);
    this.emitDetail("nbplay-seek", { beat: latest, final: false });
    const onMove = (m: PointerEvent) => {
      latest = this.beatAt(m);
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

  private onHandleDown = (e: PointerEvent): void => {
    if (this.disabled || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    capture(handle, e.pointerId);
    const edge = handle.dataset.edge === "start" ? "loopStart" : "loopEnd";
    const bpb = this.beatsPerBar;
    const apply = (m: PointerEvent, name: string) => {
      const beat = clamp(snapBeat(this.beatAt(m), bpb), 0, this.length);
      const value =
        edge === "loopStart"
          ? Math.min(beat, this.loopEnd - bpb)
          : Math.max(beat, this.loopStart + bpb);
      this[edge] = value;
      this.emitDetail(name, { field: edge, value });
    };
    const onMove = (m: PointerEvent) => apply(m, "input");
    const onUp = (u: PointerEvent) => {
      apply(u, "change");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };
}

/** Pointer capture that tolerates synthetic pointer ids (tests). */
export function capture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* synthetic pointer */
  }
}

define("nbplay-ruler", NbplayRuler);
