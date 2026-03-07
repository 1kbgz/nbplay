use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Host, Stream, StreamConfig};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Configuration for audio output.
#[derive(Clone, Debug)]
pub struct AudioOutputConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: u32,
}

impl Default for AudioOutputConfig {
    fn default() -> Self {
        AudioOutputConfig {
            sample_rate: 44100,
            channels: 2,
            buffer_size: 512,
        }
    }
}

/// Lists available audio output device names.
pub fn list_audio_devices() -> Vec<String> {
    let host = cpal::default_host();
    host.output_devices()
        .map(|devices| {
            devices
                .filter_map(|d| d.name().ok())
                .collect::<Vec<String>>()
        })
        .unwrap_or_default()
}

/// Audio output that streams rendered audio to the system's default output device.
pub struct AudioOutput {
    _host: Host,
    device: Device,
    config: AudioOutputConfig,
    stream: Option<Stream>,
    playing: Arc<AtomicBool>,
}

// Stream is !Send but we manage it carefully
unsafe impl Send for AudioOutput {}

impl AudioOutput {
    /// Create a new AudioOutput with the default output device.
    pub fn new(config: AudioOutputConfig) -> Result<Self, String> {
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or_else(|| "No default audio output device found".to_string())?;
        Ok(AudioOutput {
            _host: host,
            device,
            config,
            stream: None,
            playing: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Get the name of the output device.
    pub fn device_name(&self) -> String {
        self.device.name().unwrap_or_else(|_| "Unknown".to_string())
    }

    /// Start playing audio using the provided render callback.
    /// The callback receives a mutable slice of f32 samples (interleaved) and should fill it.
    pub fn play<F>(&mut self, mut render_fn: F) -> Result<(), String>
    where
        F: FnMut(&mut [f32]) + Send + 'static,
    {
        if self.playing.load(Ordering::SeqCst) {
            return Err("Already playing".to_string());
        }

        let stream_config = StreamConfig {
            channels: self.config.channels,
            sample_rate: cpal::SampleRate(self.config.sample_rate),
            buffer_size: cpal::BufferSize::Fixed(self.config.buffer_size),
        };

        let playing = self.playing.clone();

        let stream = self
            .device
            .build_output_stream(
                &stream_config,
                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    render_fn(data);
                },
                move |err| {
                    eprintln!("Audio stream error: {err}");
                },
                None,
            )
            .map_err(|e| format!("Failed to build output stream: {e}"))?;

        stream
            .play()
            .map_err(|e| format!("Failed to start stream: {e}"))?;

        playing.store(true, Ordering::SeqCst);
        self.stream = Some(stream);
        Ok(())
    }

    /// Stop the audio output stream.
    pub fn stop(&mut self) {
        self.stream = None;
        self.playing.store(false, Ordering::SeqCst);
    }

    /// Check if the output is currently playing.
    pub fn is_playing(&self) -> bool {
        self.playing.load(Ordering::SeqCst)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AudioOutputConfig::default();
        assert_eq!(config.sample_rate, 44100);
        assert_eq!(config.channels, 2);
        assert_eq!(config.buffer_size, 512);
    }

    #[test]
    fn test_list_audio_devices() {
        // Should not panic; may return empty list in CI
        let devices = list_audio_devices();
        // Just verify it returns a Vec<String>
        let _ = devices;
    }

    #[test]
    fn test_audio_output_construction() {
        // This may fail in CI without audio devices, so we accept both outcomes
        match AudioOutput::new(AudioOutputConfig::default()) {
            Ok(output) => {
                assert!(!output.is_playing());
                let name = output.device_name();
                assert!(!name.is_empty());
            }
            Err(e) => {
                // Expected in headless CI environments
                assert!(e.contains("No default audio output device"));
            }
        }
    }
}
