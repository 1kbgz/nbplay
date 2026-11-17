import { html } from "lit";
import { type PropertyValues } from "lit";
import { bindShortcuts, encodeWav } from "../helpers.ts";
import { createMetronome } from "../metronome.ts";
import {
  barBeats,
  bindElementClock,
  type ClockBinding,
  type ClockEvent,
  getSessionBus,
  type SessionClock,
} from "../session.ts";
import { NbplayElement, clamp, define } from "./base.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./param.ts";
import "./position.ts";
import "./toggle.ts";
import "./transport-buttons.ts";

export interface TransportCommand {
  action: "play" | "stop" | "seek" | "record" | "bounce";
  beat?: number;
  on?: boolean;
  /** A render's range in beats; the loop, or else the arrangement, when omitted. */
  start?: number;
  end?: number;
}

/** Seconds recorded after a render's end, for release tails and effects. */
const RENDER_TAIL = 0.6;

const MIN_BPM = 30;
const MAX_BPM = 300;
const TICK_MS = 50;
const COARSE_SYNC_MS = 250;

/**
 * `<nbplay-transport>`: the session transport. Owns the session clock named
 * by `session-id` (a private clock when empty): buttons and shortcuts drive
 * the clock, clock events update the element and are reported to the host.
 *
 * Configuration properties (`bpm`, `timeSignatureNum/Den`, `loopEnabled`,
 * `loopStartBar`, `loopEndBar`) are pushed to the clock when set; user edits
 * of them fire `nbplay-set` `{values}`. Status properties (`isPlaying`,
 * `isRecording`, `currentBeat`, `barNumber`, `beatInBar`) come from the
 * clock and fire `nbplay-status` `{values, save}`; `save` marks the edges
 * (play, stop, seek, record) and a throttled position while playing. A
 * status write that disagrees with the clock is corrected and re-reported.
 * `command()` moves the clock on behalf of the kernel. Ctrl/Cmd+Z and
 * Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y bump `undoRequest` / `redoRequest` and fire
 * `nbplay-request` `{name: "undo" | "redo"}`.
 */
export class NbplayTransport extends NbplayElement {
  static properties = {
    sessionId: { type: String, attribute: "session-id", reflect: true },
    bpm: { type: Number },
    timeSignatureNum: { type: Number, attribute: "time-signature-num" },
    timeSignatureDen: { type: Number, attribute: "time-signature-den" },
    loopEnabled: { type: Boolean, attribute: "loop-enabled" },
    metronome: { type: Boolean },
    loopStartBar: { type: Number, attribute: "loop-start-bar" },
    loopEndBar: { type: Number, attribute: "loop-end-bar" },
    isPlaying: { type: Boolean, attribute: "is-playing", reflect: true },
    isRecording: { type: Boolean, attribute: "is-recording", reflect: true },
    currentBeat: { attribute: false },
    barNumber: { attribute: false },
    beatInBar: { attribute: false },
    undoRequest: { attribute: false },
    redoRequest: { attribute: false },
    bounceState: { attribute: false },
    bounceData: { attribute: false },
  };

  declare sessionId: string;
  declare bpm: number;
  declare timeSignatureNum: number;
  declare timeSignatureDen: number;
  declare loopEnabled: boolean;
  /** Click on every beat while the clock plays. */
  declare metronome: boolean;
  declare loopStartBar: number;
  declare loopEndBar: number;
  declare isPlaying: boolean;
  declare isRecording: boolean;
  declare currentBeat: number;
  declare barNumber: number;
  declare beatInBar: number;
  declare undoRequest: number;
  /** A render's progress: "", "rendering", "done", or "error: …". */
  declare bounceState: string;
  /** The last render, as WAV bytes. */
  declare bounceData: DataView | null;
  declare redoRequest: number;

  private binding: (ClockBinding & { rebind(): void }) | null = null;
  private unbindShortcuts: (() => void) | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lastSyncedBeat = 0;
  private lastSyncMs = 0;

