import { test, expect } from "@playwright/test";

// Keyboard shortcuts scoped to the focused widget.

const TRANSPORT = {
  session_id: "",
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

const SEQUENCER = {
  session_id: "",
  channel_index: -1,
  keyboard_connected: false,
  length: 8,
  measures: 1,
  time_signature_num: 4,
  time_signature_den: 4,
  voices_data: [
    Array.from({ length: 8 }, () => ({
      active: false,
      note: 60,
      velocity: 100,
    })),
    Array.from({ length: 8 }, () => ({
      active: false,
      note: 64,
      velocity: 100,
    })),
  ],
  num_voices: 2,
  current_step: -1,
  bpm: 120,
  step_duration: 0.5,
  loop_enabled: true,
  is_playing: false,
  swing: 0,
  groove: [],
  automation_lanes: [],
};

const TIMELINE = {
  session_id: "shortcut-timeline",
  bpm: 120,
  is_playing: false,
  is_recording: false,
  recording_track: -1,
  recording_tracks: [],
  recording_error: "",
  count_in_bars: 0,
  recording_countdown_beats: 0,
  auto_extend_recording: true,
  recording_extend_bars: 8,
  time_signature_num: 4,
  time_signature_den: 4,
  length: 16,
  current_beat: 0,
  pixels_per_beat: 0,
  export_clip_id: "",
  exported_clip: {},
  exported_clip_data: null,
  import_clip_request: {},
  import_clip_data: null,
  selected_clip_id: "clip-a",
  recorded_clip: {},
  tracks: [
    {
      name: "Vocals",
      channel_index: 0,
      armed: false,
      muted: false,
      solo: false,
      input: "microphone",
      monitor: false,
    },
  ],
  clips: [
    {
      id: "clip-a",
      name: "Take A",
      track_index: 0,
      start: 0,
      duration: 4,
      audio_url: "blob:clip-a",
    },
  ],
};

const LAUNCHER = {
  session_id: "shortcut-launcher",
  bpm: 120,
  is_playing: false,
  time_signature_num: 4,
  time_signature_den: 4,
  quantize: "none",
  tracks: [{ name: "Drums", channel_index: 0 }],
  scenes: ["A", "B"],
  slots: [
    {
      track_index: 0,
      scene_index: 1,
      name: "Beat",
      voices_data: [[{ active: true, note: 36, velocity: 100 }]],
      step_duration: 0.5,
      swing: 0,
      groove: [],
    },
  ],
  active_slots: [-1],
  queued_slots: [-2],
  selected_slot: {},
  launch_request: {},
};

async function render(page, name, opts) {
  await page.evaluate(
    async ({ name, opts }) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `/dist/css/${name}.css`;
      document.head.appendChild(link);
      const mod = await import(`/dist/widgets/${name}.js`);
      const el = document.getElementById("root");
      const model = window.createMockModel({ ...opts });
      window.__testModel = model;
      mod.default.render({ model, el });
    },
    { name, opts },
  );
}

const state = (page, key) =>
  page.evaluate((k) => window.__testModel._state[k], key);

