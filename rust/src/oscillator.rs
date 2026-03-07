use crate::audio::{AudioBuffer, AudioFormat, ChannelCount, SampleRate};

/// Trait for anything that generates audio samples.
pub trait AudioSource: Send {
    /// Fill the given buffer with rendered audio.
    fn render(&mut self, buffer: &mut AudioBuffer);
}

/// Sine wave oscillator.
pub struct SineOscillator {
    pub frequency: f64,
    pub amplitude: f64,
    pub sample_rate: u32,
    phase: f64,
}

impl SineOscillator {
    pub fn new(frequency: f64, amplitude: f64, sample_rate: u32) -> Self {
        SineOscillator {
            frequency,
            amplitude,
            sample_rate,
            phase: 0.0,
        }
    }
}

impl AudioSource for SineOscillator {
    fn render(&mut self, buffer: &mut AudioBuffer) {
        let channels = buffer.format.channels.0 as usize;
        let frames = buffer.frames();
        let phase_inc = self.frequency / self.sample_rate as f64;

        for frame in 0..frames {
            let value = (self.phase * 2.0 * std::f64::consts::PI).sin() * self.amplitude;
            let sample = value as f32;
            for ch in 0..channels {
                buffer.set_sample(frame, ch, sample);
            }
            self.phase += phase_inc;
            // Keep phase in [0, 1) to avoid floating point drift
            self.phase -= self.phase.floor();
        }
    }
}

/// Square wave oscillator.
pub struct SquareOscillator {
    pub frequency: f64,
    pub amplitude: f64,
    pub sample_rate: u32,
    phase: f64,
}

impl SquareOscillator {
    pub fn new(frequency: f64, amplitude: f64, sample_rate: u32) -> Self {
        SquareOscillator {
            frequency,
            amplitude,
            sample_rate,
            phase: 0.0,
        }
    }
}

impl AudioSource for SquareOscillator {
    fn render(&mut self, buffer: &mut AudioBuffer) {
        let channels = buffer.format.channels.0 as usize;
        let frames = buffer.frames();
        let phase_inc = self.frequency / self.sample_rate as f64;

        for frame in 0..frames {
            let value = if self.phase < 0.5 {
                self.amplitude
            } else {
                -self.amplitude
            };
            let sample = value as f32;
            for ch in 0..channels {
                buffer.set_sample(frame, ch, sample);
            }
            self.phase += phase_inc;
            self.phase -= self.phase.floor();
        }
    }
}

/// Sawtooth wave oscillator.
pub struct SawOscillator {
    pub frequency: f64,
    pub amplitude: f64,
    pub sample_rate: u32,
    phase: f64,
}

impl SawOscillator {
    pub fn new(frequency: f64, amplitude: f64, sample_rate: u32) -> Self {
        SawOscillator {
            frequency,
            amplitude,
            sample_rate,
            phase: 0.0,
        }
    }
}

impl AudioSource for SawOscillator {
    fn render(&mut self, buffer: &mut AudioBuffer) {
        let channels = buffer.format.channels.0 as usize;
        let frames = buffer.frames();
        let phase_inc = self.frequency / self.sample_rate as f64;

        for frame in 0..frames {
            // Saw ramps from -amplitude to +amplitude over one cycle
            let value = (2.0 * self.phase - 1.0) * self.amplitude;
            let sample = value as f32;
            for ch in 0..channels {
                buffer.set_sample(frame, ch, sample);
            }
            self.phase += phase_inc;
            self.phase -= self.phase.floor();
        }
    }
}

/// White noise source with a simple deterministic LCG PRNG for testability.
pub struct NoiseSource {
    pub amplitude: f64,
    state: u64,
}

impl NoiseSource {
    pub fn new(amplitude: f64, seed: u64) -> Self {
        NoiseSource {
            amplitude,
            state: seed,
        }
    }

