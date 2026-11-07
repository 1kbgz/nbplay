// nbplay LauncherWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-launcher>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplayLauncher } from "./components/launcher.ts";
import "./components/launcher.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-launcher") as NbplayLauncher;
  return bindInstrument(model, el, node, {
    config: {
      tracks: "tracks",
      scenes: "scenes",
      slots: "slots",
      quantize: "quantize",
      bpm: "bpm",
      time_signature_num: "timeSignatureNum",
      selected_slot: "selectedSlot",
      session_id: "sessionId",
    },
    // Play state comes from the browser clock; slot state from the launcher.
    status: {
      is_playing: "isPlaying",
      active_slots: "activeSlots",
      queued_slots: "queuedSlots",
    },
    command: "launch_request",
  });
}

export default { render };
