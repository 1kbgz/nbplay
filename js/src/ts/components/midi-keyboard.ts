import { html } from "lit";
import { type PropertyValues } from "lit";
import { createMidiAccess, type MidiPortInfo } from "../midi_access.ts";
import { noteName } from "../pads.ts";
import { routeNoteOff, routeNoteOn, type KeyboardRoute } from "../routing.ts";
import {
  bindElementClock,
  type ClockBinding,
  getSessionBus,
  type NoteEvent,
} from "../session.ts";
import { createSineVoices, type SineVoices } from "../voices.ts";
import { NbplayElement, define } from "./base.ts";
import type { Zone } from "./keys.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./header.ts";
import "./midi-port.ts";

const MIDI_CLOCK = 0xf8;
const MIDI_START = 0xfa;
const MIDI_CONTINUE = 0xfb;
const MIDI_STOP = 0xfc;
const MIDI_SONG_POSITION = 0xf2;
const TICKS_PER_BEAT = 24;

function zoneForNote(note: number): Zone {
  return note < 60 ? "lower" : "upper";
}

function broadcastNote(sessionId: string, evt: NoteEvent): void {
  const bus = sessionId ? getSessionBus(sessionId) : undefined;
  bus?.noteListeners?.forEach((fn) => fn(evt));
  document.dispatchEvent(new CustomEvent("nbplay-note", { detail: evt }));
}

/**
 * `<nbplay-midi-keyboard>`: browser Web MIDI note input. A header, an
 * `nbplay-midi-port` picker, a clock-follow switch with the measured tempo,
 * and a monitor of the last event and held count. Notes route to samplers
 * on the session bus (`samplerRouting`) or play fallback sine voices, and
 * are broadcast like the typing keyboard's. With `syncClock`, the device's
 * start/stop/continue, song position and 24 PPQN ticks drive the session
 * clock. `midiPort` holds the selected port's name and, with `syncClock`,
 * fires `nbplay-set`; `availableMidiPorts`, `activeNotes`, `lastNoteEvent`,
 * `controlChange` and `clockBpm` fire `nbplay-status`.
 */
export class NbplayMidiKeyboard extends NbplayElement {
  static properties = {
    midiPort: { type: String, attribute: "midi-port" },
    syncClock: { type: Boolean, attribute: "sync-clock" },
    samplerRouting: { attribute: false },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    channelIndex: { type: Number, attribute: "channel-index" },
    availableMidiPorts: { attribute: false },
    activeNotes: { attribute: false },
    lastNoteEvent: { attribute: false },
    controlChange: { attribute: false },
    clockBpm: { type: Number, attribute: false },
    ports: { attribute: false },
  };

  declare midiPort: string;
  declare syncClock: boolean;
  declare samplerRouting: KeyboardRoute[];
  declare sessionId: string;
  declare channelIndex: number;
  declare availableMidiPorts: string[];
  declare activeNotes: number[];
  declare lastNoteEvent: Record<string, unknown>;
  declare controlChange: Record<string, unknown>;
  declare clockBpm: number;
  /** Enumerated input ports (browser state). */
  declare ports: MidiPortInfo[];

  private midi = createMidiAccess();
  private voices: SineVoices = createSineVoices();
  private heldNotes = new Set<number>();
  private binding: (ClockBinding & { rebind(): void }) | null = null;
  private monitor = "No notes";
  private ccSeq = 0;
  private tickTimes: number[] = [];
  private tickCount = 0;
  private baseBeat = 0;

  constructor() {
    super();
    this.midiPort = "";
    this.syncClock = false;
    this.samplerRouting = [];
    this.sessionId = "";
    this.channelIndex = -1;
    this.availableMidiPorts = [];
    this.activeNotes = [];
    this.lastNoteEvent = {};
    this.controlChange = {};
    this.clockBpm = 0;
    this.ports = [];
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-midi-keyboard");
    this.voices.setSession(this.sessionId, this.channelIndex);
    this.binding = bindElementClock(
      this,
      () => {},
      () => {},
    );
    void this.refreshPorts();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.midi.disconnectInput();
    this.voices.destroy();
    this.binding?.dispose();
    this.binding = null;
  }

