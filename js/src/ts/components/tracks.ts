import { html, nothing } from "lit";
import { NbplayElement, define } from "./base.ts";

const INSTRUMENTS = [
  { value: "synth", label: "Synth" },
  { value: "fm", label: "FM synth" },
  { value: "sampler", label: "Sampler" },
  { value: "drums", label: "Drum machine" },
  { value: "none", label: "No instrument" },
];
const NOTE_SOURCES = [
  { value: "sequencer", label: "Sequencer" },
  { value: "arpeggiator", label: "Arpeggiator" },
  { value: "none", label: "No note source" },
];

/**
 * `<nbplay-tracks>`: the app's track menu. A button opens a list of the
 * session's `tracks` (names), each with a remove button, and a form that adds
 * one: a name, an instrument and a note source. A change is first offered in
 * a cancelable `nbplay-request` (`{name: "tracks", change}`, the change being
 * `{action: "add", name, instrument, notes}` or `{action: "remove", index}`);
 * unless a host cancels it and takes it, the element POSTs it to `url` and
 * reloads the page, whose panels the server has rebuilt. A rejected change
 * shows the server's `error`.
 */
export class NbplayTracks extends NbplayElement {
  static properties = {
    url: { type: String },
    tracks: { attribute: false },
    open: { state: true },
    error: { state: true },
  };

  declare url: string;
  declare tracks: string[];
  declare open: boolean;
  declare error: string;

  constructor() {
    super();
    this.url = "";
    this.tracks = [];
    this.open = false;
    this.error = "";
  }

  private async change(change: Record<string, unknown>): Promise<void> {
    this.error = "";
    const request = new CustomEvent("nbplay-request", {
      detail: { name: "tracks", change },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    if (!this.dispatchEvent(request)) return;
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(change),
      });
      if (response.ok) {
        location.reload();
        return;
      }
      const body = await response.json().catch(() => ({}));
      this.error = body.error ?? `Change failed (${response.status})`;
    } catch (error) {
      this.error = String(error);
    }
  }

  private add(e: Event): void {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const field = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement)
        .value;
    void this.change({
      action: "add",
      name: field("name").trim(),
      instrument: field("instrument"),
      notes: field("notes"),
    });
  }

  render() {
    const tracks = this.tracks || [];
    return html`<button
        type="button"
        class="nbplay-tracks-toggle"
        aria-expanded=${this.open ? "true" : "false"}
        @click=${() => (this.open = !this.open)}
      >
        tracks
      </button>
      ${
        this.open
          ? html`<div
              class="nbplay-tracks-menu"
              role="dialog"
              aria-label="Tracks"
            >
              <ul class="nbplay-tracks-list">
                ${tracks.map(
                  (name, index) =>
                    html`<li class="nbplay-tracks-item">
                      <span class="nbplay-tracks-name">${name}</span>
                      <button
                        type="button"
                        class="nbplay-tracks-remove"
                        title=${`Remove ${name}`}
                        aria-label=${`Remove ${name}`}
                        @click=${() => void this.change({ action: "remove", index })}
                      >
                        ×
                      </button>
                    </li>`,
                )}
              </ul>
              <form class="nbplay-tracks-add" @submit=${this.add}>
                <input
                  name="name"
                  class="nbplay-tracks-new-name"
                  placeholder=${`Track ${tracks.length + 1}`}
                  aria-label="Track name"
                />
                <select name="instrument" aria-label="Instrument">
                  ${INSTRUMENTS.map((o) => html`<option value=${o.value}>${o.label}</option>`)}
                </select>
                <select name="notes" aria-label="Note source">
                  ${NOTE_SOURCES.map((o) => html`<option value=${o.value}>${o.label}</option>`)}
                </select>
                <button type="submit" class="nbplay-tracks-add-button">
                  Add track
                </button>
              </form>
              ${
                this.error
                  ? html`<span class="nbplay-tracks-error" role="alert"
                      >${this.error}</span
                    >`
                  : nothing
              }
            </div>`
          : nothing
      }`;
  }
}

define("nbplay-tracks", NbplayTracks);
