import { test, expect } from "@playwright/test";

const DEFAULTS = {
  midi_port: "",
  available_midi_ports: [],
  active_notes: [],
  last_note_event: {},
  session_id: "",
  channel_index: -1,
  sampler_routing: [],
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

      send(data) {
        const event = new Event("midimessage");
        event.data = new Uint8Array(data);
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
      sampler_routing: [{ channel_index: 0, zone: "all" }],
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
