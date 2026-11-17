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

/** One mapping: see `MidiRouterConfig` in Python. */
export interface MidiMapping {
  port: string;
  midi_channel: number;
  kind: "note" | "cc";
  number: number;
  action: string;
  track_index: number;
  scene_index: number;
}

/** The mappings a note or control change `number` from `port` on MIDI `channel` matches. */
export function matchMidiMappings(
  mappings: MidiMapping[],
  port: string,
  channel: number,
  kind: "note" | "cc",
  number: number,
): MidiMapping[] {
  return mappings.filter(
    (mapping) =>
      (!mapping.port || mapping.port === port) &&
      (mapping.midi_channel < 0 || mapping.midi_channel === channel) &&
      mapping.kind === kind &&
      mapping.number === number,
  );
}

const ACTIONS = [
  { value: "toggle", label: "Play/stop" },
  { value: "play", label: "Play" },
  { value: "stop", label: "Stop" },
  { value: "record", label: "Record" },
  { value: "launch", label: "Launch slot" },
  { value: "scene", label: "Launch scene" },
  { value: "stop_track", label: "Stop track" },
  { value: "stop_all", label: "Stop all" },
];
const TRACK_ACTIONS = ["launch", "stop_track"];
const SCENE_ACTIONS = ["launch", "scene"];

function samePorts(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

const NEW_MAPPING: MidiMapping = {
  port: "",
  midi_channel: -1,
  kind: "note",
  number: 0,
  action: "toggle",
  track_index: -1,
  scene_index: -1,
};

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
 * `bus.noteListeners`). A mapping instead binds one note-on, or a control
 * change pressed (value 64 or more), to a transport action on the session
 * clock or a launcher action (`bus.launcher`); a mapped message is not routed
 * or broadcast. A mapping's Learn button takes the next message's port,
 * channel and number. Route and mapping edits fire `nbplay-set`; the port
 * list, the latest message and control changes fire `nbplay-status`.
 */
export class NbplayMidiRouter extends NbplayElement {
  static properties = {
    routes: { attribute: false },
    mappings: { attribute: false },
    sessionTracks: { attribute: false },
    sessionScenes: { attribute: false },
    sessionId: { type: String, attribute: "session-id", reflect: true },
    availableMidiPorts: { attribute: false },
    lastEvent: { attribute: false },
    controlChange: { attribute: false },
    learning: { state: true },
  };

  declare routes: MidiRoute[];
  declare mappings: MidiMapping[];
  /** The launcher's scene names. */
  declare sessionScenes: string[];
  /** The mapping waiting for its message in Learn, or -1. */
  declare learning: number;
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
  /** Held notes an input took, so their note-off is not broadcast either. */
  private taken = new Set<string>();
  private ccSeq = 0;
  /** The input port names the browser sees; null until access is granted. */
  private knownPorts: string[] | null = null;

