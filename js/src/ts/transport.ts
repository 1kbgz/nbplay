// nbplay TransportWidget – anywidget ESM frontend
// Global transport bar: play/stop, BPM, time signature, bar:beat
// position counter, and loop controls.

import { type AnyModel, makeEditable, onKernelDisconnect } from "./helpers.ts";

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
      <button class="nbplay-transport-stop" title="Stop">\u25A0</button>
      <button class="nbplay-transport-play" title="Play / Pause">\u25B6</button>
      <button class="nbplay-transport-record" title="Record">\u25CF</button>
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
      <button class="nbplay-transport-loop-btn" title="Toggle loop">\u21BB</button>
      <span class="nbplay-transport-loop-range">1 \u2013 4</span>
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

  function syncPlay(): void {
    const on = model.get("is_playing") as boolean;
    playBtn.textContent = on ? "\u23F8" : "\u25B6";
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

  function beatFromBars(): number {
    return (
      (model.get("bar_number") as number) *
        (model.get("time_signature_num") as number) +
      (model.get("beat_in_bar") as number)
    );
  }

  let internalPositionUpdate = false;

  function setPositionFromBeat(beat: number, writeCurrent = true): number {
    const bpb = Math.max(1, model.get("time_signature_num") as number);
    const bounded = Number.isFinite(beat) ? Math.max(0, beat) : 0;
    if (writeCurrent) {
      internalPositionUpdate = true;
      try {
        model.set("current_beat", bounded);
      } finally {
        internalPositionUpdate = false;
      }
    }
    model.set("bar_number", Math.floor(bounded / bpb));
    model.set("beat_in_bar", Math.floor(bounded % bpb));
    syncPosition();
    return bounded;
  }

  function syncLoop(): void {
    loopBtn.classList.toggle("active", model.get("loop_enabled") as boolean);
    loopRng.textContent =
      (model.get("loop_start_bar") as number) +
      1 +
      " \u2013 " +
      (model.get("loop_end_bar") as number);
  }

  // Play / Stop
  playBtn.addEventListener("click", () => {
    const next = !model.get("is_playing");
    if (!next) flushClock(false);
    model.set("is_playing", next);
    model.save_changes();
  });

  recordBtn.addEventListener("click", () => {
    const next = !model.get("is_recording");
    if (model.get("is_playing")) flushClock(false);
    model.set("is_recording", next);
    if (next) model.set("is_playing", true);
    model.save_changes();
  });

  stopBtn.addEventListener("click", () => {
    model.set("is_playing", false);
    model.set("is_recording", false);
    model.set("bar_number", 0);
    model.set("beat_in_bar", 0);
    model.set("current_beat", 0);
    model.save_changes();
  });

  // BPM slider
  bpmSl.addEventListener("input", () => {
    const v = parseFloat(bpmSl.value);
    bpmVal.textContent = Math.round(v) + " BPM";
    if (model.get("is_playing")) flushClock(false);
    model.set("bpm", v);
    model.save_changes();
  });

  // Loop toggle
  loopBtn.addEventListener("click", () => {
    model.set("loop_enabled", !model.get("loop_enabled"));
    model.save_changes();
  });

  // Double-click to edit BPM (uses shared makeEditable with committed guard)
  makeEditable(bpmVal, {
    className: "nbplay-transport-inline-edit",
    getValue: () => String(Math.round(model.get("bpm") as number)),
    parse: (raw: string) => {
      const v = parseInt(raw, 10);
      if (isNaN(v)) return null;
      return Math.max(30, Math.min(300, v));
    },
    apply: (v) => {
      model.set("bpm", v);
      model.save_changes();
    },
    sync: syncBpm,
  });

  // Model observers
  model.on("change:is_playing", syncPlay);
  model.on("change:is_recording", syncRecord);
  model.on("change:bpm", syncBpm);
  model.on("change:time_signature_num", syncTimeSig);
  model.on("change:time_signature_den", syncTimeSig);
  model.on("change:bar_number", syncPosition);
  model.on("change:beat_in_bar", syncPosition);
  model.on("change:current_beat", () => {
    const bounded = setPositionFromBeat(
      model.get("current_beat") as number,
      false,
    );
    if (!internalPositionUpdate && (model.get("is_playing") as boolean)) {
      resetClockOrigin(bounded);
    }
  });
  model.on("change:loop_enabled", syncLoop);
  model.on("change:loop_start_bar", syncLoop);
  model.on("change:loop_end_bar", syncLoop);

  // Browser-side position clock
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  let clockStart = 0;
  let beatOrigin = 0;
  let lastSyncedBeat = 0;
  let lastSyncMs = 0;
  const coarseSyncMs = 250;

  function resetClockOrigin(beat: number): void {
    clockStart = performance.now();
    beatOrigin = beat;
    lastSyncedBeat = beat;
    lastSyncMs = clockStart;
  }

  function startClock(): void {
    stopClock();
    const currentBeat = Number(model.get("current_beat"));
    resetClockOrigin(
      Number.isFinite(currentBeat) ? currentBeat : beatFromBars(),
    );
    clockTimer = setInterval(tickClock, 50);
  }

  function stopClock(): void {
    if (clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  }

  function computeClockBeat(now: number): number {
    const elapsed = (now - clockStart) / 1000;
    let totalBeat = beatOrigin + (elapsed * (model.get("bpm") as number)) / 60;
    const bpb = Math.max(1, model.get("time_signature_num") as number);

    if (model.get("loop_enabled") as boolean) {
      const ls = model.get("loop_start_bar") as number;
      const le = model.get("loop_end_bar") as number;
      if (le > ls && totalBeat >= le * bpb) {
        const loopBeats = (le - ls) * bpb;
        const adj = (totalBeat - ls * bpb) % loopBeats;
        totalBeat = ls * bpb + adj;
      }
    }
    return totalBeat;
  }

  function flushClock(save = true): void {
    if (clockTimer === null) return;
    const now = performance.now();
    const beat = setPositionFromBeat(computeClockBeat(now));
    lastSyncedBeat = beat;
    lastSyncMs = now;
    if (save) model.save_changes();
  }

  function tickClock(): void {
    const now = performance.now();
    const totalBeat = setPositionFromBeat(computeClockBeat(now));
    const currentBucket = Math.floor(totalBeat);
    const syncedBucket = Math.floor(lastSyncedBeat);
    if (currentBucket !== syncedBucket && now - lastSyncMs >= coarseSyncMs) {
      lastSyncedBeat = totalBeat;
      lastSyncMs = now;
      model.save_changes();
    }
  }

  model.on("change:is_playing", () => {
    if (model.get("is_playing") as boolean) startClock();
    else stopClock();
  });

  model.on("change:bpm", () => {
    if (model.get("is_playing") as boolean) {
      stopClock();
      startClock();
    }
  });

  // Initial state
  // Force stopped state on render — prevents stale is_playing=true
  // from a saved notebook from starting the clock in an undefined state.
  // Only update local model state; do NOT call save_changes() here
  // because sending comm messages during render can race with other
  // widgets still being initialised (e.g. Session dlinks).
  model.set("is_playing", false);
  model.set("is_recording", false);
  model.set("bar_number", 0);
  model.set("beat_in_bar", 0);
  model.set("current_beat", 0);

  syncPlay();
  syncRecord();
  syncBpm();
  syncTimeSig();
  syncPosition();
  syncLoop();

  // Stop playback on kernel disconnect
  const cancelDisconnect = onKernelDisconnect(model, () => {
    model.set("is_playing", false);
    model.set("is_recording", false);
    model.set("bar_number", 0);
    model.set("beat_in_bar", 0);
    model.set("current_beat", 0);
    stopClock();
    syncPlay();
    syncRecord();
    syncPosition();
  });

  return () => {
    stopClock();
    cancelDisconnect();
  };
}

export default { render };
