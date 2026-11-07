// nbplay SynthWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-synth>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplaySynth } from "./components/synth.ts";
import "./components/synth.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-synth") as NbplaySynth;
  return bindInstrument(model, el, node, {
    config: {
      oscillator_type: "oscillatorType",
      frequency: "frequency",
      amplitude: "amplitude",
      sample_rate: "sampleRate",
      waveform: "waveform",
      session_id: "sessionId",
      channel_index: "channelIndex",
    },
    // is_playing is status: the element starts stopped whatever the saved
    // notebook says, and a kernel write of true starts the tone.
    status: { is_playing: "isPlaying" },
    onDisconnect: () => node.stop(),
  });
}

export default { render };
