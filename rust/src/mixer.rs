use serde::{Deserialize, Serialize};

/// A single mixer channel with gain, pan, mute, and solo controls.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct MixerChannel {
    /// Channel name / label.
    pub name: String,
    /// Linear gain (0.0 = silence, 1.0 = unity).
    pub gain: f32,
    /// Stereo pan (-1.0 = full left, 0.0 = center, 1.0 = full right).
    pub pan: f32,
    /// Whether this channel is muted.
    pub mute: bool,
    /// Whether this channel is soloed.
    pub solo: bool,
}

impl MixerChannel {
    pub fn new(name: impl Into<String>) -> Self {
        MixerChannel {
            name: name.into(),
            gain: 0.8,
            pan: 0.0,
            mute: false,
            solo: false,
        }
    }

    /// Apply this channel's gain and pan to a mono sample, returning (left, right).
    pub fn process_sample(&self, sample: f32) -> (f32, f32) {
        if self.mute {
            return (0.0, 0.0);
        }
        let g = sample * self.gain;
        // Constant-power pan: pan in [-1, 1] mapped to [0, π/2]
        let angle = (self.pan + 1.0) * 0.25 * std::f32::consts::PI;
        let left = g * angle.cos();
        let right = g * angle.sin();
        (left, right)
    }
}

/// A mixer that combines multiple channels into a stereo master output.
#[derive(Clone, Debug)]
pub struct Mixer {
    /// Individual channels.
    pub channels: Vec<MixerChannel>,
    /// Master output gain (0.0–1.0).
    pub master_gain: f32,
}

impl Mixer {
    pub fn new() -> Self {
        Mixer {
            channels: Vec::new(),
            master_gain: 0.8,
        }
    }

    /// Add a channel and return its index.
    pub fn add_channel(&mut self, name: impl Into<String>) -> usize {
        let idx = self.channels.len();
        self.channels.push(MixerChannel::new(name));
        idx
    }

    /// Remove a channel by index. Returns None if out of bounds.
    pub fn remove_channel(&mut self, index: usize) -> Option<MixerChannel> {
        if index < self.channels.len() {
            Some(self.channels.remove(index))
        } else {
            None
        }
    }

    /// Get the number of channels.
    pub fn channel_count(&self) -> usize {
        self.channels.len()
    }

    /// Check whether any channel has solo enabled.
    fn has_solo(&self) -> bool {
        self.channels.iter().any(|ch| ch.solo)
    }

    /// Mix a set of per-channel mono sample buffers into a stereo output buffer.
    ///
    /// `channel_buffers` must have one entry per mixer channel. Each entry is
    /// a slice of mono f32 samples (all the same length).
    ///
    /// Returns interleaved stereo samples (L, R, L, R, …) with master gain applied.
    pub fn mix_down(&self, channel_buffers: &[&[f32]]) -> Vec<f32> {
        assert_eq!(
            channel_buffers.len(),
            self.channels.len(),
            "Number of buffers must match number of channels"
        );

        if channel_buffers.is_empty() {
            return Vec::new();
        }

        let frames = channel_buffers[0].len();
        let has_solo = self.has_solo();
        let mut output = vec![0.0f32; frames * 2];

        for (ch_idx, ch) in self.channels.iter().enumerate() {
            // If any channel is soloed, skip non-soloed channels
            if has_solo && !ch.solo {
                continue;
            }

            let buf = channel_buffers[ch_idx];
            for frame in 0..frames.min(buf.len()) {
                let (left, right) = ch.process_sample(buf[frame]);
                output[frame * 2] += left;
                output[frame * 2 + 1] += right;
            }
        }

        // Apply master gain
        for sample in output.iter_mut() {
            *sample *= self.master_gain;
        }

        output
    }
}