  updated(changed: PropertyValues): void {
    if (changed.has("sessionId") || changed.has("channelIndex")) {
      this.voices.setSession(this.sessionId, this.channelIndex);
      if (changed.has("sessionId")) this.binding?.rebind();
    }
    if (
      changed.has("lastNoteEvent") &&
      changed.get("lastNoteEvent") !== undefined
    ) {
      this.monitor = this.monitorText();
      this.requestUpdate();
    }
    // A port name written by the host selects that port once it is known.
    if (changed.has("midiPort") && changed.get("midiPort") !== undefined) {
      this.connectByName(this.midiPort);
    }
  }

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  private status(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-status", { values, save: true });
  }

  private monitorText(): string {
    const evt = this.lastNoteEvent as Partial<NoteEvent> | undefined;
    if (evt?.type === "on" && typeof evt.note === "number") {
      return `${noteName(evt.note)}  vel ${evt.velocity}`;
    }
    if (evt?.type === "off" && typeof evt.note === "number") {
      return `${noteName(evt.note)}  off`;
    }
    return "No notes";
  }

  // Ports

  async refreshPorts(): Promise<void> {
    const access = await this.midi.requestAccess();
    this.ports = access ? this.midi.inputs() : [];
    if (access) {
      this.availableMidiPorts = this.ports.map((p) => p.name);
      this.status({ availableMidiPorts: this.availableMidiPorts });
      if (this.midiPort && !this.midi.activeInputId()) {
        this.connectByName(this.midiPort);
      }
    }
  }

  private get activePortId(): string {
    return this.midi.activeInputId() ?? "";
  }

  private connectById(portId: string): void {
    if (!portId) {
      this.midi.disconnectInput();
      return;
    }
    this.midi.connectInput(portId, (data, timestamp) =>
      this.handleMidiData(data, timestamp),
    );
  }

  private connectByName(name: string): void {
    const activeId = this.midi.activeInputId();
    const active = this.ports.find((p) => p.id === activeId);
    if ((active?.name ?? "") === name) return;
    const port = this.ports.find((p) => p.name === name);
    this.connectById(port?.id ?? "");
    this.requestUpdate();
  }

  private onPortChange(e: Event): void {
    e.stopPropagation();
    const portId = (e as CustomEvent).detail.value as string;
    this.connectById(portId);
    const port = this.ports.find((p) => p.id === portId);
    this.midiPort = portId ? (port?.name ?? portId) : "";
    this.set({ midiPort: this.midiPort });
  }

  // Notes

  private noteOn(note: number, velocity: number): void {
    if (note < 0 || note > 127) return;
    this.heldNotes.add(note);
    const zone = zoneForNote(note);
    if (
      !routeNoteOn(
        this.sessionId,
        this.samplerRouting || [],
        note,
        zone,
        velocity,
      )
    ) {
      this.voices.noteOn(note, velocity);
    }
    const evt: NoteEvent = { note, velocity, type: "on" };
    broadcastNote(this.sessionId, evt);
    this.lastNoteEvent = { ...evt };
    this.activeNotes = Array.from(this.heldNotes);
    this.monitor = this.monitorText();
    this.status({ lastNoteEvent: evt, activeNotes: this.activeNotes });
  }

  private noteOff(note: number): void {
    if (note < 0 || note > 127) return;
    this.heldNotes.delete(note);
    if (
      !routeNoteOff(
        this.sessionId,
        this.samplerRouting || [],
        note,
        zoneForNote(note),
      )
    ) {
      this.voices.noteOff(note);
    }
    const evt: NoteEvent = { note, velocity: 0, type: "off" };
    broadcastNote(this.sessionId, evt);
    this.lastNoteEvent = { ...evt };
    this.activeNotes = Array.from(this.heldNotes);
    this.monitor = this.monitorText();
    this.status({ lastNoteEvent: evt, activeNotes: this.activeNotes });
  }

  private control(controller: number, value: number, channel: number): void {
    this.ccSeq += 1;
    this.controlChange = { controller, value, channel, seq: this.ccSeq };
    this.monitor = `CC ${controller}  ${value}`;
    this.requestUpdate();
    this.status({ controlChange: this.controlChange });
  }

  /** Drop every held note and silence the voices (kernel disconnect). */
  silence(): void {
    this.midi.disconnectInput();
    this.voices.stopAll();
    this.heldNotes.clear();
    this.activeNotes = [];
    this.status({ activeNotes: [] });
  }

  // MIDI clock follower: the device's transport drives the session clock
  // and the tick rate sets its tempo.

