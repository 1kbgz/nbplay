// nbplay SamplerWidget – anywidget ESM frontend
// Sampler panel with waveform display, ADSR envelope, trigger pads,
// and Web Audio playback with pitch shifting.

import {
  type AnyModel,
  createAudioContext,
  cssVar,
  makeEditable,
  onKernelDisconnect,
  toFloat32,
} from "./helpers.ts";
import {
  clampVelocity,
  normalizePadActions,
  noteName,
  padActionLabel,
  parseNoteName,
  resizePadNotes,
  resizePadVelocities,
  type PadAction,
} from "./pads.ts";
import { getSessionBus } from "./session.ts";

// Types

interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface Voice {
  gainNode: GainNode;
  sourceNode: AudioBufferSourceNode;
  noteNum: number;
  startTime: number;
  releaseTime: number | null;
}

interface SampleSlice {
  index: number;
  note: number;
  start: number;
  end: number;
  label?: string;
}

/** A multi-sample zone: its own PCM answering to a note and velocity range. */
interface Zone {
  id: string;
  name: string;
  note_low: number;
  note_high: number;
  velocity_low: number;
  velocity_high: number;
  root_note: number;
  sample_rate: number;
  samples: Float32Array;
}

interface ZoneBuffer extends Zone {
  buffer: AudioBuffer | null;
}

const ZONE_COLORS = [
  "#00d4ff",
  "#f97316",
  "#a78bfa",
  "#22c55e",
  "#f43f5e",
  "#eab308",
];

function clampNote(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n)
    ? Math.max(0, Math.min(127, Math.round(n)))
    : fallback;
}

function zoneMatches(zone: Zone, note: number, velocity: number): boolean {
  return (
    note >= zone.note_low &&
    note <= zone.note_high &&
    velocity >= zone.velocity_low &&
    velocity <= zone.velocity_high
  );
}

// Waveform renderer

function drawWaveform(
  canvas: HTMLCanvasElement,
  samples: Float32Array | null,
): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 500;
  const h = canvas.clientHeight || 100;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const bg = cssVar(canvas, "--jp-layout-color1", "#14142a");
  const brand = cssVar(canvas, "--jp-brand-color1", "#00d4ff");
  const dim = cssVar(canvas, "--jp-ui-font-color3", "#64648a");
  const border = cssVar(canvas, "--jp-border-color1", "#1e1e3a");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (!samples || samples.length === 0) {
    ctx.fillStyle = dim;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("No sample loaded", w / 2, h / 2 + 4);
    return;
  }

  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  ctx.strokeStyle = brand;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const step = samples.length / w;
  for (let px = 0; px < w; px++) {
    const idx = Math.floor(px * step);
    const y = ((1 - samples[idx]) * h) / 2;
    if (px === 0) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }
  ctx.stroke();
}

// ADSR envelope visualisation

function drawEnvelope(
  canvas: HTMLCanvasElement,
  a: number,
  d: number,
  s: number,
  r: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 200;
  const h = canvas.clientHeight || 60;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const bg = cssVar(canvas, "--jp-layout-color1", "#14142a");
  const accent = cssVar(canvas, "--jp-brand-color0", "#7c3aed");
  const dim = cssVar(canvas, "--jp-ui-font-color3", "#64648a");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const total = a + d + 0.3 + r;
  const pad = 4;
  const plotW = w - pad * 2;
  const plotH = h - pad * 2;

  const ax = pad;
  const ay = pad + plotH;
  const bx = pad + (a / total) * plotW;
  const by = pad;
  const cx = bx + (d / total) * plotW;
  const cy = pad + (1 - s) * plotH;
  const dx = cx + (0.3 / total) * plotW;
  const dy = cy;
  const ex = dx + (r / total) * plotW;
  const ey = pad + plotH;

  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.lineTo(dx, dy);
  ctx.lineTo(ex, ey);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.lineTo(dx, dy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  ctx.fillStyle = dim;
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("A", (ax + bx) / 2, h - 1);
  ctx.fillText("D", (bx + cx) / 2, h - 1);
  ctx.fillText("S", (cx + dx) / 2, h - 1);
  ctx.fillText("R", (dx + ex) / 2, h - 1);
}

function decimateSamples(
  samples: Float32Array,
  maxPoints = 2048,
): Float32Array {
  if (samples.length <= maxPoints) return samples.slice();
  const out = new Float32Array(maxPoints);
  const step = samples.length / maxPoints;
  for (let i = 0; i < maxPoints; i++) {
    out[i] = samples[Math.floor(i * step)];
  }
  return out;
}

function float32ToDataView(samples: Float32Array): DataView {
  const buffer = new ArrayBuffer(samples.length * 4);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    view.setFloat32(i * 4, samples[i], true);
  }
  return view;
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const samples = new Float32Array(buffer.length);
  const channels = Math.max(1, buffer.numberOfChannels);
  for (let ch = 0; ch < channels; ch++) {
    const channel = buffer.getChannelData(ch);
    for (let i = 0; i < samples.length; i++) {
      samples[i] += channel[i] / channels;
    }
  }
  return samples;
}

// Web Audio Sampler Engine

