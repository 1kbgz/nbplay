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

  test("a scene launched over a playing scene is marked next and takes over", async ({
    page,
  }) => {
    await renderLauncher(page, { bpm: 6000 });
    await page.locator('.nbplay-launcher-scene[data-scene="1"]').click();
    await expect
      .poll(async () =>
        page.evaluate(() => window.__testModel._state.active_slots),
      )
      .toEqual([1, -1]);
    await expect(
      page.locator('.nbplay-launcher-scene[data-scene="1"]'),
    ).toHaveClass(/active/);

    // Queue Intro while Drop plays: the header and both cells show it as next.
    await page.evaluate(() => {
      window.__launchBeat =
        globalThis.__nbplay["launcher-session"].clock.beat();
    });
    await page.locator('.nbplay-launcher-scene[data-scene="0"]').click();
    const marked = await page.evaluate(() => ({
      queued: window.__testModel._state.queued_slots,
      header: document
        .querySelector('.nbplay-launcher-scene[data-scene="0"]')
        .classList.contains("queued"),
      next: document.querySelectorAll(".nbplay-launcher-next").length,
    }));
    if (marked.queued[0] === 0) {
      expect(marked.header).toBe(true);
      expect(marked.next).toBe(2);
    }
    await expect
      .poll(async () =>
        page.evaluate(() => window.__testModel._state.active_slots),
      )
      .toEqual([0, 0]);
    const after = await page.evaluate(() => ({
      queued: window.__testModel._state.queued_slots,
      next: document.querySelectorAll(".nbplay-launcher-next").length,
      activeHeader: document
        .querySelector('.nbplay-launcher-scene[data-scene="0"]')
        .classList.contains("active"),
      oldHeader: document
        .querySelector('.nbplay-launcher-scene[data-scene="1"]')
        .classList.contains("active"),
    }));
    expect(after).toEqual({
      queued: [-2, -2],
      next: 0,
      activeHeader: true,
      oldHeader: false,
    });
  });

  test("stop clears launched slots and a slot click afterwards plays only itself", async ({
    page,
  }) => {
    await renderLauncher(page, { quantize: "none" });
    await renderTransport(page);
    await page.locator('.nbplay-launcher-scene[data-scene="0"]').click();
    expect(
      await page.evaluate(() => window.__testModel._state.active_slots),
    ).toEqual([0, 0]);

    await page.locator(".nbplay-transport-stop").click();
    expect(
      await page.evaluate(() => ({
        active: window.__testModel._state.active_slots,
        queued: window.__testModel._state.queued_slots,
        playing: window.__testModel._state.is_playing,
      })),
    ).toEqual({ active: [-1, -1], queued: [-2, -2], playing: false });
    await expect(page.locator(".nbplay-launcher-slot.active")).toHaveCount(0);

    // Play alone brings nothing back.
    await page.locator(".nbplay-transport-play").click();
    expect(
      await page.evaluate(() => window.__testModel._state.active_slots),
    ).toEqual([-1, -1]);
    await page.locator(".nbplay-transport-stop").click();

    // A single slot click starts the clock with only that slot playing.
    await page
      .locator('.nbplay-launcher-slot[data-track="1"][data-scene="0"]')
      .click();
    expect(
      await page.evaluate(() => ({
        active: window.__testModel._state.active_slots,
        playing: globalThis.__nbplay["launcher-session"].clock.playing,
      })),
    ).toEqual({ active: [-1, 0], playing: true });
  });

  test("an unchanged slots write does not restart a playing slot", async ({
    page,
  }) => {
    await installAudioRecorder(page);
    await renderLauncher(page, { quantize: "none", bpm: 600 });
    await page
      .locator('.nbplay-launcher-slot[data-track="0"][data-scene="0"]')
      .click();
    await page.waitForFunction(() => window.__oscStarts.length >= 2);

    // The editor echoes the slot it loaded: same data, new list object.
    await page.evaluate(() => {
      const model = window.__testModel;
      model.set(
        "slots",
        model._state.slots.map((slot) => ({ ...slot })),
      );
      model._trigger("change:slots");
    });
    await page.waitForFunction(() => window.__oscStarts.length >= 6);
    const duplicates = await page.evaluate(() => {
      const times = window.__oscStarts.map((s) => s.time.toFixed(6));
      return times.length - new Set(times).size;
    });
    expect(duplicates).toBe(0);

    // A real change restarts on the new pattern.
    await page.evaluate(() => {
      const model = window.__testModel;
      const slots = model._state.slots.map((slot) => ({ ...slot }));
      slots[0] = {
        ...slots[0],
        voices_data: [
          slots[0].voices_data[0].map((step) => ({ ...step, note: 48 })),
        ],
      };
      model.set("slots", slots);
      model._trigger("change:slots");
    });
    await page.waitForFunction(() =>
      window.__oscStarts.some((s) => Math.abs(s.freq - 130.81) < 0.1),
    );
  });

  test("a queued launch fires at the loop restart and a backward seek keeps quantization", async ({
    page,
  }) => {
    await renderLauncher(page, { bpm: 600 });
    await page.evaluate(() => {
      globalThis.__nbplay["launcher-session"].clock.setLoop(true, 0, 4);
    });
    await page.locator('.nbplay-launcher-scene[data-scene="0"]').click();
    expect(
      await page.evaluate(() => window.__testModel._state.active_slots),
    ).toEqual([0, 0]);

    // Just before the loop end, the bar boundary at beat 4 is the restart.
    await page.evaluate(() => {
      globalThis.__nbplay["launcher-session"].clock.seek(3.95);
    });
    await page
      .locator('.nbplay-launcher-slot[data-track="0"][data-scene="1"]')
      .click();
    await expect
      .poll(
        async () => page.evaluate(() => window.__testModel._state.active_slots),
        { timeout: 1500 },
      )
      .toEqual([1, 0]);

    // Queue at beat 2, then seek back to 1: the launch re-aims at beat 4
    // and does not fire early.
    await page.evaluate(() => {
      globalThis.__nbplay["launcher-session"].clock.seek(2);
    });
    await page
      .locator('.nbplay-launcher-slot[data-track="0"][data-scene="0"]')
      .click();
    await page.evaluate(() => {
      globalThis.__nbplay["launcher-session"].clock.seek(1);
    });
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(() => window.__testModel._state.active_slots),
    ).toEqual([1, 0]);
    await expect
      .poll(
        async () => page.evaluate(() => window.__testModel._state.active_slots),
        { timeout: 1500 },
      )
      .toEqual([0, 0]);
  });

  test("a scene launched from a stopped clock starts every row together", async ({
    page,
  }) => {
    await renderLauncher(page);
    await page.evaluate(() => {
      globalThis.__nbplay["launcher-session"].clock.seek(1);
    });
    await page.locator('.nbplay-launcher-scene[data-scene="0"]').click();
    expect(
      await page.evaluate(() => ({
        active: window.__testModel._state.active_slots,
        queued: window.__testModel._state.queued_slots,
      })),
    ).toEqual({ active: [0, 0], queued: [-2, -2] });
  });

  test("a stop request while stopped does not start the clock", async ({
    page,
  }) => {
    await renderLauncher(page);
    await page
      .locator('.nbplay-launcher-slot[data-track="1"][data-scene="1"]')
      .click();
    await page.locator(".nbplay-launcher-stop-all").click();
    expect(
      await page.evaluate(() => ({
        playing: globalThis.__nbplay["launcher-session"].clock.playing,
        active: window.__testModel._state.active_slots,
      })),
    ).toEqual({ playing: false, active: [-1, -1] });
  });

  test("scene headers distinguish full, partial, and queued scenes", async ({
    page,
  }) => {
    await renderLauncher(page, { quantize: "none" });
    await page
      .locator('.nbplay-launcher-slot[data-track="0"][data-scene="0"]')
      .click();
    const intro = page.locator('.nbplay-launcher-scene[data-scene="0"]');
    await expect(intro).toHaveClass(/partial/);
    await expect(intro).not.toHaveClass(/active/);
    await page.locator('.nbplay-launcher-scene[data-scene="0"]').click();
    await expect(intro).toHaveClass(/active/);
    await expect(intro).not.toHaveClass(/partial/);

    // Queue Drop with bar quantization: Bass has no Drop slot, so its empty
    // cell is marked as a pending stop and the header as queued.
    await page.evaluate(() => {
      window.__testModel.set("quantize", "bar");
      window.__testModel._trigger("change:quantize");
      globalThis.__nbplay["launcher-session"].clock.setTempo(1);
      globalThis.__nbplay["launcher-session"].clock.seek(0.5);
    });
    await page.locator('.nbplay-launcher-scene[data-scene="1"]').click();
    await expect(
      page.locator('.nbplay-launcher-scene[data-scene="1"]'),
    ).toHaveClass(/queued/);
    const emptyCell = page.locator(
      '.nbplay-launcher-slot[data-track="1"][data-scene="1"]',
    );
    await expect(emptyCell).toHaveClass(/queued/);
    await expect(emptyCell.locator(".nbplay-launcher-next")).toHaveText("stop");
    await expect(
      page.locator(
        '.nbplay-launcher-slot[data-track="0"][data-scene="1"] .nbplay-launcher-next',
      ),
    ).toHaveText("next");
  });

  test("removing a track stops the performance instead of shifting it", async ({
    page,
  }) => {
    await renderLauncher(page, { quantize: "none" });
    await page.locator('.nbplay-launcher-scene[data-scene="0"]').click();
    await page.evaluate(() => {
      const model = window.__testModel;
      model.set("tracks", model._state.tracks.slice(1));
      model.set(
        "slots",
        model._state.slots
          .filter((slot) => slot.track_index === 1)
          .map((slot) => ({ ...slot, track_index: 0 })),
      );
      model._trigger("change:tracks");
    });
    expect(
      await page.evaluate(() => ({
        active: window.__testModel._state.active_slots,
        queued: window.__testModel._state.queued_slots,
      })),
    ).toEqual({ active: [-1], queued: [-2] });
    await expect(page.locator(".nbplay-launcher-slot.active")).toHaveCount(0);
  });

  test("stopping cancels notes already handed to the audio clock", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const BaseAudioContext = window.AudioContext;
      window.__oscs = [];
      class RecordingAudioContext extends BaseAudioContext {
        createOscillator() {
          const osc = super.createOscillator();
          const entry = { start: null, stops: [] };
          const start = osc.start.bind(osc);
          const stop = osc.stop.bind(osc);
          osc.start = (time) => {
            entry.start = time;
            start(time);
          };
          osc.stop = (time) => {
            entry.stops.push(time);
            stop(time);
          };
          window.__oscs.push(entry);
          return osc;
        }
      }
      window.AudioContext = RecordingAudioContext;
      window.webkitAudioContext = RecordingAudioContext;
    });
    await renderLauncher(page, { quantize: "none", bpm: 600 });
    await page
      .locator('.nbplay-launcher-slot[data-track="0"][data-scene="0"]')
      .click();
    await page.waitForFunction(() => window.__oscs.length >= 2);
    const result = await page.evaluate(() => {
      const ctx = globalThis.__nbplay["launcher-session"].audioCtx;
      const now = ctx.currentTime;
      document.querySelector(".nbplay-launcher-stop-all").click();
      const future = window.__oscs.filter((entry) => entry.start > now);
      return {
        future: future.length,
        cancelled: future.filter((entry) =>
          entry.stops.some((t) => t <= now + 0.05),
        ).length,
      };
    });
    expect(result.future).toBeGreaterThan(0);
    expect(result.cancelled).toBe(result.future);
  });

  test("quantize select writes the model", async ({ page }) => {
    await renderLauncher(page);
    await page.locator(".nbplay-launcher-quantize").selectOption("beat");
    expect(await page.evaluate(() => window.__testModel._state.quantize)).toBe(
      "beat",
    );
  });
});
