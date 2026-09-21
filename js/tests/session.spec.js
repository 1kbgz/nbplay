import { test, expect } from "@playwright/test";

// Shared session clock: transport, sequencers, and timeline in one session
// must follow a single browser-side timebase.

const SESSION_ID = "clock-test-session";

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

const SEQUENCER_DEFAULTS = {
  session_id: SESSION_ID,
  channel_index: -1,
  keyboard_connected: false,
  length: 8,
  measures: 1,
  time_signature_num: 4,
  time_signature_den: 4,
  num_voices: 1,
  current_step: -1,
  bpm: 120,
  step_duration: 0.5,
  loop_enabled: true,
  is_playing: false,
  swing: 0,
  groove: [],
  automation_lanes: [],
  voices_data: [
    Array.from({ length: 8 }, () => ({
      active: true,
      note: 60,
      velocity: 100,
      duration_ticks: 1,
      probability: 100,
    })),
  ],
};

const TIMELINE_DEFAULTS = {
  session_id: SESSION_ID,
  bpm: 120,
  is_playing: false,
  is_recording: false,
  recording_track: -1,
  recording_error: "",
  count_in_bars: 0,
  recording_countdown_beats: 0,
  auto_extend_recording: true,
  recording_extend_bars: 8,
  time_signature_num: 4,
  time_signature_den: 4,
  length: 64,
  current_beat: 0,
  selected_clip_id: "",
  recorded_clip: {},
  tracks: [],
  clips: [],
};

/** Record every oscillator start time per widget instance. */
async function installAudioRecorder(page) {
  await page.evaluate(() => {
    const BaseAudioContext = window.AudioContext;
    window.__oscStarts = {};
    window.__currentWidget = "";
    class RecordingAudioContext extends BaseAudioContext {
      createOscillator() {
        const osc = super.createOscillator();
        const start = osc.start.bind(osc);
        osc.start = (time) => {
          const key = window.__currentWidget;
          (window.__oscStarts[key] = window.__oscStarts[key] || []).push(time);
          start(time);
        };
        return osc;
      }
    }
    window.AudioContext = RecordingAudioContext;
    window.webkitAudioContext = RecordingAudioContext;
  });
}

async function renderWidget(page, name, key, opts) {
  await page.evaluate(
    async ({ name, key, opts }) => {
      const mod = await import(`/dist/widgets/${name}.js`);
      const el = document.createElement("div");
      document.getElementById("root").appendChild(el);
      const model = window.createMockModel({ ...opts });
      window.__models = window.__models || {};
      window.__models[key] = model;
      // Tag oscillator starts with the widget that scheduled them by
      // wrapping the model's get(), which the scheduler calls per step.
      const get = model.get.bind(model);
      model.get = (k) => {
        window.__currentWidget = key;
        return get(k);
      };
      mod.default.render({ model, el });
    },
    { name, key, opts },
  );
}

