// nbplay MixerWidget – anywidget ESM frontend
// Mixer console with per-channel faders, pan, mute/solo, master output,
// and a shared Web Audio bus for session routing.

import {
  type AnyModel,
  createAudioContext,
  makeEditable,
  fmtGain,
  fmtPan,
  linearToDb,
  parseDbInput,
} from "./helpers.ts";
import {
  ensureBusAudioContext,
  getOrCreateSessionBus,
  getSessionBus,
} from "./session.ts";

// Types

interface Channel {
  name: string;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  effects?: EffectDescriptor[];
}

interface ChannelNode {
  gain: GainNode;
  pan: StereoPannerNode;
  effects: EffectUnit[];
  descriptors: EffectDescriptor[];
  analyser: AnalyserNode | null;
}

interface MeterLevel {
  peak: number;
  rms: number;
}

interface EffectDescriptor {
  type: string;
  [key: string]: unknown;
}

interface EffectUnit {
  input: AudioNode;
  output: AudioNode;
  dispose?: () => void;
  /**
   * Apply a changed descriptor of the same type in place. Returns false
   * when the change needs the unit rebuilt (for example a new impulse).
   */
  update?: (effect: EffectDescriptor) => boolean;
}

type EffectFactory = (
  ctx: AudioContext,
  effect: EffectDescriptor,
) => EffectUnit | AudioNode | null | undefined;

const EFFECT_OPTIONS = [
  "gain",
  "filter",
  "compressor",
  "limiter",
  "delay",
  "reverb",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function numberParam(
  effect: EffectDescriptor,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = effect[key];
  if (raw === null || raw === undefined || raw === "") {
    return clamp(fallback, min, max);
  }
  const n = Number(raw);
  return clamp(Number.isFinite(n) ? n : fallback, min, max);
}

function setParam(param: AudioParam | undefined, value: number): void {
  if (param) param.value = value;
}

function disconnectNode(node: AudioNode | null | undefined): void {
  try {
    node?.disconnect();
  } catch (_) {
    // Some browser nodes throw if already disconnected.
  }
}

function disposeEffects(effects: EffectUnit[]): void {
  effects.forEach((effect) => {
    effect.dispose?.();
    disconnectNode(effect.input);
    if (effect.output !== effect.input) disconnectNode(effect.output);
  });
  effects.length = 0;
}

function isAudioNodeLike(node: unknown): node is AudioNode {
  if (!node || typeof node !== "object") return false;
  const candidate = node as Partial<AudioNode>;
  return (
    typeof candidate.connect === "function" &&
    typeof candidate.disconnect === "function"
  );
}

function asEffectUnit(
  unit: EffectUnit | AudioNode | null | undefined,
): EffectUnit | null {
  if (!unit) return null;
  if (typeof unit === "object" && ("input" in unit || "output" in unit)) {
    const candidate = unit as Partial<EffectUnit>;
    if (isAudioNodeLike(candidate.input) && isAudioNodeLike(candidate.output)) {
      return {
        input: candidate.input,
        output: candidate.output,
        dispose:
          typeof candidate.dispose === "function"
            ? candidate.dispose
            : undefined,
        update:
          typeof candidate.update === "function" ? candidate.update : undefined,
      };
    }
    throw new TypeError(
      "effect plugin must return an AudioNode or { input, output } AudioNodes",
    );
  }
  if (isAudioNodeLike(unit)) return { input: unit, output: unit };
  throw new TypeError(
    "effect plugin must return an AudioNode or { input, output } AudioNodes",
  );
}

function createWetDryEffect(
  ctx: AudioContext,
  wet: number,
  connectWetPath: (input: GainNode, wetGain: GainNode) => AudioNode[],
): EffectUnit & { setWet: (wet: number) => void } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  dryGain.gain.value = 1 - wet;
  wetGain.gain.value = wet;
  input.connect(dryGain);
  dryGain.connect(output);
  const wetNodes = connectWetPath(input, wetGain);
  wetGain.connect(output);
  return {
    input,
    output,
    setWet: (value: number) => {
      dryGain.gain.value = 1 - value;
      wetGain.gain.value = value;
    },
    dispose: () => {
      [input, output, dryGain, wetGain, ...wetNodes].forEach(disconnectNode);
    },
  };
}

function createImpulse(
  ctx: AudioContext,
  seconds: number,
  decay: number,
): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buffer;
}

