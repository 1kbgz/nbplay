// nbplay MidiKeyboardWidget - browser Web MIDI note input
// External MIDI keyboard input with sampler routing and velocity.

import {
  type AnyModel,
  createAudioContext,
  onKernelDisconnect,
} from "./helpers.ts";
import { routeNoteOn, routeNoteOff, type KeyboardRoute } from "./routing.ts";
import { bindClock, getSessionBus, type NoteEvent } from "./session.ts";

const MIDI_CLOCK = 0xf8;
const MIDI_START = 0xfa;
const MIDI_CONTINUE = 0xfb;
const MIDI_STOP = 0xfc;
const MIDI_SONG_POSITION = 0xf2;
const TICKS_PER_BEAT = 24;

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

interface MidiPortInfo {
  id: string;
  name: string;
  state: string;
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
      if (bus?.audioCtx && channelIndex >= 0 && bus.channels?.[channelIndex]) {
        audioCtx = bus.audioCtx;
        outputNode = bus.channels[channelIndex].gain;
        ownAudioCtx = false;
        return;
      }
      if (!audioCtx) {
        audioCtx = createAudioContext();
        if (audioCtx) ownAudioCtx = true;
      }
    },

    ensureCtx(): void {
      if (!audioCtx) {
        audioCtx = createAudioContext();
        if (audioCtx) ownAudioCtx = true;
      }
      if (!audioCtx) return;
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
    <div class="nbplay-midi-kb-row">
      <span class="nbplay-midi-kb-label">Clock</span>
      <label class="nbplay-midi-kb-clock-label">
        <input type="checkbox" class="nbplay-midi-kb-clock-input" /> Follow device clock
      </label>
      <span class="nbplay-midi-kb-clock">\u2014</span>
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
  const clockInput = root.querySelector(
    ".nbplay-midi-kb-clock-input",
  ) as HTMLInputElement;
  const clockEl = root.querySelector(
    ".nbplay-midi-kb-clock",
  ) as HTMLSpanElement;
  const activeEl = root.querySelector(
    ".nbplay-midi-kb-active",
  ) as HTMLSpanElement;

  audio.setSession(
    model.get("session_id") as string,
    model.get("channel_index") as number,
  );

  function handleNoteRoutes(note: number, velocity: number): boolean {
    const routes = (model.get("sampler_routing") as KeyboardRoute[]) || [];
    const sessionId = model.get("session_id") as string;
    return routeNoteOn(sessionId, routes, note, zoneForNote(note), velocity);
  }

  function handleNoteOffRoutes(note: number): boolean {
    const routes = (model.get("sampler_routing") as KeyboardRoute[]) || [];
    const sessionId = model.get("session_id") as string;
    return routeNoteOff(sessionId, routes, note, zoneForNote(note));
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
    if (!handleNoteRoutes(note, velocity)) {
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
    if (!handleNoteOffRoutes(note)) {
      audio.noteOff(note);
    }
    const evt: NoteEvent = { note, velocity: 0, type: "off" };
    broadcastNote(sessionId, evt);
    model.set("last_note_event", evt);
    model.set("active_notes", Array.from(heldNotes));
    model.save_changes();
    syncMonitor();
  }

  let ccSeq = 0;

  function controlChange(controller: number, value: number, channel: number) {
    ccSeq += 1;
    model.set("control_change", { controller, value, channel, seq: ccSeq });
    model.save_changes();
    lastEl.textContent = `CC ${controller}  ${value}`;
  }

  // MIDI clock follower: the device's transport drives the session clock
  // and the tick rate sets its tempo.
  const binding = bindClock(
    model,
    () => {},
    () => {},
  );
  let tickTimes: number[] = [];
  let tickCount = 0;
  let baseBeat = 0;

  function syncsClock(): boolean {
    return Boolean(model.get("sync_clock"));
  }

  function syncClockDisplay(): void {
    clockInput.checked = syncsClock();
    const bpm = Number(model.get("clock_bpm")) || 0;
    clockEl.textContent = bpm > 0 ? `${bpm.toFixed(1)} BPM` : "\u2014";
  }

  function handleClockTick(timestamp: number): void {
    const clk = binding.clock();
    tickTimes.push(timestamp);
    if (tickTimes.length > TICKS_PER_BEAT + 1) tickTimes.shift();
    tickCount += 1;
    if (tickTimes.length === TICKS_PER_BEAT + 1) {
      const seconds = (tickTimes[TICKS_PER_BEAT] - tickTimes[0]) / 1000;
      if (seconds > 0) {
        const bpm = Math.round((60 / seconds) * 10) / 10;
        if (Math.abs(bpm - clk.bpm) > 0.5) clk.setTempo(bpm);
        if (Math.abs(bpm - (Number(model.get("clock_bpm")) || 0)) > 0.05) {
          model.set("clock_bpm", bpm);
          model.save_changes();
          syncClockDisplay();
        }
      }
    }
    // Pull the session back onto the device's beat grid once per beat.
    if (tickCount % TICKS_PER_BEAT === 0 && clk.playing && !clk.loop.enabled) {
      const expected = baseBeat + tickCount / TICKS_PER_BEAT;
      if (Math.abs(clk.beat() - expected) > 0.05) clk.seek(expected);
    }
  }

  function handleRealtime(status: number, timestamp: number): void {
    if (!syncsClock()) return;
    const clk = binding.clock();
    if (status === MIDI_CLOCK) {
      handleClockTick(timestamp);
    } else if (status === MIDI_START) {
      tickTimes = [];
      tickCount = 0;
      baseBeat = 0;
      clk.seek(0);
      clk.play();
    } else if (status === MIDI_CONTINUE) {
      tickTimes = [];
      tickCount = 0;
      baseBeat = clk.beat();
      clk.play();
    } else if (status === MIDI_STOP) {
      tickTimes = [];
      clk.stop();
    }
  }

  function handleSongPosition(sixteenths: number): void {
    if (!syncsClock()) return;
    const beat = sixteenths / 4;
    tickCount = 0;
    baseBeat = beat;
    binding.clock().seek(beat);
  }

  function handleMidiData(
    data: Uint8Array,
    timestamp = performance.now(),
  ): void {
    if (!data || data.length === 0) return;
    if (data[0] >= MIDI_CLOCK) {
      handleRealtime(data[0], timestamp);
      return;
    }
    if (data[0] === MIDI_SONG_POSITION && data.length >= 3) {
      handleSongPosition((data[1] & 0x7f) | ((data[2] & 0x7f) << 7));
      return;
    }
    if (data.length < 3) return;
    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];
    if (status === 0xb0) {
      controlChange(note, velocity, data[0] & 0x0f);
      return;
    }
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
    const port = midi.connectInput(portId, (data, timestamp) =>
      handleMidiData(data, timestamp),
    );
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
  model.on("change:sync_clock", syncClockDisplay);
  model.on("change:clock_bpm", syncClockDisplay);
  clockInput.addEventListener("change", () => {
    model.set("sync_clock", clockInput.checked);
    model.save_changes();
  });

  syncPortStatus();
  syncMonitor();
  syncClockDisplay();
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
    binding.dispose();
  };
}

export default { render };
