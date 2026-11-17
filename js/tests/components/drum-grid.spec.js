import { test, expect } from "@playwright/test";
import { events, mount } from "./mount.js";

const props = {
  names: ["Kick", "Snare"],
  pattern: [
    [100, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 64, 0, 0, 0, 0, 0],
  ],
  currentStep: 2,
  selected: 1,
  group: 4,
};

test.describe("nbplay-drum-grid", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("renders a named row per pad with beats, the current step and velocities", async ({
    page,
  }) => {
    await mount(page, "nbplay-drum-grid", props);
    await expect(page.locator(".nbplay-drum-grid-name")).toHaveText([
      "Kick",
      "Snare",
    ]);
    await expect(
      page.locator(".nbplay-drum-grid-row.selected"),
    ).toHaveAttribute("data-pad", "1");
    const cells = page
      .locator(".nbplay-drum-grid-row")
      .nth(1)
      .locator(".nbplay-drum-grid-cell");
    await expect(cells).toHaveCount(8);
    await expect(cells.nth(2)).toHaveClass(/on/);
    await expect(cells.nth(2)).toHaveClass(/current/);
    // The pad grid's square: an "on" step holds a velocity bar.
    await expect(cells.nth(2).locator("nbplay-bar")).toHaveJSProperty(
      "value",
      64,
    );
    await expect(cells.nth(1).locator("nbplay-bar")).toHaveCount(0);
    // Steps 0 and 4 start beats.
    await expect(
      page.locator(".nbplay-drum-grid-row").first().locator(".beat"),
    ).toHaveCount(2);
  });

  test("a click toggles a step, the wheel moves its velocity, a name selects the pad", async ({
    page,
  }) => {
    await mount(page, "nbplay-drum-grid", { ...props, velocity: 90 }, [
      "change",
      "nbplay-select",
    ]);
    const kick = page.locator(".nbplay-drum-grid-row").first();
    await kick.locator(".nbplay-drum-grid-cell").nth(3).click();
    await kick.locator(".nbplay-drum-grid-cell").nth(0).click();
    await kick.locator(".nbplay-drum-grid-cell").nth(3).hover();
    await page.mouse.wheel(0, -100);
    // The wheel does nothing on a step that is off.
    await kick.locator(".nbplay-drum-grid-cell").nth(5).hover();
    await page.mouse.wheel(0, -100);
    await page.locator(".nbplay-drum-grid-name").nth(1).click();
    expect(await events(page)).toEqual([
      ["change", { pad: 0, step: 3, value: 90 }],
      ["change", { pad: 0, step: 0, value: 0 }],
      ["change", { pad: 0, step: 3, value: 95 }],
      ["nbplay-select", { pad: 1 }],
    ]);
  });

  test("a vertical drag sets a step's velocity, as on a pad", async ({
    page,
  }) => {
    await mount(page, "nbplay-drum-grid", props, ["input", "change"]);
    const cell = page
      .locator(".nbplay-drum-grid-row")
      .first()
      .locator(".nbplay-drum-grid-cell")
      .nth(5);
    const box = await cell.boundingBox();
    const x = box.x + box.width / 2;
    // From the bottom edge to the top: an off step comes on, loud.
    await page.mouse.move(x, box.y + box.height - 1);
    await page.mouse.down();
    await page.mouse.move(x, box.y + box.height / 2, { steps: 3 });
    await page.mouse.move(x, box.y + 1, { steps: 3 });
    await page.mouse.up();
    const log = await events(page);
    expect(log.length).toBeGreaterThan(1);
    expect(log.slice(0, -1).every(([name]) => name === "input")).toBe(true);
    const [name, detail] = log[log.length - 1];
    expect(name).toBe("change");
    expect([detail.pad, detail.step]).toEqual([0, 5]);
    expect(detail.value).toBeGreaterThan(115);
    await expect(cell.locator("nbplay-bar")).toHaveJSProperty(
      "value",
      detail.value,
    );
    // A short press without moving is still a toggle.
    await cell.click();
    expect((await events(page)).at(-1)).toEqual([
      "change",
      { pad: 0, step: 5, value: 0 },
    ]);
  });
});
