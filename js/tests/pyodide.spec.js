import { test, expect } from "@playwright/test";

// The standalone Pyodide example: no server. The session and its models run in Pyodide
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

test.describe("standalone Pyodide example", () => {
  test("the Pyodide session validates edits, mirrors widgets and sends commands", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto("/index.html");
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

  test("save downloads the session and load restores it after a reload", async ({
    page,
  }) => {
    const ready = () =>
      expect(page.locator("html")).toHaveAttribute("data-ready", "true", {
        timeout: 240 * 1000,
      });
    await page.goto("/index.html");
    await ready();
    const tempo = page.locator(
      "nbplay-transport .nbplay-transport-tempo .nbplay-value-text",
    );
    await set(page, "nbplay-transport", { bpm: 111 });
    await expect(tempo).toContainText("111");
    // The session mirrors the tempo, so the launcher shows Python has it.
    await expect(page.locator("nbplay-launcher")).toHaveJSProperty("bpm", 111);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".nbplay-app-bar a", { hasText: "save" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("session.nbplay");
    const saved = await download.path();

    // A file that is not an archive is refused and the session stays.
    const upload = page.locator(".nbplay-app-bar nbplay-upload");
    await upload.locator("input").setInputFiles({
      name: "song.nbplay",
      mimeType: "application/zip",
      buffer: Buffer.from("not a zip"),
    });
    await expect(upload.locator("[role=alert]")).toContainText(
      "Not a session archive",
    );
    await expect(tempo).toContainText("111");

    // Change the session, then load the saved one: the page reloads onto it.
    await set(page, "nbplay-transport", { bpm: 150 });
    await expect(page.locator("nbplay-launcher")).toHaveJSProperty("bpm", 150);
    await page.evaluate(() => {
      window.__beforeReload = true;
    });
    await upload.locator("input").setInputFiles(saved);
    await expect
      .poll(() => page.evaluate(() => window.__beforeReload))
      .toBeUndefined();
    await ready();
    await expect(tempo).toContainText("111");
    // The loaded session is live: Python commands still reach the elements.
    const transport = page.locator("nbplay-transport");
    await page.evaluate(() => globalThis.nbplay.call("transport", "play"));
    await expect(transport).toHaveAttribute("is-playing", "");
    await page.evaluate(() => globalThis.nbplay.call("transport", "stop"));
    await expect(transport).not.toHaveAttribute("is-playing");

    // The loaded session is used once: a plain reload is the demo again.
    await page.reload();
    await ready();
    await expect(tempo).toContainText("120");
  });
});
