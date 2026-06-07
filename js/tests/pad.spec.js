import { test, expect } from "@playwright/test";

// Shared defaults

const DEFAULTS = {
  rows: 4,
  cols: 4,
  velocity: 100,
  velocity_sensitive: true,
  pad_notes: Array.from({ length: 16 }, (_, i) => 36 + i),
  pad_velocities: Array.from({ length: 16 }, () => 100),
  pad_actions: [],
  active_pads: [],
  last_note_event: {},
  last_pad_event: {},
  session_id: "",
  channel_index: -1,
  sampler_routing: [],
};

async function renderWidget(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/pad.css";
      document.head.appendChild(link);

      const mod = await import("/dist/widgets/pad.js");
      const el = document.getElementById("root");
      const model = window.createMockModel({ ...opts });
      window.__testModel = model;
      mod.default.render({ model, el });
    },
    { ...DEFAULTS, ...overrides },
  );
}

// Tests

test.describe("PadWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // 1. Renders container
  test("renders .nbplay-pad container", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-pad")).toBeVisible();
  });

  // 2. Shows header with badge
  test("shows header and pads badge", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-pad-header h3")).toHaveText("nbplay");
    await expect(page.locator(".nbplay-badge")).toHaveText("pads");
  });

  // 3. Grid renders correct number of cells
  test("renders 4×4 grid by default", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-pad-cell")).toHaveCount(16);
  });

  // 4. Custom dimensions
  test("renders 2×8 grid", async ({ page }) => {
    await renderWidget(page, {
      rows: 2,
      cols: 8,
      pad_notes: Array.from({ length: 16 }, (_, i) => 36 + i),
    });
    await expect(page.locator(".nbplay-pad-cell")).toHaveCount(16);
  });

  test("clamps zero grid dimensions to one cell", async ({ page }) => {
    await renderWidget(page, {
      rows: 0,
      cols: 0,
      pad_notes: [36],
      pad_velocities: [100],
    });
    await expect(page.locator(".nbplay-pad-cell")).toHaveCount(1);
  });

  test("tap updates note state without Web Audio", async ({ page }) => {
    await page.evaluate(() => {
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
    });
    await renderWidget(page);

    const pad = page.locator(".nbplay-pad-cell").first();
    const box = await pad.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction(
      () => window.__testModel._state.last_note_event.note === 36,
    );

    const event = await page.evaluate(
      () => window.__testModel._state.last_note_event,
    );
    expect(event.note).toBe(36);
  });

  // 5. Pads show note names
  test("pads display note names", async ({ page }) => {
    await renderWidget(page, {
      pad_notes: [
        36, 38, 40, 41, 43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60, 62,
      ],
    });
    const firstLabel = page
      .locator(".nbplay-pad-cell .nbplay-pad-label")
      .first();
    await expect(firstLabel).toHaveText("C2");
  });

  // 6. Tapping a pad triggers and releases (one-shot drum-pad behavior)
  test("tap on pad triggers note and releases", async ({ page }) => {
    await renderWidget(page);
    const pad = page.locator(".nbplay-pad-cell").first();
    const box = await pad.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction(
      () => window.__testModel._state.last_note_event.note === 36,
    );
    const evt = await page.evaluate(
      () => window.__testModel._state.last_note_event,
    );
    // One-shot pads fire note-on then immediately note-off;
    // last_note_event ends as "off" with the note number preserved.
    expect(evt.note).toBe(36);
  });

  test("double-click note label opens edit without triggering pad", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const mockSampler = {
        triggered: [],
        triggerNote(n, v) {
          this.triggered.push({ note: n, velocity: v });
        },
        releaseNote() {},
      };
      globalThis.__nbplay = {
        "test-session": {
          audioCtx: new AudioContext(),
          channels: [{ gain: { connect() {} } }],
          samplers: { 0: mockSampler },
        },
      };
      window.__mockSampler = mockSampler;
    });

    await renderWidget(page, {
      session_id: "test-session",
      sampler_routing: [{ channel_index: 0, match: "all" }],
    });

    await page
      .locator(".nbplay-pad-cell")
      .first()
      .locator(".nbplay-pad-label")
      .dblclick();

    await expect(page.locator(".nbplay-pad-inline-edit")).toBeVisible();
    await page.waitForTimeout(350);

    const state = await page.evaluate(() => ({
      active: window.__testModel._state.active_pads,
      last: window.__testModel._state.last_note_event,
      triggered: window.__mockSampler.triggered,
    }));
    expect(state.active).toEqual([]);
    expect(state.last).toEqual({});
    expect(state.triggered).toEqual([]);
  });

  // 7. Velocity slider
  test("velocity slider changes model", async ({ page }) => {
    await renderWidget(page);
    await page.locator(".nbplay-pad-vel-slider").fill("50");
    const vel = await page.evaluate(() => window.__testModel._state.velocity);
    expect(vel).toBe(50);
  });

  test("velocity slider resets individual pad velocities", async ({ page }) => {
    await renderWidget(page);
    const pad = page.locator(".nbplay-pad-cell").first();
    await pad.dispatchEvent("wheel", { deltaY: -100, shiftKey: true });

    let vels = await page.evaluate(
      () => window.__testModel._state.pad_velocities,
    );
    expect(vels[0]).toBe(105);

    await page.locator(".nbplay-pad-vel-slider").fill("64");

    const state = await page.evaluate(() => ({
      velocity: window.__testModel._state.velocity,
      padVelocities: window.__testModel._state.pad_velocities,
      padActions: window.__testModel._state.pad_actions,
    }));
    expect(state.velocity).toBe(64);
    expect(state.padVelocities).toEqual(Array.from({ length: 16 }, () => 64));
    expect(state.padActions[0]).toMatchObject({
      type: "note",
      note: 36,
      velocity: 64,
    });
  });

  // 8. Velocity sensitive checkbox
  test("velocity sensitive checkbox toggles", async ({ page }) => {
    await renderWidget(page);
    const chk = page.locator(".nbplay-pad-vel-sense-chk");
    await chk.uncheck();
    const vs = await page.evaluate(
      () => window.__testModel._state.velocity_sensitive,
    );
    expect(vs).toBe(false);
  });

  // 9. One-shot pads don't hold — active_pads clears after rAF release
  test("active_pads clears after tap", async ({ page }) => {
    await renderWidget(page);
    const pad = page.locator(".nbplay-pad-cell").first();
    const box = await pad.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
    // Wait for the requestAnimationFrame that fires releasePad
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    const active = await page.evaluate(
      () => window.__testModel._state.active_pads,
    );
    expect(active.length).toBe(0);
  });

  // 10. Scroll wheel adjusts note
  test("scroll wheel adjusts pad note", async ({ page }) => {
    await renderWidget(page);
    const pad = page.locator(".nbplay-pad-cell").first();
    await pad.dispatchEvent("wheel", { deltaY: -100 });
    const notes = await page.evaluate(
      () => window.__testModel._state.pad_notes,
    );
    expect(notes[0]).toBe(37); // 36 + 1
  });

  // 11. Session bus routing
  test("pad triggers sampler via session bus", async ({ page }) => {
    await page.evaluate(() => {
      const mockSampler = {
        triggered: [],
        triggerNote(n, v) {
          this.triggered.push({ note: n, velocity: v });
        },
        releaseNote(n) {},
      };
      globalThis.__nbplay = {
        "test-session": {
          audioCtx: new AudioContext(),
          channels: [{ gain: { connect() {} } }],
          samplers: { 0: mockSampler },
        },
      };
      window.__mockSampler = mockSampler;
    });

    await renderWidget(page, {
      session_id: "test-session",
      sampler_routing: [{ channel_index: 0, match: "all" }],
    });

    const pad = page.locator(".nbplay-pad-cell").first();
    const box = await pad.boundingBox();
    // Use click (tap) to trigger note via pointerup
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await page.waitForFunction(() => window.__mockSampler.triggered.length > 0);
    const triggered = await page.evaluate(() => window.__mockSampler.triggered);
    expect(triggered.length).toBeGreaterThanOrEqual(1);
    expect(triggered[0].note).toBe(36);
  });

  // 12. Shift+scroll adjusts individual velocity
  test("Shift+scroll adjusts individual pad velocity", async ({ page }) => {
    await renderWidget(page);
    const pad = page.locator(".nbplay-pad-cell").first();
    // Shift+scroll up → +5 velocity
    await pad.dispatchEvent("wheel", { deltaY: -100, shiftKey: true });
    const vels = await page.evaluate(
      () => window.__testModel._state.pad_velocities,
    );
    expect(vels[0]).toBe(105);

    // Shift+scroll down → -5 velocity
    await pad.dispatchEvent("wheel", { deltaY: 100, shiftKey: true });
    const vels2 = await page.evaluate(
      () => window.__testModel._state.pad_velocities,
    );
    expect(vels2[0]).toBe(100);
  });

  // 13. Velocity bar renders in each pad cell
  test("velocity bars are present in pad cells", async ({ page }) => {
    await renderWidget(page);
    const bars = page.locator(".nbplay-pad-vel-bar");
    await expect(bars).toHaveCount(16);
  });

  // 14. Sampler receives velocity on pad tap
  test("sampler receives velocity on pad tap", async ({ page }) => {
    await page.evaluate(() => {
      const mockSampler = {
        triggered: [],
        triggerNote(n, v) {
          this.triggered.push({ note: n, velocity: v });
        },
        releaseNote() {},
      };
      globalThis.__nbplay = {
        "test-session": {
          audioCtx: new AudioContext(),
          channels: [{ gain: { connect() {} } }],
          samplers: { 0: mockSampler },
        },
      };
      window.__mockSampler = mockSampler;
    });
    await renderWidget(page, {
      session_id: "test-session",
      sampler_routing: [{ channel_index: 0, match: "all" }],
    });
    const pad = page.locator(".nbplay-pad-cell").first();
    const box = await pad.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction(() => window.__mockSampler.triggered.length > 0);
    const triggered = await page.evaluate(() => window.__mockSampler.triggered);
    expect(triggered.length).toBeGreaterThanOrEqual(1);
    expect(triggered[0].note).toBe(36);
    expect(triggered[0].velocity).toBeGreaterThanOrEqual(1);
    expect(triggered[0].velocity).toBeLessThanOrEqual(127);
  });

  test("trait pad action sets model trait without triggering a note", async ({
    page,
  }) => {
    await renderWidget(page, {
      rows: 1,
      cols: 1,
      velocity: 100,
      pad_notes: [36],
      pad_velocities: [100],
      pad_actions: [
        { type: "trait", trait: "velocity", value: 64, label: "Vel" },
      ],
    });

    await expect(
      page.locator(".nbplay-pad-cell .nbplay-pad-label").first(),
    ).toHaveText("Vel");
    await page.locator(".nbplay-pad-cell").first().click();

    const state = await page.evaluate(() => ({
      velocity: window.__testModel._state.velocity,
      noteEvent: window.__testModel._state.last_note_event,
      padEvent: window.__testModel._state.last_pad_event,
    }));
    expect(state.velocity).toBe(64);
    expect(state.noteEvent).toEqual({});
    expect(state.padEvent.action.type).toBe("trait");
  });

  // 15. Hover without click does not modify pad_velocities
  test("hover without click does not modify pad_velocities", async ({
    page,
  }) => {
    await renderWidget(page, {
      pad_velocities: Array.from({ length: 16 }, () => 100),
    });
    const pad = page.locator(".nbplay-pad-cell").first();
    const box = await pad.boundingBox();
    // Move mouse over pad without clicking — should not change velocities
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.2);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
    const vels = await page.evaluate(
      () => window.__testModel._state.pad_velocities,
    );
    expect(vels[0]).toBe(100);
  });
});