test.describe("Session clock", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  test("bus exposes one clock shared by every widget in the session", async ({
    page,
  }) => {
    await renderWidget(page, "transport", "transport", TRANSPORT_DEFAULTS);
    await renderWidget(page, "sequencer", "seq", SEQUENCER_DEFAULTS);
    await renderWidget(page, "timeline", "timeline", TIMELINE_DEFAULTS);

    const state = await page.evaluate(() => {
      const bus = globalThis.__nbplay["clock-test-session"];
      return {
        hasClock: typeof bus.clock?.beat === "function",
        playing: bus.clock.playing,
        bpm: bus.clock.bpm,
      };
    });
    expect(state).toEqual({ hasClock: true, playing: false, bpm: 120 });
  });

  test("two sequencers start on the same step boundary", async ({ page }) => {
    await installAudioRecorder(page);
    await renderWidget(page, "transport", "transport", TRANSPORT_DEFAULTS);
    await renderWidget(page, "sequencer", "a", SEQUENCER_DEFAULTS);
    await renderWidget(page, "sequencer", "b", SEQUENCER_DEFAULTS);

    await page.locator(".nbplay-transport-play").click();
    await page.waitForFunction(
      () =>
        (window.__oscStarts.a?.length || 0) >= 1 &&
        (window.__oscStarts.b?.length || 0) >= 1,
    );

    const state = await page.evaluate(() => ({
      a: window.__oscStarts.a[0],
      b: window.__oscStarts.b[0],
      aPlaying: window.__models.a._state.is_playing,
      bPlaying: window.__models.b._state.is_playing,
      transportPlaying: window.__models.transport._state.is_playing,
    }));
    expect(state.aPlaying).toBe(true);
    expect(state.bPlaying).toBe(true);
    expect(state.transportPlaying).toBe(true);
    expect(Math.abs(state.a - state.b)).toBeLessThan(1e-6);
  });

  test("sequencers stay locked after a tempo change and a seek", async ({
    page,
  }) => {
    await installAudioRecorder(page);
    await renderWidget(page, "transport", "transport", TRANSPORT_DEFAULTS);
    await renderWidget(page, "sequencer", "a", SEQUENCER_DEFAULTS);
    await renderWidget(page, "sequencer", "b", SEQUENCER_DEFAULTS);

    await page.locator(".nbplay-transport-play").click();
    await page.waitForFunction(() => (window.__oscStarts.a?.length || 0) >= 1);

    // Tempo change from the transport slider.
    await page.locator(".nbplay-transport-bpm-slider").fill("240");
    const bpms = await page.evaluate(() => ({
      clock: globalThis.__nbplay["clock-test-session"].clock.bpm,
      a: window.__models.a._state.bpm,
      b: window.__models.b._state.bpm,
      transport: window.__models.transport._state.bpm,
    }));
    expect(bpms).toEqual({ clock: 240, a: 240, b: 240, transport: 240 });

    // Seek from Python: the transport observes current_beat and moves the clock.
    await page.evaluate(() => {
      window.__oscStarts = {};
      const model = window.__models.transport;
      model.set("current_beat", 2);
      model._trigger("change:current_beat");
    });
    await page.waitForFunction(
      () =>
        (window.__oscStarts.a?.length || 0) >= 2 &&
        (window.__oscStarts.b?.length || 0) >= 2,
    );

    const after = await page.evaluate(() => ({
      a: window.__oscStarts.a.slice(0, 2),
      b: window.__oscStarts.b.slice(0, 2),
      stepA: window.__models.a._state.current_step,
      stepB: window.__models.b._state.current_step,
      clockBeat: globalThis.__nbplay["clock-test-session"].clock.beat(),
    }));
    expect(Math.abs(after.a[0] - after.b[0])).toBeLessThan(1e-6);
    expect(Math.abs(after.a[1] - after.b[1])).toBeLessThan(1e-6);
    expect(after.stepA).toBe(after.stepB);
    // Steps are 0.5 beats: at 240 BPM that is 0.125 s apart.
    expect(after.a[1] - after.a[0]).toBeCloseTo(0.125, 3);
    expect(after.clockBeat).toBeGreaterThanOrEqual(2);
  });

  test("timeline and sequencer follow the transport play state without a kernel round-trip", async ({
    page,
  }) => {
    await renderWidget(page, "transport", "transport", TRANSPORT_DEFAULTS);
    await renderWidget(page, "sequencer", "seq", SEQUENCER_DEFAULTS);
    await renderWidget(page, "timeline", "timeline", TIMELINE_DEFAULTS);

    await page.locator(".nbplay-transport-play").click();
    let state = await page.evaluate(() => ({
      seq: window.__models.seq._state.is_playing,
      timeline: window.__models.timeline._state.is_playing,
    }));
    expect(state).toEqual({ seq: true, timeline: true });
    await expect(page.locator(".nbplay-timeline-play")).toHaveText("Stop");
    await expect(page.locator(".nbplay-seq-play")).toContainText("⏸");

    // Stopping from the timeline stops the whole session.
    await page.locator(".nbplay-timeline-play").click();
    state = await page.evaluate(() => ({
      seq: window.__models.seq._state.is_playing,
      timeline: window.__models.timeline._state.is_playing,
      transport: window.__models.transport._state.is_playing,
      seqStep: window.__models.seq._state.current_step,
    }));
    expect(state).toEqual({
      seq: false,
      timeline: false,
      transport: false,
      seqStep: -1,
    });
  });

  test("transport stop rewinds the shared playhead", async ({ page }) => {
    await renderWidget(page, "transport", "transport", {
      ...TRANSPORT_DEFAULTS,
      bpm: 600,
    });
    await renderWidget(page, "timeline", "timeline", TIMELINE_DEFAULTS);

    await page.locator(".nbplay-transport-play").click();
    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__models.transport._state.current_beat),
        { timeout: 1000 },
      )
      .toBeGreaterThan(0.5);

    await page.locator(".nbplay-transport-stop").click();
    const state = await page.evaluate(() => ({
      transportBeat: window.__models.transport._state.current_beat,
      timelineBeat: window.__models.timeline._state.current_beat,
      clockBeat: globalThis.__nbplay["clock-test-session"].clock.beat(),
    }));
    expect(state).toEqual({ transportBeat: 0, timelineBeat: 0, clockBeat: 0 });
    await expect(
      page.locator(".nbplay-timeline-playhead").first(),
    ).toHaveAttribute("style", /left: 0%;/);
  });

  test("a sequencer rendered while the session is playing joins in step", async ({
    page,
  }) => {
    await installAudioRecorder(page);
    await renderWidget(page, "transport", "transport", TRANSPORT_DEFAULTS);
    await renderWidget(page, "sequencer", "a", SEQUENCER_DEFAULTS);
    await page.locator(".nbplay-transport-play").click();
    await page.waitForFunction(() => (window.__oscStarts.a?.length || 0) >= 1);

    await renderWidget(page, "sequencer", "b", SEQUENCER_DEFAULTS);
    await page.waitForFunction(() => (window.__oscStarts.b?.length || 0) >= 1);

    const state = await page.evaluate(() => {
      const a = window.__oscStarts.a;
      const firstB = window.__oscStarts.b[0];
      return {
        bPlaying: window.__models.b._state.is_playing,
        onSharedGrid: a.some((t) => Math.abs(t - firstB) < 1e-6),
      };
    });
    expect(state.bPlaying).toBe(true);
    expect(state.onSharedGrid).toBe(true);
  });

  test("standalone sequencer uses a private clock", async ({ page }) => {
    await renderWidget(page, "sequencer", "solo", {
      ...SEQUENCER_DEFAULTS,
      session_id: "",
    });
    await page.locator(".nbplay-seq-play").click();
    const state = await page.evaluate(() => ({
      playing: window.__models.solo._state.is_playing,
      busCreated: Boolean(globalThis.__nbplay?.[""]),
    }));
    expect(state).toEqual({ playing: true, busCreated: false });
  });
});
