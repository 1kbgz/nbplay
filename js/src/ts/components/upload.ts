import { html, nothing } from "lit";
import { NbplayElement, define } from "./base.ts";

/**
 * `<nbplay-upload>`: a button that picks a file and PUTs it to `url`. The
 * page reloads once the server accepts the file, because the host answers a
 * replaced document with a different page; a rejected file shows the
 * server's `error` message beside the button.
 *
 * The picked file is first offered in a cancelable `nbplay-request`
 * (`{ name: "upload", file }`). A page with no server cancels it, takes the
 * file itself, and sets `error` if it refuses it.
 */
export class NbplayUpload extends NbplayElement {
  static properties = {
    url: { type: String },
    label: { type: String },
    accept: { type: String },
    error: { state: true },
  };

  declare url: string;
  declare label: string;
  declare accept: string;
  declare error: string;

  constructor() {
    super();
    this.url = "";
    this.label = "";
    this.accept = "";
    this.error = "";
  }

  private async onPick(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    this.error = "";
    const request = new CustomEvent("nbplay-request", {
      detail: { name: "upload", file },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    if (!this.dispatchEvent(request)) return;
    try {
      const response = await fetch(this.url, { method: "PUT", body: file });
      if (response.ok) {
        location.reload();
        return;
      }
      const body = await response.json().catch(() => ({}));
      this.error = body.error ?? `Upload failed (${response.status})`;
    } catch (error) {
      this.error = String(error);
    }
  }

  render() {
    return html`<label class="nbplay-upload-button">
        ${this.label}
        <input
          class="nbplay-upload-input"
          type="file"
          accept=${this.accept}
          @change=${this.onPick}
        />
      </label>
      ${
        this.error
          ? html`<span class="nbplay-upload-error" role="alert"
              >${this.error}</span
            >`
          : nothing
      }`;
  }
}

define("nbplay-upload", NbplayUpload);