  constructor() {
    super();
    this.sessionId = "";
    this.bpm = 120;
    this.timeSignatureNum = 4;
    this.timeSignatureDen = 4;
    this.loopEnabled = false;
    this.metronome = false;
    this.bounceState = "";
    this.bounceData = null;
    this.loopStartBar = 0;
    this.loopEndBar = 4;
    this.isPlaying = false;
    this.isRecording = false;
    this.currentBeat = 0;
    this.barNumber = 0;
    this.beatInBar = 0;
  }

  // Clock binding

  /** The clock this element follows; bound on first use. */
  clock(): SessionClock {
    if (!this.binding) {
      this.binding = bindElementClock(this, this.onClockEvent, this.onRebind);
      const clk = this.binding.clock();
      this.joinTempo(clk);
      this.pushLoop(clk);
      this.pullState(clk);
      if (clk.playing) this.startTicking(clk.beat());
    }
    return this.binding.clock();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-transport");
    this.clock();
    this.unbindShortcuts = bindShortcuts(this, {
      Space: () => this.togglePlay(),
      "Shift+Space": () => this.stopAndRewind(),
      r: () => this.toggleRecord(),
      l: () => this.toggleLoop(),
      ArrowUp: () => this.nudgeTempo(1),
      ArrowDown: () => this.nudgeTempo(-1),
      "Shift+ArrowUp": () => this.nudgeTempo(10),
      "Shift+ArrowDown": () => this.nudgeTempo(-10),
    });
    this.addEventListener("keydown", this.onUndoKey);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTicking();
    this.unbindShortcuts?.();
    this.unbindShortcuts = null;
    this.removeEventListener("keydown", this.onUndoKey);
    this.clicks.stop();
    this.binding?.dispose();
    this.binding = null;
  }

  private beatsPerBar(): number {
    return barBeats(this.timeSignatureNum, this.timeSignatureDen);
  }

  private pushTempo(clk: SessionClock): void {
    clk.setTempo(Number(this.bpm));
  }

  /** Join `clk`: set its tempo if no element has yet, otherwise take it. */
  private joinTempo(clk: SessionClock): void {
    const bpm = clk.adoptTempo(Number(this.bpm));
    if (bpm !== Number(this.bpm)) {
      this.bpm = bpm;
      this.set({ bpm });
    }
  }

  private pushLoop(clk: SessionClock): void {
    const bpb = this.beatsPerBar();
    clk.setBeatsPerBar(bpb);
    clk.setLoop(
      Boolean(this.loopEnabled),
      (Number(this.loopStartBar) || 0) * bpb,
      (Number(this.loopEndBar) || 0) * bpb,
    );
  }

  private writePosition(beat: number): void {
    const bpb = this.beatsPerBar();
    const bounded = Number.isFinite(beat) ? Math.max(0, beat) : 0;
    this.currentBeat = bounded;
    this.barNumber = Math.floor(bounded / bpb);
    this.beatInBar = Math.floor(bounded % bpb);
  }

  private pullState(clk: SessionClock): void {
    this.isPlaying = clk.playing;
    this.isRecording = clk.recording;
    this.writePosition(clk.beat());
  }

  private status(save: boolean): void {
    this.emitDetail("nbplay-status", {
      values: {
        isPlaying: this.isPlaying,
        isRecording: this.isRecording,
        currentBeat: this.currentBeat,
        barNumber: this.barNumber,
        beatInBar: this.beatInBar,
      },
      save,
    });
  }

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  // Position ticker

  private tick = (): void => {
    const beat = this.clock().beat();
    this.writePosition(beat);
    const now = performance.now();
    let save = false;
    if (
      Math.floor(beat) !== Math.floor(this.lastSyncedBeat) &&
      now - this.lastSyncMs >= COARSE_SYNC_MS
    ) {
      this.lastSyncedBeat = beat;
      this.lastSyncMs = now;
      save = true;
    }
    this.status(save);
  };

