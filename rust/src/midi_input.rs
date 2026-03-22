use crate::midi::{parse_midi_bytes, MidiEvent};

/// Wraps midir to enumerate and connect to MIDI input ports.
pub struct MidiInput {
    inner: Option<midir::MidiInput>,
    // Hold the connection to keep it alive
    _connection: Option<midir::MidiInputConnection<()>>,
}

impl MidiInput {
    /// Create a new MidiInput instance.
    pub fn new(client_name: &str) -> Result<Self, String> {
        let inner = midir::MidiInput::new(client_name)
            .map_err(|e| format!("Failed to create MIDI input: {e}"))?;
        Ok(MidiInput {
            inner: Some(inner),
            _connection: None,
        })
    }

    /// List available MIDI input port names.
    pub fn list_ports(&self) -> Vec<String> {
        match &self.inner {
            Some(inner) => {
                let ports = inner.ports();
                ports
                    .iter()
                    .filter_map(|p| inner.port_name(p).ok())
                    .collect()
            }
            None => Vec::new(),
        }
    }

    /// Connect to a MIDI input port by index.
    /// The callback will receive parsed MidiEvents.
    pub fn connect<F>(
        &mut self,
        port_index: usize,
        port_name: &str,
        mut callback: F,
    ) -> Result<(), String>
    where
        F: FnMut(MidiEvent) + Send + 'static,
    {
        let inner = self
            .inner
            .take()
            .ok_or_else(|| "MIDI input already connected".to_string())?;
        let ports = inner.ports();
        let port = ports.get(port_index).ok_or_else(|| {
            format!(
                "Port index {port_index} out of range (available: {})",
                ports.len()
            )
        })?;

        let connection = inner
            .connect(
                port,
                port_name,
                move |timestamp_us, data, _| {
                    if let Some(message) = parse_midi_bytes(data) {
                        let event = MidiEvent::new(message, timestamp_us);
                        callback(event);
                    }
                },
                (),
            )
            .map_err(|e| format!("Failed to connect to MIDI port: {e}"))?;

        self._connection = Some(connection);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_midi_input_creation() {
        // Should not panic, even if no MIDI hardware is available
        let result = MidiInput::new("nbplay-test");
        // On most systems this will succeed; on some CI it might fail
        match result {
            Ok(input) => {
                let ports = input.list_ports();
                // Just verify it returns a Vec<String>; may be empty
                let _ = ports;
            }
            Err(e) => {
                // Acceptable in CI without MIDI support
                eprintln!("MIDI input not available (expected in CI): {e}");
            }
        }
    }

    #[test]
    fn test_midi_input_connect_invalid_port() {
        let result = MidiInput::new("nbplay-test");
        if let Ok(mut input) = result {
            // Connecting to an out-of-range port should produce an error
            let res = input.connect(9999, "test-port", |_event| {});
            assert!(res.is_err());
        }
    }

    #[test]
    fn test_list_ports_returns_vec() {
        if let Ok(input) = MidiInput::new("nbplay-test") {
            let ports = input.list_ports();
            // Verify type; may be empty
            assert!(ports.len() < 10000); // sanity check
        }
    }
}
