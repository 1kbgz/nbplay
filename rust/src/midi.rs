use serde::{Deserialize, Serialize};

/// MIDI channel (0–15).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct MidiChannel(u8);

impl MidiChannel {
    pub fn new(value: u8) -> Result<Self, String> {
        if value > 15 {
            Err(format!("MidiChannel out of range: {value} (must be 0–15)"))
        } else {
            Ok(MidiChannel(value))
        }
    }

    pub fn value(&self) -> u8 {
        self.0
    }
}

/// MIDI note number (0–127).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Note(u8);

impl Note {
    pub fn new(value: u8) -> Result<Self, String> {
        if value > 127 {
            Err(format!("Note out of range: {value} (must be 0–127)"))
        } else {
            Ok(Note(value))
        }
    }

    pub fn value(&self) -> u8 {
        self.0
    }

    // Common note constants
    pub const C4: Note = Note(60);
    pub const D4: Note = Note(62);
    pub const E4: Note = Note(64);
    pub const F4: Note = Note(65);
    pub const G4: Note = Note(67);
    pub const A4: Note = Note(69);
    pub const B4: Note = Note(71);
    pub const C5: Note = Note(72);
}

/// MIDI velocity (0–127).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Velocity(u8);

impl Velocity {
    pub fn new(value: u8) -> Result<Self, String> {
        if value > 127 {
            Err(format!("Velocity out of range: {value} (must be 0–127)"))
        } else {
            Ok(Velocity(value))
        }
    }

    pub fn value(&self) -> u8 {
        self.0
    }
}

/// MIDI control change number (0–127).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ControlNumber(u8);

impl ControlNumber {
    pub fn new(value: u8) -> Result<Self, String> {
        if value > 127 {
            Err(format!(
                "ControlNumber out of range: {value} (must be 0–127)"
            ))
        } else {
            Ok(ControlNumber(value))
        }
    }

    pub fn value(&self) -> u8 {
        self.0
    }
}

/// A MIDI message.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum MidiMessage {
    NoteOn {
        channel: MidiChannel,
        note: Note,
        velocity: Velocity,
    },
    NoteOff {
        channel: MidiChannel,
        note: Note,
        velocity: Velocity,
    },
    ControlChange {
        channel: MidiChannel,
        control: ControlNumber,
        value: u8,
    },
    ProgramChange {
        channel: MidiChannel,
        program: u8,
    },
    PitchBend {
        channel: MidiChannel,
        value: u16,
    },
    Aftertouch {
        channel: MidiChannel,
        note: Note,
        pressure: u8,
    },
    ChannelPressure {
        channel: MidiChannel,
        pressure: u8,
    },
    Clock,
    Start,
    Stop,
    Continue,
}

/// A timestamped MIDI event.
#[derive(Clone, Debug, PartialEq)]
pub struct MidiEvent {
    pub message: MidiMessage,
    pub timestamp_us: u64,
}

impl MidiEvent {
    pub fn new(message: MidiMessage, timestamp_us: u64) -> Self {
        MidiEvent {
            message,
            timestamp_us,
        }
    }
}

/// Convert a MIDI note number (0–127) to a frequency in Hz.
/// Uses A4 = 440 Hz standard tuning.
pub fn note_to_hz(note: u8) -> f64 {
    440.0 * 2.0_f64.powf((note as f64 - 69.0) / 12.0)
}

/// Convert a frequency in Hz to the nearest MIDI note number (0–127).
/// Uses A4 = 440 Hz standard tuning.
pub fn hz_to_note(hz: f64) -> u8 {
    let note = 69.0 + 12.0 * (hz / 440.0).log2();
    note.round().clamp(0.0, 127.0) as u8
}

