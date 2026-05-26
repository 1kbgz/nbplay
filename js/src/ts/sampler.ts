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

// Note helpers

const NOTE_NAMES = [
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

function parseNote(raw: string): number | null {
  const t = raw.trim();
  const num = parseInt(t, 10);
  if (String(num) === t && num >= 0 && num <= 127) return num;
  const m = t.match(/^([A-Ga-g])(#|b)?(-?\d+)$/);
  if (!m) return null;
  const base: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const b = base[m[1].toUpperCase()];
  if (b === undefined) return null;
  let semi = b;
  if (m[2] === "#") semi++;
  if (m[2] === "b") semi--;
  const midi = (parseInt(m[3], 10) + 1) * 12 + semi;
  return midi >= 0 && midi <= 127 ? midi : null;
}

function resizePadNotes(notes: number[], padCount: number): number[] {
  const count = Math.max(1, Math.min(32, Math.round(padCount || 1)));
  const resized = notes
    .slice(0, count)
    .map((note) => Math.max(0, Math.min(127, Math.round(note))));
  let nextNote = resized.length > 0 ? resized[resized.length - 1] + 1 : 48;
  while (resized.length < count) {
    resized.push(Math.max(0, Math.min(127, nextNote)));
    nextNote += 1;
  }
  return resized;
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
      // Loop the buffer so the sample sustains through the full
      // ADSR envelope — without this a slow attack causes the buffer
      // to end before the gain ramp reaches peak.
      sourceNode.loop = true;

      const gainNode = audioCtx.createGain();
      gainNode.connect(outputNode || audioCtx.destination);
      sourceNode.connect(gainNode);

      const now = audioCtx.currentTime;
      const safeAttack = Math.max(envelope.attack, 0.005);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(1.0, now + safeAttack);
      gainNode.gain.linearRampToValueAtTime(
        envelope.sustain,
        now + safeAttack + envelope.decay,
      );

      sourceNode.start(now);

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
      </div>
      <div class="nbplay-samp-pads-grid"></div>
    </div>
  `;
  el.appendChild(root);

  const waveCanvas = root.querySelector(
    ".nbplay-samp-waveform",
  ) as HTMLCanvasElement;
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

  function createPads(): void {
    const rootNote = model.get("root_note") as number;
    padsGrid.innerHTML = "";
    const padCount = Math.max(
      1,
      Math.min(32, Number(model.get("pad_count") || 8)),
    );
    const padNotes: number[] = resizePadNotes(
      ((model.get("pad_notes") as number[]) || []).slice(),
      padCount,
    );
    if (
      padNotes.length !== ((model.get("pad_notes") as number[]) || []).length
    ) {
      model.set("pad_notes", padNotes.slice());
    }
    padNotes.forEach((_, idx) => {
      const pad = document.createElement("button");
      pad.className = "nbplay-samp-pad";

      const noteSpan = document.createElement("span");
      noteSpan.className = "nbplay-samp-pad-note";
      noteSpan.textContent = noteName(padNotes[idx]);
      noteSpan.title = "Double-click to edit note";
      pad.appendChild(noteSpan);

      pad.addEventListener("pointerdown", (e: PointerEvent) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (e.detail >= 2) return; // Skip trigger on double-click
        e.preventDefault();
        pad.classList.add("active");
        sampler.noteOn(padNotes[idx], rootNote, {
          attack: model.get("attack") as number,
          decay: model.get("decay") as number,
          sustain: model.get("sustain") as number,
          release: model.get("release") as number,
        });
      });
      pad.addEventListener("pointerup", (e: PointerEvent) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (e.detail >= 2) return; // Skip on double-click
        e.preventDefault();
        pad.classList.remove("active");
        sampler.noteOff(padNotes[idx], {
          release: model.get("release") as number,
        });
      });
      pad.addEventListener("pointercancel", (e: PointerEvent) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (e.detail >= 2) return; // Skip on double-click
        e.preventDefault();
        pad.classList.remove("active");
        sampler.noteOff(padNotes[idx], {
          release: model.get("release") as number,
        });
      });

      noteSpan.addEventListener("dblclick", (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
        let committed = false;
        const input = document.createElement("input");
        input.type = "text";
        input.className = "nbplay-samp-inline-edit";
        input.value = noteName(padNotes[idx]);
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
          const parsed = parseNote(input.value);
          if (parsed !== null) {
            padNotes[idx] = parsed;
            noteSpan.textContent = noteName(parsed);
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
    const count = Math.max(
      1,
      Math.min(32, Number(model.get("pad_count") || 8)),
    );
    padCountInput.value = String(count);
    padCountVal.textContent = `${count}`;
  }

  function applyPadCount(rawCount: number): void {
    if (Number.isNaN(rawCount)) return;
    const count = Math.max(1, Math.min(32, Math.round(rawCount)));
    const notes = resizePadNotes(
      ((model.get("pad_notes") as number[]) || []).slice(),
      count,
    );
    model.set("pad_count", count);
    model.set("pad_notes", notes);
    model.save_changes();
    syncPadCount();
    createPads();
  }

  function redrawWaveform(): void {
    const raw = model.get("waveform");
    const samples = toFloat32(raw);
    drawWaveform(waveCanvas, samples);
    if (samples) {
      sampler.setWaveformData(samples, model.get("sample_rate") as number);
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

  // Model observers

  model.on("change:waveform", redrawWaveform);
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
  model.on("change:pad_count", () => {
    syncPadCount();
    createPads();
  });
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
        sampler.noteOn(note, rootNote, {
          attack: model.get("attack") as number,
          decay: model.get("decay") as number,
          sustain: model.get("sustain") as number,
          release: model.get("release") as number,
        });
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
