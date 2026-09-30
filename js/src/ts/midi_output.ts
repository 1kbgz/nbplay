// nbplay MidiOutputWidget - send session notes and Python messages to a Web MIDI output

import { type AnyModel, onKernelDisconnect } from "./helpers.ts";
import {
  getOrCreateSessionBus,
  type NoteEvent,
  type SessionBus,
} from "./session.ts";

interface MidiPortInfo {
  id: string;
  name: string;
}

interface SendRequest {
  kind?: string;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  data?: number[];
  nonce?: number;
}

function createOutputEngine() {
  let access: MIDIAccess | null = null;
  let active: MIDIOutput | null = null;

  return {
    async requestAccess(): Promise<MIDIAccess | null> {
      if (access) return access;
      if (!navigator.requestMIDIAccess) return null;
      try {
        access = await navigator.requestMIDIAccess({ sysex: false });
        return access;
      } catch (_) {
        return null;
      }
    },

    getOutputPorts(): MidiPortInfo[] {
      const ports: MidiPortInfo[] = [];
      access?.outputs.forEach((port) => {
        ports.push({ id: port.id, name: port.name || "(unnamed)" });
      });
      return ports;
    },

    connect(portId: string): MidiPortInfo | null {
      this.disconnect();
      const port = access?.outputs.get(portId);
      if (!port) return null;
      active = port;
      return { id: port.id, name: port.name || port.id };
    },

    disconnect(): void {
      active = null;
    },

    send(data: number[], timestamp?: number): boolean {
      if (!active) return false;
      try {
        if (timestamp === undefined) active.send(data);
        else active.send(data, timestamp);
        return true;
      } catch (_) {
        return false;
      }
    },
  };
}

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const engine = createOutputEngine();
  let sent = 0;
  let bus: SessionBus | null = null;
  let busSessionId = "";

  const root = document.createElement("div");
  root.className = "nbplay-midi-output";
  root.innerHTML = `
    <div class="nbplay-midi-out-header">
      <h3>nbplay</h3>
      <span class="nbplay-badge">midi output</span>
    </div>
    <div class="nbplay-midi-out-row">
      <span class="nbplay-midi-out-label">Port</span>
      <select class="nbplay-midi-out-select">
        <option value="">Not connected</option>
      </select>
      <button class="nbplay-midi-out-refresh" title="Refresh MIDI ports">Refresh</button>
    </div>
    <div class="nbplay-midi-out-row">
      <span class="nbplay-midi-out-label">Channel</span>
      <select class="nbplay-midi-out-channel"></select>
      <label class="nbplay-midi-out-forward">
        <input type="checkbox" class="nbplay-midi-out-forward-input" /> Forward session notes
      </label>
    </div>
    <div class="nbplay-midi-out-row">
      <span class="nbplay-midi-out-label">Status</span>
      <span class="nbplay-midi-out-status">Idle</span>
      <span class="nbplay-midi-out-count">0 sent</span>
    </div>
  `;
  el.appendChild(root);

  const portSelect = root.querySelector(
    ".nbplay-midi-out-select",
  ) as HTMLSelectElement;
  const refreshBtn = root.querySelector(
    ".nbplay-midi-out-refresh",
  ) as HTMLButtonElement;
  const channelSelect = root.querySelector(
    ".nbplay-midi-out-channel",
  ) as HTMLSelectElement;
  const forwardInput = root.querySelector(
    ".nbplay-midi-out-forward-input",
  ) as HTMLInputElement;
  const statusEl = root.querySelector(
    ".nbplay-midi-out-status",
  ) as HTMLSpanElement;
  const countEl = root.querySelector(
    ".nbplay-midi-out-count",
  ) as HTMLSpanElement;

  for (let i = 0; i < 16; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i + 1);
    channelSelect.appendChild(opt);
  }

  function channel(): number {
    const c = Number(model.get("channel"));
    return Number.isFinite(c) ? Math.max(0, Math.min(15, Math.round(c))) : 0;
  }

  function clamp7(v: unknown, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n)
      ? Math.max(0, Math.min(127, Math.round(n)))
      : fallback;
  }

  function send(data: number[], timestamp?: number): void {
    if (engine.send(data, timestamp)) {
      sent += 1;
      countEl.textContent = `${sent} sent`;
    }
  }

  /** Convert an AudioContext time on the session bus to a Web MIDI timestamp. */
  function timestampFor(at: number): number | undefined {
    const ctx = bus?.audioCtx;
    if (!ctx) return undefined;
    return performance.now() + Math.max(0, at - ctx.currentTime) * 1000;
  }

  function onNote(evt: NoteEvent): void {
    if (!model.get("forward_notes")) return;
    const ch = channel();
    const note = clamp7(evt.note, 60);
    if (evt.type === "off") {
      send([0x80 | ch, note, 0]);
      return;
    }
    const velocity = Math.max(1, clamp7(evt.velocity, 100));
    if (evt.at === undefined) {
      send([0x90 | ch, note, velocity]);
      return;
    }
    const onAt = timestampFor(evt.at);
    send([0x90 | ch, note, velocity], onAt);
    if (evt.duration !== undefined) {
      const offAt =
        onAt === undefined
          ? undefined
          : onAt + Math.max(0, evt.duration) * 1000;
      send([0x80 | ch, note, 0], offAt);
    }
  }

  function onDocumentNote(event: Event): void {
    onNote((event as CustomEvent<NoteEvent>).detail);
  }

  function bindSession(): void {
    if (bus?.noteListeners) {
      bus.noteListeners = bus.noteListeners.filter((fn) => fn !== onNote);
    }
    document.removeEventListener("nbplay-note", onDocumentNote);
    bus = null;
    busSessionId = (model.get("session_id") as string) || "";
    if (busSessionId) {
      // Session notes (keyboards, sequencers, clips) arrive on the bus.
      bus = getOrCreateSessionBus(busSessionId);
      if (!bus.noteListeners) bus.noteListeners = [];
      bus.noteListeners.push(onNote);
    } else {
      // Without a session, forward whatever keyboards and pads broadcast.
      document.addEventListener("nbplay-note", onDocumentNote);
    }
  }

  function handleSendRequest(): void {
    const req = model.get("send_request") as SendRequest | undefined;
    if (!req || !req.kind) return;
    const ch = channel();
    if (req.kind === "note_on") {
      send([
        0x90 | ch,
        clamp7(req.note, 60),
        Math.max(1, clamp7(req.velocity, 100)),
      ]);
    } else if (req.kind === "note_off") {
      send([0x80 | ch, clamp7(req.note, 60), 0]);
    } else if (req.kind === "control_change") {
      send([0xb0 | ch, clamp7(req.controller, 0), clamp7(req.value, 0)]);
    } else if (req.kind === "raw" && Array.isArray(req.data)) {
      send(
        req.data.map((b) =>
          Math.max(0, Math.min(255, Math.round(Number(b) || 0))),
        ),
      );
    }
  }

  function allNotesOff(): void {
    send([0xb0 | channel(), 123, 0]);
  }

  function syncStatus(): void {
    const connected = !!model.get("midi_port");
    statusEl.textContent = connected ? "Connected" : "Idle";
    statusEl.classList.toggle("connected", connected);
    channelSelect.value = String(channel());
    forwardInput.checked = !!model.get("forward_notes");
  }

  async function refreshPorts(): Promise<void> {
    const access = await engine.requestAccess();
    portSelect.innerHTML = '<option value="">Not connected</option>';
    if (access) {
      const ports = engine.getOutputPorts();
      model.set(
        "available_midi_ports",
        ports.map((port) => port.name),
      );
      model.save_changes();
      ports.forEach((port) => {
        const opt = document.createElement("option");
        opt.value = port.id;
        opt.textContent = port.name;
        portSelect.appendChild(opt);
      });
    }
    syncStatus();
  }

  portSelect.addEventListener("change", () => {
    allNotesOff();
    const portId = portSelect.value;
    const port = portId ? engine.connect(portId) : null;
    if (!port) engine.disconnect();
    model.set("midi_port", port ? port.name : "");
    model.save_changes();
    syncStatus();
  });
  refreshBtn.addEventListener("click", () => {
    refreshPorts();
  });
  channelSelect.addEventListener("change", () => {
    allNotesOff();
    model.set("channel", Number(channelSelect.value));
    model.save_changes();
  });
  forwardInput.addEventListener("change", () => {
    model.set("forward_notes", forwardInput.checked);
    model.save_changes();
  });

  model.on("change:midi_port", syncStatus);
  model.on("change:channel", syncStatus);
  model.on("change:forward_notes", syncStatus);
  model.on("change:session_id", bindSession);
  model.on("change:send_request", handleSendRequest);

  bindSession();
  syncStatus();
  refreshPorts();

  function teardown(): void {
    allNotesOff();
    if (bus?.noteListeners) {
      bus.noteListeners = bus.noteListeners.filter((fn) => fn !== onNote);
    }
    document.removeEventListener("nbplay-note", onDocumentNote);
    engine.disconnect();
  }

  const cancelDisconnect = onKernelDisconnect(model, teardown);
  return () => {
    cancelDisconnect();
    teardown();
  };
}

export default { render };
