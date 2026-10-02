// nbplay Sequencer Scheduler - timing, step advancement, voice iteration,
// oscillator triggering, probability, groove, and automation.

import { type AnyModel } from "./helpers.ts";
import { emitBusNote, getSessionBus, type SessionClock } from "./session.ts";

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

export interface AudioScheduler {
  /** Begin scheduling steps against `clock`, aligned to its beat grid. */
  start(model: AnyModel, clock: SessionClock): void;
  /** Re-align to the clock after a seek, tempo, or loop change. */
  realign(): void;
  stop(): void;
  destroy(): void;
  isPlaying(): boolean;
}

interface AudioSchedulerOptions {
  random?: () => number;
  /** Called when a non-looping pattern reaches its end. */
  onEnd?: () => void;
}

/** Position of the next step to schedule, in clock beats and context time. */
interface StepCursor {
  beat: number;
  time: number;
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

function readStepBeats(model: AnyModel): number {
  return Math.max(0.001, numberOr(model.get("step_duration"), 0.25));
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
): Generator<{
  note: number;
  freq: number;
  velocity: number;
  durationTicks: number;
}> {
  for (const voice of voicesData) {
    const step = voice[stepIndex];
    if (!step || !shouldPlayStep(step, random)) continue;
    yield {
      note: numberOr(step.note, 60),
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

/** Schedule one note; returns its oscillator so a caller can cancel it. */
export function scheduleOscillator(
  ctx: AudioContext,
  output: AudioNode | null,
  freq: number,
  velocity: number,
  startTime: number,
  duration: number,
): OscillatorNode | null {
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
    return osc;
  } catch (_) {
    // Ignore if timing is in the past.
    return null;
  }
}

export function resolveAudioOutput(
  model: AnyModel,
  clock: SessionClock,
): { ctx: AudioContext | null; output: AudioNode | null } {
  const sid = String(model.get("session_id") || "");
  const idx = numberOr(model.get("channel_index"), -1);
  const output =
    sid && idx >= 0 ? getSessionBus(sid)?.channels?.[idx]?.gain || null : null;
  return { ctx: clock.context(), output };
}

export function voicesFromModel(model: AnyModel): StepData[][] {
  return (model.get("voices_data") as StepData[][]) || [];
}

/** Snap `beat` up to the next multiple of `stepBeats`. */
function snapUp(beat: number, stepBeats: number): number {
  return Math.ceil(beat / stepBeats - 1e-6) * stepBeats;
}

/**
 * Cursor for the step boundary to schedule next. A boundary that passed
 * less than `graceSeconds` ago is scheduled immediately rather than
 * skipped, so playback from beat 0 fires step 0 and a seek into the
 * middle of a step still sounds that step.
 */
export function alignCursor(
  model: AnyModel,
  clock: SessionClock,
  now: number,
  graceSeconds = 0.1,
): StepCursor {
  const stepBeats = readStepBeats(model);
  const spb = clock.secondsPerBeat();
  const beat = clock.beatAt(now);
  const floorBeat = Math.floor(beat / stepBeats + 1e-6) * stepBeats;
  const gridBeat =
    (beat - floorBeat) * spb < graceSeconds ? floorBeat : floorBeat + stepBeats;
  return { beat: gridBeat, time: now + (gridBeat - beat) * spb };
}

/** Advance a cursor by one step, wrapping at the clock loop end. */
export function advanceCursor(
  cursor: StepCursor,
  model: AnyModel,
  clock: SessionClock,
): StepCursor {
  const stepBeats = readStepBeats(model);
  const spb = clock.secondsPerBeat();
  let beat = cursor.beat + stepBeats;
  let time = cursor.time + stepBeats * spb;
  const loop = clock.loop;
  if (
    loop.enabled &&
    loop.endBeat > loop.startBeat &&
    beat >= loop.endBeat - 1e-9
  ) {
    const wrapped = loop.startBeat + (beat - loop.endBeat);
    const gridBeat = snapUp(wrapped, stepBeats);
    time += (gridBeat - wrapped) * spb;
    beat = gridBeat;
  }
  return { beat, time };
}

/**
 * Map a clock beat onto a pattern step index. Looping patterns repeat on
 * the absolute beat grid so that every sequencer in a session stays
 * aligned; one-shot patterns play once from beat 0 and return -1 at the end.
 */
export function stepIndexForBeat(
  beat: number,
  stepCount: number,
  stepBeats: number,
  loopEnabled: boolean,
): number {
  const safeCount = Math.max(1, stepCount);
  const patternBeats = safeCount * stepBeats;
  if (loopEnabled) {
    const pos = ((beat % patternBeats) + patternBeats) % patternBeats;
    return Math.round(pos / stepBeats) % safeCount;
  }
  if (beat < -1e-9 || beat >= patternBeats - 1e-9) return -1;
  return Math.floor(beat / stepBeats + 1e-6);
}

export function createAudioScheduler(
  options: AudioSchedulerOptions = {},
): AudioScheduler {
  let audioCtx: AudioContext | null = null;
  let outputNode: AudioNode | null = null;
  let activeClock: SessionClock | null = null;
  let activeModel: AnyModel | null = null;
  let schedulerTimer: ReturnType<typeof setInterval> | null = null;
  let cursor: StepCursor | null = null;
  const scheduleAheadTime = 0.1;
  const lookAheadTime = 0.025;
  const random = options.random || Math.random;
  // Notes handed to Web Audio: stop() silences the ones still sounding or
  // not yet started, and a realign cancels the not-yet-started ones so the
  // old position's notes do not play on top of the new one.
  let pending: { cancel: () => void; at: number; until: number }[] = [];

  function cancelPending(onlyFuture: boolean): void {
    const now = audioCtx?.currentTime ?? 0;
    pending.forEach((entry) => {
      if (onlyFuture ? entry.at > now : entry.until > now) entry.cancel();
    });
    pending = [];
  }

  const self: AudioScheduler = {
    start(model: AnyModel, clock: SessionClock): void {
      const resolved = resolveAudioOutput(model, clock);
      if (!resolved.ctx) return;
      audioCtx = resolved.ctx;
      outputNode = resolved.output;
      activeClock = clock;
      activeModel = model;
      cursor = null;

      if (audioCtx.state === "suspended") {
        void audioCtx.resume();
      }
      if (!schedulerTimer) {
        schedulerTimer = setInterval(() => {
          scheduler(model);
        }, lookAheadTime * 1000);
      }
      scheduler(model);
    },

    realign(): void {
      cancelPending(true);
      cursor = null;
      if (schedulerTimer && activeModel) scheduler(activeModel);
    },

    stop(): void {
      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
      cancelPending(false);
      cursor = null;
      activeClock = null;
      activeModel = null;
    },

    destroy(): void {
      self.stop();
      audioCtx = null;
      outputNode = null;
    },

    isPlaying(): boolean {
      return schedulerTimer !== null;
    },
  };

  function scheduler(model: AnyModel): void {
    const clock = activeClock;
    if (!audioCtx || !clock) return;
    const now = audioCtx.currentTime;
    pending = pending.filter((entry) => entry.until > now);
    // Re-align after a seek/tempo change, or if the cursor fell far behind
    // (for example after the tab was throttled in the background).
    if (!cursor || cursor.time < now - 0.5)
      cursor = alignCursor(model, clock, now);
    while (cursor.time < now + scheduleAheadTime) {
      if (!scheduleStep(model, clock, cursor)) return;
      cursor = advanceCursor(cursor, model, clock);
    }
  }

  /** Schedule one step; returns false when the pattern has ended. */
  function scheduleStep(
    model: AnyModel,
    clock: SessionClock,
    at: StepCursor,
  ): boolean {
    if (!audioCtx) return true;
    const vd = voicesFromModel(model);
    const steps = vd[0] || [];
    if (vd.length === 0 || steps.length === 0) return true;

    const stepBeats = readStepBeats(model);
    const stepIndex = stepIndexForBeat(
      at.beat,
      steps.length,
      stepBeats,
      Boolean(model.get("loop_enabled")),
    );
    if (stepIndex < 0) {
      self.stop();
      options.onEnd?.();
      return false;
    }

    model.set("current_step", stepIndex);
    applyAutomationLanes(model, stepIndex);

    const stepSeconds = stepBeats * clock.secondsPerBeat();
    const offset = computeStepOffsetSeconds(
      stepIndex,
      stepSeconds,
      numberOr(model.get("swing"), 0),
      (model.get("groove") as number[]) || [],
    );
    // Keep the grid time even when it is slightly in the past (a boundary
    // within the alignment grace): every widget then computes the same
    // time for the same step, and Web Audio starts past-due nodes at once.
    const scheduledTime = Math.max(0, at.time + offset);

    const sessionId = (model.get("session_id") as string) || "";
    // The track's instrument (sampler or synth on the bus) plays the step
    // when it has one; the built-in oscillator is the fallback.
    const channelIndex = numberOr(model.get("channel_index"), -1);
    const instrument =
      sessionId && channelIndex >= 0
        ? getSessionBus(sessionId)?.instruments?.[channelIndex]
        : undefined;
    for (const { note, freq, velocity, durationTicks } of iterateActiveVoices(
      vd,
      stepIndex,
      random,
    )) {
      const duration = stepSeconds * durationTicks;
      let cancel: (() => void) | undefined;
      if (instrument) {
        cancel =
          instrument.scheduleNote(
            note,
            Math.round(velocity * 127),
            scheduledTime,
            duration,
          ) || undefined;
      } else {
        const osc = scheduleOscillator(
          audioCtx,
          outputNode,
          freq,
          velocity,
          scheduledTime,
          duration,
        );
        if (osc) {
          cancel = () => {
            try {
              osc.stop(0);
              osc.disconnect();
            } catch (_) {
              /* already stopped */
            }
          };
        }
      }
      if (cancel)
        pending.push({
          cancel,
          at: scheduledTime,
          until: scheduledTime + duration + 1,
        });
      emitBusNote(sessionId, {
        note,
        velocity: Math.round(velocity * 127),
        type: "on",
        at: scheduledTime,
        duration: stepSeconds * durationTicks,
      });
    }
    return true;
  }

  return self;
}
