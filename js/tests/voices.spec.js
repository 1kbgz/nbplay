import { test, expect } from "@playwright/test";

/**
 * Render one second of `play(mod, ctx, arg)` on an OfflineAudioContext and
 * return the peak level in each window of `[from, to]` seconds, plus what
 * `play` returned.
 */
async function render(page, play, windows, arg = null) {
  return page.evaluate(
    async ({ play, windows, arg }) => {
      const mod = await window.__components;
      const ctx = new OfflineAudioContext(1, 44100, 44100);
      const result = new Function(
        "mod",
        "ctx",
        "arg",
        `return (${play})(mod, ctx, arg);`,
      )(mod, ctx, arg);
      const data = (await ctx.startRendering()).getChannelData(0);
      const peaks = windows.map(([from, to]) => {
        let most = 0;
        for (let i = Math.round(from * 44100); i < to * 44100; i++)
          most = Math.max(most, Math.abs(data[i]));
        return most;
      });
      return { peaks, result };
    },
    { play: play.toString(), windows, arg },
  );
}

test.describe("voices", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("a synth note plays at the patch level scaled by velocity and ends with its duration", async ({
    page,
  }) => {
    const { peaks, result } = await render(
      page,
      (mod, ctx) => {
        const cancel = mod.scheduleSynthNote(
          ctx,
          ctx.destination,
          { type: "sine", amplitude: 0.5 },
          69,
          64,
          0.1,
          0.4,
        );
        return typeof cancel;
      },
      [
        [0, 0.09],
        [0.105, 0.11],
        [0.55, 1],
      ],
    );
    expect(result).toBe("function");
    expect(peaks[0]).toBe(0);
    expect(Math.abs(peaks[1] - 0.5 * (64 / 127))).toBeLessThan(0.01);
    expect(peaks[2]).toBe(0);
  });

  test("an FM note holds at sustain and is silent after its release", async ({
    page,
  }) => {
    const { peaks } = await render(
      page,
      (mod, ctx) => {
        mod.scheduleFmNote(
          ctx,
          ctx.destination,
          {
            amplitude: 0.8,
            ratio: 1,
            index: 1,
            attack: 0.01,
            decay: 0.05,
            sustain: 0.5,
            release: 0.1,
          },
          57,
          127,
          0,
          0.4,
        );
      },
      [
        [0.1, 0.4],
        [0.55, 1],
      ],
    );
    expect(Math.abs(peaks[0] - 0.4)).toBeLessThan(0.02);
    expect(peaks[1]).toBeLessThan(0.001);
  });

  test("a cancelled note makes no sound", async ({ page }) => {
    const { peaks } = await render(
      page,
      (mod, ctx) => {
        const patch = {
          amplitude: 1,
          ratio: 2,
          index: 1,
          attack: 0.01,
          decay: 0.1,
          sustain: 1,
          release: 0.1,
        };
        mod.scheduleFmNote(ctx, ctx.destination, patch, 60, 127, 0.2, 0.3)();
        mod.scheduleSynthNote(
          ctx,
          ctx.destination,
          { type: "saw", amplitude: 1 },
          60,
          127,
          0.2,
          0.3,
        )();
      },
      [[0, 1]],
    );
    expect(peaks[0]).toBe(0);
  });

  test("a sample voice plays its region through the envelope", async ({
    page,
  }) => {
    // A constant buffer shows the envelope directly: attack to 0.8 by
    // 0.11 s, decay to the 0.4 sustain by 0.16 s. The region is 0.5 s long,
    // so a held voice stops when the region ends.
    const play = (mod, ctx, duration) => {
      const buffer = ctx.createBuffer(1, 44100, 44100);
      buffer.getChannelData(0).fill(1);
      const voice = mod.startSampleVoice(ctx, ctx.destination, {
        buffer,
        playbackRate: 1,
        loop: false,
        region: { offset: 0.25, length: 0.5 },
        envelope: { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.1 },
        peak: 0.8,
        at: 0.1,
        duration: duration ?? undefined,
      });
      return voice.releaseTime;
    };
    const scheduled = await render(
      page,
      play,
      [
        [0, 0.09],
        [0.17, 0.18],
        [0.29, 0.3],
        [0.45, 1],
      ],
      0.2,
    );
    // Held at the sustain level until the release at 0.3 s.
    expect(scheduled.result).toBeCloseTo(0.3, 5);
    expect(scheduled.peaks[0]).toBe(0);
    expect(Math.abs(scheduled.peaks[1] - 0.4)).toBeLessThan(0.001);
    expect(Math.abs(scheduled.peaks[2] - 0.4)).toBeLessThan(0.001);
    expect(scheduled.peaks[3]).toBe(0);

    // Released during the decay, at 0.13 s (0.64): it fades from there.
    const early = await render(
      page,
      play,
      [
        [0.13, 1],
        [0.24, 1],
      ],
      0.03,
    );
    expect(Math.abs(early.peaks[0] - 0.64)).toBeLessThan(0.01);
    expect(early.peaks[1]).toBe(0);

    const held = await render(page, play, [
      [0.2, 0.55],
      [0.65, 1],
    ]);
    expect(held.result).toBeNull();
    expect(Math.abs(held.peaks[0] - 0.4)).toBeLessThan(0.01);
    expect(held.peaks[1]).toBe(0);
  });
});
