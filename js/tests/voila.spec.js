import { test, expect } from "@playwright/test";

// Host compatibility: Voila renders the notebook through the standard
// ipywidgets manager with a live kernel. The widgets must render, follow
// the shared clock in the browser, and round-trip state with the kernel.

test.describe("Voila host", () => {
  test("session widgets render and sync with the kernel", async ({ page }) => {
    await page.goto("http://127.0.0.1:8866/");
    const transport = page.locator(".nbplay-transport");
    await expect(transport).toBeVisible({ timeout: 90 * 1000 });
    // Host startup noise (third-party lab extensions, settings fetches) is
    // not nbplay's: only collect page errors once our widgets are up.
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await expect(page.locator(".nbplay-sequencer")).toBeVisible();
    await expect(page.locator(".nbplay-launcher")).toBeVisible();
    await expect(page.locator(".nbplay-timeline")).toBeVisible();
    await expect(page.locator(".nbplay-mixer")).toBeVisible();
    await expect(page.locator("#nbplay-kernel-state")).toHaveText(
      "kernel: stopped",
    );

    // Browser -> browser (shared clock) and browser -> kernel.
    await page.locator(".nbplay-transport-play").click();
    await expect(page.locator(".nbplay-seq-play")).toContainText("⏸");
    await expect(page.locator(".nbplay-timeline-play")).toHaveText("Stop");
    await expect(page.locator("#nbplay-kernel-state")).toHaveText(
      "kernel: playing",
      { timeout: 15 * 1000 },
    );
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const bus = Object.values(globalThis.__nbplay || {})[0];
            return bus?.clock?.beat() || 0;
          }),
        { timeout: 10 * 1000 },
      )
      .toBeGreaterThan(0);

    // Launch a slot while playing: it becomes active on the next bar.
    await page
      .locator('.nbplay-launcher-slot[data-track="0"][data-scene="0"]')
      .click();
    await expect(
      page.locator('.nbplay-launcher-slot[data-track="0"][data-scene="0"]'),
    ).toHaveClass(/active/, { timeout: 15 * 1000 });

    // Kernel -> browser: a plain ipywidgets button calls session.stop().
    await page.locator("button.nbplay-voila-stop").click();
    await expect(page.locator(".nbplay-transport-play")).toContainText("▶", {
      timeout: 15 * 1000,
    });
    await expect(page.locator(".nbplay-seq-play")).toContainText("▶");
    await expect(page.locator("#nbplay-kernel-state")).toHaveText(
      "kernel: stopped",
    );

    expect(errors).toEqual([]);
  });
});
