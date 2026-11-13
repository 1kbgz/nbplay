// Test-only binding between a trait-shaped mock model and an instrument
// element. The widget specs drive each instrument through model traits
// (`model.get("bpm")`, `model.set("is_playing", true)`) the way the kernel's
// config and status models do through the spaday tree; this file is the
// stand-in for that tree, bundled to `dist/tests/instruments.js` by the
// build and never shipped.
import "../../src/ts/components/index.ts";
import type { AnyModel } from "../../src/ts/helpers.ts";
import type {
  NbplayKeyboard,
  NbplayMidiKeyboard,
  NbplayMidiOutput,
  NbplayPads,
  NbplaySampler,
  NbplaySequencer,
  NbplaySynth,
  NbplayTransport,
} from "../../src/ts/components/index.ts";

interface InstrumentSpec {
  /** Model trait → element property for kernel-owned configuration. */
  config: Record<string, string>;
  /** Model trait → element property for browser-owned status. */
  status: Record<string, string>;
  /** Forward a nonce-stamped request trait (`command` when `true`) to `element.command()`. */
  command?: boolean | string;
  /** Runs when the kernel goes away (after the disconnect delay). */
  onDisconnect?: () => void;
}

type Commandable = { command?: (cmd: never) => void };

/** Element property name → model trait name. */
function traitName(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

/**
 * Poll the model for comm loss and call `callback` after `delay` ms. A mock
 * model without `comm` or `widget_manager` is never monitored.
 */
function onKernelDisconnect(
  model: AnyModel,
  callback: () => void,
  delay: number = 5000,
): () => void {
  const m = model as unknown as Record<string, unknown>;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  let fired = false;
  if (!("comm" in m || "widget_manager" in m)) return () => {};

  function isConnected(): boolean {
    if ("comm" in m) return m.comm != null;
    return m.widget_manager != null;
  }

  pollTimer = setInterval(() => {
    if (fired) return;
    if (!isConnected() && !pendingTimeout) {
      pendingTimeout = setTimeout(() => {
        if (!isConnected() && !fired) {
          fired = true;
          callback();
        }
        pendingTimeout = null;
      }, delay);
    } else if (isConnected() && pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
  }, 2000);

  return () => {
    if (pollTimer) clearInterval(pollTimer);
    if (pendingTimeout) clearTimeout(pendingTimeout);
  };
}

/** Wire `node` to `model` and append it to `el`; returns the cleanup function. */
function bindInstrument(
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
      // Nonces are monotonic: an older command arriving late is ignored. A
      // request without one is applied as it comes.
      if (Number.isFinite(nonce)) {
        if (nonce <= lastNonce) return;
        lastNonce = nonce;
      }
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

const ROUTED = {
  sampler_routing: "samplerRouting",
  session_id: "sessionId",
  channel_index: "channelIndex",
};

/** Instrument name (the old widget bundle name) → element tag and trait maps. */
const INSTRUMENTS: Record<
  string,
  { tag: string; spec: (node: HTMLElement) => InstrumentSpec }
> = {
  widget: {
    tag: "nbplay-synth",
    spec: (node) => ({
      config: {
        theme: "theme",
        oscillator_type: "oscillatorType",
        frequency: "frequency",
        amplitude: "amplitude",
        sample_rate: "sampleRate",
        waveform: "waveform",
        session_id: "sessionId",
        channel_index: "channelIndex",
      },
      status: { is_playing: "isPlaying" },
      onDisconnect: () => (node as NbplaySynth).stop(),
    }),
  },
  transport: {
    tag: "nbplay-transport",
    spec: (node) => ({
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
      onDisconnect: () => {
        const transport = node as NbplayTransport;
        transport.command({ action: "stop" });
        transport.command({ action: "record", on: false });
        transport.command({ action: "seek", beat: 0 });
      },
    }),
  },
  mixer: {
    tag: "nbplay-mixer",
    spec: () => ({
      config: {
        theme: "theme",
        channels: "channels",
        returns: "returns",
        master_gain: "masterGain",
        master_effects: "masterEffects",
        session_id: "sessionId",
      },
      status: {},
    }),
  },
  sampler: {
    tag: "nbplay-sampler",
    spec: (node) => ({
      config: {
        theme: "theme",
        sample_name: "sampleName",
        sample_rate: "sampleRate",
        sample_length: "sampleLength",
        root_note: "rootNote",
        waveform: "waveform",
        sample_data: "sampleData",
        attack: "attack",
        decay: "decay",
        sustain: "sustain",
        release: "release",
        max_voices: "maxVoices",
        pad_count: "padCount",
        pad_notes: "padNotes",
        pad_velocities: "padVelocities",
        pad_actions: "padActions",
        sample_slices: "sampleSlices",
        velocity: "velocity",
        velocity_sensitive: "velocitySensitive",
        zones: "zones",
        session_id: "sessionId",
        channel_index: "channelIndex",
      },
      status: {
        active_pads: "activePads",
        last_note_event: "lastNoteEvent",
        last_pad_event: "lastPadEvent",
      },
      command: "capture_request",
      onDisconnect: () => (node as NbplaySampler).silence(),
    }),
  },
  sequencer: {
    tag: "nbplay-sequencer",
    spec: (node) => ({
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
      status: { is_playing: "isPlaying", current_step: "currentStep" },
      onDisconnect: () => (node as NbplaySequencer).halt(),
    }),
  },
  timeline: {
    tag: "nbplay-timeline",
    spec: () => ({
      config: {
        theme: "theme",
        tracks: "tracks",
        clips: "clips",
        length: "length",
        selected_clip_id: "selectedClipId",
        bpm: "bpm",
        time_signature_num: "timeSignatureNum",
        time_signature_den: "timeSignatureDen",
        count_in_bars: "countInBars",
        auto_extend_recording: "autoExtendRecording",
        recording_extend_bars: "recordingExtendBars",
        pixels_per_beat: "pixelsPerBeat",
        session_id: "sessionId",
        current_beat: "currentBeat",
        export_clip_id: "exportClipId",
        import_clip_request: "importClipRequest",
        import_clip_data: "importClipData",
      },
      status: {
        is_playing: "isPlaying",
        is_recording: "isRecording",
        recording_track: "recordingTrack",
        recording_tracks: "recordingTracks",
        recording_countdown_beats: "recordingCountdownBeats",
        recording_error: "recordingError",
        recorded_clip: "recordedClip",
        exported_clip: "exportedClip",
        exported_clip_data: "exportedClipData",
      },
    }),
  },
  launcher: {
    tag: "nbplay-launcher",
    spec: () => ({
      config: {
        theme: "theme",
        tracks: "tracks",
        scenes: "scenes",
        slots: "slots",
        quantize: "quantize",
        bpm: "bpm",
        time_signature_num: "timeSignatureNum",
        time_signature_den: "timeSignatureDen",
        selected_slot: "selectedSlot",
        session_id: "sessionId",
      },
      status: {
        is_playing: "isPlaying",
        active_slots: "activeSlots",
        queued_slots: "queuedSlots",
      },
      command: "launch_request",
    }),
  },
  settings: {
    tag: "nbplay-settings",
    spec: () => ({
      config: {
        theme: "theme",
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
    }),
  },
  keyboard: {
    tag: "nbplay-keyboard",
    spec: (node) => ({
      config: {
        theme: "theme",
        upper_octave: "upperOctave",
        lower_octave: "lowerOctave",
        velocity: "velocity",
        sustain_upper: "sustainUpper",
        sustain_lower: "sustainLower",
        sustain_global: "sustainGlobal",
        ...ROUTED,
      },
      status: { active_notes: "activeNotes", last_note_event: "lastNoteEvent" },
      onDisconnect: () => (node as NbplayKeyboard).silence(),
    }),
  },
  midi_keyboard: {
    tag: "nbplay-midi-keyboard",
    spec: (node) => ({
      config: {
        theme: "theme",
        midi_port: "midiPort",
        sync_clock: "syncClock",
        ...ROUTED,
      },
      status: {
        available_midi_ports: "availableMidiPorts",
        active_notes: "activeNotes",
        last_note_event: "lastNoteEvent",
        control_change: "controlChange",
        clock_bpm: "clockBpm",
      },
      onDisconnect: () => (node as NbplayMidiKeyboard).silence(),
    }),
  },
  midi_output: {
    tag: "nbplay-midi-output",
    spec: (node) => ({
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
      onDisconnect: () => (node as NbplayMidiOutput).teardown(),
    }),
  },
  pad: {
    tag: "nbplay-pads",
    spec: (node) => ({
      config: {
        theme: "theme",
        rows: "rows",
        cols: "cols",
        velocity: "velocity",
        velocity_sensitive: "velocitySensitive",
        pad_notes: "padNotes",
        pad_velocities: "padVelocities",
        pad_actions: "padActions",
        ...ROUTED,
      },
      status: {
        active_pads: "activePads",
        last_note_event: "lastNoteEvent",
        last_pad_event: "lastPadEvent",
      },
      onDisconnect: () => (node as NbplayPads).releaseAll(),
    }),
  },
};

/** Render instrument `name` bound to `model` inside `el`; returns the cleanup function. */
export function render(
  name: string,
  { model, el }: { model: AnyModel; el: HTMLElement },
): () => void {
  const entry = INSTRUMENTS[name];
  if (!entry) throw new Error(`unknown instrument ${name}`);
  const node = document.createElement(entry.tag);
  return bindInstrument(model, el, node, entry.spec(node));
}
