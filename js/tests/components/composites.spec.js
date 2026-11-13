import { test, expect } from "@playwright/test";

/** Mount `<tag>` with props and collect bubbling events on `window.__events`. */
async function mount(page, tag, props = {}, events = ["input", "change"]) {
  await page.evaluate(
    async ({ tag, props, events }) => {
      await window.__components;
      const el = document.createElement(tag);
      Object.assign(el, props);
      window.__events = [];
      for (const name of events) {
        el.addEventListener(name, (e) =>
          window.__events.push([name, e.detail]),
        );
      }
      document.getElementById("root").appendChild(el);
      await el.updateComplete;
      await Promise.all(
        [...el.querySelectorAll("*")]
          .map((c) => c.updateComplete)
          .filter(Boolean),
      );
    },
    { tag, props, events },
  );
}

const events = (page) => page.evaluate(() => window.__events);
const grid = (n, note = 36) =>
  Array.from({ length: n }, (_, i) => ({ note: note + i, velocity: 100 }));

test.describe("composites", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("param keeps slider and readout in sync and re-emits once", async ({
    page,
  }) => {
    await mount(page, "nbplay-param", {
      label: "BPM",
      kind: "bpm",
      value: 120,
      min: 30,
      max: 300,
      step: 1,
    });
    await page.locator("nbplay-param input[type=range]").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("nbplay-param .nbplay-value-text")).toHaveText(
      "121 BPM",
    );
    expect(await events(page)).toEqual([
      ["input", { value: 121 }],
      ["change", { value: 121 }],
    ]);
    await page.locator("nbplay-param .nbplay-value-text").dblclick();
    await page.locator("nbplay-param input[type=text]").fill("140");
    await page.locator("nbplay-param input[type=text]").press("Enter");
    await expect(page.locator("nbplay-param input[type=range]")).toHaveValue(
      "140",
    );
    expect((await events(page)).at(-1)).toEqual(["change", { value: 140 }]);
  });

  test("param renders a dial on request", async ({ page }) => {
    await mount(page, "nbplay-param", { control: "dial", value: 0.5 });
    await expect(page.locator("nbplay-param nbplay-dial")).toHaveCount(1);
    await expect(page.locator("nbplay-param nbplay-slider")).toHaveCount(0);
  });

  test("transport buttons report intent, host owns state", async ({ page }) => {
    await mount(page, "nbplay-transport-buttons", {}, [
      "nbplay-stop",
      "nbplay-play",
      "nbplay-record",
    ]);
    await page.locator(".nbplay-transport-play button").click();
    await page.locator(".nbplay-transport-record button").click();
    await page.locator(".nbplay-transport-stop").click();
    expect(await events(page)).toEqual([
      ["nbplay-play", { value: true }],
      ["nbplay-record", { value: true }],
      ["nbplay-stop", {}],
    ]);
    await page.evaluate(
      () => (document.querySelector("nbplay-transport-buttons").playing = true),
    );
    await expect(page.locator(".nbplay-transport-play button")).toHaveText("⏸");
  });

  test("fader edits gain through the readout and shows level", async ({
    page,
  }) => {
    await mount(page, "nbplay-fader", { value: 1, level: 0.5 });
    await expect(page.locator("nbplay-fader .nbplay-value-text")).toHaveText(
      "+0.0 dB",
    );
    await page.locator("nbplay-fader .nbplay-value-text").dblclick();
    await page.locator("nbplay-fader input[type=text]").fill("-6");
    await page.locator("nbplay-fader input[type=text]").press("Enter");
    const [[name, detail]] = await events(page);
    expect(name).toBe("change");
    expect(detail.value).toBeCloseTo(0.501, 2);
    await expect(page.locator("nbplay-fader input[type=range]")).toHaveValue(
      "0.5",
    );
    const pct = await page
      .locator("nbplay-fader .nbplay-meter-fill")
      .evaluate((el) =>
        parseFloat(el.style.getPropertyValue("--nbplay-meter-fill")),
      );
    expect(pct).toBeCloseTo(90, 0);
  });

  test("key rows map pointer presses to notes with zones", async ({ page }) => {
    await mount(
      page,
      "nbplay-key-rows",
      { upperOctave: 3, lowerOctave: 4, velocity: 90 },
      ["nbplay-note-on", "nbplay-note-off"],
    );
    const q = page.locator('nbplay-key-rows [data-key="q"]');
    await q.dispatchEvent("pointerdown", { pointerId: 1, button: 0 });
    await expect(q).toHaveClass(/pressed/);
    await q.dispatchEvent("pointerup", { pointerId: 1 });
    await expect(q).not.toHaveClass(/pressed/);
    await page
      .locator('nbplay-key-rows [data-key="z"]')
      .dispatchEvent("pointerdown", { pointerId: 2, button: 0 });
    expect(await events(page)).toEqual([
      ["nbplay-note-on", { note: 48, velocity: 90, zone: "upper" }],
      ["nbplay-note-off", { note: 48, zone: "upper" }],
      ["nbplay-note-on", { note: 60, velocity: 90, zone: "lower" }],
    ]);
  });

  test("key rows piano layout and keyToNote helper", async ({ page }) => {
    await mount(
      page,
      "nbplay-key-rows",
      { layout: "piano", startOctave: 4, octaves: 1, pressed: [64] },
      [],
    );
    await expect(
      page.locator("nbplay-key-rows .nbplay-keys-white"),
    ).toHaveCount(7);
    await expect(
      page.locator("nbplay-key-rows .nbplay-keys-black"),
    ).toHaveCount(5);
    await expect(page.locator('nbplay-key-rows [data-note="64"]')).toHaveClass(
      /pressed/,
    );
    const mapped = await page.evaluate(async () => {
      const mod = await window.__components;
      return [
        mod.keyToNote("q", 3, 4),
        mod.keyToNote("S", 3, 4),
        mod.keyToNote("?", 3, 4),
      ];
    });
    expect(mapped).toEqual([
      { note: 48, zone: "upper" },
      { note: 63, zone: "lower" },
      null,
    ]);
  });

  test("pad tap fires note-on with a y-dependent velocity, then note-off", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-pad-grid",
      { style: "width: 200px", rows: 1, cols: 2, pads: grid(2) },
      ["nbplay-note-on", "nbplay-note-off"],
    );
    const cell = page.locator('nbplay-pad-grid [data-index="1"]');
    const box = await cell.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.9);
    // The note-off follows on the next animation frame.
    await expect.poll(async () => (await events(page)).length).toBe(2);
    const all = await events(page);
    expect(all[0][0]).toBe("nbplay-note-on");
    expect(all[0][1].index).toBe(1);
    expect(all[0][1].note).toBe(37);
    expect(all[0][1].velocity).toBeGreaterThan(85);
    expect(all[0][1].velocity).toBeLessThanOrEqual(100);
    expect(all[1]).toEqual(["nbplay-note-off", { index: 1, note: 37 }]);
  });

  test("pad hold mode releases on pointer up", async ({ page }) => {
    await mount(
      page,
      "nbplay-pad-grid",
      {
        style: "width: 200px",
        rows: 1,
        cols: 1,
        pads: grid(1),
        hold: true,
        velocitySensitive: false,
      },
      ["nbplay-note-on", "nbplay-note-off"],
    );
    const cell = page.locator('nbplay-pad-grid [data-index="0"]');
    const box = await cell.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await expect(cell).toHaveClass(/active/);
    expect(await events(page)).toEqual([
      ["nbplay-note-on", { index: 0, note: 36, velocity: 100 }],
    ]);
    await page.mouse.up();
    await expect(cell).not.toHaveClass(/active/);
    expect((await events(page)).at(-1)).toEqual([
      "nbplay-note-off",
      { index: 0, note: 36 },
    ]);
  });

  test("pad drag sets velocity, wheel edits note and velocity", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-pad-grid",
      { style: "width: 200px", rows: 1, cols: 1, pads: grid(1) },
      ["input", "change", "nbplay-note-on"],
    );
    const cell = page.locator('nbplay-pad-grid [data-index="0"]');
    const box = await cell.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25, {
      steps: 4,
    });
    await page.mouse.up();
    let all = await events(page);
    expect(all.some(([n]) => n === "nbplay-note-on")).toBe(false);
    expect(all.at(-1)[0]).toBe("change");
    expect(all.at(-1)[1].field).toBe("velocity");
    expect(all.at(-1)[1].value).toBeGreaterThan(85);
    await page.evaluate(() => (window.__events = []));
    await cell.hover();
    await page.mouse.wheel(0, -100);
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, 100);
    await page.keyboard.up("Shift");
    all = await events(page);
    expect(all[0]).toEqual(["change", { index: 0, field: "note", value: 37 }]);
    expect(all[1][1].field).toBe("velocity");
  });

  test("pad label edit changes the note", async ({ page }) => {
    await mount(
      page,
      "nbplay-pad-grid",
      { style: "width: 200px", rows: 1, cols: 1, pads: grid(1) },
      ["change", "nbplay-note-on"],
    );
    await page.locator("nbplay-pad-grid .nbplay-value-text").dblclick();
    await page.locator("nbplay-pad-grid input[type=text]").fill("C4");
    await page.locator("nbplay-pad-grid input[type=text]").press("Enter");
    await page.waitForTimeout(400);
    expect(await events(page)).toEqual([
      ["change", { index: 0, field: "note", value: 60 }],
    ]);
  });

  test("step grid toggles, edits notes and velocities, arms voices", async ({
    page,
  }) => {
    const voices = [
      Array.from({ length: 4 }, () => ({
        active: false,
        note: 60,
        velocity: 100,
      })),
    ];
    await mount(
      page,
      "nbplay-step-grid",
      { voices, showArm: true, currentStep: 2 },
      ["change", "nbplay-arm", "nbplay-step-pick"],
    );
    const cell = page.locator(
      'nbplay-step-grid [data-step="1"].nbplay-step-grid-cell',
    );
    await cell.click();
    await expect(cell).toHaveClass(/active/);
    await expect(
      page.locator("nbplay-step-grid .nbplay-step-grid-head").nth(2),
    ).toHaveClass(/active-col/);
    await cell.hover();
    await page.mouse.wheel(0, -100);
    await expect(cell).toHaveText("C#4");
    await page.locator("nbplay-step-grid .nbplay-step-grid-vel").nth(1).hover();
    await page.mouse.wheel(0, 100);
    await page.locator("nbplay-step-grid .nbplay-step-grid-arm button").click();
    expect(await events(page)).toEqual([
      ["change", { voice: 0, step: 1, field: "active", value: true }],
      ["change", { voice: 0, step: 1, field: "note", value: 61 }],
      ["change", { voice: 0, step: 1, field: "velocity", value: 95 }],
      ["nbplay-arm", { voice: 0, armed: true }],
    ]);
  });

  test("step grid double-click types a note into a step", async ({ page }) => {
    const voices = [
      [
        { active: false, note: 60, velocity: 100 },
        { active: true, note: 62, velocity: 100 },
      ],
    ];
    await mount(page, "nbplay-step-grid", { voices }, [
      "change",
      "nbplay-step-pick",
    ]);
    const cell = page
      .locator("nbplay-step-grid .nbplay-step-grid-cell")
      .first();
    const input = page.locator("nbplay-step-grid .nbplay-step-grid-edit");
    const edits = async () =>
      (await events(page)).filter(([, d]) => d?.field !== "active" || d.value);

    // The field opens on the current note; a note name commits and activates.
    await cell.dblclick();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("C4");
    await input.fill("f#3");
    await input.press("Enter");
    await expect(input).toHaveCount(0);
    await expect(cell).toHaveText("F#3");
    await expect(cell).toHaveClass(/active/);
    const changes = (await events(page)).slice(-2);
    expect(changes).toEqual([
      ["change", { voice: 0, step: 0, field: "note", value: 54 }],
      ["change", { voice: 0, step: 0, field: "active", value: true }],
    ]);

    // Escape and unparseable text leave the step alone.
    await page.evaluate(() => {
      window.__events = [];
    });
    await cell.dblclick();
    await input.fill("A2");
    await input.press("Escape");
    await expect(input).toHaveCount(0);
    await cell.dblclick();
    await input.fill("nope");
    await input.press("Enter");
    await expect(cell).toHaveText("F#3");
    expect((await edits()).filter(([, d]) => d.field === "note")).toEqual([]);

    // A MIDI number works, and clicking elsewhere commits.
    const second = page
      .locator("nbplay-step-grid .nbplay-step-grid-cell")
      .nth(1);
    await second.dblclick();
    await input.fill("72");
    await page
      .locator("nbplay-step-grid .nbplay-step-grid-head")
      .first()
      .click();
    await expect(second).toHaveText("C5");
    expect(
      (await events(page)).filter(([n]) => n === "nbplay-step-pick"),
    ).toEqual([]);
  });

  test("step grid double-click asks the host for a note", async ({ page }) => {
    const voices = [[{ active: false, note: 60, velocity: 100 }]];
    await mount(page, "nbplay-step-grid", { voices, showArm: true }, [
      "change",
      "nbplay-step-pick",
    ]);
    await page.locator("nbplay-step-grid .nbplay-step-grid-cell").dblclick();
    const all = await events(page);
    expect(all.filter(([n]) => n === "nbplay-step-pick")).toEqual([
      ["nbplay-step-pick", { voice: 0, step: 0 }],
    ]);
    await page.evaluate(
      () =>
        (document.querySelector("nbplay-step-grid").pending = {
          voice: 0,
          step: 0,
        }),
    );
    await expect(
      page.locator("nbplay-step-grid .nbplay-step-grid-cell"),
    ).toHaveText("♪?");
  });
});
