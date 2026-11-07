// nbplay MixerWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-mixer>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplayMixer } from "./components/mixer.ts";
import "./components/mixer.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-mixer") as NbplayMixer;
  return bindInstrument(model, el, node, {
    config: {
      channels: "channels",
      returns: "returns",
      master_gain: "masterGain",
      master_effects: "masterEffects",
      session_id: "sessionId",
    },
    status: {},
  });
}

export default { render };