function builtInEffectFactory(
  ctx: AudioContext,
  effect: EffectDescriptor,
): EffectUnit | null {
  switch (effect.type) {
    case "gain": {
      const gain = ctx.createGain();
      const apply = (fx: EffectDescriptor) => {
        gain.gain.value = numberParam(fx, "gain", 1, 0, 4);
        return true;
      };
      apply(effect);
      return { input: gain, output: gain, update: apply };
    }
    case "filter": {
      const filter = ctx.createBiquadFilter();
      const apply = (fx: EffectDescriptor) => {
        filter.type = String(fx.filter_type || "lowpass") as BiquadFilterType;
        filter.frequency.value = numberParam(fx, "frequency", 1200, 20, 20000);
        filter.Q.value = numberParam(fx, "q", 1, 0.0001, 100);
        return true;
      };
      apply(effect);
      return { input: filter, output: filter, update: apply };
    }
    case "compressor": {
      const compressor = ctx.createDynamicsCompressor();
      const apply = (fx: EffectDescriptor) => {
        setParam(
          compressor.threshold,
          numberParam(fx, "threshold", -24, -100, 0),
        );
        setParam(compressor.knee, numberParam(fx, "knee", 30, 0, 40));
        setParam(compressor.ratio, numberParam(fx, "ratio", 12, 1, 20));
        setParam(compressor.attack, numberParam(fx, "attack", 0.003, 0, 1));
        setParam(compressor.release, numberParam(fx, "release", 0.25, 0, 1));
        return true;
      };
      apply(effect);
      return { input: compressor, output: compressor, update: apply };
    }
    case "limiter": {
      const limiter = ctx.createDynamicsCompressor();
      setParam(limiter.knee, 0);
      setParam(limiter.ratio, 20);
      setParam(limiter.attack, 0.001);
      const apply = (fx: EffectDescriptor) => {
        setParam(limiter.threshold, numberParam(fx, "threshold", -1, -100, 0));
        setParam(limiter.release, numberParam(fx, "release", 0.05, 0, 1));
        return true;
      };
      apply(effect);
      return { input: limiter, output: limiter, update: apply };
    }
    case "delay": {
      const delay = ctx.createDelay(5);
      const feedback = ctx.createGain();
      const unit = createWetDryEffect(
        ctx,
        numberParam(effect, "wet", 0.35, 0, 1),
        (input, wetGain) => {
          input.connect(delay);
          delay.connect(feedback);
          feedback.connect(delay);
          delay.connect(wetGain);
          return [delay, feedback];
        },
      );
      const apply = (fx: EffectDescriptor) => {
        delay.delayTime.value = numberParam(fx, "time", 0.25, 0, 5);
        feedback.gain.value = numberParam(fx, "feedback", 0.25, 0, 0.95);
        unit.setWet(numberParam(fx, "wet", 0.35, 0, 1));
        return true;
      };
      apply(effect);
      return { ...unit, update: apply };
    }
    case "reverb": {
      const convolver = ctx.createConvolver();
      const seconds = numberParam(effect, "seconds", 1.5, 0.01, 10);
      const decay = numberParam(effect, "decay", 2, 0.01, 12);
      convolver.buffer = createImpulse(ctx, seconds, decay);
      const unit = createWetDryEffect(
        ctx,
        numberParam(effect, "wet", 0.25, 0, 1),
        (input, wetGain) => {
          input.connect(convolver);
          convolver.connect(wetGain);
          return [convolver];
        },
      );
      const apply = (fx: EffectDescriptor) => {
        // A different impulse needs a new convolver: ask for a rebuild.
        if (
          numberParam(fx, "seconds", 1.5, 0.01, 10) !== seconds ||
          numberParam(fx, "decay", 2, 0.01, 12) !== decay
        )
          return false;
        unit.setWet(numberParam(fx, "wet", 0.25, 0, 1));
        return true;
      };
      return { ...unit, update: apply };
    }
    default:
      return null;
  }
}

const BUILT_IN_EFFECT_FACTORIES: Record<string, EffectFactory> =
  Object.fromEntries(
    EFFECT_OPTIONS.map((type) => [type, builtInEffectFactory]),
  ) as Record<string, EffectFactory>;

function getPluginRegistry(): Record<string, EffectFactory> {
  const g = globalThis as Record<string, unknown>;
  const userRegistry =
    g.__nbplayPlugins && typeof g.__nbplayPlugins === "object"
      ? (g.__nbplayPlugins as Record<string, EffectFactory>)
      : {};
  const registry = Object.create(null) as Record<string, EffectFactory>;
  Object.entries(userRegistry).forEach(([name, factory]) => {
    if (typeof factory === "function") registry[name] = factory;
  });
  Object.assign(registry, BUILT_IN_EFFECT_FACTORIES);
  return registry;
}

