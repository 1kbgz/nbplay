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
          window.__events.push([name, e.detail?.value]),
        );
      }
      document.getElementById("root").appendChild(el);
      await el.updateComplete;
    },
    { tag, props, events },
  );
}

const events = (page) => page.evaluate(() => window.__events);

test.describe("primitives", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("slider emits input then change with the quantized value", async ({
    page,
  }) => {
    await mount(page, "nbplay-slider", {
      value: 0.5,
      min: 0,
      max: 2,
      step: 0.01,
    });
    const input = page.locator("nbplay-slider input[type=range]");
    await input.focus();
    await page.keyboard.press("ArrowRight");
    expect(await events(page)).toEqual([
      ["input", 0.51],
      ["change", 0.51],
    ]);
    await expect(page.locator("nbplay-slider")).toHaveJSProperty("value", 0.51);
  });

  test("slider double-click resets to its default value", async ({ page }) => {
    // The clicks themselves move the native range to the pointer; the reset
    // then lands on the default, which is away from the center.
    await mount(page, "nbplay-slider", {
      value: 0.5,
      min: 0,
      max: 2,
      defaultValue: 1.5,
    });
    await page.locator("nbplay-slider input[type=range]").dblclick();
    await expect(page.locator("nbplay-slider")).toHaveJSProperty("value", 1.5);
    const all = await events(page);
    expect(all.slice(-2)).toEqual([
      ["input", 1.5],
      ["change", 1.5],
    ]);
  });

  test("slider log scale maps the native position to hertz", async ({
    page,
  }) => {
    await mount(page, "nbplay-slider", {
      value: 440,
      min: 20,
      max: 8000,
      step: 0.1,
      scale: "log",
    });
    const input = page.locator("nbplay-slider input[type=range]");
    await expect(input).toHaveAttribute("max", "1");
    const pos = parseFloat(await input.inputValue());
    expect(pos).toBeCloseTo(Math.log(440 / 20) / Math.log(8000 / 20), 3);
    await page.evaluate(() => {
      const el = document.querySelector("nbplay-slider input");
      el.value = "1";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(await events(page)).toEqual([["input", 8000]]);
  });

  test("slider ignores outside writes while dragging", async ({ page }) => {
    await mount(page, "nbplay-slider", { value: 0.5 });
    await page.evaluate(async () => {
      const el = document.querySelector("nbplay-slider");
      el.dragging = true;
      el.value = 0.9;
      await el.updateComplete;
    });
    await expect(page.locator("nbplay-slider")).toHaveJSProperty("value", 0.5);
    await page.evaluate(async () => {
      const el = document.querySelector("nbplay-slider");
      el.dragging = false;
      el.value = 0.9;
      await el.updateComplete;
    });
    await expect(page.locator("nbplay-slider")).toHaveJSProperty("value", 0.9);
  });

  test("value formats by kind and commits an edit on Enter", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-value",
      { value: 0.8, kind: "db", min: 0, max: 2 },
      ["change"],
    );
    const text = page.locator("nbplay-value .nbplay-value-text");
    await expect(text).toHaveText("-1.9 dB");
    await text.dblclick();
    const input = page.locator("nbplay-value input");
    await expect(input).toHaveValue("-1.9");
    await input.fill("+6");
    await input.press("Enter");
    await expect(text).toHaveText("+6.0 dB");
    const [[name, value]] = await events(page);
    expect(name).toBe("change");
    expect(value).toBeCloseTo(1.995, 3);
  });

  test("value rejects garbage and cancels on Escape", async ({ page }) => {
    await mount(
      page,
      "nbplay-value",
      { value: 60, kind: "note", min: 0, max: 127 },
      ["change"],
    );
    const text = page.locator("nbplay-value .nbplay-value-text");
    await expect(text).toHaveText("C4");
    await text.dblclick();
    await page.locator("nbplay-value input").fill("xyz");
    await page.locator("nbplay-value input").press("Enter");
    await expect(text).toHaveText("C4");
    await text.dblclick();
    await page.locator("nbplay-value input").fill("G9");
    await page.locator("nbplay-value input").press("Escape");
    await expect(text).toHaveText("C4");
    await text.dblclick();
    await page.locator("nbplay-value input").fill("G9");
    await page.locator("nbplay-value input").press("Enter");
    await expect(text).toHaveText("G9");
    expect(await events(page)).toEqual([["change", 127]]);
  });

  test("toggle flips active and reflects it", async ({ page }) => {
    await mount(page, "nbplay-toggle", { label: "M", variant: "mute" }, [
      "change",
    ]);
    const button = page.locator("nbplay-toggle button");
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await button.click();
    await expect(page.locator("nbplay-toggle")).toHaveAttribute("active", "");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    expect(await events(page)).toEqual([["change", true]]);
  });

  test("dial responds to keys and wheel", async ({ page }) => {
    await mount(page, "nbplay-dial", { value: 0.5, min: 0, max: 1, step: 0.1 });
    const dial = page.locator("nbplay-dial");
    await dial.focus();
    await page.keyboard.press("ArrowUp");
    await expect(dial).toHaveJSProperty("value", 0.6);
    await page.keyboard.press("End");
    await expect(dial).toHaveJSProperty("value", 1);
    await dial.hover();
    await page.mouse.wheel(0, 100);
    await expect(dial).toHaveJSProperty("value", 0.9);
    expect(await events(page)).toEqual([
      ["input", 0.6],
      ["change", 0.6],
      ["input", 1],
      ["change", 1],
      ["input", 0.9],
      ["change", 0.9],
    ]);
  });

  test("dial double-click resets to its default value", async ({ page }) => {
    await mount(page, "nbplay-dial", {
      value: 0.2,
      min: 0,
      max: 1,
      step: 0.1,
      defaultValue: 0.5,
    });
    await page.locator("nbplay-dial").dblclick();
    await expect(page.locator("nbplay-dial")).toHaveJSProperty("value", 0.5);
    const all = await events(page);
    expect(all.at(-1)).toEqual(["change", 0.5]);
  });

  test("dial drag sweeps the range vertically", async ({ page }) => {
    await mount(page, "nbplay-dial", { value: 0, min: 0, max: 100, step: 1 });
    const box = await page.locator("nbplay-dial").boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 75, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator("nbplay-dial")).toHaveJSProperty("value", 50);
    const all = await events(page);
    expect(all.at(-1)).toEqual(["change", 50]);
  });

  test("bar edits by wheel only when allowed", async ({ page }) => {
    await mount(page, "nbplay-bar", { value: 64, editable: "" });
    await page.locator("nbplay-bar").hover();
    await page.mouse.wheel(0, -100);
    await expect(page.locator("nbplay-bar")).toHaveJSProperty("value", 64);
    await page.evaluate(() => {
      document.querySelector("nbplay-bar").editable = "wheel";
      document.querySelector("nbplay-bar").wheelStep = 5;
    });
    await page.mouse.wheel(0, -100);
    await expect(page.locator("nbplay-bar")).toHaveJSProperty("value", 69);
    expect(await events(page)).toEqual([
      ["input", 69],
      ["change", 69],
    ]);
  });

  test("bar drag sets the value from the pointer", async ({ page }) => {
    await mount(page, "nbplay-bar", { value: 0, editable: "drag" });
    const bar = page.locator("nbplay-bar");
    const box = await bar.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    const value = await bar.evaluate((el) => el.value);
    expect(value).toBeGreaterThan(55);
    expect(value).toBeLessThan(72);
    const all = await events(page);
    expect(all.at(-1)[0]).toBe("change");
  });

  test("meter maps dB to fill and flags hot", async ({ page }) => {
    await mount(page, "nbplay-meter", { level: 0.5 }, []);
    const fill = page.locator("nbplay-meter .nbplay-meter-fill");
    const pct = await fill.evaluate((el) =>
      parseFloat(el.style.getPropertyValue("--nbplay-meter-fill")),
    );
    expect(pct).toBeCloseTo(90, 0);
    await expect(page.locator("nbplay-meter")).not.toHaveAttribute("hot", "");
    await page.evaluate(
      () => (document.querySelector("nbplay-meter").level = 1),
    );
    await expect(page.locator("nbplay-meter")).toHaveAttribute("hot", "");
  });

  test("position formats bar and beat", async ({ page }) => {
    await mount(page, "nbplay-position", { beat: 5.5 }, []);
    await expect(page.locator("nbplay-position")).toHaveText("002:2");
    await page.evaluate(() => {
      const el = document.querySelector("nbplay-position");
      el.format = "bar.beat";
      el.beatsPerBar = 3;
    });
    await expect(page.locator("nbplay-position")).toHaveText("2.3");
  });

  test("waveform and envelope draw onto sized canvases", async ({ page }) => {
    await mount(
      page,
      "nbplay-waveform",
      { data: new Float32Array(64).fill(0.5) },
      [],
    );
    await mount(page, "nbplay-envelope", { attack: 0.5 }, []);
    for (const tag of ["nbplay-waveform", "nbplay-envelope"]) {
      const size = await page
        .locator(`${tag} canvas`)
        .evaluate((c) => [c.width, c.height]);
      expect(size[0]).toBeGreaterThan(0);
      expect(size[1]).toBeGreaterThan(0);
    }
  });
});
