import { test, expect } from "@playwright/test";

const DEFAULTS = {
  routes: [],
  session_tracks: [
    { channel_index: 0, name: "Bass" },
    { channel_index: 1, name: "Beat" },
  ],
  session_id: "midi",
  available_midi_ports: [],
  last_event: {},
  control_change: {},
};

/** Web MIDI with two input ports; `window.__midiAccess.plug(name)` adds one later. */
async function installMidiMock(page) {
  await page.addInitScript(() => {
    class MockInput extends EventTarget {
      constructor(id, name) {
        super();
        this.id = id;
        this.name = name;
        this.state = "connected";
      }

      send(data) {
        const event = new Event("midimessage");
        event.data = new Uint8Array(data);
        this.dispatchEvent(event);
      }
    }

    class MockAccess extends EventTarget {
      constructor() {
        super();
        this.inputs = new Map();
        this.outputs = new Map();
      }

      plug(name) {
        const input = new MockInput(`id-${this.inputs.size}`, name);
        this.inputs.set(input.id, input);
        this.dispatchEvent(new Event("statechange"));
        return input;
      }
    }

    const access = new MockAccess();
    access.plug("Keys");
    access.plug("Launchpad X LPX MIDI");
    window.__midiAccess = access;
    window.__send = (name, data) =>
      [...access.inputs.values()].find((i) => i.name === name).send(data);
    navigator.requestMIDIAccess = async () => access;
  });
}

/** A session bus whose two instruments record held notes and their releases. */
async function installBus(page) {
  await page.evaluate(() => {
    window.__played = [];
    window.__heard = [];
    const instrument = (channel) => ({
      scheduleNote: () => {},
      startNote: (note, velocity) => {
        window.__played.push(["on", channel, note, velocity]);
        return () => window.__played.push(["off", channel, note]);
      },
    });
    globalThis.__nbplay = {
      midi: {
        instruments: { 0: instrument(0), 1: instrument(1) },
        noteListeners: [(evt) => window.__heard.push([evt.type, evt.note])],
      },
    };
  });
}

async function renderRouter(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/components.css";
      document.head.appendChild(link);
      const mod = await import("/dist/tests/instruments.js");
      const model = window.createMockModel({ ...opts });
      window.__testModel = model;
      mod.render("midi_router", { model, el: document.getElementById("root") });
    },
    { ...DEFAULTS, ...overrides },
  );
}

const state = (page) => page.evaluate(() => window.__testModel._state);

const route = (fields) => ({
  port: "",
  midi_channel: -1,
  note_low: 0,
  note_high: 127,
  channel_index: 0,
  ...fields,
});

