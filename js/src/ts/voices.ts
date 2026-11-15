// Note players shared by the instruments: a synth note, an FM note and a
// sample voice, each built from a patch on a given output, so one element
// can host several sounds. Also the fallback sine voices for pads and
// keyboards, used when no sampler is routed.

import { createAudioContext } from "./helpers.ts";
import { getSessionBus } from "./session.ts";

export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

/** The sound of one synth note: an oscillator type at a level. */
export interface SynthPatch {
  type: string;
  amplitude: number;
}

/** The sound of one FM voice: a sine carrier whose frequency a sine modulator moves. */
export interface FmPatch extends Envelope {
  amplitude: number;
  /** Modulator frequency over carrier frequency. */
  ratio: number;
  /** Peak frequency deviation over modulator frequency. */
  index: number;
}

/**
 * Play one synth note on `output` at a scheduled time; noise plays a short
 * burst. Returns a canceller.
 */
export function scheduleSynthNote(
  ctx: AudioContext,
  output: AudioNode,
  patch: SynthPatch,
  note: number,
  velocity: number,
  at: number,
  duration: number,
  onEnded: () => void = () => {},
): () => void {
  const level = Math.max(0, Math.min(1, patch.amplitude)) * (velocity / 127);
  const attack = 0.005;
  const release = Math.min(0.05, duration * 0.2);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + attack);
  gain.gain.linearRampToValueAtTime(
    0,
    at + Math.max(attack, duration - release),
  );
  gain.connect(output);
  let source: AudioScheduledSourceNode;
  if (patch.type === "noise") {
    const frames = Math.max(1, Math.round(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    source = node;
  } else {
    const osc = ctx.createOscillator();
    osc.type = (
      patch.type === "square" ||
      patch.type === "saw" ||
      patch.type === "triangle"
        ? patch.type.replace("saw", "sawtooth")
        : "sine"
    ) as OscillatorType;
    osc.frequency.value = midiToHz(note);
    source = osc;
  }
  source.connect(gain);
  source.onended = () => {
    try {
      gain.disconnect();
    } catch {
      /* already disconnected */
    }
    onEnded();
  };
  source.start(at);
  source.stop(at + duration);
  return () => {
    try {
      source.stop(0);
      gain.disconnect();
    } catch {
      /* already stopped */
    }
    onEnded();
  };
}

export interface FmVoice {
  carrier: OscillatorNode;
  modulator: OscillatorNode;
  depth: GainNode;
  level: GainNode;
}

export function createFmVoice(
  ctx: AudioContext,
  output: AudioNode,
  frequency: number,
  patch: FmPatch,
): FmVoice {
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const depth = ctx.createGain();
  const level = ctx.createGain();
  carrier.frequency.value = frequency;
  modulator.frequency.value = frequency * patch.ratio;
  depth.gain.value = patch.index * frequency * patch.ratio;
  modulator.connect(depth);
  depth.connect(carrier.frequency);
  carrier.connect(level);
  level.connect(output);
  return { carrier, modulator, depth, level };
}

export function disposeFmVoice(voice: FmVoice): void {
  for (const node of [
    voice.modulator,
    voice.depth,
    voice.carrier,
    voice.level,
  ]) {
    try {
      node.disconnect();
    } catch {
      /* already disconnected */
    }
  }
}

/**
 * Play one FM note on `output` at a scheduled time, shaped by the patch's
 * ADSR; the release runs after `duration`. Returns a canceller.
 */
export function scheduleFmNote(
  ctx: AudioContext,
  output: AudioNode,
  patch: FmPatch,
  note: number,
  velocity: number,
  at: number,
  duration: number,
  onEnded: () => void = () => {},
): () => void {
  const peak = Math.max(0, Math.min(1, patch.amplitude)) * (velocity / 127);
  const voice = createFmVoice(ctx, output, midiToHz(note), patch);
  const attack = Math.min(Math.max(0, patch.attack), duration);
  const decayEnd = Math.min(
    at + attack + Math.max(0, patch.decay),
    at + duration,
  );
  const end = at + duration + Math.max(0.005, patch.release);
  const gain = voice.level.gain;
  gain.setValueAtTime(0, at);
  gain.linearRampToValueAtTime(peak, at + attack);
  gain.linearRampToValueAtTime(
    peak * patch.sustain,
    Math.max(decayEnd, at + attack),
  );
  gain.setValueAtTime(peak * patch.sustain, at + duration);
  gain.linearRampToValueAtTime(0, end);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    disposeFmVoice(voice);
    onEnded();
  };
  voice.carrier.onended = finish;
  for (const osc of [voice.modulator, voice.carrier]) {
    osc.start(at);
    osc.stop(end);
  }
  return () => {
    for (const osc of [voice.modulator, voice.carrier]) {
      try {
        osc.stop(0);
      } catch {
        /* already stopped */
      }
    }
    finish();
  };
}

export interface SampleVoiceOptions {
  buffer: AudioBuffer;
  /** Playback speed; 2 is an octave up. */
  playbackRate: number;
  loop: boolean;
  /** The part of the buffer to play, in seconds; the whole buffer when omitted. */
  region?: { offset: number; length: number };
  envelope: Envelope;
  /** Gain at the top of the attack. */
  peak: number;
  at: number;
  /** A scheduled note releases itself after this many seconds; without it the note holds until stopped. */
  duration?: number;
}

/**
 * Start one sample voice on `output`, shaped by an ADSR. Returns its nodes
 * and the time its release starts (null while held).
 */
