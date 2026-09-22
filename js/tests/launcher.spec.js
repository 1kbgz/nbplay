import { test, expect } from "@playwright/test";

// Beats view: clip launcher grid driven by the shared session clock.

const SESSION_ID = "launcher-session";

function pattern(note, length = 4) {
  return [
    Array.from({ length }, () => ({
      active: true,
      note,
      velocity: 100,
      duration_ticks: 1,
      probability: 100,
    })),
  ];
}

const DEFAULTS = {
  session_id: SESSION_ID,
  bpm: 120,
  is_playing: false,
  time_signature_num: 4,
  time_signature_den: 4,
  quantize: "bar",
  tracks: [
    { name: "Drums", channel_index: 0 },
    { name: "Bass", channel_index: 1 },
  ],
  scenes: ["Intro", "Drop"],
  slots: [
    {
      track_index: 0,
      scene_index: 0,
      name: "Kick",
      voices_data: pattern(36),
      step_duration: 0.5,
      swing: 0,
      groove: [],
    },
    {
      track_index: 1,
      scene_index: 0,
      name: "Root",
      voices_data: pattern(40),
      step_duration: 0.5,
      swing: 0,
      groove: [],
    },
    {
      track_index: 0,
      scene_index: 1,
      name: "Snare",
      voices_data: pattern(38),
      step_duration: 0.5,
      swing: 0,
      groove: [],
    },
  ],
  active_slots: [-1, -1],
  queued_slots: [-2, -2],
  selected_slot: {},
  launch_request: {},
};

const TRANSPORT_DEFAULTS = {
  session_id: SESSION_ID,
  is_playing: false,
  is_recording: false,
  bpm: 120,
  time_signature_num: 4,
  time_signature_den: 4,
  bar_number: 0,
  beat_in_bar: 0,
  current_beat: 0,
  loop_enabled: false,
  loop_start_bar: 0,
  loop_end_bar: 4,
};

async function renderLauncher(page, overrides = {}) {
  const opts = { ...DEFAULTS, ...overrides };
  await page.evaluate(async (opts) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/dist/css/launcher.css";
    document.head.appendChild(link);
    const mod = await import("/dist/widgets/launcher.js");
    const el = document.createElement("div");
    document.getElementById("root").appendChild(el);
    const model = window.createMockModel({ ...opts });
    window.__testModel = model;
    window.__cleanup = mod.default.render({ model, el });
  }, opts);
}

async function renderTransport(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const mod = await import("/dist/widgets/transport.js");
      const el = document.createElement("div");
      document.getElementById("root").appendChild(el);
      const model = window.createMockModel({ ...opts });
      window.__transportModel = model;
      mod.default.render({ model, el });
    },
    { ...TRANSPORT_DEFAULTS, ...overrides },
  );
}

async function installAudioRecorder(page) {
  await page.evaluate(() => {
    const BaseAudioContext = window.AudioContext;
    window.__oscStarts = [];
    class RecordingAudioContext extends BaseAudioContext {
      createOscillator() {
        const osc = super.createOscillator();
        const start = osc.start.bind(osc);
        osc.start = (time) => {
          window.__oscStarts.push({ time, freq: osc.frequency.value });
          start(time);
        };
        return osc;
      }
    }
    window.AudioContext = RecordingAudioContext;
    window.webkitAudioContext = RecordingAudioContext;
  });
}

const clockState = () => globalThis.__nbplay["launcher-session"].clock;

