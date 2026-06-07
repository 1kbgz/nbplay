import { test, expect } from "@playwright/test";

// Shared defaults & setup

const DEFAULTS = {
  upper_octave: 3,
  lower_octave: 4,
  velocity: 100,
  active_notes: [],
  sustain_upper: false,
  sustain_lower: false,
  sustain_global: false,
  last_note_event: {},
  session_id: "",
  channel_index: -1,
  sampler_routing: [],
};

async function renderWidget(page, overrides = {}) {
  await page.evaluate(
    async (opts) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/dist/css/keyboard.css";
      document.head.appendChild(link);

      const mod = await import("/dist/widgets/keyboard.js");
      const el = document.getElementById("root");
      const model = window.createMockModel({ ...opts });
      window.__testModel = model;
      mod.default.render({ model, el });
    },
    { ...DEFAULTS, ...overrides },
  );
}

// Tests

test.describe("KeyboardWidget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/harness.html");
  });

  // 1. Renders container
  test("renders .nbplay-keyboard container", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-keyboard")).toBeVisible();
  });

  // 2. Shows header
  test("shows header text and keyboard badge", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-kb-header h3")).toHaveText("nbplay");
    await expect(page.locator(".nbplay-badge")).toHaveText("keyboard");
  });

  // 3. Renders four keyboard rows
  test("renders upper and lower keyboard sections", async ({ page }) => {
    await renderWidget(page);
    await expect(page.locator(".nbplay-kb-upper")).toBeVisible();
    await expect(page.locator(".nbplay-kb-lower")).toBeVisible();
    // Each section has sharp row + natural row
    const rows = page.locator(".nbplay-kb-row");
    await expect(rows).toHaveCount(4);
  });

  // 4. Info bar displays octave and velocity
  test("displays octave and velocity info", async ({ page }) => {
    await renderWidget(page, {
      upper_octave: 5,
      lower_octave: 6,
      velocity: 80,
    });
    await expect(page.locator(".nbplay-kb-oct-upper")).toHaveText("Oct 5");
    await expect(page.locator(".nbplay-kb-oct-lower")).toHaveText("Oct 6");
    await expect(page.locator(".nbplay-kb-vel")).toHaveText("Vel: 80");
  });

  // 5. Has white and black keys
  test("renders white and black keys", async ({ page }) => {
    await renderWidget(page);
    const whiteKeys = page.locator(".nbplay-kb-white");
    const blackKeys = page.locator(".nbplay-kb-black");
    // Upper: 10 white + 7 black, Lower: 9 white + 7 black
    expect(await whiteKeys.count()).toBeGreaterThanOrEqual(10);
    expect(await blackKeys.count()).toBeGreaterThanOrEqual(7);
  });

  test("note state updates without Web Audio", async ({ page }) => {
    await page.evaluate(() => {
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
    });
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "q" });

    const state = await page.evaluate(() => ({
      activeNotes: window.__testModel._state.active_notes,
      lastEvent: window.__testModel._state.last_note_event,
    }));
    expect(state.activeNotes).toEqual([48]);
    expect(state.lastEvent).toEqual({ note: 48, velocity: 100, type: "on" });
  });

  // 6. Key press emits note event
  test("keydown on Q produces note event", async ({ page }) => {
    await renderWidget(page);
    await page.locator(".nbplay-keyboard").focus();
    await page
      .locator(".nbplay-keyboard")
      .dispatchEvent("keydown", { key: "q" });
    const noteEvent = await page.evaluate(
      () => window.__testModel._state.last_note_event,
    );
    expect(noteEvent.type).toBe("on");
    // Q with upper_octave=3: C3 = (3+1)*12 + 0 = 48
    expect(noteEvent.note).toBe(48);
    expect(noteEvent.velocity).toBe(100);
  });

  // 7. Key up emits note off
  test("keyup produces note off event", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    // Press and release
    await kb.dispatchEvent("keydown", { key: "q" });
    await kb.dispatchEvent("keyup", { key: "q" });
    const noteEvent = await page.evaluate(
      () => window.__testModel._state.last_note_event,
    );
    expect(noteEvent.type).toBe("off");
    expect(noteEvent.note).toBe(48);
  });

  // 8. Lower keyboard produces different octave
  test("Z key uses lower_octave", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "z" });
    const noteEvent = await page.evaluate(
      () => window.__testModel._state.last_note_event,
    );
    // Z with lower_octave=4: C4 = (4+1)*12 + 0 = 60
    expect(noteEvent.note).toBe(60);
  });

  // 9. Octave shift with [ and ]
  test("[ and ] shift upper octave", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "]" });
    await kb.dispatchEvent("keyup", { key: "]" });
    const octave = await page.evaluate(
      () => window.__testModel._state.upper_octave,
    );
    expect(octave).toBe(4);
  });

  // 10. Velocity change with - and =
  test("= increases velocity", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "=" });
    await kb.dispatchEvent("keyup", { key: "=" });
    const vel = await page.evaluate(() => window.__testModel._state.velocity);
    expect(vel).toBe(101);
  });

  // 11. Sustain indicators
  test("backtick activates upper sustain", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "`" });
    const susUpper = await page.evaluate(
      () => window.__testModel._state.sustain_upper,
    );
    expect(susUpper).toBe(true);
    await expect(page.locator(".nbplay-kb-sustain-upper")).toHaveClass(
      /active/,
    );
  });

  // 12. Space activates global sustain
  test("space activates global sustain", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: " " });
    const susGlobal = await page.evaluate(
      () => window.__testModel._state.sustain_global,
    );
    expect(susGlobal).toBe(true);
  });

  // 13. Focus capture
  test("widget is focusable", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    expect(await kb.getAttribute("tabindex")).toBe("0");
  });

  // 14. Active notes list
  test("active_notes updates on key press", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "q" });
    const notes = await page.evaluate(
      () => window.__testModel._state.active_notes,
    );
    expect(notes).toContain(48);
  });

  // 15. Black keys render sharp notes
  test("number key 2 maps to C#", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "2" });
    const noteEvent = await page.evaluate(
      () => window.__testModel._state.last_note_event,
    );
    // 2 with upper_octave=3: C#3 = (3+1)*12 + 1 = 49
    expect(noteEvent.note).toBe(49);
  });

  // 16. Pointer click on a key
  test("clicking a key plays a note", async ({ page }) => {
    await renderWidget(page);
    // Click the first white key in upper natural row
    const firstKey = page
      .locator('[data-zone="upper-natural"] .nbplay-kb-key')
      .first();
    await firstKey.dispatchEvent("pointerdown");
    const noteEvent = await page.evaluate(
      () => window.__testModel._state.last_note_event,
    );
    expect(noteEvent.type).toBe("on");
  });

  test("releasing pointer outside a clicked key stops the note", async ({
    page,
  }) => {
    await renderWidget(page);
    const firstKey = page
      .locator('[data-zone="upper-natural"] .nbplay-kb-key')
      .first();
    const box = await firstKey.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();

    let notes = await page.evaluate(
      () => window.__testModel._state.active_notes,
    );
    expect(notes).toContain(48);

    await page.mouse.move(box.x + box.width + 100, box.y + box.height + 100);
    await page.mouse.up();

    notes = await page.evaluate(() => window.__testModel._state.active_notes);
    const noteEvent = await page.evaluate(
      () => window.__testModel._state.last_note_event,
    );
    expect(notes).toEqual([]);
    expect(noteEvent).toMatchObject({ note: 48, type: "off" });
  });

  // 17. Model change updates display
  test("model velocity change updates info", async ({ page }) => {
    await renderWidget(page);
    await page.evaluate(() => {
      window.__testModel.set("velocity", 50);
      window.__testModel._trigger("change:velocity");
    });
    await expect(page.locator(".nbplay-kb-vel")).toHaveText("Vel: 50");
  });

  // 18. Note dispatches CustomEvent on document
  test("keypress dispatches nbplay-note CustomEvent", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();

    // Set up listener before playing note
    const received = await page.evaluate(async () => {
      return new Promise((resolve) => {
        document.addEventListener("nbplay-note", (e) => resolve(e.detail), {
          once: true,
        });
        // Dispatch keydown on document (where keyboard now listens)
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "q", bubbles: true }),
        );
      });
    });
    expect(received.type).toBe("on");
    expect(received.note).toBe(48); // C3 at default octave 3
  });

  // 19. Blur releases held notes
  test("blur releases all held notes", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();

    // Press a note key
    await kb.dispatchEvent("keydown", { key: "q" });
    let notes = await page.evaluate(
      () => window.__testModel._state.active_notes,
    );
    expect(notes).toContain(48);

    // Blur the widget — should release all notes
    await kb.evaluate((el) => el.blur());
    notes = await page.evaluate(() => window.__testModel._state.active_notes);
    expect(notes).toEqual([]);
  });

  // 20. Unhandled keys are not blocked (preventDefault not called)
  test("unhandled keys are not preventDefault-ed", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();

    const prevented = await page.evaluate(() => {
      const kb = document.querySelector(".nbplay-keyboard");
      return new Promise((resolve) => {
        kb.addEventListener("keydown", (e) => resolve(e.defaultPrevented), {
          once: true,
        });
        kb.dispatchEvent(
          new KeyboardEvent("keydown", { key: "4", bubbles: true }),
        );
      });
    });
    expect(prevented).toBe(false);
  });

  // 21. Handled note keys ARE preventDefault-ed
  test("handled note key is preventDefault-ed", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();

    const prevented = await page.evaluate(() => {
      const kb = document.querySelector(".nbplay-keyboard");
      const event = new KeyboardEvent("keydown", {
        key: "q",
        bubbles: true,
        cancelable: true,
      });
      kb.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);
  });

  // 22. Arrow keys pass through when keyboard is focused
  test("arrow keys pass through without preventDefault", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();

    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      const prevented = await page.evaluate((k) => {
        const kb = document.querySelector(".nbplay-keyboard");
        const event = new KeyboardEvent("keydown", {
          key: k,
          bubbles: true,
          cancelable: true,
        });
        kb.dispatchEvent(event);
        return event.defaultPrevented;
      }, key);
      expect(prevented).toBe(false);
    }
  });

  // 23. Tab key passes through
  test("Tab key passes through without preventDefault", async ({ page }) => {
    await renderWidget(page);
    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();

    const prevented = await page.evaluate(() => {
      const kb = document.querySelector(".nbplay-keyboard");
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      });
      kb.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(false);
  });

  // 24. Keys do nothing when keyboard is not focused
  test("keys do nothing when keyboard is not focused", async ({ page }) => {
    await renderWidget(page);

    // Don't focus the keyboard — blur it
    await page.evaluate(() => {
      document.querySelector(".nbplay-keyboard").blur();
      document.body.focus();
    });

    // Press a note key on the body
    await page.evaluate(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "q", bubbles: true }),
      );
    });

    const notes = await page.evaluate(
      () => window.__testModel._state.active_notes,
    );
    expect(notes).toEqual([]);
  });

  // 25. Routing via sampler_routing trait triggers correct sampler
  test("sampler_routing triggers registered sampler", async ({ page }) => {
    await page.evaluate(async () => {
      // Create mock session bus with a sampler
      const mockSampler = {
        triggeredNotes: [],
        triggerNote(note, velocity) {
          this.triggeredNotes.push({ note, velocity });
        },
        releaseNote(note) {
          this.triggeredNotes.push({ note, velocity: 0 });
        },
      };
      globalThis.__nbplay = {
        "test-session": {
          audioCtx: new (window.AudioContext || window.webkitAudioContext)(),
          channels: [{ gain: { connect() {} } }],
          samplers: { 0: mockSampler },
        },
      };
      window.__mockSampler = mockSampler;
    });

    await renderWidget(page, {
      session_id: "test-session",
      sampler_routing: [{ channel_index: 0, match: "all" }],
    });

    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "q" });

    const triggered = await page.evaluate(
      () => window.__mockSampler.triggeredNotes,
    );
    expect(triggered.length).toBeGreaterThanOrEqual(1);
    expect(triggered[0].note).toBe(48);
    expect(triggered[0].velocity).toBe(100);
  });

  // 27. Routing: match "zone" upper matches upper keys only
  test('match "zone" upper routes only upper keys', async ({ page }) => {
    await page.evaluate(async () => {
      const mockSampler = {
        triggeredNotes: [],
        triggerNote(n, v) {
          this.triggeredNotes.push({ note: n, velocity: v });
        },
        releaseNote(n) {
          this.triggeredNotes.push({ note: n, velocity: 0 });
        },
      };
      globalThis.__nbplay = {
        "test-session": {
          audioCtx: new AudioContext(),
          channels: [{ gain: { connect() {} } }],
          samplers: { 0: mockSampler },
        },
      };
      window.__mockSampler = mockSampler;
    });

    await renderWidget(page, {
      session_id: "test-session",
      sampler_routing: [{ channel_index: 0, match: "zone", zone: "upper" }],
    });

    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();

    // Upper key Q → C3 = 48 → should trigger
    await kb.dispatchEvent("keydown", { key: "q" });
    let triggered = await page.evaluate(
      () => window.__mockSampler.triggeredNotes,
    );
    expect(triggered.length).toBeGreaterThanOrEqual(1);

    // Reset
    await page.evaluate(() => {
      window.__mockSampler.triggeredNotes = [];
    });

    // Lower key Z → C4 = 60 → should NOT trigger (zone="upper")
    await kb.dispatchEvent("keydown", { key: "z" });
    triggered = await page.evaluate(() => window.__mockSampler.triggeredNotes);
    // Z is lower zone but zone filter is "upper"
    expect(triggered.length).toBe(0);
  });

  // 28. Routing: match "octave" matches correct octave
  test('match "octave" routes matching octave notes', async ({ page }) => {
    await page.evaluate(async () => {
      const mockSampler = {
        triggeredNotes: [],
        triggerNote(n, v) {
          this.triggeredNotes.push({ note: n, velocity: v });
        },
        releaseNote() {},
      };
      globalThis.__nbplay = {
        "test-session": {
          audioCtx: new AudioContext(),
          channels: [{ gain: { connect() {} } }],
          samplers: { 0: mockSampler },
        },
      };
      window.__mockSampler = mockSampler;
    });

    // Octave 4 = MIDI 60-71
    await renderWidget(page, {
      session_id: "test-session",
      sampler_routing: [{ channel_index: 0, match: "octave", octave: 4 }],
    });

    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();

    // Lower key Z → C4 = 60 → octave 4 → should trigger
    await kb.dispatchEvent("keydown", { key: "z" });
    let triggered = await page.evaluate(
      () => window.__mockSampler.triggeredNotes,
    );
    expect(triggered.length).toBeGreaterThanOrEqual(1);
    expect(triggered[0].note).toBe(60);

    // Reset
    await page.evaluate(() => {
      window.__mockSampler.triggeredNotes = [];
    });

    // Upper key Q → C3 = 48 → octave 3 → should NOT trigger
    await kb.dispatchEvent("keydown", { key: "q" });
    triggered = await page.evaluate(() => window.__mockSampler.triggeredNotes);
    expect(triggered.length).toBe(0);
  });

  // 29. Routing: match "note" matches exact note
  test('match "note" routes exact MIDI note', async ({ page }) => {
    await page.evaluate(async () => {
      const mockSampler = {
        triggeredNotes: [],
        triggerNote(n, v) {
          this.triggeredNotes.push({ note: n, velocity: v });
        },
        releaseNote() {},
      };
      globalThis.__nbplay = {
        "test-session": {
          audioCtx: new AudioContext(),
          channels: [{ gain: { connect() {} } }],
          samplers: { 0: mockSampler },
        },
      };
      window.__mockSampler = mockSampler;
    });

    // Only match MIDI 60 (C4 = Z key)
    await renderWidget(page, {
      session_id: "test-session",
      sampler_routing: [{ channel_index: 0, match: "note", note: 60 }],
    });

    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();

    // Z key → 60 → should trigger
    await kb.dispatchEvent("keydown", { key: "z" });
    let triggered = await page.evaluate(
      () => window.__mockSampler.triggeredNotes,
    );
    expect(triggered.length).toBeGreaterThanOrEqual(1);

    // Reset
    await page.evaluate(() => {
      window.__mockSampler.triggeredNotes = [];
    });

    // X key → 62 → should NOT trigger
    await kb.dispatchEvent("keydown", { key: "x" });
    triggered = await page.evaluate(() => window.__mockSampler.triggeredNotes);
    expect(triggered.length).toBe(0);
  });

  // 30. Routing: match "notes" matches listed notes
  test('match "notes" routes listed MIDI notes', async ({ page }) => {
    await page.evaluate(async () => {
      const mockSampler = {
        triggeredNotes: [],
        triggerNote(n, v) {
          this.triggeredNotes.push({ note: n, velocity: v });
        },
        releaseNote() {},
      };
      globalThis.__nbplay = {
        "test-session": {
          audioCtx: new AudioContext(),
          channels: [{ gain: { connect() {} } }],
          samplers: { 0: mockSampler },
        },
      };
      window.__mockSampler = mockSampler;
    });

    // Match Z(60) and C(64)
    await renderWidget(page, {
      session_id: "test-session",
      sampler_routing: [{ channel_index: 0, match: "notes", notes: [60, 64] }],
    });

    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();

    // Z key → 60 → should trigger
    await kb.dispatchEvent("keydown", { key: "z" });
    let triggered = await page.evaluate(
      () => window.__mockSampler.triggeredNotes,
    );
    expect(triggered.length).toBeGreaterThanOrEqual(1);

    // Reset
    await page.evaluate(() => {
      window.__mockSampler.triggeredNotes = [];
    });

    // V key → 67 → should NOT trigger (not in [60, 64])
    await kb.dispatchEvent("keydown", { key: "v" });
    triggered = await page.evaluate(() => window.__mockSampler.triggeredNotes);
    expect(triggered.length).toBe(0);
  });

  // 31. Layered: multiple routes all fire for same note
  test("layered routing triggers multiple samplers", async ({ page }) => {
    await page.evaluate(async () => {
      const s0 = {
        triggeredNotes: [],
        triggerNote(n, v) {
          this.triggeredNotes.push({ sampler: 0, note: n, velocity: v });
        },
        releaseNote() {},
      };
      const s1 = {
        triggeredNotes: [],
        triggerNote(n, v) {
          this.triggeredNotes.push({ sampler: 1, note: n, velocity: v });
        },
        releaseNote() {},
      };
      globalThis.__nbplay = {
        "test-session": {
          audioCtx: new AudioContext(),
          channels: [{ gain: { connect() {} } }, { gain: { connect() {} } }],
          samplers: { 0: s0, 1: s1 },
        },
      };
      window.__mockSampler0 = s0;
      window.__mockSampler1 = s1;
    });

    await renderWidget(page, {
      session_id: "test-session",
      sampler_routing: [
        { channel_index: 0, match: "all" },
        { channel_index: 1, match: "all" },
      ],
    });

    const kb = page.locator(".nbplay-keyboard");
    await kb.focus();
    await kb.dispatchEvent("keydown", { key: "z" });

    const t0 = await page.evaluate(() => window.__mockSampler0.triggeredNotes);
    const t1 = await page.evaluate(() => window.__mockSampler1.triggeredNotes);
    expect(t0.length).toBeGreaterThanOrEqual(1);
    expect(t1.length).toBeGreaterThanOrEqual(1);
  });
});
