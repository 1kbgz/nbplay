# DESIGN.md — nbplay Widget Design System

This document describes the visual and structural conventions shared across all nbplay widgets. Follow these patterns when creating new widgets or modifying existing ones.

---

## CSS Architecture

### Theme Integration

All colors use JupyterLab CSS custom properties (`--jp-*`) with dark-theme fallbacks:

```css
var(--jp-layout-color0, #0f0f1a)   /* deepest background */
var(--jp-layout-color1, #1a1a2e)   /* raised surface */
var(--jp-border-color0, #2d2d4a)   /* subtle border */
var(--jp-border-color1, #1e1e3a)   /* standard border */
var(--jp-ui-font-color0, #e0e4f0)  /* primary text */
var(--jp-ui-font-color2, #8888aa)  /* muted/label text */
var(--jp-brand-color1, #00d4ff)    /* accent cyan */
```

**Rule:** Never hard-code hex colors in CSS or TypeScript. Always use `var(--jp-*, fallback)` in CSS or `cssVar(el, "--jp-*", fallback)` in canvas drawing code.

### Scoping

Every widget has a unique root class. All selectors must be scoped under it to prevent leaking into the host notebook.

| Widget | Root class |
|---|---|
| SynthWidget | `.nbplay-synth` |
| MixerWidget | `.nbplay-mixer` |
| SamplerWidget | `.nbplay-sampler` |
| SequencerWidget | `.nbplay-sequencer` |
| SettingsWidget | `.nbplay-settings` |
| TransportWidget | `.nbplay-transport` |
| KeyboardWidget | `.nbplay-keyboard` |

### Semi-Transparent Colors

Use `color-mix()` instead of `rgba()`:

```css
/* ✓ correct */
background: color-mix(in srgb, var(--jp-brand-color1) 20%, transparent);

/* ✗ wrong — hard-coded alpha */
background: rgba(0, 212, 255, 0.2);
```

### File Organization

One CSS file per widget in `js/src/css/` (e.g., `widget.css`, `mixer.css`, `keyboard.css`). Processed by `lightningcss` which supports nesting, `color-mix`, and custom properties. The base `widget.css` defines the global `.nbplay-badge` rule; each widget overrides it under its own scope.

---

## Root Container

Common properties across all widget root elements:

| Property | Standard value | Notes |
|---|---|---|
| `font-family` | `var(--jp-ui-font-family, sans-serif)` | |
| `background` | `var(--jp-layout-color0, #0f0f1a)` | Mixer/Settings use `layout-color1` |
| `color` | `var(--jp-ui-font-color0, #e0e4f0)` | |
| `border` | `1px solid var(--jp-border-color1, #1e1e3a)` | |
| `border-radius` | `12px` | Mixer/Settings: `10px`, Transport: `8px` |
| `padding` | `16px` – `20px` | |
| `user-select` | `none` | All widgets |

Optional: `box-shadow: var(--jp-elevation-z4, 0 4px 24px rgba(0, 0, 0, 0.5))` for widgets that benefit from depth (Synth, Keyboard).

---

## Header and Badge

### Header HTML

```html
<div class="nbplay-WIDGET-header">
  <h3>nbplay</h3>
  <span class="nbplay-badge">WIDGET</span>
</div>
```

All widgets except TransportWidget include a header with the `nbplay` title and a colored badge.

### Header Styling

```css
.nbplay-WIDGET-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px; /* 12–16px */
}
.nbplay-WIDGET-header h3 {
  margin: 0;
  font-size: 16px;    /* 15–16px */
  font-weight: 700;
  color: var(--jp-ui-font-color0, #e0e4f0);
  letter-spacing: -0.5px;
}
```

### Badge

Each widget has a unique badge color. The badge text is lowercase in HTML but rendered uppercase via CSS.

