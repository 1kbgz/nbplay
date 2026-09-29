import { test, expect } from "@playwright/test";

const DEFAULTS = {
  max_voices: 4,
  session_id: "",
  channel_index: -1,
  root_note: 60,
  sample_name: "Click",
  sample_rate: 44100,
  sample_length: 0,
  attack: 0.01,
  decay: 0.1,
  sustain: 0.7,
  release: 0.3,
  waveform: null,
  sample_data: null,
  pad_count: 4,
  pad_notes: [36, 38, 42, 46],
  pad_velocities: [100, 100, 100, 100],
  pad_actions: [],
  sample_slices: [],
  zones: [],
  capture_request: {},
  velocity: 100,
  velocity_sensitive: false,
  active_pads: [],
  last_note_event: {},
  last_pad_event: {},
};

/** Render the sampler; `zones` entries carry a `length` that becomes PCM in the page. */
async function renderWidget(page, overrides = {}, zones = []) {
  await page.evaluate(
    async ({ opts, zones }) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/sampler.css";
      document.head.appendChild(link);
      const mod = await import("/dist/widgets/sampler.js");
      const el = document.getElementById("root");
      opts.zones = zones.map((zone, index) => ({
        id: `z${index}`,
        name: `Zone ${index + 1}`,
        velocity_low: 0,
        velocity_high: 127,
        sample_rate: 44100,
        ...zone,
        data: new DataView(new Float32Array(zone.length).fill(0.5).buffer),
      }));
      const model = window.createMockModel(opts);
      window.__testModel = model;
      mod.default.render({ model, el });
    },
    { opts: { ...DEFAULTS, ...overrides }, zones },
  );
}

async function recordBufferSources(page) {
  await page.evaluate(() => {
    window.__sources = [];
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const node = original.call(this);
      window.__sources.push(node);
      return node;
    };
  });
}

function zonesState(page) {
  return page.evaluate(() =>
    window.__testModel._state.zones.map((z) => ({
      name: z.name,
      note_low: z.note_low,
      note_high: z.note_high,
      root_note: z.root_note,
      length: z.length,
      bytes: z.data.byteLength,
    })),
  );
}

async function installRecorderMock(page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => {} }],
        }),
      },
    });
    window.MediaRecorder = class MockMediaRecorder extends EventTarget {
      constructor(stream) {
        super();
        this.stream = stream;
        this.state = "inactive";
        this.mimeType = "audio/webm";
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        const event = new Event("dataavailable");
        Object.defineProperty(event, "data", {
          value: new Blob(["recorded"], { type: this.mimeType }),
        });
        this.dispatchEvent(event);
        this.dispatchEvent(new Event("stop"));
      }
    };
  });
}

