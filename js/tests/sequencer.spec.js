import { test, expect } from "@playwright/test";

// Shared defaults & setup

const DEFAULTS = {
  session_id: "",
  channel_index: -1,
  keyboard_connected: false,
  length: 8,
  measures: 1,
  time_signature_num: 4,
  time_signature_den: 4,
  voices_data: [
    Array.from({ length: 8 }, (_, i) => ({
      active: i % 2 === 0,
      note: 60,
      velocity: 100,
    })),
  ],
  num_voices: 1,
  current_step: 0,
  bpm: 120,
  step_duration: 0.5,
  loop_enabled: true,
  is_playing: false,
};

/** Boot the sequencer widget inside the harness page. */
async function renderWidget(page, overrides = {}) {
  const opts = { ...DEFAULTS, ...overrides };
  if (overrides.voices_data) opts.voices_data = overrides.voices_data;
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

// Tests

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

  test("explicit 8-step model displays matching bar and step controls", async ({
    page,
  }) => {
    await renderWidget(page, {
      length: 8,
      measures: 1,
      step_duration: 0.25,
      voices_data: [
        Array.from({ length: 8 }, () => ({
          active: false,
          note: 60,
          velocity: 100,
        })),
      ],
    });

    await expect(page.locator(".nbplay-seq-cell")).toHaveCount(8);
    await expect(page.locator(".nbplay-seq-dur-select")).toHaveValue("0.5");
    await expect(page.locator(".nbplay-seq-length-val")).toHaveText("8 steps");
    await expect(page.locator(".nbplay-seq-info")).toContainText(
      "1 measure · 8 steps",
    );
    const state = await page.evaluate(() => ({
      length: window.__testModel._state.length,
      stepDuration: window.__testModel._state.step_duration,
    }));
    expect(state).toEqual({ length: 8, stepDuration: 0.5 });
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

    const active = await page.evaluate(
      () => window.__testModel._state.voices_data[0][1].active,
    );
    expect(active).toBe(true);
    await expect(cell1).toHaveClass(/active/);

    // Click again to deactivate
    await cell1.click();
    const deactivated = await page.evaluate(
      () => window.__testModel._state.voices_data[0][1].active,
    );
    expect(deactivated).toBe(false);
    await expect(cell1).not.toHaveClass(/active/);
  });

  // 6. Current step highlighted
  test("current step has .current class", async ({ page }) => {
    await renderWidget(page);
    // Render resets current_step to -1; advance it to 0
    await page.evaluate(() => {
      window.__testModel.set("current_step", 0);
      window.__testModel._trigger("change:current_step");
    });
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
    const playing = await page.evaluate(
      () => window.__testModel._state.is_playing,
    );
    expect(playing).toBe(true);

    // save_changes auto-fires change:is_playing → onModelChange → button becomes ⏸
    await expect(btn).toContainText("⏸");

    await btn.click();
    const stopped = await page.evaluate(
      () => window.__testModel._state.is_playing,
    );
    expect(stopped).toBe(false);
    await expect(btn).toContainText("▶");
  });

  // 9. Stop button resets playback
  test("stop button stops playback and resets current_step", async ({
    page,
  }) => {
    await renderWidget(page, { is_playing: true });
    const stopBtn = page.locator(".nbplay-seq-stop");

    await stopBtn.click();
    const playing = await page.evaluate(
      () => window.__testModel._state.is_playing,
    );
    expect(playing).toBe(false);
    const step = await page.evaluate(
      () => window.__testModel._state.current_step,
    );
    expect(step).toBe(-1);
  });

  // 10. Model change:voices_data updates step display
  test("model change:voices_data updates step display", async ({ page }) => {
    await renderWidget(page);

    await page.evaluate(() => {
      const newSteps = Array.from({ length: 4 }, () => ({
        active: true,
        note: 60,
        velocity: 100,
      }));
      window.__testModel.set("voices_data", [newSteps]);
      window.__testModel._trigger("change:voices_data");
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

    // Render resets current_step to -1; advance it to 0 first
    await page.evaluate(() => {
      window.__testModel.set("current_step", 0);
      window.__testModel._trigger("change:current_step");
    });
    await expect(cells.nth(0)).toHaveClass(/current/);

    await page.evaluate(() => {
      window.__testModel.set("current_step", 3);
      window.__testModel._trigger("change:current_step");
    });

    await expect(cells.nth(3)).toHaveClass(/current/);
    await expect(cells.nth(0)).not.toHaveClass(/current/);
  });

  // 12. BPM double-click edit — type "140", Enter, verify model
  test("dblclick BPM val, type 140, Enter → model updated", async ({
    page,
  }) => {
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
  test("Escape during BPM inline edit cancels without update", async ({
    page,
  }) => {
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
  test("Enter commit does not crash when blur fires afterwards", async ({
    page,
  }) => {
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
    const disabled = await page.evaluate(
      () => window.__testModel._state.loop_enabled,
    );
    expect(disabled).toBe(false);

    await loopChk.check();
    const reEnabled = await page.evaluate(
      () => window.__testModel._state.loop_enabled,
    );
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
  test("step duration select updates step_duration in model", async ({
    page,
  }) => {
    await renderWidget(page);
    const durSelect = page.locator(".nbplay-seq-dur-select");
    await expect(durSelect).toHaveValue("0.5");

    await durSelect.selectOption("0.25");
    const val = await page.evaluate(
      () => window.__testModel._state.step_duration,
    );
    expect(val).toBe(0.25);
    await expect(page.locator(".nbplay-seq-cell")).toHaveCount(16);
  });

  test("measure and step controls configure one measure of eighth notes", async ({
    page,
  }) => {
    await renderWidget(page, {
      length: 16,
      measures: 1,
      step_duration: 0.25,
      voices_data: [
        Array.from({ length: 16 }, (_, i) => ({
          active: i === 0,
          note: i === 0 ? 72 : 60,
          velocity: i === 0 ? 88 : 100,
        })),
      ],
    });

    const measuresInput = page.locator(".nbplay-seq-measures-input");
    await expect(measuresInput).toHaveValue("1");

    await page.locator(".nbplay-seq-dur-select").selectOption("0.5");

    await expect(page.locator(".nbplay-seq-cell")).toHaveCount(8);
    const state = await page.evaluate(() => ({
      length: window.__testModel._state.length,
      measures: window.__testModel._state.measures,
      stepDuration: window.__testModel._state.step_duration,
      voiceLengths: window.__testModel._state.voices_data.map(
        (voice) => voice.length,
      ),
      firstStep: window.__testModel._state.voices_data[0][0],
    }));

    expect(state.length).toBe(8);
    expect(state.measures).toBe(1);
    expect(state.stepDuration).toBe(0.5);
    expect(state.voiceLengths).toEqual([8]);
    expect(state.firstStep.note).toBe(72);
    expect(state.firstStep.velocity).toBe(88);
    expect(state.firstStep.active).toBe(true);
    await expect(page.locator(".nbplay-seq-info")).toContainText("1 measure");
    await expect(page.locator(".nbplay-seq-info")).toContainText("8 steps");
  });

  test("measure control expands to four measures of sixteenth notes", async ({
    page,
  }) => {
    await renderWidget(page, {
      length: 16,
      measures: 1,
      step_duration: 0.25,
      voices_data: [
        Array.from({ length: 16 }, (_, i) => ({
          active: i === 15,
          note: 60,
          velocity: 100,
        })),
      ],
    });

    await page.locator(".nbplay-seq-measures-input").fill("4");

    await expect(page.locator(".nbplay-seq-cell")).toHaveCount(64);
    const state = await page.evaluate(() => ({
      length: window.__testModel._state.length,
      measures: window.__testModel._state.measures,
      voiceLengths: window.__testModel._state.voices_data.map(
        (voice) => voice.length,
      ),
      preservedStep: window.__testModel._state.voices_data[0][15],
    }));
    expect(state.length).toBe(64);
    expect(state.measures).toBe(4);
    expect(state.voiceLengths).toEqual([64]);
    expect(state.preservedStep.active).toBe(true);
    await expect(page.locator(".nbplay-seq-info")).toContainText("4 measures");
    await expect(page.locator(".nbplay-seq-info")).toContainText("64 steps");
  });

  test("time signature model changes resize configured measure grid", async ({
    page,
  }) => {
    await renderWidget(page, {
      length: 8,
      measures: 1,
      step_duration: 0.5,
      time_signature_num: 4,
      time_signature_den: 4,
      voices_data: [
        Array.from({ length: 8 }, () => ({
          active: false,
          note: 60,
          velocity: 100,
        })),
      ],
    });

    await page.evaluate(() => {
      window.__testModel.set("time_signature_num", 3);
      window.__testModel._trigger("change:time_signature_num");
    });

    await expect(page.locator(".nbplay-seq-cell")).toHaveCount(6);
    const state = await page.evaluate(() => ({
      length: window.__testModel._state.length,
      voiceLengths: window.__testModel._state.voices_data.map(
        (voice) => voice.length,
      ),
    }));
    expect(state.length).toBe(6);
    expect(state.voiceLengths).toEqual([6]);
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
    // Render resets current_step to -1; advance it to 0
    await page.evaluate(() => {
      window.__testModel.set("current_step", 0);
      window.__testModel._trigger("change:current_step");
    });
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
    await expect(info).toContainText("4/8 steps active");
    await expect(info).toContainText("120 BPM");
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
    await expect(durSelect).toHaveValue("0.5");

    await page.evaluate(() => {
      window.__testModel.set("step_duration", 0.25);
      window.__testModel._trigger("change:step_duration");
    });
    await expect(durSelect).toHaveValue("0.25");
  });

  // 24. Multi-voice grid renders rows for each voice
  test("multi-voice grid renders step and vel rows per voice", async ({
    page,
  }) => {
    const voice0 = Array.from({ length: 4 }, () => ({
      active: true,
      note: 60,
      velocity: 100,
    }));
    const voice1 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 72,
      velocity: 80,
    }));
    await renderWidget(page, {
      voices_data: [voice0, voice1],
      num_voices: 2,
    });

    // 2 voices × 4 steps = 8 step cells total
    await expect(page.locator(".nbplay-seq-cell")).toHaveCount(8);
    // 2 velocity rows × 4 bars = 8 vel bars
    await expect(page.locator(".nbplay-seq-vel-bar")).toHaveCount(8);

    // Voice 0 cells show C4, voice 1 cells show C5
    const cells = page.locator(".nbplay-seq-cell");
    await expect(cells.nth(0)).toHaveText("C4");
    await expect(cells.nth(4)).toHaveText("C5");

    // Voice 0 cells are active, voice 1 cells are not
    await expect(cells.nth(0)).toHaveClass(/active/);
    await expect(cells.nth(4)).not.toHaveClass(/active/);

    // Click voice 1 step 0 to toggle
    await cells.nth(4).click();
    const active = await page.evaluate(
      () => window.__testModel._state.voices_data[1][0].active,
    );
    expect(active).toBe(true);
    await expect(cells.nth(4)).toHaveClass(/active/);

    // Info shows combined count
    const info = page.locator(".nbplay-seq-info");
    await expect(info).toContainText("5/8 steps active");
    await expect(info).toContainText("2 voices");
  });

  // 17. REC button hidden when keyboard not connected
  test("REC button hidden by default", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-seq-rec")).toBeHidden();
  });

  // 18. REC button visible when keyboard_connected
  test("REC button visible when keyboard_connected", async ({ page }) => {
    await renderWidget(page, { keyboard_connected: true });
    await expect(page.locator(".nbplay-seq-rec")).toBeVisible();
  });

  // 19. REC button toggles recording class
  test("REC button toggles recording state", async ({ page }) => {
    await renderWidget(page, { keyboard_connected: true });
    const recBtn = page.locator(".nbplay-seq-rec");
    await recBtn.click();
    await expect(recBtn).toHaveClass(/recording/);
    await recBtn.click();
    await expect(recBtn).not.toHaveClass(/recording/);
  });

  // 20. REC records note from document CustomEvent
  test("REC records note from CustomEvent", async ({ page }) => {
    await renderWidget(page, { keyboard_connected: true });
    const recBtn = page.locator(".nbplay-seq-rec");

    // Start recording
    await recBtn.click();

    // Simulate play: set is_playing and current_step
    await page.evaluate(() => {
      window.__testModel.set("is_playing", true);
      window.__testModel.set("current_step", 2);
    });

    // Dispatch a note event like the keyboard would
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent("nbplay-note", {
          detail: { note: 72, velocity: 110, type: "on" },
        }),
      );
    });

    // Check that voice 0 step 2 was updated
    const step = await page.evaluate(
      () => window.__testModel._state.voices_data[0][2],
    );
    expect(step.note).toBe(72);
    expect(step.velocity).toBe(110);
    expect(step.active).toBe(true);
  });

  // 21. Double-click step shows ♪? when keyboard connected
  test("double-click step shows note prompt when keyboard connected", async ({
    page,
  }) => {
    await renderWidget(page, { keyboard_connected: true });
    const cell = page.locator(".nbplay-seq-cell").first();
    await cell.dblclick();
    await expect(cell).toHaveText("♪?");
    await expect(cell).toHaveClass(/nbplay-seq-key-wait/);
  });

  // 22. ♪? resolves when receiving note CustomEvent
  test("pending keyboard edit resolves on note event", async ({ page }) => {
    await renderWidget(page, { keyboard_connected: true });
    const cell = page.locator(".nbplay-seq-cell").first();
    await cell.dblclick();
    await expect(cell).toHaveText("♪?");

    // Dispatch a note
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent("nbplay-note", {
          detail: { note: 64, velocity: 90, type: "on" },
        }),
      );
    });

    // Step should be updated
    const step = await page.evaluate(
      () => window.__testModel._state.voices_data[0][0],
    );
    expect(step.note).toBe(64);
    expect(step.velocity).toBe(90);
    expect(step.active).toBe(true);
  });

  // 23. Sequencer root is focusable (tabIndex)
  test("sequencer root is focusable", async ({ page }) => {
    await renderWidget(page);
    const seq = page.locator(".nbplay-sequencer");
    const tabIndex = await seq.getAttribute("tabindex");
    expect(tabIndex).toBe("0");
  });

  // 24. nbplay-cancel-edit CustomEvent cancels ♪? edit
  test("nbplay-cancel-edit CustomEvent cancels pending edit", async ({
    page,
  }) => {
    await renderWidget(page, { keyboard_connected: true });
    const cell = page.locator(".nbplay-seq-cell").first();
    await cell.dblclick();
    await expect(cell).toHaveText("♪?");

    // Dispatch cancel event (as keyboard would on Escape)
    await page.evaluate(() => {
      const seq = document.querySelector(".nbplay-sequencer");
      seq.dispatchEvent(new CustomEvent("nbplay-cancel-edit"));
    });

    // Cell should restore original note name
    await expect(cell).not.toHaveText("♪?");
    await expect(cell).not.toHaveClass(/nbplay-seq-key-wait/);
  });

  // 25. Double-click step does NOT toggle active state
  test("double-click step does not toggle active (only single-click toggles)", async ({
    page,
  }) => {
    await renderWidget(page, { keyboard_connected: true });
    const cell = page.locator(".nbplay-seq-cell").first();
    // Step 0 starts active (even indices)
    await expect(cell).toHaveClass(/active/);

    // Double-click should show ♪? without toggling active state
    await cell.dblclick();
    await expect(cell).toHaveText("♪?");

    // Check model — step 0 should still be active (not toggled)
    const stillActive = await page.evaluate(
      () => window.__testModel._state.voices_data[0][0].active,
    );
    expect(stillActive).toBe(true);
  });

  // 26. REC button has recording CSS styling
  test("REC button gets red pulsing style when recording", async ({ page }) => {
    await renderWidget(page, { keyboard_connected: true });
    const recBtn = page.locator(".nbplay-seq-rec");
    await recBtn.click();
    await expect(recBtn).toHaveClass(/recording/);
    // Verify the button has a red-ish background from CSS
    const bg = await recBtn.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    // Should not be transparent/empty — the .recording class sets a red background
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");
  });

  // 27. Per-voice REC dots visible when keyboard connected
  test("per-voice REC dots visible when keyboard connected", async ({
    page,
  }) => {
    const voice0 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 60,
      velocity: 100,
    }));
    const voice1 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 72,
      velocity: 80,
    }));
    await renderWidget(page, {
      voices_data: [voice0, voice1],
      num_voices: 2,
      keyboard_connected: true,
    });
    const dots = page.locator(".nbplay-seq-voice-rec");
    await expect(dots).toHaveCount(2);
    await expect(dots.nth(0)).toBeVisible();
    await expect(dots.nth(1)).toBeVisible();
  });

  // 28. Per-voice REC dots hidden when keyboard not connected
  test("per-voice REC dots hidden when keyboard not connected", async ({
    page,
  }) => {
    const voice0 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 60,
      velocity: 100,
    }));
    const voice1 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 72,
      velocity: 80,
    }));
    await renderWidget(page, {
      voices_data: [voice0, voice1],
      num_voices: 2,
      keyboard_connected: false,
    });
    const dots = page.locator(".nbplay-seq-voice-rec");
    await expect(dots).toHaveCount(2);
    await expect(dots.nth(0)).toBeHidden();
    await expect(dots.nth(1)).toBeHidden();
  });

  // 29. Per-voice REC dot toggles individual voice recording
  test("per-voice REC dot toggles individual voice recording", async ({
    page,
  }) => {
    const voice0 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 60,
      velocity: 100,
    }));
    const voice1 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 72,
      velocity: 80,
    }));
    await renderWidget(page, {
      voices_data: [voice0, voice1],
      num_voices: 2,
      keyboard_connected: true,
    });
    const dots = page.locator(".nbplay-seq-voice-rec");

    // Click voice 1 REC dot
    await dots.nth(1).click();
    await expect(dots.nth(1)).toHaveClass(/recording/);
    await expect(dots.nth(0)).not.toHaveClass(/recording/);

    // Global REC should also show recording (any voice armed)
    await expect(page.locator(".nbplay-seq-rec")).toHaveClass(/recording/);

    // Toggle it off
    await dots.nth(1).click();
    await expect(dots.nth(1)).not.toHaveClass(/recording/);
    await expect(page.locator(".nbplay-seq-rec")).not.toHaveClass(/recording/);
  });

  // 30. Global REC arms all voices
  test("global REC arms all voices", async ({ page }) => {
    const voice0 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 60,
      velocity: 100,
    }));
    const voice1 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 72,
      velocity: 80,
    }));
    await renderWidget(page, {
      voices_data: [voice0, voice1],
      num_voices: 2,
      keyboard_connected: true,
    });

    const recBtn = page.locator(".nbplay-seq-rec");
    const dots = page.locator(".nbplay-seq-voice-rec");

    // Click global REC → arms all voices
    await recBtn.click();
    await expect(recBtn).toHaveClass(/recording/);
    await expect(dots.nth(0)).toHaveClass(/recording/);
    await expect(dots.nth(1)).toHaveClass(/recording/);

    // Click global REC again → disarms all
    await recBtn.click();
    await expect(recBtn).not.toHaveClass(/recording/);
    await expect(dots.nth(0)).not.toHaveClass(/recording/);
    await expect(dots.nth(1)).not.toHaveClass(/recording/);
  });

  // 31. Per-voice recording writes to armed voice
  test("per-voice recording writes note to armed voice only", async ({
    page,
  }) => {
    const voice0 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 60,
      velocity: 100,
    }));
    const voice1 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 72,
      velocity: 80,
    }));
    await renderWidget(page, {
      voices_data: [voice0, voice1],
      num_voices: 2,
      keyboard_connected: true,
    });

    // Arm only voice 1
    const dots = page.locator(".nbplay-seq-voice-rec");
    await dots.nth(1).click();

    // Simulate play
    await page.evaluate(() => {
      window.__testModel.set("is_playing", true);
      window.__testModel.set("current_step", 1);
    });

    // Dispatch a note
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent("nbplay-note", {
          detail: { note: 64, velocity: 90, type: "on" },
        }),
      );
    });

    // Voice 1 step 1 should be updated
    const step1 = await page.evaluate(
      () => window.__testModel._state.voices_data[1][1],
    );
    expect(step1.note).toBe(64);
    expect(step1.velocity).toBe(90);
    expect(step1.active).toBe(true);

    // Voice 0 step 1 should be unchanged
    const step0 = await page.evaluate(
      () => window.__testModel._state.voices_data[0][1],
    );
    expect(step0.note).toBe(60);
    expect(step0.active).toBe(false);
  });

  // 32. REC to multiple armed voices simultaneously
  test("recording with multiple voices armed writes to all", async ({
    page,
  }) => {
    const voice0 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 60,
      velocity: 100,
    }));
    const voice1 = Array.from({ length: 4 }, () => ({
      active: false,
      note: 72,
      velocity: 80,
    }));
    await renderWidget(page, {
      voices_data: [voice0, voice1],
      num_voices: 2,
      keyboard_connected: true,
    });

    // Arm both voices via global REC
    await page.locator(".nbplay-seq-rec").click();

    // Simulate play
    await page.evaluate(() => {
      window.__testModel.set("is_playing", true);
      window.__testModel.set("current_step", 0);
    });

    // Dispatch a note
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent("nbplay-note", {
          detail: { note: 67, velocity: 120, type: "on" },
        }),
      );
    });

    // Both voices step 0 should be updated
    const s0 = await page.evaluate(
      () => window.__testModel._state.voices_data[0][0],
    );
    const s1 = await page.evaluate(
      () => window.__testModel._state.voices_data[1][0],
    );
    expect(s0.note).toBe(67);
    expect(s0.active).toBe(true);
    expect(s1.note).toBe(67);
    expect(s1.active).toBe(true);
  });

  // 33. Kernel disconnect stops playback
  test("kernel disconnect stops playback after delay", async ({ page }) => {
    await page.evaluate(async () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/sequencer.css";
      document.head.appendChild(link);

      const mod = await import("/dist/widgets/sequencer.js");
      const el = document.getElementById("root");
      const defaults = {
        session_id: "",
        channel_index: -1,
        keyboard_connected: false,
        voices_data: [
          Array.from({ length: 8 }, (_, i) => ({
            active: i % 2 === 0,
            note: 60,
            velocity: 100,
          })),
        ],
        num_voices: 1,
        current_step: 0,
        bpm: 120,
        step_duration: 0.25,
        loop_enabled: true,
        is_playing: false,
      };
      const model = window.createMockModel(defaults);
      // Set comm as a direct property so onKernelDisconnect sees it
      model.comm = {};
      window.__testModel = model;
      mod.default.render({ model, el });
    });

    // Start playing
    await page.evaluate(() => {
      window.__testModel.set("is_playing", true);
      window.__testModel._trigger("change:is_playing");
    });
    const playing = await page.evaluate(
      () => window.__testModel._state.is_playing,
    );
    expect(playing).toBe(true);

    // Simulate kernel disconnect by removing comm
    await page.evaluate(() => {
      window.__testModel.comm = null;
    });

    // The helper polls every 2s, then waits 5s delay.
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
