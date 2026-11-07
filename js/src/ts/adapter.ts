// Adapter between an anywidget model and an instrument element.
//
// Model traits go in as element properties; the element's `nbplay-set`,
// `nbplay-status` and `nbplay-request` events come out as model writes.
// Kernel commands (the `command` trait with a monotonic nonce) are forwarded
// to `element.command()`.

import { type AnyModel, onKernelDisconnect } from "./helpers.ts";

export interface InstrumentSpec {
  /** Model trait → element property for kernel-owned configuration. */
  config: Record<string, string>;
  /** Model trait → element property for browser-owned status. */
  status: Record<string, string>;
  /** Forward a nonce-stamped request trait (`command` when `true`) to `element.command()`. */
  command?: boolean | string;
  /** Runs when the kernel goes away (after the disconnect delay). */
  onDisconnect?: () => void;
}

/** Elements that take kernel commands expose `command(cmd)`; each narrows `cmd` to its own type. */
type Commandable = { command?: (cmd: never) => void };

/** Element property name → model trait name. */
export function traitName(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

/**
 * Wire `node` to `model` and append it to `el`. Returns the anywidget
 * cleanup function.
 */
export function bindInstrument(
  model: AnyModel,
  el: HTMLElement,
  node: HTMLElement,
  spec: InstrumentSpec,
): () => void {
  const props = node as unknown as Record<string, unknown>;
  const read = (trait: string, prop: string): unknown => {
    const value = model.get(trait);
    return prop === "sessionId" ? String(value || "") : value;
  };
  for (const [trait, prop] of Object.entries(spec.config)) {
    props[prop] = read(trait, prop);
  }

  // While `mirroring` is set, model writes originate from the element and
  // the model observers below must not feed them back.
  let mirroring = false;
  let disconnected = false;

  function write(values: Record<string, unknown>, save: boolean): void {
    mirroring = true;
    try {
      for (const [prop, value] of Object.entries(values)) {
        model.set(traitName(prop), value);
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

  // Initial status comes from the browser, never from the saved notebook.
  // Local model state only: no save_changes() during render.
  const initial: Record<string, unknown> = {};
  for (const prop of Object.values(spec.status)) initial[prop] = props[prop];
  write(initial, false);

  for (const [trait, prop] of Object.entries(spec.config)) {
    model.on(`change:${trait}`, () => {
      if (mirroring) return;
      props[prop] = read(trait, prop);
    });
  }
  // Status written by the kernel is display state at best; the element
  // corrects anything that disagrees with the browser.
  for (const [trait, prop] of Object.entries(spec.status)) {
    model.on(`change:${trait}`, () => {
      if (mirroring) return;
      props[prop] = model.get(trait);
    });
  }

  if (spec.command) {
    const trait = spec.command === true ? "command" : spec.command;
    let lastNonce = Number(
      (model.get(trait) as { nonce?: number } | undefined)?.nonce ?? -1,
    );
    if (!Number.isFinite(lastNonce)) lastNonce = -1;
    model.on(`change:${trait}`, () => {
      const cmd = (model.get(trait) || {}) as { nonce?: number };
      const nonce = Number(cmd.nonce);
      // Nonces are monotonic: an older command arriving late is ignored.
      if (!Number.isFinite(nonce) || nonce <= lastNonce) return;
      lastNonce = nonce;
      (node as Commandable).command?.(cmd as never);
    });
  }

  const cancelDisconnect = onKernelDisconnect(model, () => {
    disconnected = true;
    spec.onDisconnect?.();
  });

  return () => {
    cancelDisconnect();
    node.remove();
  };
}
