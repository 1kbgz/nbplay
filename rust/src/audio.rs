use serde::{Deserialize, Serialize};

/// Sample rate in Hz.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SampleRate(pub u32);

impl SampleRate {
    pub const SR_44100: SampleRate = SampleRate(44100);
    pub const SR_48000: SampleRate = SampleRate(48000);
    pub const SR_96000: SampleRate = SampleRate(96000);
}

/// Number of audio channels.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ChannelCount(pub u16);

impl ChannelCount {
    pub const MONO: ChannelCount = ChannelCount(1);
    pub const STEREO: ChannelCount = ChannelCount(2);
}

/// Describes the format of an audio stream.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AudioFormat {
    pub sample_rate: SampleRate,
    pub channels: ChannelCount,
}

impl AudioFormat {
    pub fn new(sample_rate: SampleRate, channels: ChannelCount) -> Self {
        AudioFormat {
            sample_rate,
            channels,
        }
    }
}

/// A buffer of interleaved f32 audio samples.
#[derive(Clone, Debug, PartialEq)]
pub struct AudioBuffer {
    pub data: Vec<f32>,
    pub format: AudioFormat,
}

impl AudioBuffer {
    /// Create a new AudioBuffer from existing sample data.
    pub fn new(data: Vec<f32>, format: AudioFormat) -> Self {
        AudioBuffer { data, format }
    }

    /// Create a silent buffer with the given number of frames.
    pub fn silence(frames: usize, format: AudioFormat) -> Self {
        let sample_count = frames * format.channels.0 as usize;
        AudioBuffer {
            data: vec![0.0; sample_count],
            format,
        }
    }

    /// Returns the number of frames in the buffer.
    pub fn frames(&self) -> usize {
        if self.format.channels.0 == 0 {
            return 0;
        }
        self.data.len() / self.format.channels.0 as usize
    }

    /// Get the sample at (frame, channel). Returns None if out of bounds.
    pub fn sample_at(&self, frame: usize, channel: usize) -> Option<f32> {
        let channels = self.format.channels.0 as usize;
        if channel >= channels {
            return None;
        }
        let idx = frame * channels + channel;
        self.data.get(idx).copied()
    }

    /// Set the sample at (frame, channel). Returns false if out of bounds.
    pub fn set_sample(&mut self, frame: usize, channel: usize, value: f32) -> bool {
        let channels = self.format.channels.0 as usize;
        if channel >= channels {
            return false;
        }
        let idx = frame * channels + channel;
        if idx >= self.data.len() {
            return false;
        }
        self.data[idx] = value;
        true
    }

    /// Mix (add) another buffer into this one, sample-by-sample.
    /// Buffers must have the same format. Only mixes up to the shorter length.
    pub fn mix_into(&mut self, other: &AudioBuffer) {
        assert_eq!(
            self.format, other.format,
            "Cannot mix buffers with different formats"
        );
        let len = self.data.len().min(other.data.len());
        for i in 0..len {
            self.data[i] += other.data[i];
        }
    }

    /// Zero out all samples.
    pub fn clear(&mut self) {
        for sample in self.data.iter_mut() {
            *sample = 0.0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stereo_44100() -> AudioFormat {
        AudioFormat::new(SampleRate::SR_44100, ChannelCount::STEREO)
    }

    fn mono_44100() -> AudioFormat {
        AudioFormat::new(SampleRate::SR_44100, ChannelCount::MONO)
    }

    #[test]
    fn test_sample_rate_constants() {
        assert_eq!(SampleRate::SR_44100.0, 44100);
        assert_eq!(SampleRate::SR_48000.0, 48000);
        assert_eq!(SampleRate::SR_96000.0, 96000);
    }

    #[test]
    fn test_channel_count_constants() {
        assert_eq!(ChannelCount::MONO.0, 1);
        assert_eq!(ChannelCount::STEREO.0, 2);
    }

    #[test]
    fn test_audio_format() {
        let fmt = stereo_44100();
        assert_eq!(fmt.sample_rate, SampleRate::SR_44100);
        assert_eq!(fmt.channels, ChannelCount::STEREO);
    }

    #[test]
    fn test_silence_buffer() {
        let buf = AudioBuffer::silence(128, stereo_44100());
        assert_eq!(buf.frames(), 128);
        assert_eq!(buf.data.len(), 256); // 128 frames * 2 channels
        assert!(buf.data.iter().all(|&s| s == 0.0));
    }

    #[test]
    fn test_sample_at_and_set_sample() {
        let mut buf = AudioBuffer::silence(4, stereo_44100());
        assert_eq!(buf.sample_at(0, 0), Some(0.0));
        assert_eq!(buf.sample_at(0, 1), Some(0.0));

        assert!(buf.set_sample(2, 0, 0.5));
        assert!(buf.set_sample(2, 1, -0.3));
        assert_eq!(buf.sample_at(2, 0), Some(0.5));
        assert_eq!(buf.sample_at(2, 1), Some(-0.3));

        // Out of bounds
        assert_eq!(buf.sample_at(4, 0), None);
        assert_eq!(buf.sample_at(0, 2), None);
        assert!(!buf.set_sample(4, 0, 1.0));
        assert!(!buf.set_sample(0, 2, 1.0));
    }

    #[test]
    fn test_mix_into() {
        let fmt = mono_44100();
        let mut buf_a = AudioBuffer::new(vec![0.1, 0.2, 0.3, 0.4], fmt);
        let buf_b = AudioBuffer::new(vec![0.5, 0.5, 0.5, 0.5], fmt);

        buf_a.mix_into(&buf_b);
        let expected = vec![0.6, 0.7, 0.8, 0.9];
        for (a, e) in buf_a.data.iter().zip(expected.iter()) {
            assert!((a - e).abs() < 1e-6, "Expected {e}, got {a}");
        }
    }

    #[test]
    #[should_panic(expected = "Cannot mix buffers with different formats")]
    fn test_mix_into_different_formats_panics() {
        let mut buf_a = AudioBuffer::silence(4, mono_44100());
        let buf_b = AudioBuffer::silence(4, stereo_44100());
        buf_a.mix_into(&buf_b);
    }

    #[test]
    fn test_clear() {
        let mut buf = AudioBuffer::new(vec![1.0, -1.0, 0.5, -0.5], mono_44100());
        buf.clear();
        assert!(buf.data.iter().all(|&s| s == 0.0));
    }

    #[test]
    fn test_new_buffer() {
        let data = vec![0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
        let buf = AudioBuffer::new(data.clone(), stereo_44100());
        assert_eq!(buf.frames(), 3);
        assert_eq!(buf.data, data);
    }

    #[test]
    fn test_clone_and_eq() {
        let buf = AudioBuffer::new(vec![0.1, 0.2], mono_44100());
        let buf2 = buf.clone();
        assert_eq!(buf, buf2);
    }
}
