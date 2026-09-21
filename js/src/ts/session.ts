// nbplay session bus and shared transport clock.
//
// Every widget in a Session shares one bus object on
// `globalThis.__nbplay[sessionId]`. The bus is created lazily by whichever
// widget renders first, so render order never matters. The mixer attaches
// its audio graph to the bus; the transport, sequencers, and timeline all
// derive their timing from the bus clock, which is driven by the shared
// AudioContext so that scheduling and display never drift apart.

import { type AnyModel, createAudioContext } from "./helpers.ts";

export interface NoteEvent {
  note: number;
  velocity: number;
  type: "on" | "off";
}

export interface SamplerBus {
  triggerNote: (note: number, velocity: number) => void;
  releaseNote: (note: number) => void;
}

export interface SessionBus {
  audioCtx?: AudioContext;
  masterGain?: AudioNode;
  channels?: { gain: AudioNode }[];
  samplers?: Record<number, SamplerBus>;
  noteListeners?: Array<(evt: NoteEvent) => void>;
  plugins?: unknown;
  clock?: SessionClock;
}

export type ClockEventType =
  | "play"
  | "stop"
  | "seek"
  | "tempo"
  | "loop"
  | "record"
  | "timesig";

export interface ClockEvent {
  type: ClockEventType;
  beat: number;
}

export interface ClockLoop {
  enabled: boolean;
  startBeat: number;
  endBeat: number;
}

export interface SessionClock {
  readonly playing: boolean;
  readonly recording: boolean;
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly loop: ClockLoop;
  /** AudioContext backing this clock, created on demand. */
  context(): AudioContext | null;
  /** Current context time in seconds. */
  now(): number;
  /** Current beat position. */
  beat(): number;
  /** Beat position at a context time (loop-aware). */
  beatAt(ctxTime: number): number;
  /** Context time at which `beat` occurs, projected linearly from the origin. */
  ctxTimeAt(beat: number): number;
  secondsPerBeat(): number;
  play(): void;
  stop(): void;
  seek(beat: number): void;
  setTempo(bpm: number): void;
  setBeatsPerBar(beatsPerBar: number): void;
  setLoop(enabled: boolean, startBeat: number, endBeat: number): void;
  setRecording(recording: boolean): void;
  subscribe(listener: (event: ClockEvent) => void): () => void;
}

function busRegistry(): Record<string, SessionBus> {
  const g = globalThis as Record<string, unknown>;
  if (!g.__nbplay || typeof g.__nbplay !== "object") g.__nbplay = {};
  return g.__nbplay as Record<string, SessionBus>;
}

export function getSessionBus(sessionId: string): SessionBus | undefined {
  if (!sessionId) return undefined;
  const g = globalThis as Record<string, unknown>;
  const registry = g.__nbplay as Record<string, SessionBus> | undefined;
  return registry?.[sessionId];
}

export function getOrCreateSessionBus(sessionId: string): SessionBus {
  const registry = busRegistry();
  if (!registry[sessionId]) registry[sessionId] = {};
  return registry[sessionId];
}

/** Return the shared AudioContext for a bus, creating it once. */
export function ensureBusAudioContext(bus: SessionBus): AudioContext | null {
  if (bus.audioCtx && bus.audioCtx.state !== "closed") return bus.audioCtx;
  const ctx = createAudioContext();
  if (ctx) bus.audioCtx = ctx;
  return ctx;
}

/** Return the clock for a bus, creating it once. */
export function getBusClock(bus: SessionBus): SessionClock {
  if (!bus.clock) bus.clock = createSessionClock(bus);
  return bus.clock;
}

function clampNumber(value: unknown, fallback: number, min: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}

/**
 * Create a transport clock. `holder` supplies the AudioContext; a bus for
 * shared clocks, or a private object for a widget with no session.
 */
