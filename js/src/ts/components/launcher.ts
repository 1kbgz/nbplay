import { html } from "lit";
import { type PropertyValues } from "lit";
import { type AnyModel, bindShortcuts } from "../helpers.ts";
import {
  type AudioScheduler,
  createAudioScheduler,
  type StepData,
} from "../scheduler.ts";
import {
  bindElementClock,
  type ClockBinding,
  type ClockEvent,
  type SessionClock,
} from "../session.ts";
import { NbplayElement, define } from "./base.ts";
import { STOP_QUEUED as GRID_STOP_QUEUED } from "./launcher-grid.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./header.ts";
import "./launcher-grid.ts";

/** Trait values: no launch queued, or a queued stop. */
const NONE_QUEUED = -2;
const STOP_QUEUED = -1;
const QUEUE_INTERVAL_MS = 25;

export interface LauncherTrackSpec {
  name: string;
  channel_index: number;
}

export interface LauncherSlotData {
  track_index: number;
  scene_index: number;
  name: string;
  voices_data: StepData[][];
  step_duration: number;
  swing: number;
  groove: number[];
}

export interface LaunchRequest {
  action?: "launch" | "stop" | "scene" | "stop_all";
  track_index?: number;
  scene_index?: number;
  nonce?: number;
}

interface QueuedLaunch {
  /** Scene to start, or STOP_QUEUED. */
  scene: number;
  /** Scene the request came from: a scene launch marks every row with it. */
  viaScene: number;
  atBeat: number;
  /** AudioContext time of the boundary; survives loop wraps. */
  atTime: number;
}

interface Launch {
  trackIndex: number;
  scene: number;
  viaScene: number;
}

interface TrackState {
  scheduler: AudioScheduler;
  activeScene: number;
  /** Serialized pattern the scheduler was started with. */
  activeData: string;
  queued: QueuedLaunch | null;
  currentStep: number;
}

