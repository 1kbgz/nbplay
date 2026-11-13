import { html, nothing, type PropertyValues } from "lit";
import { clampMidiNote, noteName, parseNoteName } from "../pads.ts";
import { NbplayElement, define } from "./base.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./bar.ts";
import "./toggle.ts";

export interface Step {
  active: boolean;
  note: number;
  velocity: number;
  probability?: number;
  duration_ticks?: number;
}

export interface StepRef {
  voice: number;
  step: number;
}

/**
 * `<nbplay-step-grid>`: the beat grid. One step row plus one velocity row per
 * voice. Click toggles a step, the wheel moves its note, the velocity bars take
 * the wheel too. `change` carries `{voice, step, field, value}`; the arm dots
 * fire `nbplay-arm` ({voice, armed}). A double-click opens a text field in the
 * step for a note name or MIDI number (Enter commits and activates the step,
 * Escape cancels); with `show-arm` on it fires `nbplay-step-pick`
 * ({voice, step}) instead, so a host can wait for a played note.
 * `current-step`, `cursor`, and `pending` are display state owned by the host.
 */
export class NbplayStepGrid extends NbplayElement {
  static properties = {
    voices: { attribute: false },
    currentStep: { type: Number, attribute: "current-step" },
    cursor: { attribute: false },
    pending: { attribute: false },
    armed: { attribute: false },
    showArm: { type: Boolean, attribute: "show-arm" },
    disabled: { type: Boolean, reflect: true },
    editing: { state: true },
  };

  declare voices: Step[][];
  declare currentStep: number;
  declare cursor: StepRef | null;
  declare pending: StepRef | null;
  declare armed: number[];
  declare showArm: boolean;
  declare disabled: boolean;
  declare editing: StepRef | null;

  constructor() {
    super();
    this.voices = [];
    this.currentStep = -1;
    this.cursor = null;
    this.pending = null;
    this.armed = [];
    this.showArm = false;
    this.disabled = false;
    this.editing = null;
  }

  protected updated(changed: PropertyValues): void {
    if (!changed.has("editing") || !this.editing) return;
    const input = this.querySelector<HTMLInputElement>(
      ".nbplay-step-grid-edit",
    );
    const step = this.step(this.editing.voice, this.editing.step);
    if (!input || !step) return;
    input.value = noteName(step.note);
    input.focus();
    input.select();
  }

  get length(): number {
    return this.voices[0]?.length ?? 0;
  }

  render() {
    const n = this.length;
    const steps = Array.from({ length: n }, (_, i) => i);
    return html`<div class="nbplay-step-grid-rows">
      <div class="nbplay-step-grid-row nbplay-step-grid-header">
        <div class="nbplay-step-grid-label">#</div>
        ${steps.map(
          (i) =>
            html`<div
              class="nbplay-step-grid-head ${i === this.currentStep ? "active-col" : ""}"
            >
              ${i + 1}
            </div>`,
        )}
      </div>
      ${this.voices.map((voice, v) => this.renderVoice(voice, v, steps))}
    </div>`;
  }

  private renderVoice(voice: Step[], v: number, steps: number[]) {
    const armed = this.armed.includes(v);
    return html`<div
        class="nbplay-step-grid-row nbplay-step-grid-steps"
        data-voice=${v}
      >
        <div class="nbplay-step-grid-label">
          <span>${v + 1}</span>
          ${
            this.showArm
              ? html`<nbplay-toggle
                  class="nbplay-step-grid-arm"
                  variant="arm"
                  label="⏺"
                  title="Arm voice ${v + 1} for recording"
                  .active=${armed}
                  @change=${(e: Event) => this.onArm(e, v)}
                ></nbplay-toggle>`
              : nothing
          }
        </div>
        ${steps.map((i) => this.renderCell(voice[i], v, i))}
      </div>
      <div
        class="nbplay-step-grid-row nbplay-step-grid-velocities"
        data-voice=${v}
      >
        <div class="nbplay-step-grid-label">
          ${this.voices.length > 1 ? `VEL${v + 1}` : "VEL"}
        </div>
        ${steps.map(
          (i) =>
            html`<nbplay-bar
              class="nbplay-step-grid-vel ${voice[i]?.active ? "active" : ""} ${i === this.currentStep ? "current" : ""}"
              editable="wheel"
              wheel-step="5"
              .value=${voice[i]?.velocity ?? 0}
              .min=${0}
              .max=${127}
              @input=${(e: Event) => e.stopPropagation()}
              @change=${(e: Event) => this.onVelocity(e, v, i)}
            ></nbplay-bar>`,
        )}
      </div>`;
  }

