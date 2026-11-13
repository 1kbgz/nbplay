import { html } from "lit";
import { NbplayElement, define } from "./base.ts";

export interface PaletteCommand {
  id: string;
  label?: string;
}

/** The palette shortcut as it is written on this platform: `⌘ K` or `Ctrl K`. */
export function shortcutLabel(): string {
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform) ? "\u2318 K" : "Ctrl K";
}

/**
 * `<nbplay-palette>`: a command palette in a modal dialog. Ctrl+K or Cmd+K
 * anywhere on the page toggles it, and `show()` opens it. Typing filters
 * `commands` by label; the arrow keys move, Enter or a click picks, Escape
 * closes. Fires `nbplay-request` with `detail.name`, the picked command's id.
 */
export class NbplayPalette extends NbplayElement {
  static properties = {
    commands: { attribute: false },
    placeholder: { type: String },
    query: { state: true },
    active: { state: true },
  };

  declare commands: PaletteCommand[];
  declare placeholder: string;
  declare query: string;
  declare active: number;

  constructor() {
    super();
    this.commands = [];
    this.placeholder = "";
    this.query = "";
    this.active = 0;
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.onShortcut);
  }

  disconnectedCallback(): void {
    window.removeEventListener("keydown", this.onShortcut);
    super.disconnectedCallback();
  }

  /** Open the palette with an empty query. */
  show(): void {
    const dialog = this.dialog;
    if (!dialog || dialog.open) return;
    this.query = "";
    this.active = 0;
    dialog.showModal();
  }

  private get dialog(): HTMLDialogElement | null {
    return this.querySelector("dialog");
  }

  private filtered(): PaletteCommand[] {
    const query = this.query.trim().toLowerCase();
    return this.commands.filter((c) =>
      (c.label ?? c.id).toLowerCase().includes(query),
    );
  }

  private onShortcut = (e: KeyboardEvent): void => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if (e.key.toLowerCase() !== "k") return;
    e.preventDefault();
    if (this.dialog?.open) this.dialog.close();
    else this.show();
  };

  private onKey(e: KeyboardEvent): void {
    const matches = this.filtered();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!matches.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      this.active = (this.active + step + matches.length) % matches.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[this.active]) this.pick(matches[this.active].id);
    }
  }

  private pick(id: string): void {
    this.dialog?.close();
    this.emitDetail("nbplay-request", { name: id });
  }

  protected updated(): void {
    this.querySelector(".nbplay-palette-option.active")?.scrollIntoView({
      block: "nearest",
    });
  }

  render() {
    const matches = this.filtered();
    return html`<dialog
      class="nbplay-palette-dialog"
      @click=${(e: MouseEvent) => {
        if (e.target === this.dialog) this.dialog?.close();
      }}
    >
      <input
        class="nbplay-palette-input"
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-autocomplete="list"
        aria-label=${this.placeholder}
        placeholder=${this.placeholder}
        autocomplete="off"
        spellcheck="false"
        .value=${this.query}
        @input=${(e: Event) => {
          this.query = (e.target as HTMLInputElement).value;
          this.active = 0;
        }}
        @keydown=${this.onKey}
      />
      <ul class="nbplay-palette-list" role="listbox">
        ${matches.map(
          (c, i) =>
            html`<li
              class="nbplay-palette-option ${i === this.active ? "active" : ""}"
              role="option"
              aria-selected=${String(i === this.active)}
              data-id=${c.id}
              @pointermove=${() => {
                this.active = i;
              }}
              @click=${() => this.pick(c.id)}
            >
              ${c.label ?? c.id}
            </li>`,
        )}
        ${
          matches.length
            ? ""
            : html`<li class="nbplay-palette-empty">No match</li>`
        }
      </ul>
    </dialog>`;
  }
}

define("nbplay-palette", NbplayPalette);

/**
 * `<nbplay-palette-hint>`: a button for a top bar that shows `label` and the
 * palette shortcut for this platform. The shortcut is hidden where there is no
 * keyboard. It does not open the palette itself; the host handles its click.
 */
export class NbplayPaletteHint extends NbplayElement {
  static properties = {
    label: { type: String },
  };

  declare label: string;

  constructor() {
    super();
    this.label = "";
  }

  render() {
    return html`<button
      type="button"
      class="nbplay-palette-hint-button"
      aria-label="Open the command palette"
    >
      ${this.label}
      <kbd class="nbplay-palette-hint-keys">${shortcutLabel()}</kbd>
    </button>`;
  }
}

define("nbplay-palette-hint", NbplayPaletteHint);
