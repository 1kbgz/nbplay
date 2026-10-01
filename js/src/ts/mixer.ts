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
  /** Post-fader send level per return bus, 0-1. */
  sends?: number[];
}

interface ReturnBus {
  name: string;
  gain: number;
  effects?: EffectDescriptor[];
}

interface ChannelNode {
  gain: GainNode;
  pan: StereoPannerNode;
  effects: EffectUnit[];
  descriptors: EffectDescriptor[];
  analyser: AnalyserNode | null;
  /** One send gain per return bus, fed from the end of the insert chain. */
  sends: GainNode[];
}

interface ReturnNode {
  input: GainNode;
  gain: GainNode;
  effects: EffectUnit[];
  descriptors: EffectDescriptor[];
  analyser: AnalyserNode | null;
}

type EffectScope = "channel" | "master" | "return";

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

const CHANNEL_STRIPS =
  ".nbplay-mixer-strip:not(.nbplay-master-strip):not(.nbplay-return-strip)";

const EFFECT_OPTIONS = [
  "gain",
  "filter",
  "compressor",
  "limiter",
  "delay",
  "reverb",
];

/** One editable parameter of an effect descriptor. */
interface ParamSpec {
  key: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  kind: "number" | "select" | "text" | "bool";
}

const FILTER_TYPES = [
  "lowpass",
  "highpass",
  "bandpass",
  "notch",
  "lowshelf",
  "highshelf",
  "peaking",
];

// Ranges match the Python EffectPlugin validation.
const EFFECT_PARAMS: Record<string, ParamSpec[]> = {
  gain: [
    { key: "gain", label: "Gain", min: 0, max: 4, step: 0.01, kind: "number" },
  ],
  filter: [
    {
      key: "filter_type",
      label: "Type",
      options: FILTER_TYPES,
      kind: "select",
    },
    {
      key: "frequency",
      label: "Hz",
      min: 20,
      max: 20000,
      step: 1,
      kind: "number",
    },
    { key: "q", label: "Q", min: 0.0001, max: 100, step: 0.01, kind: "number" },
  ],
  delay: [
    { key: "time", label: "Time", min: 0, max: 5, step: 0.001, kind: "number" },
    {
      key: "feedback",
      label: "Fdbk",
      min: 0,
      max: 0.95,
      step: 0.01,
      kind: "number",
    },
    { key: "wet", label: "Wet", min: 0, max: 1, step: 0.01, kind: "number" },
  ],
  reverb: [
    {
      key: "seconds",
      label: "Size",
      min: 0.01,
      max: 10,
      step: 0.01,
      kind: "number",
    },
    {
      key: "decay",
      label: "Decay",
      min: 0.01,
      max: 12,
      step: 0.01,
      kind: "number",
    },
    { key: "wet", label: "Wet", min: 0, max: 1, step: 0.01, kind: "number" },
  ],
  compressor: [
    {
      key: "threshold",
      label: "Thresh",
      min: -100,
      max: 0,
      step: 0.5,
      kind: "number",
    },
    { key: "knee", label: "Knee", min: 0, max: 40, step: 0.5, kind: "number" },
    {
      key: "ratio",
      label: "Ratio",
      min: 1,
      max: 20,
      step: 0.1,
      kind: "number",
    },
    {
      key: "attack",
      label: "Attack",
      min: 0,
      max: 1,
      step: 0.001,
      kind: "number",
    },
    {
      key: "release",
      label: "Release",
      min: 0,
      max: 1,
      step: 0.001,
      kind: "number",
    },
  ],
  limiter: [
    {
      key: "threshold",
      label: "Thresh",
      min: -100,
      max: 0,
      step: 0.5,
      kind: "number",
    },
    {
      key: "release",
      label: "Release",
      min: 0,
      max: 1,
      step: 0.001,
      kind: "number",
    },
  ],
};

