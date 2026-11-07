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

async function viewKernel(view) {
  const child = spawn(PYTHON, [
    "../nbplay/tests/spaday_bridge.py",
    view,
    "json",
  ]);
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

/** Render the kernel's view in the harness page, relaying comm traffic. */
async function mount(page, kernel) {
  const { result: description } = await kernel.call({ op: "describe" });
  fs.mkdirSync("dist/vendor", { recursive: true });
  fs.copyFileSync(description.widget_esm, "dist/vendor/spaday-widget.js");
  await page.exposeFunction("kernelMessage", (request) => kernel.call(request));
  await page.goto("/tests/fixtures/spaday.html");
  await page.waitForFunction(() => window.__widget);
  await page.evaluate(async (description) => {
    const { widget, fakeModel } = window.__widget;
    const model = fakeModel(description);
    let queue = Promise.resolve();
    window.notebook = { model, delivered: 0 };
    const deliver = (response) => {
      for (const { content, buffers } of response.messages) {
        window.notebook.delivered += 1;
        model._emit(
          "msg:custom",
          content,
          buffers.map((bytes) => new Uint8Array(bytes)),
        );
      }
    };
    window.notebook.deliver = deliver;
    model.send = (content, _, buffers = []) => {
      queue = queue
        .then(() =>
          window.kernelMessage({
            op: "receive",
            content,
            buffers: buffers.map((b) =>
              Array.from(new Uint8Array(b.buffer, b.byteOffset, b.byteLength)),
            ),
          }),
        )
        .then(deliver);
    };
    const el = document.createElement("div");
    el.id = "owner";
    document.body.appendChild(el);
    await widget.render({ model, el });
  }, description);
  // The view's ready handshake and snapshots have arrived.
  await page.waitForFunction(() => window.notebook.delivered > 0);
}

const state = async (kernel) => (await kernel.call({ op: "state" })).result;

test.describe("views on transports", () => {
  // One kernel subprocess and one copied widget bundle at a time.
  test.describe.configure({ mode: "serial" });
  test.skip(!available(), "spaday session support is not installed");

  test("transport: the kernel and the owning view share config, status and commands", async ({
    page,
  }) => {
    const kernel = await viewKernel("transport");
    try {
      await mount(page, kernel);
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
        await kernel.call({ op: "set", field: "bpm", value: 140 }),
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
      await expect.poll(async () => (await state(kernel)).config.bpm).toBe(96);

      // The browser owns play state: pressing play updates the kernel's status.
      await page.locator("#owner .nbplay-transport-play").click();
      await expect(transport).toHaveAttribute("is-playing", "");
      await expect
        .poll(async () => (await state(kernel)).status.is_playing)
        .toBe(true);

      // A kernel command moves the clock through nbplay-wire.
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({ op: "command", name: "stop" }),
      );
      await expect(transport).not.toHaveAttribute("is-playing");
      await expect
        .poll(async () => (await state(kernel)).status.is_playing)
        .toBe(false);
    } finally {
      kernel.close();
    }
  });

  test("synth: the kernel renders the waveform for browser edits and plays on command", async ({
    page,
  }) => {
    const kernel = await viewKernel("synth");
    try {
      await mount(page, kernel);
      const synth = page.locator("#owner nbplay-synth");
      await expect(synth).toBeVisible();
      const waveformBytes = () =>
        page.evaluate(
          () =>
            document.querySelector("#owner nbplay-synth").waveform
              ?.byteLength ?? 0,
        );
      // 440 Hz: three cycles of 44.1 kHz float32 samples.
      await expect.poll(waveformBytes).toBe(4 * Math.floor((44100 / 440) * 3));

      // A browser edit is validated by the kernel, which re-renders the preview.
      await page.evaluate(() => {
        const el = document.querySelector("#owner nbplay-synth");
        el.frequency = 110;
        el.dispatchEvent(
          new CustomEvent("nbplay-set", {
            detail: { values: { frequency: 110 } },
            bubbles: true,
          }),
        );
      });
      await expect
        .poll(async () => (await state(kernel)).config.frequency)
        .toBe(110);
      await expect.poll(waveformBytes).toBe(4 * Math.floor((44100 / 110) * 3));

      // A kernel command starts the tone; the browser owns the play state.
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({ op: "command", name: "play" }),
      );
      await expect(synth).toHaveAttribute("is-playing", "");
      await expect
        .poll(async () => (await state(kernel)).status.is_playing)
        .toBe(true);
      await page.locator("#owner .nbplay-play-btn").click();
      await expect(synth).not.toHaveAttribute("is-playing");
      await expect
        .poll(async () => (await state(kernel)).status.is_playing)
        .toBe(false);
    } finally {
      kernel.close();
    }
  });

  test("mixer: kernel and browser edits meet in one validated console", async ({
    page,
  }) => {
    const kernel = await viewKernel("mixer");
    try {
      await mount(page, kernel);
      const mixer = page.locator("#owner nbplay-mixer");
      await expect(mixer).toBeVisible();
      await expect(page.locator("#owner .nbplay-master-strip")).toBeVisible();
      const strips = page.locator(
        "#owner .nbplay-mixer-strip:not(.nbplay-master-strip)",
      );
      await expect(strips).toHaveCount(0);

      // Kernel edits build the console.
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({
          op: "command",
          name: "add_channel",
          args: ["Drums"],
        }),
      );
      await expect(strips).toHaveCount(1);
      await expect(strips.first().locator(".nbplay-strip-name")).toHaveText(
        "Drums",
      );
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({
          op: "command",
          name: "add_master_effect",
          args: [{ type: "limiter", threshold: -3 }],
        }),
      );
      await expect(
        page.locator("#owner .nbplay-master-strip .nbplay-effect-rack-chip"),
      ).toHaveText("limiter");

      // A browser edit is clamped by the kernel model and echoed back.
      await page.evaluate(() => {
        const el = document.querySelector("#owner nbplay-mixer");
        const channels = [{ ...el.channels[0], gain: 5 }];
        el.channels = channels;
        el.dispatchEvent(
          new CustomEvent("nbplay-set", {
            detail: { values: { channels } },
            bubbles: true,
          }),
        );
      });
      await expect
        .poll(async () => (await state(kernel)).config.channels[0].gain)
        .toBe(2);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.querySelector("#owner nbplay-mixer").channels[0].gain,
          ),
        )
        .toBe(2);
    } finally {
      kernel.close();
    }
  });

  test("pads: a browser tap becomes kernel status and kernel notes relabel the grid", async ({
    page,
  }) => {
    const kernel = await viewKernel("pads");
    try {
      await mount(page, kernel);
      const pads = page.locator("#owner nbplay-pads");
      await expect(pads).toBeVisible();
      await expect(page.locator("#owner .nbplay-pad-cell")).toHaveCount(16);

      const cell = page.locator("#owner .nbplay-pad-cell").first();
      const box = await cell.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.up();
      await expect
        .poll(async () => (await state(kernel)).status.last_note_event.note)
        .toBe(36);

      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({ op: "set", field: "pad_notes", value: [60] }),
      );
      await expect
        .poll(() =>
          page.evaluate(
            () => document.querySelector("#owner nbplay-pads").padNotes[0],
          ),
        )
        .toBe(60);
      // The kernel filled the rest of the grid from the new first note.
      expect((await state(kernel)).config.pad_notes.length).toBe(16);
    } finally {
      kernel.close();
    }
  });

  test("sequencer: kernel steps light the grid and a play command starts the clock", async ({
    page,
  }) => {
    const kernel = await viewKernel("sequencer");
    try {
      await mount(page, kernel);
      const seq = page.locator("#owner nbplay-sequencer");
      await expect(seq).toBeVisible();
      await expect(
        page.locator("#owner .nbplay-step-grid-cell.active"),
      ).toHaveCount(0);
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({
          op: "command",
          name: "set_step",
          args: [0],
          kwargs: { note: 48 },
        }),
      );
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({
          op: "command",
          name: "set_step",
          args: [4],
          kwargs: { note: 52 },
        }),
      );
      await expect(
        page.locator("#owner .nbplay-step-grid-cell.active"),
      ).toHaveCount(2);

      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({ op: "command", name: "play" }),
      );
      await expect(seq).toHaveAttribute("is-playing", "");
      await expect
        .poll(async () => (await state(kernel)).status.is_playing)
        .toBe(true);
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({ op: "command", name: "stop" }),
      );
      await expect(seq).not.toHaveAttribute("is-playing");
    } finally {
      kernel.close();
    }
  });

  test("sampler: a kernel sample reaches the element as bytes and pads follow the count", async ({
    page,
  }) => {
    const kernel = await viewKernel("sampler");
    try {
      await mount(page, kernel);
      const sampler = page.locator("#owner nbplay-sampler");
      await expect(sampler).toBeVisible();
      await expect(page.locator("#owner .nbplay-pad-cell")).toHaveCount(8);
      const samples = Array.from({ length: 1000 }, (_, i) => Math.sin(i / 10));
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({
          op: "command",
          name: "load_sample",
          args: [samples],
          kwargs: { sample_rate: 22050, name: "sine" },
        }),
      );
      await expect
        .poll(() =>
          page.evaluate(() => {
            const el = document.querySelector("#owner nbplay-sampler");
            return [
              el.sampleLength,
              el.sampleData?.byteLength ?? 0,
              el.sampleName,
            ];
          }),
        )
        .toEqual([1000, 4000, "sine"]);
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({
          op: "command",
          name: "configure_pads",
          kwargs: { pad_count: 4 },
        }),
      );
      await expect(page.locator("#owner .nbplay-pad-cell")).toHaveCount(4);
    } finally {
      kernel.close();
    }
  });

  for (const [name, tag, field, prop, value] of [
    ["keyboard", "nbplay-keyboard", "velocity", "velocity", 64],
    ["midi_keyboard", "nbplay-midi-keyboard", "sync_clock", "syncClock", true],
    ["settings", "nbplay-settings", "sample_rate", "sampleRate", 48000],
    ["midi_output", "nbplay-midi-output", "channel", "channel", 5],
  ]) {
    test(`${name}: kernel config reaches the element`, async ({ page }) => {
      const kernel = await viewKernel(name);
      try {
        await mount(page, kernel);
        await expect(page.locator(`#owner ${tag}`)).toBeVisible();
        await page.evaluate(
          (response) => notebook.deliver(response),
          await kernel.call({ op: "set", field, value }),
        );
        await expect
          .poll(() =>
            page.evaluate(
              ([tag, prop]) => document.querySelector(`#owner ${tag}`)[prop],
              [tag, prop],
            ),
          )
          .toBe(value);
        if (name === "midi_output") {
          // A send request is a command the wire hands to the element.
          await page.evaluate(() => {
            const el = document.querySelector("#owner nbplay-midi-output");
            el.__commands = [];
            const original = el.command.bind(el);
            el.command = (req) => {
              el.__commands.push(req);
              original(req);
            };
          });
          await page.evaluate(
            (response) => notebook.deliver(response),
            await kernel.call({
              op: "command",
              name: "note_on",
              args: [60, 90],
            }),
          );
          await expect
            .poll(() =>
              page.evaluate(
                () =>
                  document.querySelector("#owner nbplay-midi-output")
                    .__commands,
              ),
            )
            .toEqual([{ kind: "note_on", note: 60, velocity: 90 }]);
        }
      } finally {
        kernel.close();
      }
    });
  }
});
