// nbplay SettingsWidget – anywidget ESM frontend
// Audio + MIDI device configuration panels

import { type AnyModel } from "./helpers.ts";

// ── MIDI event monitor ───────────────────────────────────────────

const MAX_LOG = 8;

function fmtMidiMsg(data: Uint8Array): string {
  if (!data || data.length === 0) return "";
  const status = data[0];
  const type = status & 0xf0;
  const ch = (status & 0x0f) + 1;

  if (type === 0x90 && data.length >= 3)
    return `NoteOn  ch=${ch} note=${data[1]} vel=${data[2]}`;
  if (type === 0x80 && data.length >= 3)
    return `NoteOff ch=${ch} note=${data[1]} vel=${data[2]}`;
  if (type === 0xb0 && data.length >= 3)
    return `CC      ch=${ch} ctrl=${data[1]} val=${data[2]}`;
  if (type === 0xc0 && data.length >= 2)
    return `PgmChg  ch=${ch} pgm=${data[1]}`;
  if (type === 0xe0 && data.length >= 3) {
    const val = data[1] | (data[2] << 7);
    return `Bend    ch=${ch} val=${val}`;
  }
  if (status === 0xf8) return "Clock";
  if (status === 0xfa) return "Start";
  if (status === 0xfc) return "Stop";
  if (status === 0xfb) return "Continue";
  return `Raw [${Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ")}]`;
}

// ── Web MIDI helper ──────────────────────────────────────────────

interface MidiPort {
  id: string;
  name: string;
  state: string;
}

function createMidiEngine() {
  let access: MIDIAccess | null = null;
  let activeInput: MIDIInput | null = null;
  let onMessage: ((e: MIDIMessageEvent) => void) | null = null;

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

    getInputPorts(): MidiPort[] {
      if (!access) return [];
      const ports: MidiPort[] = [];
      access.inputs.forEach((port) => {
        ports.push({ id: port.id, name: port.name || "(unnamed)", state: port.state });
      });
      return ports;
    },

    connectInput(portId: string, cb: (data: Uint8Array, timestamp: number) => void): void {
      this.disconnectInput();
      if (!access) return;
      const port = access.inputs.get(portId);
      if (!port) return;
      onMessage = (e: MIDIMessageEvent) => cb(e.data as Uint8Array, e.timeStamp);
      port.addEventListener("midimessage", onMessage as EventListener);
      activeInput = port;
    },

    disconnectInput(): void {
      if (activeInput && onMessage) {
        activeInput.removeEventListener("midimessage", onMessage as EventListener);
      }
      activeInput = null;
      onMessage = null;
    },

    getActivePortId(): string | null {
      return activeInput ? activeInput.id : null;
    },
  };
}

// ── Widget render ────────────────────────────────────────────────

