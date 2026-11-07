// nbplay MidiKeyboardWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-midi-keyboard>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplayMidiKeyboard } from "./components/midi-keyboard.ts";
import "./components/midi-keyboard.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement(
    "nbplay-midi-keyboard",
  ) as NbplayMidiKeyboard;
  return bindInstrument(model, el, node, {
    config: {
      midi_port: "midiPort",
      sync_clock: "syncClock",
      sampler_routing: "samplerRouting",
      session_id: "sessionId",
      channel_index: "channelIndex",
    },
    status: {
      available_midi_ports: "availableMidiPorts",
      active_notes: "activeNotes",
      last_note_event: "lastNoteEvent",
      control_change: "controlChange",
      clock_bpm: "clockBpm",
    },
    onDisconnect: () => node.silence(),
  });
}

export default { render };
