import { test, expect } from "@playwright/test";

const DEFAULTS = {
  order: "up",
  octaves: 1,
  step_duration: 0.25,
  gate: 0.5,
  swing: 0,
  latch: false,
  bpm: 120,
  session_id: "arp",
  channel_index: 0,
  held_notes: [],
};

/** A session bus whose track 0 instrument records the notes it is asked to play. */
async function installBus(page) {
  await page.evaluate(() => {
    window.__played = [];
    window.__heard = [];
    globalThis.__nbplay = {
      arp: {
        instruments: {
          0: {
            scheduleNote: (note, velocity, at, duration) =>
              window.__played.push({ note, velocity, at, duration }),
          },
        },
        noteListeners: [(evt) => window.__heard.push(evt.note)],
      },
    };
  });
}

async function renderArp(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/components.css";
      document.head.appendChild(link);
      const mod = await import("/dist/tests/instruments.js");
      const model = window.createMockModel({ ...opts });
      window.__testModel = model;
      mod.render("arpeggiator", { model, el: document.getElementById("root") });
    },
    { ...DEFAULTS, ...overrides },
  );
}

const state = (page) => page.evaluate(() => window.__testModel._state);

test.describe("arpNotes", () => {
  test("orders the held notes across octaves", async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
    const cycles = await page.evaluate(async () => {
      const { arpNotes } = await window.__components;
      // Played E, C, G.
      const held = [
        { note: 64, velocity: 90 },
        { note: 60, velocity: 100 },
        { note: 67, velocity: 80 },
      ];
      const notes = (order, octaves = 1) =>
        arpNotes(held, order, octaves).map((n) => n.note);
      return {
        up: notes("up"),
        down: notes("down"),
        updown: notes("updown"),
        played: notes("played"),
        upTwo: notes("up", 2),
        single: arpNotes([{ note: 60, velocity: 1 }], "updown", 1).map(
          (n) => n.note,
        ),
        velocity: arpNotes(held, "up", 1)[0].velocity,
      };
    });
    expect(cycles).toEqual({
      up: [60, 64, 67],
      down: [67, 64, 60],
      // The ends are not repeated at the turns.
      updown: [60, 64, 67, 64],
      played: [64, 60, 67],
      upTwo: [60, 64, 67, 72, 76, 79],
      single: [60],
      velocity: 100,
    });
  });
});

test.describe("ArpeggiatorWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
    await installBus(page);
  });

  test("held notes play one step at a time on the track's instrument", async ({
    page,
  }) => {
    await renderArp(page);
    const release = await page.evaluate(() => {
      const input = globalThis.__nbplay.arp.inputs[0];
      window.__releases = [input.startNote(64, 90), input.startNote(60, 100)];
      return typeof window.__releases[0];
    });
    expect(release).toBe("function");
    expect((await state(page)).held_notes).toEqual([64, 60]);
    await expect
      .poll(() => page.evaluate(() => window.__played.length))
      .toBeGreaterThanOrEqual(4);
    const played = await page.evaluate(() => window.__played.slice(0, 4));
    // Up: C, E, C, E with each note's own velocity, a sixteenth apart at
    // 120 BPM, sounding for half a step.
    expect(played.map((p) => [p.note, p.velocity])).toEqual([
      [60, 100],
      [64, 90],
      [60, 100],
      [64, 90],
    ]);
    for (let i = 1; i < 4; i++)
      expect(played[i].at - played[i - 1].at).toBeCloseTo(0.125, 3);
    expect(played[0].duration).toBeCloseTo(0.0625, 4);
    // What it plays is what the session hears.
    expect(await page.evaluate(() => window.__heard.slice(0, 2))).toEqual([
      60, 64,
    ]);
    // Releasing every key stops it.
    await page.evaluate(() => window.__releases.forEach((r) => r()));
    expect((await state(page)).held_notes).toEqual([]);
    const count = await page.evaluate(() => window.__played.length);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__played.length)).toBe(count);
  });

  test("latch keeps the notes after release until a new chord", async ({
    page,
  }) => {
    await renderArp(page, { latch: true });
    await page.evaluate(() => {
      const input = globalThis.__nbplay.arp.inputs[0];
      input.startNote(60, 100)();
      input.startNote(64, 100)();
    });
    // Each key was released before the next went down: a new chord each time.
    expect((await state(page)).held_notes).toEqual([64]);
    await page.evaluate(() => {
      const input = globalThis.__nbplay.arp.inputs[0];
      const a = input.startNote(48, 100);
      const b = input.startNote(55, 100);
      a();
      b();
    });
    expect((await state(page)).held_notes).toEqual([48, 55]);
    const count = await page.evaluate(() => window.__played.length);
    await expect
      .poll(() => page.evaluate(() => window.__played.length))
      .toBeGreaterThan(count + 1);
    // Latch off with no keys down lets them go.
    await page.locator(".nbplay-arp-latch button").click();
    expect((await state(page)).latch).toBe(false);
    expect((await state(page)).held_notes).toEqual([]);
  });

  test("the editor writes the settings", async ({ page }) => {
    await renderArp(page);
    await page.locator('.nbplay-arp-order [data-value="updown"]').click();
    await page.locator('.nbplay-arp-octaves [data-value="3"]').click();
    await page.locator(".nbplay-arp-rate").selectOption("1/8");
    await page.evaluate(() =>
      document
        .querySelector(".nbplay-arp-gate")
        .dispatchEvent(
          new CustomEvent("change", { detail: { value: 0.8 }, bubbles: true }),
        ),
    );
    const s = await state(page);
    expect([s.order, s.octaves, s.step_duration, s.gate]).toEqual([
      "updown",
      3,
      0.5,
      0.8,
    ]);
    await expect(page.locator(".nbplay-arp-idle")).toBeVisible();
  });

  test("a keyboard on the arpeggiator's track plays into it", async ({
    page,
  }) => {
    await renderArp(page);
    await page.evaluate(async () => {
      const mod = await import("/dist/tests/instruments.js");
      const el = document.createElement("div");
      document.body.appendChild(el);
      const model = window.createMockModel({
        upper_octave: 3,
        lower_octave: 4,
        velocity: 100,
        active_notes: [],
        sustain_upper: false,
        sustain_lower: false,
        sustain_global: false,
        last_note_event: {},
        session_id: "arp",
        channel_index: 0,
        sampler_routing: [],
      });
      mod.render("keyboard", { model, el });
    });
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "q" });
    expect((await state(page)).held_notes).toEqual([48]);
    // The key is heard as the arpeggio, not as itself.
    await expect
      .poll(() => page.evaluate(() => window.__played.length))
      .toBeGreaterThan(0);
    await kb.dispatchEvent("keyup", { key: "q" });
    expect((await state(page)).held_notes).toEqual([]);
  });
});
