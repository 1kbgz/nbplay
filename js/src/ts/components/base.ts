import { LitElement } from "lit";

/**
 * Base class for every nbplay element.
 *
 * Elements render into their own light DOM so the existing `.nbplay-*` CSS, the
 * `--jp-*` theme variables, and the Playwright selectors keep working. Elements
 * never touch a widget model: inputs are properties, outputs are bubbling
 * `CustomEvent`s with `detail.value`.
 */
export class NbplayElement extends LitElement {
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  protected emit(name: string, value: unknown): void {
    this.emitDetail(name, { value });
  }

  /** Composites carry structured detail (which pad, which step, ...). */
  protected emitDetail(name: string, detail: Record<string, unknown>): void {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true }),
    );
  }
}

/** Register a tag once. Several widget bundles define the same primitives. */
export function define(tag: string, cls: CustomElementConstructor): void {
  if (!customElements.get(tag)) customElements.define(tag, cls);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Snap to a multiple of `step` and drop the float noise that introduces. */
export function quantize(v: number, step: number): number {
  if (!(step > 0)) return v;
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)));
  return Number((Math.round(v / step) * step).toFixed(decimals));
}
