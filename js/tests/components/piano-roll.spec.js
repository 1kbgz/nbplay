import { test, expect } from "@playwright/test";
import { clearEvents, events, mount } from "./mount.js";

const NOTES = [
  { beat: 0, duration: 1, note: 60, velocity: 100 },
  { beat: 1.1, duration: 0.6, note: 64, velocity: 80 },
];

/** The center of a grid cell at `beat`, on the row of `note` (rows are 14px, beats 48px). */
async function cellPoint(page, beat, note) {
  return page.evaluate(
    ({ beat, note }) => {
      const rect = document
        .querySelector(".nbplay-roll-grid")
        .getBoundingClientRect();
      // The first note (60) gives the rows' offset.
      const first = document.querySelector('.nbplay-roll-note[data-index="0"]');
      const row = Number(first.style.top.replace("px", "")) + (60 - note) * 14;
      return { x: rect.left + beat * 48 + 6, y: rect.top + row + 7 };
    },
    { beat, note },
  );
}

test.describe("nbplay-piano-roll", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("shows a clip's notes and adds one on a click", async ({ page }) => {
    await mount(page, "nbplay-piano-roll", { events: NOTES, length: 4 }, [
      "change",
    ]);
    await expect(page.locator(".nbplay-roll-note")).toHaveCount(2);
    await expect(page.locator(".nbplay-roll-count")).toHaveText("2 notes");
    // Two octaves at least, with C rows named.
    expect(
      await page.locator(".nbplay-roll-key").count(),
    ).toBeGreaterThanOrEqual(24);
    await expect(
      page.locator(".nbplay-roll-key", { hasText: "C4" }),
    ).toHaveCount(1);
    const at = await cellPoint(page, 2, 62);
    await page.mouse.click(at.x, at.y);
    const [[, detail]] = await events(page);
    expect(detail.events).toEqual([
      NOTES[0],
      NOTES[1],
      { beat: 2, duration: 0.25, note: 62, velocity: 100 },
    ]);
  });

  test("a drag moves a note, its edge resizes it, a double-click removes it", async ({
    page,
  }) => {
    await mount(page, "nbplay-piano-roll", { events: NOTES, length: 4 }, [
      "change",
    ]);
    const note = page.locator('.nbplay-roll-note[data-index="0"]');
    let box = await note.boundingBox();
    // One beat right and two rows up: beat 1, note 62.
    await page.mouse.move(box.x + 10, box.y + 7);
    await page.mouse.down();
    await page.mouse.move(box.x + 10 + 48, box.y + 7 - 28, { steps: 4 });
    await page.mouse.up();
    let log = await events(page);
    expect(log.at(-1)[1].events[0]).toEqual({
      beat: 1,
      duration: 1,
      note: 62,
      velocity: 100,
    });
    // The right edge resizes, snapped to the grid.
    await clearEvents(page);
    const first = page.locator('.nbplay-roll-note[data-index="0"]');
    box = await first.boundingBox();
    await page.mouse.move(box.x + box.width - 2, box.y + 7);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2 + 24, box.y + 7, { steps: 4 });
    await page.mouse.up();
    log = await events(page);
    expect(log.at(-1)[1].events[0].duration).toBe(1.5);
    // A double-click removes it.
    await clearEvents(page);
    await first.dblclick();
    log = await events(page);
    expect(log.at(-1)[1].events).toHaveLength(1);
  });

  test("the wheel moves velocity and Quantize snaps to the grid", async ({
    page,
  }) => {
    await mount(page, "nbplay-piano-roll", { events: NOTES, length: 4 }, [
      "change",
      "nbplay-grid",
    ]);
    await page.locator('.nbplay-roll-note[data-index="1"]').hover();
    await page.mouse.wheel(0, -100);
    let log = await events(page);
    expect(log.at(-1)[1].events[1].velocity).toBe(85);
    await page.locator(".nbplay-roll-grid-select").selectOption("1/8");
    await page.locator(".nbplay-roll-quantize").click();
    log = await events(page);
    expect(log.find(([name]) => name === "nbplay-grid")[1]).toEqual({
      grid: 0.5,
    });
    // 1.1 snaps to 1, and 0.6 long to 0.5.
    expect(log.at(-1)[1].events[1]).toMatchObject({ beat: 1, duration: 0.5 });
  });
});
