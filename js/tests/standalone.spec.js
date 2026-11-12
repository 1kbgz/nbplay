import { test, expect } from "@playwright/test";

// The static web app: no server. The session and its models run in Pyodide
// inside a Web Worker, and transports frames cross with postMessage. These
// checks all go through Python: validation, session mirroring, and commands.

const set = (page, tag, values) =>
  page.evaluate(
    ({ tag, values }) => {
      const el = document.querySelector(tag);
      Object.assign(el, values);
      el.dispatchEvent(
        new CustomEvent("nbplay-set", { detail: { values }, bubbles: true }),
      );
    },
    { tag, values },
  );

test.describe("static web app", () => {
  test("the Pyodide session validates edits, mirrors widgets and sends commands", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto("/app/index.html");
    await expect(page.locator("html")).toHaveAttribute("data-ready", "true", {
      timeout: 240 * 1000,
    });
    for (const tag of [
      "nbplay-transport",
      "nbplay-launcher",
      "nbplay-timeline",
      "nbplay-mixer",
      "nbplay-sequencer",
      "nbplay-synth",
      "nbplay-sampler",
    ]) {
      await expect(
        page.locator(`regular-layout-frame ${tag}`).first(),
      ).toBeAttached();
    }
    const transport = page.locator("nbplay-transport");
    await expect(transport).toHaveJSProperty("bpm", 120);
    await expect(page.locator("nbplay-mixer nbplay-strip")).toHaveCount(3);

    // pydantic rejects an out-of-range edit and the element gets the model's
    // value back; a valid one is accepted and the Rust core, compiled to
    // WebAssembly, re-renders the waveform.
    const synth = page.locator("nbplay-synth");
    const waveform = () =>
      page.evaluate(() =>
        Array.from(
          new Uint8Array(document.querySelector("nbplay-synth").waveform).slice(
            0,
            64,
          ),
        ).join(),
      );
    const before = await waveform();
    await set(page, "nbplay-synth", { frequency: 5 });
    await expect(synth).toHaveJSProperty("frequency", 440);
    await set(page, "nbplay-synth", { frequency: 880 });
    await expect(synth).toHaveJSProperty("frequency", 880);
    await expect.poll(waveform).not.toBe(before);

    // The Python Session mirrors the mixer's mute onto the timeline lane and
    // the transport's theme onto every widget.
    await page
      .locator("nbplay-mixer nbplay-strip")
      .first()
      .locator('nbplay-toggle[variant="mute"] button')
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.querySelector("nbplay-timeline").tracks[0].muted,
        ),
      )
      .toBe(true);
    await page.locator(".nbplay-app-bar select").selectOption("grim");
    for (const tag of ["html", "nbplay-mixer", "nbplay-sampler"]) {
      await expect(page.locator(tag).first()).toHaveAttribute(
        "data-nbplay-theme",
        "grim",
      );
    }

    // Python commands reach the elements through nbplay-wire.
    await page.evaluate(() => globalThis.nbplay.call("transport", "play"));
    await expect(transport).toHaveAttribute("is-playing", "");
    await expect(page.locator("nbplay-sequencer").first()).toHaveAttribute(
      "is-playing",
      "",
    );
    await page.evaluate(() => globalThis.nbplay.call("transport", "stop"));
    await expect(transport).not.toHaveAttribute("is-playing");
    expect(errors).toEqual([]);
  });
});