test.describe("Sampler zones", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  test("renders zone rows and the key map", async ({ page }) => {
    await renderWidget(page, {}, [
      { note_low: 36, note_high: 36, root_note: 36, length: 100 },
      { note_low: 48, note_high: 72, root_note: 60, length: 200 },
    ]);
    await expect(page.locator(".nbplay-samp-zone-row")).toHaveCount(2);
    await expect(page.locator(".nbplay-samp-zone-span")).toHaveCount(2);
    await expect(page.locator(".nbplay-samp-zone-map")).not.toHaveClass(
      /empty/,
    );
    const second = page.locator(".nbplay-samp-zone-row").nth(1);
    await expect(second.locator(".nbplay-samp-zone-low")).toHaveValue("48");
    await expect(second.locator(".nbplay-samp-zone-high")).toHaveValue("72");
    await expect(second.locator(".nbplay-samp-zone-root")).toHaveValue("60");
    await expect(
      page.locator(".nbplay-samp-zone-pad option").nth(1),
    ).toHaveText("Pad 1 (C2)");
  });

  test("a note inside a zone plays that zone's sample one-shot", async ({
    page,
  }) => {
    await recordBufferSources(page);
    await renderWidget(page, { sample_length: 3 }, [
      { note_low: 38, note_high: 38, root_note: 38, length: 100 },
      { note_low: 40, note_high: 50, root_note: 45, length: 200 },
    ]);
    await page.evaluate(() => {
      const samples = new Float32Array([0, 0.5, 0]);
      window.__testModel.set("sample_data", new DataView(samples.buffer));
      window.__testModel._trigger("change:sample_data");
    });
    const pads = page.locator(".nbplay-samp-pad");
    await pads.nth(1).click({ position: { x: 4, y: 4 } }); // 38 → zone 1
    await pads.nth(2).click({ position: { x: 4, y: 4 } }); // 42 → zone 2
    await pads.nth(0).click({ position: { x: 4, y: 4 } }); // 36 → main sample

    const played = await page.evaluate(() =>
      window.__sources.map((s) => ({
        length: s.buffer.length,
        rate: s.playbackRate.value,
        loop: s.loop,
      })),
    );
    expect(played.map(({ length, loop }) => ({ length, loop }))).toEqual([
      { length: 100, loop: false },
      { length: 200, loop: false },
      { length: 3, loop: true },
    ]);
    expect(played[0].rate).toBeCloseTo(1, 10);
    expect(played[1].rate).toBeCloseTo(Math.pow(2, (42 - 45) / 12), 10);
    expect(played[2].rate).toBeCloseTo(Math.pow(2, (36 - 60) / 12), 10);
  });

  test("zones play without a main sample and through the session bus", async ({
    page,
  }) => {
    await recordBufferSources(page);
    await page.evaluate(() => {
      const ctx = new AudioContext();
      globalThis.__nbplay = {
        "zone-session": {
          audioCtx: ctx,
          channels: [{ gain: ctx.createGain() }],
        },
      };
    });
    await renderWidget(page, { session_id: "zone-session", channel_index: 0 }, [
      { note_low: 0, note_high: 127, root_note: 60, length: 50 },
    ]);
    await page.evaluate(() => {
      globalThis.__nbplay["zone-session"].samplers[0].triggerNote(67, 90);
    });
    const played = await page.evaluate(() =>
      window.__sources.map((s) => s.buffer.length),
    );
    expect(played).toEqual([50]);
  });

  test("editing a zone row writes the model and keeps low <= high", async ({
    page,
  }) => {
    await renderWidget(page, {}, [
      { note_low: 48, note_high: 60, root_note: 55, length: 10 },
    ]);
    const row = page.locator(".nbplay-samp-zone-row").first();
    await row.locator(".nbplay-samp-zone-low").fill("70");
    await row.locator(".nbplay-samp-zone-low").press("Enter");
    await row.locator(".nbplay-samp-zone-low").blur();
    expect(await zonesState(page)).toEqual([
      {
        name: "Zone 1",
        note_low: 70,
        note_high: 70,
        root_note: 55,
        length: 10,
        bytes: 40,
      },
    ]);
    await row.locator(".nbplay-samp-zone-name").fill("Snare");
    await row.locator(".nbplay-samp-zone-name").blur();
    expect((await zonesState(page))[0].name).toBe("Snare");
    await row.locator(".nbplay-samp-zone-remove").click();
    expect(await zonesState(page)).toEqual([]);
    await expect(page.locator(".nbplay-samp-zone-map")).toHaveClass(/empty/);
  });

  test("a file adds a zone on the selected pad", async ({ page }) => {
    await renderWidget(page);
    await page.locator(".nbplay-samp-zone-pad").selectOption({ value: "2" });
    await page.locator(".nbplay-samp-zone-file").setInputFiles({
      name: "hat.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from([0, 1, 2, 3]),
    });
    await expect(page.locator(".nbplay-samp-zone-status")).toHaveText(
      "Added hat.wav",
    );
    expect(await zonesState(page)).toEqual([
      {
        name: "hat.wav",
        note_low: 42,
        note_high: 42,
        root_note: 42,
        length: 1024,
        bytes: 4096,
      },
    ]);
  });

  test("recording the microphone captures a take onto a pad", async ({
    page,
  }) => {
    await installRecorderMock(page);
    await renderWidget(page);
    await page.locator(".nbplay-samp-zone-pad").selectOption({ value: "0" });
    await page.locator(".nbplay-samp-zone-rec").click();
    await expect(page.locator(".nbplay-samp-zone-rec")).toHaveText("Stop");
    await page.locator(".nbplay-samp-zone-rec").click();
    await expect(page.locator(".nbplay-samp-zone-status")).toHaveText(
      "Captured Take 1",
    );
    await expect(page.locator(".nbplay-samp-zone-rec")).toHaveText("Rec");
    expect(await zonesState(page)).toEqual([
      {
        name: "Take 1",
        note_low: 36,
        note_high: 36,
        root_note: 36,
        length: 1024,
        bytes: 4096,
      },
    ]);
  });

  test("reports when microphone recording is unavailable", async ({ page }) => {
    await page.evaluate(() => {
      window.MediaRecorder = undefined;
    });
    await renderWidget(page);
    await page.locator(".nbplay-samp-zone-rec").click();
    await expect(page.locator(".nbplay-samp-zone-status")).toHaveText(
      "Microphone recording is unavailable",
    );
  });

  test("capture_request decodes a clip URL into a trimmed zone", async ({
    page,
  }) => {
    await renderWidget(page);
    await page.evaluate(() => {
      const url = URL.createObjectURL(
        new Blob(["take"], { type: "audio/webm" }),
      );
      window.__testModel.set("capture_request", {
        url,
        name: "Vox",
        note_low: 60,
        note_high: 60,
        root_note: 60,
        offset: 0.01,
        duration: 0.005,
        nonce: 1,
      });
      window.__testModel._trigger("change:capture_request");
    });
    await expect(page.locator(".nbplay-samp-zone-status")).toHaveText(
      "Captured Vox",
    );
    expect(await zonesState(page)).toEqual([
      {
        name: "Vox",
        note_low: 60,
        note_high: 60,
        root_note: 60,
        length: 221,
        bytes: 884,
      },
    ]);
  });

  test("capture_request reports a failed fetch", async ({ page }) => {
    await renderWidget(page);
    await page.evaluate(() => {
      window.__testModel.set("capture_request", {
        url: "blob:nowhere",
        name: "Gone",
        nonce: 1,
      });
      window.__testModel._trigger("change:capture_request");
    });
    await expect(page.locator(".nbplay-samp-zone-status")).toContainText(
      "Capture failed",
    );
    expect(await zonesState(page)).toEqual([]);
  });
});
