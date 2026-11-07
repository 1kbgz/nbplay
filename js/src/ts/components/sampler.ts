import { html } from "lit";
import { type PropertyValues } from "lit";
import { toFloat32 } from "../helpers.ts";
import {
  clampVelocity,
  normalizePadActions,
  noteName,
  padActionLabel,
  resizePadNotes,
  resizePadVelocities,
  type PadAction,
} from "../pads.ts";
import {
  clampNote,
  createSamplerEngine,
  decimateSamples,
  decodeToMono,
  type Envelope,
  float32ToDataView,
  type SampleSlice,
  type Zone,
} from "../sampler_engine.ts";
import {
  getSessionBus,
  type InstrumentBus,
  type SamplerBus,
  type SessionBus,
} from "../session.ts";
import { NbplayElement, clamp, define } from "./base.ts";
import type { PadSpec } from "./pad-grid.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./envelope.ts";
import "./header.ts";
import "./pad-grid.ts";
import "./param.ts";
import "./waveform.ts";
import "./zone-list.ts";
import "./zone-map.ts";

const VOICE_COUNTER_MS = 50;

export interface CaptureRequest {
  url?: string;
  name?: string;
  note_low?: number;
  note_high?: number;
  root_note?: number;
  offset?: number;
  duration?: number;
  nonce?: number;
}

function fmtLen(sampleCount: number, rate: number): string {
  if (sampleCount === 0) return "—";
  const sec = sampleCount / rate;
  if (sec < 1) return (sec * 1000).toFixed(0) + " ms";
  return sec.toFixed(2) + " s";
}

/**
 * `<nbplay-sampler>`: the sampler instrument. A header with a file input
 * and the sample name, an `nbplay-waveform` drop target, an info line, the
 * ADSR (`nbplay-envelope` and four `nbplay-param`s), max voices, trigger
 * pads (`nbplay-pad-grid` in hold mode), and multi-sample zones
 * (`nbplay-zone-map`, `nbplay-zone-list`, file and microphone capture).
 * Playback runs on the sampler engine; with `sessionId` and
 * `channelIndex` it plays through the mixer channel and registers
 * `bus.samplers[channelIndex]` (keyboards) and `bus.instruments[channelIndex]`
 * (scheduled notes). Edits fire `nbplay-set`; pad activity fires
 * `nbplay-status`; `command()` takes a kernel capture request.
 */
export class NbplaySampler extends NbplayElement {
  static properties = {
    sampleName: { type: String, attribute: "sample-name" },
    sampleRate: { type: Number, attribute: "sample-rate" },
    sampleLength: { type: Number, attribute: "sample-length" },
    rootNote: { type: Number, attribute: "root-note" },
    waveform: { attribute: false },
    sampleData: { attribute: false },
    attack: { type: Number },
    decay: { type: Number },
    sustain: { type: Number },
    release: { type: Number },
    maxVoices: { type: Number, attribute: "max-voices" },
    padCount: { type: Number, attribute: "pad-count" },
    padNotes: { attribute: false },
    padVelocities: { attribute: false },
    padActions: { attribute: false },
    sampleSlices: { attribute: false },
    velocity: { type: Number },
    velocitySensitive: { type: Boolean, attribute: "velocity-sensitive" },
    zones: { attribute: false },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    channelIndex: { type: Number, attribute: "channel-index" },
    activePads: { attribute: false },
    lastNoteEvent: { attribute: false },
    lastPadEvent: { attribute: false },
    activeVoices: { type: Number, attribute: false },
    zoneStatus: { type: String, attribute: false },
    recording: { type: Boolean, attribute: false },
  };

  declare sampleName: string;
  declare sampleRate: number;
  declare sampleLength: number;
  declare rootNote: number;
  declare waveform: unknown;
  declare sampleData: unknown;
  declare attack: number;
  declare decay: number;
  declare sustain: number;
  declare release: number;
  declare maxVoices: number;
  declare padCount: number;
  declare padNotes: number[];
  declare padVelocities: number[];
  declare padActions: unknown[];
  declare sampleSlices: Record<string, unknown>[];
  declare velocity: number;
  declare velocitySensitive: boolean;
  declare zones: Record<string, unknown>[];
  declare sessionId: string;
  declare channelIndex: number;
  declare activePads: number[];
  declare lastNoteEvent: Record<string, unknown>;
  declare lastPadEvent: Record<string, unknown>;
  /** Voices held right now (browser state). */
  declare activeVoices: number;
  /** Zone capture status line (browser state). */
  declare zoneStatus: string;
  /** Microphone capture in progress (browser state). */
  declare recording: boolean;

