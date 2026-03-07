// nbplay SequencerWidget – anywidget ESM frontend
// Step sequencer grid with Web Audio lookahead scheduler

import { type AnyModel, makeEditable } from "./helpers.ts";

interface StepData {
  active: boolean;
  note: number;
  velocity: number;
}

interface NbplayBus {
  audioCtx: AudioContext;
  channels: { gain: AudioNode }[];
}

const NOTE_NAMES: string[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[midi % 12] + octave;
}

function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

interface AudioScheduler {
  start(model: AnyModel): void;
  stop(): void;
  destroy(): void;
  scheduler(model: AnyModel): void;
  scheduleStep(model: AnyModel, audioTime: number): void;
  playOscillator(freq: number, velocity: number, startTime: number, duration: number): void;
  isPlaying(): boolean;
}

function createAudioScheduler(): AudioScheduler {
  let audioCtx: AudioContext | null = null;
  let outputNode: AudioNode | null = null;
  let ownAudioCtx: boolean = true;
  let schedulerTimer: ReturnType<typeof setInterval> | null = null;
  let nextScheduleTime: number = 0;
  const scheduleAheadTime: number = 0.1;
  const lookAheadTime: number = 0.025;
  let currentSchedulerStep: number = -1;

  return {
    start(model: AnyModel): void {
      const sid = model.get("session_id") as string;
      const idx = model.get("channel_index") as number;
      if (sid && idx >= 0) {
        const bus = (globalThis as Record<string, unknown>).__nbplay as Record<string, NbplayBus> | undefined;
        if (bus && bus[sid] && bus[sid].channels[idx]) {
          audioCtx = bus[sid].audioCtx;
          outputNode = bus[sid].channels[idx].gain;
          ownAudioCtx = false;
        }
      }
      if (!audioCtx) {
        audioCtx = new AudioContext();
        outputNode = null;
        ownAudioCtx = true;
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      if (!schedulerTimer) {
        // Reset step counter so the first scheduled step is step 0
        currentSchedulerStep = -1;
        nextScheduleTime = audioCtx.currentTime;
        schedulerTimer = setInterval(() => {
          this.scheduler(model);
        }, lookAheadTime * 1000);
      }
    },

    stop(): void {
      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
      currentSchedulerStep = -1;
    },

    destroy(): void {
      this.stop();
      if (ownAudioCtx && audioCtx && audioCtx.state !== "closed") {
        audioCtx.close();
      }
      audioCtx = null;
      outputNode = null;
      ownAudioCtx = true;
    },

    scheduler(model: AnyModel): void {
      if (!audioCtx) return;
      const currentTime = audioCtx.currentTime;
      while (nextScheduleTime < currentTime + scheduleAheadTime) {
        this.scheduleStep(model, nextScheduleTime);
        const bpm = (model.get("bpm") as number) || 120;
        const stepDuration = (model.get("step_duration") as number) || 0.25;
        const stepTimeInSeconds = stepDuration / (bpm / 60);
        nextScheduleTime += stepTimeInSeconds;
      }
    },

    scheduleStep(model: AnyModel, audioTime: number): void {
      if (!audioCtx) return;
      const steps = (model.get("steps") as StepData[]) || [];
      if (steps.length === 0) return;

      const bpm = (model.get("bpm") as number) || 120;
      const stepDuration = (model.get("step_duration") as number) || 0.25;
      const stepTimeInSeconds = stepDuration / (bpm / 60);

      // Advance the internal scheduler step counter
      const nextStepIndex = (currentSchedulerStep + 1) % steps.length;

      const loopEnabled = model.get("loop_enabled") as boolean;
      if (nextStepIndex === 0 && currentSchedulerStep >= 0 && !loopEnabled) {
        model.set("is_playing", false);
        model.save_changes();
        return;
      }

      currentSchedulerStep = nextStepIndex;
      // Update the model for visual highlighting — do NOT call
      // save_changes() here to avoid flooding the kernel with
      // messages on every step tick.
      model.set("current_step", nextStepIndex);

      const step = steps[nextStepIndex];
      if (step.active) {
        const freq = midiToHz(step.note);
        const velocity = (step.velocity || 100) / 127;
        this.playOscillator(freq, velocity, audioTime, stepTimeInSeconds);
      }
    },

    playOscillator(freq: number, velocity: number, startTime: number, duration: number): void {
      if (!audioCtx) return;
      const attackTime = 0.005;
      const releaseTime = Math.min(0.05, duration * 0.2);
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(velocity, startTime + attackTime);
        gain.gain.linearRampToValueAtTime(0, startTime + duration - releaseTime);
        osc.connect(gain);
        gain.connect(outputNode || audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      } catch (_) {
        // Ignore if timing is in the past
      }
    },

    isPlaying(): boolean {
      return schedulerTimer !== null;
    },
  };
}

function render({ model, el }: { model: AnyModel; el: HTMLElement }): (() => void) {
  const root = document.createElement("div");
  root.className = "nbplay-sequencer";
  root.innerHTML = `
    <div class="nbplay-seq-header">
      <h3>nbplay</h3>
      <span class="nbplay-badge">sequencer</span>
    </div>
    <div class="nbplay-seq-transport">
      <button class="nbplay-seq-btn nbplay-seq-play" title="Play/Stop">▶</button>
      <button class="nbplay-seq-btn nbplay-seq-stop" title="Stop">■</button>
      <div class="nbplay-seq-bpm-section">
        <label class="nbplay-seq-label">BPM</label>
        <input type="range" class="nbplay-seq-bpm-slider" min="30" max="300" step="1" />
        <span class="nbplay-seq-bpm-val"></span>
      </div>
      <div class="nbplay-seq-dur-section">
        <label class="nbplay-seq-label">Step</label>
        <select class="nbplay-seq-dur-select">
          <option value="1">1 beat</option>
          <option value="0.5">1/2 beat</option>
          <option value="0.25">1/4 beat</option>
          <option value="0.125">1/8 beat</option>
        </select>
      </div>
      <label class="nbplay-seq-loop-label">
        <input type="checkbox" class="nbplay-seq-loop-chk" /> Loop
      </label>
    </div>
    <div class="nbplay-seq-grid-wrap">
      <div class="nbplay-seq-grid"></div>
    </div>
    <div class="nbplay-seq-footer">
      <span class="nbplay-seq-info"></span>
    </div>
  `;
  el.appendChild(root);

  const playBtn = root.querySelector(".nbplay-seq-play")! as HTMLButtonElement;
  const stopBtn = root.querySelector(".nbplay-seq-stop")! as HTMLButtonElement;
  const bpmSlider = root.querySelector(".nbplay-seq-bpm-slider")! as HTMLInputElement;
  const bpmVal = root.querySelector(".nbplay-seq-bpm-val")! as HTMLSpanElement;
  const durSelect = root.querySelector(".nbplay-seq-dur-select")! as HTMLSelectElement;
  const loopChk = root.querySelector(".nbplay-seq-loop-chk")! as HTMLInputElement;
  const grid = root.querySelector(".nbplay-seq-grid")! as HTMLDivElement;
  const info = root.querySelector(".nbplay-seq-info")! as HTMLSpanElement;

  const audioScheduler = createAudioScheduler();

  function buildGrid(): void {
    grid.innerHTML = "";
    const steps = (model.get("steps") as StepData[]) || [];
    const currentStep = model.get("current_step") as number;

    const headerRow = document.createElement("div");
    headerRow.className = "nbplay-seq-row nbplay-seq-header-row";
    const cornerCell = document.createElement("div");
    cornerCell.className = "nbplay-seq-label-cell";
    cornerCell.textContent = "#";
    headerRow.appendChild(cornerCell);
    for (let i = 0; i < steps.length; i++) {
      const hcell = document.createElement("div");
      hcell.className = "nbplay-seq-header-cell";
      hcell.textContent = String(i + 1);
      if (i === currentStep) hcell.classList.add("active-col");
      headerRow.appendChild(hcell);
    }
    grid.appendChild(headerRow);

    const stepRow = document.createElement("div");
    stepRow.className = "nbplay-seq-row";
    const stepLabel = document.createElement("div");
    stepLabel.className = "nbplay-seq-label-cell";
    stepLabel.textContent = "ON";
    stepRow.appendChild(stepLabel);

    for (let i = 0; i < steps.length; i++) {
      const cell = document.createElement("div");
      cell.className = "nbplay-seq-cell";
      cell.dataset.step = String(i);
      if (steps[i].active) cell.classList.add("active");
      if (i === currentStep) cell.classList.add("current");
      cell.textContent = noteName(steps[i].note);
      cell.title = `Step ${i + 1}: ${noteName(steps[i].note)} vel=${steps[i].velocity}`;

      cell.addEventListener("click", () => {
        const s = [...((model.get("steps") as StepData[]) || [])];
        if (i < s.length) {
          s[i] = { ...s[i], active: !s[i].active };
          model.set("steps", s);
          model.save_changes();
        }
      });

      cell.addEventListener("wheel", (e: WheelEvent) => {
        e.preventDefault();
        const s = [...((model.get("steps") as StepData[]) || [])];
        if (i < s.length) {
          const delta = e.deltaY < 0 ? 1 : -1;
          const newNote = Math.max(0, Math.min(127, s[i].note + delta));
          s[i] = { ...s[i], note: newNote };
          model.set("steps", s);
          model.save_changes();
        }
      });

      stepRow.appendChild(cell);
    }
    grid.appendChild(stepRow);

    const velRow = document.createElement("div");
    velRow.className = "nbplay-seq-row nbplay-seq-vel-row";
    const velLabel = document.createElement("div");
    velLabel.className = "nbplay-seq-label-cell";
    velLabel.textContent = "VEL";
    velRow.appendChild(velLabel);

    for (let i = 0; i < steps.length; i++) {
      const velCell = document.createElement("div");
      velCell.className = "nbplay-seq-vel-cell";
      const velBar = document.createElement("div");
      velBar.className = "nbplay-seq-vel-bar";
      velBar.style.height = (steps[i].velocity / 127 * 100) + "%";
      if (steps[i].active) velBar.classList.add("active");
      if (i === currentStep) velBar.classList.add("current");
      velCell.appendChild(velBar);

      velCell.addEventListener("wheel", (e: WheelEvent) => {
        e.preventDefault();
        const s = [...((model.get("steps") as StepData[]) || [])];
        if (i < s.length) {
          const delta = e.deltaY < 0 ? 5 : -5;
          const newVel = Math.max(0, Math.min(127, s[i].velocity + delta));
          s[i] = { ...s[i], velocity: newVel };
          model.set("steps", s);
          model.save_changes();
        }
      });

      velCell.appendChild(velBar);
      velRow.appendChild(velCell);
    }
    grid.appendChild(velRow);

    updateInfo();
  }

  function syncGrid(): void {
    const steps = (model.get("steps") as StepData[]) || [];
    const currentStep = model.get("current_step") as number;

    const headerCells = grid.querySelectorAll(".nbplay-seq-header-cell");
    headerCells.forEach((hc: Element, i: number) => {
      hc.classList.toggle("active-col", i === currentStep);
    });

    const cells = grid.querySelectorAll(".nbplay-seq-cell");
    cells.forEach((cell: Element, i: number) => {
      if (i >= steps.length) return;
      cell.classList.toggle("active", !!steps[i].active);
      cell.classList.toggle("current", i === currentStep);
      cell.textContent = noteName(steps[i].note);
      (cell as HTMLElement).title = `Step ${i + 1}: ${noteName(steps[i].note)} vel=${steps[i].velocity}`;
    });

    const velBars = grid.querySelectorAll(".nbplay-seq-vel-bar");
    velBars.forEach((bar: Element, i: number) => {
      if (i >= steps.length) return;
      (bar as HTMLElement).style.height = (steps[i].velocity / 127 * 100) + "%";
      bar.classList.toggle("active", !!steps[i].active);
      bar.classList.toggle("current", i === currentStep);
    });

    updateInfo();
  }

  function updateInfo(): void {
    const steps = (model.get("steps") as StepData[]) || [];
    const active = steps.filter((s: StepData) => s.active).length;
    info.textContent = `${active}/${steps.length} steps active · ${model.get("bpm")} BPM`;
  }

  playBtn.addEventListener("click", () => {
    const playing = model.get("is_playing") as boolean;
    model.set("is_playing", !playing);
    model.save_changes();
  });

  stopBtn.addEventListener("click", () => {
    model.set("is_playing", false);
    model.set("current_step", -1);
    model.save_changes();
  });

  bpmSlider.addEventListener("input", () => {
    const val = parseFloat(bpmSlider.value);
    bpmVal.textContent = val + " BPM";
    model.set("bpm", val);
    model.save_changes();
  });

  makeEditable(bpmVal, {
    className: "nbplay-seq-inline-edit",
    getValue: () => String(model.get("bpm")),
    parse: (raw: string) => {
      const v = parseFloat(raw);
      if (isNaN(v)) return null;
      return Math.max(30, Math.min(300, Math.round(v)));
    },
    apply: (v: unknown) => { model.set("bpm", v); model.save_changes(); },
    sync: syncControls,
  });

  durSelect.addEventListener("change", () => {
    model.set("step_duration", parseFloat(durSelect.value));
    model.save_changes();
  });

  loopChk.addEventListener("change", () => {
    model.set("loop_enabled", loopChk.checked);
    model.save_changes();
  });

  let prevLength: number = -1;

  function onModelChange(): void {
    const steps = (model.get("steps") as StepData[]) || [];
    if (steps.length !== prevLength) {
      prevLength = steps.length;
      buildGrid();
    } else {
      syncGrid();
    }

    const playing = model.get("is_playing") as boolean;
    playBtn.textContent = playing ? "⏸" : "▶";
    playBtn.classList.toggle("playing", playing);

    if (playing && !audioScheduler.isPlaying()) {
      audioScheduler.start(model);
    } else if (!playing && audioScheduler.isPlaying()) {
      audioScheduler.stop();
    }
  }

  function syncControls(): void {
    bpmSlider.value = String(model.get("bpm"));
    bpmVal.textContent = model.get("bpm") + " BPM";
    durSelect.value = String(model.get("step_duration"));
    loopChk.checked = model.get("loop_enabled") as boolean;
  }

  model.on("change:steps", onModelChange);
  model.on("change:current_step", onModelChange);
  model.on("change:is_playing", onModelChange);
  model.on("change:bpm", syncControls);
  model.on("change:step_duration", syncControls);
  model.on("change:loop_enabled", syncControls);

  syncControls();
  buildGrid();
  onModelChange();

  return () => {
    audioScheduler.destroy();
  };
}

export default { render };
