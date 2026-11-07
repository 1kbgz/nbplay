import { html } from "lit";
import {
  type Channel,
  createAudioBus,
  defaultEffect,
  type MeterLevel,
  type ReturnBus,
  toggleEffectEnabled,
} from "../mixer_bus.ts";
import { NbplayElement, clamp, define } from "./base.ts";
import type { EffectDescriptor } from "./effects.ts";
import type { NbplayMeter } from "./meter.ts";
// Register the elements this one renders, for bundles that import only this module.
import "./header.ts";
import "./strip.ts";

type Scope = "channel" | "return" | "master";

const METER_INTERVAL_MS = 33;

/**
 * `<nbplay-mixer>`: the mixer instrument. A header with add-channel and
 * add-return buttons and a console of `nbplay-strip`s (channels, returns,
 * master). With a `sessionId` it owns the session's Web Audio graph
 * (`mixer_bus.ts`): per-channel gain, pan, insert chain, sends, analysers,
 * return buses and the master chain, registered on the session bus for the
 * other instruments and announced with `nbplay-bus-ready`. Every edit
 * fires `nbplay-set` with the whole `channels`, `returns`, `masterGain` or
 * `masterEffects` value; meters follow the analysers at about 30 fps.
 */
export class NbplayMixer extends NbplayElement {
  // The graph properties use explicit accessors so the audio bus follows a
  // write at once; hosts read the bus right after setting a trait.
  static properties = {
    channels: { attribute: false, noAccessor: true },
    returns: { attribute: false, noAccessor: true },
    masterGain: { type: Number, attribute: "master-gain", noAccessor: true },
    masterEffects: { attribute: false, noAccessor: true },
    sessionId: { type: String, attribute: "session-id", reflect: true },
  };

  declare sessionId: string;

  private graph = {
    channels: [] as Channel[],
    returns: [] as ReturnBus[],
    masterGain: 0.85,
    masterEffects: [] as EffectDescriptor[],
  };
  private bus = createAudioBus();
  private busReady = false;
  private meterFrame: number | null = null;
  private lastMeterMs = 0;

  constructor() {
    super();
    this.sessionId = "";
  }

  get channels(): Channel[] {
    return this.graph.channels;
  }
  set channels(value: Channel[]) {
    this.setGraph("channels", value);
  }
  get returns(): ReturnBus[] {
    return this.graph.returns;
  }
  set returns(value: ReturnBus[]) {
    this.setGraph("returns", value);
  }
  get masterGain(): number {
    return this.graph.masterGain;
  }
  set masterGain(value: number) {
    this.setGraph("masterGain", value);
  }
  get masterEffects(): EffectDescriptor[] {
    return this.graph.masterEffects;
  }
  set masterEffects(value: EffectDescriptor[]) {
    this.setGraph("masterEffects", value);
  }

