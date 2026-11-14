import { test, expect } from "@playwright/test";

const DEFAULTS = {
  session_id: "",
  channel_index: -1,
  fft_size: 2048,
  smoothing: 0.8,
  min_db: -100,
  max_db: -20,
  min_frequency: 20,
  max_frequency: 20000,
};

const MIXER = {
  session_id: "spectrum-session",
  master_gain: 1,
  master_effects: [],
  returns: [],
  channels: [
    { name: "Lead", gain: 1, pan: 0, mute: false, solo: false, effects: [] },
  ],
};

/** Mount an instrument in its own container; the model lands on window[key]. */
async function render(page, name, key, state) {
  await page.evaluate(
    async ({ name, key, state }) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/components.css";
      document.head.appendChild(link);
      const mod = await import("/dist/tests/instruments.js");
      const el = document.createElement("div");
      document.getElementById("root").appendChild(el);
      const model = window.createMockModel({ ...state });
      window[key] = model;
      mod.render(name, { model, el });
    },
    { name, key, state },
  );
}

const renderSpectrum = (page, overrides = {}) =>
  render(page, "spectrum", "__testModel", { ...DEFAULTS, ...overrides });

const peak = (page) => page.locator(".nbplay-spectrum-peak");

test.describe("SpectrumWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  test("renders an empty grid outside a session", async ({ page }) => {
    await renderSpectrum(page);
    await expect(
      page.locator("nbplay-spectrum .nbplay-header-badge"),
    ).toHaveText("spectrum");
    await expect(page.locator(".nbplay-spectrum-canvas")).toBeVisible();
    await expect(page.locator(".nbplay-spectrum-source")).toHaveText("Master");
    await expect(peak(page)).toHaveText("—");
    await expect(page.locator(".nbplay-spectrum-fft select")).toHaveValue(
      "2048",
    );
  });

  test("listens on the mixer's master tap and reads out the loudest frequency", async ({
    page,
  }) => {
    await render(page, "mixer", "__mixerModel", MIXER);
    await page.evaluate(() => {
      window.__mockSpectrumHz = 2000;
    });
    await renderSpectrum(page, { session_id: "spectrum-session" });
    // 1024 bins of 21.5 Hz: the loud bin sits at 2003 Hz, at -12 dB.
    await expect(peak(page)).toHaveText("2.00 kHz  -12.0 dB");
    const tapped = await page.evaluate(() => {
      const bus = window.__nbplay["spectrum-session"];
      const listener = bus.masterAnalyser.connections.at(-1);
      return {
        fftSize: listener.fftSize,
        smoothing: listener.smoothingTimeConstant,
        channelListeners: bus.channels[0].analyser.connections.length,
      };
    });
    expect(tapped).toEqual({
      fftSize: 2048,
      smoothing: 0.8,
      channelListeners: 0,
    });

    // The kernel changes the FFT size and the channel: the tap follows.
    await page.evaluate(() => {
      window.__testModel.set("fft_size", 512);
      window.__testModel._trigger("change:fft_size");
      window.__testModel.set("channel_index", 0);
      window.__testModel._trigger("change:channel_index");
    });
    await expect(page.locator(".nbplay-spectrum-source")).toHaveText(
      "Channel 1",
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__nbplay["spectrum-session"].channels[0].analyser
              .connections[0]?.fftSize,
        ),
      )
      .toBe(512);
  });

  test("a spectrum rendered before the mixer taps in when the bus is ready", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__mockSpectrumHz = 5000;
    });
    await renderSpectrum(page, { session_id: "spectrum-session" });
    await expect(peak(page)).toHaveText("—");
    await render(page, "mixer", "__mixerModel", MIXER);
    await expect(peak(page)).toContainText("kHz");
  });

  test("picking an FFT size writes the model", async ({ page }) => {
    await renderSpectrum(page);
    await page.locator(".nbplay-spectrum-fft select").selectOption("4096");
    expect(await page.evaluate(() => window.__testModel._state.fft_size)).toBe(
      4096,
    );
  });

  test("removing the element stops listening", async ({ page }) => {
    await render(page, "mixer", "__mixerModel", MIXER);
    await renderSpectrum(page, { session_id: "spectrum-session" });
    const listeners = () =>
      page.evaluate(
        () =>
          window.__nbplay["spectrum-session"].masterAnalyser.connections.length,
      );
    await expect.poll(listeners).toBe(1);
    await page.evaluate(() =>
      document.querySelector("nbplay-spectrum").remove(),
    );
    expect(await listeners()).toBe(0);
  });

  test("finds a real 3 kHz tone on a real audio graph", async ({ page }) => {
    // The harness mocks AudioContext; a fresh frame still has the browser's.
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.id = "start-audio";
      button.textContent = "start";
      button.addEventListener("click", async () => {
        const frame = document.createElement("iframe");
        document.body.appendChild(frame);
        const ctx = new frame.contentWindow.AudioContext();
        await ctx.resume();
        const tone = ctx.createOscillator();
        tone.frequency.value = 3000;
        const level = ctx.createGain();
        level.gain.value = 0.25;
        const tap = ctx.createAnalyser();
        tone.connect(level);
        level.connect(tap);
        tone.start();
        window.__nbplay = {
          "real-session": { audioCtx: ctx, masterAnalyser: tap },
        };
        window.__realSampleRate = ctx.sampleRate;
      });
      document.body.appendChild(button);
    });
    await page.locator("#start-audio").click();
    await expect
      .poll(() => page.evaluate(() => window.__realSampleRate))
      .toBeGreaterThan(0);
    await renderSpectrum(page, { session_id: "real-session", fft_size: 4096 });
    await expect(peak(page)).toContainText("kHz", { timeout: 15 * 1000 });
    await expect
      .poll(async () => {
        const text = await peak(page).textContent();
        return Math.abs(parseFloat(text) - 3);
      })
      .toBeLessThan(0.05);
  });
});
