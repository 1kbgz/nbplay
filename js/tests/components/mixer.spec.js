import { test, expect } from "@playwright/test";
import { mount, events } from "./mount.js";

const FILTER = {
  type: "filter",
  filter_type: "lowpass",
  frequency: 1200,
  q: 0.7,
};
const COMP = {
  type: "compressor",
  threshold: -18,
  knee: 20,
  ratio: 3,
  attack: 0.01,
  release: 0.2,
};

test.describe("mixer composites", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("effect editor renders rows from the spec table and commits edits", async ({
    page,
  }) => {
    await mount(page, "nbplay-effect-editor", { effect: FILTER }, ["change"]);
    await expect(page.locator("nbplay-effect-editor [data-key]")).toHaveCount(
      3,
    );
    await page
      .locator('nbplay-effect-editor select[data-key="filter_type"]')
      .selectOption("highpass");
    await page
      .locator(
        'nbplay-effect-editor nbplay-param[data-key="frequency"] nbplay-dial',
      )
      .focus();
    await page.keyboard.press("ArrowUp");
    expect(await events(page)).toEqual([
      ["change", { key: "filter_type", value: "highpass" }],
      ["change", { key: "frequency", value: 1201 }],
    ]);
  });

  test("effect editor infers plugin fields", async ({ page }) => {
    await mount(
      page,
      "nbplay-effect-editor",
      { effect: { type: "bitcrush", bits: 8, dither: true, mode: "soft" } },
      ["change"],
    );
    await expect(
      page.locator('nbplay-effect-editor input[type=number][data-key="bits"]'),
    ).toHaveCount(1);
    await page
      .locator('nbplay-effect-editor input[type=checkbox][data-key="dither"]')
      .click();
    expect(await events(page)).toEqual([
      ["change", { key: "dither", value: false }],
    ]);
  });

  test("effect rack bypasses, edits inline, adds and removes", async ({
    page,
  }) => {
    await mount(page, "nbplay-effect-rack", { effects: [FILTER, COMP] }, [
      "change",
      "nbplay-effect-add",
      "nbplay-effect-remove",
    ]);
    const chips = page.locator("nbplay-effect-rack .nbplay-effect-rack-chip");
    await expect(chips).toHaveText(["lowpass 1200Hz", "compressor"]);
    await chips.nth(0).click();
    await page
      .locator("nbplay-effect-rack .nbplay-effect-rack-edit")
      .nth(0)
      .click();
    await expect(
      page.locator("nbplay-effect-rack nbplay-effect-editor"),
    ).toHaveCount(1);
    await page
      .locator('nbplay-effect-rack select[data-key="filter_type"]')
      .selectOption("notch");
    await page
      .locator("nbplay-effect-rack .nbplay-effect-rack-type")
      .selectOption("reverb");
    await page
      .locator("nbplay-effect-rack .nbplay-effect-rack-add-btn")
      .click();
    await page
      .locator("nbplay-effect-rack .nbplay-effect-rack-remove")
      .nth(1)
      .click();
    expect(await events(page)).toEqual([
      ["change", { index: 0, field: "enabled", value: false }],
      ["change", { index: 0, field: "filter_type", value: "notch" }],
      ["nbplay-effect-add", { type: "reverb" }],
      ["nbplay-effect-remove", { index: 1 }],
    ]);
  });

  test("channel strip reports gain, pan, mute, solo, sends and effects", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-strip",
      {
        name: "Drums",
        gain: 1,
        sends: [0.3],
        sendNames: ["Rev"],
        effects: [FILTER],
      },
      ["input", "change", "nbplay-remove"],
    );
    await page
      .locator('nbplay-strip nbplay-toggle[variant="mute"] button')
      .click();
    await page
      .locator("nbplay-strip .nbplay-strip-send input[type=range]")
      .focus();
    await page.keyboard.press("ArrowRight");
    await page
      .locator("nbplay-strip .nbplay-strip-pan input[type=range]")
      .focus();
    await page.keyboard.press("ArrowLeft");
    await page.locator("nbplay-strip .nbplay-effect-rack-chip").click();
    await page.locator("nbplay-strip .nbplay-strip-remove").click();
    expect(await events(page)).toEqual([
      ["change", { field: "mute", value: true }],
      ["input", { field: "send", index: 0, value: 0.31 }],
      ["change", { field: "send", index: 0, value: 0.31 }],
      ["input", { field: "pan", value: -0.01 }],
      ["change", { field: "pan", value: -0.01 }],
      ["change", { field: "effect", index: 0, key: "enabled", value: false }],
      ["nbplay-remove", {}],
    ]);
  });

  test("mixer builds the session bus when sessionId arrives after mount", async ({
    page,
  }) => {
    await mount(page, "nbplay-mixer", {
      channels: [
        { name: "A", gain: 0.8, pan: 0, mute: false, solo: false },
        { name: "B", gain: 0.8, pan: 0, mute: false, solo: false },
      ],
      masterGain: 1,
    });
    expect(
      await page.evaluate(() => Object.keys(globalThis.__nbplay || {})),
    ).toEqual([]);
    await page.evaluate(async () => {
      const el = document.querySelector("nbplay-mixer");
      el.sessionId = "late-session";
      await el.updateComplete;
    });
    expect(
      await page.evaluate(
        () => globalThis.__nbplay["late-session"].channels.length,
      ),
    ).toBe(2);
    await page.evaluate(async () => {
      const el = document.querySelector("nbplay-mixer");
      el.sessionId = "other-session";
      await el.updateComplete;
    });
    expect(
      await page.evaluate(() => [
        globalThis.__nbplay["late-session"],
        globalThis.__nbplay["other-session"].channels.length,
      ]),
    ).toEqual([undefined, 2]);
  });

  test("return and master strips drop the channel-only parts", async ({
    page,
  }) => {
    await mount(page, "nbplay-strip", { kind: "return", name: "Rev" }, []);
    await expect(page.locator("nbplay-strip .nbplay-strip-pan")).toHaveCount(0);
    await expect(page.locator("nbplay-strip nbplay-toggle")).toHaveCount(0);
    await expect(page.locator("nbplay-strip .nbplay-strip-remove")).toHaveCount(
      1,
    );
    await page.evaluate(() => {
      document.querySelector("nbplay-strip").kind = "master";
    });
    await expect(page.locator("nbplay-strip .nbplay-strip-remove")).toHaveCount(
      0,
    );
    await expect(page.locator("nbplay-strip nbplay-fader")).toHaveCount(1);
  });
});
