import { html } from "lit";
import { type PropertyValues } from "lit";
import { bindShortcuts } from "../helpers.ts";
import { midiToHz, scheduleOscillator } from "../scheduler.ts";
import {
  bindElementClock,
  channelOwner,
  claimChannel,
  type ClockBinding,
  type ClockEvent,
  emitBusNote,
  getSessionBus,
  releaseChannel,
  type SessionClock,
} from "../session.ts";
import { NbplayElement, clamp, define } from "./base.ts";
import type { ClipSpec } from "./lane.ts";
import { beatLabel } from "./ruler.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./header.ts";
import "./lane.ts";
import "./ruler.ts";

const MAX_TIMELINE_BEATS = 4096;
const MIN_CLIP_BEATS = 0.25;
const MIDI_LOOKAHEAD_SECONDS = 0.1;
// How long after a note's duration its handle is kept so a stop can still
// silence a long release (the sampler allows releases up to five seconds).
const NOTE_TAIL_SECONDS = 6;
const MIDI_TICK_MS = 25;
const PLAYHEAD_TICK_MS = 50;

export interface TimelineTrack {
  name: string;
  channel_index: number;
  armed: boolean;
  muted: boolean;
  solo: boolean;
  input: string;
  monitor: boolean;
}

export interface MidiEvent {
  beat: number;
  duration: number;
  note: number;
  velocity: number;
}

export interface AudioClip {
  id: string;
  kind: "audio" | "midi";
  events?: MidiEvent[];
  /** Name of the session pattern this MIDI clip was generated from. */
  pattern?: string;
  name: string;
  track_index: number;
  start: number;
  duration: number;
  loop?: boolean;
  muted?: boolean;
  recorded?: boolean;
  offset?: number;
  audio_url?: string;
  blob_type?: string;
  blob_size?: number;
  source?: string;
  sample_rate?: number;
}

interface RecordingLane {
  trackIndex: number;
  kind: "audio" | "midi";
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
  recording: boolean;
  chunks: Blob[];
  events: MidiEvent[];
  openNotes: Map<number, { beat: number; velocity: number }>;
  tap: AudioNode | null;
  monitor: AudioNode | null;
  done: boolean;
}

