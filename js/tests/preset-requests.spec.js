import { test, expect } from "@playwright/test";
import { mount, events } from "./components/mount.js";

for (const tag of ["nbplay-synth", "nbplay-fm-synth", "nbplay-drums"]) {
  test(`${tag} distinguishes repeated preset picks in one millisecond`, async ({
    page,
  }) => {
    await page.goto("/tests/fixtures/components.html");
    await mount(page, tag, { presetNames: ["First", "Last"] }, [
      "nbplay-status",
    ]);
    await page.locator(tag).evaluate((element) => {
      const now = Date.now;
      Date.now = () => 1700000000000;
      try {
        const select = element.querySelector(".nbplay-preset-select");
        for (const name of ["First", "First", "Last"]) {
          select.value = name;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } finally {
        Date.now = now;
      }
    });
    const requests = (await events(page)).map(
      ([, detail]) => detail.values.presetRequest,
    );
    expect(requests).toEqual([
      "1700000000000:First",
      "1700000000001:First",
      "1700000000002:Last",
    ]);
  });
}

test("wire removes its flush listener on disconnect", async ({ page }) => {
  await page.goto("/tests/fixtures/components.html");
  const counts = await page.evaluate(async () => {
    await import("/dist/spaday/index.js");
    const host = document.createElement("div");
    document.body.appendChild(host);
    let flushed = 0;
    let stopped = 0;
    host.addEventListener("spaday:wire-request", (event) => {
      event.detail.wire = {
        namespace: "status",
        link: { modelId: 1 },
        client: {
          onCommand: () => () => {
            stopped += 1;
          },
          flushOwned: () => {
            flushed += 1;
            return true;
          },
        },
      };
    });
    const wire = document.createElement("nbplay-wire");
    host.appendChild(wire);
    host.dispatchEvent(new Event("nbplay-flush"));
    wire.remove();
    host.dispatchEvent(new Event("nbplay-flush"));
    host.appendChild(wire);
    host.dispatchEvent(new Event("nbplay-flush"));
    wire.remove();
    return { flushed, stopped };
  });
  expect(counts).toEqual({ flushed: 2, stopped: 2 });
});