  private setGraph<K extends keyof NbplayMixer["graph"]>(
    key: K,
    value: NbplayMixer["graph"][K],
  ): void {
    const old = this.graph[key];
    this.graph[key] = value;
    this.requestUpdate(key, old);
    if (this.busReady) this.syncBus();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.classList.add("nbplay-mixer");
    // Keep clicks inside the mixer from moving focus to the notebook, which
    // makes JupyterLab scroll the active cell into view mid-interaction.
    this.tabIndex = 0;
    if (this.sessionId) {
      this.bus.init(this.sessionId);
      this.busReady = true;
      this.syncBus();
      this.bus.register(this.sessionId);
      if (typeof requestAnimationFrame === "function") {
        this.meterFrame = requestAnimationFrame(this.meterTick);
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.meterFrame !== null) cancelAnimationFrame(this.meterFrame);
    this.meterFrame = null;
    this.busReady = false;
    if (this.sessionId) this.bus.destroy(this.sessionId);
  }

  private syncBus(): void {
    this.bus.syncChannels(
      this.channels || [],
      Number(this.masterGain),
      this.masterEffects || [],
      this.returns || [],
    );
  }

  private set(values: Record<string, unknown>): void {
    this.emitDetail("nbplay-set", { values });
  }

  // Meters: peak level per strip from the bus analysers, ~30 fps.

  private applyLevel(strip: Element | null, level: MeterLevel): void {
    if (!strip) return;
    (strip as HTMLElement).dataset.peak = level.peak.toFixed(3);
    const meter = strip.querySelector("nbplay-meter") as NbplayMeter | null;
    if (meter) {
      meter.level = level.peak;
      meter.rms = level.rms;
    }
  }

  private meterTick = (now: number): void => {
    this.meterFrame = requestAnimationFrame(this.meterTick);
    if (now - this.lastMeterMs < METER_INTERVAL_MS || document.hidden) return;
    this.lastMeterMs = now;
    const levels = this.bus.levels();
    if (!levels) return;
    const strips = this.querySelectorAll('nbplay-strip[kind="channel"]');
    levels.channels.forEach((level, i) =>
      this.applyLevel(strips[i] || null, level),
    );
    const returns = this.querySelectorAll('nbplay-strip[kind="return"]');
    levels.returns.forEach((level, k) =>
      this.applyLevel(returns[k] || null, level),
    );
    this.applyLevel(
      this.querySelector('nbplay-strip[kind="master"]'),
      levels.master,
    );
  };

  // Edits

  private updateChannel(index: number, key: string, value: unknown): void {
    const channels = [...(this.channels || [])];
    if (index >= channels.length) return;
    if ((channels[index] as unknown as Record<string, unknown>)[key] === value)
      return;
    channels[index] = { ...channels[index], [key]: value };
    this.channels = channels;
    this.set({ channels });
  }

  private updateReturn(index: number, key: string, value: unknown): void {
    const returns = [...(this.returns || [])];
    if (index >= returns.length) return;
    if ((returns[index] as unknown as Record<string, unknown>)[key] === value)
      return;
    returns[index] = { ...returns[index], [key]: value };
    this.returns = returns;
    this.set({ returns });
  }

  private effectsFor(scope: Scope, index: number): EffectDescriptor[] {
    if (scope === "master") return this.masterEffects || [];
    if (scope === "return") return this.returns?.[index]?.effects || [];
    return this.channels?.[index]?.effects || [];
  }

  private writeEffects(
    scope: Scope,
    index: number,
    effects: EffectDescriptor[],
  ): void {
    if (scope === "master") {
      this.masterEffects = effects;
      this.set({ masterEffects: effects });
    } else if (scope === "return") {
      this.updateReturn(index, "effects", effects);
    } else {
      this.updateChannel(index, "effects", effects);
    }
  }

  private onStripEdit(scope: Scope, index: number, e: Event): void {
    e.stopPropagation();
    const detail = (e as CustomEvent).detail as {
      field: string;
      value: unknown;
      index?: number;
      key?: string;
    };
    if (detail.field === "effect") {
      const fxIndex = detail.index ?? -1;
      const effects = this.effectsFor(scope, index);
      if (detail.key === "enabled") {
        this.writeEffects(
          scope,
          index,
          effects.map((fx, idx) =>
            idx === fxIndex ? toggleEffectEnabled(fx) : fx,
          ),
        );
      } else if (detail.value !== undefined) {
        this.writeEffects(
          scope,
          index,
          effects.map((fx, idx) =>
            idx === fxIndex
              ? { ...fx, [detail.key as string]: detail.value }
              : fx,
          ),
        );
      }
      return;
    }
    if (scope === "master") {
      if (detail.field === "gain" && detail.value !== this.masterGain) {
        this.masterGain = detail.value as number;
        this.set({ masterGain: this.masterGain });
      }
      return;
    }
    if (scope === "return") {
      if (detail.field === "gain")
        this.updateReturn(index, "gain", detail.value);
      return;
    }
    if (detail.field === "send") {
      const current = this.channels?.[index];
      const k = detail.index ?? -1;
      if (!current || k < 0) return;
      const sends = Array.from(
        { length: (this.returns || []).length },
        (_, idx) => clamp(Number(current.sends?.[idx]) || 0, 0, 1),
      );
      sends[k] = clamp(Number(detail.value) || 0, 0, 1);
      this.updateChannel(index, "sends", sends);
      return;
    }
    this.updateChannel(index, detail.field, detail.value);
  }

  private onEffectAdd(scope: Scope, index: number, e: Event): void {
    e.stopPropagation();
    const type = (e as CustomEvent).detail.type as string;
    this.writeEffects(scope, index, [
      ...this.effectsFor(scope, index),
      defaultEffect(type),
    ]);
  }

  private onEffectRemove(scope: Scope, index: number, e: Event): void {
    e.stopPropagation();
    const fxIndex = (e as CustomEvent).detail.index as number;
    this.writeEffects(
      scope,
      index,
      this.effectsFor(scope, index).filter((_, idx) => idx !== fxIndex),
    );
  }

  addChannel(): void {
    const channels = [...(this.channels || [])];
    channels.push({
      name: "Ch " + (channels.length + 1),
      gain: 0.8,
      pan: 0.0,
      mute: false,
      solo: false,
      effects: [],
    });
    this.channels = channels;
    this.set({ channels });
  }

  removeChannel(index: number): void {
    const channels = [...(this.channels || [])];
    channels.splice(index, 1);
    this.channels = channels;
    this.set({ channels });
  }

  addReturn(): void {
    const returns = this.returns || [];
    const next = [
      ...returns,
      { name: `Return ${returns.length + 1}`, gain: 0.8, effects: [] },
    ];
    const channels = (this.channels || []).map((ch) => ({
      ...ch,
      sends: [
        ...Array.from({ length: returns.length }, (_, k) =>
          clamp(Number(ch.sends?.[k]) || 0, 0, 1),
        ),
        0,
      ],
    }));
    this.returns = next;
    this.channels = channels;
    this.set({ returns: next, channels });
  }

  /** Drop a return bus and every channel's send to it. */
  removeReturn(index: number): void {
    const returns = (this.returns || []).filter((_, k) => k !== index);
    const channels = (this.channels || []).map((ch) => ({
      ...ch,
      sends: (ch.sends || []).filter((_, k) => k !== index),
    }));
    this.returns = returns;
    this.channels = channels;
    this.set({ returns, channels });
  }

  render() {
    const channels = this.channels || [];
    const returns = this.returns || [];
    const sendNames = returns.map((r) => r.name);
    const strip = (
      scope: Scope,
      index: number,
      cls: string,
      props: {
        name: string;
        gain: number;
        pan?: number;
        mute?: boolean;
        solo?: boolean;
        sends?: number[];
        effects?: EffectDescriptor[];
      },
    ) =>
      html`<nbplay-strip
        class=${cls}
        kind=${scope}
        data-index=${index}
        .name=${props.name}
        .gain=${props.gain}
        .pan=${props.pan ?? 0}
        .mute=${Boolean(props.mute)}
        .solo=${Boolean(props.solo)}
        .sends=${props.sends ?? []}
        .sendNames=${scope === "channel" ? sendNames : []}
        .effects=${props.effects ?? []}
        @input=${(e: Event) => this.onStripEdit(scope, index, e)}
        @change=${(e: Event) => this.onStripEdit(scope, index, e)}
        @nbplay-effect-add=${(e: Event) => this.onEffectAdd(scope, index, e)}
        @nbplay-effect-remove=${(e: Event) => this.onEffectRemove(scope, index, e)}
        @nbplay-remove=${(e: Event) => {
          e.stopPropagation();
          if (scope === "channel") this.removeChannel(index);
          else if (scope === "return") this.removeReturn(index);
        }}
      ></nbplay-strip>`;
    return html`<nbplay-header badge="mixer">
        <button
          type="button"
          class="nbplay-mixer-add-btn"
          title="Add channel"
          @click=${() => this.addChannel()}
        >
          + Channel
        </button>
        <button
          type="button"
          class="nbplay-mixer-add-return-btn"
          title="Add return bus"
          @click=${() => this.addReturn()}
        >
          + Return
        </button>
      </nbplay-header>
      <div class="nbplay-mixer-console">
        ${channels.map((ch, i) =>
          strip("channel", i, "nbplay-mixer-strip", {
            name: ch.name,
            gain: ch.gain,
            pan: ch.pan,
            mute: ch.mute,
            solo: ch.solo,
            sends: returns.map((_, k) =>
              clamp(Number(ch.sends?.[k]) || 0, 0, 1),
            ),
            effects: ch.effects,
          }),
        )}
        ${returns.map((ret, k) =>
          strip("return", k, "nbplay-mixer-strip nbplay-return-strip", {
            name: ret.name,
            gain: ret.gain,
            effects: ret.effects,
          }),
        )}
        ${strip("master", -1, "nbplay-mixer-strip nbplay-master-strip", {
          name: "Master",
          gain: Number(this.masterGain),
          effects: this.masterEffects,
        })}
      </div>`;
  }
}

define("nbplay-mixer", NbplayMixer);
