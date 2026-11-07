import { test, expect } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import fs from "node:fs";

// The transport instrument as a spaday view on transports models: a real
// TransportView runs in a Python subprocess and its comm traffic is relayed
// to the spaday widget bundle rendered here. Needs a Python with spaday
// session support and transports 0.12 (NBPLAY_TEST_PYTHON); skipped otherwise.

const PYTHON = process.env.NBPLAY_TEST_PYTHON ?? "python";

function available() {
  const probe = spawnSync(PYTHON, ["-c", "import nbplay.views"], {
    encoding: "utf8",
  });
  return probe.status === 0;
}

async function viewKernel() {
  const child = spawn(PYTHON, ["../nbplay/tests/spaday_bridge.py", "json"]);
  const pending = [];
  let errors = "";
  child.stderr.on("data", (chunk) => {
    errors += chunk;
  });
  createInterface({ input: child.stdout }).on("line", (line) => {
    const next = pending.shift();
    try {
      next?.resolve(JSON.parse(line));
    } catch (e) {
      next?.reject(e);
    }
  });
  child.on("exit", () => {
    for (const call of pending.splice(0))
      call.reject(new Error(errors || "view kernel exited"));
  });
  return {
    call(request) {
      return new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
        child.stdin.write(JSON.stringify(request) + "\n");
      });
    },
    close() {
      child.stdin.end();
    },
  };
}

test.describe("TransportView on transports", () => {
  test.skip(!available(), "spaday session support is not installed");

  test("the kernel and the owning view share config, status and commands", async ({
    page,
  }) => {
    const kernel = await viewKernel();
    try {
      const { result: description } = await kernel.call({ op: "describe" });
      fs.mkdirSync("dist/vendor", { recursive: true });
      fs.copyFileSync(description.widget_esm, "dist/vendor/spaday-widget.js");
      await page.exposeFunction("kernelMessage", (request) =>
        kernel.call(request),
      );
      await page.goto("/tests/fixtures/spaday.html");
      await page.waitForFunction(() => window.__widget);
      await page.evaluate(async (description) => {
        const { widget, fakeModel } = window.__widget;
        const model = fakeModel(description);
        let queue = Promise.resolve();
        const deliver = (response) => {
          for (const { content, buffers } of response.messages)
            model._emit(
              "msg:custom",
              content,
              buffers.map((bytes) => new Uint8Array(bytes)),
            );
        };
        model.send = (content, _, buffers = []) => {
          queue = queue
            .then(() =>
              window.kernelMessage({
                op: "receive",
                content,
                buffers: buffers.map((b) =>
                  Array.from(
                    new Uint8Array(b.buffer, b.byteOffset, b.byteLength),
                  ),
                ),
              }),
            )
            .then(deliver);
        };
        const el = document.createElement("div");
        el.id = "owner";
        document.body.appendChild(el);
        await widget.render({ model, el });
        window.notebook = { model, deliver };
      }, description);

      const transport = page.locator("#owner nbplay-transport");
      await expect(transport).toBeVisible();
      await expect(page.locator("#owner nbplay-wire")).toHaveCount(1);
      const tempo = page.locator(
        "#owner .nbplay-transport-tempo .nbplay-value-text",
      );
      await expect(tempo).toContainText("120");

      // Kernel config assignment reaches the element.
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({ op: "set_bpm", bpm: 140 }),
      );
      await expect(tempo).toContainText("140");

      // A browser edit is validated by the kernel model and lands there.
      await page.evaluate(() => {
        const el = document.querySelector("#owner nbplay-transport");
        el.bpm = 96;
        el.dispatchEvent(
          new CustomEvent("nbplay-set", {
            detail: { values: { bpm: 96 } },
            bubbles: true,
          }),
        );
      });
      await expect
        .poll(async () => (await kernel.call({ op: "state" })).result.bpm)
        .toBe(96);

      // The browser owns play state: pressing play updates the kernel's status.
      await page.locator("#owner .nbplay-transport-play").click();
      await expect(transport).toHaveAttribute("is-playing", "");
      await expect
        .poll(
          async () => (await kernel.call({ op: "state" })).result.is_playing,
        )
        .toBe(true);

      // A kernel command moves the clock through nbplay-wire.
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({ op: "stop" }),
      );
      await expect(transport).not.toHaveAttribute("is-playing");
      await expect
        .poll(
          async () => (await kernel.call({ op: "state" })).result.is_playing,
        )
        .toBe(false);
    } finally {
      kernel.close();
    }
  });
});
