import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import fs from "node:fs";

// The transport instrument as a spaday view on transports models: a real
// TransportWidget runs in a Python subprocess and its comm traffic is relayed
// to the spaday widget bundle rendered here. NBPLAY_TEST_PYTHON names the
// Python with nbplay installed (default: python).

const PYTHON = process.env.NBPLAY_TEST_PYTHON ?? "python";

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

/** Render the kernel's widgets in the harness page, relaying comm traffic per widget. */
async function mount(page, kernel, names) {
  const { result: description } = await kernel.call({ op: "describe" });
  const widgets = names
    ? Object.fromEntries(names.map((n) => [n, description.widgets[n]]))
    : { owner: description };
  fs.mkdirSync("dist/vendor", { recursive: true });
  fs.copyFileSync(description.widget_esm, "dist/vendor/spaday-widget.js");
  await page.exposeFunction("kernelMessage", (request) => kernel.call(request));
  await page.goto("/tests/fixtures/spaday.html");
  await page.waitForFunction(() => window.__widget);
  await page.evaluate(
    async ({ widgets, named }) => {
      const { widget, fakeModel } = window.__widget;
      window.notebook = { models: {}, delivered: 0 };
      let queue = Promise.resolve();
      const deliver = (response) => {
        for (const { widget: target, content, buffers } of response.messages) {
          window.notebook.delivered += 1;
          const model = window.notebook.models[named ? target : "owner"];
          model?._emit(
            "msg:custom",
            content,
            buffers.map((bytes) => new Uint8Array(bytes)),
          );
        }
      };
      window.notebook.deliver = deliver;
      for (const [name, desc] of Object.entries(widgets)) {
        const model = fakeModel(desc);
        window.notebook.models[name] = model;
        model.send = (content, _, buffers = []) => {
          queue = queue
            .then(() =>
              window.kernelMessage({
                op: "receive",
                ...(named ? { widget: name } : {}),
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
        el.id = name;
        document.body.appendChild(el);
        await widget.render({ model, el });
      }
      window.notebook.model = window.notebook.models.owner;
    },
    { widgets, named: Boolean(names) },
  );
  // The views' ready handshakes and snapshots have arrived.
  await page.waitForFunction(
    (count) => window.notebook.delivered >= count,
    Object.keys(widgets).length,
  );
}

const state = async (kernel) => (await kernel.call({ op: "state" })).result;

test.describe("views on transports", () => {
  // One kernel subprocess and one copied widget bundle at a time.
  test.describe.configure({ mode: "serial" });

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

  test("launcher: kernel tracks, scenes and slots build the grid", async ({
    page,
  }) => {
    const kernel = await viewKernel("launcher");
    try {
      await mount(page, kernel);
      await expect(page.locator("#owner nbplay-launcher")).toBeVisible();
      for (const call of [
        { op: "command", name: "add_track", args: ["Drums"] },
        { op: "command", name: "add_scene", args: ["Intro"] },
        {
          op: "command",
          name: "set_slot",
          args: [0, 0, [{ note: 36, active: true }]],
        },
      ]) {
        await page.evaluate(
          (response) => notebook.deliver(response),
          await kernel.call(call),
        );
      }
      await expect(
        page.locator("#owner .nbplay-launcher-grid-row[data-track]"),
      ).toHaveCount(1);
      await expect(
        page.locator(
          "#owner .nbplay-launcher-grid-row .nbplay-launcher-slot-button.filled",
        ),
      ).toHaveCount(1);
      expect((await state(kernel)).config.slots[0].name).toBe("Drums 1");
    } finally {
      kernel.close();
    }
  });

  test("timeline: kernel lanes and clips render and a play command starts the clock", async ({
    page,
  }) => {
    const kernel = await viewKernel("timeline");
    try {
      await mount(page, kernel);
      const timeline = page.locator("#owner nbplay-timeline");
      await expect(timeline).toBeVisible();
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({
          op: "command",
          name: "add_track",
          args: ["Vocals"],
        }),
      );
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({
          op: "command",
          name: "add_clip",
          args: ["Take"],
          kwargs: { track_index: 0, start: 4, duration: 8 },
        }),
      );
      await expect(page.locator("#owner nbplay-lane")).toHaveCount(1);
      await expect(
        page.locator("#owner nbplay-clip .nbplay-clip-name"),
      ).toHaveText("Take");
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({ op: "command", name: "play" }),
      );
      await expect(timeline).toHaveAttribute("is-playing", "");
      await expect
        .poll(async () => (await state(kernel)).status.is_playing)
        .toBe(true);
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({ op: "command", name: "stop" }),
      );
      await expect(timeline).not.toHaveAttribute("is-playing");
    } finally {
      kernel.close();
    }
  });

  test("session: the shared clock plays every view and the kernel sees each status", async ({
    page,
  }) => {
    const kernel = await viewKernel("session");
    try {
      await mount(page, kernel, ["transport", "sequencer", "synth"]);
      const transport = page.locator("#transport nbplay-transport");
      const sequencer = page.locator("#sequencer nbplay-sequencer");
      await expect(transport).toBeVisible();
      await expect(sequencer).toBeVisible();
      await expect(page.locator("#synth nbplay-synth")).toBeVisible();
      const ids = await page.evaluate(() => [
        document.querySelector("#transport nbplay-transport").sessionId,
        document.querySelector("#sequencer nbplay-sequencer").sessionId,
        document.querySelector("#synth nbplay-synth").sessionId,
      ]);
      expect(new Set(ids).size).toBe(1);
      expect(ids[0]).toMatch(/^nbplay-/);

      // session.play() is a transport command; the sequencer follows the shared clock.
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({ op: "command", name: "play" }),
      );
      await expect(transport).toHaveAttribute("is-playing", "");
      await expect(sequencer).toHaveAttribute("is-playing", "");
      await expect
        .poll(async () => {
          const all = (await kernel.call({ op: "state" })).result;
          return [
            all.transport.status.is_playing,
            all.sequencer.status.is_playing,
          ];
        })
        .toEqual([true, true]);

      // A tempo change from the kernel reaches the clock and every view.
      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({
          op: "set",
          widget: "transport",
          field: "bpm",
          value: 90,
        }),
      );
      await expect(
        page.locator("#transport .nbplay-transport-tempo .nbplay-value-text"),
      ).toContainText("90");
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              globalThis.__nbplay[
                document.querySelector("#transport nbplay-transport").sessionId
              ].clock.bpm,
          ),
        )
        .toBe(90);

      // Ctrl+Z with the transport focused asks the session to undo that change.
      await page.locator("#transport .nbplay-transport").focus();
      await page.keyboard.press("Control+z");
      await expect(
        page.locator("#transport .nbplay-transport-tempo .nbplay-value-text"),
      ).toContainText("120");
      await expect
        .poll(
          async () =>
            (await kernel.call({ op: "state" })).result.transport.config.bpm,
        )
        .toBe(120);

      await page.evaluate(
        (response) => notebook.deliver(response),
        await kernel.call({ op: "command", name: "stop" }),
      );
      await expect(transport).not.toHaveAttribute("is-playing");
      await expect(sequencer).not.toHaveAttribute("is-playing");
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