  private startTicking(beat: number): void {
    this.stopTicking();
    this.lastSyncedBeat = beat;
    this.lastSyncMs = performance.now();
    this.tickTimer = setInterval(this.tick, TICK_MS);
  }

  private stopTicking(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  // Clock → element

  private clicks = createMetronome(
    () => this.clock(),
    () => {
      const ctx = this.clock().context();
      return (
        getSessionBus(this.sessionId)?.masterGain ?? ctx?.destination ?? null
      );
    },
    () => ({
      num: Number(this.timeSignatureNum) || 4,
      den: Number(this.timeSignatureDen) || 4,
    }),
  );

  /** Run the metronome while it is on and the clock plays. */
  private syncClick(): void {
    if (this.metronome && this.clock().playing) this.clicks.start();
    else this.clicks.stop();
  }

  private onClockEvent = (event: ClockEvent): void => {
    const clk = this.clock();
    if (event.type === "play" || event.type === "stop")
      queueMicrotask(() => this.syncClick());
    else if (["seek", "tempo", "loop", "timesig"].includes(event.type))
      this.clicks.realign();
    switch (event.type) {
      case "play":
        this.isPlaying = true;
        this.writePosition(event.beat);
        this.status(true);
        this.startTicking(event.beat);
        break;
      case "stop":
        this.stopTicking();
        this.isPlaying = false;
        this.writePosition(event.beat);
        this.status(true);
        break;
      case "seek":
        this.lastSyncedBeat = event.beat;
        this.writePosition(event.beat);
        this.status(true);
        break;
      case "tempo":
        if (Number(this.bpm) !== clk.bpm) {
          this.bpm = clk.bpm;
          this.set({ bpm: clk.bpm });
        }
        break;
      case "record":
        if (Boolean(this.isRecording) !== clk.recording) {
          this.isRecording = clk.recording;
          this.status(true);
        }
        break;
      case "loop": {
        const bpb = this.beatsPerBar();
        const loop = clk.loop;
        const startBar = Math.round(loop.startBeat / bpb);
        const endBar = Math.round(loop.endBeat / bpb);
        if (
          Boolean(this.loopEnabled) !== loop.enabled ||
          Number(this.loopStartBar) !== startBar ||
          Number(this.loopEndBar) !== endBar
        ) {
          this.loopEnabled = loop.enabled;
          this.loopStartBar = startBar;
          this.loopEndBar = endBar;
          this.set({
            loopEnabled: loop.enabled,
            loopStartBar: startBar,
            loopEndBar: endBar,
          });
        }
        break;
      }
      case "timesig":
        break;
    }
  };

  private onRebind = (clk: SessionClock): void => {
    this.stopTicking();
    this.joinTempo(clk);
    this.pushLoop(clk);
    this.pullState(clk);
    this.status(true);
    if (clk.playing) this.startTicking(clk.beat());
  };

  // Element → clock. Values are compared with the clock, so a write that
  // merely echoes clock state is a no-op and never loops back out.

  updated(changed: PropertyValues): void {
    if (changed.has("metronome")) this.syncClick();
    if (!this.binding) return;
    if (changed.has("sessionId") && changed.get("sessionId") !== undefined) {
      this.binding.rebind();
      return;
    }
    const clk = this.clock();
    if (changed.has("bpm") && Number(this.bpm) !== clk.bpm) this.pushTempo(clk);
    if (
      changed.has("timeSignatureNum") ||
      changed.has("timeSignatureDen") ||
      changed.has("loopEnabled") ||
      changed.has("loopStartBar") ||
      changed.has("loopEndBar")
    ) {
      this.pushLoop(clk);
    }
    if (
      (changed.has("isPlaying") || changed.has("isRecording")) &&
      (Boolean(this.isPlaying) !== clk.playing ||
        Boolean(this.isRecording) !== clk.recording)
    ) {
      // Stale status from the host: the clock is authoritative.
      this.isPlaying = clk.playing;
      this.isRecording = clk.recording;
      this.status(true);
    }
  }

  /** Kernel commands. The host checks nonces; the element only acts. */
  command(cmd: TransportCommand): void {
    const clk = this.clock();
    switch (cmd.action) {
      case "play":
        if (!clk.playing) clk.play();
        break;
      case "stop":
        if (clk.playing) clk.stop();
        break;
      case "seek": {
        const beat = Number(cmd.beat);
        if (Number.isFinite(beat)) clk.seek(Math.max(0, beat));
        break;
      }
      case "record": {
        const on = Boolean(cmd.on);
        clk.setRecording(on);
        if (on && !clk.playing) clk.play();
        break;
      }
      case "bounce":
        void this.bounce({ start: cmd.start, end: cmd.end });
        return;
    }
    // Even a no-op command re-publishes the clock's real status.
    this.pullState(clk);
    this.status(true);
  }

  // Actions

  togglePlay(): void {
    const clk = this.clock();
    if (clk.playing) clk.stop();
    else clk.play();
  }

  toggleRecord(): void {
    const clk = this.clock();
    const next = !clk.recording;
    clk.setRecording(next);
    if (next) clk.play();
  }

  stopAndRewind(): void {
    const clk = this.clock();
    clk.stop();
    clk.setRecording(false);
    clk.seek(0);
  }

  toggleLoop(): void {
    this.loopEnabled = !this.loopEnabled;
    this.set({ loopEnabled: this.loopEnabled });
    this.pushLoop(this.clock());
  }

  private nudgeTempo(delta: number): void {
    const next = clamp(Math.round(this.clock().bpm) + delta, MIN_BPM, MAX_BPM);
    this.clock().setTempo(next);
  }

  private onUndoKey = (e: KeyboardEvent): void => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.isContentEditable
    )
      return;
    const key = e.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    e.preventDefault();
    e.stopPropagation();
    this.request(key === "y" || e.shiftKey ? "redo" : "undo");
  };

  private rendering = false;

  private reportBounce(state: string, data: DataView | null = null): void {
    this.bounceState = state;
    const values: Record<string, unknown> = { bounceState: state };
    if (data) {
      this.bounceData = data;
      values.bounceData = data;
    }
    this.emitDetail("nbplay-status", { values, save: true });
  }

  /**
   * Render the song to WAV: play it from the start in real time and record
   * the master bus. The range is the loop when it is on, else the
   * arrangement (the timeline's length); `start` and `end` (beats) override
   * it. The WAV lands in `bounceData` (and the kernel); with `download` the
   * browser also saves it.
   */
  async bounce(
    options: { start?: number; end?: number; download?: boolean } = {},
  ): Promise<void> {
    if (this.rendering) return;
    const clk = this.clock();
    const ctx = clk.context();
    const bus = getSessionBus(this.sessionId);
    const tap = bus?.masterAnalyser ?? bus?.masterGain;
    const Recorder = (globalThis as { MediaRecorder?: typeof MediaRecorder })
      .MediaRecorder;
    if (!ctx?.createMediaStreamDestination || !tap || !Recorder) {
      this.reportBounce("error: no master bus to record");
      return;
    }
    const loop = clk.loop;
    const start = Number(options.start ?? (loop.enabled ? loop.startBeat : 0));
    const end = Number(
      options.end ??
        (loop.enabled ? loop.endBeat : (bus?.songBeats?.() ?? start + 16)),
    );
    if (!(end > start)) {
      this.reportBounce("error: nothing to render");
      return;
    }
    this.rendering = true;
    this.reportBounce("rendering");
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const destination = ctx.createMediaStreamDestination();
    tap.connect(destination);
    const chunks: Blob[] = [];
    const recorder = new Recorder(destination.stream);
    recorder.ondataavailable = (e) => {
      if (e.data?.size) chunks.push(e.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    try {
      clk.stop();
      clk.seek(start);
      recorder.start();
      clk.play();
      // Stop just before the end, so a loop never wraps into the render.
      while (clk.playing && clk.beat() < end - 0.01) await wait(5);
      clk.stop();
      await wait(RENDER_TAIL * 1000);
      recorder.stop();
      await stopped;
      const blob = new Blob(chunks, {
        type: recorder.mimeType || "audio/webm",
      });
      const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
      const wav = encodeWav(audio);
      this.reportBounce("done", new DataView(wav));
      if (options.download) {
        const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "nbplay-mixdown.wav";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      this.reportBounce(`error: ${String(error)}`);
    } finally {
      try {
        tap.disconnect(destination);
      } catch {
        /* already disconnected */
      }
      this.rendering = false;
    }
  }

  /** Ask the session to undo or redo, as Ctrl/Cmd+Z and the buttons do. */
  request(name: "undo" | "redo"): void {
    if (name === "redo") this.redoRequest = (this.redoRequest || 0) + 1;
    else this.undoRequest = (this.undoRequest || 0) + 1;
    this.emitDetail("nbplay-request", { name });
    // Bindings run during dispatch; flush only after they have queued this request.
    this.emitDetail("nbplay-flush", {});
  }

  render() {
    const bpb = this.beatsPerBar();
    const stop = (e: Event) => e.stopPropagation();
    const onTempo = (e: Event) => {
      e.stopPropagation();
      this.clock().setTempo((e as CustomEvent).detail.value as number);
    };
    return html`<nbplay-transport-buttons
        class="nbplay-transport-controls"
        .playing=${this.isPlaying}
        .recording=${this.isRecording}
        @nbplay-play=${(e: Event) => {
          e.stopPropagation();
          this.togglePlay();
        }}
        @nbplay-stop=${(e: Event) => {
          e.stopPropagation();
          this.stopAndRewind();
        }}
        @nbplay-record=${(e: Event) => {
          e.stopPropagation();
          this.toggleRecord();
        }}
      ></nbplay-transport-buttons>
      <nbplay-param
        class="nbplay-transport-tempo"
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
      <div class="nbplay-transport-timesig">
        <span class="nbplay-transport-timesig-val"
          >${this.timeSignatureNum}/${this.timeSignatureDen}</span
        >
      </div>
      <nbplay-position
        class="nbplay-transport-position"
        .beat=${this.barNumber * bpb + this.beatInBar}
        .beatsPerBar=${bpb}
      ></nbplay-position>
      <div class="nbplay-transport-loop">
        <nbplay-toggle
          class="nbplay-transport-loop-btn"
          variant="loop"
          label="↻"
          title="Toggle loop"
          .active=${this.loopEnabled}
          @input=${stop}
          @change=${(e: Event) => {
            e.stopPropagation();
            this.toggleLoop();
          }}
        ></nbplay-toggle>
        <span class="nbplay-transport-loop-range"
          >${this.loopStartBar + 1} – ${this.loopEndBar}</span
        >
      </div>
      <nbplay-toggle
        class="nbplay-transport-metronome"
        label="Click"
        title="Metronome: click on every beat while playing"
        .active=${this.metronome}
        @input=${stop}
        @change=${(e: Event) => {
          e.stopPropagation();
          this.metronome = Boolean((e as CustomEvent).detail.value);
          this.set({ metronome: this.metronome });
        }}
      ></nbplay-toggle>
      <button
        type="button"
        class="nbplay-transport-render ${this.bounceState === "rendering" ? "active" : ""}"
        title="Render the loop (or the arrangement) to a WAV file"
        ?disabled=${this.bounceState === "rendering"}
        @click=${() => void this.bounce({ download: true })}
      >
        ${this.bounceState === "rendering" ? "Rendering…" : "Render"}
      </button>
      <div class="nbplay-transport-history">
        <button
          type="button"
          class="nbplay-transport-undo"
          title="Undo (Ctrl/Cmd+Z)"
          aria-label="Undo"
          @click=${() => this.request("undo")}
        >
          ↶
        </button>
        <button
          type="button"
          class="nbplay-transport-redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          aria-label="Redo"
          @click=${() => this.request("redo")}
        >
          ↷
        </button>
      </div>`;
  }
}

define("nbplay-transport", NbplayTransport);
