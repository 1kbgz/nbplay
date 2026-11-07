import { html, nothing } from "lit";
import { NbplayElement, define } from "./base.ts";

/**
 * `<nbplay-header>`: the shared widget header: a title ("nbplay"), a badge
 * naming the instrument, an optional status text, and an actions area that
 * receives whatever children the element had when it was connected (light
 * DOM has no slots, so children are captured once and rendered in place).
 */
export class NbplayHeader extends NbplayElement {
  static properties = {
    title: { type: String },
    badge: { type: String },
    status: { type: String },
  };

  declare title: string;
  declare badge: string;
  declare status: string;

  private actions: Node[] | null = null;

  constructor() {
    super();
    this.title = "nbplay";
    this.badge = "";
    this.status = "";
  }

  connectedCallback(): void {
    if (this.actions === null) this.actions = Array.from(this.childNodes);
    super.connectedCallback();
  }

  render() {
    const actions = this.actions ?? [];
    return html`<h3 class="nbplay-header-title">${this.title}</h3>
      ${this.badge ? html`<span class="nbplay-header-badge">${this.badge}</span>` : nothing}
      ${this.status ? html`<span class="nbplay-header-status">${this.status}</span>` : nothing}
      <div class="nbplay-header-actions">${actions}</div>`;
  }
}

define("nbplay-header", NbplayHeader);
