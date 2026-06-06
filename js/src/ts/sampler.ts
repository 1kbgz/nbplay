// nbplay SamplerWidget – anywidget ESM frontend
// Sampler panel with waveform display, ADSR envelope, trigger pads,
// and Web Audio playback with pitch shifting.

import {
  type AnyModel,
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

  function ensureBuffer(): boolean {
    if (!audioCtx || !rawSamples || rawSamples.length === 0) return false;
    if (waveformBuffer) return true;
    waveformBuffer = audioCtx.createBuffer(1, rawSamples.length, rawSampleRate);
    const ch = waveformBuffer.getChannelData(0);
    for (let i = 0; i < rawSamples.length; i++) ch[i] = rawSamples[i];
    return true;
  }

  return {
    setSession(model: AnyModel): void {
      const sid = model.get("session_id") as string;
      const idx = model.get("channel_index") as number;
      if (sid && idx >= 0) {
        const g = globalThis as Record<string, unknown>;
        const nbplay = g.__nbplay as
          | Record<string, Record<string, unknown>>
          | undefined;
        const bus = nbplay?.[sid];
        if (bus) {
          const channels = bus.channels as { gain: GainNode }[];
          if (channels[idx]) {
            if (audioCtx !== (bus.audioCtx as AudioContext)) {
              waveformBuffer = null;
            }
            audioCtx = bus.audioCtx as AudioContext;
            outputNode = channels[idx].gain;
            ownAudioCtx = false;
            return;
          }
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
        audioCtx = new AudioContext({ sampleRate });
        ownAudioCtx = true;
      }
    },

    noteOn(
      noteNum: number,
      rootNote: number,
      envelope: Envelope,
      velocity = 127,
      slice?: { start: number; end: number },
    ): Voice | undefined {
      if (!audioCtx || !ensureBuffer()) return;
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const semitones = noteNum - rootNote;
      const playbackRate = Math.pow(2, semitones / 12);

      const sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = waveformBuffer;
      sourceNode.playbackRate.value = playbackRate;
      const hasSlice =
        slice !== undefined &&
        slice.end > slice.start &&
        slice.start >= 0 &&
        slice.end <= rawSamples!.length;
      sourceNode.loop = !hasSlice;

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
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const decodeCtx = new AudioCtor();
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

  // Model observers

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
  });
  model.on("change:pad_velocities", createPads);
  model.on("change:pad_actions", createPads);
  model.on("change:sample_slices", createPads);
  model.on("change:pad_count", () => {
    syncPadCount();
    createPads();
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
    const g = globalThis as Record<string, unknown>;
    const nbplay =
      (g.__nbplay as Record<string, Record<string, unknown>>) || {};
    g.__nbplay = nbplay;
    if (!nbplay[sid]) return; // bus not ready yet — will retry on nbplay-bus-ready
    const bus = nbplay[sid];
    const samplers = (bus.samplers as Record<number, unknown>) || {};
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

  // Cleanup
  const cancelDisconnect = onKernelDisconnect(model, () => {
    sampler.stopAll();
  });

  return () => {
    cancelDisconnect();
    clearInterval(voiceCounterInterval);
    document.removeEventListener("nbplay-bus-ready", onBusReady);
    // Unregister from session bus
    const sid = model.get("session_id") as string;
    const idx = model.get("channel_index") as number;
    const g = globalThis as Record<string, unknown>;
    const nbplay = g.__nbplay as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (nbplay?.[sid]) {
      const samplers = nbplay[sid].samplers as
        | Record<number, unknown>
        | undefined;
      if (samplers) delete samplers[idx];
    }
    sampler.destroy();
  };
}

export default { render };
