import { html, type PropertyValues } from "lit";
import { noteName } from "../pads.ts";
import { computeStepOffsetSeconds } from "../scheduler.ts";
import {
  bindElementClock,
  emitBusNote,
  getOrCreateSessionBus,
  type ClockBinding,
  type ClockEvent,
  type NoteInput,
  type SessionBus,
  type SessionClock,
} from "../session.ts";
import { NbplayElement, define } from "./base.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./header.ts";
import "./param.ts";
import "./segmented.ts";
import "./toggle.ts";

/** A held note and the velocity it was played at. */
export interface ArpNote {
  note: number;
  velocity: number;
}

/**
 * One cycle of the pattern: the held notes in `order` across `octaves`.
 * `updown` turns at the ends without repeating them; `random` is the up
 * cycle, which the arpeggiator picks from at random.
 */
export function arpNotes(
  held: ArpNote[],
  order: string,
  octaves: number,
): ArpNote[] {
  const base =
    order === "played" ? held : [...held].sort((a, b) => a.note - b.note);
  const span = Math.max(1, Math.min(4, Math.round(octaves) || 1));
  const up: ArpNote[] = [];
  for (let octave = 0; octave < span; octave++)
    for (const h of base) {
      const note = h.note + 12 * octave;
      if (note <= 127) up.push({ note, velocity: h.velocity });
    }
  if (order === "down") return up.reverse();
  if (order === "updown" && up.length > 2)
    return [...up, ...up.slice(1, -1).reverse()];
  return up;
}

const ORDERS = [
  { value: "up", label: "Up" },
  { value: "down", label: "Down" },
  { value: "updown", label: "Up/down" },
  { value: "random", label: "Random" },
  { value: "played", label: "Played" },
];
const OCTAVES = ["1", "2", "3", "4"];
const RATES = [
  { value: 1, label: "1/4" },
  { value: 0.5, label: "1/8" },
  { value: 0.25, label: "1/16" },
  { value: 0.125, label: "1/32" },
];
/** How far ahead steps are scheduled, and how often the loop looks. */
const LOOKAHEAD = 0.1;
const TICK_MS = 25;
/** Seconds after the first key before a stopped clock's first step: keys pressed together are one chord. */
const CHORD_WINDOW = 0.03;

/**
 * `<nbplay-arpeggiator>`: plays the notes held on its track one step at a
 * time. As a session instrument's note source it registers
 * `bus.inputs[channelIndex]`, so MIDI routes and keyboards on that track
 * hold notes here instead of sounding them; each step plays on
 * `bus.instruments[channelIndex]` and is emitted to `bus.noteListeners`.
 * Steps fall on the session clock's grid while it plays and run from the
 * first held note while it is stopped. Edits fire `nbplay-set`; the held
 * notes fire `nbplay-status`.
 */
export class NbplayArpeggiator extends NbplayElement {
  static properties = {
    order: { type: String },
    octaves: { type: Number },
    stepDuration: { type: Number, attribute: "step-duration" },
    gate: { type: Number },
    swing: { type: Number },
    latch: { type: Boolean },
    bpm: { type: Number },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    channelIndex: { type: Number, attribute: "channel-index" },
    heldNotes: { attribute: false },
    playing: { state: true },
  };

  declare order: string;
  declare octaves: number;
  declare stepDuration: number;
  declare gate: number;
  declare swing: number;
  declare latch: boolean;
  declare bpm: number;
  declare sessionId: string;
  declare channelIndex: number;
  declare heldNotes: number[];
  /** The note sounding now, for the display. */
  declare playing: number;

  private binding: (ClockBinding & { rebind(): void }) | null = null;
  /** Held notes, in the order they were played. */
  private held: ArpNote[] = [];
  /** Keys down now; with latch, the held notes outlast them. */
  private down = new Set<number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  /** The step grid: a clock beat while it plays, else a context time. */
  private origin: { beat: number } | { time: number } = { time: 0 };
  private registration: {
    bus: SessionBus;
    idx: number;
    entry: NoteInput;
  } | null = null;
  private input: NoteInput = {
    startNote: (note, velocity) => this.press(note, velocity),
  };

  constructor() {
    super();
    this.order = "up";
    this.octaves = 1;
    this.stepDuration = 0.25;
    this.gate = 0.5;
    this.swing = 0;
    this.latch = false;
    this.bpm = 120;
    this.sessionId = "";
    this.channelIndex = -1;
    this.heldNotes = [];
    this.playing = -1;
  }

