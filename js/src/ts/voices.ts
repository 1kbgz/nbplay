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

/** The sound of one FM voice: a sine carrier whose frequency a sine modulator moves. */
export interface FmPatch extends Envelope {
  amplitude: number;
  /** Modulator frequency over carrier frequency. */
  ratio: number;
  /** Peak frequency deviation over modulator frequency. */
  index: number;
}

/**
 * The sound of one synth note: the first oscillator (`type`, which may be
 * noise), a second one `osc2Semitones` and `osc2Detune` cents away and
 * noise mixed in at their levels, a filter whose cutoff its envelope moves
 * by up to `filterEnv` octaves, the amplitude envelope, and an LFO on the
 * pitch (up to 2 semitones), the cutoff (up to 3 octaves) or the level.
 */
export interface SynthPatch extends Envelope {
  type: string;
  amplitude: number;
  osc2Type: string;
  osc2Level: number;
  osc2Semitones: number;
  osc2Detune: number;
  noiseLevel: number;
  filterType: string;
  cutoff: number;
  resonance: number;
  filterEnv: number;
  filterAttack: number;
  filterDecay: number;
  filterSustain: number;
  filterRelease: number;
  lfoTarget: string;
  lfoRate: number;
  lfoDepth: number;
}

/** The `SynthConfig` defaults: one oscillator through an open filter. */
export const SYNTH_DEFAULTS: SynthPatch = {
  type: "sine",
  amplitude: 0.8,
  osc2Type: "saw",
  osc2Level: 0,
  osc2Semitones: 0,
  osc2Detune: 0,
  noiseLevel: 0,
  filterType: "lowpass",
  cutoff: 20000,
  resonance: 0.7,
  filterEnv: 0,
  filterAttack: 0.005,
  filterDecay: 0.2,
  filterSustain: 0,
  filterRelease: 0.2,
  attack: 0.005,
  decay: 0.1,
  sustain: 1,
  release: 0.05,
  lfoTarget: "off",
  lfoRate: 5,
  lfoDepth: 0.5,
};

/** Shortest attack, so a note never starts with a click. */
const MIN_ATTACK = 0.005;

/**
 * Start an envelope on `param` at `at`: from `base` to `peak` over the
 * attack, then to `sustain` over the decay. Returns its release, which
 * ramps back to `base` from wherever the envelope is at `when` and returns
 * the time it ends.
 */
