use wasm_bindgen::prelude::*;

mod web_audio;
mod web_midi;

pub use web_audio::*;
pub use web_midi::*;

/// Convenience: request MIDI access and return a WasmMidiAccess handle.
#[wasm_bindgen]
pub async fn request_midi_access() -> Result<web_midi::WasmMidiAccess, JsValue> {
    web_midi::WasmMidiAccess::new().await
}

/// List available MIDI input port names (async – calls requestMIDIAccess).
#[wasm_bindgen]
pub async fn list_midi_ports() -> Result<JsValue, JsValue> {
    let access = web_midi::WasmMidiAccess::new().await?;
    let ports = access.list_input_ports();
    let arr = js_sys::Array::new();
    for name in ports {
        arr.push(&JsValue::from_str(&name));
    }
    Ok(arr.into())
}

/// List available audio output device info (returns sampleRate from AudioContext).
#[wasm_bindgen]
pub fn default_sample_rate() -> f32 {
    let ctx = web_sys::AudioContext::new().ok();
    ctx.map(|c| c.sample_rate()).unwrap_or(44100.0)
}
