import { test, expect } from "@playwright/test";

const DEFAULTS = {
  session_id: "timeline-session",
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
  length: 16,
  current_beat: 0,
  selected_clip_id: "",
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
    {
      name: "Guitar",
      channel_index: 1,
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
      recorded: true,
      muted: false,
      loop: false,
      audio_url: "blob:clip-a",
      blob_type: "audio/webm",
      source: "recording",
      sample_rate: 44100,
    },
  ],
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

async function installMediaRecorderMock(page) {
  await page.evaluate(() => {
    window.__stoppedTracks = 0;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [
            {
              stop: () => {
                window.__stoppedTracks += 1;
              },
            },
          ],
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

test.describe("TimelineWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  test("renders timeline container and header", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-timeline")).toBeVisible();
    await expect(page.locator(".nbplay-timeline-header h3")).toHaveText(
      "nbplay",
    );
    await expect(page.locator(".nbplay-badge")).toHaveText("timeline");
  });

  test("renders tracks and clips", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-timeline-row")).toHaveCount(2);
    await expect(
      page.locator(".nbplay-timeline-track-name").first(),
    ).toHaveText("Vocals");
    await expect(page.locator(".nbplay-timeline-clip")).toHaveCount(1);
    await expect(page.locator(".nbplay-timeline-clip span")).toHaveText(
      "Take A",
    );
  });

  test("toggles track buttons into model state", async ({ page }) => {
    await renderWidget(page);
    const row = page.locator(".nbplay-timeline-row").first();
    await row.locator(".nbplay-track-arm").click();
    await row.locator(".nbplay-track-mute").click();
    await row.locator(".nbplay-track-solo").click();

    const state = await page.evaluate(
      () => window.__testModel._state.tracks[0],
    );
    expect(state.armed).toBe(true);
    expect(state.muted).toBe(true);
    expect(state.solo).toBe(true);
  });

  test("selects and deletes a clip", async ({ page }) => {
    await renderWidget(page);
    await page.locator(".nbplay-timeline-clip").click();
    expect(
      await page.evaluate(() => window.__testModel._state.selected_clip_id),
    ).toBe("clip-a");

    await page.locator(".nbplay-timeline-delete").click();
    expect(await page.evaluate(() => window.__testModel._state.clips)).toEqual(
      [],
    );
  });

  test("record button reports browser microphone fallback", async ({
    page,
  }) => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: undefined,
      });
      delete window.MediaRecorder;
    });
    await renderWidget(page);
    await page.locator(".nbplay-timeline-record").click();

    const state = await page.evaluate(() => ({
      is_recording: window.__testModel._state.is_recording,
      recording_track: window.__testModel._state.recording_track,
      recording_error: window.__testModel._state.recording_error,
    }));
    expect(state.is_recording).toBe(false);
    expect(state.recording_track).toBe(-1);
    expect(state.recording_error).toContain(
      "Microphone recording is unavailable",
    );
  });

  test("records a mocked clip into the timeline", async ({ page }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page, {
      clips: [],
      tracks: [{ ...DEFAULTS.tracks[0], armed: true }],
    });

    await page.locator(".nbplay-timeline-record").click();
    await expect(page.locator(".nbplay-timeline-record")).toHaveText(
      "Stop Rec",
    );
    expect(
      await page.evaluate(() => window.__testModel._state.is_recording),
    ).toBe(true);

    await page.locator(".nbplay-timeline-record").click();
    await expect(page.locator(".nbplay-timeline-clip")).toHaveCount(1);

    const state = await page.evaluate(() => ({
      clip: window.__testModel._state.clips[0],
      recorded_clip: window.__testModel._state.recorded_clip,
      is_recording: window.__testModel._state.is_recording,
      recording_track: window.__testModel._state.recording_track,
      stoppedTracks: window.__stoppedTracks,
    }));
    expect(state.clip.recorded).toBe(true);
    expect(state.clip.audio_url).toContain("blob:");
    expect(state.recorded_clip.id).toBe(state.clip.id);
    expect(state.is_recording).toBe(false);
    expect(state.recording_track).toBe(-1);
    expect(state.stoppedTracks).toBe(1);
  });

  test("cancels a pending microphone request without leaking a stream", async ({
    page,
  }) => {
    await installMediaRecorderMock(page);
    await page.evaluate(() => {
      window.__getUserMediaCalls = 0;
      window.__resolveUserMedia = [];
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () => {
            window.__getUserMediaCalls += 1;
            return new Promise((resolve) => {
              window.__resolveUserMedia.push(() =>
                resolve({
                  getTracks: () => [
                    {
                      stop: () => {
                        window.__stoppedTracks += 1;
                      },
                    },
                  ],
                }),
              );
            });
          },
        },
      });
    });
    await renderWidget(page, {
      clips: [],
      tracks: [{ ...DEFAULTS.tracks[0], armed: true }],
    });

    await page.locator(".nbplay-timeline-record").click();
    await expect(page.locator(".nbplay-timeline-record")).toHaveText(
      "Stop Rec",
    );
    await page.locator(".nbplay-timeline-record").click();

    expect(await page.evaluate(() => window.__getUserMediaCalls)).toBe(1);
    expect(
      await page.evaluate(() => window.__testModel._state.is_recording),
    ).toBe(false);

    await page.evaluate(() => window.__resolveUserMedia[0]());
    await expect
      .poll(async () => page.evaluate(() => window.__stoppedTracks))
      .toBe(1);
    expect(await page.evaluate(() => window.__testModel._state.clips)).toEqual(
      [],
    );
  });

  test("ignores stale microphone rejection after cancel and restart", async ({
    page,
  }) => {
    await installMediaRecorderMock(page);
    await page.evaluate(() => {
      window.__getUserMediaCalls = 0;
      window.__resolveUserMedia = [];
      window.__rejectUserMedia = [];
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () => {
            window.__getUserMediaCalls += 1;
            return new Promise((resolve, reject) => {
              window.__resolveUserMedia.push(() =>
                resolve({
                  getTracks: () => [
                    {
                      stop: () => {
                        window.__stoppedTracks += 1;
                      },
                    },
                  ],
                }),
              );
              window.__rejectUserMedia.push(() =>
                reject(new Error("late denied")),
              );
            });
          },
        },
      });
    });
    await renderWidget(page, {
      clips: [],
      tracks: [{ ...DEFAULTS.tracks[0], armed: true }],
    });

    await page.locator(".nbplay-timeline-record").click();
    await page.locator(".nbplay-timeline-record").click();
    await page.locator(".nbplay-timeline-record").click();
    expect(await page.evaluate(() => window.__getUserMediaCalls)).toBe(2);

    await page.evaluate(() => window.__resolveUserMedia[1]());
    await expect
      .poll(
        async () =>
          page.evaluate(() => ({
            isRecording: window.__testModel._state.is_recording,
            recordingTrack: window.__testModel._state.recording_track,
          })),
        { timeout: 1000 },
      )
      .toEqual({ isRecording: true, recordingTrack: 0 });

    await page.evaluate(() => window.__rejectUserMedia[0]());
    await page.waitForTimeout(25);
    const state = await page.evaluate(() => ({
      isRecording: window.__testModel._state.is_recording,
      recordingError: window.__testModel._state.recording_error,
      stoppedTracks: window.__stoppedTracks,
    }));
    expect(state.isRecording).toBe(true);
    expect(state.recordingError).toBe("");
    expect(state.stoppedTracks).toBe(0);

    await page.locator(".nbplay-timeline-record").click();
    await expect(page.locator(".nbplay-timeline-clip")).toHaveCount(1);
    expect(await page.evaluate(() => window.__stoppedTracks)).toBe(1);
  });

  test("places recorded clip at record-start beat", async ({ page }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page, {
      clips: [],
      current_beat: 2,
      tracks: [{ ...DEFAULTS.tracks[0], armed: true }],
    });

    await page.locator(".nbplay-timeline-record").click();
    await page.evaluate(() => {
      window.__testModel.set("current_beat", 3.5);
    });
    await page.locator(".nbplay-timeline-record").click();

    const clip = await page.evaluate(() => window.__testModel._state.clips[0]);
    expect(clip.start).toBe(2);
  });

  test("recording starts playback so the playhead moves", async ({ page }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page, {
      bpm: 6000,
      clips: [],
      length: 100,
      tracks: [{ ...DEFAULTS.tracks[0], armed: true }],
    });

    await page.locator(".nbplay-timeline-record").click();
    await page.waitForTimeout(160);

    const state = await page.evaluate(() => ({
      isPlaying: window.__testModel._state.is_playing,
      isRecording: window.__testModel._state.is_recording,
      playheadLeft: Number.parseFloat(
        document
          .querySelector(".nbplay-timeline-playhead")
          .getAttribute("style")
          .match(/left:\s*([\d.]+)%/)?.[1] || "0",
      ),
    }));
    expect(state.isPlaying).toBe(true);
    expect(state.isRecording).toBe(true);
    expect(state.playheadLeft).toBeGreaterThan(0);
  });

  test("count-in pre-roll records at the chosen playhead", async ({ page }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page, {
      bpm: 6000,
      clips: [],
      count_in_bars: 1,
      current_beat: 4,
      length: 100,
      tracks: [{ ...DEFAULTS.tracks[0], armed: true }],
    });

    await page.locator(".nbplay-timeline-record").click();
    await expect
      .poll(
        async () =>
          page.evaluate(() => ({
            isRecording: window.__testModel._state.is_recording,
            recordingTrack: window.__testModel._state.recording_track,
            countdown: window.__testModel._state.recording_countdown_beats || 0,
          })),
        { timeout: 1000 },
      )
      .toEqual({ isRecording: true, recordingTrack: 0, countdown: 0 });

    await page.locator(".nbplay-timeline-record").click();

    const state = await page.evaluate(() => ({
      clip: window.__testModel._state.clips[0],
      currentBeat: window.__testModel._state.current_beat,
    }));
    expect(state.currentBeat).toBe(0);
    expect(state.clip.start).toBe(4);
  });

  test("input monitoring routes live microphone to the mixer bus", async ({
    page,
  }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page, {
      clips: [],
      tracks: [{ ...DEFAULTS.tracks[0], armed: true, monitor: true }],
    });
    await page.evaluate(() => {
      const ctx = new AudioContext();
      const channelGain = ctx.createGain();
      window.__nbplay = {
        "timeline-session": {
          audioCtx: ctx,
          channels: [{ gain: channelGain }],
          masterGain: ctx.createGain(),
        },
      };
      window.__testChannelGain = channelGain;
    });

    await page.locator(".nbplay-timeline-record").click();

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const source = window.__mediaStreamSources?.[0];
            return {
              sourceCount: window.__mediaStreamSources?.length || 0,
              connectedToChannel:
                source?.connections?.[0] === window.__testChannelGain,
            };
          }),
        { timeout: 1000 },
      )
      .toEqual({ sourceCount: 1, connectedToChannel: true });
  });

  test("moves playhead from current_beat", async ({ page }) => {
    await renderWidget(page, { current_beat: 4, length: 16 });

    await expect(
      page.locator(".nbplay-timeline-playhead").first(),
    ).toHaveAttribute("style", /left: 25%;/);
  });

  test("clicking and dragging timeline seeks the shared playhead", async ({
    page,
  }) => {
    await renderWidget(page, { clips: [], current_beat: 0, length: 16 });

    const ruler = page.locator(".nbplay-timeline-ruler-track");
    const rulerBox = await ruler.boundingBox();
    expect(rulerBox).not.toBeNull();
    await page.mouse.click(
      rulerBox.x + rulerBox.width * 0.5,
      rulerBox.y + rulerBox.height / 2,
    );
    expect(
      await page.evaluate(() => window.__testModel._state.current_beat),
    ).toBeCloseTo(8, 1);

    await page.evaluate(() => {
      window.__testModel._history.length = 0;
    });
    const lane = page.locator(".nbplay-timeline-lane").first();
    const laneBox = await lane.boundingBox();
    expect(laneBox).not.toBeNull();
    await page.mouse.move(laneBox.x + laneBox.width * 0.25, laneBox.y + 12);
    await page.mouse.down();
    await page.mouse.move(laneBox.x + laneBox.width * 0.75, laneBox.y + 12);
    await page.mouse.up();

    const state = await page.evaluate(() => ({
      currentBeat: window.__testModel._state.current_beat,
      saves: window.__testModel._history.filter(
        (entry) => entry.type === "save",
      ).length,
    }));
    expect(state.currentBeat).toBeCloseTo(12, 1);
    expect(state.saves).toBe(1);
  });

  test("recorded clip duration follows playhead when bpm changes before stop", async ({
    page,
  }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page, {
      bpm: 6000,
      clips: [],
      length: 100,
      tracks: [{ ...DEFAULTS.tracks[0], armed: true }],
    });

    await page.locator(".nbplay-timeline-record").click();
    await page.waitForTimeout(180);
    await page.evaluate(() => {
      window.__testModel.set("bpm", 60);
    });
    await page.locator(".nbplay-timeline-record").click();

    const clip = await page.evaluate(() => window.__testModel._state.clips[0]);
    expect(clip.duration).toBeGreaterThan(5);
    expect(clip.duration).toBeLessThan(50);
  });

  test("reset button returns playhead to start", async ({ page }) => {
    await renderWidget(page, { current_beat: 6, length: 16 });

    await page.locator(".nbplay-timeline-reset").click();

    expect(
      await page.evaluate(() => window.__testModel._state.current_beat),
    ).toBe(0);
    await expect(
      page.locator(".nbplay-timeline-playhead").first(),
    ).toHaveAttribute("style", /left: 0%;/);
  });

  test("ruler and track playheads share the same horizontal origin", async ({
    page,
  }) => {
    await renderWidget(page, { current_beat: 4, length: 16 });

    const boxes = await page.evaluate(() => {
      const ruler = document
        .querySelector(".nbplay-timeline-ruler-track")
        .getBoundingClientRect();
      const lane = document
        .querySelector(".nbplay-timeline-lane")
        .getBoundingClientRect();
      return {
        leftDiff: Math.abs(ruler.left - lane.left),
        widthDiff: Math.abs(ruler.width - lane.width),
      };
    });
    expect(boxes.leftDiff).toBeLessThanOrEqual(1);
    expect(boxes.widthDiff).toBeLessThanOrEqual(1);
  });

  test("bars input extends the timeline beyond four bars", async ({ page }) => {
    await renderWidget(page, { length: 16 });

    await page.locator(".nbplay-timeline-bars").fill("12");
    await page.locator(".nbplay-timeline-bars").evaluate((input) => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(await page.evaluate(() => window.__testModel._state.length)).toBe(
      48,
    );
    await expect(page.locator(".nbplay-timeline-ruler-track span")).toHaveCount(
      12,
    );
  });

  test("auto-extends timeline while recording near the end", async ({
    page,
  }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page, {
      bpm: 6000,
      clips: [],
      length: 4,
      recording_extend_bars: 2,
      tracks: [{ ...DEFAULTS.tracks[0], armed: true }],
    });

    await page.locator(".nbplay-timeline-record").click();
    await expect
      .poll(
        async () =>
          page.evaluate(() => ({
            extended: window.__testModel._state.length > 4,
            isRecording: window.__testModel._state.is_recording,
            isPlaying: window.__testModel._state.is_playing,
          })),
        { timeout: 1000 },
      )
      .toEqual({ extended: true, isRecording: true, isPlaying: true });

    await page.locator(".nbplay-timeline-record").click();
    await expect(page.locator(".nbplay-timeline-clip")).toHaveCount(1);
  });

  test("can disable recording auto-extension at timeline end", async ({
    page,
  }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page, {
      auto_extend_recording: false,
      bpm: 6000,
      clips: [],
      length: 1,
      tracks: [{ ...DEFAULTS.tracks[0], armed: true }],
    });

    await page.locator(".nbplay-timeline-record").click();
    await expect
      .poll(
        async () =>
          page.evaluate(() => ({
            length: window.__testModel._state.length,
            isRecording: window.__testModel._state.is_recording,
          })),
        { timeout: 1000 },
      )
      .toEqual({ length: 1, isRecording: false });
    await expect(page.locator(".nbplay-timeline-clip")).toHaveCount(1);
  });

  test("auto-extension controls update model state", async ({ page }) => {
    await renderWidget(page);

    await page.locator(".nbplay-timeline-auto-extend").uncheck();
    await page.locator(".nbplay-timeline-extend-bars").fill("16");
    await page.locator(".nbplay-timeline-extend-bars").evaluate((input) => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const state = await page.evaluate(() => ({
      autoExtend: window.__testModel._state.auto_extend_recording,
      extendBars: window.__testModel._state.recording_extend_bars,
    }));
    expect(state).toEqual({ autoExtend: false, extendBars: 16 });
  });

  test("playhead playback animation does not write current_beat every tick", async ({
    page,
  }) => {
    await renderWidget(page, { bpm: 6000, current_beat: 0, length: 100 });

    await page.evaluate(() => {
      window.__testModel._history.length = 0;
    });
    await page.locator(".nbplay-timeline-play").click();
    await page.waitForTimeout(160);

    const state = await page.evaluate(() => ({
      left: Number.parseFloat(
        document
          .querySelector(".nbplay-timeline-playhead")
          .getAttribute("style")
          .match(/left:\s*([\d.]+)%/)?.[1] || "0",
      ),
      currentBeatWrites: window.__testModel._history.filter(
        (entry) => entry.key === "current_beat",
      ).length,
    }));
    expect(state.left).toBeGreaterThan(0);
    expect(state.currentBeatWrites).toBe(0);
  });

  test("external current_beat sync does not restart playback", async ({
    page,
  }) => {
    await renderWidget(page, { bpm: 600, current_beat: 0, length: 100 });
    await page.locator(".nbplay-timeline-play").click();

    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__mediaElementSources?.length || 0),
        { timeout: 1000 },
      )
      .toBe(1);

    await page.evaluate(() => {
      window.__testModel.set("current_beat", 4);
      window.__testModel.save_changes();
    });
    await page.waitForTimeout(60);

    const state = await page.evaluate(() => ({
      sourceCount: window.__mediaElementSources?.length || 0,
      isPlaying: window.__testModel._state.is_playing,
    }));
    expect(state.sourceCount).toBe(1);
    expect(state.isPlaying).toBe(true);
  });

  test("length changes during recording do not restart playback", async ({
    page,
  }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page, {
      bpm: 600,
      tracks: [{ ...DEFAULTS.tracks[0], armed: true }],
    });
    await page.locator(".nbplay-timeline-record").click();

    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__mediaElementSources?.length || 0),
        { timeout: 1000 },
      )
      .toBe(1);

    await page.evaluate(() => {
      window.__testModel.set("length", 64);
      window.__testModel.save_changes();
    });
    await page.waitForTimeout(60);

    const state = await page.evaluate(() => ({
      sourceCount: window.__mediaElementSources?.length || 0,
      isRecording: window.__testModel._state.is_recording,
      length: window.__testModel._state.length,
    }));
    expect(state.sourceCount).toBe(1);
    expect(state.isRecording).toBe(true);
    expect(state.length).toBe(64);

    await page.locator(".nbplay-timeline-record").click();
  });

  test("external record state starts and stops recording", async ({ page }) => {
    await installMediaRecorderMock(page);
    await renderWidget(page, {
      clips: [],
      tracks: [{ ...DEFAULTS.tracks[0], armed: true }],
    });

    await page.evaluate(() => {
      window.__testModel.set("is_recording", true);
      window.__testModel.save_changes();
    });
    await expect(page.locator(".nbplay-timeline-record")).toHaveText(
      "Stop Rec",
    );

    await page.evaluate(() => {
      window.__testModel.set("is_recording", false);
      window.__testModel.save_changes();
    });
    await expect(page.locator(".nbplay-timeline-clip")).toHaveCount(1);
  });

  test("stops and flushes playhead at timeline end", async ({ page }) => {
    await renderWidget(page, {
      bpm: 6000,
      length: 1,
      current_beat: 0,
      clips: [],
    });

    await page.locator(".nbplay-timeline-play").click();
    await expect
      .poll(
        async () => page.evaluate(() => window.__testModel._state.is_playing),
        { timeout: 1000 },
      )
      .toBe(false);

    const state = await page.evaluate(() => ({
      isPlaying: window.__testModel._state.is_playing,
      currentBeat: window.__testModel._state.current_beat,
    }));
    expect(state.isPlaying).toBe(false);
    expect(state.currentBeat).toBe(1);
  });

  test("routes clip playback through session mixer bus when available", async ({
    page,
  }) => {
    await renderWidget(page);
    await page.evaluate(() => {
      const ctx = new AudioContext();
      const channelGain = ctx.createGain();
      window.__nbplay = {
        "timeline-session": {
          audioCtx: ctx,
          channels: [{ gain: channelGain }],
          masterGain: ctx.createGain(),
        },
      };
      window.__testChannelGain = channelGain;
    });

    await page.locator(".nbplay-timeline-play").click();
    await page.waitForTimeout(25);

    const routed = await page.evaluate(() => {
      const source = window.__mediaElementSources?.[0];
      return {
        sourceCount: window.__mediaElementSources?.length || 0,
        connectedToChannel:
          source?.connections?.[0] === window.__testChannelGain,
        isPlaying: window.__testModel._state.is_playing,
      };
    });
    expect(routed.sourceCount).toBe(1);
    expect(routed.connectedToChannel).toBe(true);
    expect(routed.isPlaying).toBe(true);
  });
});
