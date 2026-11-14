import { test, expect } from "@playwright/test";

const DEFAULTS = {
  session_id: "",
  channel_index: -1,
  frequency: 440,
  amplitude: 0.5,
  ratio: 2,
  index: 2,
  attack: 0.005,
  decay: 0.2,
  sustain: 0.6,
  release: 0.2,
  is_playing: false,
};

async function renderWidget(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/components.css";
      document.head.appendChild(link);
      const mod = await import("/dist/tests/instruments.js");
      const el = document.getElementById("root");
      const model = window.createMockModel({ ...opts });
      window.__testModel = model;
      mod.render("fm_synth", { model, el });
    },
    { ...DEFAULTS, ...overrides },
  );
}

test.describe("FMSynthWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  test("renders the patch controls and the envelope", async ({ page }) => {
    await renderWidget(page, { ratio: 3.5, index: 4 });
    await expect(
      page.locator("nbplay-fm-synth .nbplay-header-badge"),
    ).toHaveText("fm synth");
    await expect(page.locator(".nbplay-fm-waveform canvas")).toBeVisible();
    await expect(
      page.locator(".nbplay-fm-ratio .nbplay-value-text"),
    ).toHaveText("3.50");
    await expect(
      page.locator(".nbplay-fm-index .nbplay-value-text"),
    ).toHaveText("4.00");
    await expect(
      page.locator(".nbplay-fm-frequency .nbplay-value-text"),
    ).toHaveText("440.0 Hz");
    await expect(
      page.locator(".nbplay-fm-env-controls nbplay-param"),
    ).toHaveCount(4);
  });

  test("an edit writes the model and the play button reports its state", async ({
    page,
  }) => {
    await renderWidget(page);
    await page.evaluate(() => {
      document
        .querySelector(".nbplay-fm-ratio")
        .dispatchEvent(
          new CustomEvent("change", { detail: { value: 3 }, bubbles: true }),
        );
    });
    expect(await page.evaluate(() => window.__testModel._state.ratio)).toBe(3);
    const button = page.locator(".nbplay-play-btn");
    await button.click();
    await expect(button).toHaveClass(/playing/);
    expect(
      await page.evaluate(() => window.__testModel._state.is_playing),
    ).toBe(true);
    await button.click();
    expect(
      await page.evaluate(() => window.__testModel._state.is_playing),
    ).toBe(false);
  });

  test("plays its track's notes with the modulator at ratio times the note", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const BaseAudioContext = window.AudioContext;
      window.__oscs = [];
      class RecordingAudioContext extends BaseAudioContext {
        createOscillator() {
          const osc = super.createOscillator();
          const start = osc.start.bind(osc);
          osc.start = (time) => {
            window.__oscs.push({ time, freq: osc.frequency.value, osc });
            start(time);
          };
          return osc;
        }
      }
      const ctx = new RecordingAudioContext();
      globalThis.__nbplay = {
        "fm-session": {
          audioCtx: ctx,
          channels: [{ gain: ctx.createGain() }],
        },
      };
    });
    await renderWidget(page, {
      session_id: "fm-session",
      channel_index: 0,
      ratio: 3,
      index: 2,
    });
    const result = await page.evaluate(() => {
      const bus = globalThis.__nbplay["fm-session"];
      const cancel = bus.instruments[0].scheduleNote(69, 127, 2.5, 0.5);
      const [modulator, carrier] = window.__oscs;
      return {
        starts: window.__oscs.map(({ time, freq }) => [time, freq]),
        // The modulator feeds a gain that feeds the carrier's frequency.
        deviation: modulator.osc.connections[0].gain.value,
        reachesCarrier:
          modulator.osc.connections[0].connections[0] === carrier.osc.frequency,
        cancels: typeof cancel,
      };
    });
    expect(result).toEqual({
      starts: [
        [2.5, 1320],
        [2.5, 440],
      ],
      deviation: 2 * 1320,
      reachesCarrier: true,
      cancels: "function",
    });

    // Removing the element takes the instrument off the bus.
    await page.evaluate(() =>
      document.querySelector("nbplay-fm-synth").remove(),
    );
    expect(
      await page.evaluate(() =>
        Object.keys(globalThis.__nbplay["fm-session"].instruments),
      ),
    ).toEqual([]);
  });

  test("modulation adds sidebands to real audio and the envelope ends in silence", async ({
    page,
  }) => {
    // The harness mocks AudioContext; OfflineAudioContext is the browser's own.
    const measure = async (index) => {
      await page.goto("/tests/fixtures/harness.html");
      await page.evaluate(() => {
        const ctx = new OfflineAudioContext(1, 44100, 44100);
        window.__offline = ctx;
        globalThis.__nbplay = {
          "fm-real": { audioCtx: ctx, channels: [{ gain: ctx.destination }] },
        };
      });
      await renderWidget(page, {
        session_id: "fm-real",
        channel_index: 0,
        amplitude: 0.5,
        ratio: 2,
        index,
        attack: 0.01,
        decay: 0.05,
        sustain: 0.5,
        release: 0.1,
      });
      return page.evaluate(async () => {
        globalThis.__nbplay["fm-real"].instruments[0].scheduleNote(
          69,
          127,
          0,
          0.5,
        );
        const data = (await window.__offline.startRendering()).getChannelData(
          0,
        );
        // Magnitude at one frequency over the sustained part of the note.
        const strength = (hz) => {
          let re = 0;
          let im = 0;
          for (let i = 8820; i < 19845; i++) {
            const phase = (2 * Math.PI * hz * i) / 44100;
            re += data[i] * Math.cos(phase);
            im += data[i] * Math.sin(phase);
          }
          return Math.hypot(re, im);
        };
        const peak = (from, to) => {
          let most = 0;
          for (let i = from; i < to; i++)
            most = Math.max(most, Math.abs(data[i]));
          return most;
        };
        return {
          sideband: strength(1320) / strength(440),
          attackPeak: peak(0, 2646),
          sustained: peak(8820, 19845),
          afterRelease: peak(27000, 44100),
        };
      });
    };
    const plain = await measure(0);
    const modulated = await measure(2);
    // No modulation is a sine at the note. Ideal FM at ratio 2, index 2 puts
    // 0.478 of the strength at 440 Hz a modulator above it, at 1320 Hz.
    expect(plain.sideband).toBeLessThan(0.01);
    expect(Math.abs(modulated.sideband - 0.478)).toBeLessThan(0.02);
    for (const result of [plain, modulated]) {
      // Peak at the amplitude, held at amplitude x sustain, silent after the release.
      expect(Math.abs(result.attackPeak - 0.5)).toBeLessThan(0.03);
      expect(Math.abs(result.sustained - 0.25)).toBeLessThan(0.02);
      expect(result.afterRelease).toBeLessThan(0.001);
    }
  });
});
