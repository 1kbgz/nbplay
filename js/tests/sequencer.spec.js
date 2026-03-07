import { test, expect } from "@playwright/test";

// ── Shared defaults & setup ──────────────────────────────────────

const DEFAULTS = {
  session_id: "",
  channel_index: -1,
  steps: Array.from({ length: 8 }, (_, i) => ({
    active: i % 2 === 0,
    note: 60,
    velocity: 100,
  })),
  current_step: 0,
  bpm: 120,
  step_duration: 0.25,
  loop_enabled: true,
  is_playing: false,
};

/** Boot the sequencer widget inside the harness page. */
async function renderWidget(page, overrides = {}) {
  const opts = { ...DEFAULTS, ...overrides };
  if (overrides.steps) opts.steps = overrides.steps;
  await page.evaluate(async (opts) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/dist/css/sequencer.css";
    document.head.appendChild(link);

    const mod = await import("/dist/widgets/sequencer.js");
    const el = document.getElementById("root");
    const model = window.createMockModel({ ...opts });
    window.__testModel = model;
    mod.default.render({ model, el });
  }, opts);
}

// ── Tests ────────────────────────────────────────────────────────

test.describe("SequencerWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // 1. Renders container
  test("renders .nbplay-sequencer container", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-sequencer")).toBeVisible();
  });

  // 2. Shows header with badge
  test("shows header text and sequencer badge", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-badge")).toHaveText("sequencer");
  });

  // 3. Correct number of step cells
  test("renders correct number of step cells", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-seq-cell")).toHaveCount(8);
  });

  // 4. Active steps have .active class
  test("active steps have .active class", async ({ page }) => {
    await renderWidget(page);
    const cells = page.locator(".nbplay-seq-cell");
    // Even indices (0,2,4,6) are active
    for (const i of [0, 2, 4, 6]) {
      await expect(cells.nth(i)).toHaveClass(/active/);
    }
    // Odd indices (1,3,5,7) are not active
    for (const i of [1, 3, 5, 7]) {
      await expect(cells.nth(i)).not.toHaveClass(/active/);
    }
  });

  // 5. Click step toggles active state in model
  test("clicking step toggles active state in model", async ({ page }) => {
    await renderWidget(page);
    const cell1 = page.locator(".nbplay-seq-cell").nth(1);

    // Step 1 starts inactive
    await expect(cell1).not.toHaveClass(/active/);

    await cell1.click();

    const active = await page.evaluate(() => window.__testModel._state.steps[1].active);
    expect(active).toBe(true);
    await expect(cell1).toHaveClass(/active/);

    // Click again to deactivate
    await cell1.click();
    const deactivated = await page.evaluate(() => window.__testModel._state.steps[1].active);
    expect(deactivated).toBe(false);
    await expect(cell1).not.toHaveClass(/active/);
  });

  // 6. Current step highlighted
  test("current step has .current class", async ({ page }) => {
    await renderWidget(page);
    const cells = page.locator(".nbplay-seq-cell");
    await expect(cells.nth(0)).toHaveClass(/current/);
    // Other steps should not have .current
    await expect(cells.nth(1)).not.toHaveClass(/current/);
  });

  // 7. BPM display shows correct value
  test("BPM display shows correct value", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-seq-bpm-val")).toHaveText("120 BPM");
  });

  // 8. Play button toggles is_playing
  test("play button toggles is_playing", async ({ page }) => {
    await renderWidget(page);
    const btn = page.locator(".nbplay-seq-play");

    // Initially shows ▶
    await expect(btn).toContainText("▶");

    await btn.click();
    const playing = await page.evaluate(() => window.__testModel._state.is_playing);
    expect(playing).toBe(true);

    // save_changes auto-fires change:is_playing → onModelChange → button becomes ⏸
    await expect(btn).toContainText("⏸");

    await btn.click();
    const stopped = await page.evaluate(() => window.__testModel._state.is_playing);
    expect(stopped).toBe(false);
    await expect(btn).toContainText("▶");
  });

  // 9. Stop button resets playback
  test("stop button stops playback and resets current_step", async ({ page }) => {
    await renderWidget(page, { is_playing: true });
    const stopBtn = page.locator(".nbplay-seq-stop");

    await stopBtn.click();
    const playing = await page.evaluate(() => window.__testModel._state.is_playing);
    expect(playing).toBe(false);
    const step = await page.evaluate(() => window.__testModel._state.current_step);
    expect(step).toBe(-1);
  });

  // 10. Model change:steps updates step display
  test("model change:steps updates step display", async ({ page }) => {
    await renderWidget(page);

    await page.evaluate(() => {
      const newSteps = Array.from({ length: 4 }, () => ({
        active: true,
        note: 60,
        velocity: 100,
      }));
      window.__testModel.set("steps", newSteps);
      window.__testModel._trigger("change:steps");
    });

    await expect(page.locator(".nbplay-seq-cell")).toHaveCount(4);
    const cells = page.locator(".nbplay-seq-cell");
    for (let i = 0; i < 4; i++) {
      await expect(cells.nth(i)).toHaveClass(/active/);
    }
  });

  // 11. Model change:current_step moves highlight
  test("model change:current_step moves highlight", async ({ page }) => {
    await renderWidget(page);
    const cells = page.locator(".nbplay-seq-cell");

    await expect(cells.nth(0)).toHaveClass(/current/);

    await page.evaluate(() => {
      window.__testModel.set("current_step", 3);
      window.__testModel._trigger("change:current_step");
    });

    await expect(cells.nth(3)).toHaveClass(/current/);
    await expect(cells.nth(0)).not.toHaveClass(/current/);
  });

  // 12. BPM double-click edit — type "140", Enter, verify model
  test("dblclick BPM val, type 140, Enter → model updated", async ({ page }) => {
    await renderWidget(page);
    const bpmVal = page.locator(".nbplay-seq-bpm-val");
    await bpmVal.dblclick();

    const input = page.locator(".nbplay-seq-inline-edit");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("120");

    await input.fill("140");
    await input.press("Enter");

    const val = await page.evaluate(() => window.__testModel._state.bpm);
    expect(val).toBe(140);
    await expect(page.locator(".nbplay-seq-bpm-val")).toHaveText("140 BPM");
  });

  // 13. BPM double-click Escape cancels
  test("Escape during BPM inline edit cancels without update", async ({ page }) => {
    await renderWidget(page);
    const bpmVal = page.locator(".nbplay-seq-bpm-val");
    await expect(bpmVal).toHaveText("120 BPM");

    await bpmVal.dblclick();
    const input = page.locator(".nbplay-seq-inline-edit");
    await input.fill("200");
    await input.press("Escape");

    await expect(page.locator(".nbplay-seq-bpm-val")).toHaveText("120 BPM");
    const val = await page.evaluate(() => window.__testModel._state.bpm);
    expect(val).toBe(120);
  });

  // 14. Double-commit guard on BPM
  test("Enter commit does not crash when blur fires afterwards", async ({ page }) => {
    await renderWidget(page);
    const bpmVal = page.locator(".nbplay-seq-bpm-val");
    await bpmVal.dblclick();

    const input = page.locator(".nbplay-seq-inline-edit");
    await input.fill("150");
    await input.press("Enter");

    await expect(page.locator(".nbplay-seq-bpm-val")).toBeVisible();

    // Wait for any deferred blur handler
    await page.waitForTimeout(100);

    // No crash — verify value committed correctly
    const val = await page.evaluate(() => window.__testModel._state.bpm);
    expect(val).toBe(150);
  });

  // 15. Loop toggle
  test("loop checkbox updates loop_enabled in model", async ({ page }) => {
    await renderWidget(page);

    // Starts enabled
    const loopChk = page.locator(".nbplay-seq-loop-chk");
    await expect(loopChk).toBeChecked();

    await loopChk.uncheck();
    const disabled = await page.evaluate(() => window.__testModel._state.loop_enabled);
    expect(disabled).toBe(false);

    await loopChk.check();
    const reEnabled = await page.evaluate(() => window.__testModel._state.loop_enabled);
    expect(reEnabled).toBe(true);
  });

  // 16. BPM slider is present and functional
  test("BPM slider is present and functional", async ({ page }) => {
    await renderWidget(page);
    const slider = page.locator(".nbplay-seq-bpm-slider");
    await expect(slider).toBeVisible();
    await expect(slider).toHaveValue("120");
  });

  // 17. Model change:bpm updates display
  test("model change:bpm updates BPM display", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-seq-bpm-val")).toHaveText("120 BPM");

    await page.evaluate(() => {
      window.__testModel.set("bpm", 180);
      window.__testModel._trigger("change:bpm");
    });
    await expect(page.locator(".nbplay-seq-bpm-val")).toHaveText("180 BPM");
  });

  // 18. Step duration select updates model
  test("step duration select updates step_duration in model", async ({ page }) => {
    await renderWidget(page);
    const durSelect = page.locator(".nbplay-seq-dur-select");
    await expect(durSelect).toHaveValue("0.25");

    await durSelect.selectOption("0.5");
    const val = await page.evaluate(() => window.__testModel._state.step_duration);
    expect(val).toBe(0.5);
  });

  // 19. Step cells display note names
  test("step cells display note names", async ({ page }) => {
    await renderWidget(page);
    // All steps have note=60 → C4
    const cells = page.locator(".nbplay-seq-cell");
    for (let i = 0; i < 8; i++) {
      await expect(cells.nth(i)).toHaveText("C4");
    }
  });

  // 20. Header row shows step numbers with active-col highlight
  test("header row marks current step column", async ({ page }) => {
    await renderWidget(page);
    const headers = page.locator(".nbplay-seq-header-cell");
    await expect(headers).toHaveCount(8);
    // Step 0 is current_step, so first header cell has active-col
    await expect(headers.nth(0)).toHaveClass(/active-col/);
    await expect(headers.nth(1)).not.toHaveClass(/active-col/);
  });

  // 21. Footer info shows step summary
  test("footer info shows step count and BPM", async ({ page }) => {
    await renderWidget(page);
    const info = page.locator(".nbplay-seq-info");
    // 4 active steps out of 8 (even indices), 120 BPM
    await expect(info).toHaveText("4/8 steps active · 120 BPM");
  });

  // 22. Model change:loop_enabled syncs checkbox
  test("model change:loop_enabled syncs checkbox", async ({ page }) => {
    await renderWidget(page);
    const loopChk = page.locator(".nbplay-seq-loop-chk");
    await expect(loopChk).toBeChecked();

    await page.evaluate(() => {
      window.__testModel.set("loop_enabled", false);
      window.__testModel._trigger("change:loop_enabled");
    });
    await expect(loopChk).not.toBeChecked();
  });

  // 23. Model change:step_duration syncs select
  test("model change:step_duration syncs select", async ({ page }) => {
    await renderWidget(page);
    const durSelect = page.locator(".nbplay-seq-dur-select");
    await expect(durSelect).toHaveValue("0.25");

    await page.evaluate(() => {
      window.__testModel.set("step_duration", 0.5);
      window.__testModel._trigger("change:step_duration");
    });
    await expect(durSelect).toHaveValue("0.5");
  });
});
