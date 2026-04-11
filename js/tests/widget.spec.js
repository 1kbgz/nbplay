import { test, expect } from "@playwright/test";

// Shared defaults & setup

const DEFAULTS = {
  oscillator_type: "sine",
  frequency: 440,
  amplitude: 0.5,
  is_playing: false,
  sample_rate: 44100,
  waveform: null,
};

/** Boot the widget inside the harness page and stash the model on window. */
async function renderWidget(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      // Inject widget CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/widget.css";
      document.head.appendChild(link);

      const mod = await import("/dist/widgets/widget.js");
      const el = document.getElementById("root");
      const model = window.createMockModel({ ...opts });
      window.__testModel = model;
      mod.default.render({ model, el });
    },
    { ...DEFAULTS, ...overrides },
  );
}

// Tests

test.describe("SynthWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // 1. Renders container
  test("renders .nbplay-synth container", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-synth")).toBeVisible();
  });

  // 2. Shows header with badge
  test("shows header text and synth badge", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-header h3")).toHaveText("nbplay");
    await expect(page.locator(".nbplay-badge")).toHaveText("synth");
  });

  // 3. Oscillator buttons
  test("renders all four oscillator buttons", async ({ page }) => {
    await renderWidget(page);
    const btns = page.locator(".nbplay-osc-btn");
    await expect(btns).toHaveCount(4);
    for (const type of ["sine", "square", "saw", "noise"]) {
      await expect(
        page.locator(`.nbplay-osc-btn[data-type="${type}"]`),
      ).toBeVisible();
    }
  });

  // 4. Default oscillator highlighted
  test("highlights the default oscillator button", async ({ page }) => {
    await renderWidget(page, { oscillator_type: "square" });
    await expect(
      page.locator('.nbplay-osc-btn[data-type="square"]'),
    ).toHaveClass(/active/);
    await expect(
      page.locator('.nbplay-osc-btn[data-type="sine"]'),
    ).not.toHaveClass(/active/);
  });

  // 5. Click oscillator button updates model
  test("clicking oscillator button sets model and saves", async ({ page }) => {
    await renderWidget(page);
    await page.locator('.nbplay-osc-btn[data-type="saw"]').click();

    const result = await page.evaluate(() => ({
      type: window.__testModel._state.oscillator_type,
      saved: window.__testModel._history.some((h) => h.type === "save"),
    }));
    expect(result.type).toBe("saw");
    expect(result.saved).toBe(true);

    // UI should reflect the change
    await expect(page.locator('.nbplay-osc-btn[data-type="saw"]')).toHaveClass(
      /active/,
    );
  });

  // 6. Frequency display
  test("displays frequency formatted as Hz", async ({ page }) => {
    await renderWidget(page, { frequency: 440 });
    await expect(page.locator(".nbplay-freq-val")).toHaveText("440.0 Hz");
  });

  test("displays frequency formatted as kHz when >= 1000", async ({ page }) => {
    await renderWidget(page, { frequency: 2000 });
    await expect(page.locator(".nbplay-freq-val")).toHaveText("2.00 kHz");
  });

  // 7. Amplitude display
  test("displays amplitude to 2 decimal places", async ({ page }) => {
    await renderWidget(page, { amplitude: 0.75 });
    await expect(page.locator(".nbplay-amp-val")).toHaveText("0.75");
  });

  // 8. Play button toggle
  test("play button toggles is_playing and updates text", async ({ page }) => {
    await renderWidget(page);
    const btn = page.locator(".nbplay-play-btn");

    // Initial state: not playing
    await expect(btn).toContainText("Play");

    // Click → playing
    await btn.click();
    // Trigger the model observer so the UI syncs
    await page.evaluate(() => window.__testModel._trigger("change:is_playing"));
    await expect(btn).toContainText("Stop");

    const playing = await page.evaluate(
      () => window.__testModel._state.is_playing,
    );
    expect(playing).toBe(true);

    // Click again → stopped
    await btn.click();
    await page.evaluate(() => window.__testModel._trigger("change:is_playing"));
    await expect(btn).toContainText("Play");

    const stopped = await page.evaluate(
      () => window.__testModel._state.is_playing,
    );
    expect(stopped).toBe(false);
  });

  // 9. Model change updates DOM
  test("model change:frequency updates the frequency label", async ({
    page,
  }) => {
    await renderWidget(page, { frequency: 440 });
    await expect(page.locator(".nbplay-freq-val")).toHaveText("440.0 Hz");

    await page.evaluate(() => {
      window.__testModel.set("frequency", 1500);
      window.__testModel._trigger("change:frequency");
    });
    await expect(page.locator(".nbplay-freq-val")).toHaveText("1.50 kHz");
  });

  test("model change:amplitude updates the amplitude label", async ({
    page,
  }) => {
    await renderWidget(page, { amplitude: 0.5 });
    await expect(page.locator(".nbplay-amp-val")).toHaveText("0.50");

    await page.evaluate(() => {
      window.__testModel.set("amplitude", 0.82);
      window.__testModel._trigger("change:amplitude");
    });
    await expect(page.locator(".nbplay-amp-val")).toHaveText("0.82");
  });

  test("model change:oscillator_type updates active button", async ({
    page,
  }) => {
    await renderWidget(page, { oscillator_type: "sine" });
    await expect(page.locator('.nbplay-osc-btn[data-type="sine"]')).toHaveClass(
      /active/,
    );

    await page.evaluate(() => {
      window.__testModel.set("oscillator_type", "noise");
      window.__testModel._trigger("change:oscillator_type");
    });
    await expect(
      page.locator('.nbplay-osc-btn[data-type="noise"]'),
    ).toHaveClass(/active/);
    await expect(
      page.locator('.nbplay-osc-btn[data-type="sine"]'),
    ).not.toHaveClass(/active/);
  });

  // 10. Double-click edit: frequency
  test("double-click on freq label opens inline editor and commits on Enter", async ({
    page,
  }) => {
    await renderWidget(page, { frequency: 440 });

    const freqVal = page.locator(".nbplay-freq-val");
    await expect(freqVal).toHaveText("440.0 Hz");

    // Double-click to enter edit mode
    await freqVal.dblclick();

    // An input should appear in its place
    const input = page.locator(".nbplay-inline-edit");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("440");

    // Clear and type new value
    await input.fill("1200");
    await input.press("Enter");

    // The span should be restored with the new value
    await expect(page.locator(".nbplay-freq-val")).toHaveText("1.20 kHz");

    const freq = await page.evaluate(() => window.__testModel._state.frequency);
    expect(freq).toBe(1200);
  });

  test("double-click on freq label accepts kHz shorthand", async ({ page }) => {
    await renderWidget(page, { frequency: 440 });

    await page.locator(".nbplay-freq-val").dblclick();
    const input = page.locator(".nbplay-inline-edit");
    await input.fill("2k");
    await input.press("Enter");

    await expect(page.locator(".nbplay-freq-val")).toHaveText("2.00 kHz");
    const freq = await page.evaluate(() => window.__testModel._state.frequency);
    expect(freq).toBe(2000);
  });

  test("double-click on amplitude label opens editor and commits", async ({
    page,
  }) => {
    await renderWidget(page, { amplitude: 0.5 });

    await page.locator(".nbplay-amp-val").dblclick();
    const input = page.locator(".nbplay-inline-edit");
    await expect(input).toBeVisible();

    await input.fill("0.9");
    await input.press("Enter");

    await expect(page.locator(".nbplay-amp-val")).toHaveText("0.90");
    const amp = await page.evaluate(() => window.__testModel._state.amplitude);
    expect(amp).toBe(0.9);
  });

  // 11. Double-click edit: Escape cancels
  test("pressing Escape cancels inline edit without updating model", async ({
    page,
  }) => {
    await renderWidget(page, { frequency: 440 });

    await page.locator(".nbplay-freq-val").dblclick();
    const input = page.locator(".nbplay-inline-edit");
    await input.fill("9999");
    await input.press("Escape");

    // Label should be restored to original value
    await expect(page.locator(".nbplay-freq-val")).toHaveText("440.0 Hz");

    // Model should NOT have been updated to 9999
    const freq = await page.evaluate(() => window.__testModel._state.frequency);
    expect(freq).toBe(440);
  });

  // 12. Double-commit guard (Enter + blur race)
  test("Enter commit does not crash when blur fires afterwards", async ({
    page,
  }) => {
    await renderWidget(page, { frequency: 440 });

    await page.locator(".nbplay-freq-val").dblclick();
    const input = page.locator(".nbplay-inline-edit");
    await input.fill("800");

    // Press Enter (commits and replaces input with span)
    await input.press("Enter");

    // The span should be back — blur will fire on the now-detached input,
    // but the committed guard should prevent a second replaceWith error.
    await expect(page.locator(".nbplay-freq-val")).toBeVisible();
    await expect(page.locator(".nbplay-freq-val")).toHaveText("800.0 Hz");

    // Small wait to let any deferred blur handler execute
    await page.waitForTimeout(100);

    // No crash — page should still be functional
    const freq = await page.evaluate(() => window.__testModel._state.frequency);
    expect(freq).toBe(800);
  });

  // Additional edge-case tests

  test("frequency is clamped to valid range via inline edit", async ({
    page,
  }) => {
    await renderWidget(page, { frequency: 440 });

    // Try setting below minimum (20)
    await page.locator(".nbplay-freq-val").dblclick();
    const input = page.locator(".nbplay-inline-edit");
    await input.fill("5");
    await input.press("Enter");

    const freq = await page.evaluate(() => window.__testModel._state.frequency);
    expect(freq).toBe(20);
  });

  test("amplitude is clamped to 0–1 via inline edit", async ({ page }) => {
    await renderWidget(page, { amplitude: 0.5 });

    await page.locator(".nbplay-amp-val").dblclick();
    const input = page.locator(".nbplay-inline-edit");
    await input.fill("5");
    await input.press("Enter");

    const amp = await page.evaluate(() => window.__testModel._state.amplitude);
    expect(amp).toBe(1);
  });

  test("invalid inline edit input is ignored", async ({ page }) => {
    await renderWidget(page, { frequency: 440 });

    await page.locator(".nbplay-freq-val").dblclick();
    const input = page.locator(".nbplay-inline-edit");
    await input.fill("not-a-number");
    await input.press("Enter");

    // Frequency should remain unchanged
    const freq = await page.evaluate(() => window.__testModel._state.frequency);
    expect(freq).toBe(440);
  });

  test("noise oscillator disables frequency slider", async ({ page }) => {
    await renderWidget(page, { oscillator_type: "noise" });
    await expect(page.locator(".nbplay-freq")).toBeDisabled();
  });

  test("sample rate info is displayed", async ({ page }) => {
    await renderWidget(page, { sample_rate: 48000 });
    await expect(page.locator(".nbplay-info")).toHaveText("48000 Hz");
  });

  test("waveform canvas is rendered", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-waveform")).toBeVisible();
  });
});
