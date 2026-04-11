import { test, expect } from "@playwright/test";

// Shared defaults & setup

const DEFAULTS = {
  session_id: "test-session",
  channels: [
    { name: "Lead", gain: 1.0, pan: 0, mute: false, solo: false },
    { name: "Bass", gain: 0.5, pan: -0.2, mute: false, solo: false },
  ],
  master_gain: 0.85,
};

/** Boot the mixer widget inside the harness page. */
async function renderWidget(page, overrides = {}) {
  const opts = { ...DEFAULTS, ...overrides };
  if (overrides.channels) opts.channels = overrides.channels;
  await page.evaluate(async (opts) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/dist/css/mixer.css";
    document.head.appendChild(link);

    const mod = await import("/dist/widgets/mixer.js");
    const el = document.getElementById("root");
    const model = window.createMockModel({ ...opts });
    window.__testModel = model;
    mod.default.render({ model, el });
  }, opts);
}

/** Selector for channel strips (excludes master). */
const STRIP = ".nbplay-mixer-strip:not(.nbplay-master-strip)";

// Tests

test.describe("MixerWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // 1. Renders container
  test("renders .nbplay-mixer container", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-mixer")).toBeVisible();
  });

  // 2. Shows header with badge
  test("shows header text and mixer badge", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-mixer-header h3")).toHaveText("nbplay");
    await expect(page.locator(".nbplay-badge")).toHaveText("mixer");
  });

  // 3. Renders correct number of channels
  test("renders correct number of channel strips", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(STRIP)).toHaveCount(2);
  });

  // 4. Channel names
  test("displays correct channel names", async ({ page }) => {
    await renderWidget(page);
    const names = page.locator(`${STRIP} .nbplay-strip-name`);
    await expect(names.nth(0)).toHaveText("Lead");
    await expect(names.nth(1)).toHaveText("Bass");
  });

  // 5. Gain display in dB
  test("gain=1.0 displays as +0.0 dB", async ({ page }) => {
    await renderWidget(page);
    const labels = page.locator(`${STRIP} .nbplay-strip-gain-label`);
    await expect(labels.nth(0)).toHaveText("+0.0 dB");
  });

  test("gain=0.5 displays as -6.0 dB", async ({ page }) => {
    await renderWidget(page);
    const labels = page.locator(`${STRIP} .nbplay-strip-gain-label`);
    // Bass channel has gain 0.5
    await expect(labels.nth(1)).toHaveText("-6.0 dB");
  });

  // 6. Gain=0 shows −∞ dB
  test("gain=0 displays as −∞ dB", async ({ page }) => {
    await renderWidget(page, {
      channels: [{ name: "Silent", gain: 0, pan: 0, mute: false, solo: false }],
    });
    const label = page.locator(`${STRIP} .nbplay-strip-gain-label`);
    // fmtGain uses the minus sign "−" (U+2212)
    await expect(label).toHaveText("−∞ dB");
  });

  // 7. Gain=2 shows +6.0 dB
  test("gain=2 displays as +6.0 dB (max linear)", async ({ page }) => {
    await renderWidget(page, {
      channels: [{ name: "Hot", gain: 2.0, pan: 0, mute: false, solo: false }],
    });
    const label = page.locator(`${STRIP} .nbplay-strip-gain-label`);
    await expect(label).toHaveText("+6.0 dB");
  });

  // 8. Master gain display
  test("master gain 0.85 displays correct dB value", async ({ page }) => {
    await renderWidget(page);
    const label = page.locator(".nbplay-master-strip .nbplay-strip-gain-label");
    // 20*log10(0.85) ≈ -1.4 dB
    await expect(label).toHaveText("-1.4 dB");
  });

  // 9. Pan display
  test("pan=0 displays as C", async ({ page }) => {
    await renderWidget(page);
    const panLabels = page.locator(`${STRIP} .nbplay-strip-pan-label`);
    // Lead has pan=0
    await expect(panLabels.nth(0)).toHaveText("C");
  });

  test("pan=0.3 displays as R30", async ({ page }) => {
    await renderWidget(page, {
      channels: [
        { name: "Right", gain: 1, pan: 0.3, mute: false, solo: false },
      ],
    });
    const label = page.locator(`${STRIP} .nbplay-strip-pan-label`);
    await expect(label).toHaveText("R30");
  });

  test("pan=-0.5 displays as L50", async ({ page }) => {
    await renderWidget(page, {
      channels: [
        { name: "Left", gain: 1, pan: -0.5, mute: false, solo: false },
      ],
    });
    const label = page.locator(`${STRIP} .nbplay-strip-pan-label`);
    await expect(label).toHaveText("L50");
  });

  // 10. Mute button toggle
  test("clicking mute button toggles channel mute state", async ({ page }) => {
    await renderWidget(page);
    const muteBtn = page.locator(`${STRIP}`).nth(0).locator(".nbplay-mute-btn");

    // Initially not muted
    await expect(muteBtn).not.toHaveClass(/active/);

    await muteBtn.click();

    const muted = await page.evaluate(
      () => window.__testModel._state.channels[0].mute,
    );
    expect(muted).toBe(true);
    await expect(muteBtn).toHaveClass(/active/);

    // Click again to unmute
    await muteBtn.click();
    const unmuted = await page.evaluate(
      () => window.__testModel._state.channels[0].mute,
    );
    expect(unmuted).toBe(false);
  });

  // 11. Solo button toggle
  test("clicking solo button toggles channel solo state", async ({ page }) => {
    await renderWidget(page);
    const soloBtn = page.locator(`${STRIP}`).nth(0).locator(".nbplay-solo-btn");

    await expect(soloBtn).not.toHaveClass(/active/);

    await soloBtn.click();

    const soloed = await page.evaluate(
      () => window.__testModel._state.channels[0].solo,
    );
    expect(soloed).toBe(true);
    await expect(soloBtn).toHaveClass(/active/);

    await soloBtn.click();
    const unsoloed = await page.evaluate(
      () => window.__testModel._state.channels[0].solo,
    );
    expect(unsoloed).toBe(false);
  });

  // 12. Gain slider updates model
  test("gain slider input updates model", async ({ page }) => {
    await renderWidget(page);
    const fader = page
      .locator(`${STRIP}`)
      .nth(0)
      .locator(".nbplay-strip-fader");

    await fader.fill("1.5");
    await fader.dispatchEvent("input");

    const gain = await page.evaluate(
      () => window.__testModel._state.channels[0].gain,
    );
    expect(gain).toBeCloseTo(1.5, 1);
  });

  // 13. Pan slider updates model
  test("pan slider input updates model", async ({ page }) => {
    await renderWidget(page);
    const pan = page.locator(`${STRIP}`).nth(0).locator(".nbplay-strip-pan");

    await pan.fill("0.6");
    await pan.dispatchEvent("input");

    const val = await page.evaluate(
      () => window.__testModel._state.channels[0].pan,
    );
    expect(val).toBeCloseTo(0.6, 1);
  });

  // 14. Model change:channels updates DOM
  test("model change:channels updates DOM", async ({ page }) => {
    await renderWidget(page);

    // Change channel gain and name via model, then trigger
    await page.evaluate(() => {
      const chs = [...window.__testModel._state.channels];
      chs[0] = { ...chs[0], gain: 0.25, name: "Vox" };
      window.__testModel.set("channels", chs);
      window.__testModel._trigger("change:channels");
    });

    const names = page.locator(`${STRIP} .nbplay-strip-name`);
    await expect(names.nth(0)).toHaveText("Vox");

    const labels = page.locator(`${STRIP} .nbplay-strip-gain-label`);
    // 20*log10(0.25) ≈ -12.0 dB
    await expect(labels.nth(0)).toHaveText("-12.0 dB");
  });

  // 15. Master gain change updates DOM
  test("model change:master_gain updates master label", async ({ page }) => {
    await renderWidget(page);

    await page.evaluate(() => {
      window.__testModel.set("master_gain", 1.0);
      window.__testModel._trigger("change:master_gain");
    });

    const label = page.locator(".nbplay-master-strip .nbplay-strip-gain-label");
    await expect(label).toHaveText("+0.0 dB");
  });

  // 16. Double-click edit gain: type dB value
  test("dblclick gain label, type -3, Enter → gain ≈ 0.707", async ({
    page,
  }) => {
    await renderWidget(page);
    const gainLabel = page
      .locator(`${STRIP}`)
      .nth(0)
      .locator(".nbplay-strip-gain-label");
    await gainLabel.dblclick();

    const input = page.locator(".nbplay-mixer-inline-edit");
    await expect(input).toBeVisible();

    await input.fill("-3");
    await input.press("Enter");

    const gain = await page.evaluate(
      () => window.__testModel._state.channels[0].gain,
    );
    expect(gain).toBeCloseTo(0.707, 2);
  });

  // 17. Double-click edit gain: type negative dB with suffix
  test("dblclick gain label, type '-12 dB', Enter → gain ≈ 0.251", async ({
    page,
  }) => {
    await renderWidget(page);
    const gainLabel = page
      .locator(`${STRIP}`)
      .nth(0)
      .locator(".nbplay-strip-gain-label");
    await gainLabel.dblclick();

    const input = page.locator(".nbplay-mixer-inline-edit");
    await input.fill("-12 dB");
    await input.press("Enter");

    const gain = await page.evaluate(
      () => window.__testModel._state.channels[0].gain,
    );
    expect(gain).toBeCloseTo(0.251, 2);
  });

  // 18. Double-click edit gain: type +6 dB
  test("dblclick gain label, type '+6', Enter → gain ≈ 2.0", async ({
    page,
  }) => {
    await renderWidget(page);
    const gainLabel = page
      .locator(`${STRIP}`)
      .nth(0)
      .locator(".nbplay-strip-gain-label");
    await gainLabel.dblclick();

    const input = page.locator(".nbplay-mixer-inline-edit");
    await input.fill("+6");
    await input.press("Enter");

    const gain = await page.evaluate(
      () => window.__testModel._state.channels[0].gain,
    );
    expect(gain).toBeCloseTo(1.995, 2);
  });

  // 19. Double-click edit gain: Escape cancels
  test("Escape during gain inline edit does not change model", async ({
    page,
  }) => {
    await renderWidget(page);
    const gainLabel = page
      .locator(`${STRIP}`)
      .nth(0)
      .locator(".nbplay-strip-gain-label");
    await expect(gainLabel).toHaveText("+0.0 dB");

    await gainLabel.dblclick();
    const input = page.locator(".nbplay-mixer-inline-edit");
    await input.fill("-20");
    await input.press("Escape");

    // Label restored, model unchanged
    await expect(
      page.locator(`${STRIP}`).nth(0).locator(".nbplay-strip-gain-label"),
    ).toHaveText("+0.0 dB");
    const gain = await page.evaluate(
      () => window.__testModel._state.channels[0].gain,
    );
    expect(gain).toBe(1.0);
  });

  // 20. Double-commit guard (Enter then blur)
  test("Enter commit does not crash when blur fires afterwards", async ({
    page,
  }) => {
    await renderWidget(page);
    const gainLabel = page
      .locator(`${STRIP}`)
      .nth(0)
      .locator(".nbplay-strip-gain-label");
    await gainLabel.dblclick();

    const input = page.locator(".nbplay-mixer-inline-edit");
    await input.fill("-6");
    await input.press("Enter");

    // The label should be back
    await expect(
      page.locator(`${STRIP}`).nth(0).locator(".nbplay-strip-gain-label"),
    ).toBeVisible();

    // Wait for any deferred blur handler
    await page.waitForTimeout(100);

    // No crash — verify value committed correctly
    const gain = await page.evaluate(
      () => window.__testModel._state.channels[0].gain,
    );
    expect(gain).toBeCloseTo(0.501, 2);
  });

  // 21. Double-click edit pan
  test("dblclick pan label, type pan value, Enter → model updated", async ({
    page,
  }) => {
    await renderWidget(page, {
      channels: [{ name: "Ch1", gain: 1, pan: 0, mute: false, solo: false }],
    });

    const panLabel = page
      .locator(`${STRIP}`)
      .nth(0)
      .locator(".nbplay-strip-pan-label");
    await expect(panLabel).toHaveText("C");

    await panLabel.dblclick();

    const input = page.locator(".nbplay-mixer-inline-edit");
    await expect(input).toBeVisible();

    // Pan label edit accepts raw numeric values
    await input.fill("-0.4");
    await input.press("Enter");

    const pan = await page.evaluate(
      () => window.__testModel._state.channels[0].pan,
    );
    expect(pan).toBeCloseTo(-0.4, 2);
  });

  // 22. Renders empty mixer
  test("renders empty mixer with no channel strips", async ({ page }) => {
    await renderWidget(page, { channels: [] });
    await expect(page.locator(STRIP)).toHaveCount(0);
    // Master strip should still be present
    await expect(page.locator(".nbplay-master-strip")).toBeVisible();
  });

  // Additional edge cases

  test("adding a channel via model triggers DOM rebuild", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(STRIP)).toHaveCount(2);

    await page.evaluate(() => {
      const chs = [...window.__testModel._state.channels];
      chs.push({ name: "Drums", gain: 0.8, pan: 0, mute: false, solo: false });
      window.__testModel.set("channels", chs);
      window.__testModel._trigger("change:channels");
    });

    await expect(page.locator(STRIP)).toHaveCount(3);
    await expect(
      page.locator(`${STRIP}`).nth(2).locator(".nbplay-strip-name"),
    ).toHaveText("Drums");
  });

  test("mute and solo save_changes to model", async ({ page }) => {
    await renderWidget(page);
    const muteBtn = page.locator(`${STRIP}`).nth(0).locator(".nbplay-mute-btn");
    await muteBtn.click();

    const saved = await page.evaluate(() =>
      window.__testModel._history.some((h) => h.type === "save"),
    );
    expect(saved).toBe(true);
  });

  test("gain label inline edit with -inf sets gain to 0", async ({ page }) => {
    await renderWidget(page);
    const gainLabel = page
      .locator(`${STRIP}`)
      .nth(0)
      .locator(".nbplay-strip-gain-label");
    await gainLabel.dblclick();

    const input = page.locator(".nbplay-mixer-inline-edit");
    await input.fill("-inf");
    await input.press("Enter");

    const gain = await page.evaluate(
      () => window.__testModel._state.channels[0].gain,
    );
    expect(gain).toBe(0);
  });

  test("invalid gain inline edit is ignored", async ({ page }) => {
    await renderWidget(page);
    const gainLabel = page
      .locator(`${STRIP}`)
      .nth(0)
      .locator(".nbplay-strip-gain-label");
    await gainLabel.dblclick();

    const input = page.locator(".nbplay-mixer-inline-edit");
    await input.fill("not-a-number");
    await input.press("Enter");

    // Gain should remain unchanged
    const gain = await page.evaluate(
      () => window.__testModel._state.channels[0].gain,
    );
    expect(gain).toBe(1.0);
  });

  test("pan=−0.2 for Bass channel displays as L20", async ({ page }) => {
    await renderWidget(page);
    const panLabels = page.locator(`${STRIP} .nbplay-strip-pan-label`);
    // Bass has pan = -0.2
    await expect(panLabels.nth(1)).toHaveText("L20");
  });

  test("+ Channel button adds a new channel strip", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(STRIP)).toHaveCount(2);

    await page.locator(".nbplay-mixer-add-btn").click();

    await expect(page.locator(STRIP)).toHaveCount(3);
    const newName = page
      .locator(`${STRIP}`)
      .nth(2)
      .locator(".nbplay-strip-name");
    await expect(newName).toHaveText("Ch 3");
  });

  test("remove button removes a channel strip", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(STRIP)).toHaveCount(2);

    await page
      .locator(`${STRIP}`)
      .nth(0)
      .locator(".nbplay-strip-remove")
      .click();

    await expect(page.locator(STRIP)).toHaveCount(1);
    await expect(page.locator(`${STRIP} .nbplay-strip-name`)).toHaveText(
      "Bass",
    );
  });
});
