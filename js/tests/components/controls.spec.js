import { test, expect } from "@playwright/test";
import { mount, events } from "./mount.js";

test.describe("segmented and header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("segmented picks one option and ignores the active one", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-segmented",
      {
        options: [
          "sine",
          "square",
          { value: "saw", label: "Saw" },
          { value: "noise", disabled: true },
        ],
        value: "sine",
      },
      ["change"],
    );
    const options = page.locator("nbplay-segmented .nbplay-segmented-option");
    await expect(options).toHaveText(["sine", "square", "Saw", "noise"]);
    await expect(options.nth(0)).toHaveClass(/active/);
    await options.nth(0).click();
    await options.nth(2).click();
    await expect(options.nth(2)).toHaveClass(/active/);
    await expect(options.nth(0)).not.toHaveClass(/active/);
    await expect(options.nth(3)).toBeDisabled();
    await expect(page.locator("nbplay-segmented")).toHaveAttribute(
      "value",
      "saw",
    );
    expect(await events(page)).toEqual([["change", { value: "saw" }]]);
  });

  test("header keeps its children as actions", async ({ page }) => {
    await page.evaluate(async () => {
      await window.__components;
      const root = document.getElementById("root");
      root.innerHTML =
        '<nbplay-header badge="sequencer" status="4 bars"><button id="act">+</button></nbplay-header>';
      await root.firstElementChild.updateComplete;
    });
    await expect(page.locator("nbplay-header .nbplay-header-title")).toHaveText(
      "nbplay",
    );
    await expect(page.locator("nbplay-header .nbplay-header-badge")).toHaveText(
      "sequencer",
    );
    await expect(
      page.locator("nbplay-header .nbplay-header-status"),
    ).toHaveText("4 bars");
    await expect(
      page.locator("nbplay-header .nbplay-header-actions #act"),
    ).toHaveCount(1);
    await page.evaluate(() => {
      document.querySelector("nbplay-header").badge = "mixer";
    });
    await expect(page.locator("nbplay-header .nbplay-header-badge")).toHaveText(
      "mixer",
    );
    await expect(
      page.locator("nbplay-header .nbplay-header-actions #act"),
    ).toHaveCount(1);
  });
});
