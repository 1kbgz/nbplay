// nbplay TransportWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-transport>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplayTransport } from "./components/transport.ts";
import "./components/transport.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-transport") as NbplayTransport;
  return bindInstrument(model, el, node, {
    config: {
      theme: "theme",
      bpm: "bpm",
      time_signature_num: "timeSignatureNum",
      time_signature_den: "timeSignatureDen",
      loop_enabled: "loopEnabled",
      loop_start_bar: "loopStartBar",
      loop_end_bar: "loopEndBar",
      session_id: "sessionId",
    },
    status: {
      is_playing: "isPlaying",
      is_recording: "isRecording",
      current_beat: "currentBeat",
      bar_number: "barNumber",
      beat_in_bar: "beatInBar",
    },
    command: true,
    // Stop playback on kernel disconnect
    onDisconnect: () => {
      node.command({ action: "stop" });
      node.command({ action: "record", on: false });
      node.command({ action: "seek", beat: 0 });
    },
  });
}

export default { render };
