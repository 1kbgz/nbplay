// nbplay PadWidget – on-screen trigger-pad grid
// MPC-style velocity-sensitive pads with session-bus sampler routing.

import {
  type AnyModel,
  createAudioContext,
  makeEditable,
  onKernelDisconnect,
} from "./helpers.ts";
import {
  clampVelocity,
  normalizePadActions,
  noteName,
  padActionLabel,
  parseNoteName,
  type PadAction,
} from "./pads.ts";
import { routeNoteOn, routeNoteOff, type KeyboardRoute } from "./routing.ts";

function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

interface AudioEngine {
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  destroy(): void;
}

function createAudioEngine(
  sessionId: string,
  channelIndex: number,
): AudioEngine {
  let ctx: AudioContext | null = null;
  let output: AudioNode | null = null;
  let ownCtx = true;
  const activeOscillators: Map<number, OscillatorNode> = new Map();
  const activeGains: Map<number, GainNode> = new Map();

  return {
    noteOn(note: number, velocity: number): void {
      if (!ctx) {
        const g = globalThis as Record<string, unknown>;
        const nbplay = g.__nbplay as
          | Record<
              string,
              { audioCtx: AudioContext; channels: { gain: AudioNode }[] }
            >
          | undefined;
        if (sessionId && nbplay?.[sessionId]?.channels[channelIndex]) {
          ctx = nbplay[sessionId].audioCtx;
          output = nbplay[sessionId].channels[channelIndex].gain;
          ownCtx = false;
        } else {
          ctx = createAudioContext();
          if (ctx) ownCtx = true;
        }
      }
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();

      const freq = midiToHz(note);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const now = ctx.currentTime;
      const vol = velocity / 127;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.005);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.connect(gain);
      gain.connect(output || ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);

      // Track for potential early release
      activeOscillators.set(note, osc);
      activeGains.set(note, gain);

      // Cleanup after envelope
      setTimeout(() => {
        activeOscillators.delete(note);
        activeGains.delete(note);
      }, 400);
    },

    noteOff(note: number): void {
      const gain = activeGains.get(note);
      if (gain && ctx) {
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
      }
    },

    destroy(): void {
      activeOscillators.forEach((osc) => {
        try {
          osc.stop();
        } catch (_) {
          /* already stopped */
        }
      });
      activeOscillators.clear();
      activeGains.clear();
      if (ownCtx && ctx) ctx.close();
    },
  };
}

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const root = document.createElement("div");
  root.className = "nbplay-pad";
  root.innerHTML = `
    <div class="nbplay-pad-header">
      <h3>nbplay</h3>
      <span class="nbplay-badge">pads</span>
    </div>
    <div class="nbplay-pad-controls">
      <div class="nbplay-pad-vel-section">
        <label class="nbplay-pad-label">Velocity</label>
        <input type="range" class="nbplay-pad-vel-slider" min="1" max="127" step="1" />
        <span class="nbplay-pad-vel-val"></span>
      </div>
      <label class="nbplay-pad-vel-sense-label">
        <input type="checkbox" class="nbplay-pad-vel-sense-chk" checked /> Vel-Sensitive
      </label>
    </div>
    <div class="nbplay-pad-grid"></div>
    <div class="nbplay-pad-footer">
      <span class="nbplay-pad-info"></span>
    </div>
  `;
  el.appendChild(root);

  const grid = root.querySelector(".nbplay-pad-grid")! as HTMLDivElement;
  const info = root.querySelector(".nbplay-pad-info")! as HTMLSpanElement;
  const velSlider = root.querySelector(
    ".nbplay-pad-vel-slider",
  )! as HTMLInputElement;
  const velVal = root.querySelector(".nbplay-pad-vel-val")! as HTMLSpanElement;
  const velSenseChk = root.querySelector(
    ".nbplay-pad-vel-sense-chk",
  )! as HTMLInputElement;

  const audio = createAudioEngine(
    model.get("session_id") as string,
    model.get("channel_index") as number,
  );

  // Track held pads for pointer-up release
  const heldPads: Set<number> = new Set();
  const heldNotes: Map<number, number> = new Map();

  function getPadNotes(): number[] {
    return (model.get("pad_notes") as number[]) || [];
  }

  function getPadVelocities(): number[] {
    return (model.get("pad_velocities") as number[]) || [];
  }

  function getEffectiveVelocities(): number[] {
    const vels = getPadVelocities();
    const globalVel = (model.get("velocity") as number) || 100;
    return vels.map((v) => (v !== undefined ? v : globalVel));
  }

  function getPadActions(): PadAction[] {
    const dims = getGridDims();
    return normalizePadActions(
      model.get("pad_actions"),
      getPadNotes(),
      getEffectiveVelocities(),
      dims.rows * dims.cols,
    );
  }

  function resetPadVelocities(velocity: number): void {
    const current = getPadVelocities();
    const dims = getGridDims();
    const count = current.length || dims.rows * dims.cols;
    const nextVelocities = Array.from({ length: count }, () => velocity);
    model.set("pad_velocities", nextVelocities);

    const actions = normalizePadActions(
      model.get("pad_actions"),
      getPadNotes(),
      nextVelocities,
      dims.rows * dims.cols,
    ).map((action) =>
      action.type === "note" ? { ...action, velocity } : action,
    );
    model.set("pad_actions", actions);
  }

  function positiveInt(value: unknown, fallback: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.floor(n));
  }

  function getGridDims(): { rows: number; cols: number } {
    return {
      rows: positiveInt(model.get("rows"), 4),
      cols: positiveInt(model.get("cols"), 4),
    };
  }

  function isInlineEditTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest(".nbplay-pad-inline-edit"));
  }

  function computeVelocity(
    index: number,
    clientY: number,
    elRect: DOMRect,
  ): number {
    const effVels = getEffectiveVelocities();
    const maxVel = effVels[index] !== undefined ? effVels[index] : 100;
    if (!(model.get("velocity_sensitive") as boolean)) {
      return maxVel;
    }
    const fraction = (clientY - elRect.top) / elRect.height;
    // Top = soft (~20), bottom = hard, with the individual velocity as ceiling
    const raw = Math.round(20 + fraction * (maxVel - 20));
    return Math.max(1, Math.min(127, raw));
  }

  function setLastPadEvent(
    index: number,
    action: PadAction,
    eventType: "on" | "off" | "trigger",
    velocity: number,
  ): void {
    model.set("last_pad_event", {
      pad: index,
      event: eventType,
      velocity,
      action,
    });
  }

  function triggerPad(index: number, velocity: number): void {
    const notes = getPadNotes();
    const actions = getPadActions();
    const action: PadAction = actions[index] || {
      type: "note",
      note: notes[index] ?? 60,
    };

    heldPads.add(index);

    if (action.type === "note") {
      const note = action.note;
      const actionVelocity = clampVelocity(velocity, action.velocity ?? 100);
      heldNotes.set(index, note);
      const routes = (model.get("sampler_routing") as KeyboardRoute[]) || [];
      const sessionId = model.get("session_id") as string;
      const usedSampler = routeNoteOn(
        sessionId,
        routes,
        note,
        "upper",
        actionVelocity,
      );
      if (!usedSampler) {
        audio.noteOn(note, actionVelocity);
      }
      model.set("last_note_event", {
        note,
        velocity: actionVelocity,
        type: "on",
      });
      setLastPadEvent(index, action, "on", actionVelocity);
    } else {
      if (action.type === "trait") {
        model.set(action.trait, action.value);
      }
      setLastPadEvent(index, action, "trigger", velocity);
    }

    model.set("active_pads", Array.from(heldPads));
    model.save_changes();
    updateActiveStates();
  }

  function releasePad(index: number): void {
    if (!heldPads.has(index)) return;
    heldPads.delete(index);

    const note = heldNotes.get(index);
    heldNotes.delete(index);
    const action = getPadActions()[index];
    if (note === undefined) {
      if (action) setLastPadEvent(index, action, "off", 0);
      model.set("active_pads", Array.from(heldPads));
      model.save_changes();
      updateActiveStates();
      return;
    }

    const routes = (model.get("sampler_routing") as KeyboardRoute[]) || [];
    const sessionId = model.get("session_id") as string;
    const usedSampler = routeNoteOff(sessionId, routes, note, "upper");
    if (!usedSampler) {
      audio.noteOff(note);
    }

    model.set("last_note_event", { note, velocity: 0, type: "off" });
    if (action) setLastPadEvent(index, action, "off", 0);
    model.set("active_pads", Array.from(heldPads));
    model.save_changes();
    updateActiveStates();
  }

  function updateActiveStates(): void {
    const cells = grid.querySelectorAll(".nbplay-pad-cell");
    cells.forEach((cell) => {
      const idx = parseInt((cell as HTMLElement).dataset.index || "0", 10);
      cell.classList.toggle("active", heldPads.has(idx));
    });
  }

  function updateInfo(): void {
    const dims = getGridDims();
    const active = heldPads.size;
    info.textContent = `${active} active · ${dims.rows}×${dims.cols} · vel ${model.get("velocity")}`;
  }

  function buildGrid(): void {
    grid.innerHTML = "";
    const dims = getGridDims();
    const notes = getPadNotes();
    const actions = getPadActions();
    grid.style.gridTemplateColumns = `repeat(${dims.cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${dims.rows}, 1fr)`;

    for (let i = 0; i < dims.rows * dims.cols; i++) {
      const cell = document.createElement("div");
      cell.className = "nbplay-pad-cell";
      cell.dataset.index = String(i);
      const effVels = getEffectiveVelocities();
      const effVel = effVels[i] !== undefined ? effVels[i] : 100;
      const action = actions[i];
      const labelText = action
        ? padActionLabel(action)
        : noteName(notes[i] || 0);
      cell.title = `Pad ${i + 1}: ${labelText}  vel=${effVel}`;

      // Velocity bar — full-height fill behind label, same pattern as sequencer.
      // Height is proportional to effective velocity, anchored at bottom.
      const velBarHeight = Math.max(2, Math.round((effVel / 127) * 100));
      const velBar = document.createElement("div");
      velBar.className = "nbplay-pad-vel-bar";
      velBar.style.height = velBarHeight + "%";
      velBar.title = `${effVel} — drag to adjust | Shift+scroll`;
      cell.appendChild(velBar);

      const label = document.createElement("span");
      label.className = "nbplay-pad-label";
      label.textContent = labelText;
      cell.appendChild(label);

      // Tap-vs-drag: quick tap = trigger note (Y-position → velocity),
      // click-and-drag = adjust individual velocity on the full pad.
      let dragStartY = 0;
      let isDraggingVel = false;
      let pointerActive = false;
      let pointerStartedOnLabel = false;
      const DRAG_THRESHOLD = 5; // px of vertical movement to enter drag mode
      const LABEL_TAP_DELAY_MS = 300;
      let pendingLabelTap: ReturnType<typeof setTimeout> | null = null;

      function clearPendingLabelTap(): void {
        if (pendingLabelTap) {
          clearTimeout(pendingLabelTap);
          pendingLabelTap = null;
        }
      }

      function isLabelTarget(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) return false;
        return Boolean(target.closest(".nbplay-pad-label"));
      }

      function fireTap(clientY: number): void {
        const rect = cell.getBoundingClientRect();
        const velVal = computeVelocity(i, clientY, rect);
        triggerPad(i, velVal);
        requestAnimationFrame(() => releasePad(i));
      }

      cell.addEventListener("pointerdown", (e: PointerEvent) => {
        if (isInlineEditTarget(e.target)) {
          pointerActive = false;
          return;
        }
        pointerStartedOnLabel = isLabelTarget(e.target);
        if (!pointerStartedOnLabel) {
          e.preventDefault();
          cell.setPointerCapture(e.pointerId);
        }
        dragStartY = e.clientY;
        isDraggingVel = false;
        pointerActive = true;
      });

      cell.addEventListener("pointermove", (e: PointerEvent) => {
        if (!pointerActive) return;
        if (Math.abs(e.clientY - dragStartY) > DRAG_THRESHOLD) {
          isDraggingVel = true;
          clearPendingLabelTap();
        }
        if (isDraggingVel) {
          const rect = cell.getBoundingClientRect();
          const fraction = 1 - (e.clientY - rect.top) / rect.height;
          const newVel = Math.max(1, Math.min(127, Math.round(fraction * 127)));
          const next = [...getPadVelocities()];
          if (i < next.length) {
            next[i] = newVel;
            model.set("pad_velocities", next);
            model.save_changes();
          }
        }
      });

      cell.addEventListener("pointerup", (e: PointerEvent) => {
        if (!pointerActive) return;
        pointerActive = false;
        if (isDraggingVel) {
          isDraggingVel = false;
          return;
        }
        // Quick tap → trigger note with Y-position velocity.
        // Use requestAnimationFrame for release so the browser renders
        // the .active flash before we remove it.
        if (pointerStartedOnLabel || isLabelTarget(e.target)) {
          const clientY = e.clientY;
          clearPendingLabelTap();
          pendingLabelTap = setTimeout(() => {
            pendingLabelTap = null;
            fireTap(clientY);
          }, LABEL_TAP_DELAY_MS);
        } else {
          fireTap(e.clientY);
        }
        pointerStartedOnLabel = false;
      });

      cell.addEventListener("pointerleave", () => {
        pointerActive = false;
        pointerStartedOnLabel = false;
        isDraggingVel = false;
        clearPendingLabelTap();
        if (heldPads.has(i)) releasePad(i);
      });

      cell.addEventListener("lostpointercapture", () => {
        pointerActive = false;
        pointerStartedOnLabel = false;
        isDraggingVel = false;
        clearPendingLabelTap();
        if (heldPads.has(i)) releasePad(i);
      });

      // Scroll wheel → adjust note (normal) or velocity (Shift+scroll).
      // On macOS trackpads, Shift+scroll sends the delta through deltaX
      // instead of deltaY, so we check both axes.
      cell.addEventListener("wheel", (e: WheelEvent) => {
        e.preventDefault();
        if (e.shiftKey) {
          const currentVels = [...getPadVelocities()];
          if (i >= currentVels.length) return;
          const rawDelta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
          const delta = rawDelta < 0 ? 5 : -5;
          const newVel = Math.max(
            1,
            Math.min(127, (currentVels[i] || 100) + delta),
          );
          currentVels[i] = newVel;
          model.set("pad_velocities", currentVels);
          model.save_changes();
        } else {
          const current = [...getPadNotes()];
          if (i >= current.length) return;
          const delta = e.deltaY < 0 ? 1 : -1;
          const newNote = Math.max(
            0,
            Math.min(127, (current[i] || 60) + delta),
          );
          current[i] = newNote;
          model.set("pad_notes", current);
          model.save_changes();
        }
      });

      // Double-click → edit note name
      label.addEventListener("dblclick", (e: MouseEvent) => {
        clearPendingLabelTap();
        e.stopPropagation();
      });
      makeEditable(label, {
        className: "nbplay-pad-inline-edit",
        getValue: () => {
          const n = getPadNotes();
          return noteName(n[i] || 60);
        },
        parse: (raw: string) => {
          const num = parseInt(raw, 10);
          if (!isNaN(num) && num >= 0 && num <= 127) return num;
          return parseNoteName(raw);
        },
        apply: (v: unknown) => {
          if (typeof v === "number") {
            const next = [...getPadNotes()];
            if (i < next.length) {
              next[i] = v;
              model.set("pad_notes", next);
              model.save_changes();
            }
          }
        },
        sync: syncGrid,
      });

      grid.appendChild(cell);
    }
    updateInfo();
  }

  function syncGrid(): void {
    const notes = getPadNotes();
    const vels = getEffectiveVelocities();
    const actions = getPadActions();
    const cells = grid.querySelectorAll(".nbplay-pad-cell");
    cells.forEach((cell) => {
      const el = cell as HTMLElement;
      const idx = parseInt(el.dataset.index || "0", 10);
      const label = el.querySelector(".nbplay-pad-label") as HTMLElement | null;
      const velBar = el.querySelector(
        ".nbplay-pad-vel-bar",
      ) as HTMLElement | null;
      if (label && idx < notes.length) {
        label.textContent = actions[idx]
          ? padActionLabel(actions[idx])
          : noteName(notes[idx]);
      }
      if (velBar) {
        const vel = vels[idx] !== undefined ? vels[idx] : 100;
        const h = Math.max(2, Math.round((vel / 127) * 100));
        velBar.style.height = h + "%";
        velBar.title = `${vel} — drag to adjust | Shift+scroll`;
      }
      const vel = vels[idx] !== undefined ? vels[idx] : 100;
      const labelText = actions[idx]
        ? padActionLabel(actions[idx])
        : noteName(notes[idx] || 0);
      el.title = `Pad ${idx + 1}: ${labelText}  vel=${vel}`;
    });
    updateInfo();
  }

  velSlider.addEventListener("input", () => {
    const val = parseInt(velSlider.value, 10);
    velVal.textContent = String(val);
    model.set("velocity", val);
    model.save_changes();
  });

  velSenseChk.addEventListener("change", () => {
    model.set("velocity_sensitive", velSenseChk.checked);
    model.save_changes();
  });

  let prevRows = -1;
  let prevCols = -1;
  let prevNotesLen = -1;

  function onModelChange(): void {
    const dims = getGridDims();
    const notes = getPadNotes();
    if (
      dims.rows !== prevRows ||
      dims.cols !== prevCols ||
      notes.length !== prevNotesLen
    ) {
      prevRows = dims.rows;
      prevCols = dims.cols;
      prevNotesLen = notes.length;
      buildGrid();
    } else {
      syncGrid();
    }
  }

  // Init — build grid first, then wire model listeners so init-time
  // change events don't overwrite explicitly-set trait values.
  velSlider.value = String(model.get("velocity"));
  velVal.textContent = String(model.get("velocity"));
  velSenseChk.checked = model.get("velocity_sensitive") as boolean;
  buildGrid();

  model.on("change:pad_notes", onModelChange);
  model.on("change:pad_velocities", () => syncGrid());
  model.on("change:pad_actions", onModelChange);
  model.on("change:rows", onModelChange);
  model.on("change:cols", onModelChange);
  model.on("change:velocity", () => {
    const gv = clampVelocity(model.get("velocity"));
    velSlider.value = String(gv);
    velVal.textContent = String(gv);
    resetPadVelocities(gv);
    model.save_changes();
    syncGrid();
    updateInfo();
  });
  model.on("change:velocity_sensitive", () => {
    velSenseChk.checked = model.get("velocity_sensitive") as boolean;
  });

  // Release all on kernel disconnect
  const cancelDisconnect = onKernelDisconnect(model, () => {
    heldPads.forEach((index) => releasePad(index));
    heldPads.clear();
    heldNotes.clear();
    updateActiveStates();
  });

  return () => {
    cancelDisconnect();
    heldPads.forEach((index) => releasePad(index));
    heldPads.clear();
    heldNotes.clear();
    audio.destroy();
  };
}

export default { render };
