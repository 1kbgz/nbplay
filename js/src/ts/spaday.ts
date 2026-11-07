// The nbplay component package for spaday: registers every nbplay element and
// `nbplay-wire`, the bridge that delivers transports commands to the
// instrument it sits in.
//
// A spaday tree renders an instrument element with its properties bound to a
// kernel-owned config model and a browser-owned status model. Kernel commands
// (`session.command(status_id, field, value)`) reach the owning view through
// the wire; the element applies them and the resulting status flows back
// through the status bindings.
import "./components/index.ts";

interface CommandMsg {
  id: number;
  field: string;
  value: unknown;
}

interface WireContext {
  client: {
    onCommand(listener: (command: CommandMsg) => void): () => void;
    ackCommand(command: CommandMsg): unknown;
  };
  link: { modelId?: number };
  namespace: string | null;
}

type Commandable = HTMLElement & {
  command?: (cmd: Record<string, unknown>) => void;
};

/** `is_playing` to `isPlaying`. */
export function camel(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

const TAGS = ["Null", "Bool", "Int", "Float", "Str", "Bytes", "List", "Map"];

/** A transports `Value` (`{"Bool": true}`) to its plain form. */
export function untag(value: unknown): unknown {
  if (value === "Null") return null;
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value);
    if (keys.length === 1 && TAGS.includes(keys[0])) {
      return keys[0] === "Null"
        ? null
        : (value as Record<string, unknown>)[keys[0]];
    }
  }
  return value;
}

/** The instrument command a status-field command stands for. */
export function statusCommand(
  field: string,
  value: unknown,
): Record<string, unknown> | null {
  switch (field) {
    case "is_playing":
      return { action: value ? "play" : "stop" };
    case "is_recording":
      return { action: "record", on: Boolean(value) };
    case "current_beat":
      return { action: "seek", beat: Number(value) };
    default:
      return null;
  }
}

/**
 * `<nbplay-wire namespace="status">`: placed inside an instrument element,
 * requests the named wire from the spaday widget root and applies each
 * command for that model to the instrument before acknowledging it: through
 * `command()` when the element has one (the transport), otherwise by writing
 * the field's camelCase property (the synth's `isPlaying`).
 */
export class NbplayWire extends HTMLElement {
  private stop: (() => void) | null = null;

  get namespace(): string {
    return this.getAttribute("namespace") ?? "status";
  }

  set namespace(value: string) {
    this.setAttribute("namespace", value);
  }

  connectedCallback(): void {
    const detail: { namespace: string; wire?: WireContext } = {
      namespace: this.namespace,
    };
    this.dispatchEvent(
      new CustomEvent("spaday:wire-request", {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
    const wire = detail.wire;
    const host = this.parentElement as Commandable | null;
    if (!wire || !host) return;
    this.stop = wire.client.onCommand((command) => {
      if (wire.link.modelId !== undefined && command.id !== wire.link.modelId)
        return;
      const value = untag(command.value);
      if (typeof host.command === "function") {
        const cmd = statusCommand(command.field, value);
        if (cmd) host.command(cmd);
      } else {
        // A property write is silent; report it like the element would so
        // the status bindings re-read and the kernel sees the result.
        const prop = camel(command.field);
        (host as unknown as Record<string, unknown>)[prop] = value;
        host.dispatchEvent(
          new CustomEvent("nbplay-status", {
            detail: { values: { [prop]: value }, save: true },
            bubbles: true,
          }),
        );
      }
      void wire.client.ackCommand(command);
    });
  }

  disconnectedCallback(): void {
    this.stop?.();
    this.stop = null;
  }
}

if (!customElements.get("nbplay-wire")) {
  customElements.define("nbplay-wire", NbplayWire);
}
