import { test, expect } from "@playwright/test";

// The browser-only demo: JupyterLite + Pyodide + the nbplay wheel.

test.describe("JupyterLite demo", () => {
  test("runs the synth example on the Pyodide kernel", async ({ page }) => {
    await page.goto("/lite/lab/index.html?path=03_synth.ipynb");
    const notebook = page.locator(".jp-NotebookPanel:visible .jp-Notebook");
    await expect(notebook).toBeVisible({ timeout: 180 * 1000 });

    // Run every cell: the first installs nbplay from the bundled wheel.
    const synth = page.locator(".nbplay-synth");
    for (let attempt = 0; attempt < 3; attempt++) {
      const dialog = page.locator(".jp-Dialog");
      if (await dialog.isVisible()) {
        await dialog.locator("button.jp-mod-accept").click();
        await expect(dialog).toBeHidden({ timeout: 30 * 1000 });
      }
      try {
        await notebook
          .locator(".jp-Cell")
          .first()
          .click({ timeout: 10 * 1000 });
      } catch (error) {
        if (attempt === 2) throw error;
        continue;
      }
      const cellCount = await notebook.locator(".jp-Cell").count();
      for (let i = 0; i < cellCount; i++) {
        await page.keyboard.press("Shift+Enter");
      }
      try {
        await expect(synth.first()).toBeVisible({ timeout: 240 * 1000 });
        break;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    await expect(synth.first()).toBeVisible();

    // No Python errors anywhere in the outputs.
    const errors = await page
      .locator(
        ".jp-OutputArea-output[data-mime-type='application/vnd.jupyter.stderr']",
      )
      .allTextContents();
    expect(errors.filter((text) => /Error|Traceback/.test(text))).toEqual([]);
  });
});
