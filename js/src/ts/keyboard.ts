// nbplay KeyboardWidget – anywidget ESM frontend
// 4-row musical typing keyboard (Logic Pro style) with Web Audio playback

import { type AnyModel, onKernelDisconnect } from "./helpers.ts";
import {
  routeNoteOn,
  routeNoteOff,
  type KeyboardRoute,
  type SamplerBus,
} from "./routing.ts";

// Key mapping

// Semitone offsets from the base note (C of the octave)
const UPPER_NATURAL: Record<string, number> = {
  q: 0,
  w: 2,
  e: 4,
  r: 5,
  t: 7,
  y: 9,
  u: 11,
  i: 12,
  o: 14,
  p: 16,
};
const UPPER_SHARP: Record<string, number> = {
  "2": 1,
  "3": 3,
  "5": 6,
  "6": 8,
  "7": 10,
  "9": 13,
  "0": 15,
};
const LOWER_NATURAL: Record<string, number> = {
  z: 0,
  x: 2,
  c: 4,
  v: 5,
  b: 7,
  n: 9,
  m: 11,
  ",": 12,
  ".": 14,
};
const LOWER_SHARP: Record<string, number> = {
  a: 1,
  s: 3,
  f: 6,
  g: 8,
  h: 10,
  k: 13,
  l: 15,
};

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

function keyToNote(
  key: string,
  upperOctave: number,
  lowerOctave: number,
): { midi: number; zone: Zone } | null {
  const k = key.toLowerCase();
  if (k in UPPER_NATURAL) {
    return { midi: (upperOctave + 1) * 12 + UPPER_NATURAL[k], zone: "upper" };
  }
  if (k in UPPER_SHARP) {
    return { midi: (upperOctave + 1) * 12 + UPPER_SHARP[k], zone: "upper" };
  }
  if (k in LOWER_NATURAL) {
    return { midi: (lowerOctave + 1) * 12 + LOWER_NATURAL[k], zone: "lower" };
  }
  if (k in LOWER_SHARP) {
    return { midi: (lowerOctave + 1) * 12 + LOWER_SHARP[k], zone: "lower" };
  }
  return null;
}

// Session bus helpers

interface NbplayBus {
  audioCtx: AudioContext;
  channels: { gain: AudioNode }[];
  noteListeners?: Array<(evt: NoteEvent) => void>;
  samplers?: Record<number, SamplerBus>;
}

interface NoteEvent {
  note: number;
  velocity: number;
  type: "on" | "off";
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
  // Broadcast via document CustomEvent so sequencers/samplers
  // can receive notes without requiring a shared session bus.
  document.dispatchEvent(new CustomEvent("nbplay-note", { detail: evt }));
}

// Audio engine

