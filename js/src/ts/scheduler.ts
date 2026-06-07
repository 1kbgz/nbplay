// nbplay Sequencer Scheduler - timing, step advancement, voice iteration,
// oscillator triggering, probability, groove, and automation.

import { type AnyModel, createAudioContext } from "./helpers.ts";

export interface StepData {
  active: boolean;
  note: number;
  velocity: number;
  duration_ticks?: number;
  probability?: number;
}

export interface AutomationPoint {
  step: number;
  value: number;
}

export interface AutomationLane {
  trait: string;
  points: AutomationPoint[];
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

interface AudioSchedulerOptions {
  random?: () => number;
}

const RESERVED_AUTOMATION_TRAITS = new Set([
  "automation_lanes",
  "current_step",
  "is_playing",
  "voices_data",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function numberOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readStepSeconds(model: AnyModel): number {
  return computeStepTime(
    numberOr(model.get("bpm"), 120),
    numberOr(model.get("step_duration"), 0.25),
  );
}

export function computeStepTime(bpm: number, stepDuration: number): number {
  return Math.max(0.001, stepDuration) / (Math.max(1, bpm) / 60);
}

export function computeStepOffsetSeconds(
  stepIndex: number,
  stepSeconds: number,
  swing: number,
  groove: number[] = [],
): number {
  const swingOffset =
    stepIndex % 2 === 1 ? stepSeconds * 0.5 * (clamp(swing, 0, 100) / 100) : 0;
  const grooveOffset =
    groove.length > 0
      ? stepSeconds *
        (clamp(numberOr(groove[stepIndex % groove.length], 0), -50, 50) / 100)
      : 0;
  return clamp(
    swingOffset + grooveOffset,
    stepSeconds * -0.5,
    stepSeconds * 0.75,
  );
}

export function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export function advanceStep(
  currentStep: number,
  stepCount: number,
  loopEnabled: boolean,
): { nextStep: number; shouldStop: boolean } {
  const safeStepCount = Math.max(1, stepCount);
  const next = (currentStep + 1) % safeStepCount;
  const shouldStop = next === 0 && currentStep >= 0 && !loopEnabled;
  return { nextStep: shouldStop ? -1 : next, shouldStop };
}

export function shouldPlayStep(
  step: StepData,
  random: () => number = Math.random,
): boolean {
  if (!step.active) return false;
  const probability = clamp(numberOr(step.probability, 100), 0, 100);
  if (probability <= 0) return false;
  if (probability >= 100) return true;
  return random() * 100 < probability;
}

export function* iterateActiveVoices(
  voicesData: StepData[][],
  stepIndex: number,
  random: () => number = Math.random,
): Generator<{ freq: number; velocity: number; durationTicks: number }> {
  for (const voice of voicesData) {
    const step = voice[stepIndex];
    if (!step || !shouldPlayStep(step, random)) continue;
    yield {
      freq: midiToHz(numberOr(step.note, 60)),
      velocity: clamp(numberOr(step.velocity, 100), 0, 127) / 127,
      durationTicks: Math.max(0.001, numberOr(step.duration_ticks, 1)),
    };
  }
}

export function automationValueForStep(
  lane: AutomationLane,
  stepIndex: number,
): number | null {
  const points = (lane.points || [])
    .filter(
      (point) =>
        Number.isFinite(point.step) &&
        Number.isFinite(point.value) &&
        point.step >= 0,
    )
    .sort((a, b) => a.step - b.step);
  if (points.length === 0) return null;

  let selected: AutomationPoint | null = null;
  for (const point of points) {
    if (point.step <= stepIndex) {
      selected = point;
    } else {
      break;
    }
  }
  return (selected || points[points.length - 1]).value;
}

export function applyAutomationLanes(model: AnyModel, stepIndex: number): void {
  const lanes = (model.get("automation_lanes") as AutomationLane[]) || [];
  for (const lane of lanes) {
    const trait = typeof lane?.trait === "string" ? lane.trait : "";
    if (!trait || RESERVED_AUTOMATION_TRAITS.has(trait)) continue;
    const value = automationValueForStep(lane, stepIndex);
    if (value === null) continue;
    if (numberOr(model.get(trait), NaN) !== value) {
      model.set(trait, value);
    }
  }
}

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
    // Ignore if timing is in the past.
  }
}

export function resolveAudioOutput(model: AnyModel): {
  ctx: AudioContext | null;
  output: AudioNode | null;
  ownCtx: boolean;
} {
  const sid = model.get("session_id") as string;
  const idx = numberOr(model.get("channel_index"), -1);
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
  return { ctx: createAudioContext(), output: null, ownCtx: true };
}

export function voicesFromModel(model: AnyModel): StepData[][] {
  return (model.get("voices_data") as StepData[][]) || [];
}

export function createAudioScheduler(
  options: AudioSchedulerOptions = {},
): AudioScheduler {
  let audioCtx: AudioContext | null = null;
  let outputNode: AudioNode | null = null;
  let ownAudioCtx = true;
  let schedulerTimer: ReturnType<typeof setInterval> | null = null;
  let nextScheduleTime = 0;
  const scheduleAheadTime = 0.1;
  const lookAheadTime = 0.025;
  let currentSchedulerStep = -1;
  const random = options.random || Math.random;

  const self: AudioScheduler = {
    start(model: AnyModel): void {
      const resolved = resolveAudioOutput(model);
      if (!resolved.ctx) return;
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
      const stepSeconds = scheduleStep(model, nextScheduleTime);
      nextScheduleTime += stepSeconds;
    }
  }

  function scheduleStep(model: AnyModel, audioTime: number): number {
    if (!audioCtx) return readStepSeconds(model);
    const vd = voicesFromModel(model);
    const steps = vd[0] || [];
    if (vd.length === 0 || steps.length === 0) return readStepSeconds(model);

    const loopEnabled = model.get("loop_enabled") as boolean;
    const { nextStep, shouldStop } = advanceStep(
      currentSchedulerStep,
      steps.length,
      loopEnabled,
    );

    if (shouldStop) {
      model.set("is_playing", false);
      model.set("current_step", -1);
      model.save_changes();
      self.stop();
      return readStepSeconds(model);
    }

    currentSchedulerStep = nextStep;
    model.set("current_step", nextStep);
    applyAutomationLanes(model, nextStep);

    const stepSeconds = readStepSeconds(model);
    const offset = computeStepOffsetSeconds(
      nextStep,
      stepSeconds,
      numberOr(model.get("swing"), 0),
      (model.get("groove") as number[]) || [],
    );
    const scheduledTime = Math.max(audioCtx.currentTime, audioTime + offset);

    for (const { freq, velocity, durationTicks } of iterateActiveVoices(
      vd,
      nextStep,
      random,
    )) {
      scheduleOscillator(
        audioCtx,
        outputNode,
        freq,
        velocity,
        scheduledTime,
        stepSeconds * durationTicks,
      );
    }

    return stepSeconds;
  }

  return self;
}
