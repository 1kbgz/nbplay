// nbplay SynthWidget – anywidget ESM frontend
// Renders a dark-themed synthesizer control panel with:
//   • waveform preview (binary Float32Array from Rust)
//   • oscillator type toggle buttons
//   • logarithmic frequency slider
//   • amplitude slider
//   • play/stop via Web Audio API

import {
  type AnyModel,
  cssVar,
  makeEditable,
  onKernelDisconnect,
  toFloat32,
} from "./helpers.ts";

// ── Frequency helpers (logarithmic mapping) ──────────────────────
const MIN_FREQ = 20;
const MAX_FREQ = 8000;
const LN_RATIO = Math.log(MAX_FREQ / MIN_FREQ);

function freqToPos(freq: number): number {
  return (
    Math.log(Math.max(MIN_FREQ, Math.min(MAX_FREQ, freq)) / MIN_FREQ) / LN_RATIO
  );
}
function posToFreq(pos: number): number {
  return MIN_FREQ * Math.exp(LN_RATIO * Math.max(0, Math.min(1, pos)));
}
function fmtFreq(hz: number): string {
  return hz >= 1000 ? (hz / 1000).toFixed(2) + " kHz" : hz.toFixed(1) + " Hz";
}

// ── Waveform renderer ────────────────────────────────────────────
function drawWaveform(
  canvas: HTMLCanvasElement,
  samples: Float32Array | null,
): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 128;

  canvas.width = w * dpr;
  canvas.height = h * dpr;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // Read theme colours from CSS custom properties (with dark fallbacks)
  const bg = cssVar(canvas, "--jp-layout-color0", "#080812");
  const brand = cssVar(canvas, "--jp-brand-color1", "#00d4ff");
  const grid = cssVar(canvas, "--jp-ui-font-color3", "#64648a");

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Grid – center line
  ctx.strokeStyle = grid;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Grid – quarter lines
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.25);
  ctx.lineTo(w, h * 0.25);
  ctx.moveTo(0, h * 0.75);
  ctx.lineTo(w, h * 0.75);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (!samples || samples.length === 0) return;

  const step = samples.length / w;

  // Glow pass
  ctx.strokeStyle = brand;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < w; i++) {
    const y =
      ((1 - samples[Math.min(Math.floor(i * step), samples.length - 1)]) * h) /
      2;
    i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
  }
  ctx.stroke();

  // Main stroke
  ctx.globalAlpha = 1;
  ctx.strokeStyle = brand;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < w; i++) {
    const y =
      ((1 - samples[Math.min(Math.floor(i * step), samples.length - 1)]) * h) /
      2;
    i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
  }
  ctx.stroke();
}

// ── Web Audio engine ─────────────────────────────────────────────
interface AudioEngine {
  start(type: string, freq: number, amp: number, sr: number): void;
  stop(): void;
  setFrequency(f: number): void;
  setAmplitude(a: number): void;
}

function createAudioEngine(): AudioEngine {
  let audioCtx: AudioContext | null = null;
  let srcNode: AudioBufferSourceNode | OscillatorNode | null = null;
  let gainNode: GainNode | null = null;

  return {
    start(type: string, freq: number, amp: number, sr: number): void {
      this.stop();
      audioCtx = new AudioContext({ sampleRate: sr });
      gainNode = audioCtx.createGain();
      gainNode.gain.value = amp;
      gainNode.connect(audioCtx.destination);

      if (type === "noise") {
        const buf = audioCtx.createBuffer(1, sr * 2, sr);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        const s = audioCtx.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.connect(gainNode);
        s.start();
        srcNode = s;
      } else {
        const osc = audioCtx.createOscillator();
        osc.type = (type === "saw" ? "sawtooth" : type) as OscillatorType;
        osc.frequency.value = freq;
        osc.connect(gainNode);
        osc.start();
        srcNode = osc;
      }
    },

    stop(): void {
      if (srcNode) {
        try {
          srcNode.stop();
        } catch (_) {
          /* already stopped */
        }
        srcNode.disconnect();
        srcNode = null;
      }
      if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
      }
      if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
      }
    },

    setFrequency(f: number): void {
      if (srcNode && (srcNode as OscillatorNode).frequency && audioCtx) {
        (srcNode as OscillatorNode).frequency.setTargetAtTime(
          f,
          audioCtx.currentTime,
          0.01,
        );
      }
    },

    setAmplitude(a: number): void {
      if (gainNode && audioCtx) {
        gainNode.gain.setTargetAtTime(a, audioCtx.currentTime, 0.01);
      }
    },
  };
}

