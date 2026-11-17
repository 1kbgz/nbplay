// The metronome: a click on every beat of the session clock while it plays,
// the first beat of each bar accented. The transport element drives it.
import { barBeats, type SessionClock } from "./session.ts";
import { scheduleClick } from "./voices.ts";

/** How far ahead clicks are scheduled, and how often the loop looks. */
const LOOKAHEAD = 0.1;
const TICK_MS = 25;

export interface Metronome {
  /** Start clicking from the clock's next beat (it must be playing). */
  start(): void;
  stop(): void;
  /** Start again from the next beat after a seek, tempo or loop change. */
  realign(): void;
}

export function createMetronome(
  clock: () => SessionClock,
  output: () => AudioNode | null,
  meter: () => { num: number; den: number },
): Metronome {
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextBeat = 0;
  const cancels: Array<() => void> = [];

  const align = () => {
    nextBeat = Math.ceil(clock().beat() - 1e-6);
  };

  const tick = () => {
    const clk = clock();
    const ctx = clk.context();
    const out = output();
    if (!ctx || !out || !clk.playing) return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    for (
      let at = clk.ctxTimeAt(nextBeat);
      at < horizon;
      at = clk.ctxTimeAt(nextBeat)
    ) {
      // A loop jumps back; a click past its end belongs to its start.
      const loop = clk.loop;
      if (loop.enabled && nextBeat >= loop.endBeat) {
        align();
        break;
      }
      const { num, den } = meter();
      const bar = barBeats(num, den);
      const accent = Math.abs(nextBeat % bar) < 1e-6;
      if (at >= ctx.currentTime - 0.01)
        cancels.push(
          scheduleClick(ctx, out, Math.max(at, ctx.currentTime), accent),
        );
      if (cancels.length > 64) cancels.splice(0, cancels.length - 64);
      nextBeat += 1;
    }
  };

  return {
    start() {
      if (timer) return;
      align();
      timer = setInterval(tick, TICK_MS);
      tick();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      cancels.splice(0).forEach((cancel) => cancel());
    },
    realign() {
      if (!timer) return;
      cancels.splice(0).forEach((cancel) => cancel());
      align();
    },
  };
}
