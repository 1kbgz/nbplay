use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use js_sys::Array;

use nbplay::midi::{MidiMessage, parse_midi_bytes};

/// MIDI access handle backed by the Web MIDI API.
#[wasm_bindgen]
pub struct WasmMidiAccess {
    access: web_sys::MidiAccess,
}

#[wasm_bindgen]
impl WasmMidiAccess {
    /// Request MIDI access from the browser.
    /// Must be called from a user-gesture context in some browsers.
    pub async fn new() -> Result<WasmMidiAccess, JsValue> {
        let window = web_sys::window().ok_or_else(|| JsValue::from_str("no window"))?;
        let navigator = window.navigator();
        let promise = navigator.request_midi_access()?;
        let access_val = JsFuture::from(promise).await?;
        let access: web_sys::MidiAccess = access_val.dyn_into()?;
        Ok(WasmMidiAccess { access })
    }

    /// List available MIDI input port names.
    pub fn list_input_ports(&self) -> Vec<String> {
        let inputs: web_sys::MidiInputMap = self.access.inputs();
        let mut names = Vec::new();
        let entries = js_sys::try_iter(&inputs);
        if let Ok(Some(iter)) = entries {
            for entry in iter {
                if let Ok(val) = entry {
                    let arr: Array = val.dyn_into().unwrap_or_default();
                    if arr.length() >= 2 {
                        let port: web_sys::MidiPort = arr.get(1).dyn_into().unwrap();
                        if let Some(name) = port.name() {
                            names.push(name);
                        }
                    }
                }
            }
        }
        names
    }

    /// Get the number of available MIDI input ports.
    pub fn input_port_count(&self) -> usize {
        self.list_input_ports().len()
    }
}

/// Parse raw MIDI bytes (from a MIDIMessageEvent.data) into a JSON-serializable
/// object.  Returns null if the bytes don't form a valid message.
#[wasm_bindgen]
pub fn parse_midi_message(data: &[u8]) -> JsValue {
    match parse_midi_bytes(data) {
        Some(msg) => {
            // Return a plain JS object with the message details
            let obj = js_sys::Object::new();
            match &msg {
                MidiMessage::NoteOn { channel, note, velocity } => {
                    js_sys::Reflect::set(&obj, &"type".into(), &"noteOn".into()).ok();
                    js_sys::Reflect::set(&obj, &"channel".into(), &(channel.value() as u32).into()).ok();
                    js_sys::Reflect::set(&obj, &"note".into(), &(note.value() as u32).into()).ok();
                    js_sys::Reflect::set(&obj, &"velocity".into(), &(velocity.value() as u32).into()).ok();
                }
                MidiMessage::NoteOff { channel, note, velocity } => {
                    js_sys::Reflect::set(&obj, &"type".into(), &"noteOff".into()).ok();
                    js_sys::Reflect::set(&obj, &"channel".into(), &(channel.value() as u32).into()).ok();
                    js_sys::Reflect::set(&obj, &"note".into(), &(note.value() as u32).into()).ok();
                    js_sys::Reflect::set(&obj, &"velocity".into(), &(velocity.value() as u32).into()).ok();
                }
                MidiMessage::ControlChange { channel, control, value } => {
                    js_sys::Reflect::set(&obj, &"type".into(), &"controlChange".into()).ok();
                    js_sys::Reflect::set(&obj, &"channel".into(), &(channel.value() as u32).into()).ok();
                    js_sys::Reflect::set(&obj, &"control".into(), &(control.value() as u32).into()).ok();
                    js_sys::Reflect::set(&obj, &"value".into(), &(*value as u32).into()).ok();
                }
                MidiMessage::ProgramChange { channel, program } => {
                    js_sys::Reflect::set(&obj, &"type".into(), &"programChange".into()).ok();
                    js_sys::Reflect::set(&obj, &"channel".into(), &(channel.value() as u32).into()).ok();
                    js_sys::Reflect::set(&obj, &"program".into(), &(*program as u32).into()).ok();
                }
                MidiMessage::PitchBend { channel, value } => {
                    js_sys::Reflect::set(&obj, &"type".into(), &"pitchBend".into()).ok();
                    js_sys::Reflect::set(&obj, &"channel".into(), &(channel.value() as u32).into()).ok();
                    js_sys::Reflect::set(&obj, &"value".into(), &(*value as u32).into()).ok();
                }
                MidiMessage::Clock => {
                    js_sys::Reflect::set(&obj, &"type".into(), &"clock".into()).ok();
                }
                MidiMessage::Start => {
                    js_sys::Reflect::set(&obj, &"type".into(), &"start".into()).ok();
                }
                MidiMessage::Stop => {
                    js_sys::Reflect::set(&obj, &"type".into(), &"stop".into()).ok();
                }
                MidiMessage::Continue => {
                    js_sys::Reflect::set(&obj, &"type".into(), &"continue".into()).ok();
                }
                _ => {
                    js_sys::Reflect::set(&obj, &"type".into(), &"unknown".into()).ok();
                }
            }
            obj.into()
        }
        None => JsValue::NULL,
    }
}