function createEffectChain(
  ctx: AudioContext,
  effects: EffectDescriptor[] = [],
): EffectUnit[] {
  const registry = getPluginRegistry();
  return effects
    .map((effect) => {
      try {
        const factory = Object.prototype.hasOwnProperty.call(
          registry,
          effect.type,
        )
          ? registry[effect.type]
          : undefined;
        return asEffectUnit(factory?.(ctx, effect));
      } catch (error) {
        console.warn("nbplay mixer effect plugin failed", effect.type, error);
        return null;
      }
    })
    .filter((effect): effect is EffectUnit => effect !== null);
}

function connectEffectChain(
  source: AudioNode,
  effects: EffectUnit[],
  destination: AudioNode,
): void {
  let output: AudioNode = source;
  effects.forEach((effect) => {
    output.connect(effect.input);
    output = effect.output;
  });
  output.connect(destination);
}

function defaultEffect(type: string): EffectDescriptor {
  if (type === "filter")
    return { type, filter_type: "lowpass", frequency: 1200, q: 1 };
  if (type === "compressor")
    return {
      type,
      threshold: -24,
      knee: 30,
      ratio: 12,
      attack: 0.003,
      release: 0.25,
    };
  if (type === "limiter") return { type, threshold: -1, release: 0.05 };
  if (type === "delay") return { type, time: 0.25, feedback: 0.25, wet: 0.35 };
  if (type === "reverb") return { type, seconds: 1.5, decay: 2, wet: 0.25 };
  return { type: "gain", gain: 1 };
}

function effectLabel(effect: EffectDescriptor): string {
  if (effect.type === "filter") {
    return `${effect.filter_type || "filter"} ${Math.round(Number(effect.frequency) || 0)}Hz`;
  }
  return effect.type;
}

// Shared Audio Bus

/** Point the chain's output at `target` (analysers only listen). */
function chainOutput(source: AudioNode, effects: EffectUnit[]): AudioNode {
  return effects.length ? effects[effects.length - 1].output : source;
}

/**
 * Bring an existing chain up to date with new descriptors. Returns true
 * when every unit could be updated in place (same types, same length, and
 * each unit accepted its new parameters).
 */
function updateEffectChain(
  effects: EffectUnit[],
  previous: EffectDescriptor[],
  next: EffectDescriptor[],
): boolean {
  if (effects.length !== next.length || previous.length !== next.length)
    return false;
  for (let i = 0; i < next.length; i++) {
    if (previous[i].type !== next[i].type) return false;
  }
  for (let i = 0; i < next.length; i++) {
    if (JSON.stringify(previous[i]) === JSON.stringify(next[i])) continue;
    const update = effects[i].update;
    if (!update || !update(next[i])) return false;
  }
  return true;
}

function measureLevel(
  analyser: AnalyserNode | null,
  buffer: Float32Array<ArrayBuffer>,
): MeterLevel {
  if (!analyser) return { peak: 0, rms: 0 };
  analyser.getFloatTimeDomainData(buffer);
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = Math.abs(buffer[i]);
    if (v > peak) peak = v;
    sum += buffer[i] * buffer[i];
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, buffer.length)) };
}