function createSamplerEngine(maxVoices = 8) {
  let audioCtx: AudioContext | null = null;
  let outputNode: AudioNode | null = null;
  let ownAudioCtx = true;
  const activeVoices: Voice[] = [];
  let waveformBuffer: AudioBuffer | null = null;
  let rawSamples: Float32Array | null = null;
  let rawSampleRate = 44100;
  let zones: ZoneBuffer[] = [];

  function ensureBuffer(): boolean {
    if (!audioCtx || !rawSamples || rawSamples.length === 0) return false;
    if (waveformBuffer) return true;
    waveformBuffer = audioCtx.createBuffer(1, rawSamples.length, rawSampleRate);
    const ch = waveformBuffer.getChannelData(0);
    for (let i = 0; i < rawSamples.length; i++) ch[i] = rawSamples[i];
    return true;
  }

  function ensureZoneBuffer(zone: ZoneBuffer): AudioBuffer | null {
    if (!audioCtx || zone.samples.length === 0) return null;
    if (!zone.buffer) {
      zone.buffer = audioCtx.createBuffer(
        1,
        zone.samples.length,
        zone.sample_rate,
      );
      zone.buffer.getChannelData(0).set(zone.samples);
    }
    return zone.buffer;
  }

  return {
    setSession(model: AnyModel): void {
      const sid = model.get("session_id") as string;
      const idx = model.get("channel_index") as number;
      if (sid && idx >= 0) {
        const bus = getSessionBus(sid);
        if (bus?.audioCtx && bus.channels?.[idx]) {
          if (audioCtx !== bus.audioCtx) {
            waveformBuffer = null;
            zones.forEach((zone) => (zone.buffer = null));
          }
          audioCtx = bus.audioCtx;
          outputNode = bus.channels[idx].gain;
          ownAudioCtx = false;
          return;
        }
      }
    },

    setWaveformData(samples: Float32Array, sampleRate: number): void {
      if (!samples || samples.length === 0) return;
      rawSamples = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) rawSamples[i] = samples[i];
      rawSampleRate = sampleRate;
      waveformBuffer = null;
      if (!audioCtx) {
        audioCtx = createAudioContext({ sampleRate });
        if (audioCtx) ownAudioCtx = true;
      }
    },

    setZones(list: Zone[]): void {
      zones = list.map((zone) => ({ ...zone, buffer: null }));
      if (!audioCtx && zones.length > 0) {
        audioCtx = createAudioContext();
        if (audioCtx) ownAudioCtx = true;
      }
    },

    zoneFor(note: number, velocity: number): Zone | undefined {
      return zones.find((zone) => zoneMatches(zone, note, velocity));
    },

    noteOn(
      noteNum: number,
      rootNote: number,
      envelope: Envelope,
      velocity = 127,
      slice?: { start: number; end: number },
    ): Voice | undefined {
      // A matching zone plays its own one-shot sample; otherwise the main sample.
      const zone = zones.find((z) =>
        zoneMatches(z, noteNum, clampVelocity(velocity, 127)),
      );
      const zoneBuffer = zone ? ensureZoneBuffer(zone) : null;
      if (!audioCtx || (!zoneBuffer && !ensureBuffer())) return;
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const semitones = noteNum - (zone ? zone.root_note : rootNote);
      const playbackRate = Math.pow(2, semitones / 12);

      const sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = zoneBuffer || waveformBuffer;
      sourceNode.playbackRate.value = playbackRate;
      const hasSlice =
        !zoneBuffer &&
        slice !== undefined &&
        slice.end > slice.start &&
        slice.start >= 0 &&
        slice.end <= rawSamples!.length;
      sourceNode.loop = !hasSlice && !zoneBuffer;

      const gainNode = audioCtx.createGain();
      gainNode.connect(outputNode || audioCtx.destination);
      sourceNode.connect(gainNode);

      const now = audioCtx.currentTime;
      const safeAttack = Math.max(envelope.attack, 0.005);
      const peak = clampVelocity(velocity, 127) / 127;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(peak, now + safeAttack);
      gainNode.gain.linearRampToValueAtTime(
        envelope.sustain * peak,
        now + safeAttack + envelope.decay,
      );

      if (hasSlice && slice) {
        const offset = slice.start / rawSampleRate;
        const duration = (slice.end - slice.start) / rawSampleRate;
        sourceNode.start(now, offset, duration);
      } else {
        sourceNode.start(now);
      }

      const voice: Voice = {
        gainNode,
        sourceNode,
        noteNum,
        startTime: now,
        releaseTime: null,
      };
      activeVoices.push(voice);

      if (activeVoices.length > maxVoices) {
        const oldest = activeVoices[0];
        try {
          oldest.sourceNode.stop(now);
        } catch (_) {
          /* already stopped */
        }
        oldest.gainNode.disconnect();
        activeVoices.shift();
      }

      return voice;
    },

    noteOff(noteNum: number, envelope: Pick<Envelope, "release">): void {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const toRelease = activeVoices.filter(
        (v) => v.noteNum === noteNum && v.releaseTime === null,
      );
      toRelease.forEach((voice) => {
        voice.releaseTime = now;
        const currentGain = voice.gainNode.gain.value;
        voice.gainNode.gain.setValueAtTime(currentGain, now);
        voice.gainNode.gain.linearRampToValueAtTime(0, now + envelope.release);
        voice.sourceNode.stop(now + envelope.release);
        setTimeout(
          () => {
            const idx = activeVoices.indexOf(voice);
            if (idx >= 0) activeVoices.splice(idx, 1);
            try {
              voice.gainNode.disconnect();
            } catch (_) {
              /* already disconnected */
            }
          },
          envelope.release * 1000 + 10,
        );
      });
    },

    getActiveVoiceCount(): number {
      return activeVoices.filter((v) => v.releaseTime === null).length;
    },

    stopAll(): void {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      activeVoices.forEach((voice) => {
        try {
          voice.sourceNode.stop(now);
        } catch (_) {
          /* already stopped */
        }
        voice.gainNode.disconnect();
      });
      activeVoices.length = 0;
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

// Widget render

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const sampler = createSamplerEngine(model.get("max_voices") as number);
  if (model.get("session_id")) {
    sampler.setSession(model);
  }

  const root = document.createElement("div");
  root.className = "nbplay-sampler";
  root.innerHTML = `
    <div class="nbplay-samp-header">
      <h3>nbplay</h3>
      <span class="nbplay-badge">sampler</span>
      <input type="file" class="nbplay-samp-file" accept="audio/*" />
      <span class="nbplay-samp-name"></span>
    </div>
    <div class="nbplay-samp-waveform-wrap">
      <canvas class="nbplay-samp-waveform"></canvas>
    </div>
    <div class="nbplay-samp-info">
      <span class="nbplay-samp-info-rate"></span>
      <span class="nbplay-samp-info-root"></span>
      <span class="nbplay-samp-info-len"></span>
      <span class="nbplay-samp-info-voices"></span>
      <span class="nbplay-samp-active-voices">0 active</span>
    </div>
    <div class="nbplay-samp-envelope">
      <div class="nbplay-samp-env-display">
        <canvas class="nbplay-samp-env-canvas"></canvas>
      </div>
      <div class="nbplay-samp-env-controls">
        <div class="nbplay-samp-knob">
          <label>Attack</label>
          <input type="range" class="nbplay-samp-attack" min="0" max="2" step="0.001" />
          <span class="nbplay-samp-attack-val"></span>
        </div>
        <div class="nbplay-samp-knob">
          <label>Decay</label>
          <input type="range" class="nbplay-samp-decay" min="0" max="2" step="0.001" />
          <span class="nbplay-samp-decay-val"></span>
        </div>
        <div class="nbplay-samp-knob">
          <label>Sustain</label>
          <input type="range" class="nbplay-samp-sustain" min="0" max="1" step="0.01" />
          <span class="nbplay-samp-sustain-val"></span>
        </div>
        <div class="nbplay-samp-knob">
          <label>Release</label>
          <input type="range" class="nbplay-samp-release" min="0" max="5" step="0.001" />
          <span class="nbplay-samp-release-val"></span>
        </div>
      </div>
    </div>
    <div class="nbplay-samp-voices-section">
      <label class="nbplay-samp-label">Max Voices</label>
      <input type="range" class="nbplay-samp-max-voices" min="1" max="32" step="1" />
      <span class="nbplay-samp-voices-val"></span>
    </div>
    <div class="nbplay-samp-pads-section">
      <div class="nbplay-samp-pads-controls">
        <label class="nbplay-samp-label">Trigger Pads</label>
        <input type="number" class="nbplay-samp-pad-count" min="1" max="32" step="1" />
        <span class="nbplay-samp-pad-count-val"></span>
        <label class="nbplay-samp-label">Velocity</label>
        <input type="range" class="nbplay-samp-velocity" min="1" max="127" step="1" />
        <span class="nbplay-samp-velocity-val"></span>
        <label class="nbplay-samp-vel-sense-label">
          <input type="checkbox" class="nbplay-samp-vel-sense" checked /> Vel-Sensitive
        </label>
      </div>
      <div class="nbplay-samp-pads-grid"></div>
    </div>
    <div class="nbplay-samp-zones-section">
      <div class="nbplay-samp-zones-controls">
        <label class="nbplay-samp-label">Zones</label>
        <select class="nbplay-samp-zone-pad" title="Pad a captured sample lands on"></select>
        <label class="nbplay-samp-zone-file-label" title="Add a zone from an audio file">
          File<input type="file" class="nbplay-samp-zone-file" accept="audio/*" />
        </label>
        <button class="nbplay-samp-zone-rec" title="Record the microphone into the selected pad">Rec</button>
        <span class="nbplay-samp-zone-status"></span>
      </div>
      <div class="nbplay-samp-zone-map" title="Key ranges"></div>
      <div class="nbplay-samp-zone-list"></div>
    </div>
  `;
  el.appendChild(root);

  const waveCanvas = root.querySelector(
    ".nbplay-samp-waveform",
  ) as HTMLCanvasElement;
  const waveWrap = root.querySelector(
    ".nbplay-samp-waveform-wrap",
  ) as HTMLDivElement;
  const fileInput = root.querySelector(".nbplay-samp-file") as HTMLInputElement;
  const envCanvas = root.querySelector(
    ".nbplay-samp-env-canvas",
  ) as HTMLCanvasElement;
  const sampleNameEl = root.querySelector(
    ".nbplay-samp-name",
  ) as HTMLSpanElement;
  const infoRate = root.querySelector(
    ".nbplay-samp-info-rate",
  ) as HTMLSpanElement;
  const infoRoot = root.querySelector(
    ".nbplay-samp-info-root",
  ) as HTMLSpanElement;
  const infoLen = root.querySelector(
    ".nbplay-samp-info-len",
  ) as HTMLSpanElement;
  const infoVoices = root.querySelector(
    ".nbplay-samp-info-voices",
  ) as HTMLSpanElement;
  const activeVoicesEl = root.querySelector(
    ".nbplay-samp-active-voices",
  ) as HTMLSpanElement;
  const padsGrid = root.querySelector(
    ".nbplay-samp-pads-grid",
  ) as HTMLDivElement;
  const padCountInput = root.querySelector(
    ".nbplay-samp-pad-count",
  ) as HTMLInputElement;
  const padCountVal = root.querySelector(
    ".nbplay-samp-pad-count-val",
  ) as HTMLSpanElement;
  const velocitySlider = root.querySelector(
    ".nbplay-samp-velocity",
  ) as HTMLInputElement;
  const velocityVal = root.querySelector(
    ".nbplay-samp-velocity-val",
  ) as HTMLSpanElement;
  const velocitySensitiveInput = root.querySelector(
    ".nbplay-samp-vel-sense",
  ) as HTMLInputElement;
  const zonePadSelect = root.querySelector(
    ".nbplay-samp-zone-pad",
  ) as HTMLSelectElement;
  const zoneFileInput = root.querySelector(
    ".nbplay-samp-zone-file",
  ) as HTMLInputElement;
  const zoneRecBtn = root.querySelector(
    ".nbplay-samp-zone-rec",
  ) as HTMLButtonElement;
  const zoneStatus = root.querySelector(
    ".nbplay-samp-zone-status",
  ) as HTMLSpanElement;
  const zoneMap = root.querySelector(".nbplay-samp-zone-map") as HTMLDivElement;
  const zoneList = root.querySelector(
    ".nbplay-samp-zone-list",
  ) as HTMLDivElement;

  const attackSlider = root.querySelector(
    ".nbplay-samp-attack",
  ) as HTMLInputElement;
  const decaySlider = root.querySelector(
    ".nbplay-samp-decay",
  ) as HTMLInputElement;
  const sustainSlider = root.querySelector(
    ".nbplay-samp-sustain",
  ) as HTMLInputElement;
  const releaseSlider = root.querySelector(
    ".nbplay-samp-release",
  ) as HTMLInputElement;
  const attackVal = root.querySelector(
    ".nbplay-samp-attack-val",
  ) as HTMLSpanElement;
  const decayVal = root.querySelector(
    ".nbplay-samp-decay-val",
  ) as HTMLSpanElement;
  const sustainVal = root.querySelector(
    ".nbplay-samp-sustain-val",
  ) as HTMLSpanElement;
  const releaseVal = root.querySelector(
    ".nbplay-samp-release-val",
  ) as HTMLSpanElement;
  const voicesSlider = root.querySelector(
    ".nbplay-samp-max-voices",
  ) as HTMLInputElement;
  const voicesVal = root.querySelector(
    ".nbplay-samp-voices-val",
  ) as HTMLSpanElement;

  const voiceCounterInterval = setInterval(() => {
    const count = sampler.getActiveVoiceCount();
    activeVoicesEl.textContent = count + " active";
  }, 50);

  // Double-click to edit values (uses shared makeEditable with committed guard)

  makeEditable(attackVal, {
    className: "nbplay-samp-inline-edit",
    getValue: () => String(model.get("attack")),
    parse: (raw: string) => {
      const v = parseFloat(raw);
      return isNaN(v) ? null : Math.max(0, Math.min(2, v));
    },
    apply: (v) => {
      model.set("attack", v);
      model.save_changes();
      redrawEnvelope();
    },
    sync: () => {
      syncEnvelopeControls();
      redrawEnvelope();
    },
  });

  makeEditable(decayVal, {
    className: "nbplay-samp-inline-edit",
    getValue: () => String(model.get("decay")),
    parse: (raw: string) => {
      const v = parseFloat(raw);
      return isNaN(v) ? null : Math.max(0, Math.min(2, v));
    },
    apply: (v) => {
      model.set("decay", v);
      model.save_changes();
      redrawEnvelope();
    },
    sync: () => {
      syncEnvelopeControls();
      redrawEnvelope();
    },
  });

  makeEditable(sustainVal, {
    className: "nbplay-samp-inline-edit",
    getValue: () => String(model.get("sustain")),
    parse: (raw: string) => {
      let v = parseFloat(raw);
      if (isNaN(v)) return null;
      if (v > 1) v /= 100;
      return Math.max(0, Math.min(1, v));
    },
    apply: (v) => {
      model.set("sustain", v);
      model.save_changes();
      redrawEnvelope();
    },
    sync: () => {
      syncEnvelopeControls();
      redrawEnvelope();
    },
  });

  makeEditable(releaseVal, {
    className: "nbplay-samp-inline-edit",
    getValue: () => String(model.get("release")),
    parse: (raw: string) => {
      const v = parseFloat(raw);
      return isNaN(v) ? null : Math.max(0, Math.min(5, v));
    },
    apply: (v) => {
      model.set("release", v);
      model.save_changes();
      redrawEnvelope();
    },
    sync: () => {
      syncEnvelopeControls();
      redrawEnvelope();
    },
  });

  makeEditable(voicesVal, {
    className: "nbplay-samp-inline-edit",
    getValue: () => String(model.get("max_voices")),
    parse: (raw: string) => {
      const v = parseInt(raw);
      return isNaN(v) ? null : Math.max(1, Math.min(32, v));
    },
    apply: (v) => {
      model.set("max_voices", v);
      model.save_changes();
    },
    sync: syncVoices,
  });

  function fmtTime(t: number): string {
    if (t < 0.01) return (t * 1000).toFixed(1) + " ms";
    if (t < 1) return (t * 1000).toFixed(0) + " ms";
    return t.toFixed(2) + " s";
  }

  function fmtLen(sampleCount: number, rate: number): string {
    if (sampleCount === 0) return "\u2014";
    const sec = sampleCount / rate;
    if (sec < 1) return (sec * 1000).toFixed(0) + " ms";
    return sec.toFixed(2) + " s";
  }

  const heldPads: Set<number> = new Set();
  const heldNotes: Map<number, number> = new Map();

  function getPadCount(): number {
    return Math.max(1, Math.min(32, Number(model.get("pad_count") || 8)));
  }

  function getPadNotes(): number[] {
    return resizePadNotes(
      ((model.get("pad_notes") as number[]) || []).slice(),
      getPadCount(),
    );
  }

  function getPadVelocities(): number[] {
    return resizePadVelocities(
      ((model.get("pad_velocities") as number[]) || []).slice(),
      getPadCount(),
      model.get("velocity") as number,
    );
  }

  function getPadActions(): PadAction[] {
    return normalizePadActions(
      model.get("pad_actions"),
      getPadNotes(),
      getPadVelocities(),
      getPadCount(),
    );
  }

  function getSampleSlices(): SampleSlice[] {
    const raw = (model.get("sample_slices") as Record<string, unknown>[]) || [];
    return raw
      .map((s, index) => ({
        index: Number(s.index ?? index),
        note: Number(s.note),
        start: Math.max(0, Math.floor(Number(s.start) || 0)),
        end: Math.max(0, Math.floor(Number(s.end) || 0)),
        label: typeof s.label === "string" ? s.label : undefined,
      }))
      .filter((s) => Number.isFinite(s.note) && s.end > s.start);
  }

  function sliceForAction(action: PadAction): SampleSlice | undefined {
    if (action.type !== "note") return undefined;
    const slices = getSampleSlices();
    if (action.slice !== undefined) {
      return slices.find((s) => s.index === action.slice);
    }
    return slices.find((s) => s.note === action.note);
  }

  function currentEnvelope(): Envelope {
    return {
      attack: model.get("attack") as number,
      decay: model.get("decay") as number,
      sustain: model.get("sustain") as number,
      release: model.get("release") as number,
    };
  }

  function setLastPadEvent(
    index: number,
    action: PadAction,
    eventType: "on" | "off" | "trigger",
    velocity: number,
  ): void {
    model.set("last_pad_event", {
      pad: index,
      event: eventType,
      velocity,
      action,
    });
  }

  function computePadVelocity(
    index: number,
    clientY: number,
    rect: DOMRect,
  ): number {
    const padVelocities = getPadVelocities();
    const maxVelocity =
      padVelocities[index] ?? (model.get("velocity") as number);
    if (!(model.get("velocity_sensitive") as boolean)) {
      return clampVelocity(maxVelocity);
    }
    const fraction = (clientY - rect.top) / rect.height;
    const raw = Math.round(20 + fraction * (maxVelocity - 20));
    return clampVelocity(raw);
  }

  function syncActivePads(): void {
    const pads = padsGrid.querySelectorAll(".nbplay-samp-pad");
    pads.forEach((pad) => {
      const index = Number((pad as HTMLElement).dataset.index || 0);
      pad.classList.toggle("active", heldPads.has(index));
    });
  }

  function isPadEditTarget(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      Boolean(target.closest(".nbplay-samp-pad-note, .nbplay-samp-inline-edit"))
    );
  }

  function triggerPad(index: number, velocity: number): void {
    const action = getPadActions()[index];
    if (!action) return;
    heldPads.add(index);

    if (action.type === "note") {
      heldNotes.set(index, action.note);
      const slice = sliceForAction(action);
      sampler.noteOn(
        action.note,
        model.get("root_note") as number,
        currentEnvelope(),
        velocity,
        slice,
      );
      model.set("last_note_event", {
        note: action.note,
        velocity,
        type: "on",
      });
      setLastPadEvent(index, action, "on", velocity);
    } else {
      if (action.type === "trait") {
        model.set(action.trait, action.value);
      }
      setLastPadEvent(index, action, "trigger", velocity);
    }

    model.set("active_pads", Array.from(heldPads));
    model.save_changes();
    syncActivePads();
  }

  function releasePad(index: number): void {
    if (!heldPads.has(index)) return;
    heldPads.delete(index);
    const note = heldNotes.get(index);
    const action = getPadActions()[index];
    heldNotes.delete(index);

    if (note !== undefined) {
      sampler.noteOff(note, {
        release: model.get("release") as number,
      });
      model.set("last_note_event", { note, velocity: 0, type: "off" });
      if (action) setLastPadEvent(index, action, "off", 0);
    }

    model.set("active_pads", Array.from(heldPads));
    model.save_changes();
    syncActivePads();
  }

  function createPads(): void {
    padsGrid.innerHTML = "";
    const padNotes = getPadNotes();
    const padVelocities = getPadVelocities();
    const padActions = getPadActions();
    if (
      padNotes.length !== ((model.get("pad_notes") as number[]) || []).length
    ) {
      model.set("pad_notes", padNotes.slice());
    }
    if (
      padVelocities.length !==
      ((model.get("pad_velocities") as number[]) || []).length
    ) {
      model.set("pad_velocities", padVelocities.slice());
    }
    padActions.forEach((action, idx) => {
      const pad = document.createElement("button");
      pad.className = "nbplay-samp-pad";
      pad.dataset.index = String(idx);

      const velocityBar = document.createElement("div");
      velocityBar.className = "nbplay-samp-pad-vel-bar";
      velocityBar.style.height =
        Math.max(2, Math.round(((padVelocities[idx] ?? 100) / 127) * 100)) +
        "%";
      pad.appendChild(velocityBar);

      const noteSpan = document.createElement("span");
      noteSpan.className = "nbplay-samp-pad-note";
      const slice = sliceForAction(action);
      noteSpan.textContent = slice?.label || padActionLabel(action);
      noteSpan.title = "Double-click to edit note";
      pad.appendChild(noteSpan);

      pad.addEventListener("pointerdown", (e: PointerEvent) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (isPadEditTarget(e.target)) return;
        if (e.detail >= 2) return; // Skip trigger on double-click
        e.preventDefault();
        pad.setPointerCapture(e.pointerId);
        const velocity = computePadVelocity(
          idx,
          e.clientY,
          pad.getBoundingClientRect(),
        );
        triggerPad(idx, velocity);
      });
      pad.addEventListener("pointerup", (e: PointerEvent) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (isPadEditTarget(e.target)) return;
        if (e.detail >= 2) return; // Skip on double-click
        e.preventDefault();
        releasePad(idx);
      });
      pad.addEventListener("pointercancel", (e: PointerEvent) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (isPadEditTarget(e.target)) return;
        if (e.detail >= 2) return; // Skip on double-click
        e.preventDefault();
        releasePad(idx);
      });

      noteSpan.addEventListener("dblclick", (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
        if (action.type !== "note") return;
        let committed = false;
        const input = document.createElement("input");
        input.type = "text";
        input.className = "nbplay-samp-inline-edit";
        input.value = noteName(action.note);
        noteSpan.replaceWith(input);
        // Defer focus to next tick so the browser has committed the DOM change
        // and previous pointer events (which may call preventDefault) are done.
        setTimeout(() => {
          input.focus();
          input.select();
        }, 0);

        function commit(): void {
          if (committed) return;
          committed = true;
          const parsed = parseNoteName(input.value);
          if (parsed !== null) {
            padNotes[idx] = parsed;
            noteSpan.textContent = noteName(parsed);
            const actions = getPadActions();
            if (actions[idx]?.type === "note") {
              actions[idx] = { ...actions[idx], note: parsed };
              model.set("pad_actions", actions);
            }
            model.set("pad_notes", padNotes.slice());
            model.save_changes();
          }
          input.replaceWith(noteSpan);
        }

        input.addEventListener("pointerdown", (pe: Event) =>
          pe.stopPropagation(),
        );
        input.addEventListener("keydown", (ke: KeyboardEvent) => {
          ke.stopPropagation();
          if (ke.key === "Enter") {
            ke.preventDefault();
            commit();
          }
          if (ke.key === "Escape") {
            ke.preventDefault();
            if (!committed) {
              committed = true;
              input.replaceWith(noteSpan);
            }
          }
        });
        input.addEventListener("blur", commit);
      });

      padsGrid.appendChild(pad);
    });
  }

  // Sync UI from model

  function syncInfo(): void {
    sampleNameEl.textContent = model.get("sample_name") as string;
    infoRate.textContent = (model.get("sample_rate") as number) / 1000 + " kHz";
    infoRoot.textContent = noteName(model.get("root_note") as number);
    infoLen.textContent = fmtLen(
      model.get("sample_length") as number,
      model.get("sample_rate") as number,
    );
    infoVoices.textContent = (model.get("max_voices") as number) + " voices";
  }

  function syncEnvelopeControls(): void {
    attackSlider.value = String(model.get("attack"));
    decaySlider.value = String(model.get("decay"));
    sustainSlider.value = String(model.get("sustain"));
    releaseSlider.value = String(model.get("release"));
    attackVal.textContent = fmtTime(model.get("attack") as number);
    decayVal.textContent = fmtTime(model.get("decay") as number);
    sustainVal.textContent =
      ((model.get("sustain") as number) * 100).toFixed(0) + "%";
    releaseVal.textContent = fmtTime(model.get("release") as number);
  }

  function syncVoices(): void {
    voicesSlider.value = String(model.get("max_voices"));
    voicesVal.textContent = String(model.get("max_voices"));
  }

  function syncPadCount(): void {
    const count = getPadCount();
    padCountInput.value = String(count);
    padCountVal.textContent = `${count}`;
  }

  function syncVelocityControls(): void {
    const velocity = clampVelocity(model.get("velocity"));
    velocitySlider.value = String(velocity);
    velocityVal.textContent = String(velocity);
    velocitySensitiveInput.checked = model.get("velocity_sensitive") as boolean;
  }

  // Multi-sample zones

  function getZones(): Zone[] {
    const raw = (model.get("zones") as Record<string, unknown>[]) || [];
    return raw.map((z, index) => ({
      id: String(z.id ?? index),
      name: typeof z.name === "string" ? z.name : `Zone ${index + 1}`,
      note_low: clampNote(z.note_low, 0),
      note_high: clampNote(z.note_high, 127),
      velocity_low: clampNote(z.velocity_low, 0),
      velocity_high: clampNote(z.velocity_high, 127),
      root_note: clampNote(z.root_note, 60),
      sample_rate: Math.max(1, Number(z.sample_rate) || 44100),
      samples: toFloat32(z.data) || new Float32Array(0),
    }));
  }

  function writeZones(zones: Zone[]): void {
    model.set(
      "zones",
      zones.map((z) => ({
        id: z.id,
        name: z.name,
        note_low: z.note_low,
        note_high: z.note_high,
        velocity_low: z.velocity_low,
        velocity_high: z.velocity_high,
        root_note: z.root_note,
        sample_rate: z.sample_rate,
        length: z.samples.length,
        data: float32ToDataView(z.samples),
      })),
    );
    model.save_changes();
    syncZones();
  }

  function addZone(
    samples: Float32Array,
    sampleRate: number,
    name: string,
    range: { low: number; high: number; root: number },
  ): void {
    const zones = getZones();
    zones.push({
      id: Math.random().toString(36).slice(2, 10),
      name,
      note_low: range.low,
      note_high: range.high,
      velocity_low: 0,
      velocity_high: 127,
      root_note: range.root,
      sample_rate: sampleRate,
      samples,
    });
    writeZones(zones);
  }

  /** Range for a captured sample: the selected pad's note, or every note. */
  function captureRange(): { low: number; high: number; root: number } {
    const pad = Number(zonePadSelect.value);
    if (Number.isFinite(pad) && pad >= 0) {
      const note = getPadNotes()[pad];
      if (note !== undefined) return { low: note, high: note, root: note };
    }
    return { low: 0, high: 127, root: 60 };
  }

  function syncZonePadOptions(): void {
    const current = zonePadSelect.value;
    zonePadSelect.innerHTML = '<option value="-1">All notes</option>';
    getPadNotes().forEach((note, index) => {
      const opt = document.createElement("option");
      opt.value = String(index);
      opt.textContent = `Pad ${index + 1} (${noteName(note)})`;
      zonePadSelect.appendChild(opt);
    });
    zonePadSelect.value = current || "-1";
    if (zonePadSelect.selectedIndex < 0) zonePadSelect.value = "-1";
  }

  function syncZones(): void {
    const zones = getZones();
    sampler.setZones(zones);
    zoneMap.innerHTML = "";
    zoneList.innerHTML = "";
    zoneMap.classList.toggle("empty", zones.length === 0);
    zones.forEach((zone, index) => {
      const color = ZONE_COLORS[index % ZONE_COLORS.length];
      const span = document.createElement("div");
      span.className = "nbplay-samp-zone-span";
      span.style.left = `${(zone.note_low / 128) * 100}%`;
      span.style.width = `${((zone.note_high - zone.note_low + 1) / 128) * 100}%`;
      span.style.background = color;
      span.title = `${zone.name}: ${noteName(zone.note_low)}\u2013${noteName(zone.note_high)}`;
      zoneMap.appendChild(span);

      const row = document.createElement("div");
      row.className = "nbplay-samp-zone-row";
      row.dataset.index = String(index);
      row.innerHTML = `
        <span class="nbplay-samp-zone-swatch" style="background:${color}"></span>
        <input type="text" class="nbplay-samp-zone-name" value="" title="Zone name" />
        <label>Low<input type="number" class="nbplay-samp-zone-low" min="0" max="127" value="${zone.note_low}" /></label>
        <label>High<input type="number" class="nbplay-samp-zone-high" min="0" max="127" value="${zone.note_high}" /></label>
        <label>Root<input type="number" class="nbplay-samp-zone-root" min="0" max="127" value="${zone.root_note}" /></label>
        <span class="nbplay-samp-zone-len">${fmtLen(zone.samples.length, zone.sample_rate)}</span>
        <button class="nbplay-samp-zone-remove" title="Remove zone">\u00d7</button>
      `;
      (row.querySelector(".nbplay-samp-zone-name") as HTMLInputElement).value =
        zone.name;
      const commit = (field: keyof Zone, raw: string) => {
        const zones = getZones();
        const target = zones[index];
        if (!target) return;
        if (field === "name") target.name = raw.trim() || target.name;
        else if (field === "note_low" || field === "note_high") {
          const v = clampNote(raw, target[field]);
          target[field] = v;
          if (target.note_low > target.note_high) {
            if (field === "note_low") target.note_high = v;
            else target.note_low = v;
          }
        } else if (field === "root_note")
          target.root_note = clampNote(raw, target.root_note);
        writeZones(zones);
      };
      row
        .querySelector(".nbplay-samp-zone-name")!
        .addEventListener("change", (e) =>
          commit("name", (e.target as HTMLInputElement).value),
        );
      row
        .querySelector(".nbplay-samp-zone-low")!
        .addEventListener("change", (e) =>
          commit("note_low", (e.target as HTMLInputElement).value),
        );
      row
        .querySelector(".nbplay-samp-zone-high")!
        .addEventListener("change", (e) =>
          commit("note_high", (e.target as HTMLInputElement).value),
        );
      row
        .querySelector(".nbplay-samp-zone-root")!
        .addEventListener("change", (e) =>
          commit("root_note", (e.target as HTMLInputElement).value),
        );
      row
        .querySelector(".nbplay-samp-zone-remove")!
        .addEventListener("click", () => {
          const zones = getZones();
          zones.splice(index, 1);
          writeZones(zones);
        });
      zoneList.appendChild(row);
    });
  }

  async function decodeToMono(
    data: ArrayBuffer,
  ): Promise<{ samples: Float32Array; sampleRate: number } | null> {
    const decodeCtx = createAudioContext();
    if (!decodeCtx) return null;
    try {
      const audioBuffer = await decodeCtx.decodeAudioData(data);
      return {
        samples: mixToMono(audioBuffer),
        sampleRate: audioBuffer.sampleRate,
      };
    } finally {
      if (decodeCtx.state !== "closed") decodeCtx.close();
    }
  }

  async function addZoneFromFile(file: File): Promise<void> {
    const decoded = await decodeToMono(await file.arrayBuffer());
    if (!decoded) return;
    addZone(decoded.samples, decoded.sampleRate, file.name, captureRange());
    zoneStatus.textContent = `Added ${file.name}`;
  }

  /** Python asked for a timeline clip (by browser URL) to become a zone. */
  let lastCaptureNonce: unknown = undefined;
  async function handleCaptureRequest(): Promise<void> {
    const req = model.get("capture_request") as
      | {
          url?: string;
          name?: string;
          note_low?: number;
          note_high?: number;
          root_note?: number;
          offset?: number;
          duration?: number;
        }
      | undefined;
    if (!req?.url) return;
    const nonce = (req as { nonce?: unknown }).nonce;
    if (nonce !== undefined && nonce === lastCaptureNonce) return;
    lastCaptureNonce = nonce;
    zoneStatus.textContent = "Capturing\u2026";
    try {
      const response = await fetch(req.url);
      const decoded = await decodeToMono(await response.arrayBuffer());
      if (!decoded) throw new Error("Web Audio is unavailable");
      let samples = decoded.samples;
      const start = Math.max(
        0,
        Math.floor((req.offset || 0) * decoded.sampleRate),
      );
      const frames =
        req.duration && req.duration > 0
          ? Math.max(1, Math.round(req.duration * decoded.sampleRate))
          : samples.length - start;
      if (start > 0 || start + frames < samples.length) {
        samples = samples.slice(
          start,
          Math.min(samples.length, start + frames),
        );
      }
      const low = clampNote(req.note_low, 0);
      const high = clampNote(req.note_high, 127);
      addZone(samples, decoded.sampleRate, req.name || "Take", {
        low: Math.min(low, high),
        high: Math.max(low, high),
        root: clampNote(req.root_note, low),
      });
      zoneStatus.textContent = `Captured ${req.name || "take"}`;
    } catch (err) {
      zoneStatus.textContent = `Capture failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Record the microphone straight into a zone on the selected pad.
  let recorder: MediaRecorder | null = null;
  let recorderStream: MediaStream | null = null;
  let recorderChunks: Blob[] = [];

  async function startZoneRecording(): Promise<void> {
    const nav = navigator as Navigator & {
      mediaDevices?: {
        getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
      };
    };
    const Recorder = (globalThis as { MediaRecorder?: typeof MediaRecorder })
      .MediaRecorder;
    if (!Recorder || !nav.mediaDevices?.getUserMedia) {
      zoneStatus.textContent = "Microphone recording is unavailable";
      return;
    }
    try {
      recorderStream = await nav.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      zoneStatus.textContent = `Microphone unavailable: ${err instanceof Error ? err.message : String(err)}`;
      return;
    }
    const range = captureRange();
    const takeName = `Take ${getZones().length + 1}`;
    recorderChunks = [];
    recorder = new Recorder(recorderStream);
    recorder.addEventListener("dataavailable", (e: BlobEvent) => {
      if (e.data && e.data.size) recorderChunks.push(e.data);
    });
    recorder.addEventListener("stop", async () => {
      const blob = new Blob(recorderChunks, {
        type: recorder?.mimeType || "audio/webm",
      });
      recorderChunks = [];
      recorderStream?.getTracks().forEach((track) => track.stop());
      recorderStream = null;
      recorder = null;
      zoneRecBtn.textContent = "Rec";
      zoneRecBtn.classList.remove("recording");
      if (!blob.size) {
        zoneStatus.textContent = "No audio was captured";
        return;
      }
      const decoded = await decodeToMono(await blob.arrayBuffer());
      if (!decoded) return;
      addZone(decoded.samples, decoded.sampleRate, takeName, range);
      zoneStatus.textContent = `Captured ${takeName}`;
    });
    recorder.start();
    zoneRecBtn.textContent = "Stop";
    zoneRecBtn.classList.add("recording");
    zoneStatus.textContent = `Recording ${takeName}\u2026`;
  }

  function stopZoneRecording(): void {
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  function applyPadCount(rawCount: number): void {
    if (Number.isNaN(rawCount)) return;
    const count = Math.max(1, Math.min(32, Math.round(rawCount)));
    const notes = resizePadNotes(
      ((model.get("pad_notes") as number[]) || []).slice(),
      count,
    );
    const velocities = resizePadVelocities(
      ((model.get("pad_velocities") as number[]) || []).slice(),
      count,
      model.get("velocity") as number,
    );
    const actions = normalizePadActions(
      model.get("pad_actions"),
      notes,
      velocities,
      count,
    );
    model.set("pad_count", count);
    model.set("pad_notes", notes);
    model.set("pad_velocities", velocities);
    model.set("pad_actions", actions);
    model.save_changes();
    syncPadCount();
    createPads();
  }

  function redrawWaveform(): void {
    const displaySamples = toFloat32(model.get("waveform"));
    const sampleData = toFloat32(model.get("sample_data"));
    drawWaveform(waveCanvas, displaySamples || sampleData);
    if (sampleData || displaySamples) {
      sampler.setWaveformData(
        sampleData || displaySamples!,
        model.get("sample_rate") as number,
      );
    }
  }

  function redrawEnvelope(): void {
    drawEnvelope(
      envCanvas,
      model.get("attack") as number,
      model.get("decay") as number,
      model.get("sustain") as number,
      model.get("release") as number,
    );
  }

  async function loadBrowserAudio(file: File): Promise<void> {
    const decodeCtx = createAudioContext();
    if (!decodeCtx) return;
    const audioBuffer = await decodeCtx.decodeAudioData(
      await file.arrayBuffer(),
    );
    const samples = mixToMono(audioBuffer);
    const displaySamples = decimateSamples(samples);
    model.set("sample_name", file.name);
    model.set("sample_rate", audioBuffer.sampleRate);
    model.set("sample_length", samples.length);
    model.set("sample_data", float32ToDataView(samples));
    model.set("waveform", float32ToDataView(displaySamples));
    model.save_changes();
    sampler.setWaveformData(samples, audioBuffer.sampleRate);
    syncInfo();
    redrawWaveform();
    if (decodeCtx.state !== "closed") {
      decodeCtx.close();
    }
  }

  // Event listeners

  attackSlider.addEventListener("input", () => {
    const v = parseFloat(attackSlider.value);
    attackVal.textContent = fmtTime(v);
    model.set("attack", v);
    model.save_changes();
    redrawEnvelope();
  });

  decaySlider.addEventListener("input", () => {
    const v = parseFloat(decaySlider.value);
    decayVal.textContent = fmtTime(v);
    model.set("decay", v);
    model.save_changes();
    redrawEnvelope();
  });

  sustainSlider.addEventListener("input", () => {
    const v = parseFloat(sustainSlider.value);
    sustainVal.textContent = (v * 100).toFixed(0) + "%";
    model.set("sustain", v);
    model.save_changes();
    redrawEnvelope();
  });

  releaseSlider.addEventListener("input", () => {
    const v = parseFloat(releaseSlider.value);
    releaseVal.textContent = fmtTime(v);
    model.set("release", v);
    model.save_changes();
    redrawEnvelope();
  });

  voicesSlider.addEventListener("input", () => {
    const v = parseInt(voicesSlider.value);
    voicesVal.textContent = String(v);
    model.set("max_voices", v);
    model.save_changes();
  });

  padCountInput.addEventListener("input", () => {
    applyPadCount(parseInt(padCountInput.value, 10));
  });

  velocitySlider.addEventListener("input", () => {
    const velocity = clampVelocity(velocitySlider.value);
    model.set("velocity", velocity);
    model.set(
      "pad_velocities",
      resizePadVelocities(getPadVelocities(), getPadCount(), velocity),
    );
    model.save_changes();
    syncVelocityControls();
    createPads();
  });

  velocitySensitiveInput.addEventListener("change", () => {
    model.set("velocity_sensitive", velocitySensitiveInput.checked);
    model.save_changes();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) {
      loadBrowserAudio(file);
    }
  });

  waveWrap.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    waveWrap.classList.add("drag-over");
  });

  waveWrap.addEventListener("dragleave", () => {
    waveWrap.classList.remove("drag-over");
  });

  waveWrap.addEventListener("drop", (e: DragEvent) => {
    e.preventDefault();
    waveWrap.classList.remove("drag-over");
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      loadBrowserAudio(file);
    }
  });

  zoneFileInput.addEventListener("change", () => {
    const file = zoneFileInput.files?.[0];
    if (file) {
      addZoneFromFile(file);
      zoneFileInput.value = "";
    }
  });

  zoneRecBtn.addEventListener("click", () => {
    if (recorder) stopZoneRecording();
    else startZoneRecording();
  });

  // Model observers

  model.on("change:zones", syncZones);
  model.on("change:capture_request", handleCaptureRequest);
  model.on("change:waveform", redrawWaveform);
  model.on("change:sample_data", redrawWaveform);
  model.on("change:sample_name", syncInfo);
  model.on("change:sample_rate", syncInfo);
  model.on("change:root_note", () => {
    syncInfo();
    createPads();
  });
  model.on("change:pad_notes", () => {
    const notes = ((model.get("pad_notes") as number[]) || []).slice();
    if (notes.length > 0 && notes.length !== model.get("pad_count")) {
      model.set("pad_count", notes.length);
    }
    syncPadCount();
    createPads();
    syncZonePadOptions();
  });
  model.on("change:pad_velocities", createPads);
  model.on("change:pad_actions", createPads);
  model.on("change:sample_slices", createPads);
  model.on("change:pad_count", () => {
    syncPadCount();
    createPads();
    syncZonePadOptions();
  });
  model.on("change:velocity", () => {
    syncVelocityControls();
    createPads();
  });
  model.on("change:velocity_sensitive", syncVelocityControls);
  model.on("change:sample_length", syncInfo);
  model.on("change:attack", () => {
    syncEnvelopeControls();
    redrawEnvelope();
  });
  model.on("change:decay", () => {
    syncEnvelopeControls();
    redrawEnvelope();
  });
  model.on("change:sustain", () => {
    syncEnvelopeControls();
    redrawEnvelope();
  });
  model.on("change:release", () => {
    syncEnvelopeControls();
    redrawEnvelope();
  });
  model.on("change:max_voices", syncVoices);
  model.on("change:session_id", () => {
    sampler.setSession(model);
    registerOnSessionBus();
  });
  model.on("change:channel_index", registerOnSessionBus);

  // Session bus registration (for keyboard widget)

  function registerOnSessionBus(): void {
    const sid = model.get("session_id") as string;
    const idx = model.get("channel_index") as number;
    if (!sid || idx < 0) return;
    const bus = getSessionBus(sid);
    if (!bus) return; // bus not ready yet — will retry on nbplay-bus-ready
    const samplers = bus.samplers || {};
    bus.samplers = samplers;
    samplers[idx] = {
      triggerNote(note: number, velocity: number): void {
        const rootNote = model.get("root_note") as number;
        sampler.noteOn(note, rootNote, currentEnvelope(), velocity);
      },
      releaseNote(note: number): void {
        sampler.noteOff(note, {
          release: model.get("release") as number,
        });
      },
    };
  }

  // Re-register when the session bus becomes available (mixer may
  // render after this sampler, so the bus might not exist yet).
  function onBusReady(e: Event): void {
    const detail = (e as CustomEvent).detail;
    if (detail?.sessionId === model.get("session_id")) {
      registerOnSessionBus();
    }
  }
  document.addEventListener("nbplay-bus-ready", onBusReady);

  registerOnSessionBus();

  // Initial render

  syncInfo();
  syncEnvelopeControls();
  syncVoices();
  syncPadCount();
  syncVelocityControls();
  redrawWaveform();
  redrawEnvelope();
  createPads();
  syncZonePadOptions();
  syncZones();

  // Cleanup
  const cancelDisconnect = onKernelDisconnect(model, () => {
    sampler.stopAll();
  });

  return () => {
    cancelDisconnect();
    clearInterval(voiceCounterInterval);
    stopZoneRecording();
    recorderStream?.getTracks().forEach((track) => track.stop());
    document.removeEventListener("nbplay-bus-ready", onBusReady);
    // Unregister from session bus
    const sid = model.get("session_id") as string;
    const idx = model.get("channel_index") as number;
    const samplers = getSessionBus(sid)?.samplers;
    if (samplers) delete samplers[idx];
    sampler.destroy();
  };
}

export default { render };
