// nbplay KeyboardWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-keyboard>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplayKeyboard } from "./components/keyboard.ts";
import "./components/keyboard.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-keyboard") as NbplayKeyboard;
  return bindInstrument(model, el, node, {
    config: {
      theme: "theme",
      upper_octave: "upperOctave",
      lower_octave: "lowerOctave",
      velocity: "velocity",
      sustain_upper: "sustainUpper",
      sustain_lower: "sustainLower",
      sustain_global: "sustainGlobal",
      sampler_routing: "samplerRouting",
      session_id: "sessionId",
      channel_index: "channelIndex",
    },
    status: {
      active_notes: "activeNotes",
      last_note_event: "lastNoteEvent",
    },
    // Stop on kernel disconnect
    onDisconnect: () => node.silence(),
  });
}

export default { render };
