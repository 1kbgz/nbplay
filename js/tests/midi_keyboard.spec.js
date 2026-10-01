import { test, expect } from "@playwright/test";

const DEFAULTS = {
  midi_port: "",
  available_midi_ports: [],
  active_notes: [],
  last_note_event: {},
  session_id: "",
  channel_index: -1,
  sampler_routing: [],
  sync_clock: false,
  clock_bpm: 0,
};

async function installMidiMock(page) {
  await page.addInitScript(() => {
    class MockMidiInput extends EventTarget {
      constructor() {
        super();
        this.id = "input-1";
        this.name = "USB Keys";
        this.state = "connected";
      }

      send(data, timeStamp) {
        const event = new Event("midimessage");
        event.data = new Uint8Array(data);
        if (timeStamp !== undefined) {
          Object.defineProperty(event, "timeStamp", { value: timeStamp });
        }
        this.dispatchEvent(event);
      }
    }

    const input = new MockMidiInput();
    window.__midiInput = input;
    navigator.requestMIDIAccess = async () => ({
      inputs: new Map([[input.id, input]]),
    });
  });
}

async function renderWidget(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/midi_keyboard.css";
      document.head.appendChild(link);

      const mod = await import("/dist/widgets/midi_keyboard.js");
      const el = document.getElementById("root");
      const model = window.createMockModel({ ...opts });
      window.__testModel = model;
      mod.default.render({ model, el });
    },
    { ...DEFAULTS, ...overrides },
  );
}

