import { fmtGain, fmtPan, parseDbInput } from "../helpers.ts";
import { noteName, parseNoteName } from "../pads.ts";

/** Display presets for `nbplay-value`. Presets keep elements serializable. */
export type ValueKind =
  | "int"
  | "float"
  | "db"
  | "pan"
  | "hz"
  | "bpm"
  | "seconds"
  | "percent"
  | "note";

export function formatValue(
  v: number,
  kind: ValueKind,
  precision = 2,
  unit = "",
): string {
  switch (kind) {
    case "int":
      return `${Math.round(v)}${unit}`;
    case "db":
      return fmtGain(v);
    case "pan":
      return fmtPan(v);
    case "hz":
      return v >= 1000 ? (v / 1000).toFixed(2) + " kHz" : v.toFixed(1) + " Hz";
    case "bpm":
      return `${Math.round(v)} BPM`;
    case "seconds":
      if (v < 0.01) return (v * 1000).toFixed(1) + " ms";
      if (v < 1) return (v * 1000).toFixed(0) + " ms";
      return v.toFixed(2) + " s";
    case "percent":
      return (v * 100).toFixed(0) + "%";
    case "note":
      return noteName(v);
    default:
      return `${v.toFixed(precision)}${unit}`;
  }
}

/** Text shown in the inline editor: bare numbers, no units. */
export function editText(v: number, kind: ValueKind, precision = 2): string {
  switch (kind) {
    case "int":
    case "bpm":
      return String(Math.round(v));
    case "db":
      return fmtGain(v).replace(" dB", "");
    case "pan":
      return String(Math.round(v * 100) / 100);
    case "percent":
      return (v * 100).toFixed(0);
    case "note":
      return noteName(v);
    case "float":
      return v.toFixed(precision);
    default:
      return String(v);
  }
}

/** Parse editor text back to a value, or `null` when it is not valid. */
export function parseValue(raw: string, kind: ValueKind): number | null {
  const text = raw.trim();
  if (!text) return null;
  switch (kind) {
    case "db":
      return parseDbInput(text);
    case "note":
      return parseNoteName(text);
    case "int":
    case "bpm": {
      const n = parseInt(text, 10);
      return Number.isNaN(n) ? null : n;
    }
    case "percent": {
      const n = parseFloat(text);
      if (!Number.isFinite(n)) return null;
      return n > 1 ? n / 100 : n;
    }
    case "hz": {
      const n = parseFloat(text);
      if (!Number.isFinite(n)) return null;
      return /k/i.test(text) ? n * 1000 : n;
    }
    default: {
      const n = parseFloat(text);
      return Number.isFinite(n) ? n : null;
    }
  }
}
