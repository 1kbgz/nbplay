// The step cell gesture the pad grid and the drum grid share: a press on a
// cell is a tap, or a vertical drag that sets its velocity (top is loudest).
import { clampVelocity } from "../pads.ts";

/** Pixels a press moves before it becomes a velocity drag. */
export const DRAG_THRESHOLD = 5;

/** The velocity (1-127) at a pointer's height in a cell: the top is loudest. */
export function velocityAt(clientY: number, cell: HTMLElement): number {
  const rect = cell.getBoundingClientRect();
  const frac = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  return clampVelocity(Math.max(1, Math.round((1 - frac) * 127)));
}

/**
 * Follow one press on a cell: `onTap` when it lifts without moving, or a
 * vertical drag with `onDrag(velocity)` while it moves and
 * `onDrop(velocity)` when it lifts (or is cancelled).
 */
export function trackPress(
  e: PointerEvent,
  cell: HTMLElement,
  handlers: {
    onTap(): void;
    onDrag(velocity: number): void;
    onDrop(velocity: number): void;
  },
): void {
  const id = e.pointerId;
  const startY = e.clientY;
  let dragging = false;
  let last = 0;
  let done = false;
  try {
    cell.setPointerCapture(id);
  } catch {
    /* synthetic pointer */
  }
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    if (!dragging && Math.abs(ev.clientY - startY) < DRAG_THRESHOLD) return;
    dragging = true;
    last = velocityAt(ev.clientY, cell);
    handlers.onDrag(last);
  };
  const end = (ev: PointerEvent, cancelled: boolean) => {
    if (ev.pointerId !== id || done) return;
    done = true;
    cell.removeEventListener("pointermove", move);
    cell.removeEventListener("pointerup", up);
    cell.removeEventListener("pointercancel", cancel);
    cell.removeEventListener("lostpointercapture", cancel);
    if (dragging) handlers.onDrop(last);
    else if (!cancelled) handlers.onTap();
  };
  const up = (ev: PointerEvent) => end(ev, false);
  const cancel = (ev: PointerEvent) => end(ev, true);
  cell.addEventListener("pointermove", move);
  cell.addEventListener("pointerup", up);
  cell.addEventListener("pointercancel", cancel);
  cell.addEventListener("lostpointercapture", cancel);
}