| Widget | Background | Text color |
|---|---|---|
| Synth | `var(--jp-brand-color1, #00d4ff)` | `var(--jp-layout-color0, #000)` |
| Mixer | `var(--jp-error-color1, #ef4444)` | `var(--jp-ui-inverse-font-color0, #fff)` |
| Sequencer | `var(--jp-brand-color0, #7c3aed)` | `var(--jp-ui-inverse-font-color0, #fff)` |
| Sampler | `var(--jp-success-color1, #22c55e)` | `var(--jp-layout-color0, #000)` |
| Settings | `var(--jp-warn-color1, #f97316)` | `var(--jp-layout-color0, #000)` |
| Keyboard | `var(--jp-info-color1, #3b82f6)` | `var(--jp-ui-inverse-font-color0, #fff)` |
| Transport | *(no badge)* | — |

**Badge CSS pattern:**

```css
.nbplay-WIDGET .nbplay-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: <color>;
  color: <text-color>;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}
```

The base rule in `widget.css` uses `border-radius: 10px` and `font-weight: 700`; scoped overrides use `999px` (pill) and `600`.

---

## Typography

| Context | Size | Weight | Extras |
|---|---|---|---|
| Widget title (h3) | 15–16px | 700 | `letter-spacing: -0.5px` |
| Badge | 10px | 600–700 | `text-transform: uppercase; letter-spacing: 0.5–1px` |
| Section title | 11px | 700 | `text-transform: uppercase; letter-spacing: 1.2px` |
| Labels | 10–11px | 600 | `text-transform: uppercase; letter-spacing: 0.8px; color: --jp-ui-font-color2` |
| Button text | 12–13px | 500–600 | |
| Value readouts | 10–12px | 600 | `font-variant-numeric: tabular-nums` |

---

## Buttons

### Selection Buttons (Oscillator Type, etc.)

```css
font-size: 12px;
font-weight: 500;
padding: 6px 14px;
border: 1px solid var(--jp-border-color1);
background: var(--jp-layout-color1);
color: var(--jp-ui-font-color2);
border-radius: 6px;
cursor: pointer;
transition: all 0.15s ease;
```

**Active state:**

```css
background: color-mix(in srgb, var(--jp-brand-color1) 20%, var(--jp-layout-color1));
border-color: var(--jp-brand-color1);
color: var(--jp-ui-font-color0);
box-shadow: 0 0 12px color-mix(in srgb, var(--jp-brand-color1) 15%, transparent);
```

### Play/Stop Button

```css
font-size: 13px;
font-weight: 600;
padding: 8px 22px;
border: none;
border-radius: 8px;
background: linear-gradient(135deg, var(--jp-brand-color0), var(--jp-brand-color1));
color: var(--jp-ui-inverse-font-color0, #fff);
```

Playing state swaps to error/warn gradient:

```css
background: linear-gradient(135deg, var(--jp-error-color1), var(--jp-warn-color1));
```

### Icon Buttons (Transport Controls, etc.)

```css
width: 36px;
height: 36px;
border: 1px solid var(--jp-border-color1);
border-radius: 6px–8px;
background: var(--jp-layout-color1);
color: var(--jp-ui-font-color2);
font-size: 16px;
```

Hover: `border-color` and `color` shift to brand color.

---

## Sliders / Range Inputs

### Horizontal (Frequency, BPM, etc.)

```css
input[type="range"] {
  height: 4px;
  appearance: none;
  background: var(--jp-border-color1);
  border-radius: 2px;
}
/* Thumb */
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--jp-brand-color1, #00d4ff);
  border: 2px solid var(--jp-layout-color0);
  box-shadow: 0 0 8px color-mix(in srgb, var(--jp-brand-color1) 40%, transparent);
```

### Vertical Fader (Mixer)

```css
writing-mode: vertical-lr;
direction: rtl;
width: 28px;
height: 100%;
/* Thumb: 20px wide × 8px tall */
```

---

## Sections and Control Groups

### Section Container (Settings-style)

```css
background: var(--jp-layout-color1);
border: 1px solid var(--jp-border-color0);
border-radius: 8px;
padding: 12px 14px;
margin-bottom: 10px;
```

### Section Title

```css
font-size: 11px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 1.2px;
color: var(--jp-ui-font-color2);
margin-bottom: 10px;
```

### Control Rows

