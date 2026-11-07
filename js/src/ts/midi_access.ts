// Web MIDI port engine shared by the settings, MIDI keyboard and MIDI output
// instruments: request access once, enumerate ports, connect one input.

export interface MidiPortInfo {
  id: string;
  name: string;
  state: string;
}

export interface MidiAccessEngine {
  requestAccess(): Promise<MIDIAccess | null>;
  inputs(): MidiPortInfo[];
  outputs(): MidiPortInfo[];
  /** Listen to one input (replacing any previous one); null if unknown. */
  connectInput(
    portId: string,
    cb: (data: Uint8Array, timestamp: number) => void,
  ): MidiPortInfo | null;
  disconnectInput(): void;
  activeInputId(): string | null;
  output(portId: string): MIDIOutput | null;
}

function info(port: MIDIPort): MidiPortInfo {
  return { id: port.id, name: port.name || "(unnamed)", state: port.state };
}

export function createMidiAccess(): MidiAccessEngine {
  let access: MIDIAccess | null = null;
  let activeInput: MIDIInput | null = null;
  let onMessage: ((e: MIDIMessageEvent) => void) | null = null;

  return {
    async requestAccess(): Promise<MIDIAccess | null> {
      if (access) return access;
      if (!navigator.requestMIDIAccess) return null;
      try {
        access = await navigator.requestMIDIAccess({ sysex: false });
        return access;
      } catch {
        return null;
      }
    },

    inputs(): MidiPortInfo[] {
      const ports: MidiPortInfo[] = [];
      access?.inputs.forEach((port) => ports.push(info(port)));
      return ports;
    },

    outputs(): MidiPortInfo[] {
      const ports: MidiPortInfo[] = [];
      access?.outputs.forEach((port) => ports.push(info(port)));
      return ports;
    },

    connectInput(portId, cb): MidiPortInfo | null {
      this.disconnectInput();
      const port = access?.inputs.get(portId);
      if (!port) return null;
      onMessage = (e: MIDIMessageEvent) =>
        cb(e.data as Uint8Array, e.timeStamp || performance.now());
      port.addEventListener("midimessage", onMessage as EventListener);
      activeInput = port;
      return info(port);
    },

    disconnectInput(): void {
      if (activeInput && onMessage) {
        activeInput.removeEventListener(
          "midimessage",
          onMessage as EventListener,
        );
      }
      activeInput = null;
      onMessage = null;
    },

    activeInputId(): string | null {
      return activeInput ? activeInput.id : null;
    },

    output(portId: string): MIDIOutput | null {
      return access?.outputs.get(portId) ?? null;
    },
  };
}