function render({ model, el }: { model: AnyModel; el: HTMLElement }): () => void {
  const midi = createMidiEngine();

  const root = document.createElement("div");
  root.className = "nbplay-settings";
  root.innerHTML = `
    <div class="nbplay-header">
      <h3>nbplay</h3>
      <span class="nbplay-badge">settings</span>
    </div>

    <div class="nbplay-section">
      <div class="nbplay-section-title">
        <span class="nbplay-section-icon">\u266B</span> Audio Output
      </div>
      <div class="nbplay-setting-row">
        <span class="nbplay-label">Sample Rate</span>
        <select class="nbplay-select nbplay-sr-select">
          <option value="22050">22050 Hz</option>
          <option value="44100">44100 Hz</option>
          <option value="48000">48000 Hz</option>
          <option value="96000">96000 Hz</option>
        </select>
      </div>
      <div class="nbplay-setting-row">
        <span class="nbplay-label">Channels</span>
        <select class="nbplay-select nbplay-ch-select">
          <option value="1">Mono</option>
          <option value="2">Stereo</option>
        </select>
      </div>
      <div class="nbplay-setting-row">
        <span class="nbplay-label">Buffer Size</span>
        <select class="nbplay-select nbplay-buf-select">
          <option value="128">128</option>
          <option value="256">256</option>
          <option value="512">512</option>
          <option value="1024">1024</option>
          <option value="2048">2048</option>
        </select>
      </div>
      <div class="nbplay-setting-row">
        <span class="nbplay-label">Device</span>
        <span class="nbplay-detail nbplay-audio-device">\u2014</span>
      </div>
    </div>

    <div class="nbplay-section">
      <div class="nbplay-section-title">
        <span class="nbplay-section-icon">\u{1D160}</span> MIDI Input
      </div>
      <div class="nbplay-setting-row">
        <span class="nbplay-label">Port</span>
        <select class="nbplay-select nbplay-midi-select">
          <option value="">Not connected</option>
        </select>
        <button class="nbplay-refresh-btn" title="Refresh MIDI ports">\u21BB</button>
      </div>
      <div class="nbplay-setting-row nbplay-midi-status-row">
        <span class="nbplay-label">Status</span>
        <span class="nbplay-detail nbplay-midi-status">Idle</span>
      </div>
      <div class="nbplay-midi-log-container">
        <div class="nbplay-midi-log-label">Activity</div>
        <div class="nbplay-midi-log"></div>
      </div>
    </div>
  `;
  el.appendChild(root);

  const srSelect = root.querySelector(".nbplay-sr-select") as HTMLSelectElement;
  const chSelect = root.querySelector(".nbplay-ch-select") as HTMLSelectElement;
  const bufSelect = root.querySelector(".nbplay-buf-select") as HTMLSelectElement;
  const audioDevice = root.querySelector(".nbplay-audio-device") as HTMLSpanElement;
  const midiSelect = root.querySelector(".nbplay-midi-select") as HTMLSelectElement;
  const refreshBtn = root.querySelector(".nbplay-refresh-btn") as HTMLButtonElement;
  const midiStatus = root.querySelector(".nbplay-midi-status") as HTMLSpanElement;
  const midiLog = root.querySelector(".nbplay-midi-log") as HTMLDivElement;

  function syncAudio(): void {
    srSelect.value = String(model.get("sample_rate"));
    chSelect.value = String(model.get("channels"));
    bufSelect.value = String(model.get("buffer_size"));
    audioDevice.textContent = (model.get("audio_device") as string) || "Default";
  }

  function syncMidiPort(): void {
    const port = model.get("midi_port") as string;
    midiSelect.value = port || "";
    midiStatus.textContent = port ? "Connected" : "Idle";
    midiStatus.classList.toggle("connected", !!port);
  }

  function addLogEntry(text: string): void {
    const div = document.createElement("div");
    div.className = "nbplay-midi-log-entry";
    div.textContent = text;
    midiLog.prepend(div);
    while (midiLog.children.length > MAX_LOG) {
      midiLog.removeChild(midiLog.lastChild!);
    }
  }

  async function refreshMidiPorts(): Promise<void> {
    const acc = await midi.requestAccess();
    midiSelect.innerHTML = '<option value="">Not connected</option>';
    if (acc) {
      const ports = midi.getInputPorts();
      const portNames = ports.map((p) => p.name);
      model.set("available_midi_ports", portNames);
      model.save_changes();
      ports.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        midiSelect.appendChild(opt);
      });
    }
    syncMidiPort();
  }

  // ── Audio events ──
  srSelect.addEventListener("change", () => {
    model.set("sample_rate", parseInt(srSelect.value, 10));
    model.save_changes();
  });
  chSelect.addEventListener("change", () => {
    model.set("channels", parseInt(chSelect.value, 10));
    model.save_changes();
  });
  bufSelect.addEventListener("change", () => {
    model.set("buffer_size", parseInt(bufSelect.value, 10));
    model.save_changes();
  });

  // ── MIDI events ──
  refreshBtn.addEventListener("click", () => {
    refreshMidiPorts();
  });

  midiSelect.addEventListener("change", () => {
    const portId = midiSelect.value;
    if (portId) {
      midi.connectInput(portId, (data: Uint8Array, timestamp: number) => {
        const msg = fmtMidiMsg(data);
        if (msg) addLogEntry(msg);

        const buf = new Uint8Array(data.length + 8);
        const view = new DataView(buf.buffer);
        view.setFloat64(0, timestamp, true);
        buf.set(data, 8);
        model.set("midi_event", new DataView(buf.buffer));
        model.save_changes();
      });
      const port = midi.getInputPorts().find((p) => p.id === portId);
      model.set("midi_port", port ? port.name : portId);
    } else {
      midi.disconnectInput();
      model.set("midi_port", "");
    }
    model.save_changes();
  });

  // ── Model observers ──
  model.on("change:sample_rate", syncAudio);
  model.on("change:channels", syncAudio);
  model.on("change:buffer_size", syncAudio);
  model.on("change:audio_device", syncAudio);
  model.on("change:midi_port", syncMidiPort);

  // ── Initial state ──
  syncAudio();
  refreshMidiPorts();

  return () => midi.disconnectInput();
}

export default { render };
