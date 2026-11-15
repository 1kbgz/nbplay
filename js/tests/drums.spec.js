import { test, expect } from "@playwright/test";

const pad = (name, note, sound, params, extra = {}) => ({
  name,
  note,
  sound,
  gain: 1,
  pan: 0,
  choke: 0,
  params,
  ...extra,
});

const KIT = [
  pad("Kick", 36, "kick", { tune: 0, decay: 0.45, tone: 0.3 }),
  pad("Snare", 38, "snare", { tune: 0, decay: 0.2, tone: 0.6 }),
  pad(
    "Closed hat",
    42,
    "hat",
    { tune: 0, decay: 0.05, tone: 0.6 },
    { choke: 1 },
  ),
  pad("Open hat", 46, "hat", { tune: 0, decay: 0.6, tone: 0.6 }, { choke: 1 }),
  pad("Bass", 33, "synth", {
    preset: "Sub bass",
    oscillator_type: "sine",
    cutoff: 600,
    pitch: 36,
    length: 0.25,
  }),
];

const DEFAULTS = {
  session_id: "",
  channel_index: -1,
  pads: KIT,
  pattern: KIT.map(() => Array(16).fill(0)),
  steps: 16,
  step_duration: 0.25,
  swing: 0,
  bpm: 120,
  velocity: 100,
  preset_names: [],
  preset_request: "",
  sound_preset_names: { synth: ["Pluck", "Sub bass"], fm: ["Bell"] },
  is_playing: false,
  current_step: -1,
};

async function renderDrums(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/components.css";
      document.head.appendChild(link);
      const mod = await import("/dist/tests/instruments.js");
      const model = window.createMockModel({ ...opts });
      window.__testModel = model;
      mod.render("drums", { model, el: document.getElementById("root") });
    },
    { ...DEFAULTS, ...overrides },
  );
}

/** Record every oscillator start on the harness's mock AudioContext. */
async function recordOscillators(page) {
  await page.evaluate(() => {
    const Base = window.AudioContext;
    window.__oscs = [];
    class RecordingAudioContext extends Base {
      createOscillator() {
        const osc = super.createOscillator();
        const start = osc.start.bind(osc);
        osc.start = (time) => {
          window.__oscs.push({ time, type: osc.type });
          start(time);
        };
        return osc;
      }
    }
    window.AudioContext = RecordingAudioContext;
  });
}

const state = (page) => page.evaluate(() => window.__testModel._state);

