// nbplay PadWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-pads>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplayPads } from "./components/pads.ts";
import "./components/pads.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-pads") as NbplayPads;
  return bindInstrument(model, el, node, {
    config: {
      theme: "theme",
      rows: "rows",
      cols: "cols",
      velocity: "velocity",
      velocity_sensitive: "velocitySensitive",
      pad_notes: "padNotes",
      pad_velocities: "padVelocities",
      pad_actions: "padActions",
      sampler_routing: "samplerRouting",
      session_id: "sessionId",
      channel_index: "channelIndex",
    },
    status: {
      active_pads: "activePads",
      last_note_event: "lastNoteEvent",
      last_pad_event: "lastPadEvent",
    },
    // Release all on kernel disconnect
    onDisconnect: () => node.releaseAll(),
  });
}

export default { render };
