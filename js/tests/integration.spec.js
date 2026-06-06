import { test, expect } from "@playwright/test";

// Shared defaults

const SESSION_ID = "integ-test-session";

const MIXER_DEFAULTS = {
  session_id: SESSION_ID,
  channels: [{ name: "Samp", gain: 1.0, pan: 0, mute: false, solo: false }],
  master_gain: 1.0,
};

const SAMPLER_DEFAULTS = {
  max_voices: 4,
  session_id: SESSION_ID,
  channel_index: 0,
  root_note: 60,
  sample_name: "Click",
  sample_rate: 44100,
  sample_length: 4410,
  attack: 0.01,
  decay: 0.1,
  sustain: 0.7,
  release: 0.3,
  waveform: null,
  pad_notes: [48, 52, 55, 59, 60, 64, 67, 71],
  keyboard_connected: false,
};

const KEYBOARD_DEFAULTS = {
  upper_octave: 3,
  lower_octave: 4,
  velocity: 100,
  active_notes: [],
  sustain_upper: false,
  sustain_lower: false,
  sustain_global: false,
  last_note_event: {},
  session_id: SESSION_ID,
  channel_index: 0,
  sampler_routing: [{ channel_index: 0, match: "all" }],
};

const SEQUENCER_DEFAULTS = {
  length: 8,
  bpm: 120,
  step_duration: 0.25,
  is_playing: false,
  current_step: -1,
  loop_enabled: true,
  num_voices: 1,
  session_id: "",
  channel_index: -1,
  keyboard_connected: false,
  voices_data: [
    Array.from({ length: 8 }, () => ({
      note: 60,
      velocity: 100,
      duration_ticks: 1,
      active: false,
    })),
  ],
};

// Helpers

/** Render mixer, creating the session bus. */
async function renderMixer(page, overrides = {}) {
  const opts = { ...MIXER_DEFAULTS, ...overrides };
  if (overrides.channels) opts.channels = overrides.channels;
  await page.evaluate(async (opts) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/dist/css/mixer.css";
    document.head.appendChild(link);

    const mod = await import("/dist/widgets/mixer.js");
    const el = document.createElement("div");
    document.getElementById("root").appendChild(el);
    const model = window.createMockModel({ ...opts });
    window.__mixerModel = model;
    mod.default.render({ model, el });
  }, opts);
}

/** Render sampler widget. */
async function renderSampler(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/sampler.css";
      document.head.appendChild(link);

      const mod = await import("/dist/widgets/sampler.js");
      const el = document.createElement("div");
      document.getElementById("root").appendChild(el);
      const model = window.createMockModel({ ...opts });
      window.__samplerModel = model;
      mod.default.render({ model, el });
    },
    { ...SAMPLER_DEFAULTS, ...overrides },
  );
}

/** Render keyboard widget. */
async function renderKeyboard(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/keyboard.css";
      document.head.appendChild(link);

      const mod = await import("/dist/widgets/keyboard.js");
      const el = document.createElement("div");
      document.getElementById("root").appendChild(el);
      const model = window.createMockModel({ ...opts });
      window.__keyboardModel = model;
      mod.default.render({ model, el });
    },
    { ...KEYBOARD_DEFAULTS, ...overrides },
  );
}

/** Render sequencer widget. */
async function renderSequencer(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/sequencer.css";
      document.head.appendChild(link);

      const mod = await import("/dist/widgets/sequencer.js");
      const el = document.createElement("div");
      document.getElementById("root").appendChild(el);
      const model = window.createMockModel({ ...opts });
      window.__sequencerModel = model;
      mod.default.render({ model, el });
    },
    { ...SEQUENCER_DEFAULTS, ...overrides },
  );
}

// Tests

