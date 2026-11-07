import { html } from "lit";
import { type PropertyValues } from "lit";
import {
  clampVelocity,
  normalizePadActions,
  padActionLabel,
  type PadAction,
} from "../pads.ts";
import { routeNoteOff, routeNoteOn, type KeyboardRoute } from "../routing.ts";
import { createSineVoices, type SineVoices } from "../voices.ts";
import { NbplayElement, define } from "./base.ts";
import type { PadSpec } from "./pad-grid.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./header.ts";
import "./pad-grid.ts";
import "./param.ts";

const PAD_DECAY_SECONDS = 0.3;

function positiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * `<nbplay-pads>`: the pad instrument. A header, a velocity control, the
 * velocity-sensitive switch, an `nbplay-pad-grid`, and an info line.
 * Pad taps route to samplers on the session bus (`samplerRouting`) or play
 * fallback sine voices through the session channel. Configuration edits
 * (`velocity`, `velocitySensitive`, `padNotes`, `padVelocities`,
 * `padActions`, trait actions) fire `nbplay-set`; `activePads`,
 * `lastNoteEvent` and `lastPadEvent` fire `nbplay-status`. Changing
 * `velocity` resets every pad velocity to it.
 */
export class NbplayPads extends NbplayElement {
  static properties = {
    rows: { type: Number },
    cols: { type: Number },
    velocity: { type: Number },
    velocitySensitive: { type: Boolean, attribute: "velocity-sensitive" },
    padNotes: { attribute: false },
    padVelocities: { attribute: false },
    padActions: { attribute: false },
    samplerRouting: { attribute: false },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    channelIndex: { type: Number, attribute: "channel-index" },
    activePads: { attribute: false },
    lastNoteEvent: { attribute: false },
    lastPadEvent: { attribute: false },
  };

  declare rows: number;
  declare cols: number;
  declare velocity: number;
  declare velocitySensitive: boolean;
  declare padNotes: number[];
  declare padVelocities: number[];
  declare padActions: unknown[];
  declare samplerRouting: KeyboardRoute[];
  declare sessionId: string;
  declare channelIndex: number;
  declare activePads: number[];
  declare lastNoteEvent: Record<string, unknown>;
  declare lastPadEvent: Record<string, unknown>;

  private voices: SineVoices = createSineVoices();
  private held = new Set<number>();
  private heldNotes = new Map<number, number>();

  constructor() {
    super();
    this.rows = 4;
    this.cols = 4;
    this.velocity = 100;
    this.velocitySensitive = true;
    this.padNotes = Array.from({ length: 16 }, (_, i) => 36 + i);
    this.padVelocities = [];
    this.padActions = [];
    this.samplerRouting = [];
    this.sessionId = "";
    this.channelIndex = -1;
    this.activePads = [];
    this.lastNoteEvent = {};
    this.lastPadEvent = {};
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-pad");
    this.voices.setSession(this.sessionId, this.channelIndex);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAll();
    this.voices.destroy();
  }

  private dims(): { rows: number; cols: number } {
    return {
      rows: positiveInt(this.rows, 4),
      cols: positiveInt(this.cols, 4),
    };
  }

  private notes(): number[] {
    return Array.isArray(this.padNotes) ? this.padNotes : [];
  }

  private effectiveVelocities(): number[] {
    const vels = Array.isArray(this.padVelocities) ? this.padVelocities : [];
    const fallback = clampVelocity(this.velocity);
    return vels.map((v) => (v !== undefined && v !== null ? v : fallback));
  }

  private actions(): PadAction[] {
    const { rows, cols } = this.dims();
    return normalizePadActions(
      this.padActions,
      this.notes(),
      this.effectiveVelocities(),
      rows * cols,
    );
  }

  private pads(): PadSpec[] {
    const notes = this.notes();
    const vels = this.effectiveVelocities();
    return this.actions().map((action, i) => {
      const velocity = vels[i] ?? 100;
      if (action.type === "note" && !action.label) {
        return { note: action.note, velocity };
      }
      return { note: notes[i] ?? 60, velocity, label: padActionLabel(action) };
    });
  }

  updated(changed: PropertyValues): void {
    if (changed.has("sessionId") || changed.has("channelIndex")) {
      this.voices.setSession(this.sessionId, this.channelIndex);
    }
    if (changed.has("velocity") && changed.get("velocity") !== undefined) {
      this.resetPadVelocities(clampVelocity(this.velocity));
    }
  }

  /** A new global velocity overwrites every pad velocity (and note action). */
  private resetPadVelocities(velocity: number): void {
    const { rows, cols } = this.dims();
    const current = Array.isArray(this.padVelocities) ? this.padVelocities : [];
    const count = current.length || rows * cols;
    const next = Array.from({ length: count }, () => velocity);
    const actions = normalizePadActions(
      this.padActions,
      this.notes(),
      next,
      rows * cols,
    ).map((action) =>
      action.type === "note" ? { ...action, velocity } : action,
    );
    const changed =
      !sameNumbers(current, next) ||
      JSON.stringify(actions) !== JSON.stringify(this.padActions);
    this.padVelocities = next;
    this.padActions = actions;
    if (changed) this.set({ padVelocities: next, padActions: actions });
  }

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  private status(): void {
    this.activePads = Array.from(this.held);
    this.emitDetail("nbplay-status", {
      values: {
        activePads: this.activePads,
        lastNoteEvent: this.lastNoteEvent,
        lastPadEvent: this.lastPadEvent,
      },
      save: true,
    });
  }