    fn next_sample(&mut self) -> f32 {
        // Simple LCG: state = (a * state + c) mod m
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1);
        // Map to [-1.0, 1.0]
        let normalized = (self.state >> 33) as f64 / (u32::MAX as f64 / 2.0) - 1.0;
        (normalized * self.amplitude) as f32
    }
}

impl AudioSource for NoiseSource {
    fn render(&mut self, buffer: &mut AudioBuffer) {
        let channels = buffer.format.channels.0 as usize;
        let frames = buffer.frames();

        for frame in 0..frames {
            let sample = self.next_sample();
            for ch in 0..channels {
                buffer.set_sample(frame, ch, sample);
            }
        }
    }
}

/// Helper to render an AudioSource into a new buffer.
pub fn render_offline(
    source: &mut dyn AudioSource,
    frames: usize,
    sample_rate: u32,
    channels: u16,
) -> AudioBuffer {
    let format = AudioFormat::new(SampleRate(sample_rate), ChannelCount(channels));
    let mut buffer = AudioBuffer::silence(frames, format);
    source.render(&mut buffer);
    buffer
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::{AudioFormat, ChannelCount, SampleRate};

    fn mono_44100() -> AudioFormat {
        AudioFormat::new(SampleRate::SR_44100, ChannelCount::MONO)
    }

    #[test]
    fn test_sine_oscillator_peak_amplitude() {
        let mut osc = SineOscillator::new(440.0, 1.0, 44100);
        let mut buf = AudioBuffer::silence(44100, mono_44100());
        osc.render(&mut buf);

        let max = buf.data.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        let min = buf.data.iter().cloned().fold(f32::INFINITY, f32::min);

        // Peak should be close to +/- 1.0
        assert!(max > 0.99, "max was {max}");
        assert!(min < -0.99, "min was {min}");
        assert!(max <= 1.001, "max was {max}");
        assert!(min >= -1.001, "min was {min}");
    }

    #[test]
    fn test_sine_oscillator_zero_crossings() {
        // 440 Hz over 1 second at 44100 Hz should have ~880 zero crossings
        let mut osc = SineOscillator::new(440.0, 1.0, 44100);
        let mut buf = AudioBuffer::silence(44100, mono_44100());
        osc.render(&mut buf);

        let mut crossings = 0;
        for i in 1..buf.data.len() {
            if (buf.data[i - 1] >= 0.0 && buf.data[i] < 0.0)
                || (buf.data[i - 1] < 0.0 && buf.data[i] >= 0.0)
            {
                crossings += 1;
            }
        }
        // 440 Hz: 880 zero crossings per second (±1 for boundary)
        assert!(
            crossings >= 878 && crossings <= 882,
            "Expected ~880 zero crossings, got {crossings}"
        );
    }

    #[test]
    fn test_sine_oscillator_custom_amplitude() {
        let mut osc = SineOscillator::new(440.0, 0.5, 44100);
        let mut buf = AudioBuffer::silence(44100, mono_44100());
        osc.render(&mut buf);

        let max = buf.data.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        assert!(max > 0.49 && max < 0.51, "max was {max}");
    }

    #[test]
    fn test_square_oscillator_values() {
        let mut osc = SquareOscillator::new(1.0, 1.0, 100);
        // 1 Hz at 100 Hz sample rate = 100 samples per cycle
        let mut buf = AudioBuffer::silence(100, AudioFormat::new(SampleRate(100), ChannelCount::MONO));
        osc.render(&mut buf);

        // First half should be +1.0, second half should be -1.0
        for i in 0..50 {
            assert!(
                (buf.data[i] - 1.0).abs() < 1e-6,
                "Sample {i}: expected 1.0, got {}",
                buf.data[i]
            );
        }
        for i in 50..100 {
            assert!(
                (buf.data[i] - (-1.0)).abs() < 1e-6,
                "Sample {i}: expected -1.0, got {}",
                buf.data[i]
            );
        }
    }

    #[test]
    fn test_square_oscillator_amplitude() {
        let mut osc = SquareOscillator::new(100.0, 0.7, 44100);
        let mut buf = AudioBuffer::silence(44100, mono_44100());
        osc.render(&mut buf);

        for sample in &buf.data {
            assert!(
                (*sample - 0.7).abs() < 1e-5 || (*sample - (-0.7)).abs() < 1e-5,
                "Sample should be ±0.7, got {sample}"
            );
        }
    }

    #[test]
    fn test_saw_oscillator_ramps_linearly() {
        let mut osc = SawOscillator::new(1.0, 1.0, 100);
        let mut buf = AudioBuffer::silence(100, AudioFormat::new(SampleRate(100), ChannelCount::MONO));
        osc.render(&mut buf);

        // Saw should ramp from -1.0 to nearly +1.0 over one cycle
        // First sample: phase=0 => (2*0 - 1)*1.0 = -1.0
        assert!(
            (buf.data[0] - (-1.0)).abs() < 1e-5,
            "First sample: expected -1.0, got {}",
            buf.data[0]
        );
        // Midpoint (sample 50): phase=0.5 => (2*0.5 - 1)*1.0 = 0.0
        assert!(
            buf.data[50].abs() < 0.05,
            "Midpoint: expected ~0.0, got {}",
            buf.data[50]
        );
        // Each consecutive sample should increase (monotonic ramp)
        for i in 1..100 {
            assert!(
                buf.data[i] > buf.data[i - 1],
                "Saw should be monotonically increasing: sample[{i}]={} <= sample[{}]={}",
                buf.data[i],
                i - 1,
                buf.data[i - 1]
            );
        }
    }

    #[test]
    fn test_noise_source_range_and_nonconstant() {
        let mut noise = NoiseSource::new(1.0, 42);
        let mut buf = AudioBuffer::silence(1000, mono_44100());
        noise.render(&mut buf);

        let max = buf.data.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        let min = buf.data.iter().cloned().fold(f32::INFINITY, f32::min);

        // All samples should be in [-1.0, 1.0]
        assert!(max <= 1.0, "max was {max}");
        assert!(min >= -1.0, "min was {min}");

        // Should not be constant
        let first = buf.data[0];
        let all_same = buf.data.iter().all(|&s| (s - first).abs() < 1e-10);
        assert!(!all_same, "Noise output should not be all the same value");
    }

    #[test]
    fn test_noise_source_deterministic() {
        let mut noise1 = NoiseSource::new(1.0, 42);
        let mut buf1 = AudioBuffer::silence(100, mono_44100());
        noise1.render(&mut buf1);

        let mut noise2 = NoiseSource::new(1.0, 42);
        let mut buf2 = AudioBuffer::silence(100, mono_44100());
        noise2.render(&mut buf2);

        assert_eq!(buf1.data, buf2.data, "Same seed should produce same output");
    }

    #[test]
    fn test_render_offline_helper() {
        let mut osc = SineOscillator::new(440.0, 1.0, 44100);
        let buf = render_offline(&mut osc, 1024, 44100, 1);
        assert_eq!(buf.frames(), 1024);
        assert_eq!(buf.format.channels, ChannelCount::MONO);
    }

    #[test]
    fn test_stereo_rendering() {
        let mut osc = SineOscillator::new(440.0, 1.0, 44100);
        let fmt = AudioFormat::new(SampleRate::SR_44100, ChannelCount::STEREO);
        let mut buf = AudioBuffer::silence(100, fmt);
        osc.render(&mut buf);

        // Both channels should have the same value for each frame
        for frame in 0..100 {
            let left = buf.sample_at(frame, 0).unwrap();
            let right = buf.sample_at(frame, 1).unwrap();
            assert!(
                (left - right).abs() < 1e-6,
                "Frame {frame}: left={left}, right={right}"
            );
        }
    }
}