test.describe("Integration: Keyboard + Sampler via Session", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // R1.5 — Session bus state after mixer + sampler render
  test("mixer creates session bus, sampler registers on it", async ({
    page,
  }) => {
    await renderMixer(page);
    await renderSampler(page);

    const busState = await page.evaluate(() => {
      const g = globalThis;
      const bus = g.__nbplay?.["integ-test-session"];
      if (!bus) return { busExists: false };
      const sampler = bus.samplers?.[0];
      return {
        busExists: true,
        hasSamplers: !!bus.samplers,
        samplerRegistered: !!sampler,
        hasTrigger: typeof sampler?.triggerNote === "function",
        hasRelease: typeof sampler?.releaseNote === "function",
      };
    });

    expect(busState.busExists).toBe(true);
    expect(busState.samplerRegistered).toBe(true);
    expect(busState.hasTrigger).toBe(true);
    expect(busState.hasRelease).toBe(true);
  });

  // R1.1 — Keyboard triggers sampler via session bus
  test("keyboard note-on triggers sampler triggerNote", async ({ page }) => {
    await renderMixer(page);
    await renderSampler(page);
    await renderKeyboard(page);

    // Spy on the sampler's triggerNote
    await page.evaluate(() => {
      const bus = globalThis.__nbplay["integ-test-session"];
      bus._triggerCalls = [];
      const origTrigger = bus.samplers[0].triggerNote;
      bus.samplers[0].triggerNote = (note, vel) => {
        bus._triggerCalls.push({ note, vel });
        origTrigger(note, vel);
      };
    });

    // Focus keyboard and press a note
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "q" });

    const calls = await page.evaluate(
      () => globalThis.__nbplay["integ-test-session"]._triggerCalls,
    );
    expect(calls.length).toBe(1);
    expect(calls[0].note).toBe(48); // C3 (upper_octave=3, Q=semitone 0)
    expect(calls[0].vel).toBe(100);
  });

  // R1.2 — Keyboard note-off triggers sampler releaseNote
  test("keyboard note-off triggers sampler releaseNote", async ({ page }) => {
    await renderMixer(page);
    await renderSampler(page);
    await renderKeyboard(page);

    // Spy on releaseNote
    await page.evaluate(() => {
      const bus = globalThis.__nbplay["integ-test-session"];
      bus._releaseCalls = [];
      const origRelease = bus.samplers[0].releaseNote;
      bus.samplers[0].releaseNote = (note) => {
        bus._releaseCalls.push({ note });
        origRelease(note);
      };
    });

    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "q" });
    await kb.dispatchEvent("keyup", { key: "q" });

    const calls = await page.evaluate(
      () => globalThis.__nbplay["integ-test-session"]._releaseCalls,
    );
    expect(calls.length).toBe(1);
    expect(calls[0].note).toBe(48);
  });

  // R1.3 — Keyboard without session uses built-in oscillator (no crash)
  test("keyboard with no session plays notes without error", async ({
    page,
  }) => {
    await renderKeyboard(page, {
      session_id: "",
      channel_index: -1,
      sampler_routing: [],
    });

    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "q" });

    const notes = await page.evaluate(
      () => window.__keyboardModel._state.active_notes,
    );
    expect(notes).toContain(48);

    // Release — no crash
    await kb.dispatchEvent("keyup", { key: "q" });
    const notesAfter = await page.evaluate(
      () => window.__keyboardModel._state.active_notes,
    );
    expect(notesAfter).toEqual([]);
  });
});

test.describe("Integration: Render-Order Independence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // R2.1 — Sampler renders BEFORE mixer (bus doesn't exist yet)
  test("sampler before mixer: registers after bus-ready event", async ({
    page,
  }) => {
    // Render sampler first — bus doesn't exist yet
    await renderSampler(page);

    // Confirm sampler is NOT registered (bus doesn't exist)
    let registered = await page.evaluate(() => {
      const g = globalThis;
      return !!g.__nbplay?.["integ-test-session"]?.samplers?.[0];
    });
    expect(registered).toBe(false);

    // Now render mixer — creates bus and fires nbplay-bus-ready
    await renderMixer(page);

    // Sampler should now be registered
    registered = await page.evaluate(() => {
      const g = globalThis;
      const s = g.__nbplay?.["integ-test-session"]?.samplers?.[0];
      return typeof s?.triggerNote === "function";
    });
    expect(registered).toBe(true);
  });

  // R2.2 — Mixer renders BEFORE sampler (bus exists)
  test("mixer before sampler: sampler registers immediately", async ({
    page,
  }) => {
    await renderMixer(page);
    await renderSampler(page);

    const registered = await page.evaluate(() => {
      const g = globalThis;
      const s = g.__nbplay?.["integ-test-session"]?.samplers?.[0];
      return typeof s?.triggerNote === "function";
    });
    expect(registered).toBe(true);
  });

  // R2.3 — Full pipeline: sampler → mixer → keyboard, all connected
  test("sampler-first render order: keyboard can still trigger sampler", async ({
    page,
  }) => {
    // Render in worst-case order: sampler, then keyboard, then mixer
    await renderSampler(page);
    await renderKeyboard(page);
    await renderMixer(page);

    // Spy on triggerNote
    await page.evaluate(() => {
      const bus = globalThis.__nbplay["integ-test-session"];
      bus._triggerCalls = [];
      const origTrigger = bus.samplers[0].triggerNote;
      bus.samplers[0].triggerNote = (note, vel) => {
        bus._triggerCalls.push({ note, vel });
        origTrigger(note, vel);
      };
    });

    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "q" });

    const calls = await page.evaluate(
      () => globalThis.__nbplay["integ-test-session"]._triggerCalls,
    );
    expect(calls.length).toBe(1);
    expect(calls[0].note).toBe(48);
  });
});

