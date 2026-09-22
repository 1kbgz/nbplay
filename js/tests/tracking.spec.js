import { test, expect } from "@playwright/test";

// Tracking view: multi-lane recording, channel taps, loop brace, zoom,
// clip editing, and clip audio transfer.

const SESSION_ID = "tracking-session";

const DEFAULTS = {
  session_id: SESSION_ID,
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
  selected_clip_id: "",
  recorded_clip: {},
  tracks: [
    {
      name: "Vocals",
      channel_index: 0,
      armed: true,
      muted: false,
      solo: false,
      input: "microphone",
      monitor: false,
    },
    {
      name: "Synth",
      channel_index: 1,
      armed: true,
      muted: false,
      solo: false,
      input: "channel",
      monitor: false,
    },
  ],
  clips: [],
};

async function renderWidget(page, overrides = {}) {
  const opts = { ...DEFAULTS, ...overrides };
  if (overrides.tracks) opts.tracks = overrides.tracks;
  if (overrides.clips) opts.clips = overrides.clips;
  await page.evaluate(async (opts) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/dist/css/timeline.css";
    document.head.appendChild(link);
    const mod = await import("/dist/widgets/timeline.js");
    const el = document.getElementById("root");
    const model = window.createMockModel({ ...opts });
    window.__testModel = model;
    window.__cleanup = mod.default.render({ model, el });
  }, opts);
}

/** Session bus with two mixer channels, as the mixer would register it. */
async function installBus(page) {
  await page.evaluate((sessionId) => {
    const ctx = new AudioContext();
    const bus = (window.__nbplay = window.__nbplay || {});
    bus[sessionId] = {
      ...(bus[sessionId] || {}),
      audioCtx: ctx,
      masterGain: ctx.createGain(),
      channels: [{ gain: ctx.createGain() }, { gain: ctx.createGain() }],
    };
    window.__testChannelGains = bus[sessionId].channels.map((c) => c.gain);
  }, SESSION_ID);
}