function createAudioBus() {
  let audioCtx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let masterEffects: EffectUnit[] = [];
  let masterDescriptors: EffectDescriptor[] = [];
  let masterAnalyser: AnalyserNode | null = null;
  let masterChainBuilt = false;
  const channelNodes: ChannelNode[] = [];
  const meterBuffer = new Float32Array(256);

  function createAnalyser(): AnalyserNode | null {
    if (!audioCtx?.createAnalyser) return null;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    return analyser;
  }

  return {
    init(sessionId: string): void {
      if (audioCtx) return;
      // Adopt the session's AudioContext if another widget (e.g. the
      // transport clock) already created it, so timing and audio share
      // one clock. The bus itself is only created once audio is available.
      const existing = getSessionBus(sessionId);
      audioCtx = existing
        ? ensureBusAudioContext(existing)
        : createAudioContext();
      if (!audioCtx) return;
      masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      masterAnalyser = createAnalyser();
    },

    syncChannels(
      channels: Channel[],
      masterGainValue: number,
      masterEffectsValue: EffectDescriptor[] = [],
    ): void {
      if (!audioCtx || !masterGain) return;
      while (channelNodes.length < channels.length) {
        const g = audioCtx.createGain();
        const p = audioCtx.createStereoPanner();
        g.connect(p);
        p.connect(masterGain);
        channelNodes.push({
          gain: g,
          pan: p,
          effects: [],
          descriptors: [],
          analyser: createAnalyser(),
        });
        const node = channelNodes[channelNodes.length - 1];
        if (node.analyser) p.connect(node.analyser);
      }
      while (channelNodes.length > channels.length) {
        const n = channelNodes.pop()!;
        disposeEffects(n.effects);
        n.gain.disconnect();
        n.pan.disconnect();
        disconnectNode(n.analyser);
      }

      // Insert chains: update parameters in place when the chain's shape
      // is unchanged, rebuild only the chains whose structure changed.
      channelNodes.forEach((n, i) => {
        const next = (channels[i]?.effects || []).map((fx) => ({ ...fx }));
        if (
          n.descriptors.length === next.length &&
          JSON.stringify(n.descriptors) === JSON.stringify(next)
        )
          return;
        if (updateEffectChain(n.effects, n.descriptors, next)) {
          n.descriptors = next;
          return;
        }
        disconnectNode(n.pan);
        disposeEffects(n.effects);
        n.effects = createEffectChain(audioCtx!, next);
        n.descriptors = next;
        connectEffectChain(n.pan, n.effects, masterGain!);
        if (n.analyser) chainOutput(n.pan, n.effects).connect(n.analyser);
      });

      const nextMaster = (masterEffectsValue || []).map((fx) => ({ ...fx }));
      if (
        !masterChainBuilt ||
        JSON.stringify(masterDescriptors) !== JSON.stringify(nextMaster)
      ) {
        if (
          masterChainBuilt &&
          updateEffectChain(masterEffects, masterDescriptors, nextMaster)
        ) {
          masterDescriptors = nextMaster;
        } else {
          disconnectNode(masterGain);
          disposeEffects(masterEffects);
          masterEffects = createEffectChain(audioCtx, nextMaster);
          masterDescriptors = nextMaster;
          masterChainBuilt = true;
          connectEffectChain(masterGain, masterEffects, audioCtx.destination);
          if (masterAnalyser)
            chainOutput(masterGain, masterEffects).connect(masterAnalyser);
        }
      }

      const hasSolo = channels.some((ch) => ch.solo);
      channels.forEach((ch, i) => {
        const n = channelNodes[i];
        let g = ch.gain;
        if (ch.mute || (hasSolo && !ch.solo)) g = 0;
        n.gain.gain.value = g;
        n.pan.pan.value = ch.pan;
      });
      masterGain.gain.value = masterGainValue;
    },

    /** Current peak/RMS per channel and for the master bus. */
    levels(): { channels: MeterLevel[]; master: MeterLevel } | null {
      if (!audioCtx) return null;
      return {
        channels: channelNodes.map((n) =>
          measureLevel(n.analyser, meterBuffer),
        ),
        master: measureLevel(masterAnalyser, meterBuffer),
      };
    },

    register(sessionId: string): void {
      if (!audioCtx || !masterGain) return;
      // Mutate the bus in place: other widgets hold references to it.
      const bus = getOrCreateSessionBus(sessionId);
      bus.audioCtx = audioCtx;
      bus.masterGain = masterGain;
      bus.channels = channelNodes;
      Object.defineProperty(bus, "plugins", {
        configurable: true,
        enumerable: true,
        get: getPluginRegistry,
      });
      // Notify widgets (e.g. samplers) that the bus is now available
      document.dispatchEvent(
        new CustomEvent("nbplay-bus-ready", { detail: { sessionId } }),
      );
    },

    destroy(sessionId: string): void {
      const bus = getSessionBus(sessionId);
      if (bus) {
        delete bus.audioCtx;
        delete bus.masterGain;
        delete bus.channels;
        delete bus.plugins;
        if (Object.keys(bus).length === 0) {
          const g = globalThis as Record<string, unknown>;
          delete (g.__nbplay as Record<string, unknown>)[sessionId];
        }
      }
      channelNodes.forEach((n) => {
        disposeEffects(n.effects);
        n.gain.disconnect();
        n.pan.disconnect();
        disconnectNode(n.analyser);
      });
      channelNodes.length = 0;
      disposeEffects(masterEffects);
      masterDescriptors = [];
      masterChainBuilt = false;
      disconnectNode(masterAnalyser);
      masterAnalyser = null;
      if (masterGain) masterGain.disconnect();
      if (audioCtx && audioCtx.state !== "closed") audioCtx.close();
      audioCtx = null;
      masterGain = null;
      masterEffects = [];
    },
  };
}

// Channel strip builder

