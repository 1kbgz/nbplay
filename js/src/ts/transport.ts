// nbplay TransportWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-transport>` element.
// Model traits go in as properties; the element's `nbplay-set`,
// `nbplay-status` and `nbplay-request` events come out as model writes.
// Kernel commands (the `command` trait with a monotonic nonce) are forwarded
// to `element.command()`.

import { type AnyModel, onKernelDisconnect } from "./helpers.ts";
import type { NbplayTransport } from "./components/transport.ts";
import "./components/transport.ts";

/** Model trait → element property for kernel-owned configuration. */
const CONFIG: Record<string, string> = {
  bpm: "bpm",
  time_signature_num: "timeSignatureNum",
  time_signature_den: "timeSignatureDen",
  loop_enabled: "loopEnabled",
  loop_start_bar: "loopStartBar",
  loop_end_bar: "loopEndBar",
  session_id: "sessionId",
};

/** Model trait → element property for browser-owned status. */
const STATUS: Record<string, string> = {
  is_playing: "isPlaying",
  is_recording: "isRecording",
  current_beat: "currentBeat",
  bar_number: "barNumber",
  beat_in_bar: "beatInBar",
};

function trait(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-transport") as NbplayTransport;
  const props = node as unknown as Record<string, unknown>;
  for (const [name, prop] of Object.entries(CONFIG)) {
    const value = model.get(name);
    props[prop] = prop === "sessionId" ? String(value || "") : value;
  }

  // While `mirroring` is set, model writes originate from the element and
  // the model observers below must not feed them back.
  let mirroring = false;
  let disconnected = false;

  function write(values: Record<string, unknown>, save: boolean): void {
    mirroring = true;
    try {
      for (const [prop, value] of Object.entries(values)) {
        model.set(trait(prop), value);
      }
    } finally {
      mirroring = false;
    }
    if (save && !disconnected) model.save_changes();
  }

  node.addEventListener("nbplay-set", (e) => {
    write((e as CustomEvent).detail.values, true);
  });
  node.addEventListener("nbplay-status", (e) => {
    const { values, save } = (e as CustomEvent).detail;
    write(values, Boolean(save));
  });
  node.addEventListener("nbplay-request", (e) => {
    const name = `${(e as CustomEvent).detail.name}_request`;
    model.set(name, (Number(model.get(name)) || 0) + 1);
    if (!disconnected) model.save_changes();
  });

  el.appendChild(node);

  // Initial status comes from the browser clock, never from the saved
  // notebook. Local model state only: no save_changes() during render.
  const initial: Record<string, unknown> = {};
  for (const prop of Object.values(STATUS)) initial[prop] = props[prop];
  write(initial, false);

  // Model observers (kernel-driven changes)

  for (const [name, prop] of Object.entries(CONFIG)) {
    model.on(`change:${name}`, () => {
      if (mirroring) return;
      const value = model.get(name);
      props[prop] = prop === "sessionId" ? String(value || "") : value;
    });
  }
  // Status written by the kernel is display state at best; the element
  // corrects anything that disagrees with the clock.
  for (const [name, prop] of Object.entries(STATUS)) {
    model.on(`change:${name}`, () => {
      if (mirroring) return;
      props[prop] = model.get(name);
    });
  }

  let lastCommandNonce = Number(
    (model.get("command") as { nonce?: number } | undefined)?.nonce ?? -1,
  );
  if (!Number.isFinite(lastCommandNonce)) lastCommandNonce = -1;
  model.on("change:command", () => {
    const cmd = (model.get("command") || {}) as {
      action?: string;
      nonce?: number;
    };
    const nonce = Number(cmd.nonce);
    // Nonces are monotonic: an older command arriving late is ignored.
    if (!cmd.action || !Number.isFinite(nonce) || nonce <= lastCommandNonce)
      return;
    lastCommandNonce = nonce;
    node.command(cmd as Parameters<NbplayTransport["command"]>[0]);
  });

  // Stop playback on kernel disconnect
  const cancelDisconnect = onKernelDisconnect(model, () => {
    disconnected = true;
    node.command({ action: "stop" });
    node.command({ action: "record", on: false });
    node.command({ action: "seek", beat: 0 });
  });

  return () => {
    cancelDisconnect();
    node.remove();
  };
}

export default { render };