  constructor() {
    super();
    this.routes = [];
    this.mappings = [];
    this.sessionTracks = [];
    this.sessionScenes = [];
    this.learning = -1;
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
    if (kind === 0xb0 || (kind === 0x90 && value > 0)) {
      const type = kind === 0xb0 ? "cc" : "note";
      // A control change of 64 or more is a press; under it, a release.
      const pressed = type === "note" || value >= 64;
      if (pressed && this.learn(port, channel, type, note)) return;
      const mapped = matchMidiMappings(
        this.mappings || [],
        port,
        channel,
        type,
        note,
      );
      if (mapped.length) {
        if (pressed) mapped.forEach((mapping) => this.run(mapping));
        this.report({
          port,
          type,
          [type === "cc" ? "controller" : "note"]: note,
          value,
          channel,
        });
        return;
      }
    }
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
      const { releases, taken } = this.noteOn(port, channel, note, value);
      this.held.set(key, releases);
      // A note an input (an arpeggiator) took is heard as what it plays.
      if (taken) this.taken.add(key);
      else this.broadcast({ note, velocity: value, type: "on" });
      this.report({ port, type: "on", note, value, channel });
    } else if (kind === 0x80 || kind === 0x90) {
      this.noteOff(key);
      if (this.taken.delete(key)) {
        this.report({ port, type: "off", note, value: 0, channel });
        return;
      }
      // A mapped key's release belongs to its mapping too.
      if (
        matchMidiMappings(this.mappings || [], port, channel, "note", note)
          .length
      )
        return;
      this.broadcast({ note, velocity: 0, type: "off" });
      this.report({ port, type: "off", note, value: 0, channel });
    }
  }

  private noteOn(
    port: string,
    channel: number,
    note: number,
    velocity: number,
  ): { releases: Array<(at?: number) => void>; taken: boolean } {
    const bus = getSessionBus(this.sessionId);
    const releases: Array<(at?: number) => void> = [];
    let taken = false;
    if (!bus) return { releases, taken };
    if (bus.audioCtx?.state === "suspended") void bus.audioCtx.resume();
    for (const route of matchMidiRoutes(
      this.routes || [],
      port,
      channel,
      note,
    )) {
      const input = bus.inputs?.[route.channel_index];
      if (input) taken = true;
      const release = (
        input ?? bus.instruments?.[route.channel_index]
      )?.startNote?.(note, velocity);
      if (release) releases.push(release);
    }
    return { releases, taken };
  }

  /** Fill the mapping waiting in Learn from this message; false when none waits. */
  private learn(
    port: string,
    channel: number,
    kind: "note" | "cc",
    number: number,
  ): boolean {
    if (!(this.learning >= 0) || !this.mappings?.[this.learning]) return false;
    const index = this.learning;
    this.learning = -1;
    this.editMapping(index, { port, midi_channel: channel, kind, number });
    return true;
  }

  /** Run a mapping's action on the session clock or launcher. */
  private run(mapping: MidiMapping): void {
    const bus = getSessionBus(this.sessionId);
    const clk = bus?.clock;
    switch (mapping.action) {
      case "play":
        clk?.play();
        break;
      case "stop":
        clk?.stop();
        break;
      case "toggle":
        if (clk?.playing) clk.stop();
        else clk?.play();
        break;
      case "record": {
        // As the transport's record button: arming also starts the clock.
        if (!clk) break;
        const next = !clk.recording;
        clk.setRecording(next);
        if (next) clk.play();
        break;
      }
      case "launch":
        bus?.launcher?.command({
          action: "launch",
          track_index: mapping.track_index,
          scene_index: mapping.scene_index,
        });
        break;
      case "scene":
        bus?.launcher?.command({
          action: "scene",
          scene_index: mapping.scene_index,
        });
        break;
      case "stop_track":
        bus?.launcher?.command({
          action: "stop",
          track_index: mapping.track_index,
        });
        break;
      case "stop_all":
        bus?.launcher?.command({ action: "stop_all" });
        break;
    }
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

  private editMapping(index: number, fields: Partial<MidiMapping>): void {
    const mappings = (this.mappings || []).map((mapping) => ({ ...mapping }));
    if (!mappings[index]) return;
    mappings[index] = { ...mappings[index], ...fields };
    this.mappings = mappings;
    this.set({ mappings });
  }

  /** Add a mapping and wait for the message that triggers it. */
  private addMapping(): void {
    const mappings = [...(this.mappings || []), { ...NEW_MAPPING }];
    this.mappings = mappings;
    this.set({ mappings });
    this.learning = mappings.length - 1;
  }

  private removeMapping(index: number): void {
    const mappings = (this.mappings || []).filter((_, i) => i !== index);
    if (this.learning === index) this.learning = -1;
    else if (this.learning > index) this.learning -= 1;
    this.mappings = mappings;
    this.set({ mappings });
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

  private triggerText(mapping: MidiMapping): string {
    const port = mapping.port || "Any port";
    const channel =
      mapping.midi_channel < 0 ? "any ch" : `ch ${mapping.midi_channel + 1}`;
    const what =
      mapping.kind === "cc"
        ? `CC ${mapping.number}`
        : `note ${noteName(mapping.number)}`;
    return `${port} · ${channel} · ${what}`;
  }

  private renderMapping(mapping: MidiMapping, index: number) {
    const stop = (e: Event) => e.stopPropagation();
    const value = (e: Event) =>
      parseInt((e.target as HTMLSelectElement).value, 10);
    const learning = this.learning === index;
    const usesTrack = TRACK_ACTIONS.includes(mapping.action);
    const usesScene = SCENE_ACTIONS.includes(mapping.action);
    return html`<div class="nbplay-midi-router-mapping" role="row">
      <button
        type="button"
        class="nbplay-midi-router-learn ${learning ? "learning" : ""}"
        title=${`${this.triggerText(mapping)}: click, then press the key, pad or button to use`}
        @click=${() => (this.learning = learning ? -1 : index)}
      >
        ${learning ? "Press a key…" : this.triggerText(mapping)}
      </button>
      <select
        class="nbplay-midi-router-action"
        aria-label="Action"
        @input=${stop}
        @change=${(e: Event) => {
          stop(e);
          this.editMapping(index, {
            action: (e.target as HTMLSelectElement).value,
          });
        }}
      >
        ${ACTIONS.map(
          (a) =>
            html`<option
              value=${a.value}
              ?selected=${mapping.action === a.value}
            >
              ${a.label}
            </option>`,
        )}
      </select>
      <select
        class="nbplay-midi-router-slot-track"
        aria-label="Launcher track"
        ?disabled=${!usesTrack}
        @input=${stop}
        @change=${(e: Event) => {
          stop(e);
          this.editMapping(index, { track_index: value(e) });
        }}
      >
        <option value="-1" ?selected=${mapping.track_index < 0}>—</option>
        ${(this.sessionTracks || []).map(
          (t, row) =>
            html`<option value=${row} ?selected=${mapping.track_index === row}>
              ${t.name}
            </option>`,
        )}
      </select>
      <select
        class="nbplay-midi-router-slot-scene"
        aria-label="Scene"
        ?disabled=${!usesScene}
        @input=${stop}
        @change=${(e: Event) => {
          stop(e);
          this.editMapping(index, { scene_index: value(e) });
        }}
      >
        <option value="-1" ?selected=${mapping.scene_index < 0}>—</option>
        ${(this.sessionScenes || []).map(
          (name, scene) =>
            html`<option
              value=${scene}
              ?selected=${mapping.scene_index === scene}
            >
              ${name}
            </option>`,
        )}
      </select>
      <button
        type="button"
        class="nbplay-midi-router-remove"
        title="Remove control"
        aria-label="Remove control"
        @click=${() => this.removeMapping(index)}
      >
        ×
      </button>
    </div>`;
  }

  render() {
    const ports = this.availableMidiPorts || [];
    const mappings = this.mappings || [];
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
      <div class="nbplay-midi-router-mappings" role="table">
        ${
          mappings.length
            ? html`<div class="nbplay-midi-router-mapping-head" role="row">
                <span role="columnheader">Control</span>
                <span role="columnheader">Action</span>
                <span role="columnheader">Track</span>
                <span role="columnheader">Scene</span>
              </div>`
            : ""
        }
        ${mappings.map((mapping, index) => this.renderMapping(mapping, index))}
      </div>
      <button
        type="button"
        class="nbplay-midi-router-add-control"
        @click=${() => this.addMapping()}
      >
        Add control
      </button>
      <div class="nbplay-midi-router-monitor">${this.monitorText()}</div>`;
  }
}

define("nbplay-midi-router", NbplayMidiRouter);
