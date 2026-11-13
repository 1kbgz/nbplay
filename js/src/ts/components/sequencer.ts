import { html } from "lit";
import { type PropertyValues } from "lit";
import { type AnyModel, bindShortcuts } from "../helpers.ts";
import {
  type AutomationLane,
  createAudioScheduler,
  type StepData,
} from "../scheduler.ts";
import {
  barBeats,
  bindElementClock,
  type ClockBinding,
  type ClockEvent,
  type SessionClock,
} from "../session.ts";
import { NbplayElement, clamp, define } from "./base.ts";
import type { StepRef } from "./step-grid.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./header.ts";
import "./param.ts";
import "./step-grid.ts";

const STEP_DURATION_OPTIONS = [1, 0.5, 0.25, 0.125];
const MIN_BPM = 30;
const MAX_BPM = 300;

function defaultStep(): StepData {
  return {
    active: false,
    note: 60,
    velocity: 100,
    duration_ticks: 1,
    probability: 100,
  };
}

function configuredStepCount(
  measures: number,
  stepDuration: number,
  num: number,
  den: number,
): number {
  const safeMeasures = Math.max(1, Math.round(measures || 1));
  const safeStepDuration = Math.max(0.001, stepDuration || 0.25);
  return Math.max(
    1,
    Math.round((safeMeasures * barBeats(num, den)) / safeStepDuration),
  );
}

function resizeSteps(steps: StepData[], length: number): StepData[] {
  const next = steps.slice(0, length).map((step) => ({ ...step }));
  while (next.length < length) next.push(defaultStep());
  return next;
}

function resizeVoices(
  voices: StepData[][],
  length: number,
  voiceCount: number,
): StepData[][] {
  const count = Math.max(1, voices.length || voiceCount || 1);
  return Array.from({ length: count }, (_, i) =>
    resizeSteps(voices[i] || [], length),
  );
}