/// Parse raw MIDI bytes into a MidiMessage.
/// Returns None if the bytes are not a valid/supported MIDI message.
pub fn parse_midi_bytes(data: &[u8]) -> Option<MidiMessage> {
    if data.is_empty() {
        return None;
    }

    let status = data[0];

    // System real-time messages (single byte)
    match status {
        0xF8 => return Some(MidiMessage::Clock),
        0xFA => return Some(MidiMessage::Start),
        0xFB => return Some(MidiMessage::Continue),
        0xFC => return Some(MidiMessage::Stop),
        _ => {}
    }

    let msg_type = status & 0xF0;
    let channel = MidiChannel(status & 0x0F);

    match msg_type {
        0x90 => {
            // Note On
            if data.len() < 3 {
                return None;
            }
            let note = Note::new(data[1]).ok()?;
            let velocity = Velocity::new(data[2]).ok()?;
            if velocity.value() == 0 {
                // Note On with velocity 0 is equivalent to Note Off
                Some(MidiMessage::NoteOff {
                    channel,
                    note,
                    velocity,
                })
            } else {
                Some(MidiMessage::NoteOn {
                    channel,
                    note,
                    velocity,
                })
            }
        }
        0x80 => {
            // Note Off
            if data.len() < 3 {
                return None;
            }
            let note = Note::new(data[1]).ok()?;
            let velocity = Velocity::new(data[2]).ok()?;
            Some(MidiMessage::NoteOff {
                channel,
                note,
                velocity,
            })
        }
        0xB0 => {
            // Control Change
            if data.len() < 3 {
                return None;
            }
            let control = ControlNumber::new(data[1]).ok()?;
            Some(MidiMessage::ControlChange {
                channel,
                control,
                value: data[2],
            })
        }
        0xC0 => {
            // Program Change
            if data.len() < 2 {
                return None;
            }
            Some(MidiMessage::ProgramChange {
                channel,
                program: data[1],
            })
        }
        0xE0 => {
            // Pitch Bend
            if data.len() < 3 {
                return None;
            }
            let value = (data[2] as u16) << 7 | (data[1] as u16);
            Some(MidiMessage::PitchBend { channel, value })
        }
        0xA0 => {
            // Polyphonic Key Pressure (Aftertouch)
            if data.len() < 3 {
                return None;
            }
            let note = Note::new(data[1]).ok()?;
            Some(MidiMessage::Aftertouch {
                channel,
                note,
                pressure: data[2],
            })
        }
        0xD0 => {
            // Channel Pressure
            if data.len() < 2 {
                return None;
            }
            Some(MidiMessage::ChannelPressure {
                channel,
                pressure: data[1],
            })
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_note_to_hz_a4() {
        let hz = note_to_hz(69);
        assert!((hz - 440.0).abs() < 1e-10, "A4 should be 440 Hz, got {hz}");
    }

    #[test]
    fn test_note_to_hz_c4() {
        let hz = note_to_hz(60);
        // C4 should be approximately 261.626 Hz
        assert!(
            (hz - 261.6256).abs() < 0.01,
            "C4 should be ~261.63 Hz, got {hz}"
        );
    }

    #[test]
    fn test_note_to_hz_octave_relationship() {
        let a3 = note_to_hz(57);
        let a4 = note_to_hz(69);
        let a5 = note_to_hz(81);
        assert!((a4 / a3 - 2.0).abs() < 1e-10, "A4 should be double A3");
        assert!((a5 / a4 - 2.0).abs() < 1e-10, "A5 should be double A4");
    }

    #[test]
    fn test_hz_to_note_440() {
        assert_eq!(hz_to_note(440.0), 69);
    }

    #[test]
    fn test_hz_to_note_round_trip() {
        for note in 0..=127u8 {
            let hz = note_to_hz(note);
            let back = hz_to_note(hz);
            assert_eq!(back, note, "Round trip failed for note {note}");
        }
    }

    #[test]
    fn test_midi_channel_valid() {
        for i in 0..=15 {
            assert!(MidiChannel::new(i).is_ok());
        }
    }

    #[test]
    fn test_midi_channel_invalid() {
        assert!(MidiChannel::new(16).is_err());
        assert!(MidiChannel::new(255).is_err());
    }

    #[test]
    fn test_note_valid() {
        for i in 0..=127 {
            assert!(Note::new(i).is_ok());
        }
    }

    #[test]
    fn test_note_invalid() {
        assert!(Note::new(128).is_err());
        assert!(Note::new(255).is_err());
    }

    #[test]
    fn test_velocity_valid() {
        for i in 0..=127 {
            assert!(Velocity::new(i).is_ok());
        }
    }

    #[test]
    fn test_velocity_invalid() {
        assert!(Velocity::new(128).is_err());
    }

    #[test]
    fn test_control_number_valid() {
        for i in 0..=127 {
            assert!(ControlNumber::new(i).is_ok());
        }
    }

    #[test]
    fn test_control_number_invalid() {
        assert!(ControlNumber::new(128).is_err());
    }

    #[test]
    fn test_note_constants() {
        assert_eq!(Note::A4.value(), 69);
        assert_eq!(Note::C4.value(), 60);
        assert_eq!(Note::C5.value(), 72);
    }

    #[test]
    fn test_midi_message_clone_debug_eq() {
        let messages = vec![
            MidiMessage::NoteOn {
                channel: MidiChannel(0),
                note: Note::A4,
                velocity: Velocity(100),
            },
            MidiMessage::NoteOff {
                channel: MidiChannel(0),
                note: Note::A4,
                velocity: Velocity(0),
            },
            MidiMessage::ControlChange {
                channel: MidiChannel(1),
                control: ControlNumber(64),
                value: 127,
            },
            MidiMessage::ProgramChange {
                channel: MidiChannel(0),
                program: 0,
            },
            MidiMessage::PitchBend {
                channel: MidiChannel(0),
                value: 8192,
            },
            MidiMessage::Aftertouch {
                channel: MidiChannel(0),
                note: Note::C4,
                pressure: 64,
            },
            MidiMessage::ChannelPressure {
                channel: MidiChannel(0),
                pressure: 64,
            },
            MidiMessage::Clock,
            MidiMessage::Start,
            MidiMessage::Stop,
            MidiMessage::Continue,
        ];

        for msg in &messages {
            let cloned = msg.clone();
            assert_eq!(*msg, cloned);
            // Debug should not panic
            let _ = format!("{msg:?}");
        }
    }

    #[test]
    fn test_midi_event() {
        let event = MidiEvent::new(
            MidiMessage::NoteOn {
                channel: MidiChannel(0),
                note: Note::A4,
                velocity: Velocity(100),
            },
            12345,
        );
        assert_eq!(event.timestamp_us, 12345);
        assert_eq!(
            event.message,
            MidiMessage::NoteOn {
                channel: MidiChannel(0),
                note: Note::A4,
                velocity: Velocity(100),
            }
        );
    }

    #[test]
    fn test_parse_note_on() {
        let data = [0x90, 69, 100]; // Note On, channel 0, A4, velocity 100
        let msg = parse_midi_bytes(&data).unwrap();
        assert_eq!(
            msg,
            MidiMessage::NoteOn {
                channel: MidiChannel(0),
                note: Note::A4,
                velocity: Velocity(100),
            }
        );
    }

    #[test]
    fn test_parse_note_on_velocity_zero_is_note_off() {
        let data = [0x90, 69, 0]; // Note On with velocity 0 => Note Off
        let msg = parse_midi_bytes(&data).unwrap();
        assert_eq!(
            msg,
            MidiMessage::NoteOff {
                channel: MidiChannel(0),
                note: Note::A4,
                velocity: Velocity(0),
            }
        );
    }

    #[test]
    fn test_parse_note_off() {
        let data = [0x80, 60, 64]; // Note Off, channel 0, C4
        let msg = parse_midi_bytes(&data).unwrap();
        assert_eq!(
            msg,
            MidiMessage::NoteOff {
                channel: MidiChannel(0),
                note: Note::C4,
                velocity: Velocity(64),
            }
        );
    }

    #[test]
    fn test_parse_control_change() {
        let data = [0xB1, 64, 127]; // CC, channel 1, sustain pedal on
        let msg = parse_midi_bytes(&data).unwrap();
        assert_eq!(
            msg,
            MidiMessage::ControlChange {
                channel: MidiChannel(1),
                control: ControlNumber(64),
                value: 127,
            }
        );
    }

    #[test]
    fn test_parse_program_change() {
        let data = [0xC0, 10]; // Program Change, channel 0
        let msg = parse_midi_bytes(&data).unwrap();
        assert_eq!(
            msg,
            MidiMessage::ProgramChange {
                channel: MidiChannel(0),
                program: 10,
            }
        );
    }

    #[test]
    fn test_parse_pitch_bend() {
        let data = [0xE0, 0x00, 0x40]; // Pitch bend center, channel 0
        let msg = parse_midi_bytes(&data).unwrap();
        assert_eq!(
            msg,
            MidiMessage::PitchBend {
                channel: MidiChannel(0),
                value: 8192, // 0x40 << 7 | 0x00
            }
        );
    }

    #[test]
    fn test_parse_aftertouch() {
        let data = [0xA0, 60, 64]; // Aftertouch, channel 0, C4
        let msg = parse_midi_bytes(&data).unwrap();
        assert_eq!(
            msg,
            MidiMessage::Aftertouch {
                channel: MidiChannel(0),
                note: Note::C4,
                pressure: 64,
            }
        );
    }

    #[test]
    fn test_parse_channel_pressure() {
        let data = [0xD0, 100]; // Channel Pressure, channel 0
        let msg = parse_midi_bytes(&data).unwrap();
        assert_eq!(
            msg,
            MidiMessage::ChannelPressure {
                channel: MidiChannel(0),
                pressure: 100,
            }
        );
    }

    #[test]
    fn test_parse_system_realtime() {
        assert_eq!(parse_midi_bytes(&[0xF8]), Some(MidiMessage::Clock));
        assert_eq!(parse_midi_bytes(&[0xFA]), Some(MidiMessage::Start));
        assert_eq!(parse_midi_bytes(&[0xFB]), Some(MidiMessage::Continue));
        assert_eq!(parse_midi_bytes(&[0xFC]), Some(MidiMessage::Stop));
    }

    #[test]
    fn test_parse_empty_returns_none() {
        assert_eq!(parse_midi_bytes(&[]), None);
    }

    #[test]
    fn test_parse_too_short_returns_none() {
        // Note On needs 3 bytes
        assert_eq!(parse_midi_bytes(&[0x90]), None);
        assert_eq!(parse_midi_bytes(&[0x90, 69]), None);
        // Control Change needs 3 bytes
        assert_eq!(parse_midi_bytes(&[0xB0]), None);
        // Program Change needs 2 bytes
        assert_eq!(parse_midi_bytes(&[0xC0]), None);
    }

    #[test]
    fn test_parse_unknown_status_returns_none() {
        assert_eq!(parse_midi_bytes(&[0xF1]), None); // MTC Quarter Frame (unsupported)
        assert_eq!(parse_midi_bytes(&[0xF7]), None); // End of SysEx
    }

    #[test]
    fn test_parse_channel_extraction() {
        // Note On, channel 15
        let data = [0x9F, 69, 100];
        let msg = parse_midi_bytes(&data).unwrap();
        match msg {
            MidiMessage::NoteOn { channel, .. } => assert_eq!(channel.value(), 15),
            _ => panic!("Expected NoteOn"),
        }
    }
}