// ── Widget render ────────────────────────────────────────────────
function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const audio = createAudioEngine();

  // ── DOM ──
  const root = document.createElement("div");
  root.className = "nbplay-synth";
  root.innerHTML = `
    <div class="nbplay-header">
      <h3>nbplay</h3>
      <span class="nbplay-badge">synth</span>
    </div>

    <div class="nbplay-waveform-container">
      <canvas class="nbplay-waveform"></canvas>
    </div>

    <div class="nbplay-osc-selector">
      <span class="nbplay-label">Oscillator</span>
      <div class="nbplay-osc-buttons">
        <button class="nbplay-osc-btn" data-type="sine">Sine</button>
        <button class="nbplay-osc-btn" data-type="square">Square</button>
        <button class="nbplay-osc-btn" data-type="saw">Saw</button>
        <button class="nbplay-osc-btn" data-type="noise">Noise</button>
      </div>
    </div>

    <div class="nbplay-params">
      <div class="nbplay-param">
        <span class="nbplay-label">Frequency</span>
        <input type="range" class="nbplay-freq" min="0" max="1" step="0.001" />
        <span class="nbplay-value nbplay-freq-val"></span>
      </div>
      <div class="nbplay-param">
        <span class="nbplay-label">Amplitude</span>
        <input type="range" class="nbplay-amp" min="0" max="1" step="0.01" />
        <span class="nbplay-value nbplay-amp-val"></span>
      </div>
    </div>

    <div class="nbplay-transport">
      <button class="nbplay-play-btn"></button>
      <span class="nbplay-info"></span>
    </div>
  `;
  el.appendChild(root);

  // refs
  const canvas = root.querySelector(".nbplay-waveform") as HTMLCanvasElement;
  const oscBtns = root.querySelectorAll(
    ".nbplay-osc-btn",
  ) as NodeListOf<HTMLButtonElement>;
  const freqSl = root.querySelector(".nbplay-freq") as HTMLInputElement;
  const freqVal = root.querySelector(".nbplay-freq-val") as HTMLSpanElement;
  const ampSl = root.querySelector(".nbplay-amp") as HTMLInputElement;
  const ampVal = root.querySelector(".nbplay-amp-val") as HTMLSpanElement;
  const playBtn = root.querySelector(".nbplay-play-btn") as HTMLButtonElement;
  const infoSpan = root.querySelector(".nbplay-info") as HTMLSpanElement;

  // ── UI sync helpers ──
  function syncOsc(): void {
    const cur = model.get("oscillator_type") as string;
    oscBtns.forEach((b) =>
      b.classList.toggle("active", b.dataset.type === cur),
    );
    const isNoise = cur === "noise";
    freqSl.disabled = isNoise;
  }

  function syncFreq(): void {
    const f = model.get("frequency") as number;
    freqSl.value = String(freqToPos(f));
    freqVal.textContent = fmtFreq(f);
  }

  function syncAmp(): void {
    const a = model.get("amplitude") as number;
    ampSl.value = String(a);
    ampVal.textContent = a.toFixed(2);
  }

  function syncPlay(): void {
    const on = model.get("is_playing") as boolean;
    playBtn.textContent = on ? "\u25A0  Stop" : "\u25B6  Play";
    playBtn.classList.toggle("playing", on);
  }

  // ── Double-click to edit values ──
  makeEditable(freqVal, {
    getValue: () => String(model.get("frequency")),
    parse: (raw: string) => {
      let v = parseFloat(raw);
      if (isNaN(v)) return null;
      if (raw.toLowerCase().includes("k")) v *= 1000;
      return Math.max(20, Math.min(8000, Math.round(v * 10) / 10));
    },
    apply: (v) => {
      model.set("frequency", v);
      model.save_changes();
      audio.setFrequency(v as number);
    },
    sync: syncFreq,
  });

  makeEditable(ampVal, {
    getValue: () => String(model.get("amplitude")),
    parse: (raw: string) => {
      const v = parseFloat(raw);
      if (isNaN(v)) return null;
      return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
    },
    apply: (v) => {
      model.set("amplitude", v);
      model.save_changes();
      audio.setAmplitude(v as number);
    },
    sync: syncAmp,
  });

  function syncInfo(): void {
    infoSpan.textContent = (model.get("sample_rate") as number) + " Hz";
  }

  function syncWaveform(): void {
    const raw = model.get("waveform");
    drawWaveform(canvas, toFloat32(raw));
  }

  // ── Event handlers (UI → model) ──
  oscBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      model.set("oscillator_type", btn.dataset.type!);
      model.save_changes();
      if (model.get("is_playing") as boolean) {
        audio.start(
          btn.dataset.type!,
          model.get("frequency") as number,
          model.get("amplitude") as number,
          model.get("sample_rate") as number,
        );
      }
    }),
  );

  freqSl.addEventListener("input", () => {
    const f = Math.round(posToFreq(parseFloat(freqSl.value)) * 10) / 10;
    model.set("frequency", f);
    model.save_changes();
    audio.setFrequency(f);
  });

  ampSl.addEventListener("input", () => {
    const a = Math.round(parseFloat(ampSl.value) * 100) / 100;
    model.set("amplitude", a);
    model.save_changes();
    audio.setAmplitude(a);
  });

  playBtn.addEventListener("click", () => {
    model.set("is_playing", !(model.get("is_playing") as boolean));
    model.save_changes();
  });

  // ── Model → UI observers ──
  model.on("change:oscillator_type", syncOsc);
  model.on("change:frequency", syncFreq);
  model.on("change:amplitude", syncAmp);
  model.on("change:is_playing", () => {
    syncPlay();
    if (model.get("is_playing") as boolean) {
      audio.start(
        model.get("oscillator_type") as string,
        model.get("frequency") as number,
        model.get("amplitude") as number,
        model.get("sample_rate") as number,
      );
    } else {
      audio.stop();
    }
  });
  model.on("change:sample_rate", syncInfo);
  model.on("change:waveform", syncWaveform);

  // ── Initial state ──
  // Force stopped state on render — prevents stale is_playing=true
  // from a saved notebook from launching audio in an undefined state.
  // Only update local model state; do NOT call save_changes() here
  // because sending comm messages during render can race with other
  // widgets still being initialised (e.g. Session dlinks).
  model.set("is_playing", false);

  syncOsc();
  syncFreq();
  syncAmp();
  syncPlay();
  syncInfo();
  requestAnimationFrame(syncWaveform);

  // ── Cleanup ──
  const cancelDisconnect = onKernelDisconnect(model, () => {
    model.set("is_playing", false);
    audio.stop();
    syncPlay();
  });

  return () => {
    cancelDisconnect();
    audio.stop();
  };
}

export default { render };
