import { html, type PropertyValues } from "lit";
import { createMidiAccess, type MidiPortInfo } from "../midi_access.ts";
import { noteName } from "../pads.ts";
import { emitBusNote, getSessionBus, type NoteEvent } from "../session.ts";
import { NbplayElement, define } from "./base.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./header.ts";

/** One route: see `MidiRouterConfig` in Python. */
export interface MidiRoute {
  port: string;
  midi_channel: number;
  note_low: number;
  note_high: number;
  channel_index: number;
}

/** The routes a note from `port` on MIDI `channel` (0-15) matches. */
export function matchMidiRoutes(
  routes: MidiRoute[],
  port: string,
  channel: number,
  note: number,
): MidiRoute[] {
  return routes.filter(
    (route) =>
      (!route.port || route.port === port) &&
      (route.midi_channel < 0 || route.midi_channel === channel) &&
      note >= route.note_low &&
      note <= route.note_high,
  );
}

function samePorts(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

const NEW_ROUTE: Omit<MidiRoute, "channel_index"> = {
  port: "",
  midi_channel: -1,
  note_low: 0,
  note_high: 127,
};

/**
 * `<nbplay-midi-router>`: routes Web MIDI input to the session's track
 * instruments. It listens to every input port. A note-on starts a held note
 * (`bus.instruments[channel].startNote`) on every route it matches and the
 * note-off releases those notes, whatever the routes are by then; every note
 * is also broadcast like a keyboard's (`nbplay-note` and
 * `bus.noteListeners`). Route edits fire `nbplay-set`; the port list, the
 * latest message and control changes fire `nbplay-status`.
 */
export class NbplayMidiRouter extends NbplayElement {
  static properties = {
    routes: { attribute: false },
    sessionTracks: { attribute: false },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    availableMidiPorts: { attribute: false },
    lastEvent: { attribute: false },
    controlChange: { attribute: false },
  };

  declare routes: MidiRoute[];
  /** The session's tracks a route can play: `{channel_index, name}`. */
  declare sessionTracks: { channel_index: number; name: string }[];
  declare sessionId: string;
  declare availableMidiPorts: string[];
  declare lastEvent: Record<string, unknown>;
  declare controlChange: Record<string, unknown>;

  private midi = createMidiAccess();
  private stopListening: (() => void) | null = null;
  /** Releases of the notes held now, by port, channel and note. */
  private held = new Map<string, Array<(at?: number) => void>>();
  private ccSeq = 0;
  /** The input port names the browser sees; null until access is granted. */
  private knownPorts: string[] | null = null;

  constructor() {
    super();
    this.routes = [];
    this.sessionTracks = [];
    this.sessionId = "";
    this.availableMidiPorts = [];
    this.lastEvent = {};
    this.controlChange = {};
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-midi-router");
    void this.listen();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopListening?.();
    this.stopListening = null;
    this.releaseAll();
  }

  updated(changed: PropertyValues): void {
    // The port list is the browser's: a host snapshot that arrives after
    // the ports were reported (before the wire was up) gets them again.
    if (
      changed.has("availableMidiPorts") &&
      this.knownPorts &&
      !samePorts(this.availableMidiPorts || [], this.knownPorts)
    ) {
      this.availableMidiPorts = this.knownPorts;
      this.status({ availableMidiPorts: this.knownPorts });
    }
    // Notes held on the old session's instruments end with it.
    if (changed.has("sessionId") && changed.get("sessionId") !== undefined)
      this.releaseAll();
  }

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  private status(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-status", { values, save: true });
  }

  private async listen(): Promise<void> {
    if (!(await this.midi.requestAccess()) || !this.isConnected) return;
    this.stopListening?.();
    this.stopListening = this.midi.listenAll(
      (port, data) => this.handleMidiData(port.name, data),
      (ports) => this.onPorts(ports),
    );
  }

  private onPorts(ports: MidiPortInfo[]): void {
    const names = ports.map((p) => p.name);
    this.knownPorts = names;
    if (samePorts(names, this.availableMidiPorts || [])) return;
    this.availableMidiPorts = names;
    this.status({ availableMidiPorts: names });
  }

  /** Release every held note (disconnect, or the session changed). */
  releaseAll(): void {
    this.held.forEach((releases) => releases.forEach((release) => release()));
    this.held.clear();
  }

  /** Feed one raw MIDI message from the port named `port`. */
  handleMidiData(port: string, data: Uint8Array): void {
    if (!data || data.length < 3) return;
    const kind = data[0] & 0xf0;
    const channel = data[0] & 0x0f;
    const [, note, value] = data;
    if (kind === 0xb0) {
      this.ccSeq += 1;
      this.controlChange = {
        controller: note,
        value,
        channel,
        port,
        seq: this.ccSeq,
      };
      this.report({ port, type: "cc", controller: note, value, channel });
      return;
    }
    const key = `${port}\n${channel}\n${note}`;
    if (kind === 0x90 && value > 0) {
      this.noteOff(key);
      this.held.set(key, this.noteOn(port, channel, note, value));
      this.broadcast({ note, velocity: value, type: "on" });
      this.report({ port, type: "on", note, value, channel });
    } else if (kind === 0x80 || kind === 0x90) {
      this.noteOff(key);
      this.broadcast({ note, velocity: 0, type: "off" });
      this.report({ port, type: "off", note, value: 0, channel });
    }
  }

  private noteOn(
    port: string,
    channel: number,
    note: number,
    velocity: number,
  ): Array<(at?: number) => void> {
    const bus = getSessionBus(this.sessionId);
    if (!bus?.instruments) return [];
    if (bus.audioCtx?.state === "suspended") void bus.audioCtx.resume();
    const releases: Array<(at?: number) => void> = [];
    for (const route of matchMidiRoutes(
      this.routes || [],
      port,
      channel,
      note,
    )) {
      const release = bus.instruments[route.channel_index]?.startNote?.(
        note,
        velocity,
      );
      if (release) releases.push(release);
    }
    return releases;
  }

  private noteOff(key: string): void {
    this.held.get(key)?.forEach((release) => release());
    this.held.delete(key);
  }

  private broadcast(evt: NoteEvent): void {
    emitBusNote(this.sessionId, evt);
    document.dispatchEvent(new CustomEvent("nbplay-note", { detail: evt }));
  }

  private report(event: Record<string, unknown>): void {
    this.lastEvent = event;
    const values: Record<string, unknown> = { lastEvent: event };
    if (event.type === "cc") values.controlChange = this.controlChange;
    this.status(values);
  }

  // Editing

  private editRoute(index: number, fields: Partial<MidiRoute>): void {
    const routes = (this.routes || []).map((route) => ({ ...route }));
    if (!routes[index]) return;
    routes[index] = { ...routes[index], ...fields };
    // The kernel keeps a range low to high; so does the page.
    const { note_low, note_high } = routes[index];
    if (note_low > note_high)
      Object.assign(routes[index], {
        note_low: note_high,
        note_high: note_low,
      });
    this.routes = routes;
    this.set({ routes });
  }

  private addRoute(): void {
    const track = (this.sessionTracks || [])[0];
    const routes = [
      ...(this.routes || []),
      { ...NEW_ROUTE, channel_index: track ? track.channel_index : -1 },
    ];
    this.routes = routes;
    this.set({ routes });
  }

  private removeRoute(index: number): void {
    const routes = (this.routes || []).filter((_, i) => i !== index);
    this.routes = routes;
    this.set({ routes });
  }

  // Render

  private monitorText(): string {
    const evt = this.lastEvent as Record<string, unknown> | undefined;
    if (!evt?.type) return "No messages";
    const where = `${evt.port} ch ${Number(evt.channel) + 1}`;
    if (evt.type === "cc")
      return `${where}  CC ${evt.controller}  ${evt.value}`;
    const note = noteName(Number(evt.note));
    return evt.type === "on"
      ? `${where}  ${note}  vel ${evt.value}`
      : `${where}  ${note}  off`;
  }

  private renderRoute(route: MidiRoute, index: number) {
    const stop = (e: Event) => e.stopPropagation();
    const value = (e: Event) =>
      parseInt((e.target as HTMLSelectElement | HTMLInputElement).value, 10);
    const ports = this.availableMidiPorts || [];
    // A saved route keeps its port while that device is unplugged.
    const portOptions =
      route.port && !ports.includes(route.port)
        ? [...ports, route.port]
        : ports;
    const note = (field: "note_low" | "note_high", label: string) =>
      html`<input
        type="number"
        class="nbplay-midi-router-${field.replace("_", "-")}"
        aria-label=${label}
        title=${noteName(route[field])}
        min="0"
        max="127"
        .value=${String(route[field])}
        @input=${stop}
        @change=${(e: Event) => {
          stop(e);
          const n = value(e);
          if (Number.isFinite(n))
            this.editRoute(index, { [field]: Math.max(0, Math.min(127, n)) });
        }}
      />`;
    return html`<div class="nbplay-midi-router-route" role="row">
      <select
        class="nbplay-midi-router-port"
        aria-label="Port"
        @input=${stop}
        @change=${(e: Event) => {
          stop(e);
          this.editRoute(index, {
            port: (e.target as HTMLSelectElement).value,
          });
        }}
      >
        <option value="" ?selected=${!route.port}>Any port</option>
        ${portOptions.map(
          (name) =>
            html`<option value=${name} ?selected=${route.port === name}>
              ${name}
            </option>`,
        )}
      </select>
      <select
        class="nbplay-midi-router-channel"
        aria-label="MIDI channel"
        @input=${stop}
        @change=${(e: Event) => {
          stop(e);
          this.editRoute(index, { midi_channel: value(e) });
        }}
      >
        <option value="-1" ?selected=${route.midi_channel < 0}>Any ch</option>
        ${Array.from(
          { length: 16 },
          (_, ch) =>
            html`<option value=${ch} ?selected=${route.midi_channel === ch}>
              Ch ${ch + 1}
            </option>`,
        )}
      </select>
      <span class="nbplay-midi-router-notes"
        >${note("note_low", "Lowest note")}–${note(
          "note_high",
          "Highest note",
        )}</span
      >
      <select
        class="nbplay-midi-router-track"
        aria-label="Track"
        @input=${stop}
        @change=${(e: Event) => {
          stop(e);
          this.editRoute(index, { channel_index: value(e) });
        }}
      >
        <option value="-1" ?selected=${route.channel_index < 0}>—</option>
        ${(this.sessionTracks || []).map(
          (t) =>
            html`<option
              value=${t.channel_index}
              ?selected=${route.channel_index === t.channel_index}
            >
              ${t.name}
            </option>`,
        )}
      </select>
      <button
        type="button"
        class="nbplay-midi-router-remove"
        title="Remove route"
        aria-label="Remove route"
        @click=${() => this.removeRoute(index)}
      >
        ×
      </button>
    </div>`;
  }

  render() {
    const ports = this.availableMidiPorts || [];
    return html`<nbplay-header badge="midi"></nbplay-header>
      <div class="nbplay-midi-router-ports">
        <span class="nbplay-midi-router-label">Inputs</span>
        ${
          ports.length
            ? ports.map(
                (name) =>
                  html`<span class="nbplay-midi-router-port-name"
                    >${name}</span
                  >`,
              )
            : html`<span class="nbplay-midi-router-none">No MIDI inputs</span>`
        }
      </div>
      <div class="nbplay-midi-router-routes" role="table">
        ${
          (this.routes || []).length
            ? html`<div class="nbplay-midi-router-head" role="row">
                <span role="columnheader">Port</span>
                <span role="columnheader">Channel</span>
                <span role="columnheader">Notes</span>
                <span role="columnheader">Track</span>
              </div>`
            : ""
        }
        ${(this.routes || []).map((route, index) =>
          this.renderRoute(route, index),
        )}
      </div>
      <button
        type="button"
        class="nbplay-midi-router-add"
        @click=${() => this.addRoute()}
      >
        Add route
      </button>
      <div class="nbplay-midi-router-monitor">${this.monitorText()}</div>`;
  }
}

define("nbplay-midi-router", NbplayMidiRouter);