function camel(trait: string): string {
  return trait.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** The fields a slot editor writes back into the selected slot. */
const PATTERN_FIELDS = ["voicesData", "stepDuration", "swing", "groove"];

/**
 * `<nbplay-sequencer>`: the step sequencer instrument. A header, a transport
 * bar (play, stop, record, tempo, step resolution, bars, loop), an
 * `nbplay-step-grid` and an info line. It follows the session clock named by
 * `sessionId` (a private clock when empty) and schedules its steps with the
 * shared audio scheduler through the track's bus instrument or a built-in
 * oscillator. Grid edits, tempo, resolution, bars and loop fire `nbplay-set`;
 * `isPlaying` and `currentStep` fire `nbplay-status`. With
 * `keyboardConnected`, armed voices record document `nbplay-note` events
 * into the current step, and a double-clicked step waits for the next note.
 */
export class NbplaySequencer extends NbplayElement {
  static properties = {
    voicesData: { attribute: false },
    numVoices: { type: Number, attribute: "num-voices" },
    length: { type: Number },
    measures: { type: Number },
    stepDuration: { type: Number, attribute: "step-duration" },
    timeSignatureNum: { type: Number, attribute: "time-signature-num" },
    timeSignatureDen: { type: Number, attribute: "time-signature-den" },
    bpm: { type: Number },
    loopEnabled: { type: Boolean, attribute: "loop-enabled" },
    keyboardConnected: { type: Boolean, attribute: "keyboard-connected" },
    followTransport: { type: Boolean, attribute: "follow-transport" },
    swing: { type: Number },
    groove: { attribute: false },
    automationLanes: { attribute: false },
    editToken: { type: String, attribute: "edit-token" },
    editAck: { type: String, attribute: "edit-ack" },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    channelIndex: { type: Number, attribute: "channel-index" },
    isPlaying: { type: Boolean, attribute: "is-playing", reflect: true },
    currentStep: { type: Number, attribute: false },
  };

  declare voicesData: StepData[][];
  declare numVoices: number;
  declare length: number;
  declare measures: number;
  declare stepDuration: number;
  declare timeSignatureNum: number;
  declare timeSignatureDen: number;
  declare bpm: number;
  declare loopEnabled: boolean;
  declare keyboardConnected: boolean;
  declare followTransport: boolean;
  declare swing: number;
  declare groove: number[];
  declare automationLanes: AutomationLane[];
  declare editToken: string;
  declare editAck: string;
  declare sessionId: string;
  declare channelIndex: number;
  declare isPlaying: boolean;
  declare currentStep: number;

  private binding: (ClockBinding & { rebind(): void }) | null = null;
  private scheduler = createAudioScheduler({
    onEnd: () => this.onPatternEnd(),
  });
  private armed = new Set<number>();
  private cursor: StepRef | null = null;
  private pending: StepRef | null = null;
  private editSerial = 0;
  private unbindShortcuts: (() => void) | null = null;
  private applyingGrid = false;

  /** The scheduler reads traits by name; present the element as that model. */
  private shim: AnyModel = {
    get: (name) => (this as unknown as Record<string, unknown>)[camel(name)],
    set: (name, value) => {
      const prop = camel(name);
      (this as unknown as Record<string, unknown>)[prop] = value;
      // Scheduled steps and automation are local mirrors, not kernel writes.
      this.status(false, { [prop]: value });
    },
    save_changes: () => {},
    on: () => {},
  };

  constructor() {
    super();
    this.voicesData = [];
    this.numVoices = 1;
    this.length = 16;
    this.measures = 1;
    this.stepDuration = 0.25;
    this.timeSignatureNum = 4;
    this.timeSignatureDen = 4;
    this.bpm = 120;
    this.loopEnabled = true;
    this.keyboardConnected = false;
    this.followTransport = true;
    this.swing = 0;
    this.groove = [];
    this.automationLanes = [];
    this.editToken = "";
    this.editAck = "";
    this.sessionId = "";
    this.channelIndex = -1;
    this.isPlaying = false;
    this.currentStep = -1;
  }

  // Clock

  clock(): SessionClock {
    if (!this.binding) {
      this.binding = bindElementClock(this, this.onClockEvent, this.onRebind);
      const clk = this.binding.clock();
      this.joinTempo(clk);
      this.isPlaying = clk.playing;
      this.currentStep = -1;
      if (clk.playing) this.startScheduler();
    }
    return this.binding.clock();
  }

  private shared(): boolean {
    return Boolean(this.sessionId);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-sequencer");
    this.tabIndex = 0;
    this.reconcileGridWithData();
    this.clock();
    this.unbindShortcuts = bindShortcuts(this, {
      Space: () => this.togglePlay(),
      "Shift+Space": () => this.stopAndRewind(),
      ArrowLeft: () => this.moveCursor(0, -1),
      ArrowRight: () => this.moveCursor(0, 1),
      ArrowUp: () => this.moveCursor(-1, 0),
      ArrowDown: () => this.moveCursor(1, 0),
      Enter: () => this.toggleCursorStep(),
      x: () => this.toggleCursorStep(),
      Escape: () => {
        this.cancelPendingEdit();
        this.cursor = null;
        this.requestUpdate();
      },
    });
    // The keyboard dispatches this on Escape while a ♪? edit is pending.
    this.addEventListener("nbplay-cancel-edit", this.onCancelEdit);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("nbplay-note", this.onDocumentNote);
    this.removeEventListener("nbplay-cancel-edit", this.onCancelEdit);
    this.cancelPendingEdit();
    this.unbindShortcuts?.();
    this.unbindShortcuts = null;
    this.scheduler.destroy();
    this.binding?.dispose();
    this.binding = null;
  }

  private set(values: Record<string, unknown>): void {
    if (!this.editToken) {
      this.emitDetail("nbplay-set", { values });
      return;
    }
    // A slot editor loaded this pattern and named it with `editToken`. Each
    // pattern field goes out behind an ack of the token it was edited on, so
    // the host can drop an edit made on a pattern it has since replaced.
    for (const [key, value] of Object.entries(values)) {
      if (PATTERN_FIELDS.includes(key)) {
        this.editSerial += 1;
        this.editAck = `${this.editToken}#${this.editSerial}`;
        this.emitDetail("nbplay-set", { values: { editAck: this.editAck } });
      }
      this.emitDetail("nbplay-set", { values: { [key]: value } });
    }
  }

  private status(save: boolean, values: Record<string, unknown>): void {
    this.emitDetail("nbplay-status", { values, save });
  }

  private startScheduler(): void {
    if (!this.scheduler.isPlaying())
      this.scheduler.start(this.shim, this.clock());
  }

  private stopLocal(save: boolean): void {
    this.scheduler.stop();
    this.isPlaying = false;
    this.currentStep = -1;
    this.status(save, { isPlaying: false, currentStep: -1 });
  }

  private onPatternEnd(): void {
    // A one-shot pattern finished. Standalone sequencers own their clock and
    // rewind it; in a session the clock keeps running for other widgets.
    if (this.shared()) {
      this.stopLocal(true);
    } else {
      const clk = this.clock();
      clk.stop();
      clk.seek(0);
    }
  }

  private onClockEvent = (event: ClockEvent): void => {
    switch (event.type) {
      case "play":
        if (this.followTransport === false) break;
        this.startScheduler();
        this.isPlaying = true;
        this.status(true, { isPlaying: true });
        break;
      case "stop":
        this.stopLocal(true);
        break;
      case "seek":
      case "loop":
        this.scheduler.realign();
        break;
      case "tempo": {
        this.scheduler.realign();
        const bpm = this.clock().bpm;
        if (Number(this.bpm) !== bpm) {
          this.bpm = bpm;
          this.set({ bpm });
        }
        break;
      }
      case "record":
      case "timesig":
        break;
    }
  };

  /** Join `clk`: set its tempo if no element has yet, otherwise take it. */
  private joinTempo(clk: SessionClock): void {
    const bpm = clk.adoptTempo(Number(this.bpm));
    if (bpm !== Number(this.bpm)) {
      this.bpm = bpm;
      this.set({ bpm });
    }
  }

  private onRebind = (clk: SessionClock): void => {
    this.scheduler.stop();
    this.joinTempo(clk);
    this.currentStep = -1;
    if (clk.playing && this.followTransport !== false) this.startScheduler();
    this.isPlaying = this.scheduler.isPlaying();
    this.status(false, { isPlaying: this.isPlaying, currentStep: -1 });
  };

  updated(changed: PropertyValues): void {
    if (!this.binding) return;
    // A tempo that arrives with the session id is the model's at render,
    // which joins the clock; a later write is the host setting the tempo.
    const joined =
      changed.has("sessionId") && changed.get("sessionId") !== undefined;
    if (joined) this.binding.rebind();
    const clk = this.clock();
    if (changed.has("bpm") && !joined && Number(this.bpm) !== clk.bpm) {
      clk.setTempo(Number(this.bpm));
    }
    if (
      (changed.has("measures") ||
        changed.has("stepDuration") ||
        changed.has("timeSignatureNum") ||
        changed.has("timeSignatureDen")) &&
      !this.applyingGrid &&
      [...changed.keys()].some((k) => changed.get(k) !== undefined)
    ) {
      this.applyGrid({});
    }
    if (changed.has("isPlaying") && changed.get("isPlaying") !== undefined) {
      this.onPlayStateChange(clk);
    }
    if (changed.has("keyboardConnected") && !this.keyboardConnected) {
      this.cancelPendingEdit();
    }
  }

  /** `isPlaying` written by the host (kernel, Session link). */
  private onPlayStateChange(clk: SessionClock): void {
    if (this.shared()) {
      // In a session `isPlaying` is status mirrored from the transport.
      // Scheduling follows clock events and this element's own buttons, so a
      // delayed echo can neither silence nor restart the track; a value that
      // disagrees with this sequencer's scheduler is written back.
      const running = this.scheduler.isPlaying();
      if (Boolean(this.isPlaying) !== running) {
        this.isPlaying = running;
        this.status(true, { isPlaying: running });
      }
      return;
    }
    if (this.isPlaying) {
      if (clk.playing) this.startScheduler();
      else clk.play();
    } else {
      this.scheduler.stop();
      clk.stop();
    }
  }

  // Grid configuration

  private voices(): StepData[][] {
    return Array.isArray(this.voicesData) ? this.voicesData : [];
  }

  private actualLength(): number {
    return this.voices()[0]?.length || Number(this.length || 0) || 1;
  }

  private configuredLength(): number {
    return configuredStepCount(
      Number(this.measures || 1),
      Number(this.stepDuration || 0.25),
      Number(this.timeSignatureNum || 4),
      Number(this.timeSignatureDen || 4),
    );
  }

  /** At render the data wins: fit the controls to the steps that exist. */
  private reconcileGridWithData(): void {
    const actual = this.actualLength();
    if (actual === this.configuredLength()) return;
    const measures = Math.max(1, Number(this.measures || 1));
    const beats =
      measures *
      barBeats(
        Number(this.timeSignatureNum || 4),
        Number(this.timeSignatureDen || 4),
      );
    const inferred = Math.max(0.001, beats / Math.max(1, actual));
    const matched = STEP_DURATION_OPTIONS.find(
      (option) => Math.abs(option - inferred) < 0.0001,
    );
    this.length = actual;
    this.stepDuration = matched ?? inferred;
    this.status(false, {
      length: this.length,
      stepDuration: this.stepDuration,
    });
  }

  /** Later the controls win: resize the steps to the configured length. */
  private applyGrid(updates: {
    measures?: number;
    stepDuration?: number;
  }): void {
    if (this.applyingGrid) return;
    this.applyingGrid = true;
    try {
      const measures = clamp(
        Math.round(updates.measures ?? Number(this.measures || 1)),
        1,
        64,
      );
      const stepDuration = Math.max(
        0.001,
        updates.stepDuration ?? Number(this.stepDuration || 0.25),
      );
      const length = configuredStepCount(
        measures,
        stepDuration,
        Number(this.timeSignatureNum || 4),
        Number(this.timeSignatureDen || 4),
      );
      const voicesData = resizeVoices(
        this.voices(),
        length,
        Number(this.numVoices || 1),
      );
      const changed =
        measures !== this.measures ||
        stepDuration !== this.stepDuration ||
        length !== this.length ||
        JSON.stringify(voicesData) !== JSON.stringify(this.voicesData);
      this.measures = measures;
      this.stepDuration = stepDuration;
      this.length = length;
      this.voicesData = voicesData;
      if (changed) this.set({ measures, stepDuration, length, voicesData });
    } finally {
      this.applyingGrid = false;
    }
  }

  private writeStep(
    voice: number,
    step: number,
    patch: Partial<StepData>,
  ): void {
    const voicesData = [...this.voices()];
    const steps = [...(voicesData[voice] || [])];
    if (step >= steps.length) return;
    steps[step] = { ...steps[step], ...patch };
    voicesData[voice] = steps;
    this.voicesData = voicesData;
    this.set({ voicesData });
  }

  // Recording from the keyboard

  private armedChanged(): void {
    if (this.armed.size > 0) {
      document.addEventListener("nbplay-note", this.onDocumentNote);
    } else {
      document.removeEventListener("nbplay-note", this.onDocumentNote);
    }
    this.requestUpdate();
  }

  private onDocumentNote = (e: Event): void => {
    const evt = (e as CustomEvent).detail as
      | { note: number; velocity: number; type: string }
      | undefined;
    if (!evt || this.armed.size === 0 || evt.type !== "on") return;
    // -1 while stopped, so a note only lands while a step is current.
    const step = this.currentStep;
    if (step < 0) return;
    const voicesData = [...this.voices()];
    if (voicesData.length === 0) return;
    let changed = false;
    for (const v of this.armed) {
      const steps = [...(voicesData[v] || [])];
      if (v < voicesData.length && step < steps.length) {
        steps[step] = {
          ...steps[step],
          note: evt.note,
          velocity: evt.velocity,
          active: true,
        };
        voicesData[v] = steps;
        changed = true;
      }
    }
    if (changed) {
      this.voicesData = voicesData;
      this.set({ voicesData });
    }
  };

  private toggleArm(voice: number, armed?: boolean): void {
    const on = armed ?? !this.armed.has(voice);
    if (on) this.armed.add(voice);
    else this.armed.delete(voice);
    this.armedChanged();
  }

  private toggleRecordAll(): void {
    if (this.armed.size > 0) this.armed.clear();
    else this.voices().forEach((_, v) => this.armed.add(v));
    this.armedChanged();
  }

  // ♪? edit: the next keyboard note fills the step

  private onPendingNote = (e: Event): void => {
    const evt = (e as CustomEvent).detail as {
      note: number;
      velocity: number;
      type: string;
    };
    if (evt.type !== "on" || !this.pending) return;
    const { voice, step } = this.pending;
    this.cancelPendingEdit();
    this.writeStep(voice, step, {
      note: evt.note,
      velocity: evt.velocity,
      active: true,
    });
  };

  private waitForNote(voice: number, step: number): void {
    if (!this.keyboardConnected) return;
    this.cancelPendingEdit();
    this.pending = { voice, step };
    // Focus so keystrokes do not go to the notebook.
    this.focus();
    document.addEventListener("nbplay-note", this.onPendingNote);
    this.requestUpdate();
  }

  private cancelPendingEdit(): void {
    document.removeEventListener("nbplay-note", this.onPendingNote);
    if (this.pending) {
      this.pending = null;
      this.requestUpdate();
    }
  }

  private onCancelEdit = (): void => this.cancelPendingEdit();

  // Transport

  togglePlay(): void {
    const clk = this.clock();
    if (this.isPlaying) {
      // In a session, pausing this sequencer leaves the shared clock alone.
      if (this.shared()) this.stopLocal(true);
      else clk.stop();
    } else if (clk.playing) {
      this.startScheduler();
      this.isPlaying = true;
      this.status(true, { isPlaying: true });
    } else {
      clk.play();
      if (this.followTransport === false) {
        // The clock event was ignored on purpose; this button still plays.
        this.startScheduler();
        this.isPlaying = true;
        this.status(true, { isPlaying: true });
      }
    }
  }

  stopAndRewind(): void {
    const clk = this.clock();
    if (clk.playing) clk.stop();
    else this.stopLocal(true);
    clk.seek(0);
  }

  /** Stop and disarm (kernel disconnect). */
  halt(): void {
    this.scheduler.stop();
    if (!this.shared()) this.clock().stop();
    this.stopLocal(false);
    this.armed.clear();
    this.armedChanged();
  }

  // Keyboard step cursor

  private moveCursor(dVoice: number, dStep: number): void {
    const voices = this.voices();
    if (voices.length === 0) return;
    const steps = voices[0].length;
    const next = this.cursor
      ? { voice: this.cursor.voice + dVoice, step: this.cursor.step + dStep }
      : { voice: 0, step: 0 };
    this.cursor = {
      voice: clamp(next.voice, 0, voices.length - 1),
      step: clamp(next.step, 0, steps - 1),
    };
    this.requestUpdate();
  }

  private toggleCursorStep(): void {
    if (!this.cursor) {
      this.moveCursor(0, 0);
      return;
    }
    const { voice, step } = this.cursor;
    const current = this.voices()[voice]?.[step];
    if (current) this.writeStep(voice, step, { active: !current.active });
  }

  // Render

  private info(): string {
    const voices = this.voices();
    const steps = voices[0]?.length || 0;
    const active = voices.reduce(
      (n, v) => n + v.filter((s) => s.active).length,
      0,
    );
    const voiceInfo = voices.length > 1 ? ` · ${voices.length} voices` : "";
    const measures = Math.max(1, Number(this.measures || 1));
    const measureText = measures === 1 ? "1 measure" : `${measures} measures`;
    return `${active}/${steps * voices.length} steps active${voiceInfo} · ${this.bpm} BPM · ${measureText} · ${this.actualLength()} steps`;
  }

  render() {
    const stop = (e: Event) => e.stopPropagation();
    const onTempo = (e: Event) => {
      e.stopPropagation();
      this.clock().setTempo((e as CustomEvent).detail.value as number);
    };
    const recording = this.armed.size > 0;
    return html`<nbplay-header badge="sequencer"></nbplay-header>
      <div class="nbplay-seq-transport">
        <button
          type="button"
          class="nbplay-seq-btn nbplay-seq-play ${this.isPlaying ? "playing" : ""}"
          title="Play/Stop"
          @click=${() => this.togglePlay()}
        >
          ${this.isPlaying ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          class="nbplay-seq-btn nbplay-seq-stop"
          title="Stop"
          @click=${() => this.stopAndRewind()}
        >
          ■
        </button>
        <button
          type="button"
          class="nbplay-seq-btn nbplay-seq-rec ${recording ? "recording" : ""}"
          title="Record from keyboard"
          ?hidden=${!this.keyboardConnected}
          @click=${() => this.toggleRecordAll()}
        >
          ⏺
        </button>
        <nbplay-param
          class="nbplay-seq-bpm"
          label="BPM"
          kind="bpm"
          .value=${this.bpm}
          .min=${MIN_BPM}
          .max=${MAX_BPM}
          .step=${1}
          .defaultValue=${120}
          @input=${onTempo}
          @change=${onTempo}
        ></nbplay-param>
        <label class="nbplay-seq-field">
          <span class="nbplay-seq-label">Step</span>
          <select
            class="nbplay-seq-dur-select"
            .value=${String(this.stepDuration)}
            @input=${stop}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.applyGrid({
                stepDuration: parseFloat((e.target as HTMLSelectElement).value),
              });
            }}
          >
            ${STEP_DURATION_OPTIONS.map(
              (d) =>
                html`<option
                  value=${d}
                  ?selected=${d === this.stepDuration}
                  .textContent=${`1/${4 / d}`}
                ></option>`,
            )}
          </select>
        </label>
        <label class="nbplay-seq-field">
          <span class="nbplay-seq-label">Bars</span>
          <input
            type="number"
            class="nbplay-seq-measures-input"
            min="1"
            max="64"
            step="1"
            .value=${String(this.measures || 1)}
            @change=${stop}
            @input=${(e: Event) => {
              e.stopPropagation();
              const parsed = parseInt((e.target as HTMLInputElement).value, 10);
              if (!Number.isNaN(parsed)) this.applyGrid({ measures: parsed });
            }}
          />
          <span class="nbplay-seq-length-val"
            >${this.actualLength()} steps</span
          >
        </label>
        <label class="nbplay-seq-loop-label">
          <input
            type="checkbox"
            class="nbplay-seq-loop-chk"
            .checked=${this.loopEnabled}
            @input=${stop}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.loopEnabled = (e.target as HTMLInputElement).checked;
              this.set({ loopEnabled: this.loopEnabled });
            }}
          />
          Loop
        </label>
      </div>
      <nbplay-step-grid
        .voices=${this.voices()}
        .currentStep=${this.currentStep}
        .cursor=${this.cursor}
        .pending=${this.pending}
        .armed=${Array.from(this.armed)}
        .showArm=${this.keyboardConnected}
        @input=${stop}
        @change=${(e: Event) => {
          e.stopPropagation();
          const { voice, step, field, value } = (e as CustomEvent).detail;
          this.writeStep(voice, step, { [field]: value });
        }}
        @nbplay-arm=${(e: Event) => {
          e.stopPropagation();
          const { voice, armed } = (e as CustomEvent).detail;
          this.toggleArm(voice, armed);
        }}
        @nbplay-step-pick=${(e: Event) => {
          e.stopPropagation();
          const { voice, step } = (e as CustomEvent).detail;
          this.waitForNote(voice, step);
        }}
      ></nbplay-step-grid>
      <div class="nbplay-seq-footer">
        <span class="nbplay-seq-info">${this.info()}</span>
      </div>`;
  }
}

define("nbplay-sequencer", NbplaySequencer);
