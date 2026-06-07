import { test, expect } from "@playwright/test";

test.describe("SettingsWidget", () => {
  async function renderWidget(page, overrides = {}) {
    await page.evaluate(async (overrides) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/settings.css";
      document.head.appendChild(link);
      const mod = await import("/dist/widgets/settings.js");
      const el = document.getElementById("root");
      const model = window.createMockModel({
        sample_rate: 44100,
        channels: 2,
        buffer_size: 512,
        audio_device: "default",
        midi_port: "",
        ...overrides,
      });
      window.__testModel = model;
      mod.default.render({ model, el });
    }, overrides);
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // 1. Renders container
  test("renders .nbplay-settings container", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-settings")).toBeVisible();
  });

  // 2. Shows header with badge
  test("shows header text and settings badge", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-header h3")).toHaveText("nbplay");
    await expect(page.locator(".nbplay-badge")).toHaveText("settings");
  });

  // 3. Sample rate dropdown has correct options
  test("sample rate dropdown has correct options", async ({ page }) => {
    await renderWidget(page);
    const select = page.locator(".nbplay-sr-select");
    await expect(select).toBeVisible();
    const texts = await select.locator("option").allTextContents();
    expect(texts).toEqual(["22050 Hz", "44100 Hz", "48000 Hz", "96000 Hz"]);
  });

  // 4. Channels dropdown has correct options
  test("channels dropdown has correct options", async ({ page }) => {
    await renderWidget(page);
    const select = page.locator(".nbplay-ch-select");
    await expect(select).toBeVisible();
    const texts = await select.locator("option").allTextContents();
    expect(texts).toEqual(["Mono", "Stereo"]);
  });

  // 5. Buffer size dropdown has correct options
  test("buffer size dropdown has correct options", async ({ page }) => {
    await renderWidget(page);
    const select = page.locator(".nbplay-buf-select");
    await expect(select).toBeVisible();
    const texts = await select.locator("option").allTextContents();
    expect(texts).toEqual(["128", "256", "512", "1024", "2048"]);
  });

  // 6. Changing sample rate dropdown updates model
  test("changing sample rate dropdown updates model", async ({ page }) => {
    await renderWidget(page);
    await page.locator(".nbplay-sr-select").selectOption("22050");

    const val = await page.evaluate(
      () => window.__testModel._state.sample_rate,
    );
    expect(val).toBe(22050);
  });

  // 7. Changing channels dropdown updates model
  test("changing channels dropdown updates model", async ({ page }) => {
    await renderWidget(page);
    await page.locator(".nbplay-ch-select").selectOption("1");

    const val = await page.evaluate(() => window.__testModel._state.channels);
    expect(val).toBe(1);
  });

  // 8. MIDI section is present
  test("MIDI section is present", async ({ page }) => {
    await renderWidget(page);
    // The MIDI section is the second .nbplay-section; verify via its title text
    const midiTitle = page.locator(".nbplay-section-title", {
      hasText: "MIDI Input",
    });
    await expect(midiTitle).toBeVisible();
    await expect(page.locator(".nbplay-midi-select")).toBeVisible();
    await expect(page.locator(".nbplay-refresh-btn")).toBeVisible();
    await expect(page.locator(".nbplay-midi-status")).toBeVisible();
    await expect(page.locator(".nbplay-midi-log")).toBeAttached();
  });

  // 9. Model change:sample_rate updates dropdown
  test("model change:sample_rate updates sample rate dropdown", async ({
    page,
  }) => {
    await renderWidget(page);

    await page.evaluate(() => {
      window.__testModel.set("sample_rate", 48000);
      window.__testModel._trigger("change:sample_rate");
    });

    const val = await page.locator(".nbplay-sr-select").inputValue();
    expect(val).toBe("48000");
  });

  // 10. Model change:channels updates dropdown
  test("model change:channels updates channels dropdown", async ({ page }) => {
    await renderWidget(page);

    await page.evaluate(() => {
      window.__testModel.set("channels", 1);
      window.__testModel._trigger("change:channels");
    });

    const val = await page.locator(".nbplay-ch-select").inputValue();
    expect(val).toBe("1");
  });

  // 11. Default sample rate selected
  test("default sample rate 44100 is selected", async ({ page }) => {
    await renderWidget(page);
    const val = await page.locator(".nbplay-sr-select").inputValue();
    expect(val).toBe("44100");
  });

  // 12. Default channels selected
  test("default channels 2 (Stereo) is selected", async ({ page }) => {
    await renderWidget(page);
    const val = await page.locator(".nbplay-ch-select").inputValue();
    expect(val).toBe("2");
  });

  // 13. Default buffer size selected
  test("default buffer size 512 is selected", async ({ page }) => {
    await renderWidget(page);
    const val = await page.locator(".nbplay-buf-select").inputValue();
    expect(val).toBe("512");
  });

  // 14. Changing buffer size dropdown updates model
  test("changing buffer size dropdown updates model", async ({ page }) => {
    await renderWidget(page);
    await page.locator(".nbplay-buf-select").selectOption("1024");

    const val = await page.evaluate(
      () => window.__testModel._state.buffer_size,
    );
    expect(val).toBe(1024);
  });

  // 15. Audio device shows device name from model
  test("audio device displays model value", async ({ page }) => {
    await renderWidget(page, { audio_device: "Built-in Speaker" });
    await expect(page.locator(".nbplay-audio-device")).toHaveText(
      "Built-in Speaker",
    );
  });

  // 16. Audio device shows Default when empty
  test("audio device shows Default when empty", async ({ page }) => {
    await renderWidget(page, { audio_device: "" });
    await expect(page.locator(".nbplay-audio-device")).toHaveText("Default");
  });

  // 17. Model change:buffer_size updates dropdown
  test("model change:buffer_size updates buffer size dropdown", async ({
    page,
  }) => {
    await renderWidget(page);

    await page.evaluate(() => {
      window.__testModel.set("buffer_size", 2048);
      window.__testModel._trigger("change:buffer_size");
    });

    const val = await page.locator(".nbplay-buf-select").inputValue();
    expect(val).toBe("2048");
  });

  // 18. MIDI status shows Idle by default
  test("MIDI status shows Idle by default", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-midi-status")).toHaveText("Idle");
  });

  // 19. MIDI port select defaults to Not connected
  test("MIDI port select defaults to Not connected", async ({ page }) => {
    await renderWidget(page);
    const select = page.locator(".nbplay-midi-select");
    const val = await select.inputValue();
    expect(val).toBe("");
    const texts = await select.locator("option").allTextContents();
    expect(texts).toContain("Not connected");
  });

  test("MIDI port select stays idle when Web MIDI is unavailable", async ({
    page,
  }) => {
    await page.evaluate(() => {
      navigator.requestMIDIAccess = undefined;
    });
    await renderWidget(page);

    await expect(page.locator(".nbplay-midi-status")).toHaveText("Idle");
    await expect(page.locator(".nbplay-midi-select option")).toHaveCount(1);
  });

  // 20. Model change:audio_device updates display
  test("model change:audio_device updates display", async ({ page }) => {
    await renderWidget(page);

    await page.evaluate(() => {
      window.__testModel.set("audio_device", "USB Audio");
      window.__testModel._trigger("change:audio_device");
    });

    await expect(page.locator(".nbplay-audio-device")).toHaveText("USB Audio");
  });
});
