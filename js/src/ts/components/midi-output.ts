import { html } from "lit";
import { type PropertyValues } from "lit";
import { createMidiAccess, type MidiPortInfo } from "../midi_access.ts";
import {
  bindElementClock,
  type ClockBinding,
  type ClockEvent,
  getOrCreateSessionBus,
  type NoteEvent,
  type SessionBus,
  type SessionClock,
} from "../session.ts";
import { NbplayElement, define } from "./base.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./header.ts";
import "./midi-port.ts";

const MIDI_CLOCK = 0xf8;
const MIDI_START = 0xfa;
const MIDI_CONTINUE = 0xfb;
const MIDI_STOP = 0xfc;
const MIDI_SONG_POSITION = 0xf2;
const TICKS_PER_BEAT = 24;
const TICK_INTERVAL_MS = 25;
const TICK_LOOKAHEAD_S = 0.1;

/** Song position pointer bytes for a beat (14-bit count of sixteenths). */
export function songPositionBytes(beat: number): number[] {
  const sixteenths = Math.max(0, Math.min(0x3fff, Math.round(beat * 4)));
  return [MIDI_SONG_POSITION, sixteenths & 0x7f, (sixteenths >> 7) & 0x7f];
}

export interface SendRequest {
  kind?: string;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  data?: number[];
  nonce?: number;
}

function clamp7(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n)
    ? Math.max(0, Math.min(127, Math.round(n)))
    : fallback;
}

/**
 * `<nbplay-midi-output>`: sends session notes and kernel requests to a Web
 * MIDI output. A header, an `nbplay-midi-port` picker of output ports, the
 * channel select, forward and clock switches, and a sent counter. With
 * `forwardNotes`, notes from the session bus (or, without a session, the
 * document `nbplay-note` events) go out on `channel`; with `sendClock`, the
 * session clock's play/stop/seek become start/continue/stop/song position
 * and 24 PPQN ticks scheduled from the clock's AudioContext time.
 * `command({kind, ...})` sends a kernel request (`note_on`, `note_off`,
 * `control_change`, `raw`). Port, channel and switch edits fire
 * `nbplay-set`; enumerated port names fire `nbplay-status`.
 */
export class NbplayMidiOutput extends NbplayElement {
  static properties = {
    midiPort: { type: String, attribute: "midi-port" },
    channel: { type: Number },
    forwardNotes: { type: Boolean, attribute: "forward-notes" },
    sendClock: { type: Boolean, attribute: "send-clock" },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    availableMidiPorts: { attribute: false },
    ports: { attribute: false },
    sent: { type: Number, attribute: false },
  };

  declare midiPort: string;
  declare channel: number;
  declare forwardNotes: boolean;
  declare sendClock: boolean;
  declare sessionId: string;
  declare availableMidiPorts: string[];
  /** Enumerated output ports (browser state). */
  declare ports: MidiPortInfo[];
  /** Messages sent since the element connected. */
  declare sent: number;

  private midi = createMidiAccess();
  private active: MIDIOutput | null = null;
  private activeId = "";
  private bus: SessionBus | null = null;
  private binding: (ClockBinding & { rebind(): void }) | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private nextTickTime = 0;

  constructor() {
    super();
    this.midiPort = "";
    this.channel = 0;
    this.forwardNotes = true;
    this.sendClock = false;
    this.sessionId = "";
    this.availableMidiPorts = [];
    this.ports = [];
    this.sent = 0;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-midi-output");
    this.binding = bindElementClock(this, this.onClockEvent, this.onRebind);
    this.bindSession();
    void this.refreshPorts();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardown();
    this.binding?.dispose();
    this.binding = null;
  }

  updated(changed: PropertyValues): void {
    if (changed.has("sessionId") && changed.get("sessionId") !== undefined) {
      this.bindSession();
      this.binding?.rebind();
    }
    if (changed.has("midiPort") && changed.get("midiPort") !== undefined) {
      this.connectByName(this.midiPort);
    }
    if (changed.has("midiPort") || changed.has("sendClock")) {
      this.syncClockSending();
    }
  }

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  private status(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-status", { values, save: true });
  }

  private channelNumber(): number {
    const c = Number(this.channel);
    return Number.isFinite(c) ? Math.max(0, Math.min(15, Math.round(c))) : 0;
  }

  // Ports

  async refreshPorts(): Promise<void> {
    const access = await this.midi.requestAccess();
    this.ports = access ? this.midi.outputs() : [];
    if (access) {
      this.availableMidiPorts = this.ports.map((p) => p.name);
      this.status({ availableMidiPorts: this.availableMidiPorts });
      if (this.midiPort && !this.active) this.connectByName(this.midiPort);
    }
  }