function numberValue(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function slotData(slot: LauncherSlotData): string {
  return JSON.stringify([
    slot.voices_data,
    slot.step_duration,
    slot.swing,
    slot.groove,
  ]);
}

// One engine per launcher. Every view of the same widget carries its
// `engineKey`; the first to connect runs the schedulers and the others render
// its state and send it their launches, so a launcher displayed twice plays
// once. When the engine's view goes away the next one takes over.
const engines = new Map<string, NbplayLauncher>();
const views = new Map<string, Set<NbplayLauncher>>();

/**
 * `<nbplay-launcher>`: the beats view. Tracks are rows, scenes are columns,
 * each filled slot holds a step pattern in the sequencer's `voices_data`
 * shape. Every track runs one pattern at a time through the shared audio
 * scheduler against the session clock, so all playing slots stay
 * phase-locked; launches take effect on the next `quantize` boundary (bar,
 * beat, or none). Clicking a filled slot selects it (`selectedSlot`) and
 * launches it; an empty slot, the track stop and stop-all queue stops.
 * `quantize` and `selectedSlot` edits fire `nbplay-set`; `isPlaying`,
 * `activeSlots` and `queuedSlots` fire `nbplay-status`. `command()` takes a
 * kernel launch request (`launch`, `stop`, `scene`, `stop_all`). Elements
 * with the same `engineKey` are views of one launcher and share one engine.
 */
export class NbplayLauncher extends NbplayElement {
  static properties = {
    tracks: { attribute: false },
    scenes: { attribute: false },
    slots: { attribute: false },
    quantize: { type: String },
    bpm: { type: Number },
    timeSignatureNum: { type: Number, attribute: "time-signature-num" },
    selectedSlot: { attribute: false },
    engineKey: { type: String, attribute: "engine-key" },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    isPlaying: { type: Boolean, attribute: "is-playing", reflect: true },
    activeSlots: { attribute: false },
    queuedSlots: { attribute: false },
  };

  declare tracks: Partial<LauncherTrackSpec>[];
  declare scenes: string[];
  declare slots: Partial<LauncherSlotData>[];
  declare quantize: "bar" | "beat" | "none";
  declare bpm: number;
  declare timeSignatureNum: number;
  declare selectedSlot: { track_index?: number; scene_index?: number };
  declare engineKey: string;
  declare sessionId: string;
  declare isPlaying: boolean;
  declare activeSlots: number[];
  declare queuedSlots: number[];

  private states: TrackState[] = [];
  private binding: (ClockBinding & { rebind(): void }) | null = null;
  private queueTimer: ReturnType<typeof setInterval> | null = null;
  private unbindShortcuts: (() => void) | null = null;
  private progress: number[] = [];
  /** The view running the engine when it is not this one. */
  private engine: NbplayLauncher | null = null;
  /** The engine key this element is registered under. */
  private joined = "";

  constructor() {
    super();
    this.tracks = [];
    this.scenes = [];
    this.slots = [];
    this.quantize = "bar";
    this.bpm = 120;
    this.timeSignatureNum = 4;
    this.selectedSlot = {};
    this.engineKey = "";
    this.sessionId = "";
    this.isPlaying = false;
    this.activeSlots = [];
    this.queuedSlots = [];
  }

  // Data views

  private trackList(): LauncherTrackSpec[] {
    return (this.tracks || []).map((track, index) => ({
      name: String(track.name ?? `Track ${index + 1}`),
      channel_index: numberValue(track.channel_index, index),
    }));
  }

  private sceneList(): string[] {
    return (this.scenes || []).map(String);
  }

  private slotList(): LauncherSlotData[] {
    return (this.slots || [])
      .filter(
        (slot) => Array.isArray(slot.voices_data) && slot.voices_data.length,
      )
      .map((slot) => ({
        track_index: numberValue(slot.track_index, 0),
        scene_index: numberValue(slot.scene_index, 0),
        name: String(slot.name ?? "Clip"),
        voices_data: slot.voices_data as StepData[][],
        step_duration: Math.max(0.001, numberValue(slot.step_duration, 0.25)),
        swing: numberValue(slot.swing, 0),
        groove: (slot.groove || []).map((v) => numberValue(v, 0)),
      }));
  }

  private findSlot(
    trackIndex: number,
    sceneIndex: number,
  ): LauncherSlotData | null {
    return (
      this.slotList().find(
        (slot) =>
          slot.track_index === trackIndex && slot.scene_index === sceneIndex,
      ) || null
    );
  }

  private beatsPerBar(): number {
    return Math.max(1, numberValue(this.timeSignatureNum, 4));
  }

  /**
   * Present a slot to the shared scheduler as a minimal model. The scheduler
   * reads pattern traits through get() and reports the step through set().
   */
  private slotModel(
    track: LauncherTrackSpec,
    slot: LauncherSlotData,
    onStep: (step: number) => void,
  ): AnyModel {
    return {
      get: (name: string): unknown => {
        switch (name) {
          case "voices_data":
            return slot.voices_data;
          case "step_duration":
            return slot.step_duration;
          case "swing":
            return slot.swing;
          case "groove":
            return slot.groove;
          case "loop_enabled":
            return true;
          case "automation_lanes":
            return [];
          case "session_id":
            return this.sessionId;
          case "channel_index":
            return track.channel_index;
          default:
            return undefined;
        }
      },
      set: (name: string, value: unknown): void => {
        if (name === "current_step") onStep(numberValue(value, -1));
      },
      save_changes: () => {},
      on: () => {},
    };
  }

  // Lifecycle

  clock(): SessionClock {
    if (!this.binding) {
      this.binding = bindElementClock(this, this.onClockEvent, this.onRebind);
      const clk = this.binding.clock();
      clk.setTempo(numberValue(this.bpm, 120));
      this.isPlaying = clk.playing;
      this.activeSlots = this.trackList().map(() => -1);
      this.queuedSlots = this.trackList().map(() => NONE_QUEUED);
    }
    return this.binding.clock();
  }

  private shared(): boolean {
    return Boolean(this.sessionId);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-launcher");
    this.tabIndex = 0;
    this.clock();
    this.ensureStates();
    this.join();
    // Space toggles the clock, digits launch scenes, Escape/0 stop all.
    const shortcuts: Record<string, () => boolean | void> = {
      Space: () => {
        const clk = this.clock();
        if (clk.playing) clk.stop();
        else clk.play();
      },
      Escape: () => this.stopAll(),
      "0": () => this.stopAll(),
    };
    for (let digit = 1; digit <= 9; digit++) {
      shortcuts[String(digit)] = () => {
        if (digit - 1 >= this.sceneList().length) return false;
        this.launchScene(digit - 1);
      };
    }
    this.unbindShortcuts = bindShortcuts(this, shortcuts);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.leave();
    this.stopQueueTimer();
    this.unbindShortcuts?.();
    this.unbindShortcuts = null;
    this.states.forEach((state) => state.scheduler.destroy());
    this.states.length = 0;
    this.binding?.dispose();
    this.binding = null;
  }

  // Engine sharing

  /** Register under `engineKey`: run the engine if no view does, else follow the one that does. */
  private join(): void {
    this.leave();
    const key = this.isConnected ? this.engineKey : "";
    if (!key) return;
    this.joined = key;
    const engine = engines.get(key);
    if (!engine) {
      engines.set(key, this);
      return;
    }
    this.engine = engine;
    if (!views.has(key)) views.set(key, new Set());
    views.get(key)?.add(this);
    // Another view plays: this one's own schedulers stay quiet.
    this.stopQueueTimer();
    this.states.forEach((state) => {
      state.scheduler.stop();
      state.queued = null;
      state.currentStep = -1;
    });
  }

  private leave(): void {
    const key = this.joined;
    if (!key) return;
    this.joined = "";
    const following = views.get(key);
    if (this.engine) {
      following?.delete(this);
      this.engine = null;
      return;
    }
    if (engines.get(key) !== this) return;
    engines.delete(key);
    const next = following?.values().next().value;
    if (!next) return;
    following?.delete(next);
    engines.set(key, next);
    following?.forEach((view) => {
      view.engine = next;
    });
    next.takeOver();
  }

  /** Run the engine from here on, continuing the performance the old engine reported. */
  private takeOver(): void {
    this.engine = null;
    this.ensureStates();
    this.states.forEach((state, index) => {
      state.activeScene = numberValue(this.activeSlots?.[index], -1);
    });
    if (this.clock().playing) this.resumeActive();
    this.mirrorSlotState(true);
  }

  updated(changed: PropertyValues): void {
    if (!this.binding) return;
    if (changed.has("engineKey")) this.join();
    if (changed.has("sessionId") && changed.get("sessionId") !== undefined) {
      this.binding.rebind();
    }
    if (changed.has("bpm") && changed.get("bpm") !== undefined) {
      this.clock().setTempo(numberValue(this.bpm, 120));
    }
    if (this.engine) return;
    if (changed.has("tracks") && changed.get("tracks") !== undefined) {
      // Track indices shift when a track is removed, so a running
      // performance cannot be mapped onto the new rows: stop everything.
      if (this.trackList().length < this.states.length) this.clearStates();
      this.ensureStates();
      this.mirrorSlotState(true);
    }
    if (changed.has("slots") && changed.get("slots") !== undefined) {
      // A playing slot whose pattern changed restarts on the new data. A
      // slots write that leaves it unchanged (the editor echoing a slot it
      // just loaded) must not restart it: the restart would schedule the
      // step inside the alignment grace a second time.
      this.states.forEach((state, index) => {
        if (state.activeScene < 0 || !this.clock().playing) return;
        const slot = this.findSlot(index, state.activeScene);
        if (!slot) {
          this.stopNow(index);
          return;
        }
        if (slotData(slot) !== state.activeData)
          this.startSlot(index, state.activeScene);
      });
      this.mirrorSlotState(true);
    }
    if (changed.has("isPlaying") && changed.get("isPlaying") !== undefined) {
      // In a session `isPlaying` is status mirrored from the transport;
      // only a standalone launcher treats a host write as a command.
      if (!this.shared()) {
        const clk = this.clock();
        if (this.isPlaying) {
          if (!clk.playing) clk.play();
        } else if (clk.playing) {
          clk.stop();
        }
      }
    }
  }

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  private status(save: boolean, values: Record<string, unknown>): void {
    this.emitDetail("nbplay-status", { values, save });
  }

  // Track state

  private ensureStates(): void {
    const count = this.trackList().length;
    while (this.states.length < count) {
      const index = this.states.length;
      this.states.push({
        scheduler: createAudioScheduler({ onEnd: () => this.stopNow(index) }),
        activeScene: -1,
        activeData: "",
        queued: null,
        currentStep: -1,
      });
    }
    while (this.states.length > count) {
      this.states.pop()?.scheduler.destroy();
    }
  }

  private clearStates(): void {
    this.states.forEach((state) => {
      state.scheduler.stop();
      state.activeScene = -1;
      state.activeData = "";
      state.queued = null;
      state.currentStep = -1;
    });
  }

  private mirrorSlotState(save: boolean): void {
    this.activeSlots = this.states.map((state) => state.activeScene);
    this.queuedSlots = this.states.map((state) =>
      state.queued ? state.queued.scene : NONE_QUEUED,
    );
    this.syncProgress();
    this.status(save, {
      activeSlots: this.activeSlots,
      queuedSlots: this.queuedSlots,
    });
  }

  private syncProgress(): void {
    this.progress = this.states.map((state, index) => {
      if (state.activeScene < 0 || state.currentStep < 0) return 0;
      const length =
        this.findSlot(index, state.activeScene)?.voices_data[0]?.length || 0;
      return length > 0 ? (state.currentStep + 1) / length : 0;
    });
    this.requestUpdate();
    views.get(this.joined)?.forEach((view) => view.requestUpdate());
  }

  // Clock

  private onClockEvent = (event: ClockEvent): void => {
    if (this.engine) return;
    switch (event.type) {
      case "play":
        this.isPlaying = true;
        this.status(true, { isPlaying: true });
        this.startQueueTimer();
        break;
      case "stop":
        // Like a hardware launcher: stop clears every launched and queued
        // slot. Play alone resumes nothing; the next launch starts fresh.
        this.stopQueueTimer();
        this.clearStates();
        this.isPlaying = false;
        this.status(true, { isPlaying: false });
        this.mirrorSlotState(true);
        break;
      case "seek":
      case "tempo":
      case "loop":
        this.states.forEach((state) => state.scheduler.realign());
        this.requantize();
        break;
      case "record":
      case "timesig":
        break;
    }
  };

  private onRebind = (clk: SessionClock): void => {
    this.states.forEach((state) => state.scheduler.stop());
    if (this.engine) return;
    this.isPlaying = clk.playing;
    this.status(false, { isPlaying: clk.playing });
    if (clk.playing) this.resumeActive();
    else this.clearStates();
    this.syncProgress();
  };

  // Launching

  private startSlot(trackIndex: number, sceneIndex: number): boolean {
    this.ensureStates();
    const state = this.states[trackIndex];
    const track = this.trackList()[trackIndex];
    const slot = this.findSlot(trackIndex, sceneIndex);
    if (!state || !track || !slot) return false;
    state.scheduler.stop();
    state.activeScene = sceneIndex;
    state.activeData = slotData(slot);
    state.currentStep = -1;
    if (this.clock().playing) {
      state.scheduler.start(
        this.slotModel(track, slot, (step) => {
          state.currentStep = step;
          this.syncProgress();
        }),
        this.clock(),
      );
    }
    return true;
  }

  private stopNow(trackIndex: number): void {
    const state = this.states[trackIndex];
    if (!state) return;
    state.scheduler.stop();
    state.activeScene = -1;
    state.activeData = "";
    state.currentStep = -1;
  }

  private resumeActive(): void {
    this.ensureStates();
    this.states.forEach((state, index) => {
      if (state.activeScene >= 0) this.startSlot(index, state.activeScene);
    });
  }

  private nextBoundary(beat: number): number {
    const quantize = String(this.quantize || "bar");
    if (quantize === "none") return beat;
    const unit = quantize === "beat" ? 1 : this.beatsPerBar();
    const next = Math.ceil(beat / unit - 1e-6) * unit;
    return Math.max(beat, next);
  }

  /**
   * Context time at which `atBeat` arrives, measured from the current
   * position. With a loop, a boundary past the loop end arrives when the
   * loop restarts. Time, not beat, so a wrap cannot strand the launch.
   */
  private boundaryTime(
    clk: SessionClock,
    beat: number,
    atBeat: number,
  ): number {
    const loop = clk.loop;
    const target =
      loop.enabled && loop.endBeat > loop.startBeat && atBeat > loop.endBeat
        ? loop.endBeat
        : atBeat;
    return clk.now() + Math.max(0, target - beat) * clk.secondsPerBeat();
  }

  private applyNow(launch: Launch): void {
    if (launch.scene >= 0) this.startSlot(launch.trackIndex, launch.scene);
    else this.stopNow(launch.trackIndex);
    this.states[launch.trackIndex].queued = null;
  }

  /** Apply a batch of launches to one clock position so rows stay together. */
  private applyLaunches(launches: Launch[]): void {
    if (this.engine) {
      this.engine.applyLaunches(launches);
      return;
    }
    this.ensureStates();
    const valid = launches.filter((launch) => this.states[launch.trackIndex]);
    if (!valid.length) return;
    const clk = this.clock();
    if (!clk.playing) {
      // Launching from a stopped session starts the transport with only
      // these slots playing: nothing from before the stop comes back. A
      // stop request alone just clears the row and leaves the clock be.
      if (valid.some((launch) => launch.scene >= 0)) clk.play();
      valid.forEach((launch) => this.applyNow(launch));
      this.mirrorSlotState(true);
      return;
    }
    const beat = clk.beat();
    const atBeat = this.nextBoundary(beat);
    if (atBeat <= beat + 1e-9) {
      valid.forEach((launch) => this.applyNow(launch));
      this.mirrorSlotState(true);
      return;
    }
    const atTime = this.boundaryTime(clk, beat, atBeat);
    valid.forEach((launch) => {
      this.states[launch.trackIndex].queued = {
        scene: launch.scene,
        viaScene: launch.viaScene,
        atBeat,
        atTime,
      };
    });
    this.startQueueTimer();
    this.mirrorSlotState(true);
  }

  private queue(trackIndex: number, scene: number): void {
    this.applyLaunches([{ trackIndex, scene, viaScene: scene }]);
  }

  /** After a seek, tempo, or loop change, pending launches re-aim. */
  private requantize(): void {
    const clk = this.clock();
    if (!clk.playing || !this.states.some((state) => state.queued)) return;
    const beat = clk.beat();
    const atBeat = this.nextBoundary(beat);
    const atTime = this.boundaryTime(clk, beat, atBeat);
    this.states.forEach((state) => {
      if (state.queued) state.queued = { ...state.queued, atBeat, atTime };
    });
  }

  private processQueue = (): void => {
    const clk = this.clock();
    const now = clk.now();
    let changed = false;
    this.states.forEach((state, index) => {
      const queued = state.queued;
      if (!queued) return;
      if (now + 1e-6 >= queued.atTime) {
        state.queued = null;
        if (queued.scene >= 0) this.startSlot(index, queued.scene);
        else this.stopNow(index);
        changed = true;
      }
    });
    if (changed) this.mirrorSlotState(true);
    if (!this.states.some((state) => state.queued)) this.stopQueueTimer();
  };

  private startQueueTimer(): void {
    if (this.queueTimer || !this.states.some((state) => state.queued)) return;
    this.queueTimer = setInterval(this.processQueue, QUEUE_INTERVAL_MS);
    this.processQueue();
  }

  private stopQueueTimer(): void {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
      this.queueTimer = null;
    }
  }

  launchScene(sceneIndex: number): void {
    this.applyLaunches(
      this.trackList().map((_, index) => ({
        trackIndex: index,
        scene: this.findSlot(index, sceneIndex) ? sceneIndex : STOP_QUEUED,
        viaScene: sceneIndex,
      })),
    );
  }

  stopAll(): void {
    this.applyLaunches(
      this.trackList().map((_, index) => ({
        trackIndex: index,
        scene: STOP_QUEUED,
        viaScene: STOP_QUEUED,
      })),
    );
  }

  /** A kernel launch request. */
  command(request: LaunchRequest): void {
    const trackIndex = numberValue(request.track_index, -1);
    const sceneIndex = numberValue(request.scene_index, -1);
    switch (request.action) {
      case "launch":
        if (trackIndex >= 0 && sceneIndex >= 0)
          this.queue(trackIndex, sceneIndex);
        break;
      case "stop":
        if (trackIndex >= 0) this.queue(trackIndex, STOP_QUEUED);
        break;
      case "scene":
        if (sceneIndex >= 0) this.launchScene(sceneIndex);
        break;
      case "stop_all":
        this.stopAll();
        break;
    }
  }

  private onSlot(track: number, scene: number): void {
    if (this.findSlot(track, scene)) {
      this.selectedSlot = { track_index: track, scene_index: scene };
      this.set({ selectedSlot: this.selectedSlot });
      this.queue(track, scene);
    } else {
      this.queue(track, STOP_QUEUED);
    }
  }

  render() {
    const engine = this.engine ?? this;
    const tracks = this.trackList();
    const selected =
      typeof this.selectedSlot?.track_index === "number" &&
      typeof this.selectedSlot?.scene_index === "number"
        ? {
            track: this.selectedSlot.track_index,
            scene: this.selectedSlot.scene_index,
          }
        : null;
    const stop = (e: Event) => e.stopPropagation();
    return html`<nbplay-header badge="launcher">
        <label class="nbplay-launcher-field" title="Launch quantization">
          <span>Quantize</span>
          <select
            class="nbplay-launcher-quantize"
            .value=${this.quantize}
            @input=${stop}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.quantize = (e.target as HTMLSelectElement)
                .value as typeof this.quantize;
              this.set({ quantize: this.quantize });
            }}
          >
            ${(["bar", "beat", "none"] as const).map(
              (q) =>
                html`<option
                  value=${q}
                  ?selected=${q === this.quantize}
                  .textContent=${q === "none" ? "None" : q[0].toUpperCase() + q.slice(1)}
                ></option>`,
            )}
          </select>
        </label>
      </nbplay-header>
      <nbplay-launcher-grid
        .tracks=${tracks.map((t) => ({
          name: t.name,
          detail:
            t.channel_index >= 0 ? `Ch ${t.channel_index + 1}` : "No channel",
        }))}
        .scenes=${this.sceneList()}
        .slots=${this.slotList().map((s) => ({
          track: s.track_index,
          scene: s.scene_index,
          name: s.name,
        }))}
        .active=${engine.states.map((s) => s.activeScene)}
        .queued=${engine.states.map((s) =>
          s.queued
            ? s.queued.scene >= 0
              ? s.queued.scene
              : GRID_STOP_QUEUED
            : -1,
        )}
        .progress=${engine.progress}
        .selected=${selected}
        .playing=${engine.isPlaying}
        @nbplay-launch=${(e: Event) => {
          e.stopPropagation();
          const { track, scene } = (e as CustomEvent).detail;
          this.onSlot(track, scene);
        }}
        @nbplay-launch-scene=${(e: Event) => {
          e.stopPropagation();
          this.launchScene((e as CustomEvent).detail.scene);
        }}
        @nbplay-stop-track=${(e: Event) => {
          e.stopPropagation();
          this.queue((e as CustomEvent).detail.track, STOP_QUEUED);
        }}
        @nbplay-stop-all=${(e: Event) => {
          e.stopPropagation();
          this.stopAll();
        }}
      ></nbplay-launcher-grid>`;
  }
}

define("nbplay-launcher", NbplayLauncher);
