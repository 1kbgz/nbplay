import { test, expect } from "@playwright/test";

// ── Shared defaults & setup ──────────────────────────────────────

const DEFAULTS = {
  is_playing: false,
  bpm: 120,
  time_signature_num: 4,
  time_signature_den: 4,
  bar_number: 0,
  beat_in_bar: 0,
  loop_enabled: false,
  loop_start_bar: 0,
  loop_end_bar: 4,
};

/** Boot the transport widget inside the harness page. */
async function renderWidget(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/transport.css";
      document.head.appendChild(link);

      const mod = await import("/dist/widgets/transport.js");
      const el = document.getElementById("root");
      const model = window.createMockModel({ ...opts });
      window.__testModel = model;
      mod.default.render({ model, el });
    },
    { ...DEFAULTS, ...overrides },
  );
}

// ── Tests ────────────────────────────────────────────────────────

test.describe("TransportWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // 1. Renders container
  test("renders .nbplay-transport container", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-transport")).toBeVisible();
  });

  // 2. Play button shows ▶ initially
  test("play button shows play icon initially", async ({ page }) => {
    await renderWidget(page);
    const btn = page.locator(".nbplay-transport-play");
    await expect(btn).toBeVisible();
    await expect(btn).toContainText("▶");
  });

  // 3. Click play toggles is_playing, button changes to ⏸
  test("click play toggles is_playing, button changes to pause", async ({
    page,
  }) => {
    await renderWidget(page);
    const btn = page.locator(".nbplay-transport-play");

    await btn.click();

    const playing = await page.evaluate(
      () => window.__testModel._state.is_playing,
    );
    expect(playing).toBe(true);

    await page.evaluate(() => window.__testModel._trigger("change:is_playing"));
    await expect(btn).toContainText("\u23F8");
    await expect(btn).toHaveClass(/playing/);

    // Click again → stopped
    await btn.click();

    const stopped = await page.evaluate(
      () => window.__testModel._state.is_playing,
    );
    expect(stopped).toBe(false);

    await page.evaluate(() => window.__testModel._trigger("change:is_playing"));
    await expect(btn).toContainText("▶");
    await expect(btn).not.toHaveClass(/playing/);
  });

  // 4. Stop button resets position
  test("stop button sets is_playing false and resets position", async ({
    page,
  }) => {
    await renderWidget(page, {
      is_playing: true,
      bar_number: 3,
      beat_in_bar: 2,
    });
    const stopBtn = page.locator(".nbplay-transport-stop");
    await stopBtn.click();

    const state = await page.evaluate(() => ({
      is_playing: window.__testModel._state.is_playing,
      bar_number: window.__testModel._state.bar_number,
      beat_in_bar: window.__testModel._state.beat_in_bar,
    }));
    expect(state.is_playing).toBe(false);
    expect(state.bar_number).toBe(0);
    expect(state.beat_in_bar).toBe(0);

    // Position display should update (bar_number 0 → "001", beat_in_bar 0 → "1")
    await page.evaluate(() => {
      window.__testModel._trigger("change:is_playing");
      window.__testModel._trigger("change:bar_number");
      window.__testModel._trigger("change:beat_in_bar");
    });
    await expect(page.locator(".nbplay-transport-bar")).toHaveText("001");
    await expect(page.locator(".nbplay-transport-beat")).toHaveText("1");
  });

  // 5. BPM display shows correct value
  test("BPM display shows correct value", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-transport-bpm-val")).toHaveText(
      "120 BPM",
    );
  });

  // 6. Time signature shows "4/4"
  test("time signature shows 4/4", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-transport-timesig-val")).toHaveText(
      "4/4",
    );
  });

  // 7. Position display shows bar:beat (1-indexed, bar zero-padded)
  test("position display shows bar:beat", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-transport-bar")).toHaveText("001");
    await expect(page.locator(".nbplay-transport-beat")).toHaveText("1");
  });

  test("position display with non-zero values", async ({ page }) => {
    await renderWidget(page, { bar_number: 3, beat_in_bar: 2 });
    // Render resets bar/beat to 0; update via model change
    await page.evaluate(() => {
      window.__testModel.set("bar_number", 3);
      window.__testModel.set("beat_in_bar", 2);
      window.__testModel._trigger("change:bar_number");
      window.__testModel._trigger("change:beat_in_bar");
    });
    await expect(page.locator(".nbplay-transport-bar")).toHaveText("004");
    await expect(page.locator(".nbplay-transport-beat")).toHaveText("3");
  });

  // 8. Loop toggle works
  test("loop toggle updates loop_enabled in model", async ({ page }) => {
    await renderWidget(page);
    const loopBtn = page.locator(".nbplay-transport-loop-btn");

    // Starts disabled
    const initial = await page.evaluate(
      () => window.__testModel._state.loop_enabled,
    );
    expect(initial).toBe(false);
    await expect(loopBtn).not.toHaveClass(/active/);

    await loopBtn.click();

    const enabled = await page.evaluate(
      () => window.__testModel._state.loop_enabled,
    );
    expect(enabled).toBe(true);

    await page.evaluate(() =>
      window.__testModel._trigger("change:loop_enabled"),
    );
    await expect(loopBtn).toHaveClass(/active/);

    await loopBtn.click();
    const disabled = await page.evaluate(
      () => window.__testModel._state.loop_enabled,
    );
    expect(disabled).toBe(false);

    await page.evaluate(() =>
      window.__testModel._trigger("change:loop_enabled"),
    );
    await expect(loopBtn).not.toHaveClass(/active/);
  });

  // 9. Loop range displays correctly
  test("loop range shows correct values", async ({ page }) => {
    await renderWidget(page);
    // loop_start_bar=0 → 1, loop_end_bar=4 → 4, so "1 – 4"
    await expect(page.locator(".nbplay-transport-loop-range")).toHaveText(
      "1 \u2013 4",
    );
  });

  // 10. Model change:bpm updates display
  test("model change:bpm updates BPM display", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-transport-bpm-val")).toHaveText(
      "120 BPM",
    );

    await page.evaluate(() => {
      window.__testModel.set("bpm", 90);
      window.__testModel._trigger("change:bpm");
    });
    await expect(page.locator(".nbplay-transport-bpm-val")).toHaveText(
      "90 BPM",
    );
  });

  // 11. Model change:is_playing updates button
  test("model change:is_playing updates play button", async ({ page }) => {
    await renderWidget(page);
    const btn = page.locator(".nbplay-transport-play");
    await expect(btn).toContainText("▶");

    await page.evaluate(() => {
      window.__testModel.set("is_playing", true);
      window.__testModel._trigger("change:is_playing");
    });
    await expect(btn).toContainText("\u23F8");
    await expect(btn).toHaveClass(/playing/);

    await page.evaluate(() => {
      window.__testModel.set("is_playing", false);
      window.__testModel._trigger("change:is_playing");
    });
    await expect(btn).toContainText("▶");
    await expect(btn).not.toHaveClass(/playing/);
  });

  // 12. Model change:bar_number updates position display
  test("model change:bar_number updates position display", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-transport-bar")).toHaveText("001");

    await page.evaluate(() => {
      window.__testModel.set("bar_number", 5);
      window.__testModel._trigger("change:bar_number");
    });
    // bar_number 5 → display "006"
    await expect(page.locator(".nbplay-transport-bar")).toHaveText("006");
  });

  test("model change:beat_in_bar updates position display", async ({
    page,
  }) => {
    await renderWidget(page);

    await page.evaluate(() => {
      window.__testModel.set("beat_in_bar", 3);
      window.__testModel._trigger("change:beat_in_bar");
    });
    // beat_in_bar 3 → display "4"
    await expect(page.locator(".nbplay-transport-beat")).toHaveText("4");
  });

  // 13. BPM double-click edit — type "140", Enter, verify
  test("dblclick BPM display, type 140, Enter → model updated", async ({
    page,
  }) => {
    await renderWidget(page);
    const bpmDisplay = page.locator(".nbplay-transport-bpm-val");
    await bpmDisplay.dblclick();

    const input = page.locator("input.nbplay-transport-inline-edit");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("120");

    await input.fill("140");
    await input.press("Enter");

    const val = await page.evaluate(() => window.__testModel._state.bpm);
    expect(val).toBe(140);
    await expect(page.locator(".nbplay-transport-bpm-val")).toHaveText(
      "140 BPM",
    );
  });

  // 14. BPM double-click Escape cancels
  test("Escape during BPM inline edit cancels without update", async ({
    page,
  }) => {
    await renderWidget(page);
    const bpmDisplay = page.locator(".nbplay-transport-bpm-val");
    await expect(bpmDisplay).toHaveText("120 BPM");

    await bpmDisplay.dblclick();
    const input = page.locator("input.nbplay-transport-inline-edit");
    await input.fill("200");
    await input.press("Escape");

    await expect(page.locator(".nbplay-transport-bpm-val")).toHaveText(
      "120 BPM",
    );
    const val = await page.evaluate(() => window.__testModel._state.bpm);
    expect(val).toBe(120);
  });

  // 15. Double-commit guard
  test("Enter commit does not crash when blur fires afterwards", async ({
    page,
  }) => {
    await renderWidget(page);
    const bpmDisplay = page.locator(".nbplay-transport-bpm-val");
    await bpmDisplay.dblclick();

    const input = page.locator("input.nbplay-transport-inline-edit");
    await input.fill("160");
    await input.press("Enter");

    await expect(page.locator(".nbplay-transport-bpm-val")).toBeVisible();

    // Wait for any deferred blur handler
    await page.waitForTimeout(100);

    // No crash — verify value committed correctly
    const val = await page.evaluate(() => window.__testModel._state.bpm);
    expect(val).toBe(160);
  });

  // 16. Time signature with different values
  test("custom time signature displays correctly", async ({ page }) => {
    await renderWidget(page, { time_signature_num: 3, time_signature_den: 8 });
    await expect(page.locator(".nbplay-transport-timesig-val")).toHaveText(
      "3/8",
    );
  });

  // 17. Model change:loop_enabled updates toggle button
  test("model change:loop_enabled updates loop toggle", async ({ page }) => {
    await renderWidget(page);
    const loopBtn = page.locator(".nbplay-transport-loop-btn");

    await page.evaluate(() => {
      window.__testModel.set("loop_enabled", true);
      window.__testModel._trigger("change:loop_enabled");
    });
    await expect(loopBtn).toHaveClass(/active/);

    await page.evaluate(() => {
      window.__testModel.set("loop_enabled", false);
      window.__testModel._trigger("change:loop_enabled");
    });
    await expect(loopBtn).not.toHaveClass(/active/);
  });

  // 18. Model change:time_signature updates display
  test("model change:time_signature updates display", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-transport-timesig-val")).toHaveText(
      "4/4",
    );

    await page.evaluate(() => {
      window.__testModel.set("time_signature_num", 6);
      window.__testModel._trigger("change:time_signature_num");
    });
    await expect(page.locator(".nbplay-transport-timesig-val")).toHaveText(
      "6/4",
    );

    await page.evaluate(() => {
      window.__testModel.set("time_signature_den", 8);
      window.__testModel._trigger("change:time_signature_den");
    });
    await expect(page.locator(".nbplay-transport-timesig-val")).toHaveText(
      "6/8",
    );
  });

  // 19. BPM slider updates model and display
  test("BPM slider input updates model and display", async ({ page }) => {
    await renderWidget(page);
    const slider = page.locator(".nbplay-transport-bpm-slider");
    await slider.fill("90");

    const val = await page.evaluate(() => window.__testModel._state.bpm);
    expect(val).toBe(90);
    await expect(page.locator(".nbplay-transport-bpm-val")).toHaveText(
      "90 BPM",
    );
  });

  // 20. Model change:loop_start_bar / loop_end_bar updates range
  test("model change:loop_start_bar updates loop range", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-transport-loop-range")).toHaveText(
      "1 \u2013 4",
    );

    await page.evaluate(() => {
      window.__testModel.set("loop_start_bar", 2);
      window.__testModel._trigger("change:loop_start_bar");
    });
    // loop_start_bar=2 → 3, loop_end_bar=4 → 4
    await expect(page.locator(".nbplay-transport-loop-range")).toHaveText(
      "3 \u2013 4",
    );
  });

  test("model change:loop_end_bar updates loop range", async ({ page }) => {
    await renderWidget(page);

    await page.evaluate(() => {
      window.__testModel.set("loop_end_bar", 8);
      window.__testModel._trigger("change:loop_end_bar");
    });
    // loop_start_bar=0 → 1, loop_end_bar=8 → 8
    await expect(page.locator(".nbplay-transport-loop-range")).toHaveText(
      "1 \u2013 8",
    );
  });

  // 21. BPM inline edit clamps to valid range
  test("BPM inline edit clamps to valid range", async ({ page }) => {
    await renderWidget(page);
    const bpmDisplay = page.locator(".nbplay-transport-bpm-val");
    await bpmDisplay.dblclick();

    const input = page.locator("input.nbplay-transport-inline-edit");
    await input.fill("999");
    await input.press("Enter");

    // Should clamp to 300
    const val = await page.evaluate(() => window.__testModel._state.bpm);
    expect(val).toBe(300);
    await expect(page.locator(".nbplay-transport-bpm-val")).toHaveText(
      "300 BPM",
    );
  });

  // 22. BPM inline edit rejects non-numeric input
  test("BPM inline edit rejects non-numeric input", async ({ page }) => {
    await renderWidget(page);
    const bpmDisplay = page.locator(".nbplay-transport-bpm-val");
    await bpmDisplay.dblclick();

    const input = page.locator("input.nbplay-transport-inline-edit");
    await input.fill("abc");
    await input.press("Enter");

    // parse returns null for NaN → original value preserved
    const val = await page.evaluate(() => window.__testModel._state.bpm);
    expect(val).toBe(120);
    await expect(page.locator(".nbplay-transport-bpm-val")).toHaveText(
      "120 BPM",
    );
  });

  // 23. Kernel disconnect stops playback
  test("kernel disconnect stops transport after delay", async ({ page }) => {
    await page.evaluate(async () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/transport.css";
      document.head.appendChild(link);

      const mod = await import("/dist/widgets/transport.js");
      const el = document.getElementById("root");
      const defaults = {
        bpm: 120,
        is_playing: false,
        time_signature_num: 4,
        time_signature_den: 4,
        bar_number: 0,
        beat_in_bar: 0,
        loop_enabled: false,
        loop_start_bar: 0,
        loop_end_bar: 4,
      };
      const model = window.createMockModel(defaults);
      model.comm = {};
      window.__testModel = model;
      mod.default.render({ model, el });
    });

    // Start playing
    await page.evaluate(() => {
      window.__testModel.set("is_playing", true);
      window.__testModel._trigger("change:is_playing");
    });

    // Simulate disconnect
    await page.evaluate(() => {
      window.__testModel.comm = null;
    });

    // Poll + 5s delay
    await page.waitForFunction(
      () => window.__testModel._state.is_playing === false,
      { timeout: 10000 },
    );
    const stopped = await page.evaluate(
      () => window.__testModel._state.is_playing,
    );
    expect(stopped).toBe(false);
  });
});
