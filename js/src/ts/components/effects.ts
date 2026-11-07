/** A mixer insert as the kernel stores it: `type`, optional `enabled`, params. */
export interface EffectDescriptor {
  type: string;
  enabled?: boolean;
  [key: string]: unknown;
}

/** One editable parameter of an effect descriptor. */
export interface ParamSpec {
  key: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  kind: "number" | "select" | "text" | "bool";
}

export const EFFECT_TYPES = [
  "gain",
  "filter",
  "compressor",
  "limiter",
  "delay",
  "reverb",
];

const FILTER_TYPES = [
  "lowpass",
  "highpass",
  "bandpass",
  "notch",
  "lowshelf",
  "highshelf",
  "peaking",
];

// Ranges match the Python EffectPlugin validation.
export const EFFECT_PARAMS: Record<string, ParamSpec[]> = {
  gain: [
    { key: "gain", label: "Gain", min: 0, max: 4, step: 0.01, kind: "number" },
  ],
  filter: [
    {
      key: "filter_type",
      label: "Type",
      options: FILTER_TYPES,
      kind: "select",
    },
    {
      key: "frequency",
      label: "Hz",
      min: 20,
      max: 20000,
      step: 1,
      kind: "number",
    },
    { key: "q", label: "Q", min: 0.0001, max: 100, step: 0.01, kind: "number" },
  ],
  delay: [
    { key: "time", label: "Time", min: 0, max: 5, step: 0.001, kind: "number" },
    {
      key: "feedback",
      label: "Fdbk",
      min: 0,
      max: 0.95,
      step: 0.01,
      kind: "number",
    },
    { key: "wet", label: "Wet", min: 0, max: 1, step: 0.01, kind: "number" },
  ],
  reverb: [
    {
      key: "seconds",
      label: "Size",
      min: 0.01,
      max: 10,
      step: 0.01,
      kind: "number",
    },
    {
      key: "decay",
      label: "Decay",
      min: 0.01,
      max: 12,
      step: 0.01,
      kind: "number",
    },
    { key: "wet", label: "Wet", min: 0, max: 1, step: 0.01, kind: "number" },
  ],
  compressor: [
    {
      key: "threshold",
      label: "Thresh",
      min: -100,
      max: 0,
      step: 0.5,
      kind: "number",
    },
    { key: "knee", label: "Knee", min: 0, max: 40, step: 0.5, kind: "number" },
    {
      key: "ratio",
      label: "Ratio",
      min: 1,
      max: 20,
      step: 0.1,
      kind: "number",
    },
    {
      key: "attack",
      label: "Attack",
      min: 0,
      max: 1,
      step: 0.001,
      kind: "number",
    },
    {
      key: "release",
      label: "Release",
      min: 0,
      max: 1,
      step: 0.001,
      kind: "number",
    },
  ],
  limiter: [
    {
      key: "threshold",
      label: "Thresh",
      min: -100,
      max: 0,
      step: 0.5,
      kind: "number",
    },
    {
      key: "release",
      label: "Release",
      min: 0,
      max: 1,
      step: 0.001,
      kind: "number",
    },
  ],
};

/** Editable params: the built-in table, or every JSON field of a custom plugin. */
export function paramSpecs(effect: EffectDescriptor): ParamSpec[] {
  const known = EFFECT_PARAMS[effect.type];
  if (known) return known;
  return Object.entries(effect)
    .filter(([key]) => key !== "type" && key !== "enabled")
    .map(([key, value]): ParamSpec | null => {
      if (typeof value === "number") return { key, label: key, kind: "number" };
      if (typeof value === "boolean") return { key, label: key, kind: "bool" };
      if (typeof value === "string") return { key, label: key, kind: "text" };
      return null;
    })
    .filter((spec): spec is ParamSpec => spec !== null);
}

export function effectEnabled(effect: EffectDescriptor): boolean {
  return effect.enabled !== false;
}

/** Chip text: the type, or for filters the filter type and cutoff. */
export function effectLabel(effect: EffectDescriptor): string {
  if (effect.type === "filter") {
    return `${effect.filter_type || "filter"} ${Math.round(Number(effect.frequency) || 0)}Hz`;
  }
  return effect.type;
}
