import { html } from "lit";
import { type PropertyValues } from "lit";
import { routeNoteOff, routeNoteOn, type KeyboardRoute } from "../routing.ts";
import { getSessionBus, type NoteEvent } from "../session.ts";
import { createSineVoices, type SineVoices } from "../voices.ts";
import { NbplayElement, clamp, define } from "./base.ts";
import { keyToNote, type NbplayKeyRows, type Zone } from "./keys.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./bar.ts";
import "./header.ts";
import "./keys.ts";

const MIN_OCTAVE = -1;
const MAX_OCTAVE = 8;
const VEL_REPEAT_MS = 80;

/** Deliver a note to the session bus listeners and as a document event. */
function broadcastNote(sessionId: string, evt: NoteEvent): void {
  const bus = sessionId ? getSessionBus(sessionId) : undefined;
  bus?.noteListeners?.forEach((fn) => fn(evt));
  // Sequencers and samplers can receive notes without a shared session bus.
  document.dispatchEvent(new CustomEvent("nbplay-note", { detail: evt }));
}

/**
 * `<nbplay-keyboard>`: the musical-typing instrument. A header, octave and
 * velocity readouts, sustain indicators, `nbplay-key-rows`, and a key hint.
 * Computer keys play while the element (or a recording sequencer) has
 * focus: `[` `]` and `;` `'` shift the zone octaves, `-` `=` nudge velocity
 * with auto-repeat, `` ` `` `/` Space hold the zone and global sustains,
 * Escape cancels a pending sequencer note edit. Notes route to samplers on
 * the session bus (`samplerRouting`) or play fallback sine voices, and are
 * broadcast to `bus.noteListeners` and as a document `nbplay-note` event.
 * Edits of `upperOctave`, `lowerOctave`, `velocity` and the sustains fire
 * `nbplay-set`; `activeNotes` and `lastNoteEvent` fire `nbplay-status`.
 */
export class NbplayKeyboard extends NbplayElement {
  static properties = {
    upperOctave: { type: Number, attribute: "upper-octave" },
    lowerOctave: { type: Number, attribute: "lower-octave" },
    velocity: { type: Number },
    sustainUpper: { type: Boolean, attribute: "sustain-upper" },
    sustainLower: { type: Boolean, attribute: "sustain-lower" },
    sustainGlobal: { type: Boolean, attribute: "sustain-global" },
    samplerRouting: { attribute: false },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    channelIndex: { type: Number, attribute: "channel-index" },
    activeNotes: { attribute: false },
    lastNoteEvent: { attribute: false },
  };

  declare upperOctave: number;
  declare lowerOctave: number;
  declare velocity: number;
  declare sustainUpper: boolean;
  declare sustainLower: boolean;
  declare sustainGlobal: boolean;
  declare samplerRouting: KeyboardRoute[];
  declare sessionId: string;
  declare channelIndex: number;
  declare activeNotes: number[];
  declare lastNoteEvent: Record<string, unknown>;

  private voices: SineVoices = createSineVoices();
  private heldNotes = new Set<number>();
  private sustainedNotes = new Map<number, Zone>();
  private pressedKeys = new Map<string, { note: number; zone: Zone }>();
  private velRepeatTimer: ReturnType<typeof setInterval> | null = null;
  private velRepeatCount = 0;

  constructor() {
    super();
    this.upperOctave = 3;
    this.lowerOctave = 4;
    this.velocity = 100;
    this.sustainUpper = false;
    this.sustainLower = false;
    this.sustainGlobal = false;
    this.samplerRouting = [];
    this.sessionId = "";
    this.channelIndex = -1;
    this.activeNotes = [];
    this.lastNoteEvent = {};
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-keyboard");
    this.tabIndex = 0;
    this.voices.setSession(this.sessionId, this.channelIndex);
    // Window-level capture intercepts keys before JupyterLab's document
    // handlers, so notebook shortcuts stay quiet while the keyboard plays.
    window.addEventListener("keydown", this.onKeyDown, true);
    window.addEventListener("keyup", this.onKeyUp, true);
    this.addEventListener("click", this.focusSelf);
    this.addEventListener("blur", this.onBlur);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopVelRepeat();
    window.removeEventListener("keydown", this.onKeyDown, true);
    window.removeEventListener("keyup", this.onKeyUp, true);
    this.removeEventListener("click", this.focusSelf);
    this.removeEventListener("blur", this.onBlur);
    this.voices.destroy();
  }

  updated(changed: PropertyValues): void {
    if (changed.has("sessionId") || changed.has("channelIndex")) {
      this.voices.setSession(this.sessionId, this.channelIndex);
    }
  }

  private focusSelf = (): void => this.focus();

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  private status(): void {
    this.activeNotes = Array.from(this.heldNotes);
    this.emitDetail("nbplay-status", {
      values: {
        activeNotes: this.activeNotes,
        lastNoteEvent: this.lastNoteEvent,
      },
      save: true,
    });
  }

  // Notes