  private connectById(portId: string): void {
    this.active = portId ? this.midi.output(portId) : null;
    this.activeId = this.active ? portId : "";
  }

  private connectByName(name: string): void {
    const current = this.ports.find((p) => p.id === this.activeId);
    if ((current?.name ?? "") === name) return;
    const port = this.ports.find((p) => p.name === name);
    this.connectById(port?.id ?? "");
    this.requestUpdate();
  }

  private onPortChange(e: Event): void {
    e.stopPropagation();
    this.allNotesOff();
    const portId = (e as CustomEvent).detail.value as string;
    this.connectById(portId);
    const port = this.ports.find((p) => p.id === portId);
    this.midiPort = this.active ? (port?.name ?? portId) : "";
    this.set({ midiPort: this.midiPort });
  }

  // Sending

  private send(data: number[], timestamp?: number): void {
    if (!this.active) return;
    try {
      if (timestamp === undefined) this.active.send(data);
      else this.active.send(data, timestamp);
      this.sent += 1;
    } catch {
      /* the port went away */
    }
  }

  private allNotesOff(): void {
    this.send([0xb0 | this.channelNumber(), 123, 0]);
  }

  /** Convert an AudioContext time on the session clock to a Web MIDI timestamp. */
  private timestampFor(at: number): number | undefined {
    const ctx = this.binding?.clock().context() || this.bus?.audioCtx;
    if (!ctx) return undefined;
    return performance.now() + Math.max(0, at - ctx.currentTime) * 1000;
  }

  /** A kernel send request. */
  command(req: SendRequest): void {
    if (!req?.kind) return;
    const ch = this.channelNumber();
    if (req.kind === "note_on") {
      this.send([
        0x90 | ch,
        clamp7(req.note, 60),
        Math.max(1, clamp7(req.velocity, 100)),
      ]);
    } else if (req.kind === "note_off") {
      this.send([0x80 | ch, clamp7(req.note, 60), 0]);
    } else if (req.kind === "control_change") {
      this.send([0xb0 | ch, clamp7(req.controller, 0), clamp7(req.value, 0)]);
    } else if (req.kind === "raw" && Array.isArray(req.data)) {
      this.send(
        req.data.map((b) =>
          Math.max(0, Math.min(255, Math.round(Number(b) || 0))),
        ),
      );
    }
  }

  // Session notes

  private onNote = (evt: NoteEvent): void => {
    if (!this.forwardNotes) return;
    const ch = this.channelNumber();
    const note = clamp7(evt.note, 60);
    if (evt.type === "off") {
      this.send([0x80 | ch, note, 0]);
      return;
    }
    const velocity = Math.max(1, clamp7(evt.velocity, 100));
    if (evt.at === undefined) {
      this.send([0x90 | ch, note, velocity]);
      return;
    }
    const onAt = this.timestampFor(evt.at);
    this.send([0x90 | ch, note, velocity], onAt);
    if (evt.duration !== undefined) {
      const offAt =
        onAt === undefined
          ? undefined
          : onAt + Math.max(0, evt.duration) * 1000;
      this.send([0x80 | ch, note, 0], offAt);
    }
  };

  private onDocumentNote = (event: Event): void => {
    this.onNote((event as CustomEvent<NoteEvent>).detail);
  };

  private unbindSession(): void {
    if (this.bus?.noteListeners) {
      this.bus.noteListeners = this.bus.noteListeners.filter(
        (fn) => fn !== this.onNote,
      );
    }
    document.removeEventListener("nbplay-note", this.onDocumentNote);
    this.bus = null;
  }

  private bindSession(): void {
    this.unbindSession();
    if (this.sessionId) {
      // Session notes (keyboards, sequencers, clips) arrive on the bus.
      this.bus = getOrCreateSessionBus(this.sessionId);
      if (!this.bus.noteListeners) this.bus.noteListeners = [];
      this.bus.noteListeners.push(this.onNote);
    } else {
      // Without a session, forward whatever keyboards and pads broadcast.
      document.addEventListener("nbplay-note", this.onDocumentNote);
    }
  }

  // MIDI clock leader: ticks are scheduled ahead from the session clock's
  // AudioContext time, so they line up with the audio the session plays.

  private sendsClock(): boolean {
    return Boolean(this.sendClock) && Boolean(this.midiPort);
  }