function startEnvelope(
  param: AudioParam,
  at: number,
  base: number,
  peak: number,
  sustain: number,
  attack: number,
  decay: number,
): (when: number, release: number) => number {
  const decayEnd = at + attack + decay;
  param.setValueAtTime(base, at);
  param.linearRampToValueAtTime(peak, at + attack);
  param.linearRampToValueAtTime(sustain, decayEnd);
  return (when, release) => {
    // During the attack or decay, cancel the rest and hold the level
    // reached; after it, start from the sustain level (cancelAndHoldAtTime
    // adds no hold point once every ramp has ended).
    const held = param as AudioParam & {
      cancelAndHoldAtTime?: (t: number) => void;
    };
    if (when >= decayEnd) {
      param.cancelScheduledValues(when);
      param.setValueAtTime(sustain, when);
    } else if (typeof held.cancelAndHoldAtTime === "function") {
      held.cancelAndHoldAtTime(when);
    } else {
      param.cancelScheduledValues(when);
      param.setValueAtTime(sustain, when);
    }
    const end = when + Math.max(0.005, release);
    param.linearRampToValueAtTime(base, end);
    return end;
  };
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Two seconds of white noise per context, looped by every noise source. */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

function oscillatorType(type: string): OscillatorType {
  if (type === "saw") return "sawtooth";
  if (type === "square" || type === "triangle") return type;
  return "sine";
}

/** LFO swing in each target's unit: cents of pitch, cents of cutoff, or level. */
function lfoAmount(patch: SynthPatch): number {
  const depth = Math.max(0, Math.min(1, patch.lfoDepth));
  if (patch.lfoTarget === "pitch") return depth * 200;
  if (patch.lfoTarget === "filter") return depth * 3600;
  if (patch.lfoTarget === "amplitude") return depth / 2;
  return 0;
}

/** A sounding synth voice; see `startSynthVoice`. */
export interface SynthVoice {
  /** Start the releases at `when`; the voice ends with the amplitude release. Returns that end time. */
  release(when: number): number;
  /** Stop now and free the nodes. */
  stop(): void;
  /**
   * Move the oscillators, mix, filter, level and LFO to `patch` (a change
   * of the first oscillator between a tone and noise needs a new voice);
   * envelope changes apply from the next voice.
   */
  update(patch: SynthPatch, frequency: number, level: number): void;
  /** Called once when the voice has ended or been stopped. */
  onended: (() => void) | null;
}

/**
 * Start one synth voice of `patch` at `frequency` on `output` at time `at`,
 * with `level` as the gain at the top of the attack. It holds at the
 * sustain level until `release()` (or `stop()`).
 */
export function startSynthVoice(
  ctx: BaseAudioContext,
  output: AudioNode,
  patch: SynthPatch,
  frequency: number,
  level: number,
  at: number,
): SynthVoice {
  // The first oscillator is a looped noise buffer when its type is noise.
  const tone = patch.type === "noise" ? null : ctx.createOscillator();
  let first: AudioScheduledSourceNode;
  if (tone) {
    first = tone;
  } else {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx);
    source.loop = true;
    first = source;
  }
  const second = ctx.createOscillator();
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx);
  noise.loop = true;
  const lfo = ctx.createOscillator();
  const firstGain = ctx.createGain();
  const secondGain = ctx.createGain();
  const noiseGain = ctx.createGain();
  const lfoGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  const tremolo = ctx.createGain();
  const out = ctx.createGain();

  first.connect(firstGain).connect(filter);
  second.connect(secondGain).connect(filter);
  noise.connect(noiseGain).connect(filter);
  filter.connect(amp).connect(tremolo).connect(out).connect(output);
  lfo.connect(lfoGain);

  let target = "";
  let current = patch;
  // The first time (`glideFrom` null, before the voice starts) the values
  // are set outright; later changes glide over 10 ms.
  const apply = (
    next: SynthPatch,
    hz: number,
    peak: number,
    glideFrom: number | null,
  ) => {
    const set = (param: AudioParam, value: number) => {
      if (glideFrom === null) param.value = value;
      else param.setTargetAtTime(value, glideFrom, 0.01);
    };
    if (tone) {
      tone.type = oscillatorType(next.type);
      set(tone.frequency, hz);
    }
    second.type = oscillatorType(next.osc2Type);
    set(second.frequency, hz);
    set(second.detune, next.osc2Semitones * 100 + next.osc2Detune);
    set(secondGain.gain, Math.max(0, next.osc2Level));
    set(noiseGain.gain, Math.max(0, next.noiseLevel));
    filter.type = (
      ["lowpass", "highpass", "bandpass"].includes(next.filterType)
        ? next.filterType
        : "lowpass"
    ) as BiquadFilterType;
    set(filter.frequency, next.cutoff);
    set(filter.Q, next.resonance);
    set(out.gain, Math.max(0, peak));
    set(lfo.frequency, next.lfoRate);
    const amount = lfoAmount(next);
    set(lfoGain.gain, amount);
    set(tremolo.gain, next.lfoTarget === "amplitude" ? 1 - amount : 1);
    if (next.lfoTarget !== target) {
      lfoGain.disconnect();
      if (next.lfoTarget === "pitch") {
        if (tone) lfoGain.connect(tone.detune);
        lfoGain.connect(second.detune);
      } else if (next.lfoTarget === "filter") {
        lfoGain.connect(filter.detune);
      } else if (next.lfoTarget === "amplitude") {
        lfoGain.connect(tremolo.gain);
      }
      target = next.lfoTarget;
    }
    current = next;
  };
  apply(patch, frequency, level, null);

  const attack = Math.max(MIN_ATTACK, patch.attack);
  const releaseAmp = startEnvelope(
    amp.gain,
    at,
    0,
    1,
    Math.max(0, Math.min(1, patch.sustain)),
    attack,
    Math.max(0, patch.decay),
  );
  const cents = patch.filterEnv * 1200;
  const releaseFilter = startEnvelope(
    filter.detune,
    at,
    0,
    cents,
    cents * Math.max(0, Math.min(1, patch.filterSustain)),
    Math.max(0, patch.filterAttack),
    Math.max(0, patch.filterDecay),
  );

  const sources = [first, second, noise, lfo];
  for (const source of sources) source.start(at);
  let ended = false;
  const voice: SynthVoice = {
    onended: null,
    release(when) {
      const start = Math.max(when, at);
      releaseFilter(start, current.filterRelease);
      const end = releaseAmp(start, current.release);
      for (const source of sources) source.stop(end);
      return end;
    },
    stop() {
      for (const source of sources) {
        try {
          source.stop(0);
        } catch {
          /* already stopped */
        }
      }
      finish();
    },
    update(next, hz, peak) {
      apply(next, hz, peak, ctx.currentTime);
    },
  };
  const finish = () => {
    if (ended) return;
    ended = true;
    for (const node of [
      ...sources,
      firstGain,
      secondGain,
      noiseGain,
      lfoGain,
      filter,
      amp,
      tremolo,
      out,
    ]) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    voice.onended?.();
  };
  first.onended = finish;
  return voice;
}

