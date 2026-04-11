// Shared helpers for nbplay anywidget ESM frontends

/** Minimal interface for the anywidget model object. */
export interface AnyModel {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  save_changes(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

/**
 * Monitor the model's kernel connection.  When the underlying comm
 * channel disappears (kernel restart / shutdown), wait `delay` ms
 * then call `callback`.  If the comm reappears within that window
 * (transient disconnect), the timer is cancelled.
 *
 * The anywidget model proxy doesn't expose `comm` directly, so we
 * check `widget_manager` instead — it's set on the proxy and its
 * kernel connection reflects whether the comm is alive.
 *
 * If the model never had a `widget_manager` (e.g. test mock or
 * standalone use), monitoring is skipped entirely.
 *
 * Returns a cleanup function that stops monitoring.
 */
export function onKernelDisconnect(
  model: AnyModel,
  callback: () => void,
  delay: number = 5000,
): () => void {
  const m = model as Record<string, unknown>;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  let fired = false;

  // Only monitor if the model was created with a live kernel connection.
  // The anywidget proxy exposes `widget_manager`; raw ipywidgets models
  // expose `comm`.  If neither is present at init time, this is a mock
  // or standalone environment — skip monitoring.
  const hasComm = "comm" in m || "widget_manager" in m;
  if (!hasComm) {
    return () => {};
  }

  function isConnected(): boolean {
    // Check `comm` first (raw ipywidgets model), then fall back to
    // `widget_manager` (anywidget proxy).  Both become null/undefined
    // when the kernel disconnects.
    if ("comm" in m) return m.comm != null;
    return m.widget_manager != null;
  }

  pollTimer = setInterval(() => {
    if (fired) return;
    if (!isConnected() && !pendingTimeout) {
      pendingTimeout = setTimeout(() => {
        if (!isConnected() && !fired) {
          fired = true;
          callback();
        }
        pendingTimeout = null;
      }, delay);
    } else if (isConnected() && pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
  }, 2000);

  return () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
  };
}

/**
 * Read a CSS custom property from the element (or its nearest ancestor).
 * Falls back to `fallback` if the property is not set.
 */
export function cssVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/** Options for makeEditable. */
export interface EditableOpts {
  className?: string;
  getValue: () => string;
  parse: (raw: string) => unknown;
  apply: (v: unknown) => void;
  sync: () => void;
}

/**
 * Make an element double-click-to-edit with an inline text input.
 * Includes a guard so commit() only fires once (Enter + blur race).
 */
export function makeEditable(el: HTMLElement, opts: EditableOpts): void {
  el.style.cursor = "pointer";
  el.title = "Double-click to edit";
  el.addEventListener("dblclick", () => {
    let committed = false;
    const input = document.createElement("input");
    input.type = "text";
    input.className = opts.className ?? "nbplay-inline-edit";
    input.value = opts.getValue();
    input.style.width = Math.max(el.offsetWidth + 8, 48) + "px";
    el.replaceWith(input);
    input.focus();
    input.select();
    function commit(): void {
      if (committed) return;
      committed = true;
      const v = opts.parse(input.value.trim());
      if (v !== null) opts.apply(v);
      input.replaceWith(el);
      opts.sync();
    }
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (!committed) {
          committed = true;
          input.replaceWith(el);
          opts.sync();
        }
      }
    });
    input.addEventListener("blur", commit);
  });
}

// Binary buffer helpers

/** Convert an anywidget binary buffer to a Float32Array. */
export function toFloat32(data: unknown): Float32Array | null {
  if (!data || !(data as ArrayBufferView).byteLength) return null;

  if (data instanceof DataView) {
    const n = data.byteLength / 4;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = data.getFloat32(i * 4, true);
    return out;
  }
  if ((data as ArrayBufferView).buffer instanceof ArrayBuffer) {
    const view = data as ArrayBufferView;
    return new Float32Array(
      view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength),
    );
  }
  if (data instanceof ArrayBuffer) {
    return new Float32Array(data);
  }
  return null;
}

// dB conversion helpers

/** Convert linear gain (0–2) to dB. */
export function linearToDb(g: number): number {
  if (g <= 0) return -Infinity;
  return 20 * Math.log10(g);
}

/** Convert dB to linear gain. */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/** Format linear gain as a dB string (e.g. "+6.0 dB", "−∞ dB"). */
export function fmtGain(g: number): string {
  if (g <= 0) return "−∞ dB";
  const db = 20 * Math.log10(g);
  if (db >= 0) return "+" + db.toFixed(1) + " dB";
  return db.toFixed(1) + " dB";
}

/** Format a pan value as a string (e.g. "C", "L50", "R25"). */
export function fmtPan(p: number): string {
  if (Math.abs(p) < 0.01) return "C";
  if (p < 0) return "L" + Math.round(Math.abs(p) * 100);
  return "R" + Math.round(p * 100);
}

/**
 * Parse a dB string (e.g. "+6", "-3.5 dB", "−∞") into linear gain.
 * Returns null on invalid input.
 */
export function parseDbInput(raw: string): number | null {
  const s = raw.replace(/\s*db\s*$/i, "").trim();
  if (s === "−∞" || s === "-inf" || s === "-Infinity") return 0;
  const v = parseFloat(s);
  if (isNaN(v)) return null;
  const linear = dbToLinear(v);
  return Math.max(0, Math.min(2, Math.round(linear * 1000) / 1000));
}
