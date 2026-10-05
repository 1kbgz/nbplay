import { test, expect } from "@playwright/test";

// MIDI clips: record note events from the keyboards into a lane, play them
// back through the lane's sampler or a built-in oscillator.

const SESSION_ID = "midi-session";

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
      name: "Keys",
      channel_index: 0,
      armed: true,
      muted: false,
      solo: false,
      input: "midi",
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

function midiClip(events, extra = {}) {
  return {
    id: "clip-midi",
    kind: "midi",
    name: "Riff",
    track_index: 0,
    start: 0,
    duration: 4,
    events,
    ...extra,
  };
}

test.describe("MIDI clips", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  test("records note events into a MIDI clip without a media recorder", async ({
    page,
  }) => {
    await page.evaluate(() => {
      delete window.MediaRecorder;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: undefined,
      });
    });
    await renderWidget(page, { bpm: 6000 });
    await page.locator(".nbplay-timeline-record").click();
    await expect
      .poll(async () =>
        page.evaluate(() => window.__testModel._state.is_recording),
      )
      .toBe(true);

    await page.evaluate(() => {
      const send = (detail) =>
        document.dispatchEvent(new CustomEvent("nbplay-note", { detail }));
      send({ note: 60, velocity: 100, type: "on" });
      send({ note: 64, velocity: 80, type: "on" });
    });
    await page.waitForTimeout(60);
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent("nbplay-note", {
          detail: { note: 60, velocity: 0, type: "off" },
        }),
      );
    });
    await page.locator(".nbplay-timeline-record").click();

    const state = await page.evaluate(() => ({
      clips: window.__testModel._state.clips,
      recording: window.__testModel._state.is_recording,
    }));
    expect(state.recording).toBe(false);
    expect(state.clips).toHaveLength(1);
    const clip = state.clips[0];
    expect(clip.kind).toBe("midi");
    expect(clip.track_index).toBe(0);
    expect(clip.events.map((e) => e.note)).toEqual([60, 64]);
    expect(clip.events[0].velocity).toBe(100);
    expect(clip.events[0].duration).toBeGreaterThan(0.5);
    // The held note was closed at the stop point.
    expect(clip.events[1].duration).toBeGreaterThanOrEqual(
      clip.events[0].duration,
    );
    await expect(page.locator(".nbplay-timeline-clip.midi")).toHaveCount(1);
    await expect(page.locator(".nbplay-timeline-clip small")).toContainText(
      "2 notes",
    );
  });

  test("plays a MIDI clip through the lane's sampler on the session bus", async ({
    page,
  }) => {
    await renderWidget(page, {
      bpm: 600,
      clips: [
        midiClip([
          { beat: 0, duration: 0.5, note: 60, velocity: 100 },
          { beat: 1, duration: 0.5, note: 67, velocity: 90 },
        ]),
      ],
    });
    await page.evaluate((sessionId) => {
      const ctx = new AudioContext();
      const bus = (window.__nbplay = window.__nbplay || {});
      window.__triggers = [];
      window.__releases = [];
      bus[sessionId] = {
        ...bus[sessionId],
        audioCtx: ctx,
        masterGain: ctx.createGain(),
        channels: [{ gain: ctx.createGain() }],
        samplers: {
          0: {
            triggerNote: (note, velocity) =>
              window.__triggers.push([note, velocity]),
            releaseNote: (note) => window.__releases.push(note),
          },
        },
      };
    }, SESSION_ID);

    await page.locator(".nbplay-timeline-play").click();
    await expect
      .poll(async () => page.evaluate(() => window.__triggers), {
        timeout: 2000,
      })
      .toEqual([
        [60, 100],
        [67, 90],
      ]);
    await expect
      .poll(async () => page.evaluate(() => window.__releases), {
        timeout: 2000,
      })
      .toEqual([60, 67]);
  });

  test("prefers the lane's bus instrument and cancels unsounded notes on stop", async ({
    page,
  }) => {
    await renderWidget(page, {
      bpm: 60,
      clips: [
        midiClip([
          { beat: 0, duration: 0.5, note: 60, velocity: 100 },
          { beat: 3, duration: 0.5, note: 67, velocity: 90 },
        ]),
      ],
    });
    await page.evaluate((sessionId) => {
      const ctx = new AudioContext();
      const bus = (window.__nbplay = window.__nbplay || {});
      window.__scheduled = [];
      window.__cancelled = [];
      window.__triggers = [];
      bus[sessionId] = {
        ...bus[sessionId],
        audioCtx: ctx,
        masterGain: ctx.createGain(),
        channels: [{ gain: ctx.createGain() }],
        samplers: {
          0: {
            triggerNote: (note) => window.__triggers.push(note),
            releaseNote: () => {},
          },
        },
        instruments: {
          0: {
            scheduleNote(note, velocity, at, duration) {
              window.__scheduled.push({ note, velocity, at, duration });
              return () => window.__cancelled.push(note);
            },
          },
        },
      };
    }, SESSION_ID);

    await page.locator(".nbplay-timeline-play").click();
    await expect
      .poll(async () => page.evaluate(() => window.__scheduled.length), {
        timeout: 2000,
      })
      .toBeGreaterThanOrEqual(1);
    const first = await page.evaluate(() => window.__scheduled[0]);
    expect(first.note).toBe(60);
    expect(first.velocity).toBe(100);
    expect(first.duration).toBeCloseTo(0.5, 6);
    expect(await page.evaluate(() => window.__triggers)).toEqual([]);

    // The note at beat 3 is still in the future at 60 BPM: stopping (the
    // play button toggles) cancels it.
    await page.waitForFunction(() => window.__scheduled.length >= 2);
    await page.locator(".nbplay-timeline-play").click();
    expect(await page.evaluate(() => window.__cancelled)).toContain(67);
  });

  test("falls back to an oscillator when the lane has no sampler", async ({
    page,
  }) => {
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
    await renderWidget(page, {
      bpm: 600,
      clips: [
        midiClip([{ beat: 0.5, duration: 0.25, note: 69, velocity: 127 }]),
      ],
    });
    await page.locator(".nbplay-timeline-play").click();
    await expect
      .poll(async () => page.evaluate(() => window.__oscStarts.length), {
        timeout: 2000,
      })
      .toBe(1);
    const start = await page.evaluate(() => window.__oscStarts[0]);
    expect(start.freq).toBeCloseTo(440, 3);
  });

  test("muted MIDI clips and clip offsets are respected", async ({ page }) => {
    await page.evaluate(() => {
      const BaseAudioContext = window.AudioContext;
      window.__oscStarts = [];
      class RecordingAudioContext extends BaseAudioContext {
        createOscillator() {
          const osc = super.createOscillator();
          const start = osc.start.bind(osc);
          osc.start = (time) => {
            window.__oscStarts.push(osc.frequency.value);
            start(time);
          };
          return osc;
        }
      }
      window.AudioContext = RecordingAudioContext;
      window.webkitAudioContext = RecordingAudioContext;
    });
    await renderWidget(page, {
      bpm: 600,
      clips: [
        midiClip(
          [
            { beat: 0, duration: 0.25, note: 60, velocity: 100 },
            { beat: 1, duration: 0.25, note: 69, velocity: 100 },
          ],
          { offset: 1, duration: 1 },
        ),
        midiClip([{ beat: 0, duration: 0.25, note: 72, velocity: 100 }], {
          id: "clip-muted",
          muted: true,
        }),
      ],
    });
    await page.locator(".nbplay-timeline-play").click();
    await page.waitForTimeout(400);
    const starts = await page.evaluate(() => window.__oscStarts);
    // Only the note after the trimmed offset plays; the muted clip is silent.
    expect(starts).toHaveLength(1);
    expect(starts[0]).toBeCloseTo(440, 3);
  });

  test("input selector offers MIDI", async ({ page }) => {
    await renderWidget(page, {
      tracks: [{ ...DEFAULTS.tracks[0], input: "microphone" }],
    });
    const select = page.locator(".nbplay-track-input").first();
    await select.selectOption("midi");
    expect(
      await page.evaluate(() => window.__testModel._state.tracks[0].input),
    ).toBe("midi");
  });
});