/**
 * Play one synth note on `output` at a scheduled time; the releases run
 * after `duration`. Returns a canceller.
 */
export function scheduleSynthNote(
  ctx: BaseAudioContext,
  output: AudioNode,
  patch: SynthPatch,
  note: number,
  velocity: number,
  at: number,
  duration: number,
  onEnded: () => void = () => {},
): () => void {
  const level = Math.max(0, Math.min(1, patch.amplitude)) * (velocity / 127);
  const voice = startSynthVoice(ctx, output, patch, midiToHz(note), level, at);
  voice.onended = onEnded;
  voice.release(at + Math.max(0.001, duration));
  return () => voice.stop();
}

/** A note that holds until it is released. */
export interface HeldNote {
  /** Start the release at `when`; the note ends after it. */
  release(when: number): void;
  /** Stop now and free the nodes. */
  stop(): void;
}

/** Start one synth note at `at` and hold it until released. */
export function startSynthNote(
  ctx: BaseAudioContext,
  output: AudioNode,
  patch: SynthPatch,
  note: number,
  velocity: number,
  at: number,
  onEnded: () => void = () => {},
): HeldNote {
  const level = Math.max(0, Math.min(1, patch.amplitude)) * (velocity / 127);
  const voice = startSynthVoice(ctx, output, patch, midiToHz(note), level, at);
  voice.onended = onEnded;
  return {
    release: (when) => void voice.release(when),
    stop: () => voice.stop(),
  };
}

export interface FmVoice {
  carrier: OscillatorNode;
  modulator: OscillatorNode;
  depth: GainNode;
  level: GainNode;
}

export function createFmVoice(
  ctx: BaseAudioContext,
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
  ctx: BaseAudioContext,
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

/** Start one FM note at `at`, shaped by the patch's ADSR, and hold it at the sustain level until released. */
export function startFmNote(
  ctx: BaseAudioContext,
  output: AudioNode,
  patch: FmPatch,
  note: number,
  velocity: number,
  at: number,
  onEnded: () => void = () => {},
): HeldNote {
  const peak = Math.max(0, Math.min(1, patch.amplitude)) * (velocity / 127);
  const voice = createFmVoice(ctx, output, midiToHz(note), patch);
  const release = startEnvelope(
    voice.level.gain,
    at,
    0,
    peak,
    peak * patch.sustain,
    Math.max(patch.attack, MIN_ATTACK),
    Math.max(0, patch.decay),
  );
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    disposeFmVoice(voice);
    onEnded();
  };
  voice.carrier.onended = finish;
  const oscillators = [voice.modulator, voice.carrier];
  oscillators.forEach((osc) => osc.start(at));
  const stopAt = (when: number) =>
    oscillators.forEach((osc) => {
      try {
        osc.stop(when);
      } catch {
        /* already stopped */
      }
    });
  return {
    release: (when) => stopAt(release(when, patch.release)),
    stop: () => {
      stopAt(0);
      finish();
    },
  };
}

/** The built-in drum sounds. */
export const DRUM_SOUNDS = ["kick", "snare", "hat", "clap", "tom"] as const;

/**
 * One built-in drum sound: `tune` in semitones from its base pitch,
 * `decay` in seconds, and `tone` from 0 to 1 (the kick's click, the
 * snare's noise against its body, the hat's brightness, the clap's band,
 * the tom's noise).
 */
export interface DrumPatch {
  sound: string;
  tune: number;
  decay: number;
  tone: number;
}

/** A gain that rises in 2 ms and falls exponentially to silence at `end`. */
function hitEnvelope(
  ctx: BaseAudioContext,
  at: number,
  end: number,
  level = 1,
): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.002);
  gain.gain.exponentialRampToValueAtTime(level * 0.001, end);
  gain.gain.setValueAtTime(0, end);
  return gain;
}