export function startSampleVoice(
  ctx: AudioContext,
  output: AudioNode,
  options: SampleVoiceOptions,
): {
  sourceNode: AudioBufferSourceNode;
  gainNode: GainNode;
  releaseTime: number | null;
} {
  const { envelope, peak, at, duration, region } = options;
  const sourceNode = ctx.createBufferSource();
  sourceNode.buffer = options.buffer;
  sourceNode.playbackRate.value = options.playbackRate;
  sourceNode.loop = options.loop;

  const gainNode = ctx.createGain();
  gainNode.connect(output);
  sourceNode.connect(gainNode);

  const safeAttack = Math.max(envelope.attack, 0.005);
  gainNode.gain.setValueAtTime(0, at);
  gainNode.gain.linearRampToValueAtTime(peak, at + safeAttack);
  gainNode.gain.linearRampToValueAtTime(
    envelope.sustain * peak,
    at + safeAttack + envelope.decay,
  );
  if (region) sourceNode.start(at, region.offset, region.length);
  else sourceNode.start(at);
  let releaseTime: number | null = null;
  if (duration !== undefined) {
    // A scheduled note releases itself after `duration` (stop must follow
    // start, or Web Audio throws). A release during the attack or decay
    // cancels the rest of it and holds the level reached, so the gain
    // cannot rise again during the release; a later one starts from the
    // sustain level (cancelAndHoldAtTime adds no hold point once every
    // ramp has ended, and the release would then ramp from the decay's end).
    const releaseAt = at + Math.max(0.001, duration);
    releaseTime = releaseAt;
    const param = gainNode.gain as AudioParam & {
      cancelAndHoldAtTime?: (t: number) => void;
    };
    if (releaseAt >= at + safeAttack + envelope.decay) {
      param.setValueAtTime(envelope.sustain * peak, releaseAt);
    } else if (typeof param.cancelAndHoldAtTime === "function") {
      param.cancelAndHoldAtTime(releaseAt);
    } else {
      param.cancelScheduledValues(releaseAt);
      param.setValueAtTime(envelope.sustain * peak, releaseAt);
    }
    param.linearRampToValueAtTime(0, releaseAt + envelope.release);
    sourceNode.stop(releaseAt + envelope.release + 0.01);
  }
  return { sourceNode, gainNode, releaseTime };
}

export interface SineVoices {
  /** Pick the session channel to play through; resolved on each note. */
  setSession(sessionId: string, channelIndex: number): void;
  /** Start a note. With `decay`, the note fades out by itself after that many seconds. */
  noteOn(midi: number, velocity: number, decay?: number): void;
  noteOff(midi: number): void;
  stopAll(): void;
  destroy(): void;
}

export function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export function createSineVoices(): SineVoices {
  let sessionId = "";
  let channelIndex = -1;
  let ctx: AudioContext | null = null;
  let output: AudioNode | null = null;
  let ownCtx = false;
  const active = new Map<number, { osc: OscillatorNode; gain: GainNode }>();

  function resolve(): AudioContext | null {
    const bus = sessionId ? getSessionBus(sessionId) : undefined;
    if (bus?.audioCtx && channelIndex >= 0 && bus.channels?.[channelIndex]) {
      if (ctx !== bus.audioCtx) {
        if (ownCtx && ctx && ctx.state !== "closed") void ctx.close();
        ctx = bus.audioCtx;
        ownCtx = false;
      }
      output = bus.channels[channelIndex].gain;
    } else if (!ctx) {
      ctx = createAudioContext();
      ownCtx = ctx !== null;
      output = null;
    }
    if (ctx?.state === "suspended") void ctx.resume();
    return ctx;
  }

  return {
    setSession(id: string, channel: number): void {
      sessionId = id || "";
      channelIndex = Number.isFinite(channel) ? channel : -1;
    },

    noteOn(midi: number, velocity: number, decay?: number): void {
      const audio = resolve();
      if (!audio) return;
      if (active.has(midi)) this.noteOff(midi);
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = midiToHz(midi);
      const now = audio.currentTime;
      const level = (velocity / 127) * (decay ? 1 : 0.3);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level, now + 0.005);
      if (decay) {
        gain.gain.linearRampToValueAtTime(0, now + decay);
        osc.stop(now + decay + 0.05);
      }
      osc.connect(gain);
      gain.connect(output || audio.destination);
      osc.start(now);
      active.set(midi, { osc, gain });
      if (decay) {
        setTimeout(
          () => {
            if (active.get(midi)?.osc === osc) active.delete(midi);
          },
          (decay + 0.1) * 1000,
        );
      }
    },

    noteOff(midi: number): void {
      const entry = active.get(midi);
      if (!entry || !ctx) return;
      const now = ctx.currentTime;
      entry.gain.gain.cancelScheduledValues(now);
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
      entry.gain.gain.linearRampToValueAtTime(0, now + 0.05);
      try {
        entry.osc.stop(now + 0.06);
      } catch {
        /* already stopped */
      }
      active.delete(midi);
    },

    stopAll(): void {
      for (const entry of active.values()) {
        try {
          entry.osc.stop();
        } catch {
          /* already stopped */
        }
        entry.gain.disconnect();
      }
      active.clear();
    },

    destroy(): void {
      this.stopAll();
      if (ownCtx && ctx && ctx.state !== "closed") void ctx.close();
      ctx = null;
      output = null;
      ownCtx = false;
    },
  };
}
