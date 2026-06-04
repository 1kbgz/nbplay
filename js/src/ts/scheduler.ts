// nbplay Sequencer Scheduler – pure scheduling engine
// Timing, step advancement, voice iteration, oscillator triggering.
// No DOM, no model sync apart from the minimum needed to read state
// and notify stop.

import { type AnyModel } from "./helpers.ts";

// ---- Types ---------------------------------------------------------------

export interface StepData {
  active: boolean;
  note: number;
  velocity: number;
  duration_ticks?: number;
}

interface NbplayBus {
  audioCtx: AudioContext;
  channels: { gain: AudioNode }[];
}

export interface AudioScheduler {
  start(model: AnyModel): void;
  stop(): void;
  destroy(): void;
  isPlaying(): boolean;
}

// ---- Pure helpers --------------------------------------------------------

/** Seconds per step from BPM and step-duration (beat fraction). */
export function computeStepTime(bpm: number, stepDuration: number): number {
  return stepDuration / (bpm / 60);
}

/** MIDI note number → frequency in Hz (A4 = 69 = 440 Hz). */
export function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Advance the step counter and detect whether we should stop.
 * Returns `nextStep` = -1 when stopping so callers can guard.
 */
export function advanceStep(
  currentStep: number,
  stepCount: number,
  loopEnabled: boolean,
): { nextStep: number; shouldStop: boolean } {
  const next = (currentStep + 1) % stepCount;
  const shouldStop = next === 0 && currentStep >= 0 && !loopEnabled;
  return { nextStep: shouldStop ? -1 : next, shouldStop };
}

/**
 * Yield { freq, velocity, duration } for every active voice at a given
 * step index.  Velocity is normalised 0–1.
 */
export function* iterateActiveVoices(
  voicesData: StepData[][],
  stepIndex: number,
): Generator<{ freq: number; velocity: number; durationTicks: number }> {
  for (const voice of voicesData) {
    const step = voice[stepIndex];
    if (step && step.active) {
      yield {
        freq: midiToHz(step.note),
        velocity: (step.velocity ?? 100) / 127,
        durationTicks: step.duration_ticks ?? 1,
      };
    }
  }
}

/**
 * Schedule a sine oscillator with a quick attack (5 ms) and a
 * proportional release (20 % of duration) through *output* (or
 * ctx.destination if output is null).
 */
export function scheduleOscillator(
  ctx: AudioContext,
  output: AudioNode | null,
  freq: number,
  velocity: number,
  startTime: number,
  duration: number,
): void {
  const attackTime = 0.005;
  const releaseTime = Math.min(0.05, duration * 0.2);
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(velocity, startTime + attackTime);
    gain.gain.linearRampToValueAtTime(0, startTime + duration - releaseTime);
    osc.connect(gain);
    gain.connect(output || ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch (_) {
    // Ignore if timing is in the past
  }
}

/**
 * Resolve the AudioContext + output node from the session bus, or
 * create a standalone AudioContext as fallback.
 */
export function resolveAudioOutput(model: AnyModel): {
  ctx: AudioContext;
  output: AudioNode | null;
  ownCtx: boolean;
} {
  const sid = model.get("session_id") as string;
  const idx = model.get("channel_index") as number;
  if (sid && idx >= 0) {
    const bus = (globalThis as Record<string, unknown>).__nbplay as
      | Record<string, NbplayBus>
      | undefined;
    if (bus && bus[sid] && bus[sid].channels[idx]) {
      return {
        ctx: bus[sid].audioCtx,
        output: bus[sid].channels[idx].gain,
        ownCtx: false,
      };
    }
  }
  return { ctx: new AudioContext(), output: null, ownCtx: true };
}

/** Read voices_data from the model. */
export function voicesFromModel(model: AnyModel): StepData[][] {
  return (model.get("voices_data") as StepData[][]) || [];
}

// ---- Scheduler factory ---------------------------------------------------

export function createAudioScheduler(): AudioScheduler {
  let audioCtx: AudioContext | null = null;
  let outputNode: AudioNode | null = null;
  let ownAudioCtx = true;
  let schedulerTimer: ReturnType<typeof setInterval> | null = null;
  let nextScheduleTime = 0;
  const scheduleAheadTime = 0.1;
  const lookAheadTime = 0.025;
  let currentSchedulerStep = -1;

  const self: AudioScheduler = {
    start(model: AnyModel): void {
      const resolved = resolveAudioOutput(model);
      audioCtx = resolved.ctx;
      outputNode = resolved.output;
      ownAudioCtx = resolved.ownCtx;

      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      if (!schedulerTimer) {
        currentSchedulerStep = -1;
        nextScheduleTime = audioCtx.currentTime;
        schedulerTimer = setInterval(() => {
          scheduler(model);
        }, lookAheadTime * 1000);
      }
    },

    stop(): void {
      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
      currentSchedulerStep = -1;
    },

    destroy(): void {
      self.stop();
      if (ownAudioCtx && audioCtx && audioCtx.state !== "closed") {
        audioCtx.close();
      }
      audioCtx = null;
      outputNode = null;
      ownAudioCtx = true;
    },

    isPlaying(): boolean {
      return schedulerTimer !== null;
    },
  };

  function scheduler(model: AnyModel): void {
    if (!audioCtx) return;
    const currentTime = audioCtx.currentTime;
    while (nextScheduleTime < currentTime + scheduleAheadTime) {
      scheduleStep(model, nextScheduleTime);
      nextScheduleTime += computeStepTime(
        (model.get("bpm") as number) || 120,
        (model.get("step_duration") as number) || 0.25,
      );
    }
  }

  function scheduleStep(model: AnyModel, audioTime: number): void {
    if (!audioCtx) return;
    const vd = voicesFromModel(model);
    if (vd.length === 0) return;
    const steps = vd[0] || [];
    if (steps.length === 0) return;

    const stepSeconds = computeStepTime(
      (model.get("bpm") as number) || 120,
      (model.get("step_duration") as number) || 0.25,
    );

    const loopEnabled = model.get("loop_enabled") as boolean;
    const { nextStep, shouldStop } = advanceStep(
      currentSchedulerStep,
      steps.length,
      loopEnabled,
    );

    if (shouldStop) {
      model.set("is_playing", false);
      model.save_changes();
      return;
    }

    currentSchedulerStep = nextStep;
    // Update the model for visual highlighting — do NOT call
    // save_changes() here to avoid flooding the kernel with
    // messages on every step tick.
    model.set("current_step", nextStep);

    for (const { freq, velocity } of iterateActiveVoices(vd, nextStep)) {
      scheduleOscillator(
        audioCtx!,
        outputNode,
        freq,
        velocity,
        audioTime,
        stepSeconds,
      );
    }
  }

  return self;
}
