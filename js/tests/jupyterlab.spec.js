import { test, expect } from "@playwright/test";

// Host compatibility: JupyterLab 4 with the ipywidgets lab manager. Open the
// smoke notebook, run every cell, and drive the rendered session widgets.

const LAB = "http://127.0.0.1:8899";

test.describe("JupyterLab host", () => {
  test("session widgets render and sync with the kernel", async ({ page }) => {
    await page.goto(`${LAB}/lab/tree/host_smoke.ipynb?reset`);
    const notebook = page.locator(".jp-NotebookPanel:visible .jp-Notebook");
    await expect(notebook).toBeVisible({ timeout: 120 * 1000 });
    // Wait for the kernel to be idle before running.
    await expect(
      page.locator(".jp-NotebookPanel:visible .jp-Notebook-ExecutionIndicator"),
    ).toBeVisible({ timeout: 120 * 1000 });

    // Run all cells: focus the first cell, then Shift+Enter through both.
    await notebook.locator(".jp-Cell").first().click();
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.press("Shift+Enter");

    const transport = page.locator(".nbplay-transport");
    await expect(transport).toBeVisible({ timeout: 120 * 1000 });
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

    await page.locator(".nbplay-transport-play").click();
    await expect(page.locator(".nbplay-seq-play")).toContainText("\u23F8");
    await expect(page.locator(".nbplay-timeline-play")).toHaveText("Stop");
    await expect(page.locator("#nbplay-kernel-state")).toHaveText(
      "kernel: playing",
      { timeout: 15 * 1000 },
    );

    await page.locator("button.nbplay-voila-stop").click();
    await expect(page.locator(".nbplay-transport-play")).toContainText(
      "\u25B6",
      { timeout: 15 * 1000 },
    );
    await expect(page.locator("#nbplay-kernel-state")).toHaveText(
      "kernel: stopped",
    );

    expect(errors).toEqual([]);
  });
});
