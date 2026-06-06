// nbplay Keyboard Routing Engine
// Shared by KeyboardWidget and MidiKeyboardWidget.
// Routes MIDI notes to samplers via the session bus based on
// route descriptors synced from Python.

export type KeyboardRoute =
  | { channel_index: number; match: "all" }
  | { channel_index: number; match: "zone"; zone: "upper" | "lower" }
  | { channel_index: number; match: "octave"; octave: number }
  | { channel_index: number; match: "note"; note: number }
  | { channel_index: number; match: "notes"; notes: number[] };

export interface SamplerBus {
  triggerNote: (note: number, velocity: number) => void;
  releaseNote: (note: number) => void;
}

interface NbplayBus {
  audioCtx: AudioContext;
  channels: { gain: AudioNode }[];
  samplers?: Record<number, SamplerBus>;
  noteListeners?: Array<
    (evt: { note: number; velocity: number; type: string }) => void
  >;
}

function getSessionBus(sessionId: string): NbplayBus | undefined {
  if (!sessionId) return undefined;
  const g = globalThis as Record<string, unknown>;
  const nbplay = g.__nbplay as Record<string, NbplayBus> | undefined;
  return nbplay?.[sessionId];
}

/**
 * Normalize a route descriptor to the current shape.
 * Accepts legacy dicts like `{channel_index, zone: "all"}` (no `match`
 * key) so saved widget state from v0.1.0 continues to work.
 */
function normalizeRoute(r: Record<string, unknown>): KeyboardRoute {
  const ci = (r.channel_index as number) || 0;
  if (r.match) return r as unknown as KeyboardRoute;
  // Legacy: {channel_index, zone: "all"|"upper"|"lower"}
  const zone = (r.zone as string) || "all";
  if (zone === "upper" || zone === "lower") {
    return { channel_index: ci, match: "zone", zone } as KeyboardRoute;
  }
  return { channel_index: ci, match: "all" };
}

/**
 * Return every channel_index whose route descriptor matches *note*
 * and *zone*.
 */
export function matchRoutes(
  routes: KeyboardRoute[],
  note: number,
  zone: "upper" | "lower",
): number[] {
  const result: number[] = [];
  for (const raw of routes) {
    const route = normalizeRoute(raw as unknown as Record<string, unknown>);
    let matched = false;
    switch (route.match) {
      case "all":
        matched = true;
        break;
      case "zone":
        matched = route.zone === zone;
        break;
      case "octave": {
        const noteOctave = Math.floor(note / 12) - 1;
        matched = noteOctave === route.octave;
        break;
      }
      case "note":
        matched = note === route.note;
        break;
      case "notes":
        matched = route.notes.includes(note);
        break;
    }
    if (matched) result.push(route.channel_index);
  }
  return result;
}

/**
 * Route a note-on through all matching samplers.
 *
 * Returns true if at least one sampler handled the note (caller can
 * skip the built-in oscillator fallback).
 */
export function routeNoteOn(
  sessionId: string,
  routes: KeyboardRoute[],
  note: number,
  zone: "upper" | "lower",
  velocity: number,
): boolean {
  if (!sessionId || routes.length === 0) return false;
  const bus = getSessionBus(sessionId);
  if (!bus?.samplers) return false;
  let usedSampler = false;
  for (const channelIndex of matchRoutes(routes, note, zone)) {
    const sampler = bus.samplers[channelIndex];
    if (sampler) {
      sampler.triggerNote(note, velocity);
      usedSampler = true;
    }
  }
  return usedSampler;
}

/**
 * Route a note-off through all matching samplers.
 */
export function routeNoteOff(
  sessionId: string,
  routes: KeyboardRoute[],
  note: number,
  zone: "upper" | "lower",
): boolean {
  if (!sessionId || routes.length === 0) return false;
  const bus = getSessionBus(sessionId);
  if (!bus?.samplers) return false;
  let usedSampler = false;
  for (const channelIndex of matchRoutes(routes, note, zone)) {
    const sampler = bus.samplers[channelIndex];
    if (sampler) {
      sampler.releaseNote(note);
      usedSampler = true;
    }
  }
  return usedSampler;
}