  clock(): SessionClock {
    if (!this.binding) {
      this.binding = bindElementClock(this, this.onClockEvent, this.onRebind);
      this.joinTempo(this.binding.clock());
    }
    return this.binding.clock();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-arpeggiator");
    this.clock();
    this.register();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unregister();
    this.halt();
    this.binding?.dispose();
    this.binding = null;
  }

  updated(changed: PropertyValues): void {
    if (changed.has("sessionId") || changed.has("channelIndex"))
      this.register();
    if (!this.binding) return;
    const joined =
      changed.has("sessionId") && changed.get("sessionId") !== undefined;
    if (joined) this.binding.rebind();
    const clk = this.clock();
    if (changed.has("bpm") && !joined && Number(this.bpm) !== clk.bpm)
      clk.setTempo(Number(this.bpm));
    // Latch off with no keys down lets the latched notes go.
    if (changed.has("latch") && !this.latch && this.down.size === 0)
      this.setHeld([]);
    if (
      changed.has("stepDuration") &&
      changed.get("stepDuration") !== undefined
    )
      this.realign();
  }

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  private register(): void {
    this.unregister();
    const idx = Number(this.channelIndex);
    if (!this.sessionId || !(idx >= 0) || !this.isConnected) return;
    const bus = getOrCreateSessionBus(this.sessionId);
    bus.inputs = bus.inputs || {};
    bus.inputs[idx] = this.input;
    this.registration = { bus, idx, entry: this.input };
  }

  private unregister(): void {
    if (!this.registration) return;
    const { bus, idx, entry } = this.registration;
    if (bus.inputs?.[idx] === entry) delete bus.inputs[idx];
    this.registration = null;
  }

  // Held notes

  /** A key went down; returns its release. */
  press(note: number, velocity: number): () => void {
    // A new chord after every key was up replaces the latched one.
    const fresh = this.down.size === 0 ? [] : this.held;
    this.down.add(note);
    this.setHeld([...fresh.filter((h) => h.note !== note), { note, velocity }]);
    return () => {
      this.down.delete(note);
      if (!this.latch) this.setHeld(this.held.filter((h) => h.note !== note));
    };
  }

  private setHeld(held: ArpNote[]): void {
    const was = this.held.length;
    this.held = held;
    this.heldNotes = held.map((h) => h.note);
    this.emitDetail("nbplay-status", {
      values: { heldNotes: this.heldNotes },
      save: true,
    });
    if (held.length && !was) this.start();
    else if (!held.length) this.halt();
  }

  /** Let every note go (kernel disconnect). */
  halt(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = -1;
  }

  // Steps

  private stepSeconds(clk: SessionClock): number {
    return (Math.max(0.01, Number(this.stepDuration) || 0.25) * 60) / clk.bpm;
  }

  private start(): void {
    const ctx = this.clock().context();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    this.step = 0;
    this.realign();
    // The first tick comes after the chord window, so keys pressed together
    // are all held by the first step.
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Put the next step on the clock's grid while it plays, else from now. */
  private realign(): void {
    const clk = this.clock();
    const ctx = clk.context();
    if (!ctx) return;
    const steps = Math.max(0.01, Number(this.stepDuration) || 0.25);
    if (clk.playing) {
      const beat = Math.ceil(clk.beat() / steps - 1e-6) * steps;
      this.origin = { beat };
      this.nextTime = clk.ctxTimeAt(beat);
    } else {
      this.origin = { time: ctx.currentTime + CHORD_WINDOW };
      this.nextTime = this.origin.time;
    }
    this.step = 0;
  }

  private timeOf(step: number, clk: SessionClock): number {
    const steps = Math.max(0.01, Number(this.stepDuration) || 0.25);
    const grid =
      "beat" in this.origin
        ? clk.ctxTimeAt(this.origin.beat + step * steps)
        : this.origin.time + step * this.stepSeconds(clk);
    return (
      grid +
      computeStepOffsetSeconds(step, this.stepSeconds(clk), Number(this.swing))
    );
  }

  private tick(): void {
    const clk = this.clock();
    const ctx = clk.context();
    if (!ctx || !this.held.length) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.play(this.step, this.nextTime, clk);
      this.step += 1;
      this.nextTime = this.timeOf(this.step, clk);
    }
  }

  private play(step: number, at: number, clk: SessionClock): void {
    const cycle = arpNotes(this.held, this.order, Number(this.octaves));
    if (!cycle.length) return;
    const pick =
      this.order === "random"
        ? cycle[Math.floor(Math.random() * cycle.length)]
        : cycle[step % cycle.length];
    const duration = this.stepSeconds(clk) * (Number(this.gate) || 0.5);
    const bus = this.registration?.bus;
    bus?.instruments?.[this.registration!.idx]?.scheduleNote(
      pick.note,
      pick.velocity,
      at,
      duration,
    );
    emitBusNote(this.sessionId, {
      note: pick.note,
      velocity: pick.velocity,
      type: "on",
      at,
      duration,
    });
    const ctx = clk.context();
    const delay = ctx ? Math.max(0, (at - ctx.currentTime) * 1000) : 0;
    setTimeout(() => (this.playing = pick.note), delay);
  }

