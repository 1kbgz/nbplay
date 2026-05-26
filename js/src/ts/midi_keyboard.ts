// nbplay MidiKeyboardWidget - browser Web MIDI note input
// External MIDI keyboard input with sampler routing and velocity.

import { type AnyModel, onKernelDisconnect } from "./helpers.ts";

const NOTE_NAMES: string[] = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function noteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[midi % 12] + octave;
}

function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

type Zone = "upper" | "lower";

function zoneForNote(note: number): Zone {
  return note < 60 ? "lower" : "upper";
}

interface NoteEvent {
  note: number;
  velocity: number;
  type: "on" | "off";
}

interface SamplerBus {
  triggerNote: (note: number, velocity: number) => void;
  releaseNote: (note: number) => void;
}

interface NbplayBus {
  audioCtx: AudioContext;
  channels: { gain: AudioNode }[];
  noteListeners?: Array<(evt: NoteEvent) => void>;
  samplers?: Record<number, SamplerBus>;
}

interface MidiPortInfo {
  id: string;
  name: string;
  state: string;
}

function getSessionBus(sessionId: string): NbplayBus | undefined {
  if (!sessionId) return undefined;
  const g = globalThis as Record<string, unknown>;
  const nbplay = g.__nbplay as Record<string, NbplayBus> | undefined;
  return nbplay?.[sessionId];
}

function broadcastNote(sessionId: string, evt: NoteEvent): void {
  const bus = getSessionBus(sessionId);
  if (bus?.noteListeners) {
    bus.noteListeners.forEach((fn) => fn(evt));
  }
  document.dispatchEvent(new CustomEvent("nbplay-note", { detail: evt }));
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

    getInputPorts(): MidiPortInfo[] {
      if (!access) return [];
      const ports: MidiPortInfo[] = [];
      access.inputs.forEach((port) => {
        ports.push({
          id: port.id,
          name: port.name || "(unnamed)",
          state: port.state,
        });
      });
      return ports;
    },

    connectInput(
      portId: string,
      cb: (data: Uint8Array, timestamp: number) => void,
    ): MidiPortInfo | null {
      this.disconnectInput();
      if (!access) return null;
      const port = access.inputs.get(portId);
      if (!port) return null;
      onMessage = (e: MIDIMessageEvent) =>
        cb(e.data as Uint8Array, e.timeStamp || performance.now());
      port.addEventListener("midimessage", onMessage as EventListener);
      activeInput = port;
      return {
        id: port.id,
        name: port.name || port.id,
        state: port.state,
      };
    },

    disconnectInput(): void {
      if (activeInput && onMessage) {
        activeInput.removeEventListener(
          "midimessage",
          onMessage as EventListener,
        );
      }
      activeInput = null;
      onMessage = null;
    },
  };
}

