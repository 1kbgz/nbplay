// nbplay TransportWidget – anywidget ESM frontend
// Global transport bar: play/stop, BPM, time signature, bar:beat
// position counter, and loop controls.
//
// The transport owns the session clock (see session.ts). Buttons drive the
// clock directly; clock events are mirrored into the model so the kernel
// sees play state, tempo, loop range, and a coarse position. Model changes
// arriving from the kernel (Python callers, traitlets links) are forwarded
// to the clock, which every other widget in the session follows.

import { type AnyModel, makeEditable, onKernelDisconnect } from "./helpers.ts";
import { bindClock, type ClockEvent, type SessionClock } from "./session.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  el.innerHTML = `
  <div class="nbplay-transport">
    <div class="nbplay-transport-controls">
      <button class="nbplay-transport-stop" title="Stop">■</button>
      <button class="nbplay-transport-play" title="Play / Pause">▶</button>
      <button class="nbplay-transport-record" title="Record">●</button>
    </div>
    <div class="nbplay-transport-tempo">
      <label>BPM</label>
      <input type="range" class="nbplay-transport-bpm-slider"
             min="30" max="300" step="1">
      <span class="nbplay-transport-bpm-val">120</span>
    </div>
    <div class="nbplay-transport-timesig">
      <span class="nbplay-transport-timesig-val">4/4</span>
    </div>
    <div class="nbplay-transport-position">
      <span class="nbplay-transport-bar">001</span>
      <span class="nbplay-transport-sep">:</span>
      <span class="nbplay-transport-beat">1</span>
    </div>
    <div class="nbplay-transport-loop">
      <button class="nbplay-transport-loop-btn" title="Toggle loop">↻</button>
      <span class="nbplay-transport-loop-range">1 – 4</span>
    </div>
  </div>`;

  const playBtn = el.querySelector(
    ".nbplay-transport-play",
  ) as HTMLButtonElement;
  const stopBtn = el.querySelector(
    ".nbplay-transport-stop",
  ) as HTMLButtonElement;
  const recordBtn = el.querySelector(
    ".nbplay-transport-record",
  ) as HTMLButtonElement;
  const bpmSl = el.querySelector(
    ".nbplay-transport-bpm-slider",
  ) as HTMLInputElement;
  const bpmVal = el.querySelector(
    ".nbplay-transport-bpm-val",
  ) as HTMLSpanElement;
  const tsVal = el.querySelector(
    ".nbplay-transport-timesig-val",
  ) as HTMLSpanElement;
  const barDisp = el.querySelector(".nbplay-transport-bar") as HTMLSpanElement;
  const beatDisp = el.querySelector(
    ".nbplay-transport-beat",
  ) as HTMLSpanElement;
  const loopBtn = el.querySelector(
    ".nbplay-transport-loop-btn",
  ) as HTMLButtonElement;
  const loopRng = el.querySelector(
    ".nbplay-transport-loop-range",
  ) as HTMLSpanElement;

  // While `mirroring` is set, model writes originate from the clock and the
  // model observers below must not feed them back into the clock.
  let mirroring = false;
  let disconnected = false;

  function mirror(write: () => void, save = false): void {
    mirroring = true;
    try {
      write();
    } finally {
      mirroring = false;
    }
    if (save && !disconnected) model.save_changes();
  }

  function syncPlay(): void {
    const on = model.get("is_playing") as boolean;
    playBtn.textContent = on ? "⏸" : "▶";
    playBtn.classList.toggle("playing", on);
  }

  function syncRecord(): void {
    const on = Boolean(model.get("is_recording"));
    recordBtn.classList.toggle("recording", on);
  }

  function syncBpm(): void {
    const b = model.get("bpm") as number;
    bpmSl.value = String(b);
    bpmVal.textContent = Math.round(b) + " BPM";
  }

  function syncTimeSig(): void {
    tsVal.textContent =
      (model.get("time_signature_num") as number) +
      "/" +
      (model.get("time_signature_den") as number);
  }

  function syncPosition(): void {
    barDisp.textContent = String(
      (model.get("bar_number") as number) + 1,
    ).padStart(3, "0");
    beatDisp.textContent = String((model.get("beat_in_bar") as number) + 1);
  }

  function syncLoop(): void {
    loopBtn.classList.toggle("active", model.get("loop_enabled") as boolean);
    loopRng.textContent =
      (model.get("loop_start_bar") as number) +
      1 +
      " – " +
      (model.get("loop_end_bar") as number);
  }

  function beatsPerBar(): number {
    return Math.max(1, Number(model.get("time_signature_num")) || 4);
  }

  // Last position written by this widget, so an echo of our own write
  // (a delayed change event with a stale value) is not taken as a seek.
  let lastWrittenBeat = -1;

  /** Write a beat position into the model's position traits. */
  function writePosition(beat: number): void {
    const bpb = beatsPerBar();
    const bounded = Number.isFinite(beat) ? Math.max(0, beat) : 0;
    lastWrittenBeat = bounded;
    model.set("current_beat", bounded);
    model.set("bar_number", Math.floor(bounded / bpb));
    model.set("beat_in_bar", Math.floor(bounded % bpb));
    syncPosition();
  }

  // Model → clock

  function pushTempo(clock: SessionClock): void {
    clock.setTempo(Number(model.get("bpm")));
  }

  function pushLoop(clock: SessionClock): void {
    const bpb = beatsPerBar();
    clock.setBeatsPerBar(bpb);
    clock.setLoop(
      Boolean(model.get("loop_enabled")),
      (Number(model.get("loop_start_bar")) || 0) * bpb,
      (Number(model.get("loop_end_bar")) || 0) * bpb,
    );
  }

  // Clock → model

  function pullState(clock: SessionClock): void {
    mirror(() => {
      model.set("is_playing", clock.playing);
      model.set("is_recording", clock.recording);
      writePosition(clock.beat());
    });
    syncPlay();
    syncRecord();
  }

  // Position ticker: runs while the clock plays. Position traits are
  // updated locally on every tick; saves to the kernel are throttled to
  // beat boundaries at most every `coarseSyncMs`.
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let lastSyncedBeat = 0;
  let lastSyncMs = 0;
  const coarseSyncMs = 250;

  function tick(): void {
    const beat = clock().beat();
    mirror(() => writePosition(beat));
    const now = performance.now();
    if (
      Math.floor(beat) !== Math.floor(lastSyncedBeat) &&
      now - lastSyncMs >= coarseSyncMs
    ) {
      lastSyncedBeat = beat;
      lastSyncMs = now;
      if (!disconnected) model.save_changes();
    }
  }

  function startTicking(beat: number): void {
    stopTicking();
    lastSyncedBeat = beat;
    lastSyncMs = performance.now();
    tickTimer = setInterval(tick, 50);
  }

  function stopTicking(): void {
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function onClockEvent(event: ClockEvent): void {
    const clk = clock();
    switch (event.type) {
      case "play":
        mirror(() => {
          model.set("is_playing", true);
          writePosition(event.beat);
        }, true);
        syncPlay();
        startTicking(event.beat);
        break;
      case "stop":
        stopTicking();
        mirror(() => {
          model.set("is_playing", false);
          writePosition(event.beat);
        }, true);
        syncPlay();
        break;
      case "seek":
        lastSyncedBeat = event.beat;
        mirror(() => writePosition(event.beat), true);
        break;
      case "tempo":
        if (Number(model.get("bpm")) !== clk.bpm) {
          mirror(() => model.set("bpm", clk.bpm), true);
        }
        syncBpm();
        break;
      case "record":
        if (Boolean(model.get("is_recording")) !== clk.recording) {
          mirror(() => model.set("is_recording", clk.recording), true);
        }
        syncRecord();
        break;
      case "loop": {
        const bpb = beatsPerBar();
        const loop = clk.loop;
        const startBar = Math.round(loop.startBeat / bpb);
        const endBar = Math.round(loop.endBeat / bpb);
        if (
          Boolean(model.get("loop_enabled")) !== loop.enabled ||
          Number(model.get("loop_start_bar")) !== startBar ||
          Number(model.get("loop_end_bar")) !== endBar
        ) {
          mirror(() => {
            model.set("loop_enabled", loop.enabled);
            model.set("loop_start_bar", startBar);
            model.set("loop_end_bar", endBar);
          }, true);
        }
        syncLoop();
        break;
      }
      case "timesig":
        break;
    }
  }

  function onRebind(clk: SessionClock): void {
    stopTicking();
    pushTempo(clk);
    pushLoop(clk);
    pullState(clk);
    if (clk.playing) startTicking(clk.beat());
  }

  const binding = bindClock(model, onClockEvent, onRebind);
  const clock = (): SessionClock => binding.clock();

  // Buttons

  playBtn.addEventListener("click", () => {
    const clk = clock();
    if (clk.playing) clk.stop();
    else clk.play();
  });

  recordBtn.addEventListener("click", () => {
    const clk = clock();
    const next = !clk.recording;
    clk.setRecording(next);
    if (next) clk.play();
  });

  stopBtn.addEventListener("click", () => {
    const clk = clock();
    clk.stop();
    clk.setRecording(false);
    clk.seek(0);
  });

  bpmSl.addEventListener("input", () => {
    const v = parseFloat(bpmSl.value);
    bpmVal.textContent = Math.round(v) + " BPM";
    clock().setTempo(v);
  });

  loopBtn.addEventListener("click", () => {
    model.set("loop_enabled", !model.get("loop_enabled"));
    model.save_changes();
    pushLoop(clock());
  });

  makeEditable(bpmVal, {
    className: "nbplay-transport-inline-edit",
    getValue: () => String(Math.round(model.get("bpm") as number)),
    parse: (raw: string) => {
      const v = parseInt(raw, 10);
      if (isNaN(v)) return null;
      return Math.max(30, Math.min(300, v));
    },
    apply: (v) => {
      clock().setTempo(v as number);
    },
    sync: syncBpm,
  });

  // Model observers (kernel-driven changes)

  model.on("change:is_playing", () => {
    syncPlay();
    if (mirroring) return;
    const clk = clock();
    const want = Boolean(model.get("is_playing"));
    if (want && !clk.playing) clk.play();
    else if (!want && clk.playing) clk.stop();
  });
  model.on("change:is_recording", () => {
    syncRecord();
    if (mirroring) return;
    clock().setRecording(Boolean(model.get("is_recording")));
  });
  model.on("change:bpm", () => {
    syncBpm();
    if (mirroring) return;
    pushTempo(clock());
  });
  model.on("change:time_signature_num", () => {
    syncTimeSig();
    pushLoop(clock());
  });
  model.on("change:time_signature_den", syncTimeSig);
  model.on("change:bar_number", syncPosition);
  model.on("change:beat_in_bar", syncPosition);
  model.on("change:current_beat", () => {
    if (mirroring) return;
    const clk = clock();
    const beat = Number(model.get("current_beat"));
    if (!Number.isFinite(beat) || beat === lastWrittenBeat) return;
    if (Math.abs(beat - clk.beat()) > 1e-6) clk.seek(beat);
  });
  for (const trait of ["loop_enabled", "loop_start_bar", "loop_end_bar"]) {
    model.on(`change:${trait}`, () => {
      syncLoop();
      if (mirroring) return;
      pushLoop(clock());
    });
  }

  // Initial state: tempo, time signature, and loop come from the kernel;
  // play state and position come from the browser clock, which is fresh
  // browser state and never stale from a saved notebook. Only local model
  // state is updated here; do NOT call save_changes() during render
  // because sending comm messages at that point can race with other
  // widgets still being initialised (e.g. Session links).
  {
    const clk = clock();
    pushTempo(clk);
    pushLoop(clk);
    pullState(clk);
    if (clk.playing) startTicking(clk.beat());
  }

  syncBpm();
  syncTimeSig();
  syncPosition();
  syncLoop();

  // Stop playback on kernel disconnect
  const cancelDisconnect = onKernelDisconnect(model, () => {
    disconnected = true;
    const clk = clock();
    clk.stop();
    clk.setRecording(false);
    clk.seek(0);
    stopTicking();
    pullState(clk);
  });

  return () => {
    stopTicking();
    cancelDisconnect();
    binding.dispose();
  };
}

export default { render };