  // Clock

  private onClockEvent = (event: ClockEvent): void => {
    if (!this.timer) return;
    // The transport stopping stops a latched arpeggio; keys still down play on.
    if (event.type === "stop" && this.latch) {
      this.setHeld(this.held.filter((h) => this.down.has(h.note)));
      if (!this.timer) return;
    }
    if (["play", "stop", "seek", "tempo", "loop"].includes(event.type))
      this.realign();
  };

  private onRebind = (clk: SessionClock): void => {
    this.joinTempo(clk);
    if (this.timer) this.realign();
  };

  private joinTempo(clk: SessionClock): void {
    const bpm = clk.adoptTempo(Number(this.bpm));
    if (bpm !== Number(this.bpm)) {
      this.bpm = bpm;
      this.set({ bpm });
    }
  }

  // Render

  private edit(field: string, value: unknown): void {
    (this as unknown as Record<string, unknown>)[field] = value;
    this.set({ [field]: value });
  }

  render() {
    const stop = (e: Event) => e.stopPropagation();
    const held = this.heldNotes || [];
    const param = (
      cls: string,
      label: string,
      value: number,
      kind: string,
      min: number,
      max: number,
      step: number,
      fallback: number,
      field: string,
      unit = "",
    ) => {
      const on = (e: Event) => {
        stop(e);
        const next = (e as CustomEvent).detail.value as number;
        if (next !== value) this.edit(field, next);
      };
      return html`<nbplay-param
        class=${cls}
        .label=${label}
        .kind=${kind}
        .control=${"dial"}
        .unit=${unit}
        .value=${value}
        .min=${min}
        .max=${max}
        .step=${step}
        .defaultValue=${fallback}
        .precision=${2}
        @input=${on}
        @change=${on}
      ></nbplay-param>`;
    };
    return html`<nbplay-header badge="arp"></nbplay-header>
      <div class="nbplay-arp-row">
        <nbplay-segmented
          class="nbplay-arp-order"
          label="Order"
          .options=${ORDERS}
          .value=${this.order}
          @change=${(e: Event) => {
            stop(e);
            this.edit("order", (e as CustomEvent).detail.value);
          }}
        ></nbplay-segmented>
        <nbplay-segmented
          class="nbplay-arp-octaves"
          label="Octaves"
          .options=${OCTAVES}
          .value=${String(this.octaves)}
          @change=${(e: Event) => {
            stop(e);
            this.edit("octaves", Number((e as CustomEvent).detail.value));
          }}
        ></nbplay-segmented>
      </div>
      <div class="nbplay-arp-row">
        <label class="nbplay-arp-field">
          <span>Rate</span>
          <select
            class="nbplay-arp-rate"
            @input=${stop}
            @change=${(e: Event) => {
              stop(e);
              this.edit(
                "stepDuration",
                parseFloat((e.target as HTMLSelectElement).value),
              );
            }}
          >
            ${RATES.map(
              (r) =>
                html`<option
                  value=${r.value}
                  ?selected=${r.value === Number(this.stepDuration)}
                >
                  ${r.label}
                </option>`,
            )}
          </select>
        </label>
        ${param("nbplay-arp-gate", "Gate", Number(this.gate), "percent", 0.05, 1, 0.01, 0.5, "gate")}
        ${param("nbplay-arp-swing", "Swing", Number(this.swing), "int", 0, 100, 1, 0, "swing", "%")}
        <nbplay-toggle
          class="nbplay-arp-latch"
          label="Latch"
          title="Keep playing after the keys are released"
          .active=${this.latch}
          @change=${(e: Event) => {
            stop(e);
            this.edit("latch", Boolean((e as CustomEvent).detail.value));
          }}
        ></nbplay-toggle>
      </div>
      <div class="nbplay-arp-held" aria-live="polite">
        ${
          held.length
            ? held.map(
                (note) =>
                  html`<span
                    class="nbplay-arp-note ${this.playing % 12 === note % 12 ? "on" : ""}"
                    >${noteName(note)}</span
                  >`,
              )
            : html`<span class="nbplay-arp-idle"
                >Hold notes on this track to arpeggiate</span
              >`
        }
      </div>`;
  }
}

define("nbplay-arpeggiator", NbplayArpeggiator);
