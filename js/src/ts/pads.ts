// Shared pad helpers for note grids and future control-pad actions.

export type PadAction =
  | {
      type: "note";
      note: number;
      velocity?: number;
      label?: string;
      slice?: number;
    }
  | {
      type: "trait";
      trait: string;
      value: number | boolean | string;
      label?: string;
    }
  | {
      type: "event";
      label?: string;
      value?: unknown;
    };

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export function clampMidiNote(note: unknown, fallback = 60): number {
  const n = Number(note);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(127, Math.round(n)));
}

export function clampVelocity(velocity: unknown, fallback = 100): number {
  const v = Number(velocity);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(1, Math.min(127, Math.round(v)));
}

export function noteName(midi: number): string {
  const note = clampMidiNote(midi);
  const octave = Math.floor(note / 12) - 1;
  return NOTE_NAMES[note % 12] + octave;
}

export function parseNoteName(raw: string): number | null {
  const text = raw.trim();
  const num = Number.parseInt(text, 10);
  if (String(num) === text && num >= 0 && num <= 127) return num;

  const match = text.match(/^([A-Ga-g])([#b]?)\s*(-?\d+)$/);
  if (!match) return null;
  const noteLetters: Record<string, number> = {
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11,
  };
  const base = noteLetters[match[1].toLowerCase()];
  if (base === undefined) return null;

  let semitone = base;
  if (match[2] === "#") semitone += 1;
  if (match[2] === "b") semitone -= 1;

  const octave = Number.parseInt(match[3], 10);
  const midi = (octave + 1) * 12 + semitone;
  return midi >= 0 && midi <= 127 ? midi : null;
}

export function resizePadNotes(
  notes: number[],
  count: number,
  start = 48,
): number[] {
  const padCount = Math.max(1, Math.min(128, Math.round(count || 1)));
  const resized = notes.slice(0, padCount).map((note) => clampMidiNote(note));
  let nextNote = resized.length > 0 ? resized[resized.length - 1] + 1 : start;
  while (resized.length < padCount) {
    resized.push(clampMidiNote(nextNote));
    nextNote += 1;
  }
  return resized;
}

export function resizePadVelocities(
  velocities: number[],
  count: number,
  velocity = 100,
): number[] {
  const padCount = Math.max(1, Math.min(128, Math.round(count || 1)));
  const resized = velocities
    .slice(0, padCount)
    .map((v) => clampVelocity(v, velocity));
  while (resized.length < padCount) {
    resized.push(clampVelocity(velocity));
  }
  return resized;
}

function isSafeTraitName(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

export function normalizePadAction(
  raw: unknown,
  note: number,
  velocity: number,
): PadAction {
  const fallback: PadAction = {
    type: "note",
    note: clampMidiNote(note),
    velocity: clampVelocity(velocity),
  };
  if (!raw || typeof raw !== "object") return fallback;
  const action = raw as Record<string, unknown>;
  const label = typeof action.label === "string" ? action.label : undefined;

  if (action.type === "trait" && isSafeTraitName(action.trait)) {
    const value = action.value;
    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "string"
    ) {
      return { type: "trait", trait: action.trait, value, label };
    }
  }

  if (action.type === "event") {
    return { type: "event", label, value: action.value };
  }

  const normalized: PadAction = {
    type: "note",
    note: clampMidiNote(action.note, note),
    velocity: clampVelocity(action.velocity, velocity),
    label,
  };
  const slice = Number(action.slice);
  if (Number.isInteger(slice) && slice >= 0) normalized.slice = slice;
  return normalized;
}

export function normalizePadActions(
  rawActions: unknown,
  notes: number[],
  velocities: number[],
  count: number,
): PadAction[] {
  const actions = Array.isArray(rawActions) ? rawActions : [];
  const normalized: PadAction[] = [];
  const padCount = Math.max(1, Math.round(count || notes.length || 1));
  for (let i = 0; i < padCount; i++) {
    normalized.push(
      normalizePadAction(
        actions[i],
        notes[i] ?? notes[notes.length - 1] ?? 60,
        velocities[i] ?? velocities[velocities.length - 1] ?? 100,
      ),
    );
  }
  return normalized;
}

export function padActionLabel(action: PadAction): string {
  if (action.label) return action.label;
  if (action.type === "note") return noteName(action.note);
  if (action.type === "trait") return action.trait;
  return "event";
}
