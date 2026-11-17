import { test, expect } from "@playwright/test";

/**
 * Render one second of `play(mod, ctx, arg)` on an OfflineAudioContext and
 * return the peak level in each window of `[from, to]` seconds, the
 * strength of each tone `[hz, from, to]` over its window, and what `play`
 * returned.
 */
async function render(page, play, windows, arg = null, tones = []) {
  return page.evaluate(
    async ({ play, windows, arg, tones }) => {
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
      const strengths = tones.map(([hz, from, to]) => {
        let re = 0;
        let im = 0;
        for (let i = Math.round(from * 44100); i < to * 44100; i++) {
          const phase = (2 * Math.PI * hz * i) / 44100;
          re += data[i] * Math.cos(phase);
          im += data[i] * Math.sin(phase);
        }
        return Math.hypot(re, im) / ((to - from) * 44100);
      });
      return { peaks, strengths, result };
    },
    { play: play.toString(), windows, arg, tones },
  );
}

test.describe("voices", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/components.html");
  });

  test("a synth note with the default patch holds its level for its duration, then releases", async ({
    page,
  }) => {
    const { peaks, result } = await render(
      page,
      (mod, ctx) => {
        const cancel = mod.scheduleSynthNote(
          ctx,
          ctx.destination,
          { ...mod.SYNTH_DEFAULTS, amplitude: 0.5 },
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
        [0.48, 0.5],
        [0.6, 1],
      ],
    );
    expect(result).toBe("function");
    expect(peaks[0]).toBe(0);
    // Velocity 64 of 127 at amplitude 0.5, still there at the end of the note.
    expect(Math.abs(peaks[1] - 0.5 * (64 / 127))).toBeLessThan(0.01);
    expect(Math.abs(peaks[2] - 0.5 * (64 / 127))).toBeLessThan(0.01);
    expect(peaks[3]).toBe(0);
  });

  test("the second oscillator plays its interval and the filter takes out harmonics", async ({
    page,
  }) => {
    const play = (mod, ctx, patch) => {
      mod.scheduleSynthNote(
        ctx,
        ctx.destination,
        { ...mod.SYNTH_DEFAULTS, ...patch },
        57,
        127,
        0,
        0.9,
      );
    };
    // A fifth above A3 (220 Hz) is E4, 329.6 Hz; a saw's third harmonic is 660 Hz.
    const tones = [
      [220, 0.1, 0.8],
      [329.63, 0.1, 0.8],
      [660, 0.1, 0.8],
    ];
    const sine = await render(page, play, [], { amplitude: 0.5 }, tones);
    expect(sine.strengths[1]).toBeLessThan(0.002);
    const fifth = await render(
      page,
      play,
      [],
      { amplitude: 0.5, osc2Type: "sine", osc2Level: 1, osc2Semitones: 7 },
      tones,
    );
    expect(Math.abs(fifth.strengths[1] - fifth.strengths[0])).toBeLessThan(
      0.01,
    );

    const open = await render(
      page,
      play,
      [],
      { type: "saw", amplitude: 0.5 },
      tones,
    );
    const filtered = await render(
      page,
      play,
      [],
      { type: "saw", amplitude: 0.5, cutoff: 300 },
      tones,
    );
    // The open filter keeps the third harmonic at about a third of the
    // fundamental; a 300 Hz low pass takes most of it out.
    expect(open.strengths[2] / open.strengths[0]).toBeGreaterThan(0.25);
    expect(filtered.strengths[2] / filtered.strengths[0]).toBeLessThan(0.1);
  });

  test("the filter envelope opens the filter at the start of a note", async ({
    page,
  }) => {
    const { strengths } = await render(
      page,
      (mod, ctx) => {
        mod.scheduleSynthNote(
          ctx,
          ctx.destination,
          {
            ...mod.SYNTH_DEFAULTS,
            type: "saw",
            amplitude: 0.5,
            cutoff: 300,
            filterEnv: 4,
            filterAttack: 0,
            filterDecay: 0.3,
            filterSustain: 0,
          },
          57,
          127,
          0,
          0.9,
        );
      },
      [],
      null,
      [
        [660, 0.02, 0.1],
        [660, 0.5, 0.8],
      ],
    );
    expect(strengths[0]).toBeGreaterThan(strengths[1] * 4);
  });

  test("a slow attack ramps the level and an amplitude LFO swings it", async ({
    page,
  }) => {
    const play = (mod, ctx, patch) => {
      mod.scheduleSynthNote(
        ctx,
        ctx.destination,
        { ...mod.SYNTH_DEFAULTS, amplitude: 0.5, ...patch },
        69,
        127,
        0,
        0.9,
      );
    };
    const attack = await render(page, play, [[0.095, 0.1]], { attack: 0.2 });
    // Half way up a 0.2 s attack.
    expect(Math.abs(attack.peaks[0] - 0.25)).toBeLessThan(0.01);

    // Tremolo at full depth and 2 Hz starts at the middle of its swing, is
    // at the top at 0.625 s and at the bottom (silence) at 0.375 s.
    const tremolo = await render(
      page,
      play,
      [
        [0.37, 0.38],
        [0.62, 0.63],
      ],
      { lfoTarget: "amplitude", lfoRate: 2, lfoDepth: 1 },
    );
    expect(tremolo.peaks[0]).toBeLessThan(0.01);
    expect(Math.abs(tremolo.peaks[1] - 0.5)).toBeLessThan(0.01);

    // A pitch LFO at full depth and 1 Hz bends A4 two semitones up (494 Hz)
    // at a quarter cycle and two down (392 Hz) at three quarters.
    const vibrato = await render(
      page,
      play,
      [],
      { lfoTarget: "pitch", lfoRate: 1, lfoDepth: 1 },
      [
        [493.9, 0.2, 0.3],
        [392, 0.2, 0.3],
        [493.9, 0.7, 0.8],
        [392, 0.7, 0.8],
      ],
    );
    expect(vibrato.strengths[0]).toBeGreaterThan(vibrato.strengths[1] * 5);
    expect(vibrato.strengths[3]).toBeGreaterThan(vibrato.strengths[2] * 5);
  });

  test("a held synth voice follows an update and ends after its release", async ({
    page,
  }) => {
    const { peaks, strengths, result } = await render(
      page,
      (mod, ctx) => {
        const voice = mod.startSynthVoice(
          ctx,
          ctx.destination,
          mod.SYNTH_DEFAULTS,
          440,
          0.5,
          0,
        );
        let ended = 0;
        voice.onended = () => ended++;
        // An OfflineAudioContext's time stands still before rendering, so
        // the update applies from the start.
        voice.update({ ...mod.SYNTH_DEFAULTS, amplitude: 0.5 }, 880, 0.25);
        return voice.release(0.5);
      },
      [
        [0.1, 0.5],
        [0.6, 1],
      ],
      null,
      [
        [440, 0.1, 0.5],
        [880, 0.1, 0.5],
      ],
    );
    // The default amplitude release is 0.05 s.
    expect(result).toBeCloseTo(0.55, 5);
    expect(Math.abs(peaks[0] - 0.25)).toBeLessThan(0.01);
    expect(peaks[1]).toBe(0);
    expect(strengths[1]).toBeGreaterThan(strengths[0] * 10);
  });

  test("each drum sound is a hit that falls to silence by the end of its decay", async ({
    page,
  }) => {
    for (const sound of ["kick", "snare", "hat", "clap", "tom"]) {
      const { peaks, result } = await render(
        page,
        (mod, ctx, sound) => {
          const cancel = mod.scheduleDrumHit(
            ctx,
            ctx.destination,
            { sound, tune: 0, decay: 0.2, tone: 0.5 },
            127,
            0.1,
          );
          return typeof cancel;
        },
        [
          [0, 0.099],
          [0.1, 0.15],
          [0.32, 1],
        ],
        sound,
      );
      expect(result, sound).toBe("function");
      expect(peaks[0], sound).toBe(0);
      expect(peaks[1], sound).toBeGreaterThan(0.05);
      expect(peaks[2], sound).toBe(0);
    }
  });

  test("a drum hit's level follows velocity and its tune moves the pitch", async ({
    page,
  }) => {
    const kick = (mod, ctx, { velocity, tune }) => {
      mod.scheduleDrumHit(
        ctx,
        ctx.destination,
        { sound: "kick", tune, decay: 0.8, tone: 0 },
        velocity,
        0,
      );
    };
    // After the pitch drop (60 ms) the kick sits at 50 Hz, an octave up at 100 Hz.
    const tones = [
      [50, 0.1, 0.5],
      [100, 0.1, 0.5],
    ];
    const loud = await render(
      page,
      kick,
      [[0, 0.1]],
      { velocity: 127, tune: 0 },
      tones,
    );
    const soft = await render(
      page,
      kick,
      [[0, 0.1]],
      { velocity: 64, tune: 0 },
      tones,
    );
    expect(Math.abs(soft.peaks[0] / loud.peaks[0] - 64 / 127)).toBeLessThan(
      0.02,
    );
    expect(loud.strengths[0]).toBeGreaterThan(loud.strengths[1] * 4);
    const up = await render(page, kick, [], { velocity: 127, tune: 12 }, tones);
    expect(up.strengths[1]).toBeGreaterThan(up.strengths[0] * 4);
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

  test("held synth and FM notes sound until their release", async ({
    page,
  }) => {
    for (const start of ["startSynthNote", "startFmNote"]) {
      const { peaks } = await render(
        page,
        (mod, ctx, start) => {
          const patch =
            start === "startSynthNote"
              ? { ...mod.SYNTH_DEFAULTS, amplitude: 0.5, sustain: 1 }
              : {
                  amplitude: 0.5,
                  ratio: 1,
                  index: 0,
                  attack: 0.01,
                  decay: 0.05,
                  sustain: 1,
                  release: 0.05,
                };
          const held = mod[start](ctx, ctx.destination, patch, 69, 127, 0);
          held.release(0.5);
        },
        [
          [0.1, 0.5],
          [0.7, 1],
        ],
        start,
      );
      // Held at full level until 0.5 s, silent once the release is over.
      expect(Math.abs(peaks[0] - 0.5)).toBeLessThan(0.02);
      expect(peaks[1]).toBeLessThan(0.001);
    }
  });

  test("a metronome click is a short blip, louder when accented", async ({
    page,
  }) => {
    const { peaks } = await render(
      page,
      (mod, ctx) => {
        mod.scheduleClick(ctx, ctx.destination, 0.1, false);
        mod.scheduleClick(ctx, ctx.destination, 0.5, true);
      },
      [
        [0.1, 0.12],
        [0.2, 0.45],
        [0.5, 0.52],
        [0.6, 1],
      ],
    );
    expect(peaks[0]).toBeGreaterThan(0.1);
    expect(peaks[1]).toBeLessThan(0.001);
    expect(peaks[2]).toBeGreaterThan(peaks[0]);
    expect(peaks[3]).toBeLessThan(0.001);
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
          { ...mod.SYNTH_DEFAULTS, type: "saw", amplitude: 1 },
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
