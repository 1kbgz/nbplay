// nbplay SequencerWidget – anywidget ESM frontend
// Step sequencer grid with Web Audio lookahead scheduler

import {
  type AnyModel,
  bindShortcuts,
  makeEditable,
  onKernelDisconnect,
} from "./helpers.ts";
import {
  createAudioScheduler,
  type StepData,
  voicesFromModel,
} from "./scheduler.ts";
import { bindClock, type ClockEvent, type SessionClock } from "./session.ts";

const NOTE_NAMES: string[] = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const STEP_DURATION_OPTIONS = [1, 0.5, 0.25, 0.125];

function noteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[midi % 12] + octave;
}

function defaultStep(): StepData {
  return {
    active: false,
    note: 60,
    velocity: 100,
    duration_ticks: 1,
    probability: 100,
  };
}

function measureBeatCount(
  timeSignatureNum: number,
  timeSignatureDen: number,
): number {
  return Math.max(0, timeSignatureNum * (4 / Math.max(1, timeSignatureDen)));
}

function configuredStepCount(
  measures: number,
  stepDuration: number,
  timeSignatureNum: number,
  timeSignatureDen: number,
): number {
  const safeMeasures = Math.max(1, Math.round(measures || 1));
  const safeStepDuration = Math.max(0.001, stepDuration || 0.25);
  return Math.max(
    1,
    Math.round(
      (safeMeasures * measureBeatCount(timeSignatureNum, timeSignatureDen)) /
        safeStepDuration,
    ),
  );
}

function resizeSteps(steps: StepData[], length: number): StepData[] {
  const next = steps.slice(0, length).map((step) => ({ ...step }));
  while (next.length < length) next.push(defaultStep());
  return next;
}