test.describe("DrumMachineWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  test("renders the pads, the editor for the first pad and a row per pad", async ({
    page,
  }) => {
    await renderDrums(page);
    await expect(page.locator("nbplay-drums .nbplay-header-badge")).toHaveText(
      "drums",
    );
    // Five pads fill two rows of four; the last three cells are empty.
    await expect(
      page.locator("nbplay-drums .nbplay-pad-label").first(),
    ).toHaveText("Kick");
    expect(
      await page
        .locator("nbplay-drums .nbplay-pad-label")
        .evaluateAll((labels) =>
          labels.slice(0, 5).map((l) => l.textContent.trim()),
        ),
    ).toEqual(["Kick", "Snare", "Closed hat", "Open hat", "Bass"]);
    await expect(page.locator(".nbplay-drums-pad-name")).toHaveValue("Kick");
    await expect(
      page.locator('.nbplay-drums-sound [data-value="kick"]'),
    ).toHaveClass(/active/);
    await expect(page.locator(".nbplay-drum-grid-row")).toHaveCount(5);
    await expect(
      page
        .locator(".nbplay-drum-grid-row")
        .first()
        .locator(".nbplay-drum-grid-cell"),
    ).toHaveCount(16);
  });

  test("tapping a pad plays it and selects it in the editor", async ({
    page,
  }) => {
    await recordOscillators(page);
    await renderDrums(page);
    await page.locator("nbplay-drums .nbplay-pad-cell").nth(1).click();
    await expect(page.locator(".nbplay-drums-pad-name")).toHaveValue("Snare");
    // The snare's body is a triangle; the noise has no oscillator.
    expect(
      await page.evaluate(() => window.__oscs.map(({ type }) => type)),
    ).toEqual(["triangle"]);
    // A synth pad shows its preset, pitch and length instead of the drum dials.
    await page.locator("nbplay-drums .nbplay-pad-cell").nth(4).click();
    await expect(page.locator(".nbplay-drums-preset-select")).toHaveValue(
      "Sub bass",
    );
    await expect(page.locator(".nbplay-drums-pitch")).toBeVisible();
    await expect(page.locator(".nbplay-drums-tune")).toHaveCount(0);
  });

  test("the pattern grid writes the model", async ({ page }) => {
    await renderDrums(page);
    const row = page.locator(".nbplay-drum-grid-row").nth(1);
    await row.locator(".nbplay-drum-grid-cell").nth(4).click();
    expect((await state(page)).pattern[1][4]).toBe(100);
    await row.locator(".nbplay-drum-grid-cell").nth(4).hover();
    await page.mouse.wheel(0, 100);
    expect((await state(page)).pattern[1][4]).toBe(95);
    await row.locator(".nbplay-drum-grid-cell").nth(4).click();
    expect((await state(page)).pattern[1][4]).toBe(0);
    // A row's name selects its pad.
    await row.locator(".nbplay-drum-grid-name").click();
    await expect(page.locator(".nbplay-drums-pad-name")).toHaveValue("Snare");
  });

  test("the editor writes the selected pad", async ({ page }) => {
    await renderDrums(page);
    const edit = (selector, value) =>
      page.evaluate(
        ({ selector, value }) =>
          document
            .querySelector(selector)
            .dispatchEvent(
              new CustomEvent("change", { detail: { value }, bubbles: true }),
            ),
        { selector, value },
      );
    await edit(".nbplay-drums-decay", 0.8);
    await edit(".nbplay-drums-choke", 2);
    let pads = (await state(page)).pads;
    expect(pads[0].params).toEqual({ tune: 0, decay: 0.8, tone: 0.3 });
    expect(pads[0].choke).toBe(2);
    await page.locator(".nbplay-drums-pad-name").fill("Boom");
    await page.locator(".nbplay-drums-pad-name").press("Enter");
    // A new sound starts from its defaults, which the kernel fills in.
    await page.locator('.nbplay-drums-sound [data-value="fm"]').click();
    pads = (await state(page)).pads;
    expect([pads[0].name, pads[0].sound, pads[0].params]).toEqual([
      "Boom",
      "fm",
      {},
    ]);
    // Picking a synth preset for a synth pad keeps its pitch and length.
    await page.locator("nbplay-drums .nbplay-pad-cell").nth(4).click();
    await page.locator(".nbplay-drums-preset-select").selectOption("Pluck");
    expect((await state(page)).pads[4].params).toEqual({
      preset: "Pluck",
      pitch: 36,
      length: 0.25,
    });
  });

  test("the kit picker asks the kernel for a kit", async ({ page }) => {
    await renderDrums(page, { preset_names: ["Analog kit", "Electro kit"] });
    await page
      .locator("nbplay-drums nbplay-header .nbplay-preset-select")
      .selectOption("Electro kit");
    // A status request, made unique by the time it was picked.
    expect((await state(page)).preset_request).toMatch(/^\d+:Electro kit$/);
  });

  test("play runs the pattern on the clock and reports the step", async ({
    page,
  }) => {
    await recordOscillators(page);
    const pattern = KIT.map(() => Array(16).fill(0));
    pattern[0][0] = 100;
    await renderDrums(page, { pattern });
    await page.locator(".nbplay-drums-play").click();
    await expect.poll(async () => (await state(page)).is_playing).toBe(true);
    // The kick on step 0 starts a sine.
    await expect
      .poll(() => page.evaluate(() => window.__oscs.map(({ type }) => type)))
      .toContain("sine");
    await expect
      .poll(async () => (await state(page)).current_step)
      .toBeGreaterThan(0);
    await expect(page.locator(".nbplay-drum-grid-cell.current")).toHaveCount(5);
    await page.locator(".nbplay-drums-stop").click();
    await expect.poll(async () => (await state(page)).current_step).toBe(-1);
    expect((await state(page)).is_playing).toBe(false);
  });

  test("on a session bus, a note plays its pads and a choke group cuts the open hat", async ({
    page,
  }) => {
    // The harness mocks AudioContext; OfflineAudioContext is the browser's own.
    const render = async (notes) => {
      await page.goto("/tests/fixtures/harness.html");
      await page.evaluate(() => {
        const ctx = new OfflineAudioContext(1, 44100, 44100);
        window.__offline = ctx;
        globalThis.__nbplay = {
          drums: { audioCtx: ctx, channels: [{ gain: ctx.destination }] },
        };
      });
      await renderDrums(page, { session_id: "drums", channel_index: 0 });
      return page.evaluate(async (notes) => {
        const bus = globalThis.__nbplay.drums;
        for (const [note, at] of notes)
          bus.instruments[0].scheduleNote(note, 127, at, 0.1);
        const data = (await window.__offline.startRendering()).getChannelData(
          0,
        );
        const peak = (from, to) => {
          let most = 0;
          for (let i = Math.round(from * 44100); i < to * 44100; i++)
            most = Math.max(most, Math.abs(data[i]));
          return most;
        };
        return { ringing: peak(0.3, 0.4), late: peak(0.7, 1) };
      }, notes);
    };
    // The open hat rings for 0.6 s on its own...
    const open = await render([[46, 0]]);
    expect(open.ringing).toBeGreaterThan(0.01);
    // ...and the closed hat at 0.1 s cuts it off; it ends in 0.05 s.
    const choked = await render([
      [46, 0],
      [42, 0.1],
    ]);
    expect(choked.ringing).toBeLessThan(0.001);
    expect(choked.late).toBe(0);
    // A note no pad answers to plays nothing.
    const none = await render([[60, 0]]);
    expect(none.ringing + none.late).toBe(0);
  });
});
