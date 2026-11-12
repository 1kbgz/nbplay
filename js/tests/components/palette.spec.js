import { test, expect } from "@playwright/test";
import { mount, events } from "./mount.js";

const COMMANDS = [
  { id: "transport" },
  { id: "mixer" },
  { id: "lead-synth", label: "Lead synth" },
  { id: "lead-sequencer", label: "Lead sequencer" },
];

test.describe("palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
    await mount(
      page,
      "nbplay-palette",
      { commands: COMMANDS, placeholder: "Open a panel" },
      ["nbplay-request"],
    );
  });

  test("the shortcut opens it and typing filters the commands", async ({
    page,
  }) => {
    const dialog = page.locator("nbplay-palette dialog");
    const options = page.locator("nbplay-palette .nbplay-palette-option");
    await expect(dialog).toBeHidden();
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible();
    await expect(page.locator(".nbplay-palette-input")).toBeFocused();
    await expect(options).toHaveText([
      "transport",
      "mixer",
      "Lead synth",
      "Lead sequencer",
    ]);
    await page.keyboard.type("LEAD");
    await expect(options).toHaveText(["Lead synth", "Lead sequencer"]);
    await page.keyboard.type("zzz");
    await expect(options).toHaveCount(0);
    await expect(page.locator(".nbplay-palette-empty")).toHaveText("No match");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    expect(await events(page)).toEqual([]);
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeHidden();
  });

  test("arrow keys and Enter pick a command", async ({ page }) => {
    const dialog = page.locator("nbplay-palette dialog");
    const active = page.locator("nbplay-palette .nbplay-palette-option.active");
    await page.keyboard.press("Meta+k");
    await expect(active).toHaveText("transport");
    await page.keyboard.press("ArrowUp");
    await expect(active).toHaveText("Lead sequencer");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(active).toHaveText("mixer");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    expect(await events(page)).toEqual([["nbplay-request", { name: "mixer" }]]);
  });

  test("show() reopens with an empty query; a click picks and Escape closes", async ({
    page,
  }) => {
    const dialog = page.locator("nbplay-palette dialog");
    const show = () =>
      page.evaluate(() => document.querySelector("nbplay-palette").show());
    await show();
    await page.keyboard.type("mix");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(await events(page)).toEqual([]);
    await show();
    await expect(page.locator(".nbplay-palette-input")).toHaveValue("");
    await page
      .locator("nbplay-palette .nbplay-palette-option", {
        hasText: "Lead synth",
      })
      .click();
    await expect(dialog).toBeHidden();
    expect(await events(page)).toEqual([
      ["nbplay-request", { name: "lead-synth" }],
    ]);
  });
});
