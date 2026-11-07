import { html } from "lit";
import { type PropertyValues } from "lit";
import { createMidiAccess, type MidiPortInfo } from "../midi_access.ts";
import { NbplayElement, define } from "./base.ts";
import { fmtMidiMsg, type NbplayMidiLog } from "./midi-log.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./header.ts";
import "./midi-log.ts";
import "./midi-port.ts";

const SAMPLE_RATES = [22050, 44100, 48000, 96000];
const BUFFER_SIZES = [128, 256, 512, 1024, 2048];
const MAX_LOG = 8;

/**
 * `<nbplay-settings>`: audio output configuration (sample rate, channels,
 * buffer size, device readout) and MIDI input (port picker and an activity
 * log). Audio edits and the chosen port fire `nbplay-set`; enumerated port
 * names fire `nbplay-status` as `availableMidiPorts`, and every incoming
 * message as `midiEvent`, a `DataView` of a little-endian f64 timestamp
 * followed by the raw bytes.
 */
export class NbplaySettings extends NbplayElement {
  static properties = {
    sampleRate: { type: Number, attribute: "sample-rate" },
    channels: { type: Number },
    bufferSize: { type: Number, attribute: "buffer-size" },
    audioDevice: { type: String, attribute: "audio-device" },
    midiPort: { type: String, attribute: "midi-port" },
    availableMidiPorts: { attribute: false },
    midiEvent: { attribute: false },
    ports: { attribute: false },
  };

  declare sampleRate: number;
  declare channels: number;
  declare bufferSize: number;
  declare audioDevice: string;
  declare midiPort: string;
  declare availableMidiPorts: string[];
  declare midiEvent: DataView | null;
  /** Enumerated input ports (browser state). */
  declare ports: MidiPortInfo[];

  private midi = createMidiAccess();

  constructor() {
    super();
    this.sampleRate = 44100;
    this.channels = 2;
    this.bufferSize = 512;
    this.audioDevice = "";
    this.midiPort = "";
    this.availableMidiPorts = [];
    this.midiEvent = null;
    this.ports = [];
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-settings");
    void this.refreshPorts();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.midi.disconnectInput();
  }

  updated(changed: PropertyValues): void {
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

  private onMessage = (data: Uint8Array, timestamp: number): void => {
    const text = fmtMidiMsg(data);
    const log = this.querySelector("nbplay-midi-log") as NbplayMidiLog | null;
    if (text && log) log.push(text);
    const buf = new Uint8Array(data.length + 8);
    new DataView(buf.buffer).setFloat64(0, timestamp, true);
    buf.set(data, 8);
    this.midiEvent = new DataView(buf.buffer);
    this.status({ midiEvent: this.midiEvent });
  };

  private connectById(portId: string): void {
    if (portId) this.midi.connectInput(portId, this.onMessage);
    else this.midi.disconnectInput();
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

  private select(
    cls: string,
    prop: "sampleRate" | "channels" | "bufferSize",
    options: Array<{ value: number; label: string }>,
  ) {
    return html`<select
      class="nbplay-select ${cls}"
      .value=${String(this[prop])}
      @input=${(e: Event) => e.stopPropagation()}
      @change=${(e: Event) => {
        e.stopPropagation();
        const value = parseInt((e.target as HTMLSelectElement).value, 10);
        this[prop] = value;
        this.set({ [prop]: value });
      }}
    >
      ${options.map(
        (o) =>
          html`<option
            value=${o.value}
            ?selected=${o.value === this[prop]}
            .textContent=${o.label}
          ></option>`,
      )}
    </select>`;
  }

  render() {
    const activeId = this.midi.activeInputId() ?? "";
    return html`<nbplay-header badge="settings"></nbplay-header>
      <div class="nbplay-section">
        <div class="nbplay-section-title">
          <span class="nbplay-section-icon">♫</span> Audio Output
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Sample Rate</span>
          ${this.select(
            "nbplay-sr-select",
            "sampleRate",
            SAMPLE_RATES.map((v) => ({ value: v, label: `${v} Hz` })),
          )}
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Channels</span>
          ${this.select("nbplay-ch-select", "channels", [
            { value: 1, label: "Mono" },
            { value: 2, label: "Stereo" },
          ])}
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Buffer Size</span>
          ${this.select(
            "nbplay-buf-select",
            "bufferSize",
            BUFFER_SIZES.map((v) => ({ value: v, label: String(v) })),
          )}
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Device</span>
          <span class="nbplay-detail nbplay-audio-device"
            >${this.audioDevice || "Default"}</span
          >
        </div>
      </div>
      <div class="nbplay-section">
        <div class="nbplay-section-title">
          <span class="nbplay-section-icon">𝅘𝅥𝅮</span> MIDI Input
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Port</span>
          <nbplay-midi-port
            .ports=${this.ports.map((p) => ({ id: p.id, name: p.name }))}
            .value=${activeId}
            .status=${this.midiPort ? "connected" : "idle"}
            @input=${(e: Event) => e.stopPropagation()}
            @change=${this.onPortChange}
            @nbplay-refresh=${(e: Event) => {
              e.stopPropagation();
              void this.refreshPorts();
            }}
          ></nbplay-midi-port>
        </div>
        <nbplay-midi-log label="Activity" .max=${MAX_LOG}></nbplay-midi-log>
      </div>`;
  }
}

define("nbplay-settings", NbplaySettings);