  private noteOn(note: number, zone: Zone): void {
    if (note < 0 || note > 127) return;
    const velocity = this.velocity;
    this.heldNotes.add(note);
    const usedSampler = routeNoteOn(
      this.sessionId,
      this.samplerRouting || [],
      note,
      zone,
      velocity,
    );
    if (!usedSampler) this.voices.noteOn(note, velocity);
    broadcastNote(this.sessionId, { note, velocity, type: "on" });
    this.lastNoteEvent = { note, velocity, type: "on" };
    this.status();
  }

  private noteOff(note: number, zone: Zone): void {
    this.heldNotes.delete(note);
    const sustained =
      this.sustainGlobal ||
      (zone === "upper" && this.sustainUpper) ||
      (zone === "lower" && this.sustainLower);
    if (sustained) {
      this.sustainedNotes.set(note, zone);
      this.requestUpdate();
      return;
    }
    this.release(note, zone);
  }

  private release(note: number, zone: Zone): void {
    const usedSampler = routeNoteOff(
      this.sessionId,
      this.samplerRouting || [],
      note,
      zone,
    );
    if (!usedSampler) this.voices.noteOff(note);
    broadcastNote(this.sessionId, { note, velocity: 0, type: "off" });
    this.lastNoteEvent = { note, velocity: 0, type: "off" };
    this.sustainedNotes.delete(note);
    this.status();
  }

  private releaseSustained(zone: Zone | "all"): void {
    for (const [note, z] of Array.from(this.sustainedNotes)) {
      if ((zone === "all" || z === zone) && !this.heldNotes.has(note)) {
        this.release(note, z);
      }
    }
  }

  private releaseZoneKeys(zone: Zone): void {
    for (const [key, held] of Array.from(this.pressedKeys)) {
      if (held.zone === zone) {
        this.pressedKeys.delete(key);
        this.noteOff(held.note, held.zone);
      }
    }
  }

  /** Release every note and silence the voices (kernel disconnect). */
  silence(): void {
    for (const held of this.pressedKeys.values()) {
      this.noteOff(held.note, held.zone);
    }
    this.pressedKeys.clear();
    for (const [note, zone] of Array.from(this.sustainedNotes)) {
      this.release(note, zone);
    }
    this.heldNotes.clear();
    (
      this.querySelector("nbplay-key-rows") as NbplayKeyRows | null
    )?.releaseAll();
    this.voices.stopAll();
    this.status();
  }

  private onBlur = (): void => {
    for (const held of this.pressedKeys.values()) {
      this.noteOff(held.note, held.zone);
    }
    this.pressedKeys.clear();
    for (const [note, zone] of Array.from(this.sustainedNotes)) {
      this.release(note, zone);
    }
    this.heldNotes.clear();
    this.status();
  };

  // Velocity auto-repeat

  private nudgeVelocity(delta: number): void {
    const next = clamp(this.velocity + delta, 0, 127);
    if (next === this.velocity) return;
    this.velocity = next;
    this.set({ velocity: next });
  }

  private startVelRepeat(delta: number): void {
    if (this.velRepeatTimer) return;
    this.velRepeatCount = 0;
    this.velRepeatTimer = setInterval(() => {
      this.velRepeatCount++;
      this.nudgeVelocity(delta * (this.velRepeatCount > 10 ? 5 : 1));
    }, VEL_REPEAT_MS);
  }

  private stopVelRepeat(): void {
    if (this.velRepeatTimer) {
      clearInterval(this.velRepeatTimer);
      this.velRepeatTimer = null;
      this.velRepeatCount = 0;
    }
  }

  // Computer keyboard