  private triggerPad(index: number, velocity: number): void {
    const action = this.actions()[index] ?? {
      type: "note",
      note: this.notes()[index] ?? 60,
    };
    this.held.add(index);
    if (action.type === "note") {
      const note = action.note;
      const actionVelocity = clampVelocity(velocity, action.velocity ?? 100);
      this.heldNotes.set(index, note);
      const usedSampler = routeNoteOn(
        this.sessionId,
        this.samplerRouting || [],
        note,
        "upper",
        actionVelocity,
      );
      if (!usedSampler) {
        this.voices.noteOn(note, actionVelocity, PAD_DECAY_SECONDS);
      }
      this.lastNoteEvent = { note, velocity: actionVelocity, type: "on" };
      this.lastPadEvent = {
        pad: index,
        event: "on",
        velocity: actionVelocity,
        action,
      };
    } else {
      if (action.type === "trait") this.set({ [action.trait]: action.value });
      this.lastPadEvent = { pad: index, event: "trigger", velocity, action };
    }
    this.status();
  }

  private releasePad(index: number): void {
    if (!this.held.delete(index)) return;
    const note = this.heldNotes.get(index);
    this.heldNotes.delete(index);
    const action = this.actions()[index];
    if (note !== undefined) {
      const usedSampler = routeNoteOff(
        this.sessionId,
        this.samplerRouting || [],
        note,
        "upper",
      );
      if (!usedSampler) this.voices.noteOff(note);
      this.lastNoteEvent = { note, velocity: 0, type: "off" };
    }
    if (action) {
      this.lastPadEvent = { pad: index, event: "off", velocity: 0, action };
    }
    this.status();
  }

  /** Release every held pad (kernel disconnect, teardown). */
  releaseAll(): void {
    for (const index of Array.from(this.held)) this.releasePad(index);
  }

  private onPadChange(e: Event): void {
    e.stopPropagation();
    const { index, field, value } = (e as CustomEvent).detail as {
      index: number;
      field: "note" | "velocity";
      value: number;
    };
    if (field === "note") {
      const next = [...this.notes()];
      if (index >= next.length) return;
      next[index] = value;
      this.padNotes = next;
      this.set({ padNotes: next });
    } else {
      const next = [...this.effectiveVelocities()];
      if (index >= next.length) return;
      next[index] = value;
      this.padVelocities = next;
      this.set({ padVelocities: next });
    }
  }

  render() {
    const { rows, cols } = this.dims();
    const stop = (e: Event) => e.stopPropagation();
    const onVelocity = (e: Event) => {
      e.stopPropagation();
      const value = clampVelocity((e as CustomEvent).detail.value);
      if (value === this.velocity) return;
      this.velocity = value;
      this.set({ velocity: value });
    };
    return html`<nbplay-header badge="pads"></nbplay-header>
      <div class="nbplay-pad-controls">
        <nbplay-param
          class="nbplay-pad-velocity"
          label="Velocity"
          kind="int"
          .value=${this.velocity}
          .min=${1}
          .max=${127}
          .step=${1}
          @input=${onVelocity}
          @change=${onVelocity}
        ></nbplay-param>
        <label class="nbplay-pad-vel-sense-label">
          <input
            type="checkbox"
            class="nbplay-pad-vel-sense-chk"
            .checked=${this.velocitySensitive}
            @input=${stop}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.velocitySensitive = (e.target as HTMLInputElement).checked;
              this.set({ velocitySensitive: this.velocitySensitive });
            }}
          />
          Vel-Sensitive
        </label>
      </div>
      <nbplay-pad-grid
        .rows=${rows}
        .cols=${cols}
        .pads=${this.pads()}
        .active=${this.activePads}
        .velocitySensitive=${this.velocitySensitive}
        @nbplay-note-on=${(e: Event) => {
          e.stopPropagation();
          const { index, velocity } = (e as CustomEvent).detail;
          this.triggerPad(index, velocity);
        }}
        @nbplay-note-off=${(e: Event) => {
          e.stopPropagation();
          this.releasePad((e as CustomEvent).detail.index);
        }}
        @input=${this.onPadChange}
        @change=${this.onPadChange}
      ></nbplay-pad-grid>
      <div class="nbplay-pad-footer">
        <span class="nbplay-pad-info"
          >${this.held.size} active · ${rows}×${cols} · vel
          ${this.velocity}</span
        >
      </div>`;
  }
}

define("nbplay-pads", NbplayPads);