  private renderCell(step: Step | undefined, v: number, i: number) {
    const s = step ?? { active: false, note: 60, velocity: 100 };
    const pending = this.pending?.voice === v && this.pending?.step === i;
    const cursor = this.cursor?.voice === v && this.cursor?.step === i;
    const classes = [
      "nbplay-step-grid-cell",
      s.active ? "active" : "",
      i === this.currentStep ? "current" : "",
      cursor ? "cursor" : "",
      pending ? "pending" : "",
    ].join(" ");
    const prob = s.probability ?? 1;
    return html`<div
      class=${classes}
      data-voice=${v}
      data-step=${i}
      title="Voice ${v + 1} Step ${i + 1}: ${noteName(s.note)} vel=${s.velocity} prob=${Math.round(prob * 100)}%"
      @click=${() => this.toggle(v, i)}
      @dblclick=${() => this.pick(v, i)}
      @wheel=${(e: WheelEvent) => this.onWheel(e, v, i)}
    >
      ${
        this.editing?.voice === v && this.editing?.step === i
          ? this.renderEditor(v, i)
          : pending
            ? "♪?"
            : noteName(s.note)
      }
    </div>`;
  }

  private renderEditor(v: number, i: number) {
    const stop = (e: Event) => e.stopPropagation();
    return html`<input
      class="nbplay-step-grid-edit"
      type="text"
      aria-label="Note for voice ${v + 1} step ${i + 1}"
      autocomplete="off"
      spellcheck="false"
      @click=${stop}
      @dblclick=${stop}
      @wheel=${stop}
      @input=${stop}
      @change=${stop}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Enter") this.commitEdit(e.target as HTMLInputElement);
        else if (e.key === "Escape") this.editing = null;
      }}
      @blur=${(e: Event) => this.commitEdit(e.target as HTMLInputElement)}
    />`;
  }

  /** Removing the field blurs it, so a commit or cancel clears `editing` first. */
  private commitEdit(input: HTMLInputElement): void {
    const ref = this.editing;
    if (!ref) return;
    this.editing = null;
    const note = parseNoteName(input.value);
    if (note === null) return;
    this.set(ref.voice, ref.step, "note", note);
    this.set(ref.voice, ref.step, "active", true);
  }

  private step(v: number, i: number): Step | undefined {
    return this.voices[v]?.[i];
  }

  private set(v: number, i: number, field: keyof Step, value: unknown): void {
    const step = this.step(v, i);
    if (!step || step[field] === value) return;
    const voices = this.voices.slice();
    const row = voices[v].slice();
    row[i] = { ...step, [field]: value };
    voices[v] = row;
    this.voices = voices;
    this.emitDetail("change", { voice: v, step: i, field, value });
  }

  private toggle(v: number, i: number): void {
    if (this.disabled) return;
    const step = this.step(v, i);
    if (step) this.set(v, i, "active", !step.active);
  }

  private pick(v: number, i: number): void {
    if (this.disabled) return;
    if (this.showArm)
      this.emitDetail("nbplay-step-pick", { voice: v, step: i });
    else this.editing = { voice: v, step: i };
  }

  private onWheel(e: WheelEvent, v: number, i: number): void {
    if (this.disabled) return;
    e.preventDefault();
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    const step = this.step(v, i);
    if (delta === 0 || !step) return;
    this.set(v, i, "note", clampMidiNote(step.note + (delta < 0 ? 1 : -1)));
  }

  private onVelocity(e: Event, v: number, i: number): void {
    e.stopPropagation();
    this.set(v, i, "velocity", (e as CustomEvent).detail?.value as number);
  }

  private onArm(e: Event, v: number): void {
    e.stopPropagation();
    const armed = (e as CustomEvent).detail?.value as boolean;
    this.armed = armed ? [...this.armed, v] : this.armed.filter((x) => x !== v);
    this.emitDetail("nbplay-arm", { voice: v, armed });
  }
}

define("nbplay-step-grid", NbplayStepGrid);
