import { test, expect } from "@playwright/test";
import { mount, events } from "./mount.js";

const ZONES = [
  { name: "Kick", low: 36, high: 47, root: 36, info: "0.42 s" },
  { name: "Keys", low: 60, high: 96, root: 72 },
];

test.describe("zone composites", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("zone map lays spans over 128 notes and selects on click", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-zone-map",
      { style: "display:block;width:512px", zones: ZONES, selected: 1 },
      ["nbplay-zone-select"],
    );
    const spans = page.locator("nbplay-zone-map .nbplay-zone-map-span");
    await expect(spans).toHaveCount(2);
    await expect(
      page.locator("nbplay-zone-map .nbplay-zone-map-tick"),
    ).toHaveCount(11);
    const first = await spans.nth(0).boundingBox();
    const track = await page.locator(".nbplay-zone-map-track").boundingBox();
    // 36/128 of the 510px inside the border, plus the border
    expect(Math.abs(first.x - track.x - 145)).toBeLessThan(2);
    expect(Math.abs(first.width - 48)).toBeLessThan(2);
    await expect(spans.nth(1)).toHaveClass(/selected/);
    await expect(spans.nth(0)).toHaveAttribute("title", "Kick: C2–B2");
    await spans.nth(0).click();
    expect(await events(page)).toEqual([["nbplay-zone-select", { index: 0 }]]);
    await page.evaluate(() => {
      document.querySelector("nbplay-zone-map").zones = [];
    });
    await expect(
      page.locator("nbplay-zone-map .nbplay-zone-map-empty"),
    ).toHaveText("No zones");
  });

  test("zone list edits note names, renames, removes and selects", async ({
    page,
  }) => {
    await mount(page, "nbplay-zone-list", { zones: ZONES }, [
      "change",
      "nbplay-zone-remove",
      "nbplay-zone-select",
    ]);
    const rows = page.locator("nbplay-zone-list .nbplay-zone-list-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator(".nbplay-value-text")).toHaveText([
      "C2",
      "B2",
      "C2",
    ]);
    await expect(rows.nth(0).locator(".nbplay-zone-list-info")).toHaveText(
      "0.42 s",
    );
    await rows.nth(0).locator(".nbplay-value-text").nth(0).dblclick();
    await rows
      .nth(0)
      .locator(
        "input[type=text].nbplay-value-input, nbplay-value input[type=text]",
      )
      .fill("D2");
    await page.keyboard.press("Enter");
    await rows.nth(1).locator(".nbplay-zone-list-name").fill("Pads");
    await page.keyboard.press("Tab");
    await rows.nth(1).locator(".nbplay-zone-list-remove").click();
    await rows.nth(1).locator(".nbplay-zone-list-swatch").click();
    const all = (await events(page)).filter(
      ([n]) => n !== "nbplay-zone-select",
    );
    expect(all).toEqual([
      ["change", { index: 0, field: "low", value: 38 }],
      ["change", { index: 1, field: "name", value: "Pads" }],
      ["nbplay-zone-remove", { index: 1 }],
    ]);
    await expect(rows.nth(0).locator(".nbplay-value-text").nth(0)).toHaveText(
      "D2",
    );
    expect((await events(page)).at(-1)).toEqual([
      "nbplay-zone-select",
      { index: 1 },
    ]);
  });
});
