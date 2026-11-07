// nbplay MidiOutputWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-midi-output>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplayMidiOutput } from "./components/midi-output.ts";
import "./components/midi-output.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-midi-output") as NbplayMidiOutput;
  return bindInstrument(model, el, node, {
    config: {
      theme: "theme",
      midi_port: "midiPort",
      channel: "channel",
      forward_notes: "forwardNotes",
      send_clock: "sendClock",
      session_id: "sessionId",
    },
    status: { available_midi_ports: "availableMidiPorts" },
    command: "send_request",
    onDisconnect: () => node.teardown(),
  });
}

export default { render };