test.describe("MidiKeyboardWidget", () => {
  test.beforeEach(async ({ page }) => {
    await installMidiMock(page);
    await page.goto("/tests/fixtures/harness.html");
  });

  test("renders MIDI keyboard controls and discovers ports", async ({
    page,
  }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-midi-keyboard")).toBeVisible();
    await expect(
      page.locator(".nbplay-midi-kb-select option").nth(1),
    ).toHaveText("USB Keys");
  });

  test("renders idle state when Web MIDI is unavailable", async ({ page }) => {
    await page.evaluate(() => {
      navigator.requestMIDIAccess = undefined;
    });
    await renderWidget(page);

    await expect(page.locator(".nbplay-midi-keyboard")).toBeVisible();
    await expect(page.locator(".nbplay-midi-kb-status")).toHaveText("Idle");
    await expect(page.locator(".nbplay-midi-kb-select option")).toHaveCount(1);
  });

  test("MIDI note state updates without Web Audio", async ({ page }) => {
    await page.evaluate(() => {
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
    });
    await renderWidget(page);
    await page.locator(".nbplay-midi-kb-select").selectOption("input-1");

    await page.evaluate(() => {
      window.__midiInput.send([0x90, 60, 96]);
    });

    const state = await page.evaluate(() => ({
      activeNotes: window.__testModel._state.active_notes,
      lastEvent: window.__testModel._state.last_note_event,
    }));
    expect(state.activeNotes).toEqual([60]);
    expect(state.lastEvent).toEqual({ note: 60, velocity: 96, type: "on" });
  });

  test("control changes sync to the control_change trait", async ({ page }) => {
    await renderWidget(page);
    await page.locator(".nbplay-midi-kb-select").selectOption("input-1");
    await page.evaluate(() => {
      window.__midiInput.send([0xb3, 7, 100]);
      window.__midiInput.send([0xb3, 7, 100]);
    });
    const cc = await page.evaluate(
      () => window.__testModel._state.control_change,
    );
    expect(cc).toEqual({ controller: 7, value: 100, channel: 3, seq: 2 });
    await expect(page.locator(".nbplay-midi-kb-last")).toHaveText("CC 7  100");
  });

  test("follows the device's MIDI clock when sync_clock is on", async ({
    page,
  }) => {
    await page.evaluate(() => {
      globalThis.__nbplay = { "clk-session": { audioCtx: new AudioContext() } };
    });
    await renderWidget(page, { session_id: "clk-session", sync_clock: true });
    await page.locator(".nbplay-midi-kb-select").selectOption("input-1");
    await expect(page.locator(".nbplay-midi-kb-clock-input")).toBeChecked();

    const state = await page.evaluate(() => {
      const input = window.__midiInput;
      const clock = globalThis.__nbplay["clk-session"].clock;
      input.send([0xfa], 1000);
      const playing = clock.playing;
      // 25 ms per tick → 600 ms per beat → 100 BPM.
      for (let i = 0; i <= 48; i++) input.send([0xf8], 1000 + i * 25);
      const bpm = clock.bpm;
      input.send([0xfc], 3000);
      const stopped = clock.playing;
      input.send([0xf2, 32, 0], 3100);
      const beat = clock.beat();
      input.send([0xfb], 3200);
      return {
        playing,
        bpm,
        stopped,
        beat,
        resumed: clock.playing,
        modelBpm: window.__testModel._state.clock_bpm,
      };
    });
    expect(state.playing).toBe(true);
    expect(state.bpm).toBeCloseTo(100, 1);
    expect(state.modelBpm).toBeCloseTo(100, 1);
    expect(state.stopped).toBe(false);
    expect(state.beat).toBeCloseTo(8, 5);
    expect(state.resumed).toBe(true);
    await expect(page.locator(".nbplay-midi-kb-clock")).toHaveText("100.0 BPM");

    // Realtime messages are ignored once the checkbox is off.
    await page.locator(".nbplay-midi-kb-clock-input").uncheck();
    const ignored = await page.evaluate(() => {
      const clock = globalThis.__nbplay["clk-session"].clock;
      clock.stop();
      window.__midiInput.send([0xfa], 5000);
      return {
        syncClock: window.__testModel._state.sync_clock,
        playing: clock.playing,
      };
    });
    expect(ignored).toEqual({ syncClock: false, playing: false });
  });

  test("selecting a MIDI port stores the port name", async ({ page }) => {
    await renderWidget(page);
    await page.locator(".nbplay-midi-kb-select").selectOption("input-1");

    const midiPort = await page.evaluate(
      () => window.__testModel._state.midi_port,
    );
    expect(midiPort).toBe("USB Keys");
    await expect(page.locator(".nbplay-midi-kb-status")).toHaveText(
      "Connected",
    );
  });

  test("MIDI note-on includes velocity and dispatches nbplay-note", async ({
    page,
  }) => {
    await renderWidget(page);
    await page.locator(".nbplay-midi-kb-select").selectOption("input-1");

    const received = await page.evaluate(async () => {
      return new Promise((resolve) => {
        document.addEventListener(
          "nbplay-note",
          (event) => resolve(event.detail),
          {
            once: true,
          },
        );
        window.__midiInput.send([0x90, 60, 96]);
      });
    });

    expect(received).toEqual({ note: 60, velocity: 96, type: "on" });
    const state = await page.evaluate(() => ({
      activeNotes: window.__testModel._state.active_notes,
      lastEvent: window.__testModel._state.last_note_event,
    }));
    expect(state.activeNotes).toEqual([60]);
    expect(state.lastEvent).toEqual({ note: 60, velocity: 96, type: "on" });
    await expect(page.locator(".nbplay-midi-kb-last")).toHaveText("C4  vel 96");
  });

  test("MIDI note-on with velocity zero releases the note", async ({
    page,
  }) => {
    await renderWidget(page);
    await page.locator(".nbplay-midi-kb-select").selectOption("input-1");

    await page.evaluate(() => {
      window.__midiInput.send([0x90, 60, 96]);
      window.__midiInput.send([0x90, 60, 0]);
    });

    const state = await page.evaluate(() => ({
      activeNotes: window.__testModel._state.active_notes,
      lastEvent: window.__testModel._state.last_note_event,
    }));
    expect(state.activeNotes).toEqual([]);
    expect(state.lastEvent).toEqual({ note: 60, velocity: 0, type: "off" });
  });

  test("MIDI notes route to connected samplers with velocity", async ({
    page,
  }) => {
    await page.evaluate(() => {
      globalThis.__triggered = [];
      globalThis.__released = [];
      globalThis.__nbplay = {
        "test-session": {
          audioCtx: new AudioContext(),
          channels: [],
          samplers: {
            0: {
              triggerNote(note, velocity) {
                globalThis.__triggered.push({ note, velocity });
              },
              releaseNote(note) {
                globalThis.__released.push(note);
              },
            },
          },
        },
      };
    });

    await renderWidget(page, {
      session_id: "test-session",
      sampler_routing: [{ channel_index: 0, match: "all" }],
    });
    await page.locator(".nbplay-midi-kb-select").selectOption("input-1");

    await page.evaluate(() => {
      window.__midiInput.send([0x90, 64, 110]);
      window.__midiInput.send([0x80, 64, 12]);
    });

    const routed = await page.evaluate(() => ({
      triggered: globalThis.__triggered,
      released: globalThis.__released,
    }));
    expect(routed.triggered).toEqual([{ note: 64, velocity: 110 }]);
    expect(routed.released).toEqual([64]);
  });
});