async function installMediaRecorderMock(page) {
  await page.evaluate(() => {
    window.__recorderStreams = [];
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          mock: "microphone",
          getTracks: () => [{ stop: () => {} }],
        }),
      },
    });
    window.MediaRecorder = class MockMediaRecorder extends EventTarget {
      constructor(stream) {
        super();
        this.stream = stream;
        window.__recorderStreams.push(stream?.mock || "unknown");
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

test.describe("Tracking view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  test("records every armed lane at once, tapping mixer channels", async ({
    page,
  }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page);
    await installBus(page);

    await page.locator(".nbplay-timeline-record").click();
    await expect
      .poll(
        async () =>
          page.evaluate(() => ({
            recording: window.__testModel._state.is_recording,
            tracks: window.__testModel._state.recording_tracks,
            rows: document.querySelectorAll(".nbplay-timeline-row.recording")
              .length,
          })),
        { timeout: 1000 },
      )
      .toEqual({ recording: true, tracks: [0, 1], rows: 2 });

    const wiring = await page.evaluate(() => ({
      streams: window.__recorderStreams,
      tapConnected:
        window.__testChannelGains[1].connections[0] ===
        window.__mediaStreamDestinations?.[0],
    }));
    expect(wiring.streams).toEqual(["microphone", "channel-tap"]);
    expect(wiring.tapConnected).toBe(true);

    await page.locator(".nbplay-timeline-record").click();
    const state = await page.evaluate(() => ({
      clips: window.__testModel._state.clips.map((c) => [
        c.track_index,
        c.name,
      ]),
      recording: window.__testModel._state.is_recording,
      tracks: window.__testModel._state.recording_tracks,
      tapReleased: window.__mediaStreamDestinations[0].disconnected,
    }));
    expect(state.clips).toEqual([
      [0, "Take 1"],
      [1, "Take 2"],
    ]);
    expect(state.recording).toBe(false);
    expect(state.tracks).toEqual([]);
    expect(state.tapReleased).toBe(true);
  });

  test("channel lane without a mixer bus reports an error", async ({
    page,
  }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page, {
      tracks: [{ ...DEFAULTS.tracks[1], channel_index: 3 }],
    });
    await page.locator(".nbplay-timeline-record").click();
    await expect
      .poll(async () =>
        page.evaluate(() => window.__testModel._state.recording_error),
      )
      .toContain("Mixer channel 4 is not available");
    expect(
      await page.evaluate(() => window.__testModel._state.is_recording),
    ).toBe(false);
  });

  test("input selector writes the lane record source", async ({ page }) => {
    await renderWidget(page);
    const select = page.locator(".nbplay-track-input").first();
    await expect(select).toHaveValue("microphone");
    await select.selectOption("channel");
    expect(
      await page.evaluate(() => window.__testModel._state.tracks[0].input),
    ).toBe("channel");
    await expect(page.locator(".nbplay-track-input").first()).toHaveValue(
      "channel",
    );
  });

  test("loop button and handles drive the session clock loop range", async ({
    page,
  }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-timeline-loop")).toHaveCount(0);

    await page.locator(".nbplay-timeline-loop-btn").click();
    let loop = await page.evaluate(
      () => globalThis.__nbplay["tracking-session"].clock.loop,
    );
    expect(loop).toEqual({ enabled: true, startBeat: 0, endBeat: 16 });
    await expect(page.locator(".nbplay-timeline-loop")).toHaveCount(1);
    await expect(page.locator(".nbplay-timeline-loop-btn")).toHaveClass(
      /active/,
    );

    // Drag the end handle to the middle of the ruler (bar 3 of 4).
    const ruler = page.locator(".nbplay-timeline-ruler-track");
    const box = await ruler.boundingBox();
    const endHandle = page.locator(
      ".nbplay-timeline-loop-handle[data-edge=end]",
    );
    const handleBox = await endHandle.boundingBox();
    await page.mouse.move(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    await page.mouse.up();

    loop = await page.evaluate(
      () => globalThis.__nbplay["tracking-session"].clock.loop,
    );
    expect(loop).toEqual({ enabled: true, startBeat: 0, endBeat: 8 });
    await expect(page.locator(".nbplay-timeline-loop")).toHaveAttribute(
      "style",
      /width: 50%/,
    );

    await page.locator(".nbplay-timeline-loop-btn").click();
    loop = await page.evaluate(
      () => globalThis.__nbplay["tracking-session"].clock.loop,
    );
    expect(loop.enabled).toBe(false);
    await expect(page.locator(".nbplay-timeline-loop")).toHaveCount(0);
  });

  test("zoom widens the lanes inside a shared scroll container", async ({
    page,
  }) => {
    await renderWidget(page, { length: 64 });
    await page.locator(".nbplay-timeline-zoom").fill("40");
    await page.locator(".nbplay-timeline-zoom").evaluate((input) => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const state = await page.evaluate(() => ({
      ppb: window.__testModel._state.pixels_per_beat,
      zoomed: document
        .querySelector(".nbplay-timeline-scroll")
        .classList.contains("zoomed"),
      laneWidth: document.querySelector(".nbplay-timeline-lane").style.width,
      rulerWidth: document.querySelector(".nbplay-timeline-ruler-track").style
        .width,
      scrollable:
        document.querySelector(".nbplay-timeline-scroll").scrollWidth >
        document.querySelector(".nbplay-timeline-scroll").clientWidth,
    }));
    expect(state.ppb).toBe(40);
    expect(state.zoomed).toBe(true);
    expect(state.laneWidth).toBe("2560px");
    expect(state.rulerWidth).toBe("2560px");
    expect(state.scrollable).toBe(true);
  });

  test("dragging a clip moves it on the beat grid and across lanes", async ({
    page,
  }) => {
    await renderWidget(page, {
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
    });
    const clip = page.locator(".nbplay-timeline-clip");
    const clipBox = await clip.boundingBox();
    const lanes = page.locator(".nbplay-timeline-lane");
    const laneBox = await lanes.first().boundingBox();
    const secondLaneBox = await lanes.nth(1).boundingBox();
    const beatPx = laneBox.width / 16;

    await page.mouse.move(
      clipBox.x + clipBox.width / 2,
      clipBox.y + clipBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      clipBox.x + clipBox.width / 2 + beatPx * 4,
      secondLaneBox.y + secondLaneBox.height / 2,
      { steps: 4 },
    );
    await page.mouse.up();

    const moved = await page.evaluate(() => window.__testModel._state.clips[0]);
    expect(moved.start).toBeCloseTo(4, 5);
    expect(moved.track_index).toBe(1);
    expect(moved.duration).toBe(4);
    expect(
      await page.evaluate(() => window.__testModel._state.selected_clip_id),
    ).toBe("clip-a");
  });

  test("trim handles change duration and keep the audio offset", async ({
    page,
  }) => {
    await renderWidget(page, {
      clips: [
        {
          id: "clip-a",
          name: "Take A",
          track_index: 0,
          start: 4,
          duration: 4,
          offset: 0,
          audio_url: "blob:clip-a",
        },
      ],
    });
    const laneBox = await page
      .locator(".nbplay-timeline-lane")
      .first()
      .boundingBox();
    const beatPx = laneBox.width / 16;

    const endHandle = page.locator(".nbplay-timeline-clip-handle.end");
    let box = await endHandle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + beatPx * 2, box.y + 5, {
      steps: 3,
    });
    await page.mouse.up();
    let clip = await page.evaluate(() => window.__testModel._state.clips[0]);
    expect(clip.duration).toBeCloseTo(6, 5);
    expect(clip.start).toBe(4);

    const startHandle = page.locator(".nbplay-timeline-clip-handle.start");
    box = await startHandle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + beatPx * 1, box.y + 5, {
      steps: 3,
    });
    await page.mouse.up();
    clip = await page.evaluate(() => window.__testModel._state.clips[0]);
    expect(clip.start).toBeCloseTo(5, 5);
    expect(clip.duration).toBeCloseTo(5, 5);
    expect(clip.offset).toBeCloseTo(1, 5);
  });

  test("duplicate places a copy right after the selected clip", async ({
    page,
  }) => {
    await renderWidget(page, {
      length: 8,
      clips: [
        {
          id: "clip-a",
          name: "Take A",
          track_index: 0,
          start: 2,
          duration: 4,
          audio_url: "blob:clip-a",
        },
      ],
      selected_clip_id: "clip-a",
    });
    await page.locator(".nbplay-timeline-duplicate").click();
    const state = await page.evaluate(() => ({
      clips: window.__testModel._state.clips.map((c) => [c.start, c.duration]),
      length: window.__testModel._state.length,
      selected: window.__testModel._state.selected_clip_id,
    }));
    expect(state.clips).toEqual([
      [2, 4],
      [6, 4],
    ]);
    expect(state.length).toBe(10);
    expect(state.selected).not.toBe("clip-a");
    await expect(page.locator(".nbplay-timeline-clip")).toHaveCount(2);
  });

  test("export sends a clip's bytes to the kernel", async ({ page }) => {
    await renderWidget(page, { clips: [] });
    await page.evaluate(() => {
      const url = URL.createObjectURL(
        new Blob(["hello-audio"], { type: "audio/webm" }),
      );
      const model = window.__testModel;
      model.set("clips", [
        {
          id: "clip-a",
          name: "Take A",
          track_index: 0,
          start: 0,
          duration: 4,
          audio_url: url,
        },
      ]);
      model._trigger("change:clips");
      model.set("export_clip_id", "clip-a");
      model._trigger("change:export_clip_id");
    });
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const data = window.__testModel._state.exported_clip_data;
          return data ? new TextDecoder().decode(data) : null;
        }),
      )
      .toBe("hello-audio");
    const state = await page.evaluate(() => ({
      exported: window.__testModel._state.exported_clip,
      requestCleared: window.__testModel._state.export_clip_id,
    }));
    expect(state.exported.id).toBe("clip-a");
    expect(state.exported.blob_size).toBe("hello-audio".length);
    expect(state.requestCleared).toBe("");
  });

  test("export of a clip without audio reports an error", async ({ page }) => {
    await renderWidget(page, {
      clips: [
        { id: "clip-a", name: "Empty", track_index: 0, start: 0, duration: 4 },
      ],
    });
    await page.evaluate(() => {
      window.__testModel.set("export_clip_id", "clip-a");
      window.__testModel._trigger("change:export_clip_id");
    });
    await expect(page.locator(".nbplay-timeline-status")).toHaveText(
      "Clip has no audio to export",
    );
  });

  test("import attaches kernel bytes to a clip and measures its length", async ({
    page,
  }) => {
    await renderWidget(page, {
      clips: [
        {
          id: "clip-imp",
          name: "Import",
          track_index: 0,
          start: 0,
          duration: 4,
          source: "import",
          blob_size: 5,
        },
      ],
    });
    await page.evaluate(() => {
      const model = window.__testModel;
      const bytes = new TextEncoder().encode("bytes");
      model.set("import_clip_data", new DataView(bytes.buffer));
      model._trigger("change:import_clip_data");
      model.set("import_clip_request", {
        id: "clip-imp",
        blob_type: "audio/wav",
        blob_size: 5,
        measure_duration: true,
      });
      model._trigger("change:import_clip_request");
    });
    await expect
      .poll(async () =>
        page.evaluate(() => window.__testModel._state.clips[0].audio_url),
      )
      .toMatch(/^blob:/);
    const state = await page.evaluate(() => ({
      clip: window.__testModel._state.clips[0],
      requestCleared: window.__testModel._state.import_clip_request,
    }));
    // The mock decoder returns 1024 samples at 44100 Hz: 0.0232 s at 120 BPM
    // is below the minimum clip length, so it clamps to a quarter beat.
    expect(state.clip.duration).toBeCloseTo(0.25, 5);
    expect(state.clip.blob_type).toBe("audio/wav");
    expect(state.requestCleared).toEqual({});
  });
});
