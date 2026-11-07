// Sampler engine: Web Audio playback of the main sample and multi-sample
// zones with pitch shifting, an ADSR envelope, voice stealing and scheduled
// notes. No DOM: the sampler element drives it.

import { createAudioContext } from "./helpers.ts";
import { clampVelocity } from "./pads.ts";
import { getSessionBus } from "./session.ts";

export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface Voice {
  gainNode: GainNode;
  sourceNode: AudioBufferSourceNode;
  noteNum: number;
  startTime: number;
  releaseTime: number | null;
}

export interface SampleSlice {
  index: number;
  note: number;
  start: number;
  end: number;
  label?: string;
}

/** A multi-sample zone: its own PCM answering to a note and velocity range. */
export interface Zone {
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

export interface ZoneBuffer extends Zone {
  buffer: AudioBuffer | null;
}

export function clampNote(v: unknown, fallback: number): number {
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

export function decimateSamples(
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

export function float32ToDataView(samples: Float32Array): DataView {
  const buffer = new ArrayBuffer(samples.length * 4);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    view.setFloat32(i * 4, samples[i], true);
  }
  return view;
}

export function mixToMono(buffer: AudioBuffer): Float32Array {
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

/** Decode an encoded audio file to mono PCM on a throwaway context. */
export async function decodeToMono(
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
    if (decodeCtx.state !== "closed") void decodeCtx.close();
  }
}

// Web Audio Sampler Engine

export function createSamplerEngine(initialMaxVoices = 8) {
  let maxVoices = Math.max(1, Math.round(initialMaxVoices || 8));
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

  /** Drop a voice from the pool and free its nodes; safe to call twice. */
  function retire(voice: Voice): void {
    const idx = activeVoices.indexOf(voice);
    if (idx >= 0) activeVoices.splice(idx, 1);
    try {
      voice.gainNode.disconnect();
    } catch {
      /* already disconnected */
    }
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
    setMaxVoices(count: number): void {
      maxVoices = Math.max(1, Math.round(Number(count) || 8));
    },

    setSession(sid: string, idx: number): void {
      if (sid && idx >= 0) {
        const bus = getSessionBus(sid);
        if (bus?.audioCtx && bus.channels?.[idx]) {
          if (audioCtx !== bus.audioCtx) {
            // Leaving a private context for the bus: silence it and close
            // it so nothing keeps playing outside the mixer.
            if (ownAudioCtx && audioCtx) {
              this.stopAll();
              if (audioCtx.state !== "closed") void audioCtx.close();
            }
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
      at?: number,
      duration?: number,
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

      // `at` schedules the note on the audio clock (a sequencer step); the
      // default plays it now (a key or pad).
      const now = at ?? audioCtx.currentTime;
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
        const sliceDuration = (slice.end - slice.start) / rawSampleRate;
        sourceNode.start(now, offset, sliceDuration);
      } else {
        sourceNode.start(now);
      }
      let releaseTime: number | null = null;
      if (duration !== undefined) {
        // A scheduled note releases itself after `duration` (stop must
        // follow start, or Web Audio throws). Automation past the release
        // point (a long attack or decay) is cancelled so the gain cannot
        // rise again during the release.
        const releaseAt = now + Math.max(0.001, duration);
        releaseTime = releaseAt;
        const param = gainNode.gain as AudioParam & {
          cancelAndHoldAtTime?: (t: number) => void;
        };
        if (typeof param.cancelAndHoldAtTime === "function") {
          param.cancelAndHoldAtTime(releaseAt);
        } else {
          param.cancelScheduledValues(releaseAt);
          param.setValueAtTime(envelope.sustain * peak, releaseAt);
        }
        param.linearRampToValueAtTime(0, releaseAt + envelope.release);
        sourceNode.stop(releaseAt + envelope.release + 0.01);
      }

      const voice: Voice = {
        gainNode,
        sourceNode,
        noteNum,
        startTime: now,
        releaseTime,
      };
      sourceNode.onended = () => retire(voice);
      activeVoices.push(voice);

      // Voice limit over the voices still held (scheduled notes release
      // themselves and do not count). The stolen voice stops when the new
      // one starts, which may be in the lookahead future, and stays in the
      // pool until it ends so stopAll() can still silence it.
      const held = activeVoices.filter((v) => v.releaseTime === null);
      if (held.length > maxVoices) {
        const oldest = held[0];
        oldest.releaseTime = now;
        try {
          oldest.sourceNode.stop(now);
        } catch {
          /* already stopped */
        }
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
        setTimeout(() => retire(voice), envelope.release * 1000 + 10);
      });
    },

    /** Stop one voice at once, started or not, and free it. */
    cancelVoice(voice: Voice): void {
      try {
        voice.sourceNode.stop(0);
      } catch {
        /* already stopped */
      }
      retire(voice);
    },

    getActiveVoiceCount(): number {
      return activeVoices.filter((v) => v.releaseTime === null).length;
    },

    stopAll(): void {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      [...activeVoices].forEach((voice) => {
        try {
          voice.sourceNode.stop(now);
        } catch {
          /* already stopped */
        }
        retire(voice);
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
