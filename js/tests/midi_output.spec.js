import { test, expect } from "@playwright/test";

const DEFAULTS = {
  session_id: "",
  midi_port: "",
  available_midi_ports: [],
  channel: 0,
  forward_notes: true,
  send_request: {},
};

async function installMidiMock(page) {
  await page.addInitScript(() => {
    const output = {
      id: "output-1",
      name: "USB Synth",
      state: "connected",
      sent: [],
      send(data, timestamp) {
        this.sent.push({ data: Array.from(data), timestamp });
      },
    };
    window.__midiOutput = output;
    navigator.requestMIDIAccess = async () => ({
      inputs: new Map(),
      outputs: new Map([[output.id, output]]),
    });
  });
}

async function renderWidget(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/midi_output.css";
      document.head.appendChild(link);
      const mod = await import("/dist/widgets/midi_output.js");
      const el = document.getElementById("root");
      const model = window.createMockModel({ ...opts });
      window.__testModel = model;
      mod.default.render({ model, el });
    },
    { ...DEFAULTS, ...overrides },
  );
}

async function connect(page) {
  await page.locator(".nbplay-midi-out-select").selectOption("output-1");
  // Selecting a port sends all-notes-off on the previous state; ignore it.
  await page.evaluate(() => {
    window.__midiOutput.sent.length = 0;
  });
}

function sentData(page) {
  return page.evaluate(() => window.__midiOutput.sent.map((m) => m.data));
}

test.describe("MidiOutputWidget", () => {
  test.beforeEach(async ({ page }) => {
    await installMidiMock(page);
    await page.goto("/tests/fixtures/harness.html");
  });

  test("discovers output ports and stores the selected name", async ({
    page,
  }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-midi-output")).toBeVisible();
    await expect(
      page.locator(".nbplay-midi-out-select option").nth(1),
    ).toHaveText("USB Synth");
    expect(
      await page.evaluate(() => window.__testModel._state.available_midi_ports),
    ).toEqual(["USB Synth"]);
    await connect(page);
    expect(await page.evaluate(() => window.__testModel._state.midi_port)).toBe(
      "USB Synth",
    );
    await expect(page.locator(".nbplay-midi-out-status")).toHaveText(
      "Connected",
    );
  });

  test("stays idle without Web MIDI", async ({ page }) => {
    await page.evaluate(() => {
      navigator.requestMIDIAccess = undefined;
    });
    await renderWidget(page);
    await expect(page.locator(".nbplay-midi-out-status")).toHaveText("Idle");
    await expect(page.locator(".nbplay-midi-out-select option")).toHaveCount(1);
  });

  test("forwards document note events without a session", async ({ page }) => {
    await renderWidget(page, { channel: 2 });
    await connect(page);
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent("nbplay-note", {
          detail: { note: 60, velocity: 96, type: "on" },
        }),
      );
      document.dispatchEvent(
        new CustomEvent("nbplay-note", {
          detail: { note: 60, velocity: 0, type: "off" },
        }),
      );
    });
    expect(await sentData(page)).toEqual([
      [0x92, 60, 96],
      [0x82, 60, 0],
    ]);
    await expect(page.locator(".nbplay-midi-out-count")).toHaveText("2 sent");
  });

  test("forwards scheduled session bus notes with timestamps", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const ctx = new AudioContext();
      globalThis.__nbplay = { "out-session": { audioCtx: ctx } };
    });
    await renderWidget(page, { session_id: "out-session" });
    await connect(page);
    const result = await page.evaluate(() => {
      const bus = globalThis.__nbplay["out-session"];
      const ctx = bus.audioCtx;
      const before = performance.now();
      bus.noteListeners.forEach((fn) =>
        fn({
          note: 64,
          velocity: 100,
          type: "on",
          at: ctx.currentTime + 0.5,
          duration: 0.25,
        }),
      );
      // A note from the document must not be forwarded twice.
      document.dispatchEvent(
        new CustomEvent("nbplay-note", {
          detail: { note: 65, velocity: 100, type: "on" },
        }),
      );
      return { before, sent: window.__midiOutput.sent };
    });
    expect(result.sent.map((m) => m.data)).toEqual([
      [0x90, 64, 100],
      [0x80, 64, 0],
    ]);
    const [on, off] = result.sent;
    expect(on.timestamp).toBeGreaterThanOrEqual(result.before + 400);
    expect(off.timestamp - on.timestamp).toBeCloseTo(250, 0);
  });

  test("forward_notes off keeps session notes local", async ({ page }) => {
    await renderWidget(page, { forward_notes: false });
    await connect(page);
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent("nbplay-note", {
          detail: { note: 60, velocity: 96, type: "on" },
        }),
      );
    });
    expect(await sentData(page)).toEqual([]);
    await page.locator(".nbplay-midi-out-forward-input").check();
    expect(
      await page.evaluate(() => window.__testModel._state.forward_notes),
    ).toBe(true);
  });

  test("sends Python requests on the selected channel", async ({ page }) => {
    await renderWidget(page);
    await connect(page);
    await page.locator(".nbplay-midi-out-channel").selectOption({ value: "9" });
    await page.evaluate(() => {
      window.__midiOutput.sent.length = 0;
      const model = window.__testModel;
      const requests = [
        { kind: "note_on", note: 36, velocity: 120, nonce: 1 },
        { kind: "note_off", note: 36, nonce: 2 },
        { kind: "control_change", controller: 7, value: 100, nonce: 3 },
        { kind: "raw", data: [0xc9, 5], nonce: 4 },
      ];
      for (const req of requests) {
        model.set("send_request", req);
        model._trigger("change:send_request");
      }
    });
    expect(await page.evaluate(() => window.__testModel._state.channel)).toBe(
      9,
    );
    expect(await sentData(page)).toEqual([
      [0x99, 36, 120],
      [0x89, 36, 0],
      [0xb9, 7, 100],
      [0xc9, 5],
    ]);
  });
});