function buildChannelStrip(ch: Channel, index: number): HTMLDivElement {
  const strip = document.createElement("div");
  strip.className = "nbplay-mixer-strip";
  strip.dataset.index = String(index);
  const effects = ch.effects || [];
  const safeName = escapeHtml(ch.name);
  const effectOptions = EFFECT_OPTIONS.map(
    (type) =>
      `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`,
  ).join("");
  const effectChips = effects
    .map(
      (effect, fxIndex) =>
        `<button class="nbplay-strip-fx-chip" data-fx-index="${fxIndex}" title="Remove effect">${escapeHtml(effectLabel(effect))}</button>`,
    )
    .join("");

  strip.innerHTML = `
    <div class="nbplay-strip-name" title="${safeName}">${safeName}</div>
    <div class="nbplay-strip-fader-section">
      <div class="nbplay-strip-meter">
        <div class="nbplay-strip-meter-fill"></div>
      </div>
      <input type="range" class="nbplay-strip-fader" min="0" max="2" step="0.01"
             value="${escapeHtml(ch.gain)}" orient="vertical" />
      <div class="nbplay-strip-gain-label">${fmtGain(ch.gain)}</div>
    </div>
    <div class="nbplay-strip-pan-section">
      <span class="nbplay-strip-pan-label">${fmtPan(ch.pan)}</span>
      <input type="range" class="nbplay-strip-pan" min="-1" max="1" step="0.01"
             value="${escapeHtml(ch.pan)}" />
    </div>
    <div class="nbplay-strip-buttons">
      <button class="nbplay-strip-btn nbplay-mute-btn${ch.mute ? " active" : ""}">M</button>
      <button class="nbplay-strip-btn nbplay-solo-btn${ch.solo ? " active" : ""}">S</button>
    </div>
    <div class="nbplay-strip-effects">
      <div class="nbplay-strip-fx-add">
        <select class="nbplay-strip-fx-select" title="Effect type">
          ${effectOptions}
        </select>
        <button class="nbplay-strip-fx-add-btn" title="Add effect">+</button>
      </div>
      <div class="nbplay-strip-fx-list">
        ${effectChips}
      </div>
    </div>
    <button class="nbplay-strip-remove" title="Remove channel">\u00d7</button>
  `;

  return strip;
}

// Master strip builder

function buildMasterStrip(
  gain: number,
  effects: EffectDescriptor[],
): HTMLDivElement {
  const strip = document.createElement("div");
  strip.className = "nbplay-mixer-strip nbplay-master-strip";
  const effectOptions = EFFECT_OPTIONS.map(
    (type) =>
      `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`,
  ).join("");
  const effectChips = effects
    .map(
      (effect, fxIndex) =>
        `<button class="nbplay-strip-fx-chip" data-fx-index="${fxIndex}" title="Remove effect">${escapeHtml(effectLabel(effect))}</button>`,
    )
    .join("");

  strip.innerHTML = `
    <div class="nbplay-strip-name">Master</div>
    <div class="nbplay-strip-fader-section">
      <div class="nbplay-strip-meter">
        <div class="nbplay-strip-meter-fill"></div>
      </div>
      <input type="range" class="nbplay-strip-fader nbplay-master-fader" min="0" max="2"
             step="0.01" value="${escapeHtml(gain)}" orient="vertical" />
      <div class="nbplay-strip-gain-label">${fmtGain(gain)}</div>
    </div>
    <div class="nbplay-strip-effects">
      <div class="nbplay-strip-fx-add">
        <select class="nbplay-strip-fx-select" title="Master effect type">
          ${effectOptions}
        </select>
        <button class="nbplay-strip-fx-add-btn" title="Add master effect">+</button>
      </div>
      <div class="nbplay-strip-fx-list">
        ${effectChips}
      </div>
    </div>
  `;

  return strip;
}

