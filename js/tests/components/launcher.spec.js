import { test, expect } from "@playwright/test";
import { mount, events } from "./mount.js";

test.describe("launcher composites", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("slot launches on click and shows progress, queue and empty state", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-launcher-slot",
      { name: "Beat A", active: true, progress: 0.4 },
      ["nbplay-launch"],
    );
    await page.locator("nbplay-launcher-slot button").click();
    expect(await events(page)).toEqual([["nbplay-launch", {}]]);
    const fill = await page
      .locator("nbplay-launcher-slot .nbplay-bar-fill")
      .evaluate((el) => el.style.getPropertyValue("--nbplay-bar-fill"));
    expect(parseFloat(fill)).toBeCloseTo(40, 0);
    await page.evaluate(() => {
      const el = document.querySelector("nbplay-launcher-slot");
      el.active = false;
      el.queued = true;
      el.name = "";
    });
    await expect(page.locator("nbplay-launcher-slot button")).toHaveClass(
      /empty/,
    );
    await expect(
      page.locator("nbplay-launcher-slot .nbplay-launcher-slot-next"),
    ).toHaveText("stop");
    await expect(page.locator("nbplay-launcher-slot")).toHaveAttribute(
      "queued",
      "",
    );
  });

  test("grid routes slot, scene, stop-track and stop-all intents", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-launcher-grid",
      {
        tracks: [{ name: "Drums" }, { name: "Bass", detail: "Ch 2" }],
        scenes: ["A", "B"],
        slots: [
          { track: 0, scene: 0, name: "Kick" },
          { track: 1, scene: 0, name: "Bass A" },
          { track: 1, scene: 1, name: "Bass B" },
        ],
        active: [0, 0],
        queued: [-1, -2],
        progress: [0.5, 0.5],
        selected: { track: 1, scene: 1 },
      },
      [
        "nbplay-launch",
        "nbplay-launch-scene",
        "nbplay-stop-track",
        "nbplay-stop-all",
      ],
    );
    await expect(
      page.locator("nbplay-launcher-grid nbplay-launcher-slot"),
    ).toHaveCount(4);
    await expect(
      page.locator(
        'nbplay-launcher-grid .nbplay-launcher-grid-scene[data-scene="0"]',
      ),
    ).toHaveClass(/active/);
    await expect(
      page.locator(
        'nbplay-launcher-grid nbplay-launcher-slot[data-track="1"][data-scene="1"]',
      ),
    ).toHaveAttribute("selected", "");
    // a queued stop marks the empty slots of that track and its stop button
    await expect(
      page.locator(
        'nbplay-launcher-grid nbplay-launcher-slot[data-track="0"][data-scene="1"]',
      ),
    ).not.toHaveAttribute("queued", "");
    await expect(
      page.locator(
        'nbplay-launcher-grid [data-track="1"] .nbplay-launcher-grid-track-stop',
      ),
    ).toHaveClass(/queued/);
    await page
      .locator(
        'nbplay-launcher-grid nbplay-launcher-slot[data-track="1"][data-scene="1"] button',
      )
      .click();
    await page
      .locator(
        'nbplay-launcher-grid .nbplay-launcher-grid-scene[data-scene="1"]',
      )
      .click();
    await page
      .locator(
        'nbplay-launcher-grid [data-track="0"] .nbplay-launcher-grid-track-stop',
      )
      .click();
    await page
      .locator("nbplay-launcher-grid .nbplay-launcher-grid-stop-all")
      .click();
    expect(await events(page)).toEqual([
      ["nbplay-launch", { track: 1, scene: 1 }],
      ["nbplay-launch-scene", { scene: 1 }],
      ["nbplay-stop-track", { track: 0 }],
      ["nbplay-stop-all", {}],
    ]);
  });
});
