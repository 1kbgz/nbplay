import * as wasm from "../../dist/pkg/nbplay";

export * as wasm from "../../dist/pkg/nbplay";

// Re-export key WASM bindings at top level for convenience
export const WasmAudioOutput = wasm.WasmAudioOutput;
export const WasmMidiAccess = wasm.WasmMidiAccess;
export const request_midi_access = wasm.request_midi_access;
export const list_midi_ports = wasm.list_midi_ports;
export const default_sample_rate = wasm.default_sample_rate;
export const parse_midi_message = wasm.parse_midi_message;