// Widget render

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const root = document.createElement("div");
  root.className = "nbplay-mixer";
  root.innerHTML = `
    <div class="nbplay-mixer-header">
      <h3>nbplay</h3>
      <span class="nbplay-badge">mixer</span>
      <button class="nbplay-mixer-add-btn" title="Add channel">+ Channel</button>
    </div>
    <div class="nbplay-mixer-console"></div>
  `;
  el.appendChild(root);

  const console_ = root.querySelector(
    ".nbplay-mixer-console",
  ) as HTMLDivElement;
  const addBtn = root.querySelector(
    ".nbplay-mixer-add-btn",
  ) as HTMLButtonElement;

  // Audio bus for session routing
  const audioBus = createAudioBus();
  const sessionId = model.get("session_id") as string;
  if (sessionId) {
    audioBus.init(sessionId);
    audioBus.syncChannels(
      (model.get("channels") as Channel[]) || [],
      model.get("master_gain") as number,
      (model.get("master_effects") as EffectDescriptor[]) || [],
    );
    audioBus.register(sessionId);
  }

  let domChannelCount = -1;
  let domEffectSignature = "";
  let dragging = false;
  let pendingRebuild = false;

  // In-place sync

  function syncStrips(): void {
    const channels = (model.get("channels") as Channel[]) || [];
    const strips = console_.querySelectorAll(
      ".nbplay-mixer-strip:not(.nbplay-master-strip)",
    );

    strips.forEach((strip, i) => {
      if (i >= channels.length) return;
      const ch = channels[i];

      const fader = strip.querySelector(
        ".nbplay-strip-fader",
      ) as HTMLInputElement;
      if (fader && document.activeElement !== fader) {
        fader.value = String(ch.gain);
      }
      const gainLabel = strip.querySelector(
        ".nbplay-strip-gain-label",
      ) as HTMLDivElement;
      if (gainLabel) gainLabel.textContent = fmtGain(ch.gain);

      const pan = strip.querySelector(".nbplay-strip-pan") as HTMLInputElement;
      if (pan && document.activeElement !== pan) {
        pan.value = String(ch.pan);
      }
      const panLabel = strip.querySelector(
        ".nbplay-strip-pan-label",
      ) as HTMLSpanElement;
      if (panLabel) panLabel.textContent = fmtPan(ch.pan);

      const muteBtn = strip.querySelector(
        ".nbplay-mute-btn",
      ) as HTMLButtonElement;
      if (muteBtn) muteBtn.classList.toggle("active", !!ch.mute);

      const soloBtn = strip.querySelector(
        ".nbplay-solo-btn",
      ) as HTMLButtonElement;
      if (soloBtn) soloBtn.classList.toggle("active", !!ch.solo);

      const nameEl = strip.querySelector(
        ".nbplay-strip-name",
      ) as HTMLDivElement;
      if (nameEl) {
        nameEl.textContent = ch.name;
        nameEl.title = ch.name;
      }
    });

    const masterFader = console_.querySelector(
      ".nbplay-master-fader",
    ) as HTMLInputElement | null;
    if (masterFader && document.activeElement !== masterFader) {
      masterFader.value = String(model.get("master_gain"));
    }
    const masterLabel = console_.querySelector(
      ".nbplay-master-strip .nbplay-strip-gain-label",
    ) as HTMLDivElement | null;
    if (masterLabel)
      masterLabel.textContent = fmtGain(model.get("master_gain") as number);
  }

  // Full rebuild

  function currentEffectSignature(
    channels = (model.get("channels") as Channel[]) || [],
  ): string {
    return JSON.stringify({
      channels: channels.map((ch) => ch.effects || []),
      master: (model.get("master_effects") as EffectDescriptor[]) || [],
    });
  }

  function rebuild(): void {
    if (dragging) {
      pendingRebuild = true;
      return;
    }

    console_.innerHTML = "";
    const channels = (model.get("channels") as Channel[]) || [];
    domChannelCount = channels.length;
    domEffectSignature = currentEffectSignature(channels);

    channels.forEach((ch, i) => {
      const strip = buildChannelStrip(ch, i);
      console_.appendChild(strip);

      const fader = strip.querySelector(
        ".nbplay-strip-fader",
      ) as HTMLInputElement;
      const gainLabel = strip.querySelector(
        ".nbplay-strip-gain-label",
      ) as HTMLDivElement;
      fader.addEventListener("pointerdown", () => {
        dragging = true;
      });
      fader.addEventListener("input", () => {
        const val = parseFloat(fader.value);
        gainLabel.textContent = fmtGain(val);
        updateChannel(i, "gain", val);
      });
      fader.addEventListener("pointerup", endDrag);
      fader.addEventListener("lostpointercapture", endDrag);
      fader.addEventListener("change", endDrag);

      // Gain label: double-click to edit — shows/accepts dB values
      makeEditable(gainLabel, {
        className: "nbplay-mixer-inline-edit",
        getValue: () => {
          const ch = ((model.get("channels") as Channel[]) || [])[i];
          const g = ch ? ch.gain : 0.8;
          const db = linearToDb(g);
          if (!isFinite(db)) return "-inf";
          return (db >= 0 ? "+" : "") + db.toFixed(1);
        },
        parse: (raw: string) => parseDbInput(raw),
        apply: (v) => updateChannel(i, "gain", v as number),
        sync: () => {
          const ch = ((model.get("channels") as Channel[]) || [])[i];
          gainLabel.textContent = fmtGain(ch?.gain ?? 0.8);
        },
      });

      // Pan
      const pan = strip.querySelector(".nbplay-strip-pan") as HTMLInputElement;
      const panLabel = strip.querySelector(
        ".nbplay-strip-pan-label",
      ) as HTMLSpanElement;
      pan.addEventListener("pointerdown", () => {
        dragging = true;
      });
      pan.addEventListener("input", () => {
        const val = parseFloat(pan.value);
        panLabel.textContent = fmtPan(val);
        updateChannel(i, "pan", val);
      });
      pan.addEventListener("pointerup", endDrag);
      pan.addEventListener("lostpointercapture", endDrag);
      pan.addEventListener("change", endDrag);

      // Pan label: double-click to edit
      makeEditable(panLabel, {
        className: "nbplay-mixer-inline-edit",
        getValue: () => {
          const ch = ((model.get("channels") as Channel[]) || [])[i];
          return ch ? String(ch.pan) : "0";
        },
        parse: (raw: string) => {
          const v = parseFloat(raw);
          if (isNaN(v)) return null;
          return Math.max(-1, Math.min(1, Math.round(v * 100) / 100));
        },
        apply: (v) => updateChannel(i, "pan", v as number),
        sync: () => {
          const ch = ((model.get("channels") as Channel[]) || [])[i];
          panLabel.textContent = fmtPan(ch?.pan ?? 0);
        },
      });

      // Mute
      const muteBtn = strip.querySelector(
        ".nbplay-mute-btn",
      ) as HTMLButtonElement;
      muteBtn.addEventListener("click", () => {
        const cur = ((model.get("channels") as Channel[]) || [])[i];
        if (cur) updateChannel(i, "mute", !cur.mute);
      });

      // Solo
      const soloBtn = strip.querySelector(
        ".nbplay-solo-btn",
      ) as HTMLButtonElement;
      soloBtn.addEventListener("click", () => {
        const cur = ((model.get("channels") as Channel[]) || [])[i];
        if (cur) updateChannel(i, "solo", !cur.solo);
      });

      const fxSelect = strip.querySelector(
        ".nbplay-strip-fx-select",
      ) as HTMLSelectElement;
      const fxAddBtn = strip.querySelector(
        ".nbplay-strip-fx-add-btn",
      ) as HTMLButtonElement;
      fxAddBtn.addEventListener("click", () => {
        updateChannelEffects(i, [
          ...(((model.get("channels") as Channel[]) || [])[i]?.effects || []),
          defaultEffect(fxSelect.value),
        ]);
      });
      strip.querySelectorAll(".nbplay-strip-fx-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const fxIndex = parseInt(
            (chip as HTMLElement).dataset.fxIndex || "-1",
            10,
          );
          const current =
            ((model.get("channels") as Channel[]) || [])[i]?.effects || [];
          updateChannelEffects(
            i,
            current.filter((_, idx) => idx !== fxIndex),
          );
        });
      });

      // Remove
      const removeBtn = strip.querySelector(
        ".nbplay-strip-remove",
      ) as HTMLButtonElement;
      removeBtn.addEventListener("click", () => {
        const chs = [...((model.get("channels") as Channel[]) || [])];
        chs.splice(i, 1);
        model.set("channels", chs);
        model.save_changes();
      });
    });

    // Master strip
    const masterStrip = buildMasterStrip(
      model.get("master_gain") as number,
      (model.get("master_effects") as EffectDescriptor[]) || [],
    );
    console_.appendChild(masterStrip);

    const masterFader = masterStrip.querySelector(
      ".nbplay-master-fader",
    ) as HTMLInputElement;
    const masterLabel = masterStrip.querySelector(
      ".nbplay-strip-gain-label",
    ) as HTMLDivElement;
    masterFader.addEventListener("pointerdown", () => {
      dragging = true;
    });
    masterFader.addEventListener("input", () => {
      const val = parseFloat(masterFader.value);
      masterLabel.textContent = fmtGain(val);
      model.set("master_gain", val);
      model.save_changes();
    });
    masterFader.addEventListener("pointerup", endDrag);
    masterFader.addEventListener("lostpointercapture", endDrag);

    // Master label: double-click to edit — shows/accepts dB values
    makeEditable(masterLabel, {
      className: "nbplay-mixer-inline-edit",
      getValue: () => {
        const g = model.get("master_gain") as number;
        const db = linearToDb(g);
        if (!isFinite(db)) return "-inf";
        return (db >= 0 ? "+" : "") + db.toFixed(1);
      },
      parse: (raw: string) => parseDbInput(raw),
      apply: (v) => {
        model.set("master_gain", v);
        model.save_changes();
      },
      sync: () => {
        masterLabel.textContent = fmtGain(model.get("master_gain") as number);
      },
    });
    const masterFxSelect = masterStrip.querySelector(
      ".nbplay-strip-fx-select",
    ) as HTMLSelectElement;
    const masterFxAddBtn = masterStrip.querySelector(
      ".nbplay-strip-fx-add-btn",
    ) as HTMLButtonElement;
    masterFxAddBtn.addEventListener("click", () => {
      const effects = (model.get("master_effects") as EffectDescriptor[]) || [];
      model.set("master_effects", [
        ...effects,
        defaultEffect(masterFxSelect.value),
      ]);
      model.save_changes();
    });
    masterStrip.querySelectorAll(".nbplay-strip-fx-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const fxIndex = parseInt(
          (chip as HTMLElement).dataset.fxIndex || "-1",
          10,
        );
        const effects =
          (model.get("master_effects") as EffectDescriptor[]) || [];
        model.set(
          "master_effects",
          effects.filter((_, idx) => idx !== fxIndex),
        );
        model.save_changes();
      });
    });
    masterFader.addEventListener("change", endDrag);
  }

  function endDrag(): void {
    if (!dragging) return;
    dragging = false;
    if (pendingRebuild) {
      pendingRebuild = false;
      rebuild();
    }
  }

  function updateChannel(index: number, key: string, value: unknown): void {
    const chs = [...((model.get("channels") as Channel[]) || [])];
    if (index < chs.length) {
      chs[index] = { ...chs[index], [key]: value };
      model.set("channels", chs);
      model.save_changes();
    }
  }

  function updateChannelEffects(
    index: number,
    effects: EffectDescriptor[],
  ): void {
    updateChannel(index, "effects", effects);
  }

  function onModelChange(): void {
    const channels = (model.get("channels") as Channel[]) || [];
    if (
      channels.length !== domChannelCount ||
      currentEffectSignature(channels) !== domEffectSignature
    ) {
      rebuild();
    } else {
      syncStrips();
    }
    if (model.get("session_id")) {
      audioBus.syncChannels(
        channels,
        model.get("master_gain") as number,
        (model.get("master_effects") as EffectDescriptor[]) || [],
      );
    }
  }

  // Add channel
  addBtn.addEventListener("click", () => {
    const chs = [...((model.get("channels") as Channel[]) || [])];
    const n = chs.length + 1;
    chs.push({
      name: "Ch " + n,
      gain: 0.8,
      pan: 0.0,
      mute: false,
      solo: false,
      effects: [],
    });
    model.set("channels", chs);
    model.save_changes();
  });

  // Model observers
  model.on("change:channels", onModelChange);
  model.on("change:master_gain", onModelChange);
  model.on("change:master_effects", onModelChange);

  // Initial render
  rebuild();

  // Cleanup
  // VU meters: peak level per strip from the bus analysers, ~30 fps.
  let meterFrame: number | null = null;
  let lastMeterMs = 0;

  function applyLevel(strip: Element | null, level: MeterLevel): void {
    const fill = strip?.querySelector(
      ".nbplay-strip-meter-fill",
    ) as HTMLElement | null;
    if (!fill || !strip) return;
    const db = level.peak > 0 ? 20 * Math.log10(level.peak) : -Infinity;
    const pct = Math.max(0, Math.min(1, (db + 60) / 60)) * 100;
    fill.style.height = `${pct.toFixed(1)}%`;
    fill.classList.toggle("hot", level.peak >= 0.99);
    (strip as HTMLElement).dataset.peak = level.peak.toFixed(3);
  }

  function meterTick(now: number): void {
    meterFrame = requestAnimationFrame(meterTick);
    if (now - lastMeterMs < 33 || document.hidden) return;
    lastMeterMs = now;
    const levels = audioBus.levels();
    if (!levels) return;
    const strips = console_.querySelectorAll(
      ".nbplay-mixer-strip:not(.nbplay-master-strip)",
    );
    levels.channels.forEach((level, i) => applyLevel(strips[i] || null, level));
    applyLevel(console_.querySelector(".nbplay-master-strip"), levels.master);
  }

  if (sessionId && typeof requestAnimationFrame === "function") {
    meterFrame = requestAnimationFrame(meterTick);
  }

  return () => {
    if (meterFrame !== null) cancelAnimationFrame(meterFrame);
    const sid = model.get("session_id") as string;
    if (sid) audioBus.destroy(sid);
  };
}

export default { render };