function createKeyboardAudio() {
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
      if (!audioCtx) return;
      if (activeOscs.has(midi)) return; // already playing

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

// Key layout data for rendering

interface KeyDef {
  key: string;
  semitone: number;
  isBlack: boolean;
}

const UPPER_ROW_1: KeyDef[] = [
  { key: "2", semitone: 1, isBlack: true },
  { key: "3", semitone: 3, isBlack: true },
  { key: "", semitone: -1, isBlack: false }, // gap
  { key: "5", semitone: 6, isBlack: true },
  { key: "6", semitone: 8, isBlack: true },
  { key: "7", semitone: 10, isBlack: true },
  { key: "", semitone: -1, isBlack: false }, // gap
  { key: "9", semitone: 13, isBlack: true },
  { key: "0", semitone: 15, isBlack: true },
];

const UPPER_ROW_2: KeyDef[] = [
  { key: "Q", semitone: 0, isBlack: false },
  { key: "W", semitone: 2, isBlack: false },
  { key: "E", semitone: 4, isBlack: false },
  { key: "R", semitone: 5, isBlack: false },
  { key: "T", semitone: 7, isBlack: false },
  { key: "Y", semitone: 9, isBlack: false },
  { key: "U", semitone: 11, isBlack: false },
  { key: "I", semitone: 12, isBlack: false },
  { key: "O", semitone: 14, isBlack: false },
  { key: "P", semitone: 16, isBlack: false },
];

const LOWER_ROW_3: KeyDef[] = [
  { key: "A", semitone: 1, isBlack: true },
  { key: "S", semitone: 3, isBlack: true },
  { key: "", semitone: -1, isBlack: false }, // gap
  { key: "F", semitone: 6, isBlack: true },
  { key: "G", semitone: 8, isBlack: true },
  { key: "H", semitone: 10, isBlack: true },
  { key: "", semitone: -1, isBlack: false }, // gap
  { key: "K", semitone: 13, isBlack: true },
  { key: "L", semitone: 15, isBlack: true },
];

const LOWER_ROW_4: KeyDef[] = [
  { key: "Z", semitone: 0, isBlack: false },
  { key: "X", semitone: 2, isBlack: false },
  { key: "C", semitone: 4, isBlack: false },
  { key: "V", semitone: 5, isBlack: false },
  { key: "B", semitone: 7, isBlack: false },
  { key: "N", semitone: 9, isBlack: false },
  { key: "M", semitone: 11, isBlack: false },
  { key: ",", semitone: 12, isBlack: false },
  { key: ".", semitone: 14, isBlack: false },
];

// Widget render

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const audio = createKeyboardAudio();

  const root = document.createElement("div");
  root.className = "nbplay-keyboard";
  root.tabIndex = 0;
  root.innerHTML = `
    <div class="nbplay-kb-header">
      <h3>nbplay</h3>
      <span class="nbplay-badge">keyboard</span>
    </div>
    <div class="nbplay-kb-info">
      <span class="nbplay-kb-oct-upper">Oct 3</span>
      <span class="nbplay-kb-vel">Vel: 100</span>
      <span class="nbplay-kb-oct-lower">Oct 4</span>
    </div>
    <div class="nbplay-kb-vel-bar-wrap">
      <div class="nbplay-kb-vel-bar"></div>
    </div>
    <div class="nbplay-kb-sustain-row">
      <span class="nbplay-kb-sustain-upper" title="Upper sustain (\`)">SUS ↑</span>
      <span class="nbplay-kb-sustain-global" title="Global sustain (Space)">SUS</span>
      <span class="nbplay-kb-sustain-lower" title="Lower sustain (/)">SUS ↓</span>
    </div>
    <div class="nbplay-kb-section nbplay-kb-upper">
      <div class="nbplay-kb-section-label"><span>UPPER</span><span class="nbplay-kb-oct-ctrl">[ ]</span></div>
      <div class="nbplay-kb-row nbplay-kb-row-sharp" data-zone="upper-sharp"></div>
      <div class="nbplay-kb-row nbplay-kb-row-natural" data-zone="upper-natural"></div>
    </div>
    <div class="nbplay-kb-section nbplay-kb-lower">
      <div class="nbplay-kb-section-label"><span>LOWER</span><span class="nbplay-kb-oct-ctrl">; '</span></div>
      <div class="nbplay-kb-row nbplay-kb-row-sharp" data-zone="lower-sharp"></div>
      <div class="nbplay-kb-row nbplay-kb-row-natural" data-zone="lower-natural"></div>
    </div>
    <div class="nbplay-kb-controls">
      <span class="nbplay-kb-ctrl-label">- = vel</span>
      <span class="nbplay-kb-ctrl-label">\` sus↑</span>
      <span class="nbplay-kb-ctrl-label">/ sus↓</span>
      <span class="nbplay-kb-ctrl-label">⎵ sus all</span>
    </div>
  `;
  el.appendChild(root);

  const octUpperEl = root.querySelector(
    ".nbplay-kb-oct-upper",
  )! as HTMLSpanElement;
  const octLowerEl = root.querySelector(
    ".nbplay-kb-oct-lower",
  )! as HTMLSpanElement;
  const velEl = root.querySelector(".nbplay-kb-vel")! as HTMLSpanElement;
  const velBar = root.querySelector(".nbplay-kb-vel-bar")! as HTMLDivElement;
  const susUpperEl = root.querySelector(
    ".nbplay-kb-sustain-upper",
  )! as HTMLSpanElement;
  const susLowerEl = root.querySelector(
    ".nbplay-kb-sustain-lower",
  )! as HTMLSpanElement;
  const susGlobalEl = root.querySelector(
    ".nbplay-kb-sustain-global",
  )! as HTMLSpanElement;

  const upperSharpRow = root.querySelector(
    '[data-zone="upper-sharp"]',
  )! as HTMLDivElement;
  const upperNatRow = root.querySelector(
    '[data-zone="upper-natural"]',
  )! as HTMLDivElement;
  const lowerSharpRow = root.querySelector(
    '[data-zone="lower-sharp"]',
  )! as HTMLDivElement;
  const lowerNatRow = root.querySelector(
    '[data-zone="lower-natural"]',
  )! as HTMLDivElement;

  // Set up session audio routing
  const sid = model.get("session_id") as string;
  const chIdx = model.get("channel_index") as number;
  if (sid) {
    audio.setSession(sid, chIdx);
  }

  // Build keyboard rows

  const keyElements: Map<string, HTMLDivElement> = new Map();
  const activePointerNotes: Map<number, { midi: number; zone: Zone }> =
    new Map();

  function releasePointerNote(pointerId: number): void {
    const active = activePointerNotes.get(pointerId);
    if (!active) return;
    activePointerNotes.delete(pointerId);
    handleNoteOff(active.midi, active.zone);
  }

  function releasePointerCapture(el: HTMLElement, pointerId: number): void {
    try {
      if (el.hasPointerCapture(pointerId)) {
        el.releasePointerCapture(pointerId);
      }
    } catch (_) {
      /* pointer capture may already be gone */
    }
  }

  function capturePointer(el: HTMLElement, pointerId: number): void {
    try {
      el.setPointerCapture(pointerId);
    } catch (_) {
      /* synthetic tests may not have a capturable pointer */
    }
  }

  function buildRow(
    container: HTMLDivElement,
    defs: KeyDef[],
    zone: Zone,
  ): void {
    container.innerHTML = "";
    const octave =
      zone === "upper"
        ? (model.get("upper_octave") as number)
        : (model.get("lower_octave") as number);

    for (const def of defs) {
      const keyEl = document.createElement("div");
      if (def.key === "") {
        keyEl.className = "nbplay-kb-key-gap";
        container.appendChild(keyEl);
        continue;
      }
      keyEl.className =
        "nbplay-kb-key" +
        (def.isBlack ? " nbplay-kb-black" : " nbplay-kb-white");
      keyEl.dataset.keyLabel = def.key.toLowerCase();

      const midi = (octave + 1) * 12 + def.semitone;
      const label = document.createElement("span");
      label.className = "nbplay-kb-key-label";
      label.textContent = def.key;
      const note = document.createElement("span");
      note.className = "nbplay-kb-key-note";
      note.textContent = noteName(midi);
      keyEl.appendChild(label);
      keyEl.appendChild(note);

      keyEl.addEventListener("pointerdown", (e: PointerEvent) => {
        e.preventDefault();
        root.focus();
        if (activePointerNotes.has(e.pointerId)) {
          releasePointerNote(e.pointerId);
        }
        activePointerNotes.set(e.pointerId, { midi, zone });
        capturePointer(keyEl, e.pointerId);
        handleNoteOn(midi, zone);
      });
      keyEl.addEventListener("pointerup", (e: PointerEvent) => {
        releasePointerNote(e.pointerId);
        releasePointerCapture(keyEl, e.pointerId);
      });
      keyEl.addEventListener("pointercancel", (e: PointerEvent) => {
        releasePointerNote(e.pointerId);
        releasePointerCapture(keyEl, e.pointerId);
      });
      keyEl.addEventListener("lostpointercapture", (e: PointerEvent) => {
        releasePointerNote(e.pointerId);
      });

      container.appendChild(keyEl);
      keyElements.set(def.key.toLowerCase(), keyEl);
    }
  }

  function rebuildKeys(): void {
    keyElements.clear();
    buildRow(upperSharpRow, UPPER_ROW_1, "upper");
    buildRow(upperNatRow, UPPER_ROW_2, "upper");
    buildRow(lowerSharpRow, LOWER_ROW_3, "lower");
    buildRow(lowerNatRow, LOWER_ROW_4, "lower");
  }

  // Note handling

  const heldNotes: Set<number> = new Set();
  const sustainedNotes: Map<number, Zone> = new Map(); // notes held by sustain

  function handleNoteOn(midi: number, zone: Zone): void {
    if (midi < 0 || midi > 127) return;
    const vel = model.get("velocity") as number;
    heldNotes.add(midi);

    // Play audio — check samplers first, fall back to built-in oscillator
    const routes = (model.get("sampler_routing") as KeyboardRoute[]) || [];
    const sessionId = model.get("session_id") as string;
    const usedSampler = routeNoteOn(sessionId, routes, midi, zone, vel);

    if (!usedSampler) {
      audio.noteOn(midi, vel);
    }

    // Broadcast on session bus
    broadcastNote(sessionId, { note: midi, velocity: vel, type: "on" });

    // Update model
    model.set("last_note_event", { note: midi, velocity: vel, type: "on" });
    model.set("active_notes", Array.from(heldNotes));
    model.save_changes();

    // Visual feedback
    highlightKeys();
  }

  function handleNoteOff(midi: number, zone: Zone): void {
    heldNotes.delete(midi);

    // Check sustains
    const susUpper = model.get("sustain_upper") as boolean;
    const susLower = model.get("sustain_lower") as boolean;
    const susGlobal = model.get("sustain_global") as boolean;
    const isSustained =
      susGlobal ||
      (zone === "upper" && susUpper) ||
      (zone === "lower" && susLower);

    if (isSustained) {
      sustainedNotes.set(midi, zone);
      return; // don't release — sustain is active
    }

    releaseNote(midi, zone);
  }

  function releaseNote(midi: number, zone: Zone): void {
    const routes = (model.get("sampler_routing") as KeyboardRoute[]) || [];
    const sessionId = model.get("session_id") as string;
    const usedSampler = routeNoteOff(sessionId, routes, midi, zone);

    if (!usedSampler) {
      audio.noteOff(midi);
    }

    broadcastNote(sessionId, { note: midi, velocity: 0, type: "off" });

    model.set("last_note_event", { note: midi, velocity: 0, type: "off" });
    model.set("active_notes", Array.from(heldNotes));
    model.save_changes();

    sustainedNotes.delete(midi);
    highlightKeys();
  }

  function releaseSustainedNotes(zone: Zone | "all"): void {
    const toRelease: Array<[number, Zone]> = [];
    sustainedNotes.forEach((z, midi) => {
      if (zone === "all" || z === zone) {
        if (!heldNotes.has(midi)) {
          toRelease.push([midi, z]);
        }
      }
    });
    for (const [midi, z] of toRelease) {
      releaseNote(midi, z);
    }
  }

  function releaseHeldNotesInZone(zone: Zone): void {
    const toRelease: Array<[string, number, Zone]> = [];
    pressedKeys.forEach(({ midi, zone: z }, key) => {
      if (z === zone) {
        toRelease.push([key, midi, z]);
      }
    });
    for (const [key, midi, z] of toRelease) {
      pressedKeys.delete(key);
      handleNoteOff(midi, z);
    }
  }

  // Visual feedback

  function highlightKeys(): void {
    keyElements.forEach((el, key) => {
      const result = keyToNote(
        key,
        model.get("upper_octave") as number,
        model.get("lower_octave") as number,
      );
      if (result) {
        el.classList.toggle(
          "pressed",
          heldNotes.has(result.midi) || sustainedNotes.has(result.midi),
        );
      }
    });
  }

  function syncInfo(): void {
    const uOct = model.get("upper_octave") as number;
    const lOct = model.get("lower_octave") as number;
    const vel = model.get("velocity") as number;
    octUpperEl.textContent = "Oct " + uOct;
    octLowerEl.textContent = "Oct " + lOct;
    velEl.textContent = "Vel: " + vel;
    velBar.style.width = (vel / 127) * 100 + "%";

    susUpperEl.classList.toggle(
      "active",
      model.get("sustain_upper") as boolean,
    );
    susLowerEl.classList.toggle(
      "active",
      model.get("sustain_lower") as boolean,
    );
    susGlobalEl.classList.toggle(
      "active",
      model.get("sustain_global") as boolean,
    );
  }

  // Velocity acceleration

  let velRepeatTimer: ReturnType<typeof setInterval> | null = null;
  let velRepeatCount = 0;

  function startVelRepeat(delta: number): void {
    if (velRepeatTimer) return;
    velRepeatCount = 0;
    velRepeatTimer = setInterval(() => {
      velRepeatCount++;
      const step = velRepeatCount > 10 ? 5 : 1;
      const vel = model.get("velocity") as number;
      const newVel = Math.max(0, Math.min(127, vel + delta * step));
      model.set("velocity", newVel);
      model.save_changes();
      syncInfo();
    }, 80);
  }

  function stopVelRepeat(): void {
    if (velRepeatTimer) {
      clearInterval(velRepeatTimer);
      velRepeatTimer = null;
      velRepeatCount = 0;
    }
  }

  // Keyboard event handling

  const pressedKeys: Map<string, { midi: number; zone: Zone }> = new Map();

  function isKeyboardActive(): boolean {
    // Process keys when our root is focused, or when an nbplay
    // sequencer with a pending ♪? edit or active recording has focus.
    const ae = document.activeElement;
    if (!ae) return false;
    // Never capture keys when an input, textarea, or contentEditable
    // element has focus — the user is editing text somewhere.
    const tag = (ae as HTMLElement).tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      (ae as HTMLElement).isContentEditable
    ) {
      return false;
    }
    if (root.contains(ae) || ae === root) return true;
    // Check if the focused element is inside an nbplay sequencer that
    // has a pending "♪?" edit or is actively recording.
    const seq = ae.closest(".nbplay-sequencer") as HTMLElement | null;
    if (seq) {
      if (seq.querySelector(".nbplay-seq-key-wait")) return true;
      if (seq.querySelector(".nbplay-seq-rec.recording")) return true;
    }
    return false;
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (!isKeyboardActive()) return;

    const key = e.key;
    const lower = key.toLowerCase();

    // Escape: cancel any pending sequencer ♪? edit
    if (key === "Escape") {
      const ae = document.activeElement;
      if (
        ae &&
        ae.classList.contains("nbplay-sequencer") &&
        ae.querySelector(".nbplay-seq-key-wait")
      ) {
        e.preventDefault();
        e.stopPropagation();
        ae.dispatchEvent(new CustomEvent("nbplay-cancel-edit"));
      }
      return;
    }

    // Prevent key repeat — but don't block unhandled keys
    if (pressedKeys.has(lower)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Octave shift keys
    if (key === "[") {
      e.preventDefault();
      e.stopPropagation();
      releaseHeldNotesInZone("upper");
      const oct = Math.max(-1, (model.get("upper_octave") as number) - 1);
      model.set("upper_octave", oct);
      model.save_changes();
      syncInfo();
      rebuildKeys();
      return;
    }
    if (key === "]") {
      e.preventDefault();
      e.stopPropagation();
      releaseHeldNotesInZone("upper");
      const oct = Math.min(8, (model.get("upper_octave") as number) + 1);
      model.set("upper_octave", oct);
      model.save_changes();
      syncInfo();
      rebuildKeys();
      return;
    }
    if (key === ";") {
      e.preventDefault();
      e.stopPropagation();
      releaseHeldNotesInZone("lower");
      const oct = Math.max(-1, (model.get("lower_octave") as number) - 1);
      model.set("lower_octave", oct);
      model.save_changes();
      syncInfo();
      rebuildKeys();
      return;
    }
    if (key === "'") {
      e.preventDefault();
      e.stopPropagation();
      releaseHeldNotesInZone("lower");
      const oct = Math.min(8, (model.get("lower_octave") as number) + 1);
      model.set("lower_octave", oct);
      model.save_changes();
      syncInfo();
      rebuildKeys();
      return;
    }

    // Velocity keys
    if (key === "-") {
      e.preventDefault();
      e.stopPropagation();
      const vel = Math.max(0, (model.get("velocity") as number) - 1);
      model.set("velocity", vel);
      model.save_changes();
      syncInfo();
      startVelRepeat(-1);
      return;
    }
    if (key === "=") {
      e.preventDefault();
      e.stopPropagation();
      const vel = Math.min(127, (model.get("velocity") as number) + 1);
      model.set("velocity", vel);
      model.save_changes();
      syncInfo();
      startVelRepeat(1);
      return;
    }

    // Sustain keys
    if (key === "`") {
      e.preventDefault();
      e.stopPropagation();
      model.set("sustain_upper", true);
      model.save_changes();
      syncInfo();
      return;
    }
    if (key === "/") {
      e.preventDefault();
      e.stopPropagation();
      model.set("sustain_lower", true);
      model.save_changes();
      syncInfo();
      return;
    }
    if (key === " ") {
      e.preventDefault();
      e.stopPropagation();
      model.set("sustain_global", true);
      model.save_changes();
      syncInfo();
      return;
    }

    // Note keys
    const result = keyToNote(
      lower,
      model.get("upper_octave") as number,
      model.get("lower_octave") as number,
    );
    if (result) {
      e.preventDefault();
      e.stopPropagation();
      pressedKeys.set(lower, { midi: result.midi, zone: result.zone });
      handleNoteOn(result.midi, result.zone);
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (!isKeyboardActive()) {
      // Still release any notes held from before focus loss
      const lower = e.key.toLowerCase();
      const held = pressedKeys.get(lower);
      if (held) {
        pressedKeys.delete(lower);
        handleNoteOff(held.midi, held.zone);
      }
      return;
    }

    const key = e.key;
    const lower = key.toLowerCase();
    const held = pressedKeys.get(lower);
    pressedKeys.delete(lower);

    // Velocity key release
    if (key === "-" || key === "=") {
      e.preventDefault();
      e.stopPropagation();
      stopVelRepeat();
      return;
    }

    // Sustain release
    if (key === "`") {
      e.preventDefault();
      e.stopPropagation();
      model.set("sustain_upper", false);
      model.save_changes();
      syncInfo();
      releaseSustainedNotes("upper");
      return;
    }
    if (key === "/") {
      e.preventDefault();
      e.stopPropagation();
      model.set("sustain_lower", false);
      model.save_changes();
      syncInfo();
      releaseSustainedNotes("lower");
      return;
    }
    if (key === " ") {
      e.preventDefault();
      e.stopPropagation();
      model.set("sustain_global", false);
      model.save_changes();
      syncInfo();
      releaseSustainedNotes("all");
      return;
    }

    // Note keys — release the note that was actually started, not recomputed
    if (held) {
      e.preventDefault();
      e.stopPropagation();
      handleNoteOff(held.midi, held.zone);
    }
  }

  // Use window-level capture to intercept keys BEFORE JupyterLab/Lumino's
  // document-level capture handlers, preventing notebook shortcuts (e.g.
  // "a" = add cell) from firing when the keyboard widget is active.
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);

  // Model change listeners
  model.on("change:upper_octave", () => {
    syncInfo();
    rebuildKeys();
  });
  model.on("change:lower_octave", () => {
    syncInfo();
    rebuildKeys();
  });
  model.on("change:velocity", syncInfo);
  model.on("change:session_id", () => {
    audio.setSession(
      model.get("session_id") as string,
      model.get("channel_index") as number,
    );
  });

  // Focus the widget on click
  root.addEventListener("click", () => root.focus());

  // Release all held notes on blur so the keyboard stops playing
  // when the user clicks away or another element gains focus.
  root.addEventListener("blur", () => {
    // Release all held notes
    for (const { midi, zone } of pressedKeys.values()) {
      handleNoteOff(midi, zone);
    }
    pressedKeys.clear();
    // Also release any sustained notes
    const allSustained: Array<[number, Zone]> = [];
    sustainedNotes.forEach((z, m) => allSustained.push([m, z]));
    for (const [m, z] of allSustained) {
      releaseNote(m, z);
    }
    heldNotes.clear();
    highlightKeys();
  });

  // Initial render
  syncInfo();
  rebuildKeys();

  // Stop on kernel disconnect
  const cancelDisconnect = onKernelDisconnect(model, () => {
    audio.destroy();
  });

  return () => {
    stopVelRepeat();
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    cancelDisconnect();
    audio.destroy();
  };
}

export default { render };
