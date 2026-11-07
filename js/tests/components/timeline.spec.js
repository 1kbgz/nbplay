import { test, expect } from "@playwright/test";
import { mount, events, clearEvents } from "./mount.js";

const CLIPS = [
  { id: "c1", name: "Take 1", start: 0, duration: 8 },
  { id: "c2", name: "Take 2", start: 10, duration: 6 },
  { id: "c3", name: "Chords", start: 20, duration: 8, kind: "midi" },
];

async function drag(page, x0, y, x1) {
  await page.mouse.move(x0, y);
  await page.mouse.down();
  await page.mouse.move(x1, y, { steps: 4 });
  await page.mouse.up();
}

test.describe("timeline composites", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("ruler labels bars, seeks on the surface, drags loop handles by bars", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-ruler",
      {
        style: "display:block;width:400px",
        length: 32,
        beat: 8,
        loopStart: 4,
        loopEnd: 12,
        loopEnabled: true,
      },
      ["nbplay-seek", "input", "change"],
    );
    await expect(page.locator("nbplay-ruler .nbplay-ruler-bar")).toHaveCount(8);
    const playhead = page.locator("nbplay-ruler .nbplay-ruler-playhead");
    await expect(playhead).toHaveCSS("left", "100px");
    const box = await page
      .locator("nbplay-ruler .nbplay-ruler-track")
      .boundingBox();
    await page.mouse.click(box.x + 100, box.y + 15);
    let all = await events(page);
    expect(all.map(([n]) => n)).toEqual(["nbplay-seek", "nbplay-seek"]);
    expect(all[0][1]).toEqual({ beat: 8, final: false });
    expect(all[1][1]).toEqual({ beat: 8, final: true });
    await clearEvents(page);
    // end handle sits at beat 12 = 150px; drag to 310px = beat 24.8, snapped to 24
    await drag(page, box.x + 150, box.y + 11, box.x + 310);
    all = await events(page);
    expect(all.some(([n]) => n === "nbplay-seek")).toBe(false);
    expect(all[0][0]).toBe("input");
    expect(all.at(-1)).toEqual(["change", { field: "loopEnd", value: 24 }]);
    await clearEvents(page);
    // start handle cannot cross the end minus one bar
    await drag(page, box.x + 50, box.y + 11, box.x + 390);
    expect((await events(page)).at(-1)).toEqual([
      "change",
      { field: "loopStart", value: 20 },
    ]);
  });

  test("lane toggles, record source, clip select, move and trim", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-lane",
      {
        style: "display:flex;width:550px",
        name: "Vocals",
        length: 32,
        beat: 4,
        clips: CLIPS,
      },
      ["change", "input", "nbplay-seek", "nbplay-clip-select"],
    );
    await expect(page.locator("nbplay-lane nbplay-clip")).toHaveCount(3);
    await expect(
      page.locator('nbplay-lane nbplay-clip[clip-id="c3"]'),
    ).toHaveAttribute("kind", "midi");
    await expect(
      page.locator('nbplay-lane nbplay-clip[clip-id="c2"] .nbplay-clip-detail'),
    ).toHaveText("3.3");
    await page
      .locator('nbplay-lane nbplay-toggle[variant="arm"] button')
      .click();
    await page.locator("nbplay-lane .nbplay-lane-input").selectOption("midi");
    expect(await events(page)).toEqual([
      ["change", { field: "armed", value: true }],
      ["change", { field: "input", value: "midi" }],
    ]);
    await clearEvents(page);

    const lane = await page
      .locator("nbplay-lane .nbplay-lane-clips")
      .boundingBox();
    expect(lane.width).toBe(400);
    const y = lane.y + lane.height / 2;
    // click without moving selects
    await page.mouse.click(lane.x + 270, y);
    expect(await events(page)).toEqual([["nbplay-clip-select", { id: "c3" }]]);
    await clearEvents(page);
    // move c1 (0..100px) right by 100px = 8 beats
    await drag(page, lane.x + 50, y, lane.x + 150);
    let all = await events(page);
    expect(all[0][0]).toBe("input");
    const moved = all.at(-1);
    expect(moved[0]).toBe("change");
    expect(moved[1]).toMatchObject({
      field: "clip",
      id: "c1",
      start: 8,
      duration: 8,
      offset: 0,
    });
    expect(typeof moved[1].clientY).toBe("number");
    await expect(
      page.locator('nbplay-lane nbplay-clip[clip-id="c1"]'),
    ).toHaveCSS("left", "100px");
    await clearEvents(page);
    // trim the end of c2 (125..200px) by +50px = 4 beats
    await drag(page, lane.x + 197, y, lane.x + 247);
    all = await events(page);
    expect(all.at(-1)[1]).toMatchObject({
      field: "clip",
      id: "c2",
      start: 10,
      duration: 10,
    });
    await clearEvents(page);
    // the empty lane area seeks
    await page.mouse.click(lane.x + 390, y);
    all = await events(page);
    expect(all.map(([n]) => n)).toEqual(["nbplay-seek", "nbplay-seek"]);
    expect(all[1][1]).toEqual({ beat: 31.2, final: true });
  });

  test("clip reflects state attributes", async ({ page }) => {
    await mount(
      page,
      "nbplay-clip",
      {
        style: "position:relative;width:120px;height:40px",
        clipId: "x",
        name: "Loop",
        detail: "1.1",
        pattern: true,
        selected: true,
        muted: true,
      },
      [],
    );
    const clip = page.locator("nbplay-clip");
    await expect(clip).toHaveAttribute("clip-id", "x");
    await expect(clip).toHaveAttribute("pattern", "");
    await expect(clip).toHaveAttribute("selected", "");
    await expect(clip).toHaveAttribute("muted", "");
    await expect(clip.locator(".nbplay-clip-name")).toHaveText("Loop");
    await expect(clip.locator(".nbplay-clip-handle")).toHaveCount(2);
  });
});
