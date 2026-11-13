import { test, expect } from "@playwright/test";
import { mount } from "./mount.js";

const FILE = {
  name: "song.nbplay",
  mimeType: "application/zip",
  buffer: Buffer.from("archive bytes"),
};

test.describe("upload", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("puts the picked file to the url and reloads the page", async ({
    page,
  }) => {
    const requests = [];
    await page.route("**/session.nbplay", async (route) => {
      const request = route.request();
      requests.push([request.method(), request.postData()]);
      await route.fulfill({ json: { panels: [] } });
    });
    await mount(page, "nbplay-upload", {
      url: "/session.nbplay",
      label: "load",
      accept: ".nbplay",
    });
    await expect(page.locator("nbplay-upload label")).toContainText("load");
    await expect(page.locator("nbplay-upload input")).toHaveAttribute(
      "accept",
      ".nbplay",
    );
    await page.evaluate(() => {
      window.__beforeReload = true;
    });
    await page.locator("nbplay-upload input").setInputFiles(FILE);
    await expect
      .poll(() => page.evaluate(() => window.__beforeReload))
      .toBeUndefined();
    expect(requests).toEqual([["PUT", "archive bytes"]]);
  });

  test("shows the server's message when the file is refused", async ({
    page,
  }) => {
    await page.route("**/session.nbplay", (route) =>
      route.fulfill({
        status: 400,
        json: { error: "Not a session archive: bad zip" },
      }),
    );
    await mount(page, "nbplay-upload", {
      url: "/session.nbplay",
      label: "load",
    });
    await page.evaluate(() => {
      window.__beforeReload = true;
    });
    const input = page.locator("nbplay-upload input");
    await input.setInputFiles(FILE);
    await expect(page.locator("nbplay-upload [role=alert]")).toHaveText(
      "Not a session archive: bad zip",
    );
    expect(await page.evaluate(() => window.__beforeReload)).toBe(true);

    // A response with no JSON body still reports the failure.
    await page.unroute("**/session.nbplay");
    await page.route("**/session.nbplay", (route) =>
      route.fulfill({ status: 500, body: "boom" }),
    );
    await input.setInputFiles(FILE);
    await expect(page.locator("nbplay-upload [role=alert]")).toHaveText(
      "Upload failed (500)",
    );
  });

  test("a host that cancels the request takes the file and reports its own error", async ({
    page,
  }) => {
    const requests = [];
    await page.route("**/session.nbplay", async (route) => {
      requests.push(route.request().method());
      await route.fulfill({ json: {} });
    });
    await mount(page, "nbplay-upload", {
      url: "/session.nbplay",
      label: "load",
    });
    await page.evaluate(() => {
      document.addEventListener("nbplay-request", async (event) => {
        if (event.detail.name !== "upload") return;
        event.preventDefault();
        window.__taken = await event.detail.file.text();
        event.target.error = "Not a session archive";
      });
    });
    await page.locator("nbplay-upload input").setInputFiles(FILE);
    await expect(page.locator("nbplay-upload [role=alert]")).toHaveText(
      "Not a session archive",
    );
    expect(await page.evaluate(() => window.__taken)).toBe("archive bytes");
    expect(requests).toEqual([]);
  });
});