test.describe("MidiRouterWidget", () => {
  test.beforeEach(async ({ page }) => {
    await installMidiMock(page);
    await page.goto("/tests/fixtures/harness.html");
    await installBus(page);
  });

  test("lists the inputs, including one plugged in later", async ({ page }) => {
    await renderRouter(page);
    await expect(page.locator(".nbplay-midi-router-port-name")).toHaveText([
      "Keys",
      "Launchpad X LPX MIDI",
    ]);
    expect((await state(page)).available_midi_ports).toEqual([
      "Keys",
      "Launchpad X LPX MIDI",
    ]);
    await page.evaluate(() => window.__midiAccess.plug("Drum Pads"));
    await expect(page.locator(".nbplay-midi-router-port-name")).toHaveCount(3);
    // The new port is listened to as well.
    await page.evaluate(() => window.__send("Drum Pads", [0x90, 60, 100]));
    expect((await state(page)).last_event).toMatchObject({
      port: "Drum Pads",
      type: "on",
      note: 60,
    });
  });

  test("holds a note on every route it matches until its note-off", async ({
    page,
  }) => {
    await renderRouter(page, {
      routes: [
        route({ note_high: 59, channel_index: 0 }),
        route({
          port: "Launchpad X LPX MIDI",
          midi_channel: 0,
          channel_index: 1,
        }),
      ],
    });
    const played = await page.evaluate(() => {
      // Keys, below the split: the bass only.
      window.__send("Keys", [0x90, 40, 100]);
      window.__send("Keys", [0x80, 40, 0]);
      // Launchpad on channel 1 below the split: both routes.
      window.__send("Launchpad X LPX MIDI", [0x90, 50, 90]);
      // A note-on with velocity 0 is a note-off.
      window.__send("Launchpad X LPX MIDI", [0x90, 50, 0]);
      // Launchpad on channel 2 above the split: no route.
      window.__send("Launchpad X LPX MIDI", [0x91, 70, 90]);
      return window.__played;
    });
    expect(played).toEqual([
      ["on", 0, 40, 100],
      ["off", 0, 40],
      ["on", 0, 50, 90],
      ["on", 1, 50, 90],
      ["off", 0, 50],
      ["off", 1, 50],
    ]);
    // Every note reaches the session's note listeners, routed or not.
    expect(await page.evaluate(() => window.__heard)).toEqual([
      ["on", 40],
      ["off", 40],
      ["on", 50],
      ["off", 50],
      ["on", 70],
    ]);
    await expect(page.locator(".nbplay-midi-router-monitor")).toHaveText(
      /Launchpad X LPX MIDI ch 2\s+A#4\s+vel 90/,
    );
  });

  test("a note held while its route changes is released where it started", async ({
    page,
  }) => {
    await renderRouter(page, { routes: [route({ channel_index: 0 })] });
    await page.evaluate(() => window.__send("Keys", [0x90, 40, 100]));
    await page.locator(".nbplay-midi-router-track").selectOption("Beat");
    const played = await page.evaluate(() => {
      window.__send("Keys", [0x80, 40, 0]);
      return window.__played;
    });
    expect(played).toEqual([
      ["on", 0, 40, 100],
      ["off", 0, 40],
    ]);
  });

  test("control changes reach the status for MIDI learn", async ({ page }) => {
    await renderRouter(page);
    await page.evaluate(() => {
      window.__send("Keys", [0xb2, 74, 64]);
      window.__send("Keys", [0xb2, 74, 65]);
    });
    expect((await state(page)).control_change).toEqual({
      controller: 74,
      value: 65,
      channel: 2,
      port: "Keys",
      seq: 2,
    });
    await expect(page.locator(".nbplay-midi-router-monitor")).toHaveText(
      /Keys ch 3\s+CC 74\s+65/,
    );
  });

  test("the route editor writes the routes", async ({ page }) => {
    await renderRouter(page);
    await page.locator(".nbplay-midi-router-add").click();
    // A new route takes any port, any channel and every note to the first track.
    expect((await state(page)).routes).toEqual([route({ channel_index: 0 })]);
    await page
      .locator(".nbplay-midi-router-port")
      .selectOption("Launchpad X LPX MIDI");
    await page.locator(".nbplay-midi-router-channel").selectOption("Ch 10");
    await page.locator(".nbplay-midi-router-track").selectOption("Beat");
    await page.locator(".nbplay-midi-router-note-low").fill("72");
    await page.locator(".nbplay-midi-router-note-low").press("Enter");
    await page.locator(".nbplay-midi-router-note-high").fill("36");
    await page.locator(".nbplay-midi-router-note-high").press("Enter");
    // A range entered high to low is kept low to high.
    expect((await state(page)).routes).toEqual([
      route({
        port: "Launchpad X LPX MIDI",
        midi_channel: 9,
        note_low: 36,
        note_high: 72,
        channel_index: 1,
      }),
    ]);
    await page.locator(".nbplay-midi-router-remove").click();
    expect((await state(page)).routes).toEqual([]);
  });

  test("a saved route keeps its port while the device is unplugged", async ({
    page,
  }) => {
    await renderRouter(page, { routes: [route({ port: "Old Synth" })] });
    await expect(page.locator(".nbplay-midi-router-port")).toHaveValue(
      "Old Synth",
    );
  });
});