```css
display: flex;
align-items: center;
gap: 10px–12px;
margin-bottom: 8px–12px;
```

---

## Inline Editing

Double-click-to-edit pattern (used in mixer gain, sampler pads, sequencer steps, transport BPM):

```css
font-family: inherit;
font-size: 10–12px;
font-variant-numeric: tabular-nums;
background: var(--jp-layout-color1);
color: var(--jp-brand-color1);
border: 1px solid var(--jp-brand-color1);
border-radius: 4px;
padding: 1px 4px;
outline: none;
text-align: right;
```

Implemented via the `makeEditable()` helper from `helpers.ts`. Includes a commit guard to prevent Enter + blur race conditions.

---

## Focus Rings

For focusable widgets (Keyboard):

```css
.nbplay-WIDGET:focus {
  border-color: var(--jp-brand-color1);
  box-shadow:
    var(--jp-elevation-z4),
    0 0 0 2px color-mix(in srgb, var(--jp-brand-color1) 30%, transparent);
}
```

For select/input elements:

```css
border-color: var(--jp-brand-color3);
box-shadow: 0 0 0 2px color-mix(in srgb, var(--jp-brand-color3) 15%, transparent);
```

---

## Canvas Drawing

Waveform and envelope canvas rendering:

- Read theme colors via `cssVar(canvas, "--jp-*", fallback)` from `helpers.ts`
- Scale for HiDPI: `ctx.scale(devicePixelRatio, devicePixelRatio)`
- Smooth curves: `ctx.lineJoin = "round"`, `ctx.lineCap = "round"`
- Grid lines: dashed with `ctx.setLineDash([4, 4])`
- Background: `--jp-layout-color0`
- Waveform stroke: `--jp-brand-color1`
- Grid/dim: `--jp-ui-font-color3`
- ADSR fill: subtle accent via `color-mix`

---

## Transitions

Standard animation duration across all interactive elements:

```css
transition: all 0.15s ease;
```

---

## TypeScript Widget Patterns

### Render / Export

Every widget exports a single `render` function:

```typescript
function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  // 1. Create DOM
  // 2. Set up event listeners and model observers
  // 3. Sync initial state
  // 4. Return cleanup function
}

export default { render };
```

### Model Trait Sync

```typescript
// Read
const freq = model.get("frequency") as number;

// Write (local only — no comm message)
model.set("frequency", 440);

// Write + send to kernel
model.set("frequency", 440);
model.save_changes();
```

**Critical rule:** During `render()`, call `model.set()` for state resets (e.g., `is_playing = false`) but **never** call `model.save_changes()`. Comm messages during render race with Session `dlink` initialization.

### Save Patterns

| Interaction | When to save |
|---|---|
| Button click | Immediately after `model.set()` |
| Slider drag | On `pointerup`, not on every `input` event |
| Inline edit | After the user commits (Enter/blur) |
| Tick-based position | Never — use `model.set()` only to avoid flooding |

### Cleanup

The function returned from `render()` must clean up:

- Stop `setInterval` / `setTimeout` timers
- Call `audio.destroy()` or `audioCtx.close()` on owned audio contexts
- Unregister from session bus
- Remove global event listeners

---

## Session Bus

The `Session` class assigns a `session_id`. The `MixerWidget` creates the Web Audio graph and registers it at `globalThis.__nbplay[sessionId]`:

```typescript
interface NbplayBus {
  audioCtx: AudioContext;
  channels: Array<{ gain: GainNode; panner: StereoPannerNode }>;
  noteListeners?: Array<(evt: NoteEvent) => void>;
  samplers?: Record<number, { triggerNote: Function; releaseNote: Function }>;
}
```

Other widgets (Sequencer, Sampler, Keyboard) look up the bus by `session_id` and `channel_index` to route audio through the mixer.

---

## Audio Scheduling

The sequencer uses a **lookahead scheduler**: a `setInterval` every 25ms schedules notes up to 100ms ahead using `AudioContext.currentTime`. This avoids JavaScript event-loop jitter.

The transport runs a 50ms position clock using elapsed `AudioContext.currentTime` with modulo arithmetic for loop wrapping.