  private isActive(): boolean {
    // Keys play while this element is focused, or while an nbplay sequencer
    // with a pending ♪? edit or an active recording has focus.
    const ae = document.activeElement as HTMLElement | null;
    if (!ae) return false;
    const tag = ae.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || ae.isContentEditable) {
      return false;
    }
    if (ae === this || this.contains(ae)) return true;
    const seq = ae.closest(".nbplay-sequencer");
    if (seq) {
      if (seq.querySelector(".nbplay-seq-key-wait")) return true;
      if (seq.querySelector(".nbplay-seq-rec.recording")) return true;
    }
    return false;
  }

  private shiftOctave(zone: Zone, delta: number): void {
    this.releaseZoneKeys(zone);
    const prop = zone === "upper" ? "upperOctave" : "lowerOctave";
    const next = clamp(this[prop] + delta, MIN_OCTAVE, MAX_OCTAVE);
    this[prop] = next;
    this.set({ [prop]: next });
  }

  private setSustain(
    prop: "sustainUpper" | "sustainLower" | "sustainGlobal",
    on: boolean,
  ): void {
    this[prop] = on;
    this.set({ [prop]: on });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.isActive()) return;
    const key = e.key;
    const lower = key.toLowerCase();
    const consume = () => {
      e.preventDefault();
      e.stopPropagation();
    };

    if (key === "Escape") {
      const ae = document.activeElement;
      if (
        ae?.classList.contains("nbplay-sequencer") &&
        ae.querySelector(".nbplay-seq-key-wait")
      ) {
        consume();
        ae.dispatchEvent(new CustomEvent("nbplay-cancel-edit"));
      }
      return;
    }
    // Key repeat: swallow, but never block unhandled keys.
    if (this.pressedKeys.has(lower)) {
      consume();
      return;
    }
    switch (key) {
      case "[":
        consume();
        this.shiftOctave("upper", -1);
        return;
      case "]":
        consume();
        this.shiftOctave("upper", 1);
        return;
      case ";":
        consume();
        this.shiftOctave("lower", -1);
        return;
      case "'":
        consume();
        this.shiftOctave("lower", 1);
        return;
      case "-":
        consume();
        this.nudgeVelocity(-1);
        this.startVelRepeat(-1);
        return;
      case "=":
        consume();
        this.nudgeVelocity(1);
        this.startVelRepeat(1);
        return;
      case "`":
        consume();
        this.setSustain("sustainUpper", true);
        return;
      case "/":
        consume();
        this.setSustain("sustainLower", true);
        return;
      case " ":
        consume();
        this.setSustain("sustainGlobal", true);
        return;
    }
    const hit = keyToNote(lower, this.upperOctave, this.lowerOctave);
    if (hit) {
      consume();
      this.pressedKeys.set(lower, hit);
      this.noteOn(hit.note, hit.zone);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const key = e.key;
    const lower = key.toLowerCase();
    const held = this.pressedKeys.get(lower);
    if (!this.isActive()) {
      // Still release notes held from before focus moved away.
      if (held) {
        this.pressedKeys.delete(lower);
        this.noteOff(held.note, held.zone);
      }
      return;
    }
    this.pressedKeys.delete(lower);
    const consume = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    switch (key) {
      case "-":
      case "=":
        consume();
        this.stopVelRepeat();
        return;
      case "`":
        consume();
        this.setSustain("sustainUpper", false);
        this.releaseSustained("upper");
        return;
      case "/":
        consume();
        this.setSustain("sustainLower", false);
        this.releaseSustained("lower");
        return;
      case " ":
        consume();
        this.setSustain("sustainGlobal", false);
        this.releaseSustained("all");
        return;
    }
    // Release the note that was started, not a recomputed one.
    if (held) {
      consume();
      this.noteOff(held.note, held.zone);
    }
  };

  render() {
    const pressed = [...this.heldNotes, ...this.sustainedNotes.keys()];
    return html`<nbplay-header badge="keyboard"></nbplay-header>
      <div class="nbplay-kb-info">
        <span class="nbplay-kb-oct-upper">Oct ${this.upperOctave}</span>
        <span class="nbplay-kb-vel">Vel: ${this.velocity}</span>
        <span class="nbplay-kb-oct-lower">Oct ${this.lowerOctave}</span>
      </div>
      <nbplay-bar
        class="nbplay-kb-vel-bar"
        orientation="horizontal"
        .value=${this.velocity}
        .min=${0}
        .max=${127}
      ></nbplay-bar>
      <div class="nbplay-kb-sustain-row">
        <span
          class="nbplay-kb-sustain-upper ${this.sustainUpper ? "active" : ""}"
          title="Upper sustain (\`)"
          >SUS ↑</span
        >
        <span
          class="nbplay-kb-sustain-global ${this.sustainGlobal ? "active" : ""}"
          title="Global sustain (Space)"
          >SUS</span
        >
        <span
          class="nbplay-kb-sustain-lower ${this.sustainLower ? "active" : ""}"
          title="Lower sustain (/)"
          >SUS ↓</span
        >
      </div>
      <nbplay-key-rows
        layout="rows"
        .upperOctave=${this.upperOctave}
        .lowerOctave=${this.lowerOctave}
        .velocity=${this.velocity}
        .pressed=${pressed}
        @pointerdown=${this.focusSelf}
        @nbplay-note-on=${(e: Event) => {
          e.stopPropagation();
          const { note, zone } = (e as CustomEvent).detail;
          this.noteOn(note, zone);
        }}
        @nbplay-note-off=${(e: Event) => {
          e.stopPropagation();
          const { note, zone } = (e as CustomEvent).detail;
          this.noteOff(note, zone);
        }}
      ></nbplay-key-rows>
      <div class="nbplay-kb-controls">
        <span class="nbplay-kb-ctrl-label">[ ] oct↑</span>
        <span class="nbplay-kb-ctrl-label">; ' oct↓</span>
        <span class="nbplay-kb-ctrl-label">- = vel</span>
        <span class="nbplay-kb-ctrl-label">\` sus↑</span>
        <span class="nbplay-kb-ctrl-label">/ sus↓</span>
        <span class="nbplay-kb-ctrl-label">⎵ sus all</span>
      </div>`;
  }
}

define("nbplay-keyboard", NbplayKeyboard);