test.describe("Integration: Keyboard + Sequencer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // R1.4 — Keyboard-connected sequencer shows REC button
  test("sequencer shows REC button when keyboard_connected=true", async ({
    page,
  }) => {
    await renderSequencer(page, { keyboard_connected: true });
    await expect(page.locator(".nbplay-seq-rec")).toBeVisible();
  });

  test("sequencer hides REC button when keyboard_connected=false", async ({
    page,
  }) => {
    await renderSequencer(page, { keyboard_connected: false });
    await expect(page.locator(".nbplay-seq-rec")).not.toBeVisible();
  });
});

test.describe("Integration: Multiple Samplers (Split Keyboard)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // Two samplers on different channels, keyboard routes upper/lower
  test("split keyboard routes upper and lower to different samplers", async ({
    page,
  }) => {
    // Mixer with 2 channels
    await renderMixer(page, {
      channels: [
        { name: "Hi", gain: 1.0, pan: 0, mute: false, solo: false },
        { name: "Lo", gain: 1.0, pan: 0, mute: false, solo: false },
      ],
    });

    // Sampler 0 (upper)
    await renderSampler(page, { channel_index: 0 });

    // Sampler 1 (lower) — render a second sampler
    await page.evaluate(
      async (opts) => {
        const mod = await import("/dist/widgets/sampler.js");
        const el = document.createElement("div");
        document.getElementById("root").appendChild(el);
        const model = window.createMockModel({ ...opts });
        window.__sampler2Model = model;
        mod.default.render({ model, el });
      },
      { ...SAMPLER_DEFAULTS, channel_index: 1 },
    );

    // Keyboard with upper→channel 0, lower→channel 1
    await renderKeyboard(page, {
      sampler_routing: [
        { channel_index: 0, match: "zone", zone: "upper" },
        { channel_index: 1, match: "zone", zone: "lower" },
      ],
    });

    // Spy on both samplers
    await page.evaluate(() => {
      const bus = globalThis.__nbplay["integ-test-session"];
      bus._trigger0 = [];
      bus._trigger1 = [];
      const orig0 = bus.samplers[0].triggerNote;
      const orig1 = bus.samplers[1].triggerNote;
      bus.samplers[0].triggerNote = (note, vel) => {
        bus._trigger0.push({ note, vel });
        orig0(note, vel);
      };
      bus.samplers[1].triggerNote = (note, vel) => {
        bus._trigger1.push({ note, vel });
        orig1(note, vel);
      };
    });

    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();

    // Q is upper zone → should go to sampler 0
    await kb.dispatchEvent("keydown", { key: "q" });
    await kb.dispatchEvent("keyup", { key: "q" });

    // Z is lower zone → should go to sampler 1
    await kb.dispatchEvent("keydown", { key: "z" });
    await kb.dispatchEvent("keyup", { key: "z" });

    const t0 = await page.evaluate(
      () => globalThis.__nbplay["integ-test-session"]._trigger0,
    );
    const t1 = await page.evaluate(
      () => globalThis.__nbplay["integ-test-session"]._trigger1,
    );

    expect(t0.length).toBe(1);
    expect(t0[0].note).toBe(48); // Q = C3 (upper octave 3)
    expect(t1.length).toBe(1);
    expect(t1[0].note).toBe(60); // Z = C4 (lower octave 4)
  });
});