function resizeVoicesData(
  voicesData: StepData[][],
  length: number,
  voiceCount: number,
): StepData[][] {
  const count = Math.max(1, voicesData.length || voiceCount || 1);
  return Array.from({ length: count }, (_, index) =>
    resizeSteps(voicesData[index] || [], length),
  );
}

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
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
      <button class="nbplay-seq-btn nbplay-seq-rec" title="Record from keyboard" style="display:none">⏺</button>
      <div class="nbplay-seq-bpm-section">
        <label class="nbplay-seq-label">BPM</label>
        <input type="range" class="nbplay-seq-bpm-slider" min="30" max="300" step="1" />
        <span class="nbplay-seq-bpm-val"></span>
      </div>
      <div class="nbplay-seq-dur-section">
        <label class="nbplay-seq-label">Step</label>
        <select class="nbplay-seq-dur-select">
          <option value="1">1/4</option>
          <option value="0.5">1/8</option>
          <option value="0.25">1/16</option>
          <option value="0.125">1/32</option>
        </select>
      </div>
      <div class="nbplay-seq-measures-section">
        <label class="nbplay-seq-label">Bars</label>
        <input type="number" class="nbplay-seq-measures-input" min="1" max="64" step="1" />
        <span class="nbplay-seq-length-val"></span>
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
  const recBtn = root.querySelector(".nbplay-seq-rec")! as HTMLButtonElement;
  const bpmSlider = root.querySelector(
    ".nbplay-seq-bpm-slider",
  )! as HTMLInputElement;
  const bpmVal = root.querySelector(".nbplay-seq-bpm-val")! as HTMLSpanElement;
  const durSelect = root.querySelector(
    ".nbplay-seq-dur-select",
  )! as HTMLSelectElement;
  const measuresInput = root.querySelector(
    ".nbplay-seq-measures-input",
  )! as HTMLInputElement;
  const lengthVal = root.querySelector(
    ".nbplay-seq-length-val",
  )! as HTMLSpanElement;
  const loopChk = root.querySelector(
    ".nbplay-seq-loop-chk",
  )! as HTMLInputElement;
  const grid = root.querySelector(".nbplay-seq-grid")! as HTMLDivElement;
  const info = root.querySelector(".nbplay-seq-info")! as HTMLSpanElement;

  // Transport: the sequencer follows the session clock when it has a
  // session_id, otherwise a private clock. See session.ts.
  const audioScheduler = createAudioScheduler({ onEnd: onPatternEnd });
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

  function startScheduler(): void {
    if (!audioScheduler.isPlaying()) audioScheduler.start(model, clock());
  }

  function stopLocal(save: boolean): void {
    audioScheduler.stop();
    mirror(() => {
      model.set("is_playing", false);
      model.set("current_step", -1);
    }, save);
    syncPlayState();
  }

  function onPatternEnd(): void {
    // A one-shot pattern finished. Standalone sequencers own their clock and
    // rewind it; in a session the clock keeps running for other widgets.
    if (binding.shared()) {
      stopLocal(true);
    } else {
      const clk = clock();
      clk.stop();
      clk.seek(0);
    }
  }

  function onClockEvent(event: ClockEvent): void {
    switch (event.type) {
      case "play":
        mirror(() => model.set("is_playing", true), true);
        startScheduler();
        syncPlayState();
        break;
      case "stop":
        stopLocal(true);
        break;
      case "seek":
      case "loop":
        audioScheduler.realign();
        break;
      case "tempo": {
        audioScheduler.realign();
        const bpm = clock().bpm;
        if (Number(model.get("bpm")) !== bpm) {
          mirror(() => model.set("bpm", bpm), true);
        }
        syncControls();
        break;
      }
      case "record":
      case "timesig":
        break;
    }
  }

  function onRebind(clk: SessionClock): void {
    audioScheduler.stop();
    clk.setTempo(Number(model.get("bpm")));
    mirror(() => {
      model.set("is_playing", clk.playing);
      model.set("current_step", -1);
    });
    if (clk.playing) startScheduler();
    syncPlayState();
  }

  const binding = bindClock(model, onClockEvent, onRebind);
  const clock = (): SessionClock => binding.clock();

  // Recording state
  const armedVoices: Set<number> = new Set();
  let applyingGridConfiguration = false;

  function updateRecVisibility(): void {
    const kbConnected = model.get("keyboard_connected") as boolean;
    recBtn.style.display = kbConnected ? "" : "none";
    // Per-voice REC dots
    root.querySelectorAll(".nbplay-seq-voice-rec").forEach((dot) => {
      (dot as HTMLElement).style.display = kbConnected ? "" : "none";
    });
  }

  function syncRecState(): void {
    recBtn.classList.toggle("recording", armedVoices.size > 0);
    root.querySelectorAll(".nbplay-seq-voice-rec").forEach((dot) => {
      const v = parseInt((dot as HTMLElement).dataset.voice || "0", 10);
      dot.classList.toggle("recording", armedVoices.has(v));
    });
    if (armedVoices.size > 0) {
      document.addEventListener("nbplay-note", onDocumentNote);
    } else {
      document.removeEventListener("nbplay-note", onDocumentNote);
    }
  }

  function onNoteEvent(evt: {
    note: number;
    velocity: number;
    type: string;
  }): void {
    if (armedVoices.size === 0 || evt.type !== "on") return;
    const playing = model.get("is_playing") as boolean;
    if (!playing) return;
    const currentStep = model.get("current_step") as number;
    if (currentStep < 0) return;
    const vd = [...((model.get("voices_data") as StepData[][]) || [])];
    if (vd.length === 0) return;
    let changed = false;
    for (const v of armedVoices) {
      if (v < vd.length) {
        const s = [...(vd[v] || [])];
        if (currentStep < s.length) {
          s[currentStep] = {
            ...s[currentStep],
            note: evt.note,
            velocity: evt.velocity,
            active: true,
          };
          vd[v] = s;
          changed = true;
        }
      }
    }
    if (changed) {
      model.set("voices_data", vd);
      model.save_changes();
    }
  }

  // Listen for keyboard note events via document CustomEvent.
  // This works without a session bus — any KeyboardWidget on the page
  // dispatches "nbplay-note" events on document.
  function onDocumentNote(e: Event): void {
    const detail = (e as CustomEvent).detail as
      | { note: number; velocity: number; type: string }
      | undefined;
    if (detail) onNoteEvent(detail);
  }

  // Step editing with keyboard

  let pendingKeyEditCell: { voice: number; step: number } | null = null;
  let pendingKeyEditHandler: ((e: Event) => void) | null = null;

  function cancelPendingKeyEdit(): void {
    if (pendingKeyEditHandler) {
      document.removeEventListener("nbplay-note", pendingKeyEditHandler);
      pendingKeyEditHandler = null;
    }
    if (pendingKeyEditCell) {
      // Restore cell text
      const voices = getVoices();
      const v = pendingKeyEditCell.voice;
      const s = pendingKeyEditCell.step;
      const steps = voices[v] || [];
      const cell = grid.querySelector(
        `.nbplay-seq-cell[data-voice="${v}"][data-step="${s}"]`,
      ) as HTMLElement | null;
      if (cell && s < steps.length) {
        cell.textContent = noteName(steps[s].note);
        cell.classList.remove("nbplay-seq-key-wait");
      }
      pendingKeyEditCell = null;
    }
  }

  function waitForKeyboardNote(
    voice: number,
    step: number,
    cell: HTMLElement,
  ): void {
    const kbConnected = model.get("keyboard_connected") as boolean;
    if (!kbConnected) return;

    // Cancel any previous pending edit
    cancelPendingKeyEdit();

    pendingKeyEditCell = { voice, step };
    cell.textContent = "♪?";
    cell.classList.add("nbplay-seq-key-wait");

    // Focus the sequencer root so keystrokes don't go to Jupyter
    root.focus();

    // Listen for the next note via document CustomEvent
    const handler = (e: Event) => {
      const evt = (e as CustomEvent).detail as {
        note: number;
        velocity: number;
        type: string;
      };
      if (evt.type !== "on" || !pendingKeyEditCell) return;
      const v = pendingKeyEditCell.voice;
      const s = pendingKeyEditCell.step;
      pendingKeyEditCell = null;
      pendingKeyEditHandler = null;
      document.removeEventListener("nbplay-note", handler);

      const vd = [...((model.get("voices_data") as StepData[][]) || [])];
      const steps = [...(vd[v] || [])];
      if (s < steps.length) {
        steps[s] = {
          ...steps[s],
          note: evt.note,
          velocity: evt.velocity,
          active: true,
        };
        vd[v] = steps;
        model.set("voices_data", vd);
        model.save_changes();
      }
    };
    pendingKeyEditHandler = handler;
    document.addEventListener("nbplay-note", handler);
  }

  function getVoices(): StepData[][] {
    return voicesFromModel(model);
  }

  function actualGridLength(): number {
    const voices = getVoices();
    return voices[0]?.length || Number(model.get("length") || 0) || 1;
  }

  function gridLengthFromControls(): number {
    return configuredStepCount(
      Number(model.get("measures") || 1),
      Number(model.get("step_duration") || 0.25),
      Number(model.get("time_signature_num") || 4),
      Number(model.get("time_signature_den") || 4),
    );
  }

  function inferStepDurationForLength(length: number): number {
    const measures = Math.max(1, Number(model.get("measures") || 1));
    const beats =
      measures *
      measureBeatCount(
        Number(model.get("time_signature_num") || 4),
        Number(model.get("time_signature_den") || 4),
      );
    const inferred = Math.max(0.001, beats / Math.max(1, length));
    const matched = STEP_DURATION_OPTIONS.find(
      (option) => Math.abs(option - inferred) < 0.0001,
    );
    return matched ?? inferred;
  }

  function reconcileGridConfigurationWithActualLength(): void {
    if (applyingGridConfiguration) return;
    const actualLength = actualGridLength();
    if (actualLength === gridLengthFromControls()) return;
    model.set("length", actualLength);
    model.set("step_duration", inferStepDurationForLength(actualLength));
  }

  function formatMeasureCount(): string {
    const measures = Math.max(1, Number(model.get("measures") || 1));
    return measures === 1 ? "1 measure" : `${measures} measures`;
  }

  function formatGridLength(): string {
    return `${formatMeasureCount()} · ${actualGridLength()} steps`;
  }

  function applyGridConfiguration(updates: {
    measures?: number;
    stepDuration?: number;
  }): void {
    if (applyingGridConfiguration) return;
    applyingGridConfiguration = true;
    try {
      const nextMeasures = Math.max(
        1,
        Math.min(
          64,
          Math.round(updates.measures ?? Number(model.get("measures") || 1)),
        ),
      );
      const nextStepDuration = Math.max(
        0.001,
        updates.stepDuration ?? Number(model.get("step_duration") || 0.25),
      );
      const nextLength = configuredStepCount(
        nextMeasures,
        nextStepDuration,
        Number(model.get("time_signature_num") || 4),
        Number(model.get("time_signature_den") || 4),
      );
      const voicesData = resizeVoicesData(
        getVoices(),
        nextLength,
        Number(model.get("num_voices") || 1),
      );
      model.set("measures", nextMeasures);
      model.set("step_duration", nextStepDuration);
      model.set("length", nextLength);
      model.set("voices_data", voicesData);
      model.save_changes();
    } finally {
      applyingGridConfiguration = false;
    }
    syncControls();
  }

  function buildGrid(): void {
    grid.innerHTML = "";
    const voices = getVoices();
    if (voices.length === 0) return;
    const numSteps = voices[0].length;
    const currentStep = model.get("current_step") as number;

    // Header row with step numbers
    const headerRow = document.createElement("div");
    headerRow.className = "nbplay-seq-row nbplay-seq-header-row";
    const cornerCell = document.createElement("div");
    cornerCell.className = "nbplay-seq-label-cell";
    cornerCell.textContent = "#";
    headerRow.appendChild(cornerCell);
    for (let i = 0; i < numSteps; i++) {
      const hcell = document.createElement("div");
      hcell.className = "nbplay-seq-header-cell";
      hcell.textContent = String(i + 1);
      if (i === currentStep) hcell.classList.add("active-col");
      headerRow.appendChild(hcell);
    }
    grid.appendChild(headerRow);

    // For each voice: a step row + a velocity row
    for (let v = 0; v < voices.length; v++) {
      const steps = voices[v];
      const voiceLabel = String(v + 1);

      // Step row
      const stepRow = document.createElement("div");
      stepRow.className = "nbplay-seq-row";
      stepRow.dataset.voice = String(v);
      const stepLbl = document.createElement("div");
      stepLbl.className = "nbplay-seq-label-cell";
      const voiceNum = document.createElement("span");
      voiceNum.textContent = voiceLabel;
      stepLbl.appendChild(voiceNum);
      const voiceRec = document.createElement("button");
      voiceRec.className = "nbplay-seq-voice-rec";
      voiceRec.dataset.voice = String(v);
      voiceRec.textContent = "\u23FA";
      voiceRec.title = `Toggle recording for voice ${v + 1}`;
      const kbConnected = model.get("keyboard_connected") as boolean;
      voiceRec.style.display = kbConnected ? "" : "none";
      if (armedVoices.has(v)) voiceRec.classList.add("recording");
      voiceRec.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        if (armedVoices.has(v)) {
          armedVoices.delete(v);
        } else {
          armedVoices.add(v);
        }
        syncRecState();
      });
      stepLbl.appendChild(voiceRec);
      stepRow.appendChild(stepLbl);

      for (let i = 0; i < steps.length; i++) {
        const cell = document.createElement("div");
        cell.className = "nbplay-seq-cell";
        cell.dataset.step = String(i);
        cell.dataset.voice = String(v);
        if (steps[i].active) cell.classList.add("active");
        if (i === currentStep) cell.classList.add("current");
        cell.textContent = noteName(steps[i].note);
        cell.title = `Voice ${v + 1} Step ${i + 1}: ${noteName(steps[i].note)} vel=${steps[i].velocity} prob=${steps[i].probability ?? 100}%`;

        cell.addEventListener("click", () => {
          // Toggle immediately.  In a dblclick sequence the browser fires
          // click twice (detail 1 then 2) so two toggles cancel out,
          // leaving the step in its original state before dblclick opens
          // the ♪? editor.  This avoids timing-dependent deferred toggles.
          const vd = [...((model.get("voices_data") as StepData[][]) || [])];
          const s = [...(vd[v] || [])];
          if (i < s.length) {
            s[i] = { ...s[i], active: !s[i].active };
            vd[v] = s;
            model.set("voices_data", vd);
            model.save_changes();
          }
        });

        cell.addEventListener("wheel", (e: WheelEvent) => {
          e.preventDefault();
          const vd = [...((model.get("voices_data") as StepData[][]) || [])];
          const s = [...(vd[v] || [])];
          if (i < s.length) {
            const delta = e.deltaY < 0 ? 1 : -1;
            const newNote = Math.max(0, Math.min(127, s[i].note + delta));
            s[i] = { ...s[i], note: newNote };
            vd[v] = s;
            model.set("voices_data", vd);
            model.save_changes();
          }
        });

        cell.addEventListener("dblclick", (ev: Event) => {
          ev.stopPropagation();
          const kbConnected = model.get("keyboard_connected") as boolean;
          if (kbConnected) {
            waitForKeyboardNote(v, i, cell);
          }
        });

        stepRow.appendChild(cell);
      }
      grid.appendChild(stepRow);

      // Velocity row
      const velRow = document.createElement("div");
      velRow.className = "nbplay-seq-row nbplay-seq-vel-row";
      velRow.dataset.voice = String(v);
      const velLbl = document.createElement("div");
      velLbl.className = "nbplay-seq-label-cell";
      velLbl.textContent = "VEL" + (voices.length > 1 ? voiceLabel : "");
      velRow.appendChild(velLbl);

      for (let i = 0; i < steps.length; i++) {
        const velCell = document.createElement("div");
        velCell.className = "nbplay-seq-vel-cell";
        const velBar = document.createElement("div");
        velBar.className = "nbplay-seq-vel-bar";
        velBar.style.height = (steps[i].velocity / 127) * 100 + "%";
        if (steps[i].active) velBar.classList.add("active");
        if (i === currentStep) velBar.classList.add("current");
        velCell.appendChild(velBar);

        velCell.addEventListener("wheel", (e: WheelEvent) => {
          e.preventDefault();
          const vd = [...((model.get("voices_data") as StepData[][]) || [])];
          const s = [...(vd[v] || [])];
          if (i < s.length) {
            const delta = e.deltaY < 0 ? 5 : -5;
            const newVel = Math.max(0, Math.min(127, s[i].velocity + delta));
            s[i] = { ...s[i], velocity: newVel };
            vd[v] = s;
            model.set("voices_data", vd);
            model.save_changes();
          }
        });

        velRow.appendChild(velCell);
      }
      grid.appendChild(velRow);
    }

    updateInfo();
  }

  function syncGrid(): void {
    const voices = getVoices();
    if (voices.length === 0) return;
    const currentStep = model.get("current_step") as number;

    const headerCells = grid.querySelectorAll(".nbplay-seq-header-cell");
    headerCells.forEach((hc: Element, i: number) => {
      hc.classList.toggle("active-col", i === currentStep);
    });

    const cells = grid.querySelectorAll(".nbplay-seq-cell");
    cells.forEach((cell: Element) => {
      const el = cell as HTMLElement;
      const v = parseInt(el.dataset.voice || "0", 10);
      const i = parseInt(el.dataset.step || "0", 10);
      const steps = voices[v] || [];
      if (i >= steps.length) return;
      cell.classList.toggle("active", !!steps[i].active);
      cell.classList.toggle("current", i === currentStep);
      cell.classList.toggle(
        "cursor",
        cursor !== null && cursor.voice === v && cursor.step === i,
      );
      cell.textContent = noteName(steps[i].note);
      el.title = `Voice ${v + 1} Step ${i + 1}: ${noteName(steps[i].note)} vel=${steps[i].velocity} prob=${steps[i].probability ?? 100}%`;
    });

    const velBars = grid.querySelectorAll(".nbplay-seq-vel-bar");
    const numSteps = voices[0].length;
    velBars.forEach((bar: Element, flatIdx: number) => {
      const v = Math.floor(flatIdx / numSteps);
      const i = flatIdx % numSteps;
      const steps = voices[v] || [];
      if (i >= steps.length) return;
      (bar as HTMLElement).style.height = (steps[i].velocity / 127) * 100 + "%";
      bar.classList.toggle("active", !!steps[i].active);
      bar.classList.toggle("current", i === currentStep);
    });

    updateInfo();
  }

  function updateInfo(): void {
    const voices = getVoices();
    const numSteps = voices[0]?.length || 0;
    let totalActive = 0;
    for (const steps of voices) {
      totalActive += steps.filter((s: StepData) => s.active).length;
    }
    const voiceCount = voices.length;
    const voiceInfo = voiceCount > 1 ? ` · ${voiceCount} voices` : "";
    info.textContent = `${totalActive}/${numSteps * voiceCount} steps active${voiceInfo} · ${model.get("bpm")} BPM · ${formatGridLength()}`;
  }

  function togglePlay(): void {
    const clk = clock();
    if (model.get("is_playing")) {
      // In a session, pausing this sequencer leaves the shared clock alone.
      if (binding.shared()) stopLocal(true);
      else clk.stop();
    } else if (clk.playing) {
      mirror(() => model.set("is_playing", true), true);
      startScheduler();
      syncPlayState();
    } else {
      clk.play();
    }
  }

  function stopAndRewind(): void {
    const clk = clock();
    if (clk.playing) clk.stop();
    else stopLocal(true);
    clk.seek(0);
  }

  playBtn.addEventListener("click", togglePlay);
  stopBtn.addEventListener("click", stopAndRewind);

  // Keyboard step cursor: arrow keys move it, Enter/x toggle the step.
  let cursor: { voice: number; step: number } | null = null;

  function syncCursor(): void {
    grid.querySelectorAll(".nbplay-seq-cell.cursor").forEach((cell) => {
      cell.classList.remove("cursor");
    });
    if (!cursor) return;
    const cell = grid.querySelector(
      `.nbplay-seq-cell[data-voice="${cursor.voice}"][data-step="${cursor.step}"]`,
    );
    cell?.classList.add("cursor");
  }

  function moveCursor(dVoice: number, dStep: number): void {
    const voices = getVoices();
    if (voices.length === 0) return;
    const numSteps = voices[0].length;
    const next = cursor
      ? { voice: cursor.voice + dVoice, step: cursor.step + dStep }
      : { voice: 0, step: 0 };
    cursor = {
      voice: Math.max(0, Math.min(voices.length - 1, next.voice)),
      step: Math.max(0, Math.min(numSteps - 1, next.step)),
    };
    syncCursor();
  }

  function toggleCursorStep(): void {
    if (!cursor) {
      moveCursor(0, 0);
      return;
    }
    const vd = [...getVoices()];
    const s = [...(vd[cursor.voice] || [])];
    if (cursor.step >= s.length) return;
    s[cursor.step] = { ...s[cursor.step], active: !s[cursor.step].active };
    vd[cursor.voice] = s;
    model.set("voices_data", vd);
    model.save_changes();
  }

  const unbindShortcuts = bindShortcuts(root, {
    Space: togglePlay,
    "Shift+Space": stopAndRewind,
    ArrowLeft: () => moveCursor(0, -1),
    ArrowRight: () => moveCursor(0, 1),
    ArrowUp: () => moveCursor(-1, 0),
    ArrowDown: () => moveCursor(1, 0),
    Enter: toggleCursorStep,
    x: toggleCursorStep,
    Escape: () => {
      cancelPendingKeyEdit();
      cursor = null;
      syncCursor();
    },
  });

  bpmSlider.addEventListener("input", () => {
    const val = parseFloat(bpmSlider.value);
    bpmVal.textContent = val + " BPM";
    clock().setTempo(val);
  });

  makeEditable(bpmVal, {
    className: "nbplay-seq-inline-edit",
    getValue: () => String(model.get("bpm")),
    parse: (raw: string) => {
      const v = parseFloat(raw);
      if (isNaN(v)) return null;
      return Math.max(30, Math.min(300, Math.round(v)));
    },
    apply: (v: unknown) => {
      clock().setTempo(v as number);
    },
    sync: syncControls,
  });

  durSelect.addEventListener("change", () => {
    applyGridConfiguration({ stepDuration: parseFloat(durSelect.value) });
  });

  measuresInput.addEventListener("input", () => {
    const parsed = parseInt(measuresInput.value, 10);
    if (!Number.isNaN(parsed)) applyGridConfiguration({ measures: parsed });
  });

  loopChk.addEventListener("change", () => {
    model.set("loop_enabled", loopChk.checked);
    model.save_changes();
  });

  recBtn.addEventListener("click", () => {
    const voices = getVoices();
    if (armedVoices.size > 0) {
      // Disarm all
      armedVoices.clear();
    } else {
      // Arm all voices
      for (let v = 0; v < voices.length; v++) armedVoices.add(v);
    }
    syncRecState();
  });

  let prevLength: number = -1;
  let prevVoiceCount: number = -1;

  function onModelChange(): void {
    const voices = getVoices();
    const numSteps = voices[0]?.length || 0;
    const numVoices = voices.length;
    if (numSteps !== prevLength || numVoices !== prevVoiceCount) {
      prevLength = numSteps;
      prevVoiceCount = numVoices;
      buildGrid();
    } else {
      syncGrid();
    }

    syncPlayState();
  }

  function syncPlayState(): void {
    const playing = model.get("is_playing") as boolean;
    playBtn.textContent = playing ? "⏸" : "▶";
    playBtn.classList.toggle("playing", playing);
  }

  // Play state arriving from the kernel (Python callers, the Session's
  // transport link). Mirrored clock events skip this via `mirroring`.
  function onPlayStateChange(): void {
    onModelChange();
    if (mirroring) return;
    const clk = clock();
    if (model.get("is_playing")) {
      if (clk.playing) startScheduler();
      else clk.play();
    } else {
      audioScheduler.stop();
      if (!binding.shared()) clk.stop();
    }
  }

  function onBpmChange(): void {
    syncControls();
    if (!mirroring) clock().setTempo(Number(model.get("bpm")));
  }

  function syncControls(): void {
    bpmSlider.value = String(model.get("bpm"));
    bpmVal.textContent = model.get("bpm") + " BPM";
    durSelect.value = String(model.get("step_duration"));
    measuresInput.value = String(model.get("measures") || 1);
    lengthVal.textContent = actualGridLength() + " steps";
    loopChk.checked = model.get("loop_enabled") as boolean;
  }

  function onGridConfigModelChange(): void {
    syncControls();
    if (!applyingGridConfiguration) applyGridConfiguration({});
  }

  model.on("change:voices_data", onModelChange);
  model.on("change:current_step", onModelChange);
  model.on("change:is_playing", onPlayStateChange);
  model.on("change:bpm", onBpmChange);
  model.on("change:measures", onGridConfigModelChange);
  model.on("change:step_duration", onGridConfigModelChange);
  model.on("change:time_signature_num", onGridConfigModelChange);
  model.on("change:time_signature_den", onGridConfigModelChange);
  model.on("change:loop_enabled", syncControls);
  model.on("change:keyboard_connected", updateRecVisibility);

  reconcileGridConfigurationWithActualLength();
  syncControls();
  updateRecVisibility();
  buildGrid();

  // Play state comes from the browser clock, never from a saved notebook's
  // stale is_playing=true. Only update local model state; do NOT call
  // save_changes() here because sending comm messages during render can
  // race with other widgets still being initialised (e.g. Session links).
  {
    const clk = clock();
    clk.setTempo(Number(model.get("bpm")));
    mirror(() => {
      model.set("is_playing", clk.playing);
      model.set("current_step", -1);
    });
    if (clk.playing) startScheduler();
  }

  onModelChange();

  // Focus capture for keyboard note input
  // The KeyboardWidget intercepts keys at window capture level, so no
  // keydown handler is needed here.  Escape cancellation is dispatched
  // by the keyboard via a synthetic CustomEvent.
  root.tabIndex = 0;
  root.addEventListener("nbplay-cancel-edit", () => {
    cancelPendingKeyEdit();
  });

  // Stop playback on kernel disconnect
  const cancelDisconnect = onKernelDisconnect(model, () => {
    disconnected = true;
    audioScheduler.stop();
    if (!binding.shared()) clock().stop();
    stopLocal(false);
    armedVoices.clear();
    syncRecState();
    onModelChange();
  });

  return () => {
    document.removeEventListener("nbplay-note", onDocumentNote);
    cancelPendingKeyEdit();
    cancelDisconnect();
    unbindShortcuts();
    audioScheduler.destroy();
    binding.dispose();
  };
}

export default { render };