  private scheduleTicks = (): void => {
    const clk = this.binding!.clock();
    const now = clk.now();
    const spacing = clk.secondsPerBeat() / TICKS_PER_BEAT;
    // One clock-to-timestamp offset per pass keeps the tick spacing exact.
    const ctx = clk.context();
    const base = ctx ? performance.now() - ctx.currentTime * 1000 : undefined;
    // After a throttled tab, resume from now instead of flooding old ticks.
    if (this.nextTickTime < now - 0.5) this.nextTickTime = now;
    while (this.nextTickTime < now + TICK_LOOKAHEAD_S) {
      this.send(
        [MIDI_CLOCK],
        base === undefined ? undefined : base + this.nextTickTime * 1000,
      );
      this.nextTickTime += spacing;
    }
  };

  private startTicks(clk: SessionClock): void {
    if (this.tickTimer) return;
    this.nextTickTime = clk.now();
    this.tickTimer = setInterval(this.scheduleTicks, TICK_INTERVAL_MS);
    this.scheduleTicks();
  }

  private stopTicks(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  private onClockEvent = (event: ClockEvent): void => {
    const clk = this.binding!.clock();
    switch (event.type) {
      case "play":
        if (!this.sendsClock()) break;
        if (event.beat < 1e-3) this.send([MIDI_START]);
        else {
          this.send(songPositionBytes(event.beat));
          this.send([MIDI_CONTINUE]);
        }
        this.startTicks(clk);
        break;
      case "stop":
        if (this.tickTimer) this.send([MIDI_STOP]);
        this.stopTicks();
        break;
      case "seek":
        if (this.tickTimer) this.send(songPositionBytes(event.beat));
        break;
      case "tempo":
      case "loop":
      case "record":
      case "timesig":
        break;
    }
  };

  private onRebind = (clk: SessionClock): void => {
    this.stopTicks();
    if (this.sendsClock() && clk.playing) this.startTicks(clk);
  };

  private syncClockSending(): void {
    const clk = this.binding?.clock();
    if (!clk) return;
    if (this.sendsClock() && clk.playing && !this.tickTimer) {
      this.send(songPositionBytes(clk.beat()));
      this.send([MIDI_CONTINUE]);
      this.startTicks(clk);
    } else if (!this.sendsClock() && this.tickTimer) {
      this.send([MIDI_STOP]);
      this.stopTicks();
    }
  }

  /** Stop the clock, silence the device and drop the port (kernel disconnect). */
  teardown(): void {
    if (this.tickTimer) this.send([MIDI_STOP]);
    this.stopTicks();
    this.allNotesOff();
    this.unbindSession();
    this.active = null;
    this.activeId = "";
  }

  render() {
    const stop = (e: Event) => e.stopPropagation();
    const check = (
      cls: string,
      prop: "forwardNotes" | "sendClock",
      label: string,
    ) =>
      html`<label class="nbplay-midi-out-forward">
        <input
          type="checkbox"
          class=${cls}
          .checked=${this[prop]}
          @input=${stop}
          @change=${(e: Event) => {
            e.stopPropagation();
            this[prop] = (e.target as HTMLInputElement).checked;
            this.set({ [prop]: this[prop] });
          }}
        />
        ${label}
      </label>`;
    return html`<nbplay-header badge="midi output"></nbplay-header>
      <div class="nbplay-midi-out-row">
        <span class="nbplay-midi-out-label">Port</span>
        <nbplay-midi-port
          .ports=${this.ports.map((p) => ({ id: p.id, name: p.name }))}
          .value=${this.activeId}
          .status=${this.midiPort ? "connected" : "idle"}
          @input=${stop}
          @change=${this.onPortChange}
          @nbplay-refresh=${(e: Event) => {
            e.stopPropagation();
            void this.refreshPorts();
          }}
        ></nbplay-midi-port>
      </div>
      <div class="nbplay-midi-out-row">
        <span class="nbplay-midi-out-label">Channel</span>
        <select
          class="nbplay-midi-out-channel"
          .value=${String(this.channelNumber())}
          @input=${stop}
          @change=${(e: Event) => {
            e.stopPropagation();
            this.allNotesOff();
            this.channel = Number((e.target as HTMLSelectElement).value);
            this.set({ channel: this.channel });
          }}
        >
          ${Array.from(
            { length: 16 },
            (_, i) =>
              html`<option
                value=${i}
                ?selected=${i === this.channelNumber()}
                .textContent=${String(i + 1)}
              ></option>`,
          )}
        </select>
        ${check("nbplay-midi-out-forward-input", "forwardNotes", "Forward session notes")}
        ${check("nbplay-midi-out-clock-input", "sendClock", "Send clock")}
      </div>
      <div class="nbplay-midi-out-row">
        <span class="nbplay-midi-out-label">Sent</span>
        <span class="nbplay-midi-out-count">${this.sent} sent</span>
      </div>`;
  }
}

define("nbplay-midi-output", NbplayMidiOutput);
