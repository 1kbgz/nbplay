import { test, expect } from "@playwright/test";
import { events, mount } from "./mount.js";

test.describe("tracks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("lists the tracks and posts an added one, then reloads", async ({
    page,
  }) => {
    const posted = [];
    await page.route("**/tracks", async (route) => {
      posted.push(JSON.parse(route.request().postData()));
      await route.fulfill({ json: { panels: [] } });
    });
    await mount(
      page,
      "nbplay-tracks",
      { url: "/tracks", tracks: ["Lead", "Beat"] },
      ["nbplay-request"],
    );
    await page.locator(".nbplay-tracks-toggle").click();
    await expect(page.locator(".nbplay-tracks-name")).toHaveText([
      "Lead",
      "Beat",
    ]);
    await page.locator(".nbplay-tracks-new-name").fill("Keys");
    await page.locator('select[name="instrument"]').selectOption("fm");
    await page.locator('select[name="notes"]').selectOption("arpeggiator");
    const reload = page.waitForEvent("load");
    await page.locator(".nbplay-tracks-add-button").click();
    await reload;
    expect(posted).toEqual([
      { action: "add", name: "Keys", instrument: "fm", notes: "arpeggiator" },
    ]);
  });

  test("a host can take the change; a refused one shows the error", async ({
    page,
  }) => {
    await page.route("**/tracks", (route) =>
      route.fulfill({ status: 400, json: { error: "no track 9" } }),
    );
    await mount(page, "nbplay-tracks", { url: "/tracks", tracks: ["Lead"] }, [
      "nbplay-request",
    ]);
    // A host that cancels the request handles the change itself.
    await page.evaluate(() =>
      document
        .querySelector("nbplay-tracks")
        .addEventListener("nbplay-request", (e) => e.preventDefault(), {
          once: true,
        }),
    );
    await page.locator(".nbplay-tracks-toggle").click();
    await page.locator(".nbplay-tracks-remove").click();
    expect(await events(page)).toEqual([
      [
        "nbplay-request",
        { name: "tracks", change: { action: "remove", index: 0 } },
      ],
    ]);
    await expect(page.locator(".nbplay-tracks-error")).toHaveCount(0);
    // Without a host the server answers, and its error shows.
    await page.locator(".nbplay-tracks-remove").click();
    await expect(page.locator(".nbplay-tracks-error")).toHaveText("no track 9");
  });
});