function createMidiAudio() {
  let audioCtx: AudioContext | null = null;
  let outputNode: AudioNode | null = null;
  let ownAudioCtx = true;
  const activeOscs: Map<number, { osc: OscillatorNode; gain: GainNode }> =
    new Map();

  return {
    setSession(sessionId: string, channelIndex: number): void {
      const bus = getSessionBus(sessionId);
      if (bus && channelIndex >= 0 && bus.channels[channelIndex]) {
        audioCtx = bus.audioCtx;
        outputNode = bus.channels[channelIndex].gain;
        ownAudioCtx = false;
        return;
      }
      if (!audioCtx) {
        audioCtx = new AudioContext();
        ownAudioCtx = true;
      }
    },

    ensureCtx(): void {
      if (!audioCtx) {
        audioCtx = new AudioContext();
        ownAudioCtx = true;
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    },

    noteOn(midi: number, velocity: number): void {
      this.ensureCtx();
      if (!audioCtx || activeOscs.has(midi)) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = midiToHz(midi);
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(
        (velocity / 127) * 0.3,
        audioCtx.currentTime + 0.005,
      );
      osc.connect(gain);
      gain.connect(outputNode || audioCtx.destination);
      osc.start();
      activeOscs.set(midi, { osc, gain });
    },

    noteOff(midi: number): void {
      if (!audioCtx) return;
      const entry = activeOscs.get(midi);
      if (!entry) return;
      const now = audioCtx.currentTime;
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
      entry.gain.gain.linearRampToValueAtTime(0, now + 0.05);
      entry.osc.stop(now + 0.06);
      activeOscs.delete(midi);
    },

    stopAll(): void {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      activeOscs.forEach((entry) => {
        try {
          entry.osc.stop(now);
        } catch (_) {
          /* already stopped */
        }
        entry.gain.disconnect();
      });
      activeOscs.clear();
    },

    destroy(): void {
      this.stopAll();
      if (ownAudioCtx && audioCtx && audioCtx.state !== "closed") {
        audioCtx.close();
      }
      audioCtx = null;
      outputNode = null;
      ownAudioCtx = true;
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
  const midi = createMidiEngine();
  const audio = createMidiAudio();
  const heldNotes: Set<number> = new Set();

  const root = document.createElement("div");
  root.className = "nbplay-midi-keyboard";
  root.innerHTML = `
    <div class="nbplay-midi-kb-header">
      <h3>nbplay</h3>
      <span class="nbplay-badge">midi keyboard</span>
    </div>
    <div class="nbplay-midi-kb-row">
      <span class="nbplay-midi-kb-label">Port</span>
      <select class="nbplay-midi-kb-select">
        <option value="">Not connected</option>
      </select>
      <button class="nbplay-midi-kb-refresh" title="Refresh MIDI ports">Refresh</button>
    </div>
    <div class="nbplay-midi-kb-row">
      <span class="nbplay-midi-kb-label">Status</span>
      <span class="nbplay-midi-kb-status">Idle</span>
    </div>
    <div class="nbplay-midi-kb-monitor">
      <span class="nbplay-midi-kb-last">No notes</span>
      <span class="nbplay-midi-kb-active">0 active</span>
    </div>
  `;
  el.appendChild(root);

  const portSelect = root.querySelector(
    ".nbplay-midi-kb-select",
  ) as HTMLSelectElement;
  const refreshBtn = root.querySelector(
    ".nbplay-midi-kb-refresh",
  ) as HTMLButtonElement;
  const statusEl = root.querySelector(
    ".nbplay-midi-kb-status",
  ) as HTMLSpanElement;
  const lastEl = root.querySelector(".nbplay-midi-kb-last") as HTMLSpanElement;
  const activeEl = root.querySelector(
    ".nbplay-midi-kb-active",
  ) as HTMLSpanElement;

  audio.setSession(
    model.get("session_id") as string,
    model.get("channel_index") as number,
  );

  function routeNoteOn(note: number, velocity: number): boolean {
    const sessionId = model.get("session_id") as string;
    const samplerRouting =
      (model.get("sampler_routing") as Array<{
        channel_index: number;
        zone: string;
      }>) || [];
    const zone = zoneForNote(note);
    const bus = getSessionBus(sessionId);
    let usedSampler = false;
    if (bus?.samplers) {
      for (const route of samplerRouting) {
        if (route.zone === "all" || route.zone === zone) {
          const sampler = bus.samplers[route.channel_index];
          if (sampler) {
            sampler.triggerNote(note, velocity);
            usedSampler = true;
          }
        }
      }
    }
    return usedSampler;
  }

  function routeNoteOff(note: number): boolean {
    const sessionId = model.get("session_id") as string;
    const samplerRouting =
      (model.get("sampler_routing") as Array<{
        channel_index: number;
        zone: string;
      }>) || [];
    const zone = zoneForNote(note);
    const bus = getSessionBus(sessionId);
    let usedSampler = false;
    if (bus?.samplers) {
      for (const route of samplerRouting) {
        if (route.zone === "all" || route.zone === zone) {
          const sampler = bus.samplers[route.channel_index];
          if (sampler) {
            sampler.releaseNote(note);
            usedSampler = true;
          }
        }
      }
    }
    return usedSampler;
  }

  function syncMonitor(): void {
    activeEl.textContent = `${heldNotes.size} active`;
    const evt = model.get("last_note_event") as NoteEvent | undefined;
    if (evt?.type === "on") {
      lastEl.textContent = `${noteName(evt.note)}  vel ${evt.velocity}`;
    } else if (evt?.type === "off") {
      lastEl.textContent = `${noteName(evt.note)}  off`;
    } else {
      lastEl.textContent = "No notes";
    }
  }

  function syncPortStatus(): void {
    const connected = !!model.get("midi_port");
    statusEl.textContent = connected ? "Connected" : "Idle";
    statusEl.classList.toggle("connected", connected);
  }

  function noteOn(note: number, velocity: number): void {
    if (note < 0 || note > 127) return;
    heldNotes.add(note);
    const sessionId = model.get("session_id") as string;
    if (!routeNoteOn(note, velocity)) {
      audio.noteOn(note, velocity);
    }
    const evt: NoteEvent = { note, velocity, type: "on" };
    broadcastNote(sessionId, evt);
    model.set("last_note_event", evt);
    model.set("active_notes", Array.from(heldNotes));
    model.save_changes();
    syncMonitor();
  }

  function noteOff(note: number): void {
    if (note < 0 || note > 127) return;
    heldNotes.delete(note);
    const sessionId = model.get("session_id") as string;
    if (!routeNoteOff(note)) {
      audio.noteOff(note);
    }
    const evt: NoteEvent = { note, velocity: 0, type: "off" };
    broadcastNote(sessionId, evt);
    model.set("last_note_event", evt);
    model.set("active_notes", Array.from(heldNotes));
    model.save_changes();
    syncMonitor();
  }

  function handleMidiData(data: Uint8Array): void {
    if (!data || data.length < 3) return;
    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];
    if (status === 0x90 && velocity > 0) {
      noteOn(note, velocity);
      return;
    }
    if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      noteOff(note);
    }
  }

  async function refreshPorts(): Promise<void> {
    const access = await midi.requestAccess();
    portSelect.innerHTML = '<option value="">Not connected</option>';
    if (access) {
      const ports = midi.getInputPorts();
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
    syncPortStatus();
  }

  portSelect.addEventListener("change", () => {
    const portId = portSelect.value;
    if (!portId) {
      midi.disconnectInput();
      model.set("midi_port", "");
      model.save_changes();
      syncPortStatus();
      return;
    }
    const port = midi.connectInput(portId, (data) => handleMidiData(data));
    model.set("midi_port", port ? port.name : portId);
    model.save_changes();
    syncPortStatus();
  });

  refreshBtn.addEventListener("click", () => {
    refreshPorts();
  });

  model.on("change:midi_port", syncPortStatus);
  model.on("change:last_note_event", syncMonitor);
  model.on("change:session_id", () => {
    audio.setSession(
      model.get("session_id") as string,
      model.get("channel_index") as number,
    );
  });
  model.on("change:channel_index", () => {
    audio.setSession(
      model.get("session_id") as string,
      model.get("channel_index") as number,
    );
  });

  syncPortStatus();
  syncMonitor();
  refreshPorts();

  const cancelDisconnect = onKernelDisconnect(model, () => {
    midi.disconnectInput();
    audio.destroy();
    heldNotes.clear();
    model.set("active_notes", []);
    syncMonitor();
  });

  return () => {
    cancelDisconnect();
    midi.disconnectInput();
    audio.destroy();
  };
}

export default { render };
