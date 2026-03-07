use wasm_bindgen::prelude::*;
use web_sys::AudioContext;

use nbplay::audio::{AudioBuffer, AudioFormat, ChannelCount, SampleRate};
use nbplay::oscillator::{
    AudioSource, NoiseSource, SawOscillator, SineOscillator, SquareOscillator,
};

/// Web Audio output engine exposed to JavaScript via wasm-bindgen.
#[wasm_bindgen]
pub struct WasmAudioOutput {
    ctx: Option<AudioContext>,
    source: Option<web_sys::AudioBufferSourceNode>,
    gain: Option<web_sys::GainNode>,
}

#[wasm_bindgen]
impl WasmAudioOutput {
    /// Create a new audio output engine.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<WasmAudioOutput, JsValue> {
        Ok(WasmAudioOutput {
            ctx: None,
            source: None,
            gain: None,
        })
    }

    /// Start playing an oscillator.
    /// `osc_type`: "sine" | "square" | "saw" | "noise"
    pub fn start(
        &mut self,
        osc_type: &str,
        frequency: f64,
        amplitude: f64,
        sample_rate: u32,
    ) -> Result<(), JsValue> {
        self.stop();

        let opts = web_sys::AudioContextOptions::new();
        opts.set_sample_rate(sample_rate as f32);
        let ctx = AudioContext::new_with_context_options(&opts)?;
        let sr = ctx.sample_rate() as u32;

        // Render 2 seconds of audio and loop it
        let duration_frames = (sr * 2) as usize;
        let format = AudioFormat::new(SampleRate(sr), ChannelCount::MONO);
        let mut buf = AudioBuffer::silence(duration_frames, format);

        match osc_type {
            "sine" => {
                let mut osc = SineOscillator::new(frequency, amplitude, sr);
                osc.render(&mut buf);
            }
            "square" => {
                let mut osc = SquareOscillator::new(frequency, amplitude, sr);
                osc.render(&mut buf);
            }
            "saw" => {
                let mut osc = SawOscillator::new(frequency, amplitude, sr);
                osc.render(&mut buf);
            }
            "noise" => {
                let mut osc = NoiseSource::new(amplitude, 42);
                osc.render(&mut buf);
            }
            _ => {
                let mut osc = SineOscillator::new(frequency, amplitude, sr);
                osc.render(&mut buf);
            }
        }

        // Create Web Audio buffer
        let web_buf = ctx.create_buffer(1, duration_frames as u32, sr as f32)?;
        web_buf.copy_to_channel(&buf.data, 0)?;

        // Gain node
        let gain_node = ctx.create_gain()?;
        gain_node.gain().set_value(1.0);
        gain_node.connect_with_audio_node(&ctx.destination())?;

        // Source node
        let source_node = ctx.create_buffer_source()?;
        source_node.set_buffer(Some(&web_buf));
        source_node.set_loop(true);
        source_node.connect_with_audio_node(&gain_node)?;
        source_node.start()?;

        self.ctx = Some(ctx);
        self.source = Some(source_node);
        self.gain = Some(gain_node);
        Ok(())
    }

    /// Stop playback.
    pub fn stop(&mut self) {
        if let Some(s) = self.source.take() {
            #[allow(deprecated)]
            let _ = s.stop_with_when(0.0);
        }
        self.gain = None;
        if let Some(ctx) = self.ctx.take() {
            let _ = ctx.close();
        }
    }

    /// Whether audio is currently playing.
    pub fn is_playing(&self) -> bool {
        self.ctx.is_some()
    }

    /// Set the gain (amplitude). Only effective while playing.
    pub fn set_gain(&self, value: f32) {
        if let Some(g) = &self.gain {
            g.gain().set_value(value);
        }
    }

    /// Get the actual sample rate from the AudioContext.
    pub fn sample_rate(&self) -> f32 {
        self.ctx
            .as_ref()
            .map(|c| c.sample_rate())
            .unwrap_or(44100.0)
    }
}

impl Default for WasmAudioOutput {
    fn default() -> Self {
        WasmAudioOutput::new().unwrap()
    }
}