impl Default for Mixer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_channel_defaults() {
        let ch = MixerChannel::new("ch1");
        assert_eq!(ch.name, "ch1");
        assert_eq!(ch.gain, 0.8);
        assert_eq!(ch.pan, 0.0);
        assert!(!ch.mute);
        assert!(!ch.solo);
    }

    #[test]
    fn test_channel_mute() {
        let mut ch = MixerChannel::new("muted");
        ch.mute = true;
        let (l, r) = ch.process_sample(1.0);
        assert_eq!(l, 0.0);
        assert_eq!(r, 0.0);
    }

    #[test]
    fn test_channel_center_pan() {
        let ch = MixerChannel::new("center");
        let (l, r) = ch.process_sample(1.0);
        // At center pan (0.0), L and R should be equal
        assert!((l - r).abs() < 1e-6, "L={l} R={r}");
        // Both should be > 0
        assert!(l > 0.0);
    }

    #[test]
    fn test_channel_full_left_pan() {
        let mut ch = MixerChannel::new("left");
        ch.gain = 1.0;
        ch.pan = -1.0;
        let (l, r) = ch.process_sample(1.0);
        assert!(l > 0.9, "Left should be near 1.0, got {l}");
        assert!(r.abs() < 1e-6, "Right should be near 0.0, got {r}");
    }

    #[test]
    fn test_channel_full_right_pan() {
        let mut ch = MixerChannel::new("right");
        ch.gain = 1.0;
        ch.pan = 1.0;
        let (l, r) = ch.process_sample(1.0);
        assert!(l.abs() < 1e-6, "Left should be near 0.0, got {l}");
        assert!(r > 0.9, "Right should be near 1.0, got {r}");
    }

    #[test]
    fn test_mixer_add_remove_channels() {
        let mut mixer = Mixer::new();
        assert_eq!(mixer.channel_count(), 0);
        let idx0 = mixer.add_channel("ch0");
        let idx1 = mixer.add_channel("ch1");
        assert_eq!(idx0, 0);
        assert_eq!(idx1, 1);
        assert_eq!(mixer.channel_count(), 2);

        let removed = mixer.remove_channel(0);
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().name, "ch0");
        assert_eq!(mixer.channel_count(), 1);
    }

    #[test]
    fn test_mixer_remove_out_of_bounds() {
        let mut mixer = Mixer::new();
        assert!(mixer.remove_channel(0).is_none());
    }

    #[test]
    fn test_mixer_empty_mixdown() {
        let mixer = Mixer::new();
        let out = mixer.mix_down(&[]);
        assert!(out.is_empty());
    }

    #[test]
    fn test_mixer_single_channel_center() {
        let mut mixer = Mixer::new();
        mixer.add_channel("synth");
        mixer.channels[0].gain = 1.0;
        mixer.master_gain = 1.0;

        let input = vec![0.5, -0.5, 1.0];
        let out = mixer.mix_down(&[&input]);

        // 6 samples (3 frames * 2 channels)
        assert_eq!(out.len(), 6);
        // Center pan: L and R equal for each frame
        for frame in 0..3 {
            let l = out[frame * 2];
            let r = out[frame * 2 + 1];
            assert!((l - r).abs() < 1e-6, "frame {frame}: L={l} R={r}");
        }
    }

    #[test]
    fn test_mixer_two_channels_summed() {
        let mut mixer = Mixer::new();
        mixer.add_channel("a");
        mixer.add_channel("b");
        mixer.channels[0].gain = 1.0;
        mixer.channels[1].gain = 1.0;
        mixer.master_gain = 1.0;

        let buf_a: Vec<f32> = vec![0.5; 4];
        let buf_b: Vec<f32> = vec![0.3; 4];
        let out = mixer.mix_down(&[&buf_a, &buf_b]);

        assert_eq!(out.len(), 8);
        // Both channels center-panned, so each side gets both
        for i in 0..8 {
            assert!(
                out[i] > 0.0,
                "sample {i} should be positive, got {}",
                out[i]
            );
        }
    }

    #[test]
    fn test_mixer_mute_skips_channel() {
        let mut mixer = Mixer::new();
        mixer.add_channel("muted");
        mixer.channels[0].mute = true;
        mixer.master_gain = 1.0;

        let input = vec![1.0; 4];
        let out = mixer.mix_down(&[&input]);
        assert!(out.iter().all(|&s| s == 0.0));
    }

    #[test]
    fn test_mixer_solo_isolates_channel() {
        let mut mixer = Mixer::new();
        mixer.add_channel("a");
        mixer.add_channel("b");
        mixer.channels[0].gain = 1.0;
        mixer.channels[1].gain = 1.0;
        mixer.channels[1].solo = true;
        mixer.master_gain = 1.0;

        let buf_a: Vec<f32> = vec![1.0; 4];
        let buf_b: Vec<f32> = vec![0.0; 4];
        let out = mixer.mix_down(&[&buf_a, &buf_b]);

        // Only channel b (all zeros) should be heard
        assert!(out.iter().all(|&s| s == 0.0));
    }

    #[test]
    fn test_mixer_master_gain() {
        let mut mixer = Mixer::new();
        mixer.add_channel("ch");
        mixer.channels[0].gain = 1.0;
        mixer.channels[0].pan = 0.0;
        mixer.master_gain = 0.5;

        let input = vec![1.0; 2];
        let out_half = mixer.mix_down(&[&input]);

        mixer.master_gain = 1.0;
        let out_full = mixer.mix_down(&[&input]);

        // Half master gain → half the amplitude
        for i in 0..out_half.len() {
            assert!(
                (out_half[i] - out_full[i] * 0.5).abs() < 1e-6,
                "sample {i}: half={} full={}",
                out_half[i],
                out_full[i]
            );
        }
    }

    #[test]
    #[should_panic(expected = "Number of buffers must match")]
    fn test_mixer_mismatched_buffers_panics() {
        let mut mixer = Mixer::new();
        mixer.add_channel("a");
        mixer.add_channel("b");
        mixer.mix_down(&[&[1.0f32; 4]]);
    }
}