  private handleClockTick(timestamp: number): void {
    const clk = this.binding!.clock();
    this.tickTimes.push(timestamp);
    if (this.tickTimes.length > TICKS_PER_BEAT + 1) this.tickTimes.shift();
    this.tickCount += 1;
    if (this.tickTimes.length === TICKS_PER_BEAT + 1) {
      const seconds =
        (this.tickTimes[TICKS_PER_BEAT] - this.tickTimes[0]) / 1000;
      if (seconds > 0) {
        const bpm = Math.round((60 / seconds) * 10) / 10;
        if (Math.abs(bpm - clk.bpm) > 0.5) clk.setTempo(bpm);
        if (Math.abs(bpm - (Number(this.clockBpm) || 0)) > 0.05) {
          this.clockBpm = bpm;
          this.status({ clockBpm: bpm });
        }
      }
    }
    // Pull the session back onto the device's beat grid once per beat.
    if (
      this.tickCount % TICKS_PER_BEAT === 0 &&
      clk.playing &&
      !clk.loop.enabled
    ) {
      const expected = this.baseBeat + this.tickCount / TICKS_PER_BEAT;
      if (Math.abs(clk.beat() - expected) > 0.05) clk.seek(expected);
    }
  }

  private handleRealtime(status: number, timestamp: number): void {
    if (!this.syncClock) return;
    const clk = this.binding!.clock();
    if (status === MIDI_CLOCK) {
      this.handleClockTick(timestamp);
    } else if (status === MIDI_START) {
      this.tickTimes = [];
      this.tickCount = 0;
      this.baseBeat = 0;
      clk.seek(0);
      clk.play();
    } else if (status === MIDI_CONTINUE) {
      this.tickTimes = [];
      this.tickCount = 0;
      this.baseBeat = clk.beat();
      clk.play();
    } else if (status === MIDI_STOP) {
      this.tickTimes = [];
      clk.stop();
    }
  }

  private handleSongPosition(sixteenths: number): void {
    if (!this.syncClock) return;
    const beat = sixteenths / 4;
    this.tickCount = 0;
    this.baseBeat = beat;
    this.binding!.clock().seek(beat);
  }

  /** Feed one raw MIDI message (also used by hosts that own the port). */
  handleMidiData(data: Uint8Array, timestamp = performance.now()): void {
    if (!data || data.length === 0) return;
    if (data[0] >= MIDI_CLOCK) {
      this.handleRealtime(data[0], timestamp);
      return;
    }
    if (data[0] === MIDI_SONG_POSITION && data.length >= 3) {
      this.handleSongPosition((data[1] & 0x7f) | ((data[2] & 0x7f) << 7));
      return;
    }
    if (data.length < 3) return;
    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];
    if (status === 0xb0) {
      this.control(note, velocity, data[0] & 0x0f);
      return;
    }
    if (status === 0x90 && velocity > 0) {
      this.noteOn(note, velocity);
      return;
    }
    if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      this.noteOff(note);
    }
  }

  render() {
    const stop = (e: Event) => e.stopPropagation();
    const bpm = Number(this.clockBpm) || 0;
    return html`<nbplay-header badge="midi keyboard"></nbplay-header>
      <div class="nbplay-midi-kb-row">
        <span class="nbplay-midi-kb-label">Port</span>
        <nbplay-midi-port
          .ports=${this.ports.map((p) => ({ id: p.id, name: p.name }))}
          .value=${this.activePortId}
          .status=${this.midiPort ? "connected" : "idle"}
          @input=${stop}
          @change=${this.onPortChange}
          @nbplay-refresh=${(e: Event) => {
            e.stopPropagation();
            void this.refreshPorts();
          }}
        ></nbplay-midi-port>
      </div>
      <div class="nbplay-midi-kb-row">
        <span class="nbplay-midi-kb-label">Clock</span>
        <label class="nbplay-midi-kb-clock-label">
          <input
            type="checkbox"
            class="nbplay-midi-kb-clock-input"
            .checked=${this.syncClock}
            @input=${stop}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.syncClock = (e.target as HTMLInputElement).checked;
              this.set({ syncClock: this.syncClock });
            }}
          />
          Follow device clock
        </label>
        <span class="nbplay-midi-kb-clock"
          >${bpm > 0 ? `${bpm.toFixed(1)} BPM` : "—"}</span
        >
      </div>
      <div class="nbplay-midi-kb-monitor">
        <span class="nbplay-midi-kb-last">${this.monitor}</span>
        <span class="nbplay-midi-kb-active">${this.heldNotes.size} active</span>
      </div>`;
  }
}

define("nbplay-midi-keyboard", NbplayMidiKeyboard);