/** Editable params: the built-in table, or every JSON field of a custom plugin. */
function paramSpecs(effect: EffectDescriptor): ParamSpec[] {
  const known = EFFECT_PARAMS[effect.type];
  if (known) return known;
  return Object.entries(effect)
    .filter(([key]) => key !== "type" && key !== "enabled")
    .map(([key, value]): ParamSpec | null => {
      if (typeof value === "number") return { key, label: key, kind: "number" };
      if (typeof value === "boolean") return { key, label: key, kind: "bool" };
      if (typeof value === "string") return { key, label: key, kind: "text" };
      return null;
    })
    .filter((spec): spec is ParamSpec => spec !== null);
}

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

function isEffectEnabled(effect: EffectDescriptor): boolean {
  return effect.enabled !== false;
}

function activeEffects(effects: EffectDescriptor[] = []): EffectDescriptor[] {
  return effects.filter(isEffectEnabled).map((fx) => ({ ...fx }));
}

function toggleEffectEnabled(effect: EffectDescriptor): EffectDescriptor {
  const { enabled: _enabled, ...rest } = effect;
  return isEffectEnabled(effect) ? { ...rest, enabled: false } : rest;
}

function effectChipHtml(effect: EffectDescriptor, fxIndex: number): string {
  const bypassed = isEffectEnabled(effect) ? "" : " bypassed";
  return `<span class="nbplay-strip-fx-item"><button class="nbplay-strip-fx-chip${bypassed}" data-fx-index="${fxIndex}" title="${bypassed ? "Enable effect" : "Bypass effect"}">${escapeHtml(effectLabel(effect))}</button><button class="nbplay-strip-fx-edit" data-fx-index="${fxIndex}" title="Edit effect">\u270e</button><button class="nbplay-strip-fx-remove" data-fx-index="${fxIndex}" title="Remove effect">\u00d7</button></span>`;
}

function paramInputHtml(spec: ParamSpec, value: unknown): string {
  const key = escapeHtml(spec.key);
  if (spec.kind === "select") {
    const options = (spec.options || [])
      .map(
        (opt) =>
          `<option value="${escapeHtml(opt)}"${opt === value ? " selected" : ""}>${escapeHtml(opt)}</option>`,
      )
      .join("");
    return `<select class="nbplay-fx-param" data-key="${key}">${options}</select>`;
  }
  if (spec.kind === "bool") {
    return `<input type="checkbox" class="nbplay-fx-param" data-key="${key}"${value ? " checked" : ""} />`;
  }
  if (spec.kind === "text") {
    return `<input type="text" class="nbplay-fx-param" data-key="${key}" value="${escapeHtml(value ?? "")}" />`;
  }
  const bounds =
    spec.min !== undefined && spec.max !== undefined
      ? ` min="${spec.min}" max="${spec.max}" step="${spec.step ?? "any"}"`
      : ` step="any"`;
  const number = `<input type="number" class="nbplay-fx-param" data-key="${key}"${bounds} value="${escapeHtml(value ?? 0)}" />`;
  if (spec.min === undefined || spec.max === undefined) return number;
  return `<input type="range" class="nbplay-fx-param-range" data-key="${key}"${bounds} value="${escapeHtml(value ?? 0)}" />${number}`;
}

/** The inline parameter panel shown under a chip after its ✎ button. */
function effectEditorHtml(effect: EffectDescriptor, fxIndex: number): string {
  const rows = paramSpecs(effect)
    .map(
      (spec) =>
        `<label class="nbplay-fx-param-row"><span>${escapeHtml(spec.label)}</span>${paramInputHtml(spec, effect[spec.key])}</label>`,
    )
    .join("");
  return `<div class="nbplay-strip-fx-editor" data-fx-index="${fxIndex}">${rows || '<span class="nbplay-fx-param-none">No parameters</span>'}</div>`;
}

