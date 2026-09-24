// nbplay LauncherWidget - beats view: a clip launcher grid.
//
// Tracks are rows, scenes are columns, each filled slot holds a step pattern
// in the sequencer's voices_data shape. Every track runs one pattern at a
// time through the shared audio scheduler against the session clock, so all
// playing slots stay phase-locked. Launches take effect on the next
// quantization boundary (bar, beat, or immediately).

import { type AnyModel, bindShortcuts } from "./helpers.ts";
import {
  type AudioScheduler,
  createAudioScheduler,
  type StepData,
} from "./scheduler.ts";
import { bindClock, type ClockEvent, type SessionClock } from "./session.ts";

const NONE_QUEUED = -2;
const STOP_QUEUED = -1;

interface LauncherTrack {
  name: string;
  channel_index: number;
}

interface LauncherSlot {
  track_index: number;
  scene_index: number;
  name: string;
  voices_data: StepData[][];
  step_duration: number;
  swing: number;
  groove: number[];
}

interface LaunchRequest {
  action?: "launch" | "stop" | "scene" | "stop_all";
  track_index?: number;
  scene_index?: number;
  nonce?: number;
}

interface TrackState {
  scheduler: AudioScheduler;
  activeScene: number;
  queued: { scene: number; atBeat: number; fromBeat: number } | null;
  currentStep: number;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function numberValue(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getTracks(model: AnyModel): LauncherTrack[] {
  const raw =
    (model.get("tracks") as Partial<LauncherTrack>[] | undefined) || [];
  return raw.map((track, index) => ({
    name: String(track.name ?? `Track ${index + 1}`),
    channel_index: numberValue(track.channel_index, index),
  }));
}

function getScenes(model: AnyModel): string[] {
  return ((model.get("scenes") as string[] | undefined) || []).map(String);
}

function getSlots(model: AnyModel): LauncherSlot[] {
  const raw = (model.get("slots") as Partial<LauncherSlot>[] | undefined) || [];
  return raw
    .filter(
      (slot) => Array.isArray(slot.voices_data) && slot.voices_data.length,
    )
    .map((slot) => ({
      track_index: numberValue(slot.track_index, 0),
      scene_index: numberValue(slot.scene_index, 0),
      name: String(slot.name ?? "Clip"),
      voices_data: slot.voices_data as StepData[][],
      step_duration: Math.max(0.001, numberValue(slot.step_duration, 0.25)),
      swing: numberValue(slot.swing, 0),
      groove: (slot.groove || []).map((v) => numberValue(v, 0)),
    }));
}

function findSlot(
  model: AnyModel,
  trackIndex: number,
  sceneIndex: number,
): LauncherSlot | null {
  return (
    getSlots(model).find(
      (slot) =>
        slot.track_index === trackIndex && slot.scene_index === sceneIndex,
    ) || null
  );
}

/**
 * Present a slot to the shared scheduler as a minimal model. The scheduler
 * reads pattern traits through get() and reports the step through set().
 */
function slotModel(
  model: AnyModel,
  track: LauncherTrack,
  slot: LauncherSlot,
  onStep: (step: number) => void,
): AnyModel {
  return {
    get(name: string): unknown {
      switch (name) {
        case "voices_data":
          return slot.voices_data;
        case "step_duration":
          return slot.step_duration;
        case "swing":
          return slot.swing;
        case "groove":
          return slot.groove;
        case "loop_enabled":
          return true;
        case "automation_lanes":
          return [];
        case "session_id":
          return model.get("session_id");
        case "channel_index":
          return track.channel_index;
        default:
          return undefined;
      }
    },
    set(name: string, value: unknown): void {
      if (name === "current_step") onStep(numberValue(value, -1));
    },
    save_changes(): void {},
    on(): void {},
  };
}

export default {
  render({ model, el }: { model: AnyModel; el: HTMLElement }) {
    const root = document.createElement("div");
    root.className = "nbplay-launcher";
    el.appendChild(root);

    const states: TrackState[] = [];
    let queueTimer: ReturnType<typeof setInterval> | null = null;
    let lastNonce = -1;
    let disposed = false;
    let mirroring = false;

    function mirror(write: () => void, save = false): void {
      mirroring = true;
      try {
        write();
      } finally {
        mirroring = false;
      }
      if (save) model.save_changes();
    }

    function beatsPerBar(): number {
      return Math.max(1, numberValue(model.get("time_signature_num"), 4));
    }

    function ensureStates(): void {
      const count = getTracks(model).length;
      while (states.length < count) {
        const index = states.length;
        states.push({
          scheduler: createAudioScheduler({ onEnd: () => stopNow(index) }),
          activeScene: -1,
          queued: null,
          currentStep: -1,
        });
      }
      while (states.length > count) {
        const state = states.pop();
        state?.scheduler.destroy();
      }
    }

    // Clock

    function onClockEvent(event: ClockEvent): void {
      switch (event.type) {
        case "play":
          mirror(() => model.set("is_playing", true), true);
          resumeActive();
          startQueueTimer();
          syncGrid();
          break;
        case "stop":
          stopQueueTimer();
          states.forEach((state) => {
            state.scheduler.stop();
            state.currentStep = -1;
          });
          mirror(() => model.set("is_playing", false), true);
          syncGrid();
          break;
        case "seek":
        case "tempo":
        case "loop":
          states.forEach((state) => state.scheduler.realign());
          break;
        case "record":
        case "timesig":
          break;
      }
    }

    function onRebind(clk: SessionClock): void {
      states.forEach((state) => state.scheduler.stop());
      mirror(() => model.set("is_playing", clk.playing));
      if (clk.playing) resumeActive();
      syncGrid();
    }

    const binding = bindClock(model, onClockEvent, onRebind);
    const clock = (): SessionClock => binding.clock();

    // Keyboard: Space toggles the clock, digits launch scenes, Escape/0 stop all.
    const shortcuts: Record<string, () => boolean | void> = {
      Space: () => {
        const clk = clock();
        if (clk.playing) clk.stop();
        else clk.play();
      },
      Escape: () => stopAll(),
      "0": () => stopAll(),
    };
    for (let digit = 1; digit <= 9; digit++) {
      shortcuts[String(digit)] = () => {
        if (digit - 1 >= getScenes(model).length) return false;
        launchScene(digit - 1);
      };
    }
    const unbindShortcuts = bindShortcuts(root, shortcuts);

    // Launching

    function startSlot(trackIndex: number, sceneIndex: number): boolean {
      ensureStates();
      const state = states[trackIndex];
      const track = getTracks(model)[trackIndex];
      const slot = findSlot(model, trackIndex, sceneIndex);
      if (!state || !track || !slot) return false;
      state.scheduler.stop();
      state.activeScene = sceneIndex;
      state.currentStep = -1;
      if (clock().playing) {
        state.scheduler.start(
          slotModel(model, track, slot, (step) => {
            state.currentStep = step;
            syncStep(trackIndex);
          }),
          clock(),
        );
      }
      return true;
    }

    function stopNow(trackIndex: number): void {
      const state = states[trackIndex];
      if (!state) return;
      state.scheduler.stop();
      state.activeScene = -1;
      state.currentStep = -1;
    }

    function resumeActive(): void {
      ensureStates();
      states.forEach((state, index) => {
        if (state.activeScene >= 0) startSlot(index, state.activeScene);
      });
    }

    function nextBoundary(beat: number): number {
      const quantize = String(model.get("quantize") || "bar");
      if (quantize === "none") return beat;
      const unit = quantize === "beat" ? 1 : beatsPerBar();
      const next = Math.ceil(beat / unit - 1e-6) * unit;
      return Math.max(beat, next);
    }

    function queue(trackIndex: number, scene: number): void {
      ensureStates();
      const state = states[trackIndex];
      if (!state) return;
      const clk = clock();
      if (!clk.playing) {
        // Launching from a stopped session starts the transport: the slot
        // begins immediately at the current position.
        if (scene >= 0) startSlot(trackIndex, scene);
        else stopNow(trackIndex);
        state.queued = null;
        mirrorSlotState();
        clk.play();
        return;
      }
      const beat = clk.beat();
      const atBeat = nextBoundary(beat);
      if (atBeat <= beat + 1e-9) {
        if (scene >= 0) startSlot(trackIndex, scene);
        else stopNow(trackIndex);
        state.queued = null;
        mirrorSlotState();
        syncGrid();
        return;
      }
      state.queued = { scene, atBeat, fromBeat: beat };
      startQueueTimer();
      mirrorSlotState();
      syncGrid();
    }

    function processQueue(): void {
      const clk = clock();
      const beat = clk.beat();
      let changed = false;
      states.forEach((state, index) => {
        const queued = state.queued;
        if (!queued) return;
        // Fire at the boundary, or when the clock wrapped behind the
        // queue time (loop end), so a launch never gets stranded.
        if (beat + 1e-9 >= queued.atBeat || beat < queued.fromBeat - 1e-9) {
          state.queued = null;
          if (queued.scene >= 0) startSlot(index, queued.scene);
          else stopNow(index);
          changed = true;
        }
      });
      if (changed) {
        mirrorSlotState();
        syncGrid();
      }
      if (!states.some((state) => state.queued)) stopQueueTimer();
    }

    function startQueueTimer(): void {
      if (queueTimer || !states.some((state) => state.queued)) return;
      queueTimer = setInterval(processQueue, 25);
      processQueue();
    }

    function stopQueueTimer(): void {
      if (queueTimer) {
        clearInterval(queueTimer);
        queueTimer = null;
      }
    }

    function launchScene(sceneIndex: number): void {
      getTracks(model).forEach((_, index) => {
        queue(
          index,
          findSlot(model, index, sceneIndex) ? sceneIndex : STOP_QUEUED,
        );
      });
    }

    function stopAll(): void {
      getTracks(model).forEach((_, index) => queue(index, STOP_QUEUED));
    }

    function mirrorSlotState(): void {
      mirror(() => {
        model.set(
          "active_slots",
          states.map((state) => state.activeScene),
        );
        model.set(
          "queued_slots",
          states.map((state) =>
            state.queued ? state.queued.scene : NONE_QUEUED,
          ),
        );
      }, true);
    }

    function selectSlot(trackIndex: number, sceneIndex: number): void {
      model.set("selected_slot", {
        track_index: trackIndex,
        scene_index: sceneIndex,
      });
      model.save_changes();
    }

    function handleLaunchRequest(): void {
      if (disposed) return;
      const request = (model.get("launch_request") || {}) as LaunchRequest;
      const nonce = numberValue(request.nonce, -1);
      if (!request.action || nonce === lastNonce) return;
      lastNonce = nonce;
      const trackIndex = numberValue(request.track_index, -1);
      const sceneIndex = numberValue(request.scene_index, -1);
      switch (request.action) {
        case "launch":
          if (trackIndex >= 0 && sceneIndex >= 0) queue(trackIndex, sceneIndex);
          break;
        case "stop":
          if (trackIndex >= 0) queue(trackIndex, STOP_QUEUED);
          break;
        case "scene":
          if (sceneIndex >= 0) launchScene(sceneIndex);
          break;
        case "stop_all":
          stopAll();
          break;
      }
    }

    // Rendering

    function syncStep(trackIndex: number): void {
      const state = states[trackIndex];
      if (!state) return;
      const cell = root.querySelector(
        `.nbplay-launcher-slot[data-track="${trackIndex}"][data-scene="${state.activeScene}"]`,
      ) as HTMLElement | null;
      if (!cell) return;
      const slot = findSlot(model, trackIndex, state.activeScene);
      const length = slot?.voices_data[0]?.length || 0;
      cell.dataset.step = String(state.currentStep);
      const bar = cell.querySelector(
        ".nbplay-launcher-progress",
      ) as HTMLElement | null;
      if (bar) {
        bar.style.width =
          length > 0 && state.currentStep >= 0
            ? `${((state.currentStep + 1) / length) * 100}%`
            : "0%";
      }
    }

    function syncGrid(): void {
      if (disposed) return;
      ensureStates();
      const tracks = getTracks(model);
      const scenes = getScenes(model);
      const slots = getSlots(model);
      const selected = (model.get("selected_slot") || {}) as {
        track_index?: number;
        scene_index?: number;
      };
      const playing = Boolean(model.get("is_playing"));
      const quantize = String(model.get("quantize") || "bar");

      const header = `<div class="nbplay-launcher-row nbplay-launcher-scenes">
        <div class="nbplay-launcher-corner">${playing ? "▶" : "■"}</div>
        ${scenes
          .map(
            (name, index) =>
              `<button class="nbplay-launcher-scene" data-scene="${index}" title="Launch scene">${escapeHtml(name)}</button>`,
          )
          .join("")}
        <button class="nbplay-launcher-stop-all" title="Stop all tracks">■ All</button>
      </div>`;

      const rows = tracks
        .map((track, trackIndex) => {
          const state = states[trackIndex];
          const cells = scenes
            .map((_, sceneIndex) => {
              const slot = slots.find(
                (item) =>
                  item.track_index === trackIndex &&
                  item.scene_index === sceneIndex,
              );
              const classes = [
                "nbplay-launcher-slot",
                slot ? "filled" : "empty",
                state?.activeScene === sceneIndex ? "active" : "",
                state?.queued?.scene === sceneIndex ? "queued" : "",
                selected.track_index === trackIndex &&
                selected.scene_index === sceneIndex
                  ? "selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ");
              const label = slot
                ? escapeHtml(slot.name)
                : `<span class="nbplay-launcher-empty-mark">■</span>`;
              return `<button class="${classes}" data-track="${trackIndex}" data-scene="${sceneIndex}" title="${slot ? "Launch clip" : "Stop track"}"><span class="nbplay-launcher-progress"></span><span class="nbplay-launcher-slot-name">${label}</span></button>`;
            })
            .join("");
          const stopClasses = [
            "nbplay-launcher-track-stop",
            state?.queued?.scene === STOP_QUEUED ? "queued" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `<div class="nbplay-launcher-row" data-track="${trackIndex}">
            <div class="nbplay-launcher-track">
              <span class="nbplay-launcher-track-name">${escapeHtml(track.name)}</span>
              <small>${track.channel_index >= 0 ? `Ch ${track.channel_index + 1}` : "No channel"}</small>
            </div>
            ${cells}
            <button class="${stopClasses}" data-track="${trackIndex}" title="Stop track">■</button>
          </div>`;
        })
        .join("");

      root.style.setProperty("--nbplay-launcher-scenes", String(scenes.length));
      root.innerHTML = `<div class="nbplay-launcher-header">
        <h3>nbplay</h3>
        <span class="nbplay-badge">launcher</span>
        <label class="nbplay-launcher-field" title="Launch quantization">
          <span>Quantize</span>
          <select class="nbplay-launcher-quantize">
            <option value="bar" ${quantize === "bar" ? "selected" : ""}>Bar</option>
            <option value="beat" ${quantize === "beat" ? "selected" : ""}>Beat</option>
            <option value="none" ${quantize === "none" ? "selected" : ""}>None</option>
          </select>
        </label>
      </div>
      <div class="nbplay-launcher-grid">
        ${header}
        ${rows || `<div class="nbplay-launcher-empty">No tracks</div>`}
      </div>`;

      root
        .querySelector(".nbplay-launcher-quantize")
        ?.addEventListener("change", (event) => {
          const select = event.currentTarget as HTMLSelectElement;
          model.set("quantize", select.value);
          model.save_changes();
        });
      root.querySelectorAll(".nbplay-launcher-scene").forEach((button) => {
        button.addEventListener("click", () => {
          launchScene(numberValue((button as HTMLElement).dataset.scene, -1));
        });
      });
      root
        .querySelector(".nbplay-launcher-stop-all")
        ?.addEventListener("click", stopAll);
      root.querySelectorAll(".nbplay-launcher-slot").forEach((button) => {
        button.addEventListener("click", () => {
          const trackIndex = numberValue(
            (button as HTMLElement).dataset.track,
            -1,
          );
          const sceneIndex = numberValue(
            (button as HTMLElement).dataset.scene,
            -1,
          );
          if (button.classList.contains("filled")) {
            selectSlot(trackIndex, sceneIndex);
            queue(trackIndex, sceneIndex);
          } else {
            queue(trackIndex, STOP_QUEUED);
          }
        });
      });
      root.querySelectorAll(".nbplay-launcher-track-stop").forEach((button) => {
        button.addEventListener("click", () => {
          queue(
            numberValue((button as HTMLElement).dataset.track, -1),
            STOP_QUEUED,
          );
        });
      });
      states.forEach((_, index) => syncStep(index));
    }

    // Model observers

    model.on("change:tracks", () => {
      ensureStates();
      syncGrid();
    });
    model.on("change:scenes", syncGrid);
    model.on("change:slots", () => {
      // A playing slot whose pattern changed restarts on the new data.
      states.forEach((state, index) => {
        if (state.activeScene >= 0 && clock().playing)
          startSlot(index, state.activeScene);
      });
      syncGrid();
    });
    model.on("change:selected_slot", syncGrid);
    model.on("change:quantize", syncGrid);
    model.on("change:is_playing", () => {
      if (disposed || mirroring) return;
      const clk = clock();
      if (model.get("is_playing")) {
        if (!clk.playing) clk.play();
      } else if (clk.playing) {
        clk.stop();
      }
      syncGrid();
    });
    model.on("change:bpm", () => {
      if (disposed || mirroring) return;
      clock().setTempo(numberValue(model.get("bpm"), 120));
    });
    model.on("change:launch_request", handleLaunchRequest);

    // Initial state: tempo from the kernel, play state from the browser clock.
    {
      const clk = clock();
      clk.setTempo(numberValue(model.get("bpm"), 120));
      mirror(() => {
        model.set("is_playing", clk.playing);
        model.set(
          "active_slots",
          getTracks(model).map(() => -1),
        );
        model.set(
          "queued_slots",
          getTracks(model).map(() => NONE_QUEUED),
        );
      });
    }
    ensureStates();
    syncGrid();
    lastNonce = numberValue(
      (model.get("launch_request") as LaunchRequest)?.nonce,
      -1,
    );

    return () => {
      disposed = true;
      stopQueueTimer();
      unbindShortcuts();
      states.forEach((state) => state.scheduler.destroy());
      states.length = 0;
      binding.dispose();
      root.remove();
    };
  },
};
