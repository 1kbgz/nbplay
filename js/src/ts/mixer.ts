// nbplay MixerWidget – anywidget ESM frontend
// Mixer console with per-channel faders, pan, mute/solo, master output,
// and a shared Web Audio bus for session routing.

import {
  type AnyModel,
  makeEditable,
  fmtGain,
  fmtPan,
  linearToDb,
  parseDbInput,
} from "./helpers.ts";

// Types

interface Channel {
  name: string;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
}

interface ChannelNode {
  gain: GainNode;
  pan: StereoPannerNode;
}

// Shared Audio Bus

function createAudioBus() {
  let audioCtx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  const channelNodes: ChannelNode[] = [];

  return {
    init(): void {
      if (audioCtx) return;
      audioCtx = new AudioContext();
      masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
    },

    syncChannels(channels: Channel[], masterGainValue: number): void {
      if (!audioCtx || !masterGain) return;
      while (channelNodes.length < channels.length) {
        const g = audioCtx.createGain();
        const p = audioCtx.createStereoPanner();
        g.connect(p);
        p.connect(masterGain);
        channelNodes.push({ gain: g, pan: p });
      }
      while (channelNodes.length > channels.length) {
        const n = channelNodes.pop()!;
        n.gain.disconnect();
        n.pan.disconnect();
      }
      const hasSolo = channels.some((ch) => ch.solo);
      channels.forEach((ch, i) => {
        const n = channelNodes[i];
        let g = ch.gain;
        if (ch.mute || (hasSolo && !ch.solo)) g = 0;
        n.gain.gain.value = g;
        n.pan.pan.value = ch.pan;
      });
      masterGain.gain.value = masterGainValue;
    },

    register(sessionId: string): void {
      const g = globalThis as Record<string, unknown>;
      if (!g.__nbplay) g.__nbplay = {};
      (g.__nbplay as Record<string, unknown>)[sessionId] = {
        audioCtx,
        masterGain,
        channels: channelNodes,
      };
      // Notify widgets (e.g. samplers) that the bus is now available
      document.dispatchEvent(
        new CustomEvent("nbplay-bus-ready", { detail: { sessionId } }),
      );
    },

    destroy(sessionId: string): void {
      const g = globalThis as Record<string, unknown>;
      if (g.__nbplay) delete (g.__nbplay as Record<string, unknown>)[sessionId];
      channelNodes.forEach((n) => {
        n.gain.disconnect();
        n.pan.disconnect();
      });
      channelNodes.length = 0;
      if (masterGain) masterGain.disconnect();
      if (audioCtx && audioCtx.state !== "closed") audioCtx.close();
      audioCtx = null;
      masterGain = null;
    },
  };
}

// Channel strip builder

function buildChannelStrip(ch: Channel, index: number): HTMLDivElement {
  const strip = document.createElement("div");
  strip.className = "nbplay-mixer-strip";
  strip.dataset.index = String(index);

  strip.innerHTML = `
    <div class="nbplay-strip-name" title="${ch.name}">${ch.name}</div>
    <div class="nbplay-strip-fader-section">
      <div class="nbplay-strip-meter">
        <div class="nbplay-strip-meter-fill"></div>
      </div>
      <input type="range" class="nbplay-strip-fader" min="0" max="2" step="0.01"
             value="${ch.gain}" orient="vertical" />
      <div class="nbplay-strip-gain-label">${fmtGain(ch.gain)}</div>
    </div>
    <div class="nbplay-strip-pan-section">
      <span class="nbplay-strip-pan-label">${fmtPan(ch.pan)}</span>
      <input type="range" class="nbplay-strip-pan" min="-1" max="1" step="0.01"
             value="${ch.pan}" />
    </div>
    <div class="nbplay-strip-buttons">
      <button class="nbplay-strip-btn nbplay-mute-btn${ch.mute ? " active" : ""}">M</button>
      <button class="nbplay-strip-btn nbplay-solo-btn${ch.solo ? " active" : ""}">S</button>
    </div>
    <button class="nbplay-strip-remove" title="Remove channel">\u00d7</button>
  `;

  return strip;
}

// Master strip builder

function buildMasterStrip(gain: number): HTMLDivElement {
  const strip = document.createElement("div");
  strip.className = "nbplay-mixer-strip nbplay-master-strip";

  strip.innerHTML = `
    <div class="nbplay-strip-name">Master</div>
    <div class="nbplay-strip-fader-section">
      <div class="nbplay-strip-meter">
        <div class="nbplay-strip-meter-fill"></div>
      </div>
      <input type="range" class="nbplay-strip-fader nbplay-master-fader" min="0" max="2"
             step="0.01" value="${gain}" orient="vertical" />
      <div class="nbplay-strip-gain-label">${fmtGain(gain)}</div>
    </div>
  `;

  return strip;
}

