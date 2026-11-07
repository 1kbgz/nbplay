import { test, expect } from "@playwright/test";
import { mount, events } from "./mount.js";

test.describe("midi composites", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("midi port selects a port, refreshes, and shows status", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-midi-port",
      {
        ports: [
          { id: "in-1", name: "Launchkey" },
          { id: "in-2", name: "IAC Bus 1" },
        ],
        value: "in-1",
        status: "connected",
      },
      ["change", "nbplay-refresh"],
    );
    const select = page.locator("nbplay-midi-port select");
    await expect(select.locator("option")).toHaveCount(3);
    await expect(select).toHaveValue("in-1");
    await expect(page.locator("nbplay-midi-port")).toHaveAttribute(
      "status",
      "connected",
    );
    await expect(page.locator(".nbplay-midi-port-status")).toHaveText(
      "Connected",
    );
    await select.selectOption("in-2");
    await page.locator(".nbplay-midi-port-refresh").click();
    expect(await events(page)).toEqual([
      ["change", { value: "in-2" }],
      ["nbplay-refresh", {}],
    ]);
    // ports arriving after the value keep the select on the current id
    await page.evaluate(() => {
      const el = document.querySelector("nbplay-midi-port");
      el.value = "in-3";
      el.ports = [...el.ports, { id: "in-3", name: "Late" }];
    });
    await expect(select).toHaveValue("in-3");
  });

  test("midi log formats messages newest first and trims to max", async ({
    page,
  }) => {
    await mount(
      page,
      "nbplay-midi-log",
      {
        max: 3,
        entries: [
          [0x90, 60, 100],
          [0xb0, 1, 64],
        ],
      },
      [],
    );
    const entries = page.locator("nbplay-midi-log .nbplay-midi-log-entry");
    await expect(entries).toHaveText([
      /NoteOn\s+ch=1 note=60 vel=100/,
      /CC\s+ch=1 ctrl=1 val=64/,
    ]);
    await page.evaluate(() => {
      const el = document.querySelector("nbplay-midi-log");
      el.push([0xf8]);
      el.push([0x80, 60, 0]);
    });
    await expect(entries).toHaveText([
      /NoteOff\s+ch=1 note=60 vel=0/,
      /Clock/,
      /NoteOn/,
    ]);
    const formatted = await page.evaluate(async () => {
      const mod = await window.__components;
      return [mod.fmtMidiMsg([0xe0, 0, 64]), mod.fmtMidiMsg([0xf1, 2])];
    });
    expect(formatted).toEqual(["Bend    ch=1 val=8192", "Raw [f1 02]"]);
  });
});