test.describe("Keyboard shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  test("transport: space, shift+space, r, l, and arrow tempo nudges", async ({
    page,
  }) => {
    await render(page, "transport", TRANSPORT);
    const root = page.locator(".nbplay-transport");
    await root.focus();

    await page.keyboard.press("Space");
    expect(await state(page, "is_playing")).toBe(true);
    await page.keyboard.press("Space");
    expect(await state(page, "is_playing")).toBe(false);

    await page.keyboard.press("r");
    expect(await state(page, "is_recording")).toBe(true);
    expect(await state(page, "is_playing")).toBe(true);

    await page.keyboard.press("Shift+Space");
    expect(await state(page, "is_playing")).toBe(false);
    expect(await state(page, "is_recording")).toBe(false);
    expect(await state(page, "current_beat")).toBe(0);

    await page.keyboard.press("ArrowUp");
    expect(await state(page, "bpm")).toBe(121);
    await page.keyboard.press("Shift+ArrowDown");
    expect(await state(page, "bpm")).toBe(111);
    await expect(page.locator(".nbplay-transport-bpm-val")).toHaveText(
      "111 BPM",
    );

    await page.keyboard.press("l");
    expect(await state(page, "loop_enabled")).toBe(true);
  });

  test("transport: shortcuts do not fire while editing the BPM field", async ({
    page,
  }) => {
    await render(page, "transport", TRANSPORT);
    await page.locator(".nbplay-transport-bpm-val").dblclick();
    const input = page.locator("input.nbplay-transport-inline-edit");
    await input.fill("140");
    await page.keyboard.press("Space");
    expect(await state(page, "is_playing")).toBe(false);
    await input.press("Enter");
    expect(await state(page, "bpm")).toBe(140);
  });

  test("transport: space on a focused button does not double-toggle", async ({
    page,
  }) => {
    await render(page, "transport", TRANSPORT);
    await page.locator(".nbplay-transport-play").focus();
    await page.keyboard.press("Space");
    expect(await state(page, "is_playing")).toBe(true);
  });

  test("sequencer: arrow cursor, enter toggles, space plays", async ({
    page,
  }) => {
    await render(page, "sequencer", SEQUENCER);
    const root = page.locator(".nbplay-sequencer");
    await root.focus();

    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".nbplay-seq-cell.cursor")).toHaveCount(1);
    await expect(page.locator(".nbplay-seq-cell.cursor")).toHaveAttribute(
      "data-step",
      "0",
    );
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const cursor = page.locator(".nbplay-seq-cell.cursor");
    await expect(cursor).toHaveAttribute("data-step", "2");
    await expect(cursor).toHaveAttribute("data-voice", "1");

    await page.keyboard.press("Enter");
    const voices = await state(page, "voices_data");
    expect(voices[1][2].active).toBe(true);
    expect(voices[0][2].active).toBe(false);
    await expect(cursor).toHaveClass(/active/);

    await page.keyboard.press("x");
    expect((await state(page, "voices_data"))[1][2].active).toBe(false);

    await page.keyboard.press("Space");
    expect(await state(page, "is_playing")).toBe(true);
    await page.keyboard.press("Shift+Space");
    expect(await state(page, "is_playing")).toBe(false);
    expect(await state(page, "current_step")).toBe(-1);

    await page.keyboard.press("Escape");
    await expect(page.locator(".nbplay-seq-cell.cursor")).toHaveCount(0);
  });

  test("timeline: space plays, delete removes the selected clip", async ({
    page,
  }) => {
    await render(page, "timeline", TIMELINE);
    await page.locator(".nbplay-timeline").focus();
    await page.keyboard.press("Space");
    expect(await state(page, "is_playing")).toBe(true);
    await page.keyboard.press("Shift+Space");
    expect(await state(page, "is_playing")).toBe(false);
    expect(await state(page, "current_beat")).toBe(0);

    await page.keyboard.press("l");
    expect(
      await page.evaluate(
        () => globalThis.__nbplay["shortcut-timeline"].clock.loop.enabled,
      ),
    ).toBe(true);

    await page.keyboard.press("d");
    await expect(page.locator(".nbplay-timeline-clip")).toHaveCount(2);
    await page.keyboard.press("Delete");
    await expect(page.locator(".nbplay-timeline-clip")).toHaveCount(1);
  });

  test("launcher: digits launch scenes, escape stops all", async ({ page }) => {
    await render(page, "launcher", LAUNCHER);
    await page.locator(".nbplay-launcher").focus();
    await page.keyboard.press("2");
    expect(await state(page, "active_slots")).toEqual([1]);
    expect(await state(page, "is_playing")).toBe(true);
    await page.keyboard.press("Escape");
    expect(await state(page, "active_slots")).toEqual([-1]);
    await page.keyboard.press("Space");
    expect(await state(page, "is_playing")).toBe(false);
  });
});
