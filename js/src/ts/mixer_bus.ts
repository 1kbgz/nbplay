// Mixer audio bus: the Web Audio graph behind the mixer (channel strips,
// return buses, insert chains, master), the built-in effects, the plugin
// registry and the meters. No DOM: the mixer element drives it.

import { createAudioContext } from "./helpers.ts";
import { EFFECT_TYPES, type EffectDescriptor } from "./components/effects.ts";
import {
  ensureBusAudioContext,
  getOrCreateSessionBus,
  getSessionBus,
} from "./session.ts";

export interface Channel {
  name: string;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  effects?: EffectDescriptor[];
  /** Post-fader send level per return bus, 0-1. */
  sends?: number[];
}

export interface ReturnBus {
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

export interface MeterLevel {
  peak: number;
  rms: number;
}

export interface EffectUnit {
  input: AudioNode;
  output: AudioNode;
  dispose?: () => void;
  /**
   * Apply a changed descriptor of the same type in place. Returns false
   * when the change needs the unit rebuilt (for example a new impulse).
   */
  update?: (effect: EffectDescriptor) => boolean;
}

export type EffectFactory = (
  ctx: AudioContext,
  effect: EffectDescriptor,
) => EffectUnit | AudioNode | null | undefined;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  } catch {
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
    EFFECT_TYPES.map((type) => [type, builtInEffectFactory]),
  ) as Record<string, EffectFactory>;

export function getPluginRegistry(): Record<string, EffectFactory> {
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

export function defaultEffect(type: string): EffectDescriptor {
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
  if (type === "gain") return { type, gain: 1 };
  // A registered plugin starts with no parameters; its editor infers fields.
  return { type };
}

export function isEffectEnabled(effect: EffectDescriptor): boolean {
  return effect.enabled !== false;
}

function activeEffects(effects: EffectDescriptor[] = []): EffectDescriptor[] {
  return effects.filter(isEffectEnabled).map((fx) => ({ ...fx }));
}

export function toggleEffectEnabled(
  effect: EffectDescriptor,
): EffectDescriptor {
  const { enabled: _enabled, ...rest } = effect;
  return isEffectEnabled(effect) ? { ...rest, enabled: false } : rest;
}

/** Point the chain's output at `target` (analysers only listen). */
function chainOutput(source: AudioNode, effects: EffectUnit[]): AudioNode {
  return effects.length ? effects[effects.length - 1].output : source;
}

/**
 * Bring an existing chain up to date with new descriptors. Returns true
 * when every unit could be updated in place (same types, same length, and
 * each unit accepted its new parameters).
 */

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

export function createAudioBus() {
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
      bus.masterAnalyser = masterAnalyser;
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
        delete bus.masterAnalyser;
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