function parseParamInput(input: HTMLInputElement | HTMLSelectElement): unknown {
  if (input instanceof HTMLSelectElement) return input.value;
  if (input.type === "checkbox") return input.checked;
  if (input.type === "number" || input.type === "range") {
    const v = parseFloat(input.value);
    if (!Number.isFinite(v)) return undefined;
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    return clamp(
      v,
      Number.isFinite(min) ? min : -Infinity,
      Number.isFinite(max) ? max : Infinity,
    );
  }
  return input.value;
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
  const returnNodes: ReturnNode[] = [];
  const meterBuffer = new Float32Array(256);

  function disposeReturn(node: ReturnNode): void {
    disposeEffects(node.effects);
    node.input.disconnect();
    node.gain.disconnect();
    disconnectNode(node.analyser);
  }

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
      returns: ReturnBus[] = [],
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
          sends: [],
        });
        const node = channelNodes[channelNodes.length - 1];
        if (node.analyser) p.connect(node.analyser);
      }
      while (channelNodes.length > channels.length) {
        const n = channelNodes.pop()!;
        disposeEffects(n.effects);
        n.gain.disconnect();
        n.pan.disconnect();
        n.sends.forEach((send) => send.disconnect());
        disconnectNode(n.analyser);
      }

      // Return buses: input -> insert chain -> return fader -> master.
      while (returnNodes.length < returns.length) {
        const input = audioCtx.createGain();
        const gain = audioCtx.createGain();
        input.connect(gain);
        gain.connect(masterGain);
        const node: ReturnNode = {
          input,
          gain,
          effects: [],
          descriptors: [],
          analyser: createAnalyser(),
        };
        if (node.analyser) gain.connect(node.analyser);
        returnNodes.push(node);
      }
      while (returnNodes.length > returns.length) {
        disposeReturn(returnNodes.pop()!);
      }
      returnNodes.forEach((r, k) => {
        const next = activeEffects(returns[k]?.effects);
        if (JSON.stringify(r.descriptors) !== JSON.stringify(next)) {
          if (!updateEffectChain(r.effects, r.descriptors, next)) {
            disconnectNode(r.input);
            disposeEffects(r.effects);
            r.effects = createEffectChain(audioCtx!, next);
            connectEffectChain(r.input, r.effects, r.gain);
          }
          r.descriptors = next;
        }
        r.gain.gain.value = returns[k].gain;
      });

      // Insert chains: update parameters in place when the chain's shape
      // is unchanged, rebuild only the chains whose structure changed.
      channelNodes.forEach((n, i) => {
        const next = activeEffects(channels[i]?.effects);
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
        const output = chainOutput(n.pan, n.effects);
        if (n.analyser) output.connect(n.analyser);
        n.sends.forEach((send) => output.connect(send));
      });

      // Sends tap the end of each channel's chain (post-fader, post-insert).
      channelNodes.forEach((n, i) => {
        while (n.sends.length > returnNodes.length) {
          n.sends.pop()!.disconnect();
        }
        while (n.sends.length < returnNodes.length) {
          const send = audioCtx!.createGain();
          send.gain.value = 0;
          chainOutput(n.pan, n.effects).connect(send);
          send.connect(returnNodes[n.sends.length].input);
          n.sends.push(send);
        }
        const levels = channels[i]?.sends || [];
        n.sends.forEach((send, k) => {
          send.gain.value = clamp(Number(levels[k]) || 0, 0, 1);
        });
      });

      const nextMaster = activeEffects(masterEffectsValue);
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

    /** Current peak/RMS per channel, per return bus, and for the master bus. */
    levels(): {
      channels: MeterLevel[];
      returns: MeterLevel[];
      master: MeterLevel;
    } | null {
      if (!audioCtx) return null;
      return {
        channels: channelNodes.map((n) =>
          measureLevel(n.analyser, meterBuffer),
        ),
        returns: returnNodes.map((r) => measureLevel(r.analyser, meterBuffer)),
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
      bus.returns = returnNodes;
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
        delete bus.returns;
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
        n.sends.forEach((send) => send.disconnect());
        disconnectNode(n.analyser);
      });
      channelNodes.length = 0;
      returnNodes.forEach(disposeReturn);
      returnNodes.length = 0;
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