// Widget render

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const root = document.createElement("div");
  root.className = "nbplay-mixer";
  root.innerHTML = `
    <div class="nbplay-mixer-header">
      <h3>nbplay</h3>
      <span class="nbplay-badge">mixer</span>
      <button class="nbplay-mixer-add-btn" title="Add channel">+ Channel</button>
    </div>
    <div class="nbplay-mixer-console"></div>
  `;
  el.appendChild(root);

  const console_ = root.querySelector(
    ".nbplay-mixer-console",
  ) as HTMLDivElement;
  const addBtn = root.querySelector(
    ".nbplay-mixer-add-btn",
  ) as HTMLButtonElement;

  // Audio bus for session routing
  const audioBus = createAudioBus();
  const sessionId = model.get("session_id") as string;
  if (sessionId) {
    audioBus.init();
    audioBus.syncChannels(
      (model.get("channels") as Channel[]) || [],
      model.get("master_gain") as number,
    );
    audioBus.register(sessionId);
  }

  let domChannelCount = -1;
  let dragging = false;
  let pendingRebuild = false;

  // In-place sync

  function syncStrips(): void {
    const channels = (model.get("channels") as Channel[]) || [];
    const strips = console_.querySelectorAll(
      ".nbplay-mixer-strip:not(.nbplay-master-strip)",
    );

    strips.forEach((strip, i) => {
      if (i >= channels.length) return;
      const ch = channels[i];

      const fader = strip.querySelector(
        ".nbplay-strip-fader",
      ) as HTMLInputElement;
      if (fader && document.activeElement !== fader) {
        fader.value = String(ch.gain);
      }
      const gainLabel = strip.querySelector(
        ".nbplay-strip-gain-label",
      ) as HTMLDivElement;
      if (gainLabel) gainLabel.textContent = fmtGain(ch.gain);

      const pan = strip.querySelector(".nbplay-strip-pan") as HTMLInputElement;
      if (pan && document.activeElement !== pan) {
        pan.value = String(ch.pan);
      }
      const panLabel = strip.querySelector(
        ".nbplay-strip-pan-label",
      ) as HTMLSpanElement;
      if (panLabel) panLabel.textContent = fmtPan(ch.pan);

      const muteBtn = strip.querySelector(
        ".nbplay-mute-btn",
      ) as HTMLButtonElement;
      if (muteBtn) muteBtn.classList.toggle("active", !!ch.mute);

      const soloBtn = strip.querySelector(
        ".nbplay-solo-btn",
      ) as HTMLButtonElement;
      if (soloBtn) soloBtn.classList.toggle("active", !!ch.solo);

      const nameEl = strip.querySelector(
        ".nbplay-strip-name",
      ) as HTMLDivElement;
      if (nameEl) {
        nameEl.textContent = ch.name;
        nameEl.title = ch.name;
      }
    });

    const masterFader = console_.querySelector(
      ".nbplay-master-fader",
    ) as HTMLInputElement | null;
    if (masterFader && document.activeElement !== masterFader) {
      masterFader.value = String(model.get("master_gain"));
    }
    const masterLabel = console_.querySelector(
      ".nbplay-master-strip .nbplay-strip-gain-label",
    ) as HTMLDivElement | null;
    if (masterLabel)
      masterLabel.textContent = fmtGain(model.get("master_gain") as number);
  }

  // Full rebuild

  function rebuild(): void {
    if (dragging) {
      pendingRebuild = true;
      return;
    }

    console_.innerHTML = "";
    const channels = (model.get("channels") as Channel[]) || [];
    domChannelCount = channels.length;

    channels.forEach((ch, i) => {
      const strip = buildChannelStrip(ch, i);
      console_.appendChild(strip);

      const fader = strip.querySelector(
        ".nbplay-strip-fader",
      ) as HTMLInputElement;
      const gainLabel = strip.querySelector(
        ".nbplay-strip-gain-label",
      ) as HTMLDivElement;
      fader.addEventListener("pointerdown", () => {
        dragging = true;
      });
      fader.addEventListener("input", () => {
        const val = parseFloat(fader.value);
        gainLabel.textContent = fmtGain(val);
        updateChannel(i, "gain", val);
      });
      fader.addEventListener("pointerup", endDrag);
      fader.addEventListener("lostpointercapture", endDrag);
      fader.addEventListener("change", endDrag);

      // Gain label: double-click to edit — shows/accepts dB values
      makeEditable(gainLabel, {
        className: "nbplay-mixer-inline-edit",
        getValue: () => {
          const ch = ((model.get("channels") as Channel[]) || [])[i];
          const g = ch ? ch.gain : 0.8;
          const db = linearToDb(g);
          if (!isFinite(db)) return "-inf";
          return (db >= 0 ? "+" : "") + db.toFixed(1);
        },
        parse: (raw: string) => parseDbInput(raw),
        apply: (v) => updateChannel(i, "gain", v as number),
        sync: () => {
          const ch = ((model.get("channels") as Channel[]) || [])[i];
          gainLabel.textContent = fmtGain(ch?.gain ?? 0.8);
        },
      });

      // Pan
      const pan = strip.querySelector(".nbplay-strip-pan") as HTMLInputElement;
      const panLabel = strip.querySelector(
        ".nbplay-strip-pan-label",
      ) as HTMLSpanElement;
      pan.addEventListener("pointerdown", () => {
        dragging = true;
      });
      pan.addEventListener("input", () => {
        const val = parseFloat(pan.value);
        panLabel.textContent = fmtPan(val);
        updateChannel(i, "pan", val);
      });
      pan.addEventListener("pointerup", endDrag);
      pan.addEventListener("lostpointercapture", endDrag);
      pan.addEventListener("change", endDrag);

      // Pan label: double-click to edit
      makeEditable(panLabel, {
        className: "nbplay-mixer-inline-edit",
        getValue: () => {
          const ch = ((model.get("channels") as Channel[]) || [])[i];
          return ch ? String(ch.pan) : "0";
        },
        parse: (raw: string) => {
          const v = parseFloat(raw);
          if (isNaN(v)) return null;
          return Math.max(-1, Math.min(1, Math.round(v * 100) / 100));
        },
        apply: (v) => updateChannel(i, "pan", v as number),
        sync: () => {
          const ch = ((model.get("channels") as Channel[]) || [])[i];
          panLabel.textContent = fmtPan(ch?.pan ?? 0);
        },
      });

      // Mute
      const muteBtn = strip.querySelector(
        ".nbplay-mute-btn",
      ) as HTMLButtonElement;
      muteBtn.addEventListener("click", () => {
        const cur = ((model.get("channels") as Channel[]) || [])[i];
        if (cur) updateChannel(i, "mute", !cur.mute);
      });

      // Solo
      const soloBtn = strip.querySelector(
        ".nbplay-solo-btn",
      ) as HTMLButtonElement;
      soloBtn.addEventListener("click", () => {
        const cur = ((model.get("channels") as Channel[]) || [])[i];
        if (cur) updateChannel(i, "solo", !cur.solo);
      });

      // Remove
      const removeBtn = strip.querySelector(
        ".nbplay-strip-remove",
      ) as HTMLButtonElement;
      removeBtn.addEventListener("click", () => {
        const chs = [...((model.get("channels") as Channel[]) || [])];
        chs.splice(i, 1);
        model.set("channels", chs);
        model.save_changes();
      });
    });

    // Master strip
    const masterStrip = buildMasterStrip(model.get("master_gain") as number);
    console_.appendChild(masterStrip);

    const masterFader = masterStrip.querySelector(
      ".nbplay-master-fader",
    ) as HTMLInputElement;
    const masterLabel = masterStrip.querySelector(
      ".nbplay-strip-gain-label",
    ) as HTMLDivElement;
    masterFader.addEventListener("pointerdown", () => {
      dragging = true;
    });
    masterFader.addEventListener("input", () => {
      const val = parseFloat(masterFader.value);
      masterLabel.textContent = fmtGain(val);
      model.set("master_gain", val);
      model.save_changes();
    });
    masterFader.addEventListener("pointerup", endDrag);
    masterFader.addEventListener("lostpointercapture", endDrag);

    // Master label: double-click to edit — shows/accepts dB values
    makeEditable(masterLabel, {
      className: "nbplay-mixer-inline-edit",
      getValue: () => {
        const g = model.get("master_gain") as number;
        const db = linearToDb(g);
        if (!isFinite(db)) return "-inf";
        return (db >= 0 ? "+" : "") + db.toFixed(1);
      },
      parse: (raw: string) => parseDbInput(raw),
      apply: (v) => {
        model.set("master_gain", v);
        model.save_changes();
      },
      sync: () => {
        masterLabel.textContent = fmtGain(model.get("master_gain") as number);
      },
    });
    masterFader.addEventListener("change", endDrag);
  }

  function endDrag(): void {
    if (!dragging) return;
    dragging = false;
    if (pendingRebuild) {
      pendingRebuild = false;
      rebuild();
    }
  }

  function updateChannel(index: number, key: string, value: unknown): void {
    const chs = [...((model.get("channels") as Channel[]) || [])];
    if (index < chs.length) {
      chs[index] = { ...chs[index], [key]: value };
      model.set("channels", chs);
      model.save_changes();
    }
  }

  function onModelChange(): void {
    const channels = (model.get("channels") as Channel[]) || [];
    if (channels.length !== domChannelCount) {
      rebuild();
    } else {
      syncStrips();
    }
    if (model.get("session_id")) {
      audioBus.syncChannels(channels, model.get("master_gain") as number);
    }
  }

  // Add channel
  addBtn.addEventListener("click", () => {
    const chs = [...((model.get("channels") as Channel[]) || [])];
    const n = chs.length + 1;
    chs.push({
      name: "Ch " + n,
      gain: 0.8,
      pan: 0.0,
      mute: false,
      solo: false,
    });
    model.set("channels", chs);
    model.save_changes();
  });

  // Model observers
  model.on("change:channels", onModelChange);
  model.on("change:master_gain", onModelChange);

  // Initial render
  rebuild();

  // Cleanup
  return () => {
    const sid = model.get("session_id") as string;
    if (sid) audioBus.destroy(sid);
  };
}

export default { render };