  private engine = createSamplerEngine();
  private held = new Set<number>();
  private heldNotes = new Map<number, number>();
  private voiceTimer: ReturnType<typeof setInterval> | null = null;
  private registration: {
    bus: SessionBus;
    idx: number;
    sampler: SamplerBus;
    instrument: InstrumentBus;
  } | null = null;
  private recorder: MediaRecorder | null = null;
  private recorderStream: MediaStream | null = null;
  private recorderChunks: Blob[] = [];
  private capturePad = -1;

  constructor() {
    super();
    this.sampleName = "";
    this.sampleRate = 44100;
    this.sampleLength = 0;
    this.rootNote = 60;
    this.waveform = null;
    this.sampleData = null;
    this.attack = 0.01;
    this.decay = 0.1;
    this.sustain = 0.7;
    this.release = 0.3;
    this.maxVoices = 8;
    this.padCount = 8;
    this.padNotes = [];
    this.padVelocities = [];
    this.padActions = [];
    this.sampleSlices = [];
    this.velocity = 100;
    this.velocitySensitive = true;
    this.zones = [];
    this.sessionId = "";
    this.channelIndex = -1;
    this.activePads = [];
    this.lastNoteEvent = {};
    this.lastPadEvent = {};
    this.activeVoices = 0;
    this.zoneStatus = "";
    this.recording = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-sampler");
    this.engine.setMaxVoices(this.maxVoices);
    this.engine.setSession(this.sessionId, this.channelIndex);
    this.loadSample();
    this.engine.setZones(this.zoneList());
    this.fitPads();
    document.addEventListener("nbplay-bus-ready", this.onBusReady);
    this.register();
    this.voiceTimer = setInterval(() => {
      const count = this.engine.getActiveVoiceCount();
      if (count !== this.activeVoices) this.activeVoices = count;
    }, VOICE_COUNTER_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.voiceTimer) clearInterval(this.voiceTimer);
    this.voiceTimer = null;
    this.stopZoneRecording();
    this.recorderStream?.getTracks().forEach((track) => track.stop());
    document.removeEventListener("nbplay-bus-ready", this.onBusReady);
    this.unregister();
    this.engine.destroy();
  }

