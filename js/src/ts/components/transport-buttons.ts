import { html, nothing } from "lit";
import { NbplayElement, define } from "./base.ts";

/**
 * `<nbplay-transport-buttons>`: stop, play/pause, record. The host owns the
 * state (`playing`, `recording`); clicks fire `nbplay-stop`, `nbplay-play`
 * ({value: wantPlaying}) and `nbplay-record` ({value: wantRecording}).
 */
export class NbplayTransportButtons extends NbplayElement {
  static properties = {
    playing: { type: Boolean, reflect: true },
    recording: { type: Boolean, reflect: true },
    showRecord: { type: Boolean, attribute: "show-record" },
    disabled: { type: Boolean, reflect: true },
  };

  declare playing: boolean;
  declare recording: boolean;
  declare showRecord: boolean;
  declare disabled: boolean;

  constructor() {
    super();
    this.playing = false;
    this.recording = false;
    this.showRecord = true;
    this.disabled = false;
  }

  render() {
    return html`<button
        type="button"
        class="nbplay-transport-stop"
        title="Stop and rewind"
        ?disabled=${this.disabled}
        @click=${() => this.emitDetail("nbplay-stop", {})}
      >
        ■
      </button>
      <nbplay-toggle
        class="nbplay-transport-play"
        variant="play"
        .label=${this.playing ? "⏸" : "▶"}
        .title=${this.playing ? "Pause" : "Play"}
        .active=${this.playing}
        .disabled=${this.disabled}
        @change=${(e: Event) => this.forward(e, "nbplay-play")}
      ></nbplay-toggle>
      ${
        this.showRecord
          ? html`<nbplay-toggle
              class="nbplay-transport-record"
              variant="record"
              label="●"
              title="Record"
              .active=${this.recording}
              .disabled=${this.disabled}
              @change=${(e: Event) => this.forward(e, "nbplay-record")}
            ></nbplay-toggle>`
          : nothing
      }`;
  }

  private forward(e: Event, name: string): void {
    e.stopPropagation();
    this.emitDetail(name, { value: (e as CustomEvent).detail.value });
  }
}

define("nbplay-transport-buttons", NbplayTransportButtons);
