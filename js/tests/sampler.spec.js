import { test, expect } from "@playwright/test";

// ── Shared defaults & setup ──────────────────────────────────────

const DEFAULTS = {
  max_voices: 4,
  session_id: "",
  channel_index: -1,
  root_note: 60,
  sample_name: "Click",
  sample_rate: 44100,
  sample_length: 4410,
  attack: 0.01,
  decay: 0.1,
  sustain: 0.7,
  release: 0.3,
  waveform: null,
};

/** Boot the sampler widget inside the harness page. */
async function renderWidget(page, overrides = {}) {
  await page.evaluate(async (opts) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/dist/css/sampler.css";
    document.head.appendChild(link);

    const mod = await import("/dist/widgets/sampler.js");
    const el = document.getElementById("root");
    const model = window.createMockModel({ ...opts });
    window.__testModel = model;
    mod.default.render({ model, el });
  }, { ...DEFAULTS, ...overrides });
}

// ── Tests ────────────────────────────────────────────────────────

test.describe("SamplerWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // 1. Renders container
  test("renders .nbplay-sampler container", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-sampler")).toBeVisible();
  });

  // 2. Shows header with badge
  test("shows header text and sampler badge", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-samp-header h3")).toHaveText("nbplay");
    await expect(page.locator(".nbplay-badge")).toHaveText("sampler");
  });

  // 3. Shows sample name when set
  test("displays sample name when set", async ({ page }) => {
    await renderWidget(page, { sample_name: "Click" });
    await expect(page.locator(".nbplay-samp-name")).toHaveText("Click");
  });

  // 4. Shows empty name when sample_name is empty
  test("shows empty name when sample_name is empty string", async ({ page }) => {
    await renderWidget(page, { sample_name: "" });
    await expect(page.locator(".nbplay-samp-name")).toHaveText("");
  });

  // 5. Shows sample info (rate, length)
  test("displays sample rate and length info", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-samp-info-rate")).toHaveText("44.1 kHz");
    // 4410 / 44100 = 0.1 s → 100 ms
    await expect(page.locator(".nbplay-samp-info-len")).toHaveText("100 ms");
  });

  // 6. ADSR values displayed
  test("displays ADSR values correctly", async ({ page }) => {
    await renderWidget(page);
    // attack=0.01 → fmtTime: 0.01 < 0.01 false, 0.01 < 1 true → "10 ms"
    await expect(page.locator(".nbplay-samp-attack-val")).toHaveText("10 ms");
    // decay=0.1 → "100 ms"
    await expect(page.locator(".nbplay-samp-decay-val")).toHaveText("100 ms");
    // sustain=0.7 → "70%"
    await expect(page.locator(".nbplay-samp-sustain-val")).toHaveText("70%");
    // release=0.3 → "300 ms"
    await expect(page.locator(".nbplay-samp-release-val")).toHaveText("300 ms");
  });

  // 7. Attack display formatting for very small value
  test("attack=0.001 displays as 1.0 ms", async ({ page }) => {
    await renderWidget(page, { attack: 0.001 });
    // fmtTime: 0.001 < 0.01 → (0.001*1000).toFixed(1) + " ms" = "1.0 ms"
    await expect(page.locator(".nbplay-samp-attack-val")).toHaveText("1.0 ms");
  });

  // 8. Trigger pads rendered (8 pads)
  test("renders 8 trigger pads", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-samp-pad")).toHaveCount(8);
  });

  // 9. Max voices display
  test("displays max voices value", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-samp-voices-val")).toHaveText("4");
  });

  // 10. Model change updates sample name
  test("model change:sample_name updates the name label", async ({ page }) => {
    await renderWidget(page, { sample_name: "Click" });
    await expect(page.locator(".nbplay-samp-name")).toHaveText("Click");

    await page.evaluate(() => {
      window.__testModel.set("sample_name", "Kick");
      window.__testModel._trigger("change:sample_name");
    });
    await expect(page.locator(".nbplay-samp-name")).toHaveText("Kick");
  });

  // 11. Model change updates ADSR
  test("model change:attack updates attack label", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-samp-attack-val")).toHaveText("10 ms");

    await page.evaluate(() => {
      window.__testModel.set("attack", 1.5);
      window.__testModel._trigger("change:attack");
    });
    // 1.5 >= 1 → "1.50 s"
    await expect(page.locator(".nbplay-samp-attack-val")).toHaveText("1.50 s");
  });

  // 12. Double-click edit attack
  test("dblclick attack val, type 0.1, Enter → model updated", async ({ page }) => {
    await renderWidget(page);
    const attackVal = page.locator(".nbplay-samp-attack-val");
    await attackVal.dblclick();

    const input = page.locator(".nbplay-samp-inline-edit");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("0.01");

    await input.fill("0.1");
    await input.press("Enter");

    const val = await page.evaluate(() => window.__testModel._state.attack);
    expect(val).toBe(0.1);
    // 0.1 → "100 ms"
    await expect(page.locator(".nbplay-samp-attack-val")).toHaveText("100 ms");
  });

  // 13. Double-click edit sustain
  test("dblclick sustain val, type 0.5, Enter → model updated", async ({ page }) => {
    await renderWidget(page);
    const sustainVal = page.locator(".nbplay-samp-sustain-val");
    await sustainVal.dblclick();

    const input = page.locator(".nbplay-samp-inline-edit");
    await expect(input).toBeVisible();

    await input.fill("0.5");
    await input.press("Enter");

    const val = await page.evaluate(() => window.__testModel._state.sustain);
    expect(val).toBe(0.5);
    await expect(page.locator(".nbplay-samp-sustain-val")).toHaveText("50%");
  });

  // 14. Double-click edit Escape cancels
  test("Escape during inline edit cancels without update", async ({ page }) => {
    await renderWidget(page, { attack: 0.01 });
    const attackVal = page.locator(".nbplay-samp-attack-val");
    await expect(attackVal).toHaveText("10 ms");

    await attackVal.dblclick();
    const input = page.locator(".nbplay-samp-inline-edit");
    await input.fill("0.5");
    await input.press("Escape");

    // Label restored, model unchanged
    await expect(page.locator(".nbplay-samp-attack-val")).toHaveText("10 ms");
    const val = await page.evaluate(() => window.__testModel._state.attack);
    expect(val).toBe(0.01);
  });

  // 15. Double-commit guard on ADSR (Enter then blur)
  test("Enter commit does not crash when blur fires afterwards", async ({ page }) => {
    await renderWidget(page);
    const attackVal = page.locator(".nbplay-samp-attack-val");
    await attackVal.dblclick();

    const input = page.locator(".nbplay-samp-inline-edit");
    await input.fill("0.2");
    await input.press("Enter");

    // The label should be back
    await expect(page.locator(".nbplay-samp-attack-val")).toBeVisible();

    // Wait for any deferred blur handler
    await page.waitForTimeout(100);

    // No crash — verify value committed correctly
    const val = await page.evaluate(() => window.__testModel._state.attack);
    expect(val).toBe(0.2);
  });

  // 16. Max voices editable
  test("dblclick max voices val, change value, Enter → model updated", async ({ page }) => {
    await renderWidget(page);
    const voicesVal = page.locator(".nbplay-samp-voices-val");
    await expect(voicesVal).toHaveText("4");

    await voicesVal.dblclick();
    const input = page.locator(".nbplay-samp-inline-edit");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("4");

    await input.fill("8");
    await input.press("Enter");

    const val = await page.evaluate(() => window.__testModel._state.max_voices);
    expect(val).toBe(8);
    await expect(page.locator(".nbplay-samp-voices-val")).toHaveText("8");
  });

  // 17. Waveform canvas present
  test("waveform canvas element exists", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-samp-waveform")).toBeVisible();
  });

  // 18. Root note display
  test("displays root note as MIDI note name", async ({ page }) => {
    await renderWidget(page, { root_note: 60 });
    // C4 (MIDI 60)
    await expect(page.locator(".nbplay-samp-info-root")).toHaveText("C4");
  });

  test("root_note=69 displays as A4", async ({ page }) => {
    await renderWidget(page, { root_note: 69 });
    await expect(page.locator(".nbplay-samp-info-root")).toHaveText("A4");
  });

  // ── Additional edge-case tests ────────────────────────────────

  test("attack=0.001 stored as-is in model (not clamped to 0.005)", async ({ page }) => {
    await renderWidget(page, { attack: 0.001 });
    const val = await page.evaluate(() => window.__testModel._state.attack);
    expect(val).toBe(0.001);
  });

  test("envelope canvas element exists", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-samp-env-canvas")).toBeVisible();
  });

  test("model change:root_note updates root display and rebuilds pads", async ({ page }) => {
    await renderWidget(page, { root_note: 60 });
    await expect(page.locator(".nbplay-samp-info-root")).toHaveText("C4");

    await page.evaluate(() => {
      window.__testModel.set("root_note", 48);
      window.__testModel._trigger("change:root_note");
    });
    // C3 (MIDI 48)
    await expect(page.locator(".nbplay-samp-info-root")).toHaveText("C3");
    // Pads rebuilt — still 8
    await expect(page.locator(".nbplay-samp-pad")).toHaveCount(8);
  });

  test("dblclick decay val, type 0.5, Enter → model updated", async ({ page }) => {
    await renderWidget(page);
    const decayVal = page.locator(".nbplay-samp-decay-val");
    await decayVal.dblclick();

    const input = page.locator(".nbplay-samp-inline-edit");
    await input.fill("0.5");
    await input.press("Enter");

    const val = await page.evaluate(() => window.__testModel._state.decay);
    expect(val).toBe(0.5);
  });

  test("dblclick release val, type 1.0, Enter → model updated", async ({ page }) => {
    await renderWidget(page);
    const releaseVal = page.locator(".nbplay-samp-release-val");
    await releaseVal.dblclick();

    const input = page.locator(".nbplay-samp-inline-edit");
    await input.fill("1.0");
    await input.press("Enter");

    const val = await page.evaluate(() => window.__testModel._state.release);
    expect(val).toBe(1.0);
    // 1.0 → "1.00 s"
    await expect(page.locator(".nbplay-samp-release-val")).toHaveText("1.00 s");
  });

  test("voices info shows count", async ({ page }) => {
    await renderWidget(page, { max_voices: 16 });
    await expect(page.locator(".nbplay-samp-info-voices")).toHaveText("16 voices");
  });

  test("model change:max_voices updates voices display", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-samp-voices-val")).toHaveText("4");

    await page.evaluate(() => {
      window.__testModel.set("max_voices", 12);
      window.__testModel._trigger("change:max_voices");
    });
    await expect(page.locator(".nbplay-samp-voices-val")).toHaveText("12");
  });

  test("active voices counter element present", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-samp-active-voices")).toHaveText("0 active");
  });
});