  updated(changed: PropertyValues): void {
    if (changed.has("sessionId") || changed.has("channelIndex")) {
      if ([...changed.keys()].some((k) => changed.get(k) !== undefined)) {
        this.register();
      }
    }
    if (changed.has("maxVoices")) this.engine.setMaxVoices(this.maxVoices);
    if (
      (changed.has("sampleData") ||
        changed.has("waveform") ||
        changed.has("sampleRate")) &&
      [...changed.keys()].some((k) => changed.get(k) !== undefined)
    ) {
      this.loadSample();
    }
    if (changed.has("zones") && changed.get("zones") !== undefined) {
      this.engine.setZones(this.zoneList());
    }
    if (
      (changed.has("padNotes") || changed.has("padCount")) &&
      [...changed.keys()].some((k) => changed.get(k) !== undefined)
    ) {
      this.fitPads();
    }
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

  // Sample

  private loadSample(): void {
    const display = toFloat32(this.waveform);
    const data = toFloat32(this.sampleData);
    if (data || display) {
      this.engine.setWaveformData(data || display!, Number(this.sampleRate));
    }
  }

  private envelope(): Envelope {
    return {
      attack: Number(this.attack),
      decay: Number(this.decay),
      sustain: Number(this.sustain),
      release: Number(this.release),
    };
  }

  async loadFile(file: File): Promise<void> {
    const decoded = await decodeToMono(await file.arrayBuffer());
    if (!decoded) return;
    const display = decimateSamples(decoded.samples);
    this.sampleName = file.name;
    this.sampleRate = decoded.sampleRate;
    this.sampleLength = decoded.samples.length;
    this.sampleData = float32ToDataView(decoded.samples);
    this.waveform = float32ToDataView(display);
    this.engine.setWaveformData(decoded.samples, decoded.sampleRate);
    this.set({
      sampleName: this.sampleName,
      sampleRate: this.sampleRate,
      sampleLength: this.sampleLength,
      sampleData: this.sampleData,
      waveform: this.waveform,
    });
  }

  // Pads

  private count(): number {
    return clamp(Number(this.padCount || 8), 1, 32);
  }

  private notes(): number[] {
    return resizePadNotes((this.padNotes || []).slice(), this.count());
  }

  private velocities(): number[] {
    return resizePadVelocities(
      (this.padVelocities || []).slice(),
      this.count(),
      Number(this.velocity),
    );
  }

  private actions(): PadAction[] {
    return normalizePadActions(
      this.padActions,
      this.notes(),
      this.velocities(),
      this.count(),
    );
  }

  private slices(): SampleSlice[] {
    return (this.sampleSlices || [])
      .map((s, index) => ({
        index: Number(s.index ?? index),
        note: Number(s.note),
        start: Math.max(0, Math.floor(Number(s.start) || 0)),
        end: Math.max(0, Math.floor(Number(s.end) || 0)),
        label: typeof s.label === "string" ? s.label : undefined,
      }))
      .filter((s) => Number.isFinite(s.note) && s.end > s.start);
  }

  private sliceFor(action: PadAction): SampleSlice | undefined {
    if (action.type !== "note") return undefined;
    const slices = this.slices();
    if (action.slice !== undefined)
      return slices.find((s) => s.index === action.slice);
    return slices.find((s) => s.note === action.note);
  }

  /** Keep the pad arrays at `padCount` (local mirror, as the widget did at render). */
  private fitPads(): void {
    const notes = this.notes();
    const velocities = this.velocities();
    const values: Record<string, unknown> = {};
    if (notes.length !== (this.padNotes || []).length) {
      this.padNotes = notes;
      values.padNotes = notes;
    }
    if (velocities.length !== (this.padVelocities || []).length) {
      this.padVelocities = velocities;
      values.padVelocities = velocities;
    }
    if (Object.keys(values).length) {
      this.emitDetail("nbplay-status", { values, save: false });
    }
  }

  private pads(): PadSpec[] {
    const velocities = this.velocities();
    return this.actions().map((action, i) => {
      const velocity = velocities[i] ?? 100;
      const slice = this.sliceFor(action);
      const label =
        slice?.label ??
        (action.type === "note" && !action.label
          ? undefined
          : padActionLabel(action));
      return label === undefined
        ? { note: (action as { note: number }).note, velocity }
        : { note: this.notes()[i] ?? 60, velocity, label };
    });
  }

  private triggerPad(index: number, velocity: number): void {
    const action = this.actions()[index];
    if (!action) return;
    this.held.add(index);
    if (action.type === "note") {
      this.heldNotes.set(index, action.note);
      this.engine.noteOn(
        action.note,
        Number(this.rootNote),
        this.envelope(),
        velocity,
        this.sliceFor(action),
      );
      this.lastNoteEvent = { note: action.note, velocity, type: "on" };
      this.lastPadEvent = { pad: index, event: "on", velocity, action };
    } else {
      if (action.type === "trait") this.set({ [action.trait]: action.value });
      this.lastPadEvent = { pad: index, event: "trigger", velocity, action };
    }
    this.status();
  }

  private releasePad(index: number): void {
    if (!this.held.delete(index)) return;
    const note = this.heldNotes.get(index);
    const action = this.actions()[index];
    this.heldNotes.delete(index);
    if (note !== undefined) {
      this.engine.noteOff(note, { release: Number(this.release) });
      this.lastNoteEvent = { note, velocity: 0, type: "off" };
      if (action)
        this.lastPadEvent = { pad: index, event: "off", velocity: 0, action };
    }
    this.status();
  }

  private onPadChange(e: Event): void {
    e.stopPropagation();
    const { index, field, value } = (e as CustomEvent).detail as {
      index: number;
      field: "note" | "velocity";
      value: number;
    };
    if (field === "note") {
      const notes = this.notes();
      if (index >= notes.length) return;
      notes[index] = value;
      const actions = this.actions().map((a, i) =>
        i === index && a.type === "note" ? { ...a, note: value } : a,
      );
      this.padNotes = notes;
      this.padActions = actions;
      this.set({ padNotes: notes, padActions: actions });
    } else {
      const velocities = this.velocities();
      if (index >= velocities.length) return;
      velocities[index] = value;
      this.padVelocities = velocities;
      this.set({ padVelocities: velocities });
    }
  }

  private applyPadCount(raw: number): void {
    if (Number.isNaN(raw)) return;
    const count = clamp(Math.round(raw), 1, 32);
    const notes = resizePadNotes((this.padNotes || []).slice(), count);
    const velocities = resizePadVelocities(
      (this.padVelocities || []).slice(),
      count,
      Number(this.velocity),
    );
    const actions = normalizePadActions(
      this.padActions,
      notes,
      velocities,
      count,
    );
    this.padCount = count;
    this.padNotes = notes;
    this.padVelocities = velocities;
    this.padActions = actions;
    this.set({
      padCount: count,
      padNotes: notes,
      padVelocities: velocities,
      padActions: actions,
    });
  }

  private onVelocity(e: Event): void {
    e.stopPropagation();
    const velocity = clampVelocity((e as CustomEvent).detail.value);
    if (velocity === this.velocity) return;
    this.velocity = velocity;
    this.padVelocities = resizePadVelocities(
      this.velocities(),
      this.count(),
      velocity,
    );
    this.set({ velocity, padVelocities: this.padVelocities });
  }

  // Zones

  private zoneList(): Zone[] {
    return (this.zones || []).map((z, index) => ({
      id: String(z.id ?? index),
      name: typeof z.name === "string" ? z.name : `Zone ${index + 1}`,
      note_low: clampNote(z.note_low, 0),
      note_high: clampNote(z.note_high, 127),
      velocity_low: clampNote(z.velocity_low, 0),
      velocity_high: clampNote(z.velocity_high, 127),
      root_note: clampNote(z.root_note, 60),
      sample_rate: Math.max(1, Number(z.sample_rate) || 44100),
      samples: toFloat32(z.data) || new Float32Array(0),
    }));
  }

  private writeZones(zones: Zone[]): void {
    const serialized = zones.map((z) => ({
      id: z.id,
      name: z.name,
      note_low: z.note_low,
      note_high: z.note_high,
      velocity_low: z.velocity_low,
      velocity_high: z.velocity_high,
      root_note: z.root_note,
      sample_rate: z.sample_rate,
      length: z.samples.length,
      data: float32ToDataView(z.samples),
    }));
    this.zones = serialized;
    this.engine.setZones(zones);
    this.set({ zones: serialized });
  }

  private addZone(
    samples: Float32Array,
    sampleRate: number,
    name: string,
    range: { low: number; high: number; root: number },
  ): void {
    const zones = this.zoneList();
    zones.push({
      id: Math.random().toString(36).slice(2, 10),
      name,
      note_low: range.low,
      note_high: range.high,
      velocity_low: 0,
      velocity_high: 127,
      root_note: range.root,
      sample_rate: sampleRate,
      samples,
    });
    this.writeZones(zones);
  }

  /** Range for a captured sample: the selected pad's note, or every note. */
  private captureRange(): { low: number; high: number; root: number } {
    const pad = this.capturePad;
    if (pad >= 0) {
      const note = this.notes()[pad];
      if (note !== undefined) return { low: note, high: note, root: note };
    }
    return { low: 0, high: 127, root: 60 };
  }

  private onZoneChange(e: Event): void {
    e.stopPropagation();
    const { index, field, value } = (e as CustomEvent).detail as {
      index: number;
      field: "name" | "low" | "high" | "root";
      value: unknown;
    };
    const zones = this.zoneList();
    const target = zones[index];
    if (!target) return;
    if (field === "name") target.name = String(value).trim() || target.name;
    else if (field === "low" || field === "high") {
      const key = field === "low" ? "note_low" : "note_high";
      const v = clampNote(value, target[key]);
      target[key] = v;
      if (target.note_low > target.note_high) {
        if (field === "low") target.note_high = v;
        else target.note_low = v;
      }
    } else target.root_note = clampNote(value, target.root_note);
    this.writeZones(zones);
  }

  private async addZoneFromFile(file: File): Promise<void> {
    const decoded = await decodeToMono(await file.arrayBuffer());
    if (!decoded) return;
    this.addZone(
      decoded.samples,
      decoded.sampleRate,
      file.name,
      this.captureRange(),
    );
    this.zoneStatus = `Added ${file.name}`;
  }

  /** A kernel capture request: a clip URL becomes a zone. */
  async command(req: CaptureRequest): Promise<void> {
    if (!req?.url) return;
    this.zoneStatus = "Capturing…";
    try {
      const response = await fetch(req.url);
      const decoded = await decodeToMono(await response.arrayBuffer());
      if (!decoded) throw new Error("Web Audio is unavailable");
      let samples = decoded.samples;
      const start = Math.max(
        0,
        Math.floor((req.offset || 0) * decoded.sampleRate),
      );
      const frames =
        req.duration && req.duration > 0
          ? Math.max(1, Math.round(req.duration * decoded.sampleRate))
          : samples.length - start;
      if (start > 0 || start + frames < samples.length) {
        samples = samples.slice(
          start,
          Math.min(samples.length, start + frames),
        );
      }
      const low = clampNote(req.note_low, 0);
      const high = clampNote(req.note_high, 127);
      this.addZone(samples, decoded.sampleRate, req.name || "Take", {
        low: Math.min(low, high),
        high: Math.max(low, high),
        root: clampNote(req.root_note, low),
      });
      this.zoneStatus = `Captured ${req.name || "take"}`;
    } catch (err) {
      this.zoneStatus = `Capture failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Record the microphone straight into a zone on the selected pad.

  private async startZoneRecording(): Promise<void> {
    const nav = navigator as Navigator & {
      mediaDevices?: {
        getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
      };
    };
    const Recorder = (globalThis as { MediaRecorder?: typeof MediaRecorder })
      .MediaRecorder;
    if (!Recorder || !nav.mediaDevices?.getUserMedia) {
      this.zoneStatus = "Microphone recording is unavailable";
      return;
    }
    try {
      this.recorderStream = await nav.mediaDevices.getUserMedia({
        audio: true,
      });
    } catch (err) {
      this.zoneStatus = `Microphone unavailable: ${err instanceof Error ? err.message : String(err)}`;
      return;
    }
    const range = this.captureRange();
    const takeName = `Take ${this.zoneList().length + 1}`;
    this.recorderChunks = [];
    const recorder = new Recorder(this.recorderStream);
    this.recorder = recorder;
    recorder.addEventListener("dataavailable", (e: BlobEvent) => {
      if (e.data && e.data.size) this.recorderChunks.push(e.data);
    });
    recorder.addEventListener("stop", async () => {
      const blob = new Blob(this.recorderChunks, {
        type: recorder.mimeType || "audio/webm",
      });
      this.recorderChunks = [];
      this.recorderStream?.getTracks().forEach((track) => track.stop());
      this.recorderStream = null;
      this.recorder = null;
      this.recording = false;
      if (!blob.size) {
        this.zoneStatus = "No audio was captured";
        return;
      }
      const decoded = await decodeToMono(await blob.arrayBuffer());
      if (!decoded) return;
      this.addZone(decoded.samples, decoded.sampleRate, takeName, range);
      this.zoneStatus = `Captured ${takeName}`;
    });
    recorder.start();
    this.recording = true;
    this.zoneStatus = `Recording ${takeName}…`;
  }

  private stopZoneRecording(): void {
    if (this.recorder && this.recorder.state !== "inactive")
      this.recorder.stop();
  }

  // Session bus registration

  private onBusReady = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    if (detail?.sessionId === this.sessionId) this.register();
  };

  private unregister(): void {
    if (!this.registration) return;
    const { bus, idx, sampler, instrument } = this.registration;
    if (bus.samplers?.[idx] === sampler) delete bus.samplers[idx];
    if (bus.instruments?.[idx] === instrument) delete bus.instruments[idx];
    this.registration = null;
  }

  private register(): void {
    const sid = this.sessionId;
    const idx = Number(this.channelIndex);
    this.unregister();
    if (!sid || idx < 0) return;
    const bus = getSessionBus(sid);
    if (!bus) return; // the mixer renders later and announces nbplay-bus-ready
    // Bind the engine to the bus context and channel first so scheduled
    // times and routing match the session, not a private context.
    this.engine.setSession(sid, idx);
    const samplers = bus.samplers || {};
    bus.samplers = samplers;
    samplers[idx] = {
      triggerNote: (note: number, velocity: number): void => {
        this.engine.noteOn(
          note,
          Number(this.rootNote),
          this.envelope(),
          velocity,
        );
      },
      releaseNote: (note: number): void => {
        this.engine.noteOff(note, { release: Number(this.release) });
      },
    };
    // Scheduled playback for sequencers, launcher slots, and MIDI clips:
    // the note starts on the audio clock and releases after `duration`.
    const instruments = bus.instruments || {};
    bus.instruments = instruments;
    instruments[idx] = {
      scheduleNote: (note, velocity, at, duration) => {
        const slice = this.slices().find((s) => s.note === note);
        const voice = this.engine.noteOn(
          note,
          Number(this.rootNote),
          this.envelope(),
          velocity,
          slice,
          at,
          duration,
        );
        if (!voice) return;
        return () => this.engine.cancelVoice(voice);
      },
    };
    this.registration = {
      bus,
      idx,
      sampler: samplers[idx],
      instrument: instruments[idx],
    };
  }

  /** Silence every voice (kernel disconnect). */
  silence(): void {
    this.engine.stopAll();
  }

  // Render

  private param(
    cls: string,
    label: string,
    prop: "attack" | "decay" | "sustain" | "release" | "maxVoices",
    kind: string,
    min: number,
    max: number,
    step: number,
    defaultValue: number,
  ) {
    const on = (e: Event) => {
      e.stopPropagation();
      const value = (e as CustomEvent).detail.value as number;
      if (value === this[prop]) return;
      (this as unknown as Record<string, unknown>)[prop] = value;
      this.set({ [prop]: value });
    };
    return html`<nbplay-param
      class=${cls}
      .label=${label}
      .kind=${kind}
      .value=${Number(this[prop])}
      .min=${min}
      .max=${max}
      .step=${step}
      .defaultValue=${defaultValue}
      @input=${on}
      @change=${on}
    ></nbplay-param>`;
  }

  render() {
    const stop = (e: Event) => e.stopPropagation();
    const notes = this.notes();
    const zones = this.zoneList();
    return html`<nbplay-header badge="sampler">
        <input
          type="file"
          class="nbplay-samp-file"
          accept="audio/*"
          @change=${(e: Event) => {
            e.stopPropagation();
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) void this.loadFile(file);
          }}
        />
        <span class="nbplay-samp-name">${this.sampleName}</span>
      </nbplay-header>
      <nbplay-waveform
        class="nbplay-samp-waveform"
        .data=${toFloat32(this.waveform) || toFloat32(this.sampleData)}
        empty-text="No sample loaded"
        @dragover=${(e: DragEvent) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.add("drag-over");
        }}
        @dragleave=${(e: DragEvent) =>
          (e.currentTarget as HTMLElement).classList.remove("drag-over")}
        @drop=${(e: DragEvent) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.remove("drag-over");
          const file = e.dataTransfer?.files?.[0];
          if (file) void this.loadFile(file);
        }}
      ></nbplay-waveform>
      <div class="nbplay-samp-info">
        <span class="nbplay-samp-info-rate"
          >${Number(this.sampleRate) / 1000} kHz</span
        >
        <span class="nbplay-samp-info-root"
          >${noteName(Number(this.rootNote))}</span
        >
        <span class="nbplay-samp-info-len"
          >${fmtLen(Number(this.sampleLength), Number(this.sampleRate))}</span
        >
        <span class="nbplay-samp-info-voices">${this.maxVoices} voices</span>
        <span class="nbplay-samp-active-voices"
          >${this.activeVoices} active</span
        >
      </div>
      <div class="nbplay-samp-envelope">
        <nbplay-envelope
          class="nbplay-samp-env-canvas"
          .attack=${Number(this.attack)}
          .decay=${Number(this.decay)}
          .sustain=${Number(this.sustain)}
          .release=${Number(this.release)}
        ></nbplay-envelope>
        <div class="nbplay-samp-env-controls">
          ${this.param("nbplay-samp-attack", "Attack", "attack", "seconds", 0, 2, 0.001, 0.005)}
          ${this.param("nbplay-samp-decay", "Decay", "decay", "seconds", 0, 2, 0.001, 0.1)}
          ${this.param("nbplay-samp-sustain", "Sustain", "sustain", "percent", 0, 1, 0.01, 0.8)}
          ${this.param("nbplay-samp-release", "Release", "release", "seconds", 0, 5, 0.001, 0.1)}
        </div>
      </div>
      <div class="nbplay-samp-row">
        ${this.param("nbplay-samp-max-voices", "Max Voices", "maxVoices", "int", 1, 32, 1, 8)}
      </div>
      <div class="nbplay-samp-pads-section">
        <div class="nbplay-samp-pads-controls">
          <label class="nbplay-samp-field">
            <span class="nbplay-samp-label">Trigger Pads</span>
            <input
              type="number"
              class="nbplay-samp-pad-count"
              min="1"
              max="32"
              step="1"
              .value=${String(this.count())}
              @change=${stop}
              @input=${(e: Event) => {
                e.stopPropagation();
                this.applyPadCount(
                  parseInt((e.target as HTMLInputElement).value, 10),
                );
              }}
            />
          </label>
          <nbplay-param
            class="nbplay-samp-velocity"
            label="Velocity"
            kind="int"
            .value=${Number(this.velocity)}
            .min=${1}
            .max=${127}
            .step=${1}
            .defaultValue=${100}
            @input=${this.onVelocity}
            @change=${this.onVelocity}
          ></nbplay-param>
          <label class="nbplay-samp-vel-sense-label">
            <input
              type="checkbox"
              class="nbplay-samp-vel-sense"
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
          class="nbplay-samp-pads-grid"
          .rows=${Math.ceil(this.count() / 4)}
          .cols=${Math.min(4, this.count())}
          .pads=${this.pads()}
          .active=${this.activePads}
          .velocitySensitive=${this.velocitySensitive}
          hold
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
      </div>
      <div class="nbplay-samp-zones-section">
        <div class="nbplay-samp-zones-controls">
          <span class="nbplay-samp-label">Zones</span>
          <select
            class="nbplay-samp-zone-pad"
            title="Pad a captured sample lands on"
            @input=${stop}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.capturePad = Number((e.target as HTMLSelectElement).value);
            }}
          >
            <option value="-1" ?selected=${this.capturePad < 0}>
              All notes
            </option>
            ${notes.map(
              (note, index) =>
                html`<option
                  value=${index}
                  ?selected=${index === this.capturePad}
                  .textContent=${`Pad ${index + 1} (${noteName(note)})`}
                ></option>`,
            )}
          </select>
          <label
            class="nbplay-samp-zone-file-label"
            title="Add a zone from an audio file"
          >
            File<input
              type="file"
              class="nbplay-samp-zone-file"
              accept="audio/*"
              @change=${(e: Event) => {
                e.stopPropagation();
                const input = e.target as HTMLInputElement;
                const file = input.files?.[0];
                if (file) {
                  void this.addZoneFromFile(file);
                  input.value = "";
                }
              }}
            />
          </label>
          <button
            type="button"
            class="nbplay-samp-zone-rec ${this.recording ? "recording" : ""}"
            title="Record the microphone into the selected pad"
            @click=${() => {
              if (this.recorder) this.stopZoneRecording();
              else void this.startZoneRecording();
            }}
          >
            ${this.recording ? "Stop" : "Rec"}
          </button>
          <span class="nbplay-samp-zone-status">${this.zoneStatus}</span>
        </div>
        <nbplay-zone-map
          .zones=${zones.map((z) => ({ low: z.note_low, high: z.note_high, name: z.name }))}
        ></nbplay-zone-map>
        <nbplay-zone-list
          .zones=${zones.map((z) => ({
            name: z.name,
            low: z.note_low,
            high: z.note_high,
            root: z.root_note,
            info: fmtLen(z.samples.length, z.sample_rate),
          }))}
          @input=${stop}
          @change=${this.onZoneChange}
          @nbplay-zone-remove=${(e: Event) => {
            e.stopPropagation();
            const list = this.zoneList();
            list.splice((e as CustomEvent).detail.index, 1);
            this.writeZones(list);
          }}
        ></nbplay-zone-list>
      </div>`;
  }
}

define("nbplay-sampler", NbplaySampler);
