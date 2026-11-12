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
});
