// nbplay UI primitives: light-DOM custom elements with no dependency on the
// widget model. Importing this module registers every tag once.

export { NbplayElement, define, clamp, quantize } from "./base.ts";
export { formatValue, editText, parseValue, type ValueKind } from "./format.ts";
export { NbplayValue } from "./value.ts";
export { NbplaySlider } from "./slider.ts";
export { NbplayDial } from "./dial.ts";
export { NbplayMeter } from "./meter.ts";
export { NbplayBar } from "./bar.ts";
export { NbplayWaveform } from "./waveform.ts";
export { NbplayEnvelope } from "./envelope.ts";
export { NbplayToggle, type ToggleVariant } from "./toggle.ts";
export { NbplayPosition } from "./position.ts";
export { NbplaySegmented, type SegmentOption } from "./segmented.ts";
export { NbplayHeader } from "./header.ts";
export { NbplayParam } from "./param.ts";
export { NbplayTransportButtons } from "./transport-buttons.ts";
export { NbplayFader } from "./fader.ts";
export {
  NbplayKeyRows,
  keyToNote,
  UPPER_SHARP_ROW,
  UPPER_NATURAL_ROW,
  LOWER_SHARP_ROW,
  LOWER_NATURAL_ROW,
  type Zone,
} from "./keys.ts";
export { NbplayPadGrid, type PadSpec } from "./pad-grid.ts";
export { NbplayStepGrid, type Step, type StepRef } from "./step-grid.ts";
export {
  EFFECT_TYPES,
  EFFECT_PARAMS,
  paramSpecs,
  effectEnabled,
  effectLabel,
  type EffectDescriptor,
  type ParamSpec,
} from "./effects.ts";
export { NbplayEffectEditor } from "./effect-editor.ts";
export { NbplayEffectRack } from "./effect-rack.ts";
export { NbplayStrip, type StripKind } from "./strip.ts";
export {
  NbplayMidiPort,
  type MidiPortSpec,
  type MidiPortStatus,
} from "./midi-port.ts";
export { NbplayMidiLog, fmtMidiMsg } from "./midi-log.ts";
export { NbplayLauncherSlot } from "./launcher-slot.ts";
export {
  NbplayLauncherGrid,
  STOP_QUEUED,
  type LauncherTrack,
  type LauncherSlotSpec,
} from "./launcher-grid.ts";
export { NbplayRuler, beatLabel, snapBeat } from "./ruler.ts";
export { NbplayClip, type ClipKind } from "./clip.ts";
export { NbplayLane, type ClipSpec, type LaneInput } from "./lane.ts";
export {
  NbplayZoneMap,
  paletteColor,
  PALETTE_SIZE,
  type ZoneSpan,
} from "./zone-map.ts";
export { NbplayZoneList, type ZoneRow } from "./zone-list.ts";
export { NbplayTransport, type TransportCommand } from "./transport.ts";
export { NbplayPads } from "./pads.ts";
export { NbplaySynth, type OscillatorType } from "./synth.ts";
export { NbplayKeyboard } from "./keyboard.ts";
export { NbplayMidiKeyboard } from "./midi-keyboard.ts";
export { NbplaySettings } from "./settings.ts";
export {
  NbplayMidiOutput,
  songPositionBytes,
  type SendRequest,
} from "./midi-output.ts";
export { NbplaySequencer } from "./sequencer.ts";