function numberValue(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function uniqueClipId(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj?.randomUUID) return `clip-${cryptoObj.randomUUID()}`;
  return `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clipEnd(clip: AudioClip): number {
  return clip.start + Math.max(0.001, clip.duration);
}

function getMidiEvents(clip: Partial<AudioClip>): MidiEvent[] {
  return (clip.events || [])
    .map((event) => ({
      beat: Math.max(0, numberValue(event.beat, 0)),
      duration: Math.max(0.001, numberValue(event.duration, 0.25)),
      note: Math.max(0, Math.min(127, Math.round(numberValue(event.note, 60)))),
      velocity: Math.max(
        1,
        Math.min(127, Math.round(numberValue(event.velocity, 100))),
      ),
    }))
    .sort((a, b) => a.beat - b.beat || a.note - b.note);
}

function toUint8(data: unknown): Uint8Array | null {
  if (!data) return null;
  if (data instanceof DataView) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

function disconnectNode(node: AudioNode | null): void {
  if (!node) return;
  try {
    node.disconnect();
  } catch {
    // Ignore already-disconnected nodes.
  }
}

/**
 * `<nbplay-timeline>`: the tracking view. A header with the timeline
 * controls and a position readout, a scroll container with an
 * `nbplay-ruler` and one `nbplay-lane` per track, and a status line. It
 * follows the session clock for position and play state, plays audio clips
 * through the session mixer and MIDI clips through the lane's bus
 * instrument, and records every armed lane at once (microphone, a mixer
 * channel tap, or MIDI note capture). Track, clip and setting edits fire
 * `nbplay-set`; play, record and position state fire `nbplay-status`; an
 * `exportClipId` or `importClipRequest` write starts a clip transfer.
 */
export class NbplayTimeline extends NbplayElement {
  static properties = {
    tracks: { attribute: false },
    clips: { attribute: false },
    length: { type: Number },
    selectedClipId: { type: String, attribute: "selected-clip-id" },
    bpm: { type: Number },
    timeSignatureNum: { type: Number, attribute: "time-signature-num" },
    countInBars: { type: Number, attribute: "count-in-bars" },
    autoExtendRecording: { type: Boolean, attribute: "auto-extend-recording" },
    recordingExtendBars: { type: Number, attribute: "recording-extend-bars" },
    pixelsPerBeat: { type: Number, attribute: "pixels-per-beat" },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    currentBeat: { type: Number, attribute: false },
    exportClipId: { type: String, attribute: false },
    importClipRequest: { attribute: false },
    importClipData: { attribute: false },
    isPlaying: { type: Boolean, attribute: "is-playing", reflect: true },
    isRecording: { type: Boolean, attribute: "is-recording", reflect: true },
    recordingTrack: { type: Number, attribute: false },
    recordingTracks: { attribute: false },
    recordingCountdownBeats: { type: Number, attribute: false },
    recordingError: { type: String, attribute: false },
    recordedClip: { attribute: false },
    exportedClip: { attribute: false },
    exportedClipData: { attribute: false },
    displayBeat: { type: Number, attribute: false },
  };

  declare tracks: Partial<TimelineTrack>[];
  declare clips: Partial<AudioClip>[];
  declare length: number;
  declare selectedClipId: string;
  declare bpm: number;
  declare timeSignatureNum: number;
  declare countInBars: number;
  declare autoExtendRecording: boolean;
  declare recordingExtendBars: number;
  declare pixelsPerBeat: number;
  declare sessionId: string;
  declare currentBeat: number;
  declare exportClipId: string;
  declare importClipRequest: Partial<AudioClip> & {
    measure_duration?: boolean;
  };
  declare importClipData: unknown;
  declare isPlaying: boolean;
  declare isRecording: boolean;
  declare recordingTrack: number;
  declare recordingTracks: number[];
  declare recordingCountdownBeats: number;
  declare recordingError: string;
  declare recordedClip: Partial<AudioClip>;
  declare exportedClip: Partial<AudioClip>;
  declare exportedClipData: DataView | null;
  /** The playhead while playing (browser state, never written to the host). */
  declare displayBeat: number | null;

  private binding: (ClockBinding & { rebind(): void }) | null = null;
  private unbindShortcuts: (() => void) | null = null;
  private lanes: RecordingLane[] = [];
  private micStream: MediaStream | null = null;
  private pendingClips: AudioClip[] = [];
  private recordingStartMs = 0;
  private recordingStartBeat = 0;
  private recordingStopBeat: number | null = null;
  private countInTimer: ReturnType<typeof setTimeout> | null = null;
  private countInTick: ReturnType<typeof setInterval> | null = null;
  private recordingPending = false;
  private recordingGeneration = 0;
  private recordingStartedPlayback = false;
  private scheduledTimers: ReturnType<typeof setTimeout>[] = [];
  private scheduledNotes: { cancel: () => void; until: number }[] = [];
  private playheadTimer: ReturnType<typeof setInterval> | null = null;
  private midiTimer: ReturnType<typeof setInterval> | null = null;
  private midiCursorBeat = 0;
  private midiLastBeat = 0;
  private noteListenerActive = false;
  private suppressRestart = false;
  private disposed = false;
  private claims: { sessionId: string; channels: number[] } = {
    sessionId: "",
    channels: [],
  };
  private objectUrls = new Set<string>();
  private activeMedia: HTMLMediaElement[] = [];
  private activeSources: AudioNode[] = [];

  constructor() {
    super();
    this.tracks = [];
    this.clips = [];
    this.length = 16;
    this.selectedClipId = "";
    this.bpm = 120;
    this.timeSignatureNum = 4;
    this.countInBars = 0;
    this.autoExtendRecording = true;
    this.recordingExtendBars = 8;
    this.pixelsPerBeat = 0;
    this.sessionId = "";
    this.currentBeat = 0;
    this.exportClipId = "";
    this.importClipRequest = {};
    this.importClipData = null;
    this.isPlaying = false;
    this.isRecording = false;
    this.recordingTrack = -1;
    this.recordingTracks = [];
    this.recordingCountdownBeats = 0;
    this.recordingError = "";
    this.recordedClip = {};
    this.exportedClip = {};
    this.exportedClipData = null;
    this.displayBeat = null;
  }

  // Data views

  private trackList(): TimelineTrack[] {
    return (this.tracks || []).map((track, index) => ({
      name: String(track.name ?? `Track ${index + 1}`),
      channel_index: numberValue(track.channel_index, index),
      armed: Boolean(track.armed),
      muted: Boolean(track.muted),
      solo: Boolean(track.solo),
      input:
        track.input === "channel" || track.input === "midi"
          ? track.input
          : "microphone",
      monitor: Boolean(track.monitor),
    }));
  }

  private clipList(): AudioClip[] {
    return (this.clips || []).map((clip, index) => ({
      ...(clip as AudioClip),
      id: String(clip.id || `clip-${index}`),
      kind:
        clip.kind === "midi" || Array.isArray(clip.events) ? "midi" : "audio",
      events:
        clip.kind === "midi" || Array.isArray(clip.events)
          ? getMidiEvents(clip)
          : undefined,
      pattern: typeof clip.pattern === "string" ? clip.pattern : undefined,
      name: String(clip.name ?? `Clip ${index + 1}`),
      track_index: Math.max(0, numberValue(clip.track_index, 0)),
      start: Math.max(0, numberValue(clip.start, 0)),
      duration: Math.max(0.001, numberValue(clip.duration, 4)),
      offset: Math.max(0, numberValue(clip.offset, 0)),
      loop: Boolean(clip.loop),
      muted: Boolean(clip.muted),
    }));
  }

  private timelineLength(): number {
    return Math.max(
      1,
      Math.min(MAX_TIMELINE_BEATS, numberValue(this.length, 16)),
    );
  }

  private beatsPerBar(): number {
    return Math.max(1, numberValue(this.timeSignatureNum, 4));
  }

  private clampBeat(beat: number): number {
    return Math.max(0, Math.min(this.timelineLength(), beat));
  }

  private countInBeats(): number {
    return Math.max(0, numberValue(this.countInBars, 0)) * this.beatsPerBar();
  }

  private recordingExtendBeats(): number {
    return (
      Math.max(1, numberValue(this.recordingExtendBars, 8)) * this.beatsPerBar()
    );
  }

  // Lifecycle

  clock(): SessionClock {
    if (!this.binding) {
      this.binding = bindElementClock(this, this.onClockEvent, this.onRebind);
      const clk = this.binding.clock();
      clk.setTempo(numberValue(this.bpm, 120));
      // A standalone timeline restores its playhead from the host; a
      // session's position lives in the shared clock, never in saved status.
      if (!this.sessionId && !clk.playing) {
        const beat = this.clampBeat(numberValue(this.currentBeat, 0));
        if (Math.abs(beat - clk.beat()) > 1e-9) clk.seek(beat);
      }
      this.isPlaying = clk.playing;
      this.isRecording = false;
      this.recordingTrack = -1;
      this.recordingTracks = [];
    }
    return this.binding.clock();
  }

  private shared(): boolean {
    return Boolean(this.sessionId);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-timeline");
    this.disposed = false;
    this.clock();
    this.syncClaims();
    this.unbindShortcuts = bindShortcuts(this, {
      Space: () => this.togglePlay(),
      "Shift+Space": () => {
        this.clock().stop();
        this.seekToBeat(0);
      },
      r: () => this.toggleRecord(),
      l: () => this.toggleLoop(),
      d: () => this.duplicateSelectedClip(),
      Delete: () => this.removeSelectedClip(),
      Backspace: () => this.removeSelectedClip(),
    });
    if (this.clock().playing) this.startPlayback();
    this.handleExportRequest();
    this.handleImportRequest();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.disposed = true;
    this.clearCountIn();
    this.recordingGeneration += 1;
    this.recordingPending = false;
    this.lanes.forEach((lane) => {
      if (lane.recorder && lane.recorder.state !== "inactive")
        lane.recorder.stop();
    });
    this.releaseLanes();
    this.clearScheduledPlayback();
    this.syncClaims();
    this.setNoteListener(false);
    this.unbindShortcuts?.();
    this.unbindShortcuts = null;
    this.binding?.dispose();
    this.binding = null;
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }

  updated(changed: PropertyValues): void {
    if (!this.binding) return;
    const fresh = (key: string) =>
      changed.has(key) && changed.get(key) !== undefined;
    if (fresh("sessionId")) this.binding.rebind();
    if (fresh("bpm")) this.clock().setTempo(numberValue(this.bpm, 120));
    if (fresh("isPlaying")) this.onPlayStateWrite();
    if (fresh("isRecording")) this.onRecordStateWrite();
    if (fresh("currentBeat")) this.onPositionWrite();
    if (fresh("exportClipId")) this.handleExportRequest();
    if (fresh("importClipRequest") || fresh("importClipData"))
      this.handleImportRequest();
    if (
      changed.has("clips") ||
      changed.has("tracks") ||
      changed.has("length")
    ) {
      this.syncLoopRange();
    }
    if (
      changed.has("clips") ||
      changed.has("tracks") ||
      changed.has("sessionId")
    ) {
      this.syncClaims();
    }
  }

  /**
   * Claim the channel of every track that holds MIDI clips with notes: the
   * arrangement plays those tracks, so their looping sequencers stay silent.
   */
  private syncClaims(): void {
    this.claims.channels.forEach((channel) =>
      releaseChannel(this.claims.sessionId, channel, "timeline"),
    );
    const tracks = this.trackList();
    const channels = new Set<number>();
    if (this.isConnected && this.sessionId) {
      this.clipList().forEach((clip) => {
        const track = tracks[clip.track_index];
        if (
          clip.kind === "midi" &&
          track &&
          !clip.muted &&
          (clip.events || []).length > 0
        )
          channels.add(track.channel_index);
      });
    }
    channels.forEach((channel) =>
      claimChannel(this.sessionId, channel, "timeline"),
    );
    this.claims = { sessionId: this.sessionId, channels: [...channels] };
  }

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  private status(values: Record<string, unknown>, save: boolean): void {
    this.emitDetail("nbplay-status", { values, save });
  }

  // Clock

  private get context(): AudioContext | null {
    return this.clock().context();
  }

  private beatNow(): number {
    return this.clampBeat(this.clock().beat());
  }

  private recordersActive(): boolean {
    return this.lanes.some((lane) => lane.recording);
  }

  private recordingActive(): boolean {
    return (
      this.recordersActive() ||
      Boolean(this.countInTimer) ||
      this.recordingPending
    );
  }

  private setRecordingFlag(on: boolean): void {
    // Clock first: the status observer reconciles against it.
    this.clock().setRecording(on);
    this.isRecording = on;
    this.status({ isRecording: on }, false);
  }

  private onClockEvent = (event: ClockEvent): void => {
    const clk = this.clock();
    switch (event.type) {
      case "play":
        this.isPlaying = true;
        this.status({ isPlaying: true }, true);
        this.startPlayback();
        break;
      case "stop":
        this.clearScheduledPlayback();
        this.isPlaying = false;
        this.currentBeat = this.clampBeat(event.beat);
        this.status({ isPlaying: false, currentBeat: this.currentBeat }, true);
        if (this.recordingActive()) this.stopRecording();
        break;
      case "seek":
        this.displayBeat = null;
        this.currentBeat = this.clampBeat(event.beat);
        this.status({ currentBeat: this.currentBeat }, false);
        if (clk.playing && !this.suppressRestart) this.startPlayback();
        break;
      case "tempo":
        if (Number(this.bpm) !== clk.bpm) {
          this.bpm = clk.bpm;
          this.set({ bpm: clk.bpm });
        }
        if (clk.playing) this.startPlayback();
        break;
      case "record":
        if (clk.recording) {
          if (!this.recordingActive()) void this.startRecording();
        } else if (this.recordingActive()) {
          this.stopRecording();
        }
        break;
      case "loop":
        this.syncLoopRange();
        break;
      case "timesig":
        break;
    }
  };

  private onRebind = (clk: SessionClock): void => {
    this.clearScheduledPlayback();
    this.isPlaying = clk.playing;
    this.status({ isPlaying: clk.playing }, false);
    if (clk.playing) this.startPlayback();
  };

  /** `isPlaying` written by the host. */
  private onPlayStateWrite(): void {
    const clk = this.clock();
    // In a session `isPlaying` is status mirrored from the transport;
    // only a standalone timeline treats a host write as a command.
    if (!this.shared()) {
      if (this.isPlaying) {
        if (!clk.playing) clk.play();
      } else if (clk.playing) {
        clk.stop();
      }
    } else if (Boolean(this.isPlaying) !== clk.playing) {
      // A stale echo: the shared clock is authoritative, mirror it back.
      this.isPlaying = clk.playing;
      this.status({ isPlaying: clk.playing }, true);
    }
  }

  /** `isRecording` written by the host. */
  private onRecordStateWrite(): void {
    // In a session recording follows the clock's "record" event; the
    // trait is status. A standalone timeline takes the write as a command.
    if (!this.shared()) {
      if (this.isRecording) {
        if (!this.recordingActive()) void this.startRecording();
      } else if (this.recordingActive()) {
        this.stopRecording();
      }
    } else if (Boolean(this.isRecording) !== this.clock().recording) {
      this.isRecording = this.clock().recording;
      this.status({ isRecording: this.isRecording }, true);
    }
  }

  /** `currentBeat` written by the host. */
  private onPositionWrite(): void {
    const clk = this.clock();
    // In a session the position is status mirrored from the transport and
    // seeks arrive as transport commands; a standalone timeline moves its
    // own playhead from a host write while stopped.
    if (!this.shared() && !clk.playing) {
      const beat = this.clampBeat(numberValue(this.currentBeat, 0));
      if (Math.abs(beat - clk.beat()) > 1e-9) clk.seek(beat);
    }
  }

  togglePlay(): void {
    const clk = this.clock();
    if (clk.playing) clk.stop();
    else clk.play();
  }

  toggleRecord(): void {
    if (this.recordingActive() || Boolean(this.isRecording))
      this.stopRecording();
    else void this.startRecording();
  }

  // Recording

  private clearCountIn(): void {
    if (this.countInTimer) {
      clearTimeout(this.countInTimer);
      this.countInTimer = null;
    }
    if (this.countInTick) {
      clearInterval(this.countInTick);
      this.countInTick = null;
    }
    this.recordingCountdownBeats = 0;
    this.status({ recordingCountdownBeats: 0 }, false);
  }

  private stopMicStream(): void {
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
  }

  private releaseLanes(): void {
    this.lanes.forEach((lane) => {
      disconnectNode(lane.monitor);
      disconnectNode(lane.tap);
    });
    this.lanes = [];
    this.pendingClips = [];
    this.stopMicStream();
    this.setNoteListener(false);
  }

  // MIDI recording: note events broadcast on the document by the
  // keyboard, MIDI keyboard, and pad widgets, timed against the clock.
  private onDocumentNote = (event: Event): void => {
    const detail = (event as CustomEvent).detail as
      | { note?: number; velocity?: number; type?: string }
      | undefined;
    if (!detail) return;
    const note = Math.round(numberValue(detail.note, -1));
    if (note < 0 || note > 127) return;
    const beat = Math.max(0, this.clock().beat() - this.recordingStartBeat);
    this.lanes.forEach((lane) => {
      if (lane.kind !== "midi" || !lane.recording) return;
      if (detail.type === "on" && numberValue(detail.velocity, 0) > 0) {
        lane.openNotes.set(note, {
          beat,
          velocity: Math.max(
            1,
            Math.min(127, Math.round(numberValue(detail.velocity, 100))),
          ),
        });
      } else {
        this.closeLaneNote(lane, note, beat);
      }
    });
  };

  private closeLaneNote(lane: RecordingLane, note: number, beat: number): void {
    const open = lane.openNotes.get(note);
    if (!open) return;
    lane.openNotes.delete(note);
    lane.events.push({
      beat: open.beat,
      duration: Math.max(0.05, beat - open.beat),
      note,
      velocity: open.velocity,
    });
  }

  private setNoteListener(on: boolean): void {
    if (on === this.noteListenerActive) return;
    this.noteListenerActive = on;
    if (on) document.addEventListener("nbplay-note", this.onDocumentNote);
    else document.removeEventListener("nbplay-note", this.onDocumentNote);
  }

  private finalizeMidiLane(lane: RecordingLane, stopBeat: number): void {
    const relativeStop = Math.max(0, stopBeat - this.recordingStartBeat);
    [...lane.openNotes.keys()].forEach((note) =>
      this.closeLaneNote(lane, note, relativeStop),
    );
    lane.recording = false;
    lane.done = true;
    if (lane.events.length > 0) {
      const takeNumber = this.clipList().length + this.pendingClips.length + 1;
      this.pendingClips.push({
        id: uniqueClipId(),
        kind: "midi",
        name: `Take ${takeNumber}`,
        track_index: lane.trackIndex,
        start: this.recordingStartBeat,
        duration: this.recordingDurationBeats(),
        loop: false,
        muted: false,
        recorded: true,
        offset: 0,
        source: "recording",
        events: [...lane.events].sort(
          (a, b) => a.beat - b.beat || a.note - b.note,
        ),
      });
    }
    if (this.lanes.every((item) => item.done)) this.finishRecording();
  }

  private clearScheduledPlayback(): void {
    this.scheduledTimers.forEach((timer) => clearTimeout(timer));
    this.scheduledTimers = [];
    const now = this.clock().now();
    this.scheduledNotes.forEach((entry) => {
      if (entry.until > now) entry.cancel();
    });
    this.scheduledNotes = [];
    this.activeMedia.forEach((media) => {
      try {
        media.pause();
        media.currentTime = 0;
      } catch {
        // Media may be gone after notebook cell cleanup.
      }
    });
    this.activeMedia.length = 0;
    this.activeSources.forEach((source) => disconnectNode(source));
    this.activeSources.length = 0;
    if (this.playheadTimer) {
      clearInterval(this.playheadTimer);
      this.playheadTimer = null;
    }
    if (this.midiTimer) {
      clearInterval(this.midiTimer);
      this.midiTimer = null;
    }
    this.displayBeat = null;
  }

  private writeRecordingError(message: string): void {
    if (this.disposed) return;
    this.clearCountIn();
    this.releaseLanes();
    this.recordingPending = false;
    this.recordingGeneration += 1;
    this.recordingStartedPlayback = false;
    this.recordingStopBeat = null;
    this.recordingError = message;
    this.setRecordingFlag(false);
    this.recordingTrack = -1;
    this.recordingTracks = [];
    this.status(
      {
        recordingError: message,
        isRecording: false,
        recordingTrack: -1,
        recordingTracks: [],
      },
      true,
    );
  }

  /** Armed lanes, else the previously chosen lane, else the first lane. */
  private findRecordingTracks(): number[] {
    const tracks = this.trackList();
    const armed = tracks
      .map((track, index) => (track.armed ? index : -1))
      .filter((index) => index >= 0);
    if (armed.length > 0) return armed;
    const current = numberValue(this.recordingTrack, -1);
    if (current >= 0 && current < tracks.length) return [current];
    return tracks.length > 0 ? [0] : [];
  }

  private recordingDurationBeats(): number {
    if (
      this.recordingStopBeat !== null &&
      this.recordingStopBeat > this.recordingStartBeat
    ) {
      return Math.max(0.25, this.recordingStopBeat - this.recordingStartBeat);
    }
    const seconds = Math.max(
      0.25,
      (performance.now() - this.recordingStartMs) / 1000,
    );
    const bpm = Math.max(1, numberValue(this.bpm, 120));
    return Math.max(0.25, seconds * (bpm / 60));
  }

  private finalizeLane(lane: RecordingLane): void {
    const mimeType =
      lane.recorder?.mimeType || lane.chunks[0]?.type || "audio/webm";
    const blob = new Blob(lane.chunks, { type: mimeType });
    lane.chunks = [];
    lane.recorder = null;
    lane.recording = false;
    lane.done = true;
    if (blob.size && typeof URL !== "undefined" && URL.createObjectURL) {
      const url = URL.createObjectURL(blob);
      this.objectUrls.add(url);
      const takeNumber = this.clipList().length + this.pendingClips.length + 1;
      this.pendingClips.push({
        id: uniqueClipId(),
        kind: "audio",
        name: `Take ${takeNumber}`,
        track_index: lane.trackIndex,
        start: this.recordingStartBeat,
        duration: this.recordingDurationBeats(),
        loop: false,
        muted: false,
        recorded: true,
        offset: 0,
        audio_url: url,
        blob_type: blob.type,
        blob_size: blob.size,
        source: "recording",
        sample_rate: this.context?.sampleRate || 44100,
      });
    }
    if (this.lanes.every((item) => item.done)) this.finishRecording();
  }

  private finishRecording(): void {
    const newClips = this.pendingClips;
    this.pendingClips = [];
    this.releaseLanes();
    this.recordingStartedPlayback = false;
    this.recordingStopBeat = null;
    if (this.disposed) return;

    if (newClips.length === 0) {
      this.writeRecordingError("No audio was captured");
      return;
    }

    const clips = [...this.clipList(), ...newClips];
    const last = newClips[newClips.length - 1];
    this.clips = clips;
    this.recordedClip = last;
    this.selectedClipId = last.id;
    this.recordingError = "";
    this.setRecordingFlag(false);
    this.recordingTrack = -1;
    this.recordingTracks = [];
    this.recordingCountdownBeats = 0;
    this.length = Math.max(
      numberValue(this.length, 16),
      ...newClips.map((clip) => clipEnd(clip)),
    );
    this.status(
      {
        recordedClip: last,
        recordingError: "",
        isRecording: false,
        recordingTrack: -1,
        recordingTracks: [],
        recordingCountdownBeats: 0,
      },
      false,
    );
    this.set({ clips, selectedClipId: last.id, length: this.length });
  }

  private startInputMonitoring(
    track: TimelineTrack,
    stream: MediaStream,
  ): AudioNode | null {
    if (!track.monitor) return null;
    const bus = getSessionBus(this.sessionId);
    const ctx = bus?.audioCtx || this.context;
    if (!ctx?.createMediaStreamSource) return null;
    try {
      const source = ctx.createMediaStreamSource(stream);
      const target =
        bus?.channels?.[track.channel_index]?.gain ||
        bus?.masterGain ||
        ctx.destination;
      source.connect(target);
      void ctx.resume?.();
      return source;
    } catch {
      // Monitoring is best-effort; recording still works without routing.
      return null;
    }
  }

  /** Tap a mixer channel into a MediaStream for recording. */
  private channelTap(
    track: TimelineTrack,
  ): { stream: MediaStream; node: AudioNode } | null {
    const bus = getSessionBus(this.sessionId);
    const ctx = bus?.audioCtx;
    const gain = bus?.channels?.[track.channel_index]?.gain;
    if (!ctx?.createMediaStreamDestination || !gain) return null;
    try {
      const destination = ctx.createMediaStreamDestination();
      gain.connect(destination);
      return { stream: destination.stream, node: destination };
    } catch {
      return null;
    }
  }

  private ensurePlaybackStarted(): void {
    const clk = this.clock();
    if (clk.playing) return;
    this.recordingStartedPlayback = true;
    clk.play();
  }

  private beginRecording(
    Recorder: typeof MediaRecorder,
    startBeat: number,
    generation: number,
  ): void {
    if (
      generation !== this.recordingGeneration ||
      this.lanes.length === 0 ||
      this.recordersActive()
    )
      return;
    this.recordingPending = false;
    this.recordingStartMs = performance.now();
    this.recordingStartBeat = this.clampBeat(startBeat);
    this.recordingStopBeat = null;
    this.pendingClips = [];
    this.lanes.forEach((lane) => {
      lane.chunks = [];
      lane.events = [];
      lane.openNotes.clear();
      lane.done = false;
      lane.recording = true;
      if (lane.kind === "midi" || !lane.stream || !Recorder) return;
      const recorder = new Recorder(lane.stream);
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) lane.chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => this.finalizeLane(lane), {
        once: true,
      });
      lane.recorder = recorder;
    });
    this.lanes.forEach((lane) => lane.recorder?.start());
    if (this.lanes.some((lane) => lane.kind === "midi"))
      this.setNoteListener(true);
    this.recordingError = "";
    this.recordingTrack = this.lanes[0].trackIndex;
    this.recordingTracks = this.lanes.map((lane) => lane.trackIndex);
    this.recordingCountdownBeats = 0;
    this.setRecordingFlag(true);
    this.ensurePlaybackStarted();
    this.status(
      {
        recordingError: "",
        recordingTrack: this.recordingTrack,
        recordingTracks: this.recordingTracks,
        recordingCountdownBeats: 0,
        isRecording: true,
      },
      true,
    );
  }

  private scheduleCountIn(
    Recorder: typeof MediaRecorder,
    startBeat: number,
    durationBeats: number,
    generation: number,
  ): void {
    const bpm = Math.max(1, numberValue(this.bpm, 120));
    const bps = bpm / 60;
    const startMs = performance.now();
    const delayMs = Math.max(0, (durationBeats / bps) * 1000);

    this.recordingCountdownBeats = durationBeats;
    this.countInTick = setInterval(() => {
      const elapsedBeats = ((performance.now() - startMs) / 1000) * bps;
      const remaining = Math.max(0, durationBeats - elapsedBeats);
      this.recordingCountdownBeats = remaining;
      this.status({ recordingCountdownBeats: remaining }, false);
      if (remaining <= 0 && this.countInTick) {
        clearInterval(this.countInTick);
        this.countInTick = null;
      }
    }, 50);
    this.countInTimer = setTimeout(() => {
      this.countInTimer = null;
      if (this.countInTick) {
        clearInterval(this.countInTick);
        this.countInTick = null;
      }
      this.recordingCountdownBeats = 0;
      this.status({ recordingCountdownBeats: 0 }, false);
      if (this.disposed) {
        this.releaseLanes();
        return;
      }
      if (generation !== this.recordingGeneration) return;
      this.beginRecording(Recorder, startBeat, generation);
    }, delayMs);
  }

  async startRecording(): Promise<void> {
    if (this.recordingActive()) return;
    const targets = this.findRecordingTracks();
    if (targets.length === 0) {
      this.writeRecordingError("Add a track before recording");
      return;
    }
    const tracks = this.trackList();
    const needsMic = targets.some(
      (index) => tracks[index].input === "microphone",
    );
    const needsRecorder = targets.some(
      (index) => tracks[index].input !== "midi",
    );

    const nav = navigator as Navigator & {
      mediaDevices?: {
        getUserMedia?: (
          constraints: MediaStreamConstraints,
        ) => Promise<MediaStream>;
      };
    };
    const Recorder = (globalThis as { MediaRecorder?: typeof MediaRecorder })
      .MediaRecorder;
    if (
      (needsRecorder && !Recorder) ||
      (needsMic && !nav.mediaDevices?.getUserMedia)
    ) {
      this.writeRecordingError(
        needsMic
          ? "Microphone recording is unavailable in this browser"
          : "Recording is unavailable in this browser",
      );
      return;
    }

    const generation = ++this.recordingGeneration;
    this.recordingPending = true;
    this.recordingError = "";
    this.recordingTrack = targets[0];
    this.recordingTracks = targets;
    this.recordingCountdownBeats = 0;
    this.setRecordingFlag(true);
    this.status(
      {
        recordingError: "",
        recordingTrack: targets[0],
        recordingTracks: targets,
        recordingCountdownBeats: 0,
        isRecording: true,
      },
      true,
    );

    try {
      let stream: MediaStream | null = null;
      if (needsMic) {
        stream = await nav.mediaDevices!.getUserMedia!({ audio: true });
        if (
          this.disposed ||
          generation !== this.recordingGeneration ||
          !this.recordingPending ||
          !this.isRecording
        ) {
          stream.getTracks().forEach((track) => track.stop());
          if (generation === this.recordingGeneration)
            this.recordingPending = false;
          return;
        }
        this.micStream = stream;
      }

      const built: RecordingLane[] = [];
      const blankLane = (
        index: number,
        kind: "audio" | "midi",
      ): RecordingLane => ({
        trackIndex: index,
        kind,
        stream: null,
        recorder: null,
        recording: false,
        chunks: [],
        events: [],
        openNotes: new Map(),
        tap: null,
        monitor: null,
        done: false,
      });
      for (const index of targets) {
        const track = tracks[index];
        if (track.input === "midi") {
          built.push(blankLane(index, "midi"));
        } else if (track.input === "channel") {
          const tap = this.channelTap(track);
          if (!tap) {
            throw new Error(
              `Mixer channel ${track.channel_index + 1} is not available for recording`,
            );
          }
          built.push({
            ...blankLane(index, "audio"),
            stream: tap.stream,
            tap: tap.node,
          });
        } else {
          built.push({
            ...blankLane(index, "audio"),
            stream: stream!,
            monitor: this.startInputMonitoring(track, stream!),
          });
        }
      }
      this.lanes = built;

      const targetBeat = this.beatNow();
      const preRollBeats = this.countInBeats();
      const preRollStartBeat =
        preRollBeats > 0 ? Math.max(0, targetBeat - preRollBeats) : targetBeat;
      const delayBeats =
        preRollBeats > 0
          ? targetBeat > 0
            ? targetBeat - preRollStartBeat
            : preRollBeats
          : 0;

      this.recordingCountdownBeats = delayBeats;
      if (preRollBeats > 0 && targetBeat > 0) {
        this.clock().seek(preRollStartBeat);
        this.ensurePlaybackStarted();
      }
      this.status({ recordingCountdownBeats: delayBeats }, true);
      if (delayBeats > 0) {
        this.scheduleCountIn(Recorder!, targetBeat, delayBeats, generation);
      } else {
        this.beginRecording(Recorder!, targetBeat, generation);
      }
    } catch (err) {
      if (generation !== this.recordingGeneration) return;
      this.releaseLanes();
      this.recordingPending = false;
      this.recordingStartedPlayback = false;
      this.writeRecordingError(
        err instanceof Error ? err.message : "Could not start recording",
      );
    }
  }

  stopRecording(): void {
    this.clearCountIn();
    if (!this.recordersActive()) {
      this.recordingGeneration += 1;
      this.recordingPending = false;
      this.setRecordingFlag(false);
      this.recordingTrack = -1;
      this.recordingTracks = [];
      this.recordingCountdownBeats = 0;
      const stopPlayback = this.recordingStartedPlayback;
      this.recordingStartedPlayback = false;
      this.releaseLanes();
      this.status(
        {
          isRecording: false,
          recordingTrack: -1,
          recordingTracks: [],
          recordingCountdownBeats: 0,
        },
        true,
      );
      if (stopPlayback) this.clock().stop();
      return;
    }
    this.recordingStopBeat = Math.max(this.recordingStartBeat, this.beatNow());
    this.setNoteListener(false);
    const stopBeat = this.recordingStopBeat;
    this.lanes.forEach((lane) => {
      if (lane.kind === "midi") {
        if (lane.recording) this.finalizeMidiLane(lane, stopBeat);
        return;
      }
      const recorder = lane.recorder;
      if (!recorder) return;
      if (recorder.state !== "inactive") recorder.stop();
      else this.finalizeLane(lane);
    });
  }

  // MIDI playback: a lookahead scheduler over the clock feeds each MIDI
  // clip's notes to the lane's sampler on the session bus, or to a
  // built-in oscillator on the lane's mixer channel.

  private triggerMidiNote(
    track: TimelineTrack,
    event: MidiEvent,
    atTime: number,
    spb: number,
  ): void {
    // A launched slot on this track plays in place of its clips.
    if (channelOwner(this.sessionId, track.channel_index) === "launcher")
      return;
    const clk = this.clock();
    const bus = getSessionBus(this.sessionId);
    const sampler = bus?.samplers?.[track.channel_index];
    const instrument = bus?.instruments?.[track.channel_index];
    const durationSeconds = event.duration * spb;
    emitBusNote(this.sessionId, {
      note: event.note,
      velocity: event.velocity,
      type: "on",
      at: atTime,
      duration: durationSeconds,
    });
    if (instrument) {
      const cancel = instrument.scheduleNote(
        event.note,
        event.velocity,
        atTime,
        durationSeconds,
      );
      if (cancel) {
        this.scheduledNotes.push({
          cancel,
          until: atTime + durationSeconds + NOTE_TAIL_SECONDS,
        });
        const now = clk.now();
        this.scheduledNotes = this.scheduledNotes.filter(
          (entry) => entry.until > now,
        );
      }
      return;
    }
    if (sampler) {
      const delayMs = Math.max(0, (atTime - clk.now()) * 1000);
      this.scheduledTimers.push(
        setTimeout(
          () => sampler.triggerNote(event.note, event.velocity),
          delayMs,
        ),
      );
      this.scheduledTimers.push(
        setTimeout(
          () => sampler.releaseNote(event.note),
          delayMs + durationSeconds * 1000,
        ),
      );
      // Stopping mid-note releases it instead of leaving it hanging.
      this.scheduledNotes.push({
        cancel: () => sampler.releaseNote(event.note),
        until: atTime + durationSeconds + NOTE_TAIL_SECONDS,
      });
      return;
    }
    const ctx = clk.context();
    if (!ctx) return;
    const osc = scheduleOscillator(
      ctx,
      bus?.channels?.[track.channel_index]?.gain || bus?.masterGain || null,
      midiToHz(event.note),
      event.velocity / 127,
      atTime,
      durationSeconds,
    );
    if (osc)
      this.scheduledNotes.push({
        cancel: () => {
          try {
            osc.stop(0);
            osc.disconnect();
          } catch {
            /* already stopped */
          }
        },
        until: atTime + durationSeconds + NOTE_TAIL_SECONDS,
      });
  }

  private scheduleMidi(clips: AudioClip[], tracks: TimelineTrack[]): void {
    const clk = this.clock();
    const now = clk.beat();
    const loop = clk.loop;
    const looping = loop.enabled && loop.endBeat > loop.startBeat;
    // The clock only moves backwards on a loop wrap or a seek. After a
    // wrap, restart from the loop start so a note on the first beat is
    // not skipped by the tick that noticed the wrap; after a seek, from
    // the new position.
    if (now < this.midiLastBeat - 1e-6)
      this.midiCursorBeat =
        looping && now < loop.endBeat ? Math.min(now, loop.startBeat) : now;
    this.midiLastBeat = now;
    const spb = clk.secondsPerBeat();
    let horizon = now + MIDI_LOOKAHEAD_SECONDS / spb;
    // Never schedule past the loop end: those beats never arrive.
    if (looping && now < loop.endBeat)
      horizon = Math.min(horizon, loop.endBeat);
    if (horizon <= this.midiCursorBeat) return;
    clips.forEach((clip) => {
      const track = tracks[clip.track_index];
      if (!track) return;
      const offset = clip.offset || 0;
      (clip.events || []).forEach((event) => {
        const local = event.beat - offset;
        if (local < 0 || local >= clip.duration) return;
        const absolute = clip.start + local;
        if (absolute < this.midiCursorBeat || absolute >= horizon) return;
        // Measured from now: the clock's linear origin does not move on a
        // loop wrap, so an absolute mapping would point into the past.
        this.triggerMidiNote(
          track,
          event,
          clk.now() + (absolute - now) * spb,
          spb,
        );
      });
    });
    this.midiCursorBeat = horizon;
  }

  private startMidiPlayback(startBeat: number): void {
    const tracks = this.trackList();
    const hasSolo = tracks.some((track) => track.solo);
    const clips = this.clipList().filter((clip) => {
      const track = tracks[clip.track_index];
      return (
        clip.kind === "midi" &&
        track &&
        !track.muted &&
        !(hasSolo && !track.solo) &&
        !clip.muted &&
        (clip.events || []).length > 0
      );
    });
    if (clips.length === 0) return;
    // Start slightly behind the playhead so a note on the start beat
    // still sounds; past-due notes are triggered immediately.
    const grace = MIDI_LOOKAHEAD_SECONDS / this.clock().secondsPerBeat();
    this.midiCursorBeat = Math.max(0, startBeat - grace);
    this.midiLastBeat = startBeat;
    this.scheduleMidi(clips, tracks);
    this.midiTimer = setInterval(
      () => this.scheduleMidi(clips, tracks),
      MIDI_TICK_MS,
    );
  }

  // Playback

  private connectMediaElement(
    media: HTMLMediaElement,
    track: TimelineTrack,
  ): void {
    const bus = getSessionBus(this.sessionId);
    const ctx = bus?.audioCtx || this.context;
    if (!ctx || !ctx.createMediaElementSource) return;
    try {
      const source = ctx.createMediaElementSource(media);
      const target =
        bus?.channels?.[track.channel_index]?.gain ||
        bus?.masterGain ||
        ctx.destination;
      source.connect(target);
      this.activeSources.push(source);
    } catch {
      // Browsers throw if media elements cannot be connected; direct playback still works.
    }
  }

  private playClip(clip: AudioClip, offsetSeconds: number): void {
    if (clip.kind === "midi" || !clip.audio_url || clip.muted) return;
    const track = this.trackList()[clip.track_index];
    if (!track || track.muted) return;
    const media = new Audio(clip.audio_url);
    media.preload = "auto";
    media.loop = Boolean(clip.loop);
    media.currentTime = Math.max(0, offsetSeconds);
    this.connectMediaElement(media, track);
    this.activeMedia.push(media);
    void media.play().catch(() => {});
  }

  private maybeExtendTimelineForRecording(beat: number): boolean {
    if (!this.isRecording || !this.autoExtendRecording) return false;
    const bpb = this.beatsPerBar();
    const currentLength = this.timelineLength();
    if (currentLength >= MAX_TIMELINE_BEATS) return false;
    if (beat < currentLength - bpb) return false;
    const extendBy = Math.max(bpb, this.recordingExtendBeats());
    let nextLength = currentLength;
    while (beat >= nextLength - bpb && nextLength < MAX_TIMELINE_BEATS) {
      nextLength = Math.min(MAX_TIMELINE_BEATS, nextLength + extendBy);
    }
    if (nextLength <= currentLength) return false;
    this.length = nextLength;
    this.set({ length: nextLength });
    return true;
  }

  private keepPlayheadVisible(beat: number): void {
    const ppb = Math.max(0, numberValue(this.pixelsPerBeat, 0));
    if (ppb <= 0) return;
    const scroll = this.querySelector(
      ".nbplay-timeline-scroll",
    ) as HTMLElement | null;
    const spacer = this.querySelector(
      ".nbplay-timeline-ruler-spacer",
    ) as HTMLElement | null;
    if (!scroll) return;
    const controlsWidth = spacer?.offsetWidth || 0;
    const px = beat * ppb;
    const visible = scroll.clientWidth - controlsWidth;
    if (visible <= 0) return;
    if (px < scroll.scrollLeft || px > scroll.scrollLeft + visible) {
      scroll.scrollLeft = Math.max(0, px - visible * 0.2);
    }
  }

  private startPlayback(): void {
    this.clearScheduledPlayback();
    const clk = this.clock();
    void clk.context()?.resume?.();

    const length = this.timelineLength();
    if (clk.beat() >= length) {
      // Reached the end earlier: rewind. The seek event re-enters here.
      clk.seek(0);
      return;
    }
    const tracks = this.trackList();
    const hasSolo = tracks.some((track) => track.solo);
    const clips = this.clipList();
    const spb = clk.secondsPerBeat();
    const startBeat = clk.beat();
    this.displayBeat = startBeat;

    this.startMidiPlayback(startBeat);
    clips.forEach((clip) => {
      const track = tracks[clip.track_index];
      if (clip.kind === "midi") return;
      if (!track || track.muted || (hasSolo && !track.solo) || clip.muted)
        return;
      if (clipEnd(clip) <= startBeat && !clip.loop) return;
      const beatDelta = clip.start - startBeat;
      const delayMs = Math.max(0, beatDelta * spb * 1000);
      const offsetBeats =
        clip.loop && startBeat > clip.start
          ? (startBeat - clip.start) % Math.max(0.001, clip.duration)
          : Math.max(0, startBeat - clip.start);
      const offsetSeconds = (offsetBeats + (clip.offset || 0)) * spb;
      this.scheduledTimers.push(
        setTimeout(() => this.playClip(clip, offsetSeconds), delayMs),
      );
    });

    this.playheadTimer = setInterval(() => {
      const nextBeat = clk.beat();
      this.maybeExtendTimelineForRecording(nextBeat);
      const currentLength = this.timelineLength();
      if (nextBeat >= currentLength) {
        // End of the arrangement: stop the session and park the playhead.
        this.displayBeat = currentLength;
        this.clearScheduledPlayback();
        clk.stop();
        clk.seek(currentLength);
        return;
      }
      this.displayBeat = nextBeat;
      this.keepPlayheadVisible(nextBeat);
    }, PLAYHEAD_TICK_MS);
  }

  // Seeking and loop range

  seekToBeat(beat: number, save = true, restartPlayback = true): void {
    if (this.recordingActive()) return;
    const nextBeat = this.clampBeat(beat);
    const clk = this.clock();
    if (clk.playing && !restartPlayback) this.clearScheduledPlayback();
    this.suppressRestart = !restartPlayback;
    try {
      clk.seek(nextBeat);
    } finally {
      this.suppressRestart = false;
    }
    if (save) this.status({}, true);
  }

  toggleLoop(): void {
    const clk = this.clock();
    const loop = clk.loop;
    if (loop.enabled) {
      clk.setLoop(false, loop.startBeat, loop.endBeat);
      return;
    }
    const bpb = this.beatsPerBar();
    const length = this.timelineLength();
    const hasRange = loop.endBeat > loop.startBeat && loop.startBeat < length;
    const start = hasRange ? loop.startBeat : 0;
    const end = hasRange
      ? Math.min(length, loop.endBeat)
      : Math.min(length, 4 * bpb);
    clk.setLoop(true, start, Math.max(start + bpb, end));
  }

  /** Push the clock's loop range into the ruler. */
  private syncLoopRange(): void {
    this.requestUpdate();
  }

  // Track and clip editing

  private updateTrack(index: number, patch: Partial<TimelineTrack>): void {
    const tracks = this.trackList();
    if (index < 0 || index >= tracks.length) return;
    tracks[index] = { ...tracks[index], ...patch };
    this.tracks = tracks;
    this.set({ tracks });
  }

  private selectClip(clipId: string): void {
    this.selectedClipId = clipId;
    this.set({ selectedClipId: clipId });
  }

  private writeClips(clips: AudioClip[], selectedId?: string): void {
    const values: Record<string, unknown> = { clips };
    this.clips = clips;
    if (selectedId !== undefined) {
      this.selectedClipId = selectedId;
      values.selectedClipId = selectedId;
    }
    const end = clips.reduce((max, clip) => Math.max(max, clipEnd(clip)), 0);
    if (end > this.timelineLength()) {
      this.length = Math.min(MAX_TIMELINE_BEATS, end);
      values.length = this.length;
    }
    this.set(values);
  }

  removeSelectedClip(): void {
    const selected = String(this.selectedClipId || "");
    if (!selected) return;
    this.writeClips(
      this.clipList().filter((clip) => clip.id !== selected),
      "",
    );
  }

  duplicateSelectedClip(): void {
    const selected = String(this.selectedClipId || "");
    const clips = this.clipList();
    const source = clips.find((clip) => clip.id === selected);
    if (!source) return;
    const copy: AudioClip = {
      ...source,
      id: uniqueClipId(),
      start: clipEnd(source),
    };
    this.writeClips([...clips, copy], copy.id);
  }

  private laneIndexAt(clientY: number): number {
    const lanes = this.querySelectorAll("nbplay-lane");
    for (const lane of lanes) {
      const rect = lane.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return numberValue((lane as HTMLElement).dataset.track, -1);
      }
    }
    return -1;
  }

  private onClipEdit(e: Event): void {
    e.stopPropagation();
    const detail = (e as CustomEvent).detail as {
      field: string;
      id: string;
      start: number;
      duration: number;
      offset: number;
      clientY: number;
    };
    if (detail.field !== "clip") return;
    const row = this.laneIndexAt(detail.clientY);
    this.writeClips(
      this.clipList().map((clip) =>
        clip.id === detail.id
          ? {
              ...clip,
              start: detail.start,
              duration: detail.duration,
              offset: detail.offset,
              track_index: row >= 0 ? row : clip.track_index,
            }
          : clip,
      ),
      detail.id,
    );
  }

  // Clip audio transfer (host <-> browser)

  private handleExportRequest(): void {
    if (this.disposed) return;
    const clipId = String(this.exportClipId || "");
    if (!clipId) return;
    const clip = this.clipList().find((item) => item.id === clipId);
    const finish = (error: string) => {
      if (this.disposed) return;
      this.recordingError = error;
      this.exportClipId = "";
      this.status({ recordingError: error }, false);
      this.set({ exportClipId: "" });
    };
    if (!clip?.audio_url) {
      finish("Clip has no audio to export");
      return;
    }
    fetch(clip.audio_url)
      .then((response) => response.blob())
      .then(async (blob) => {
        const buffer = await blob.arrayBuffer();
        if (this.disposed) return;
        this.exportedClip = {
          ...clip,
          blob_type: blob.type || clip.blob_type || "",
          blob_size: blob.size,
        };
        this.exportedClipData = new DataView(buffer);
        this.status(
          {
            exportedClip: this.exportedClip,
            exportedClipData: this.exportedClipData,
          },
          false,
        );
        finish("");
      })
      .catch((err: unknown) => {
        finish(
          `Export failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  private handleImportRequest(): void {
    if (this.disposed) return;
    const request = this.importClipRequest || {};
    if (!request.id) return;
    const bytes = toUint8(this.importClipData);
    if (!bytes || bytes.length === 0) return;
    if (request.blob_size && bytes.length !== request.blob_size) return;
    const blob = new Blob([bytes.slice()], {
      type: request.blob_type || "audio/webm",
    });
    const url = URL.createObjectURL(blob);
    this.objectUrls.add(url);

    const apply = (durationBeats: number | null) => {
      if (this.disposed) return;
      const clips = this.clipList().map((clip) =>
        clip.id === request.id
          ? {
              ...clip,
              audio_url: url,
              blob_type: blob.type,
              blob_size: blob.size,
              duration: durationBeats ?? clip.duration,
            }
          : clip,
      );
      this.importClipRequest = {};
      this.set({ importClipRequest: {} });
      this.writeClips(clips);
    };

    const ctx = this.context;
    if (request.measure_duration && ctx?.decodeAudioData) {
      const copy = bytes.slice().buffer;
      Promise.resolve(ctx.decodeAudioData(copy))
        .then((decoded) => {
          const seconds =
            numberValue(
              (decoded as { duration?: number }).duration,
              decoded.length / Math.max(1, decoded.sampleRate),
            ) || 0;
          const bpm = Math.max(1, numberValue(this.bpm, 120));
          apply(
            seconds > 0 ? Math.max(MIN_CLIP_BEATS, seconds * (bpm / 60)) : null,
          );
        })
        .catch(() => apply(null));
      return;
    }
    apply(null);
  }

  // Render

  render() {
    const tracks = this.trackList();
    const clips = this.clipList();
    const length = this.timelineLength();
    const bpb = this.beatsPerBar();
    const bars = Math.max(1, Math.ceil(length / bpb));
    const ppb = Math.max(0, numberValue(this.pixelsPerBeat, 0));
    const width = ppb > 0 ? length * ppb : 0;
    const beat = this.clampBeat(
      this.displayBeat ?? numberValue(this.currentBeat, 0),
    );
    const playing = Boolean(this.isPlaying);
    const recording = Boolean(this.isRecording);
    const countdown = Math.max(0, numberValue(this.recordingCountdownBeats, 0));
    const loop = this.binding
      ? this.clock().loop
      : { enabled: false, startBeat: 0, endBeat: 0 };
    const selected = String(this.selectedClipId || "");
    const recordingTracks = (this.recordingTracks || []).map((v) =>
      numberValue(v, -1),
    );
    const stop = (e: Event) => e.stopPropagation();
    const number = (
      cls: string,
      label: string,
      title: string,
      value: number,
      min: number,
      max: number,
      step: number,
      apply: (value: number) => void,
    ) =>
      html`<label class="nbplay-timeline-field" title=${title}>
        <span>${label}</span>
        <input
          class=${cls}
          type="number"
          min=${min}
          max=${max}
          step=${step}
          .value=${String(value)}
          @input=${stop}
          @change=${(e: Event) => {
            e.stopPropagation();
            const raw = Number((e.target as HTMLInputElement).value);
            apply(clamp(Number.isFinite(raw) ? raw : value, min, max));
          }}
        />
      </label>`;
    return html`<nbplay-header badge="timeline">
        <div class="nbplay-timeline-actions">
          ${number(
            "nbplay-timeline-bars",
            "Bars",
            "Timeline length in bars",
            bars,
            1,
            256,
            1,
            (v) => {
              this.length = v * this.beatsPerBar();
              this.set({ length: this.length });
            },
          )}
          ${number(
            "nbplay-timeline-count-in",
            "Count",
            "Recording count-in in bars",
            Math.max(0, numberValue(this.countInBars, 0)),
            0,
            8,
            1,
            (v) => {
              this.countInBars = v;
              this.set({ countInBars: v });
            },
          )}
          <label
            class="nbplay-timeline-field"
            title="Extend timeline while recording"
          >
            <span>Auto</span>
            <input
              class="nbplay-timeline-auto-extend"
              type="checkbox"
              .checked=${Boolean(this.autoExtendRecording)}
              @input=${stop}
              @change=${(e: Event) => {
                e.stopPropagation();
                this.autoExtendRecording = (
                  e.target as HTMLInputElement
                ).checked;
                this.set({ autoExtendRecording: this.autoExtendRecording });
              }}
            />
          </label>
          ${number(
            "nbplay-timeline-extend-bars",
            "Ext",
            "Bars to add while recording",
            Math.max(1, numberValue(this.recordingExtendBars, 8)),
            1,
            256,
            1,
            (v) => {
              this.recordingExtendBars = v;
              this.set({ recordingExtendBars: v });
            },
          )}
          ${number(
            "nbplay-timeline-zoom",
            "Zoom",
            "Zoom in pixels per beat (0 fits the width)",
            ppb,
            0,
            400,
            4,
            (v) => {
              this.pixelsPerBeat = v;
              this.set({ pixelsPerBeat: v });
            },
          )}
          <button
            type="button"
            class="nbplay-timeline-loop-btn ${loop.enabled ? "active" : ""}"
            title="Toggle loop range"
            @click=${() => this.toggleLoop()}
          >
            ↻
          </button>
          <button
            type="button"
            class="nbplay-timeline-reset"
            title="Reset playhead"
            @click=${() => this.seekToBeat(0)}
          >
            ⏮
          </button>
          <button
            type="button"
            class="nbplay-timeline-play ${playing ? "active" : ""}"
            title=${playing ? "Stop timeline" : "Play timeline"}
            @click=${() => this.togglePlay()}
          >
            ${playing ? "■" : "▶"}
          </button>
          <button
            type="button"
            class="nbplay-timeline-record ${recording ? "active" : ""}"
            title=${recording ? "Stop recording" : "Record armed tracks"}
            @click=${() => this.toggleRecord()}
          >
            ${recording && countdown > 0 ? Math.ceil(countdown) : "●"}
          </button>
          <button
            type="button"
            class="nbplay-timeline-duplicate"
            title="Duplicate selected clip"
            @click=${() => this.duplicateSelectedClip()}
          >
            ⧉
          </button>
          <button
            type="button"
            class="nbplay-timeline-delete"
            title="Delete selected clip"
            @click=${() => this.removeSelectedClip()}
          >
            ✕
          </button>
        </div>
        <div class="nbplay-timeline-position">${beatLabel(beat, bpb)}</div>
      </nbplay-header>
      <div class="nbplay-timeline-scroll ${ppb > 0 ? "zoomed" : ""}">
        <div class="nbplay-timeline-ruler">
          <div class="nbplay-timeline-ruler-spacer"></div>
          <nbplay-ruler
            .length=${length}
            .beatsPerBar=${bpb}
            .beat=${beat}
            .loopStart=${loop.startBeat}
            .loopEnd=${loop.endBeat}
            .loopEnabled=${loop.enabled}
            .width=${width}
            .disabled=${this.recordingActive()}
            @nbplay-seek=${(e: Event) => {
              e.stopPropagation();
              const { beat, final } = (e as CustomEvent).detail;
              this.seekToBeat(beat, final, final);
            }}
            @input=${(e: Event) => this.onLoopEdit(e)}
            @change=${(e: Event) => this.onLoopEdit(e)}
          ></nbplay-ruler>
        </div>
        <div class="nbplay-timeline-body">
          ${
            tracks.length
              ? tracks.map((track, index) =>
                  this.renderLane(
                    track,
                    index,
                    clips,
                    length,
                    bpb,
                    beat,
                    width,
                    selected,
                    recordingTracks.includes(index),
                  ),
                )
              : html`<div class="nbplay-timeline-empty">No tracks</div>`
          }
        </div>
      </div>
      <div class="nbplay-timeline-status">
        ${String(this.recordingError || "")}
      </div>`;
  }

  private onLoopEdit(e: Event): void {
    e.stopPropagation();
    const { field, value } = (e as CustomEvent).detail as {
      field: string;
      value: number;
    };
    const clk = this.clock();
    const loop = clk.loop;
    if (field === "loopStart") clk.setLoop(true, value, loop.endBeat);
    else if (field === "loopEnd") clk.setLoop(true, loop.startBeat, value);
  }

  private renderLane(
    track: TimelineTrack,
    index: number,
    clips: AudioClip[],
    length: number,
    bpb: number,
    beat: number,
    width: number,
    selected: string,
    recording: boolean,
  ) {
    const channelLabel =
      track.channel_index >= 0 ? `Ch ${track.channel_index + 1}` : "No channel";
    const laneClips: ClipSpec[] = clips
      .filter((clip) => clip.track_index === index)
      .map((clip) => ({
        id: clip.id,
        name: clip.name,
        start: clip.start,
        duration: clip.duration,
        offset: clip.offset,
        kind: clip.kind,
        pattern: Boolean(clip.pattern),
        muted: clip.muted,
        detail: clip.pattern
          ? `${beatLabel(clip.start, bpb)} · pattern`
          : clip.kind === "midi"
            ? `${beatLabel(clip.start, bpb)} · ${(clip.events || []).length} notes`
            : beatLabel(clip.start, bpb),
      }));
    return html`<nbplay-lane
      data-track=${index}
      .name=${track.name}
      .armed=${track.armed}
      .monitor=${track.monitor}
      .muted=${track.muted}
      .solo=${track.solo}
      .input=${track.input}
      .inputs=${[
        { value: "microphone", label: "Mic" },
        {
          value: "channel",
          label: channelLabel,
          disabled: track.channel_index < 0,
        },
        { value: "midi", label: "MIDI" },
      ]}
      .clips=${laneClips}
      .length=${length}
      .beatsPerBar=${bpb}
      .beat=${beat}
      .selected=${selected}
      .recording=${recording}
      .width=${width}
      .disabled=${false}
      @nbplay-seek=${(e: Event) => {
        e.stopPropagation();
        const { beat, final } = (e as CustomEvent).detail;
        this.seekToBeat(beat, final, final);
      }}
      @nbplay-clip-select=${(e: Event) => {
        e.stopPropagation();
        this.selectClip((e as CustomEvent).detail.id);
      }}
      @input=${(e: Event) => e.stopPropagation()}
      @change=${(e: Event) => {
        const detail = (e as CustomEvent).detail as {
          field: string;
          value: unknown;
        };
        if (detail.field === "clip") {
          this.onClipEdit(e);
          return;
        }
        e.stopPropagation();
        this.updateTrack(index, { [detail.field]: detail.value });
      }}
    ></nbplay-lane>`;
  }
}

define("nbplay-timeline", NbplayTimeline);