export function createSessionClock(
  holder: { audioCtx?: AudioContext } = {},
): SessionClock {
  let playing = false;
  let recording = false;
  let bpm = 120;
  let beatsPerBar = 4;
  let loop: ClockLoop = { enabled: false, startBeat: 0, endBeat: 16 };
  let originBeat = 0;
  let originTime = 0;
  let lastCtx: AudioContext | null = null;
  const listeners = new Set<(event: ClockEvent) => void>();

  function fallbackNow(): number {
    return performance.now() / 1000;
  }

  function contextTime(ctx: AudioContext | null): number {
    return ctx ? ctx.currentTime : fallbackNow();
  }

  function rawBeatAt(time: number): number {
    if (!playing) return originBeat;
    return originBeat + (time - originTime) * (bpm / 60);
  }

  function wrapLoop(beat: number): number {
    if (!loop.enabled || loop.endBeat <= loop.startBeat) return beat;
    if (beat < loop.endBeat) return beat;
    const span = loop.endBeat - loop.startBeat;
    return loop.startBeat + ((beat - loop.startBeat) % span);
  }

  function emit(type: ClockEventType): void {
    const event = { type, beat: self.beat() };
    listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (error) {
        console.warn("nbplay clock listener failed", error);
      }
    });
  }

  function resolveContext(): AudioContext | null {
    if (holder.audioCtx && holder.audioCtx.state === "closed") {
      delete holder.audioCtx;
    }
    if (!holder.audioCtx) {
      const ctx = createAudioContext();
      if (ctx) holder.audioCtx = ctx;
    }
    const ctx = holder.audioCtx || null;
    if (ctx !== lastCtx) {
      // The backing context changed (e.g. the mixer rendered after play
      // started). Re-anchor the origin so the beat position is continuous.
      const beat = wrapLoop(rawBeatAt(contextTime(lastCtx)));
      lastCtx = ctx;
      originBeat = beat;
      originTime = contextTime(ctx);
    }
    return ctx;
  }

  /** Move the origin to the current position without changing it. */
  function reanchor(): void {
    const ctx = resolveContext();
    const now = contextTime(ctx);
    originBeat = wrapLoop(rawBeatAt(now));
    originTime = now;
  }

  const self: SessionClock = {
    get playing() {
      return playing;
    },
    get recording() {
      return recording;
    },
    get bpm() {
      return bpm;
    },
    get beatsPerBar() {
      return beatsPerBar;
    },
    get loop() {
      return { ...loop };
    },
    context(): AudioContext | null {
      return resolveContext();
    },
    now(): number {
      return contextTime(resolveContext());
    },
    beat(): number {
      return self.beatAt(self.now());
    },
    beatAt(ctxTime: number): number {
      return wrapLoop(rawBeatAt(ctxTime));
    },
    ctxTimeAt(beat: number): number {
      resolveContext();
      return originTime + (beat - originBeat) * (60 / bpm);
    },
    secondsPerBeat(): number {
      return 60 / bpm;
    },
    play(): void {
      if (playing) return;
      const ctx = resolveContext();
      if (ctx && ctx.state === "suspended") void ctx.resume?.();
      originTime = contextTime(ctx);
      playing = true;
      emit("play");
    },
    stop(): void {
      if (!playing) return;
      const beat = self.beat();
      playing = false;
      originBeat = beat;
      emit("stop");
    },
    seek(beat: number): void {
      const ctx = resolveContext();
      originBeat = clampNumber(beat, 0, 0);
      originTime = contextTime(ctx);
      emit("seek");
    },
    setTempo(next: number): void {
      const value = clampNumber(next, bpm, 1);
      if (value === bpm) return;
      reanchor();
      bpm = value;
      emit("tempo");
    },
    setBeatsPerBar(next: number): void {
      const value = Math.max(1, Math.round(clampNumber(next, beatsPerBar, 1)));
      if (value === beatsPerBar) return;
      beatsPerBar = value;
      emit("timesig");
    },
    setLoop(enabled: boolean, startBeat: number, endBeat: number): void {
      const next = {
        enabled: Boolean(enabled),
        startBeat: clampNumber(startBeat, 0, 0),
        endBeat: clampNumber(endBeat, 0, 0),
      };
      if (
        next.enabled === loop.enabled &&
        next.startBeat === loop.startBeat &&
        next.endBeat === loop.endBeat
      )
        return;
      reanchor();
      loop = next;
      emit("loop");
    },
    setRecording(next: boolean): void {
      const value = Boolean(next);
      if (value === recording) return;
      recording = value;
      emit("record");
    },
    subscribe(listener: (event: ClockEvent) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return self;
}

export interface ClockBinding {
  /** The clock this widget currently follows. */
  clock(): SessionClock;
  /** Whether the widget is bound to a shared session clock. */
  shared(): boolean;
  dispose(): void;
}

/**
 * Bind a widget to the clock named by its `session_id` trait. Widgets with
 * no session get a private clock. The subscription follows the session bus:
 * if the bus object or the session id changes, the listener is moved to
 * the new clock and told with a `rebind` callback.
 */
export function bindClock(
  model: AnyModel,
  listener: (event: ClockEvent) => void,
  onRebind?: (clock: SessionClock) => void,
): ClockBinding {
  const privateHolder: { audioCtx?: AudioContext } = {};
  let privateClock: SessionClock | null = null;
  let current: SessionClock | null = null;
  let unsubscribe: (() => void) | null = null;

  function resolve(): SessionClock {
    const sessionId = String(model.get("session_id") || "");
    if (sessionId) return getBusClock(getOrCreateSessionBus(sessionId));
    if (!privateClock) privateClock = createSessionClock(privateHolder);
    return privateClock;
  }

  function attach(notify: boolean): SessionClock {
    const next = resolve();
    if (next === current) return next;
    unsubscribe?.();
    current = next;
    unsubscribe = next.subscribe(listener);
    if (notify) onRebind?.(next);
    return next;
  }

  attach(false);
  model.on("change:session_id", () => attach(true));

  return {
    clock: () => attach(true),
    shared: () => Boolean(model.get("session_id")),
    dispose(): void {
      unsubscribe?.();
      unsubscribe = null;
      current = null;
      if (privateHolder.audioCtx && privateHolder.audioCtx.state !== "closed") {
        void privateHolder.audioCtx.close();
      }
      delete privateHolder.audioCtx;
    },
  };
}