function sendsHtml(ch: Channel, returns: ReturnBus[]): string {
  if (!returns.length) return "";
  const rows = returns
    .map((ret, k) => {
      const level = clamp(Number(ch.sends?.[k]) || 0, 0, 1);
      return `<label class="nbplay-strip-send" title="Send to ${escapeHtml(ret.name)}"><span>${escapeHtml(ret.name)}</span><input type="range" class="nbplay-strip-send-level" data-return="${k}" min="0" max="1" step="0.01" value="${level}" /></label>`;
    })
    .join("");
  return `<div class="nbplay-strip-sends">${rows}</div>`;
}

function buildChannelStrip(
  ch: Channel,
  index: number,
  returns: ReturnBus[] = [],
): HTMLDivElement {
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
    .map((effect, fxIndex) => effectChipHtml(effect, fxIndex))
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
    ${sendsHtml(ch, returns)}
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

// Return strip builder

function buildReturnStrip(ret: ReturnBus, index: number): HTMLDivElement {
  const strip = document.createElement("div");
  strip.className = "nbplay-mixer-strip nbplay-return-strip";
  strip.dataset.index = String(index);
  const safeName = escapeHtml(ret.name);
  const effectOptions = EFFECT_OPTIONS.map(
    (type) =>
      `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`,
  ).join("");
  const effectChips = (ret.effects || [])
    .map((effect, fxIndex) => effectChipHtml(effect, fxIndex))
    .join("");
  strip.innerHTML = `
    <div class="nbplay-strip-name" title="${safeName}">${safeName}</div>
    <div class="nbplay-strip-fader-section">
      <div class="nbplay-strip-meter">
        <div class="nbplay-strip-meter-fill"></div>
      </div>
      <input type="range" class="nbplay-strip-fader nbplay-return-fader" min="0" max="2" step="0.01"
             value="${escapeHtml(ret.gain)}" orient="vertical" />
      <div class="nbplay-strip-gain-label">${fmtGain(ret.gain)}</div>
    </div>
    <div class="nbplay-strip-effects">
      <div class="nbplay-strip-fx-add">
        <select class="nbplay-strip-fx-select" title="Return effect type">
          ${effectOptions}
        </select>
        <button class="nbplay-strip-fx-add-btn" title="Add return effect">+</button>
      </div>
      <div class="nbplay-strip-fx-list">
        ${effectChips}
      </div>
    </div>
    <button class="nbplay-strip-remove" title="Remove return bus">\u00d7</button>
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
    .map((effect, fxIndex) => effectChipHtml(effect, fxIndex))
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
      <button class="nbplay-mixer-add-return-btn" title="Add return bus">+ Return</button>
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
  const addReturnBtn = root.querySelector(
    ".nbplay-mixer-add-return-btn",
  ) as HTMLButtonElement;

  const getReturns = () => (model.get("returns") as ReturnBus[]) || [];

  // Keep clicks inside the widget from moving focus to the notebook, which
  // makes JupyterLab scroll the active cell into view mid-interaction.
  root.tabIndex = 0;

  // Audio bus for session routing
  const audioBus = createAudioBus();
  const sessionId = model.get("session_id") as string;
  if (sessionId) {
    audioBus.init(sessionId);
    audioBus.syncChannels(
      (model.get("channels") as Channel[]) || [],
      model.get("master_gain") as number,
      (model.get("master_effects") as EffectDescriptor[]) || [],
      getReturns(),
    );
    audioBus.register(sessionId);
  }

  let domChannelCount = -1;
  let domReturnCount = -1;
  let domEffectSignature = "";
  let dragging = false;
  let pendingRebuild = false;

  // In-place sync

  function syncStrips(): void {
    const channels = (model.get("channels") as Channel[]) || [];
    const strips = console_.querySelectorAll(CHANNEL_STRIPS);

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
      syncEffectControls(strip, ch.effects || []);
      strip
        .querySelectorAll<HTMLInputElement>(".nbplay-strip-send-level")
        .forEach((input) => {
          if (document.activeElement === input) return;
          const k = parseInt(input.dataset.return || "-1", 10);
          input.value = String(clamp(Number(ch.sends?.[k]) || 0, 0, 1));
        });
    });

    const returns = getReturns();
    console_.querySelectorAll(".nbplay-return-strip").forEach((strip, k) => {
      const ret = returns[k];
      if (!ret) return;
      const fader = strip.querySelector(
        ".nbplay-strip-fader",
      ) as HTMLInputElement;
      if (fader && document.activeElement !== fader)
        fader.value = String(ret.gain);
      const label = strip.querySelector(".nbplay-strip-gain-label");
      if (label) label.textContent = fmtGain(ret.gain);
      const nameEl = strip.querySelector(".nbplay-strip-name") as HTMLElement;
      if (nameEl) {
        nameEl.textContent = ret.name;
        nameEl.title = ret.name;
      }
      syncEffectControls(strip, ret.effects || []);
    });
    const masterStripEl = console_.querySelector(".nbplay-master-strip");
    if (masterStripEl)
      syncEffectControls(
        masterStripEl,
        (model.get("master_effects") as EffectDescriptor[]) || [],
      );

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

  // Only structure (type and bypass) forces a DOM rebuild; parameter edits
  // update the chips and open editors in place so sliders keep focus.
  function currentEffectSignature(
    channels = (model.get("channels") as Channel[]) || [],
  ): string {
    const shape = (effects: EffectDescriptor[] = []) =>
      effects.map((fx) => [fx.type, isEffectEnabled(fx)]);
    return JSON.stringify({
      channels: channels.map((ch) => shape(ch.effects)),
      returns: getReturns().map((ret) => shape(ret.effects)),
      master: shape((model.get("master_effects") as EffectDescriptor[]) || []),
    });
  }

  // Effect parameter editors

  /** Keys of the editors currently open, "channel:i:fx" or "master:fx". */
  const openEditors = new Set<string>();

  function editorKey(scope: EffectScope, index: number, fx: number) {
    return scope === "master" ? `master:${fx}` : `${scope}:${index}:${fx}`;
  }

  function effectsFor(scope: EffectScope, index: number) {
    if (scope === "master")
      return (model.get("master_effects") as EffectDescriptor[]) || [];
    if (scope === "return") return getReturns()[index]?.effects || [];
    return ((model.get("channels") as Channel[]) || [])[index]?.effects || [];
  }

  function writeEffects(
    scope: EffectScope,
    index: number,
    effects: EffectDescriptor[],
  ): void {
    if (scope === "master") {
      model.set("master_effects", effects);
      model.save_changes();
    } else if (scope === "return") {
      updateReturn(index, "effects", effects);
    } else {
      updateChannelEffects(index, effects);
    }
  }

  function setEffectParam(
    scope: EffectScope,
    index: number,
    fxIndex: number,
    key: string,
    value: unknown,
  ): void {
    if (value === undefined) return;
    writeEffects(
      scope,
      index,
      effectsFor(scope, index).map((fx, idx) =>
        idx === fxIndex ? { ...fx, [key]: value } : fx,
      ),
    );
  }

  /** Update chip labels and open editor values without rebuilding the DOM. */
  function syncEffectControls(strip: Element, effects: EffectDescriptor[]) {
    strip.querySelectorAll(".nbplay-strip-fx-chip").forEach((chip) => {
      const fx =
        effects[parseInt((chip as HTMLElement).dataset.fxIndex || "-1", 10)];
      if (fx) chip.textContent = effectLabel(fx);
    });
    strip.querySelectorAll(".nbplay-strip-fx-editor").forEach((editor) => {
      const fx =
        effects[parseInt((editor as HTMLElement).dataset.fxIndex || "-1", 10)];
      if (!fx) return;
      editor
        .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          ".nbplay-fx-param, .nbplay-fx-param-range",
        )
        .forEach((input) => {
          if (document.activeElement === input) return;
          const value = fx[input.dataset.key || ""];
          if (input instanceof HTMLInputElement && input.type === "checkbox") {
            input.checked = Boolean(value);
          } else if (value !== undefined) {
            input.value = String(value);
          }
        });
    });
  }

  /** Insert editors for the open keys of this strip and wire their inputs. */
  function renderEditors(
    strip: Element,
    scope: EffectScope,
    index: number,
  ): void {
    strip
      .querySelectorAll(".nbplay-strip-fx-editor")
      .forEach((el) => el.remove());
    const effects = effectsFor(scope, index);
    strip.querySelectorAll(".nbplay-strip-fx-item").forEach((item) => {
      const editBtn = item.querySelector(
        ".nbplay-strip-fx-edit",
      ) as HTMLElement;
      const fxIndex = parseInt(editBtn?.dataset.fxIndex || "-1", 10);
      const open = openEditors.has(editorKey(scope, index, fxIndex));
      editBtn?.classList.toggle("active", open);
      if (!open || !effects[fxIndex]) return;
      item.insertAdjacentHTML(
        "afterend",
        effectEditorHtml(effects[fxIndex], fxIndex),
      );
      const editor = item.nextElementSibling as HTMLElement;
      editor
        .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          ".nbplay-fx-param, .nbplay-fx-param-range",
        )
        .forEach((input) => {
          const event =
            input instanceof HTMLSelectElement ||
            (input instanceof HTMLInputElement && input.type === "checkbox")
              ? "change"
              : "input";
          input.addEventListener(event, () => {
            const value = parseParamInput(input);
            // Keep the slider and its number box together.
            const twin = editor.querySelector<HTMLInputElement>(
              input.classList.contains("nbplay-fx-param-range")
                ? `.nbplay-fx-param[data-key="${input.dataset.key}"]`
                : `.nbplay-fx-param-range[data-key="${input.dataset.key}"]`,
            );
            if (twin && value !== undefined) twin.value = String(value);
            setEffectParam(
              scope,
              index,
              fxIndex,
              input.dataset.key || "",
              value,
            );
          });
        });
    });
  }

  function bindEffectEditors(
    strip: Element,
    scope: EffectScope,
    index: number,
  ): void {
    // A strip with an open editor widens so the parameter rows fit.
    const syncEditing = () =>
      strip.classList.toggle(
        "editing",
        strip.querySelector(".nbplay-strip-fx-editor") !== null,
      );
    strip.querySelectorAll(".nbplay-strip-fx-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fxIndex = parseInt(
          (btn as HTMLElement).dataset.fxIndex || "-1",
          10,
        );
        const key = editorKey(scope, index, fxIndex);
        if (openEditors.has(key)) openEditors.delete(key);
        else openEditors.add(key);
        renderEditors(strip, scope, index);
        syncEditing();
      });
    });
    renderEditors(strip, scope, index);
    syncEditing();
  }

  function rebuild(): void {
    if (dragging) {
      pendingRebuild = true;
      return;
    }

    console_.innerHTML = "";
    const channels = (model.get("channels") as Channel[]) || [];
    const returns = getReturns();
    domChannelCount = channels.length;
    domReturnCount = returns.length;
    domEffectSignature = currentEffectSignature(channels);

    channels.forEach((ch, i) => {
      const strip = buildChannelStrip(ch, i, returns);
      console_.appendChild(strip);

      strip
        .querySelectorAll<HTMLInputElement>(".nbplay-strip-send-level")
        .forEach((input) => {
          input.addEventListener("input", () => {
            const k = parseInt(input.dataset.return || "-1", 10);
            const cur = ((model.get("channels") as Channel[]) || [])[i];
            if (!cur || k < 0) return;
            const sends = Array.from(
              { length: getReturns().length },
              (_, idx) => clamp(Number(cur.sends?.[idx]) || 0, 0, 1),
            );
            sends[k] = clamp(parseFloat(input.value) || 0, 0, 1);
            updateChannel(i, "sends", sends);
          });
        });

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
            current.map((fx, idx) =>
              idx === fxIndex ? toggleEffectEnabled(fx) : fx,
            ),
          );
        });
      });
      strip.querySelectorAll(".nbplay-strip-fx-remove").forEach((chip) => {
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
      bindEffectEditors(strip, "channel", i);
    });

    // Return strips
    returns.forEach((ret, k) => {
      const strip = buildReturnStrip(ret, k);
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
        updateReturn(k, "gain", val);
      });
      fader.addEventListener("pointerup", endDrag);
      fader.addEventListener("lostpointercapture", endDrag);
      fader.addEventListener("change", endDrag);

      const fxSelect = strip.querySelector(
        ".nbplay-strip-fx-select",
      ) as HTMLSelectElement;
      (
        strip.querySelector(".nbplay-strip-fx-add-btn") as HTMLButtonElement
      ).addEventListener("click", () => {
        updateReturn(k, "effects", [
          ...(getReturns()[k]?.effects || []),
          defaultEffect(fxSelect.value),
        ]);
      });
      strip.querySelectorAll(".nbplay-strip-fx-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const fxIndex = parseInt(
            (chip as HTMLElement).dataset.fxIndex || "-1",
            10,
          );
          updateReturn(
            k,
            "effects",
            (getReturns()[k]?.effects || []).map((fx, idx) =>
              idx === fxIndex ? toggleEffectEnabled(fx) : fx,
            ),
          );
        });
      });
      strip.querySelectorAll(".nbplay-strip-fx-remove").forEach((btn) => {
        btn.addEventListener("click", () => {
          const fxIndex = parseInt(
            (btn as HTMLElement).dataset.fxIndex || "-1",
            10,
          );
          updateReturn(
            k,
            "effects",
            (getReturns()[k]?.effects || []).filter(
              (_, idx) => idx !== fxIndex,
            ),
          );
        });
      });
      (
        strip.querySelector(".nbplay-strip-remove") as HTMLButtonElement
      ).addEventListener("click", () => removeReturn(k));
      bindEffectEditors(strip, "return", k);
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
          effects.map((fx, idx) =>
            idx === fxIndex ? toggleEffectEnabled(fx) : fx,
          ),
        );
        model.save_changes();
      });
    });
    masterStrip.querySelectorAll(".nbplay-strip-fx-remove").forEach((chip) => {
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
    bindEffectEditors(masterStrip, "master", -1);
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

  function updateReturn(index: number, key: string, value: unknown): void {
    const returns = [...getReturns()];
    if (index < returns.length) {
      returns[index] = { ...returns[index], [key]: value };
      model.set("returns", returns);
      model.save_changes();
    }
  }

  function addReturn(): void {
    const returns = getReturns();
    const n = returns.length + 1;
    model.set("returns", [
      ...returns,
      { name: `Return ${n}`, gain: 0.8, effects: [] },
    ]);
    model.set(
      "channels",
      ((model.get("channels") as Channel[]) || []).map((ch) => ({
        ...ch,
        sends: [
          ...Array.from({ length: returns.length }, (_, k) =>
            clamp(Number(ch.sends?.[k]) || 0, 0, 1),
          ),
          0,
        ],
      })),
    );
    model.save_changes();
  }

  /** Drop a return bus and every channel's send to it. */
  function removeReturn(index: number): void {
    model.set(
      "returns",
      getReturns().filter((_, k) => k !== index),
    );
    model.set(
      "channels",
      ((model.get("channels") as Channel[]) || []).map((ch) => ({
        ...ch,
        sends: (ch.sends || []).filter((_, k) => k !== index),
      })),
    );
    model.save_changes();
  }

  function onModelChange(): void {
    const channels = (model.get("channels") as Channel[]) || [];
    if (
      channels.length !== domChannelCount ||
      getReturns().length !== domReturnCount ||
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
        getReturns(),
      );
    }
  }

  addReturnBtn.addEventListener("click", addReturn);

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
  model.on("change:returns", onModelChange);

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
    const strips = console_.querySelectorAll(CHANNEL_STRIPS);
    levels.channels.forEach((level, i) => applyLevel(strips[i] || null, level));
    const returnStrips = console_.querySelectorAll(".nbplay-return-strip");
    levels.returns.forEach((level, k) =>
      applyLevel(returnStrips[k] || null, level),
    );
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
