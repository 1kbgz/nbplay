// nbplay SettingsWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-settings>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplaySettings } from "./components/settings.ts";
import "./components/settings.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-settings") as NbplaySettings;
  return bindInstrument(model, el, node, {
    config: {
      sample_rate: "sampleRate",
      channels: "channels",
      buffer_size: "bufferSize",
      audio_device: "audioDevice",
      midi_port: "midiPort",
    },
    status: {
      available_midi_ports: "availableMidiPorts",
      midi_event: "midiEvent",
    },
  });
}

export default { render };
