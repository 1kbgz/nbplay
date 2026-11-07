// nbplay SequencerWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-sequencer>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplaySequencer } from "./components/sequencer.ts";
import "./components/sequencer.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-sequencer") as NbplaySequencer;
  return bindInstrument(model, el, node, {
    config: {
      theme: "theme",
      voices_data: "voicesData",
      num_voices: "numVoices",
      length: "length",
      measures: "measures",
      step_duration: "stepDuration",
      time_signature_num: "timeSignatureNum",
      time_signature_den: "timeSignatureDen",
      bpm: "bpm",
      loop_enabled: "loopEnabled",
      keyboard_connected: "keyboardConnected",
      follow_transport: "followTransport",
      swing: "swing",
      groove: "groove",
      automation_lanes: "automationLanes",
      session_id: "sessionId",
      channel_index: "channelIndex",
    },
    // Play state and the current step come from the browser clock and the
    // scheduler, never from a saved notebook.
    status: { is_playing: "isPlaying", current_step: "currentStep" },
    // Stop playback on kernel disconnect
    onDisconnect: () => node.halt(),
  });
}

export default { render };
