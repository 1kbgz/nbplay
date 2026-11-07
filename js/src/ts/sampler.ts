// nbplay SamplerWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-sampler>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplaySampler } from "./components/sampler.ts";
import "./components/sampler.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-sampler") as NbplaySampler;
  return bindInstrument(model, el, node, {
    config: {
      sample_name: "sampleName",
      sample_rate: "sampleRate",
      sample_length: "sampleLength",
      root_note: "rootNote",
      waveform: "waveform",
      sample_data: "sampleData",
      attack: "attack",
      decay: "decay",
      sustain: "sustain",
      release: "release",
      max_voices: "maxVoices",
      pad_count: "padCount",
      pad_notes: "padNotes",
      pad_velocities: "padVelocities",
      pad_actions: "padActions",
      sample_slices: "sampleSlices",
      velocity: "velocity",
      velocity_sensitive: "velocitySensitive",
      zones: "zones",
      session_id: "sessionId",
      channel_index: "channelIndex",
    },
    status: {
      active_pads: "activePads",
      last_note_event: "lastNoteEvent",
      last_pad_event: "lastPadEvent",
    },
    command: "capture_request",
    onDisconnect: () => node.silence(),
  });
}

export default { render };