/**
 * Play one built-in drum hit on `output` at `at`, at `velocity` (0 to 127).
 * Kick and tom are sines that fall in pitch; the snare is a body under
 * high-passed noise; the hat is high-passed noise; the clap is band-passed
 * noise in four bursts. Returns a canceller.
 */
export function scheduleDrumHit(
  ctx: BaseAudioContext,
  output: AudioNode,
  patch: DrumPatch,
  velocity: number,
  at: number,
  onEnded: () => void = () => {},
): () => void {
  const pitch = 2 ** (Math.max(-48, Math.min(48, patch.tune)) / 12);
  const decay = Math.max(0.01, patch.decay);
  const tone = Math.max(0, Math.min(1, patch.tone));
  const end = at + decay;
  const out = ctx.createGain();
  out.gain.value = Math.max(0, Math.min(127, velocity)) / 127;
  out.connect(output);
  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [out];

  const noise = (filterType: BiquadFilterType, hz: number, q = 0.7) => {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = Math.min(18000, hz);
    filter.Q.value = q;
    source.connect(filter);
    sources.push(source);
    nodes.push(filter);
    return filter;
  };
  const sweep = (
    type: OscillatorType,
    from: number,
    to: number,
    time: number,
  ) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + time);
    sources.push(osc);
    return osc;
  };
  const voice = (source: AudioNode, envelope: GainNode) => {
    source.connect(envelope).connect(out);
    nodes.push(envelope);
  };

  if (patch.sound === "kick" || patch.sound === "tom") {
    const base = (patch.sound === "kick" ? 50 : 110) * pitch;
    const drop = patch.sound === "kick" ? 3.5 : 1.6;
    voice(sweep("sine", base * drop, base, 0.06), hitEnvelope(ctx, at, end));
    if (tone > 0) {
      const click = noise(
        patch.sound === "kick" ? "highpass" : "bandpass",
        patch.sound === "kick" ? 2000 : 800,
      );
      voice(click, hitEnvelope(ctx, at, at + 0.03, tone * 0.6));
    }
  } else if (patch.sound === "snare") {
    const body = 185 * pitch;
    voice(
      sweep("triangle", body * 1.3, body, 0.03),
      hitEnvelope(ctx, at, at + Math.min(decay, 0.12), 1 - tone * 0.6),
    );
    voice(noise("highpass", 1200 * pitch), hitEnvelope(ctx, at, end, tone));
  } else if (patch.sound === "hat") {
    voice(
      noise("highpass", (5000 + 7000 * tone) * pitch),
      hitEnvelope(ctx, at, end),
    );
  } else if (patch.sound === "clap") {
    const band = noise("bandpass", (900 + 1600 * tone) * pitch, 2);
    const gain = ctx.createGain();
    // Three short bursts 12 ms apart, then the tail.
    gain.gain.setValueAtTime(0, at);
    for (let i = 0; i < 3; i++) {
      const t = at + i * 0.012;
      gain.gain.setValueAtTime(1, t);
      gain.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
    }
    const tail = at + 0.036;
    gain.gain.setValueAtTime(1, tail);
    gain.gain.exponentialRampToValueAtTime(0.001, Math.max(tail + 0.01, end));
    gain.gain.setValueAtTime(0, Math.max(tail + 0.01, end));
    voice(band, gain);
  }

  const stopAt = Math.max(end, at + 0.05) + 0.01;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    for (const node of [...sources, ...nodes]) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    onEnded();
  };
  for (const source of sources) {
    source.start(at);
    source.stop(stopAt);
  }
  if (sources.length > 0) sources[0].onended = finish;
  else finish();
  return () => {
    for (const source of sources) {
      try {
        source.stop(0);
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
  ctx: BaseAudioContext,
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

  const release = startEnvelope(
    gainNode.gain,
    at,
    0,
    peak,
    envelope.sustain * peak,
    Math.max(envelope.attack, MIN_ATTACK),
    envelope.decay,
  );
  if (region) sourceNode.start(at, region.offset, region.length);
  else sourceNode.start(at);
  let releaseTime: number | null = null;
  if (duration !== undefined) {
    // A scheduled note releases itself after `duration` (stop must follow
    // start, or Web Audio throws).
    releaseTime = at + Math.max(0.001, duration);
    sourceNode.stop(release(releaseTime, envelope.release) + 0.01);
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
