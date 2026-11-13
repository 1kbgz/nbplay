import fs from "fs";
import { test, expect } from "@playwright/test";

// The served app: real widgets in a Python process behind WebSockets, the
// elements in regular-layout panels. Browser edits reach the kernel's models,
// kernel assignments and commands reach the elements, and the elements share
// one clock through the session bus.

const state = async (request) => (await request.get("/state")).json();

test.describe("web app", () => {
  test("panels render every instrument and the kernel and browser share state", async ({
    page,
    request,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto("/");
    const layout = page.locator("spaday-regular-layout");
    await expect(layout).toBeVisible();
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
    await expect(
      page.locator(
        "nbplay-transport .nbplay-transport-tempo .nbplay-value-text",
      ),
    ).toContainText("120");

    // Kernel config assignment reaches the element.
    await request.post("/set/transport/bpm", { data: { value: 140 } });
    await expect(
      page.locator(
        "nbplay-transport .nbplay-transport-tempo .nbplay-value-text",
      ),
    ).toContainText("140");

    // A browser edit is validated by the kernel model and lands there.
    await page.evaluate(() => {
      const el = document.querySelector("nbplay-transport");
      el.bpm = 96;
      el.dispatchEvent(
        new CustomEvent("nbplay-set", {
          detail: { values: { bpm: 96 } },
          bubbles: true,
        }),
      );
    });
    await expect
      .poll(async () => (await state(request)).transport.config.bpm)
      .toBe(96);

    // A tempo drag in the browser reaches every widget's model in the kernel,
    // and the kernel's mirrored writes do not pull the clock back.
    const tempo = page.locator(
      "nbplay-transport .nbplay-transport-tempo input[type=range]",
    );
    const box = await tempo.boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    for (let i = 1; i <= 40; i++) {
      await page.mouse.move(box.x + box.width * (0.3 + (0.4 * i) / 40), y);
    }
    await page.mouse.up();
    const dragged = await page.evaluate(
      () => document.querySelector("nbplay-transport").bpm,
    );
    expect(dragged).not.toBe(96);
    await expect
      .poll(async () => {
        const models = await state(request);
        return [
          "transport",
          "launcher",
          "timeline",
          "lead-sequencer",
          "drums-sequencer",
        ].map((name) => models[name].config.bpm);
      })
      .toEqual([dragged, dragged, dragged, dragged, dragged]);
    expect(
      await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            "nbplay-transport, nbplay-launcher, nbplay-timeline, nbplay-sequencer",
          ),
        ].map((el) => Number(el.bpm)),
      ),
    ).toEqual([dragged, dragged, dragged, dragged, dragged]);

    // The browser owns play state: pressing play updates the kernel's status
    // and every instrument follows the shared clock.
    await page.locator("nbplay-transport .nbplay-transport-play").click();
    await expect(transport).toHaveAttribute("is-playing", "");
    await expect(page.locator("nbplay-sequencer").first()).toHaveAttribute(
      "is-playing",
      "",
    );
    await expect
      .poll(async () => (await state(request)).transport.status.is_playing)
      .toBe(true);
    await expect
      .poll(
        async () => (await state(request))["lead-sequencer"].status.is_playing,
      )
      .toBe(true);

    // A kernel command moves the clock through nbplay-wire, which found its
    // wire through the served page.
    await request.post("/command/transport/stop");
    await expect(transport).not.toHaveAttribute("is-playing");
    await expect(page.locator("nbplay-sequencer").first()).not.toHaveAttribute(
      "is-playing",
    );
    await expect
      .poll(async () => (await state(request)).transport.status.is_playing)
      .toBe(false);

    // Session commands from the kernel reach the owning panel too.
    await request.post("/command/transport/play");
    await expect(transport).toHaveAttribute("is-playing", "");
    await request.post("/command/transport/stop");
    await expect(transport).not.toHaveAttribute("is-playing");

    // The top bar's theme select re-themes the page and every instrument
    // through the kernel, which mirrors the transport's theme to the rest.
    const themeSelect = page.locator(".nbplay-app-bar select");
    await expect(themeSelect).toHaveValue("studio");
    await expect(page.locator("html")).toHaveAttribute(
      "data-nbplay-theme",
      "studio",
    );
    await themeSelect.selectOption("grim");
    await expect(page.locator("html")).toHaveAttribute(
      "data-nbplay-theme",
      "grim",
    );
    for (const tag of ["nbplay-transport", "nbplay-mixer", "nbplay-sampler"]) {
      await expect(page.locator(tag).first()).toHaveAttribute(
        "data-nbplay-theme",
        "grim",
      );
    }
    await expect
      .poll(async () => (await state(request))["drums-sampler"].config.theme)
      .toBe("grim");
    expect(errors).toEqual([]);
  });

  test("the palette reopens a closed panel", async ({ page }) => {
    await page.goto("/");
    const mixer = page.locator("regular-layout-frame nbplay-mixer");
    await expect(mixer).toBeVisible();
    const laidOut = () =>
      page.evaluate(
        () =>
          document
            .querySelector("spaday-regular-layout")
            .calculatePath("mixer") !== null,
      );
    await page
      .locator('regular-layout-frame[name="mixer"] [part~="close"]')
      .click();
    await expect.poll(laidOut).toBe(false);
    await expect(mixer).toBeHidden();

    // The tabs are titled, not labelled with the panel ids.
    expect(
      await page.evaluate(() => {
        const frame = document.querySelector(
          'regular-layout-frame[name="drums-sampler"]',
        );
        const title = (frame.shadowRoot ?? frame).querySelector(
          'regular-layout-tab[name="drums-sampler"] [part~="title"]',
        );
        return getComputedStyle(title, "::before").content;
      }),
    ).toBe('"Drums sampler"');

    // Ctrl+K lists every panel; picking one puts it back in the layout.
    const dialog = page.locator("nbplay-palette dialog");
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible();
    await expect(page.locator(".nbplay-palette-option")).toHaveCount(8);
    await page.keyboard.type("mix");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect.poll(laidOut).toBe(true);
    await expect(mixer).toBeVisible();

    // The top bar button shows the shortcut and opens the same palette.
    const hint = page.locator(".nbplay-app-bar nbplay-palette-hint button");
    await expect(hint).toHaveText(/panels\s+(\u2318|Ctrl) K/);
    await hint.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("save downloads the session and load replaces it", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await expect(
      page.locator("regular-layout-frame nbplay-mixer"),
    ).toBeVisible();
    await request.post("/set/transport/bpm", { data: { value: 111 } });
    const tempo = page.locator(
      "nbplay-transport .nbplay-transport-tempo .nbplay-value-text",
    );
    await expect(tempo).toContainText("111");
    await expect
      .poll(async () => {
        const models = await state(request);
        return [
          models.launcher.config.bpm,
          models.timeline.config.bpm,
          models["lead-sequencer"].config.bpm,
          models["drums-sequencer"].config.bpm,
        ];
      })
      .toEqual([111, 111, 111, 111]);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".nbplay-app-bar a", { hasText: "save" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("session.nbplay");
    const saved = await download.path();

    // Change the session, then load the saved one: the page reloads onto it.
    await request.post("/set/transport/bpm", { data: { value: 150 } });
    await expect(tempo).toContainText("150");
    await page
      .locator(".nbplay-app-bar nbplay-upload input")
      .setInputFiles(saved);
    await expect(tempo).toContainText("111");
    await expect
      .poll(async () => (await state(request)).transport.config.bpm)
      .toBe(111);
    // The reloaded page talks to the loaded session.
    await page.locator("nbplay-transport .nbplay-transport-play").click();
    await expect
      .poll(async () => (await state(request)).transport.status.is_playing)
      .toBe(true);
    await request.post("/command/transport/stop");
  });

  test("a saved session holds the audio of a recorded take", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await expect(
      page.locator("regular-layout-frame nbplay-mixer"),
    ).toBeVisible();
    // A take lives in the page as a blob until a save asks for its audio.
    await page.evaluate(() => {
      const timeline = document.querySelector("nbplay-timeline");
      const clips = [
        {
          id: "take-1",
          name: "Take 1",
          track_index: 0,
          start: 0,
          duration: 4,
          recorded: true,
          audio_url: URL.createObjectURL(
            new Blob(["recorded take"], { type: "audio/webm" }),
          ),
          blob_type: "audio/webm",
          source: "recording",
          sample_rate: 44100,
        },
      ];
      timeline.clips = clips;
      timeline.dispatchEvent(
        new CustomEvent("nbplay-set", {
          detail: { values: { clips } },
          bubbles: true,
        }),
      );
    });
    await expect
      .poll(async () =>
        (await state(request)).timeline.config.clips.map((clip) => clip.id),
      )
      .toEqual(["take-1"]);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".nbplay-app-bar a", { hasText: "save" }).click(),
    ]);
    const archive = fs.readFileSync(await download.path());
    expect(archive.includes("clips/take-1")).toBe(true);
    const timeline = (await state(request)).timeline;
    expect(timeline.status.exported_clip_data).toEqual({
      bytes: "recorded take".length,
    });
    expect(timeline.config.export_clip_id).toBe("");
  });
});
