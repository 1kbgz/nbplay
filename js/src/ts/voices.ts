// Fallback sine voices for pads and keyboards: used when no sampler is
// routed. Plays through the session mixer channel when the bus has one,
// else through a private AudioContext.

import { createAudioContext } from "./helpers.ts";
import { getSessionBus } from "./session.ts";

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
