import { html, nothing } from "lit";

/** Keep the existing numeric token format, including repeated picks in one millisecond. */
export function presetRequest(name: string, previous: string): string {
  const last = Number(previous.split(":", 1)[0]) || 0;
  return `${Math.max(Date.now(), last + 1)}:${name}`;
}

/**
 * A "Preset…" select for an instrument's header. Picking a name calls
 * `onPick(name)` and the select returns to its placeholder, so the same
 * preset can be picked again. Renders nothing without names.
 */
export function presetSelect(names: unknown, onPick: (name: string) => void) {
  const list = Array.isArray(names) ? names.map(String) : [];
  if (list.length === 0) return nothing;
  return html`<select
    class="nbplay-preset-select"
    aria-label="Load a preset"
    @change=${(e: Event) => {
      e.stopPropagation();
      const select = e.target as HTMLSelectElement;
      const name = select.value;
      select.value = "";
      if (name) onPick(name);
    }}
  >
    <option value="" selected>Preset…</option>
    ${list.map((name) => html`<option value=${name}>${name}</option>`)}
  </select>`;
}