test.describe("LauncherWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  test("renders tracks, scenes, and slots", async ({ page }) => {
    await renderLauncher(page);
    await expect(page.locator(".nbplay-launcher-scene")).toHaveCount(2);
    await expect(page.locator(".nbplay-launcher-row[data-track]")).toHaveCount(
      2,
    );
    await expect(page.locator(".nbplay-launcher-slot.filled")).toHaveCount(3);
    await expect(page.locator(".nbplay-launcher-slot.empty")).toHaveCount(1);
    await expect(
      page.locator(".nbplay-launcher-slot.filled").first(),
    ).toHaveText("Kick");
    await expect(page.locator(".nbplay-badge")).toHaveText("launcher");
  });

  test("launching from a stopped session starts the clock immediately", async ({
    page,
  }) => {
    await installAudioRecorder(page);
    await renderLauncher(page);
    await page
      .locator('.nbplay-launcher-slot[data-track="0"][data-scene="0"]')
      .click();

    const state = await page.evaluate(() => ({
      playing: window.__testModel._state.is_playing,
      clockPlaying: globalThis.__nbplay["launcher-session"].clock.playing,
      active: window.__testModel._state.active_slots,
      queued: window.__testModel._state.queued_slots,
      selected: window.__testModel._state.selected_slot,
    }));
    expect(state.playing).toBe(true);
    expect(state.clockPlaying).toBe(true);
    expect(state.active).toEqual([0, -1]);
    expect(state.queued).toEqual([-2, -2]);
    expect(state.selected).toEqual({ track_index: 0, scene_index: 0 });
    await expect(
      page.locator('.nbplay-launcher-slot[data-track="0"][data-scene="0"]'),
    ).toHaveClass(/active/);
    await page.waitForFunction(() => window.__oscStarts.length >= 1);
  });

  test("launches quantize to the next bar while playing", async ({ page }) => {
    await renderLauncher(page, { bpm: 6000 });
    await page
      .locator('.nbplay-launcher-slot[data-track="0"][data-scene="0"]')
      .click();

    // Queue the second scene on track 0: it waits for the bar boundary.
    await page.evaluate(() => {
      window.__launchBeat =
        globalThis.__nbplay["launcher-session"].clock.beat();
    });
    await page
      .locator('.nbplay-launcher-slot[data-track="0"][data-scene="1"]')
      .click();
    const queued = await page.evaluate(
      () => window.__testModel._state.queued_slots,
    );
    expect(queued[0] === 1 || queued[0] === -2).toBe(true);

    await expect
      .poll(
        async () => page.evaluate(() => window.__testModel._state.active_slots),
        {
          timeout: 1000,
        },
      )
      .toEqual([1, -1]);
    const after = await page.evaluate(() => ({
      queued: window.__testModel._state.queued_slots,
      beat: globalThis.__nbplay["launcher-session"].clock.beat(),
      launchBeat: window.__launchBeat,
    }));
    expect(after.queued).toEqual([-2, -2]);
    // A 4-beat bar boundary must have passed since the launch was queued.
    expect(Math.floor(after.beat / 4)).toBeGreaterThan(
      Math.floor(after.launchBeat / 4),
    );
  });

  test("scene launch fills every track and empty slots stop a track", async ({
    page,
  }) => {
    await renderLauncher(page, { quantize: "none" });
    await page.locator('.nbplay-launcher-scene[data-scene="0"]').click();
    let active = await page.evaluate(
      () => window.__testModel._state.active_slots,
    );
    expect(active).toEqual([0, 0]);

    await page.locator('.nbplay-launcher-scene[data-scene="1"]').click();
    active = await page.evaluate(() => window.__testModel._state.active_slots);
    expect(active).toEqual([1, -1]);

    await page.locator(".nbplay-launcher-stop-all").click();
    active = await page.evaluate(() => window.__testModel._state.active_slots);
    expect(active).toEqual([-1, -1]);
    await expect(page.locator(".nbplay-launcher-slot.active")).toHaveCount(0);
  });

  test("track stop button and Python launch requests", async ({ page }) => {
    await renderLauncher(page, { quantize: "none" });
    await page.evaluate(() => {
      const model = window.__testModel;
      model.set("launch_request", {
        action: "launch",
        track_index: 1,
        scene_index: 0,
        nonce: 1,
      });
      model._trigger("change:launch_request");
    });
    expect(
      await page.evaluate(() => window.__testModel._state.active_slots),
    ).toEqual([-1, 0]);

    await page.locator('.nbplay-launcher-track-stop[data-track="1"]').click();
    expect(
      await page.evaluate(() => window.__testModel._state.active_slots),
    ).toEqual([-1, -1]);

    await page.evaluate(() => {
      const model = window.__testModel;
      model.set("launch_request", {
        action: "scene",
        scene_index: 0,
        nonce: 2,
      });
      model._trigger("change:launch_request");
      model.set("launch_request", { action: "stop", track_index: 0, nonce: 3 });
      model._trigger("change:launch_request");
    });
    expect(
      await page.evaluate(() => window.__testModel._state.active_slots),
    ).toEqual([-1, 0]);
  });

  test("two launched tracks schedule on the same grid as a transport", async ({
    page,
  }) => {
    await installAudioRecorder(page);
    await renderTransport(page);
    await renderLauncher(page, { quantize: "none" });
    await page.locator('.nbplay-launcher-scene[data-scene="0"]').click();
    await page.waitForFunction(() => window.__oscStarts.length >= 4);

    const state = await page.evaluate(() => {
      const starts = window.__oscStarts;
      const byFreq = {};
      starts.forEach((s) => {
        const key = s.freq.toFixed(3);
        (byFreq[key] = byFreq[key] || []).push(s.time);
      });
      return {
        transportPlaying: window.__transportModel._state.is_playing,
        series: Object.values(byFreq).map((times) => times.slice(0, 2)),
      };
    });
    expect(state.transportPlaying).toBe(true);
    expect(state.series.length).toBe(2);
    expect(Math.abs(state.series[0][0] - state.series[1][0])).toBeLessThan(
      1e-6,
    );
    expect(Math.abs(state.series[0][1] - state.series[1][1])).toBeLessThan(
      1e-6,
    );
  });

  test("transport stop pauses slots and play resumes them", async ({
    page,
  }) => {
    await renderTransport(page);
    await renderLauncher(page, { quantize: "none" });
    await page
      .locator('.nbplay-launcher-slot[data-track="0"][data-scene="0"]')
      .click();
    await page.locator(".nbplay-transport-play").click();
    let state = await page.evaluate(() => ({
      playing: window.__testModel._state.is_playing,
      active: window.__testModel._state.active_slots,
    }));
    expect(state.playing).toBe(false);
    expect(state.active).toEqual([0, -1]);

    await page.locator(".nbplay-transport-play").click();
    state = await page.evaluate(() => ({
      playing: window.__testModel._state.is_playing,
      active: window.__testModel._state.active_slots,
    }));
    expect(state.playing).toBe(true);
    expect(state.active).toEqual([0, -1]);
    await expect(
      page.locator('.nbplay-launcher-slot[data-track="0"][data-scene="0"]'),
    ).toHaveClass(/active/);
  });

  test("quantize select writes the model", async ({ page }) => {
    await renderLauncher(page);
    await page.locator(".nbplay-launcher-quantize").selectOption("beat");
    expect(await page.evaluate(() => window.__testModel._state.quantize)).toBe(
      "beat",
    );
  });
});
