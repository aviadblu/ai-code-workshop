# Phase 8: Gaming UI Theme - Research

**Researched:** 2026-03-15
**Domain:** Pure CSS / inline-style theming for React + Vite app — no new dependencies
**Confidence:** HIGH

---

## Summary

Phase 8 applies a Call of Duty–style military HUD aesthetic to an already-working React 19 / Vite 8
dashboard. The constraint is strict: **no new dependencies**. Every effect — scanlines, glow, pulse
animation, monospace font — must be achieved with CSS custom properties, `@keyframes`, and inline
styles that are already the project's idiom. This is a pure restyling phase; all functional logic
(Zustand subscriptions, virtual list, canvas rAF loop) remains untouched.

The central challenge is the amber pulse animation on live-updating values. Because the values come
from Zustand and re-render the React component on each tick, the animation must re-trigger on each
render without requiring a `key` change on every element. The correct pattern is a CSS animation
that runs once per class application, combined with React's `useRef` + `key` trick or a dedicated
`useChangePulse` hook that bumps a counter whenever the value changes.

The second challenge is keeping all existing tests green. Tests make colour assertions using
`rgb()` notation (jsdom normalises hex). Any restyling that changes inline `color` or
`backgroundColor` of elements directly checked by tests will break them. The plan must audit every
colour assertion and ensure the new theme either preserves those exact colours (for functional
colours like health bars) or avoids touching elements whose colours are tested.

**Primary recommendation:** Establish all design tokens as CSS custom properties in `index.css`
`:root`, load the Google Font via `index.html` `<link>`, apply the scanline texture as a single
shared CSS class (`.hud-panel`), and confine the amber pulse to a named `@keyframes` animation
triggered by a React `key` prop on the value span.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Global dark military theme: `#0a0a0a` bg, `#00ff41` accent, `#ff8c00` warning, `'Share Tech Mono', monospace` font, CSS custom properties at `:root` | CSS custom props section; Google Fonts `@import` or `index.html` `<link>`; App.tsx needs `background: var(--bg)` and `fontFamily: var(--font-mono)` |
| UI-02 | All panels: 1px military-green border, scanline CSS texture, glow on live values, ALLCAPS labels | `.hud-panel` class in `index.css`; scanline via `repeating-linear-gradient`; `box-shadow` glow; `text-transform: uppercase` |
| UI-03 | KPI bar as tactical readout — bordered inset cells per metric, team-coloured alpha/bravo, amber pulse animation on change | Each KPI metric wrapped in its own cell `div`; `useRef` + `key` pattern to retrigger `@keyframes amberPulse`; `var(--alpha)` / `var(--bravo)` colours |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS custom properties (native) | CSS Level 4 | Design token system — all colours/fonts in one place | Zero deps; supported in all modern browsers; composable with inline styles |
| `@keyframes` (native CSS) | CSS Level 3 | Pulse/glow animations | The only way to do repeating animations without JS timers |
| Google Fonts — Share Tech Mono | N/A | Monospace military-terminal typeface | Required by UI-01; free; loaded via `<link>` in `index.html` for speed |
| `repeating-linear-gradient` (native CSS) | CSS Level 3 | Scanline horizontal-stripe texture | Creates the CRT scanline effect with no images or SVGs |

### No New npm Dependencies
The phase description explicitly forbids new dependencies. Pure CSS + inline styles are the stack.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `@keyframes` pulse | JS `setTimeout` + state toggle | JS approach triggers React re-render and is measurably slower at 1Hz updates |
| Google Fonts `<link>` in index.html | `@import` in index.css | `<link>` has better loading performance (parallel fetch); both are functionally identical for dev |
| CSS class `.hud-panel` | Shared inline style object | Class is cleaner (single source of truth); inline object requires import into every component |

**Installation:**
```bash
# No new packages needed — pure CSS
```

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
client/
├── index.html          # ADD: Google Fonts <link> preconnect + stylesheet
└── src/
    ├── index.css       # ADD: :root custom properties + @keyframes + .hud-panel class
    ├── App.tsx         # MODIFY: apply var(--bg), var(--font-mono), dark layout
    └── components/
        ├── KPIBar.tsx         # MODIFY: cells layout, pulse animation on value change
        ├── UnitsPanel.tsx     # MODIFY: .hud-panel border, ALLCAPS labels
        ├── EventFeed.tsx      # MODIFY: .hud-panel border, ALLCAPS label
        ├── TacticalMap.tsx    # MODIFY: legend overlay HUD style
        └── PerformancePanel.tsx  # MODIFY: .hud-panel border, button/label styles
```

### Pattern 1: CSS Custom Properties at :root

**What:** Define all design tokens once in `index.css` `:root`. Components reference `var(--token)`
in inline styles, ensuring a single change point for the entire theme.

**When to use:** Always — this is the foundation of UI-01.

```css
/* Source: MDN CSS Custom Properties */
:root {
  --bg:        #0a0a0a;
  --panel-bg:  #0d0d0d;
  --accent:    #00ff41;       /* military green */
  --warning:   #ff8c00;       /* amber */
  --alpha:     #3b82f6;       /* blue — team Alpha (PRESERVE: existing test colour) */
  --bravo:     #ef4444;       /* red  — team Bravo (PRESERVE: existing test colour) */
  --destroyed: #6b7280;       /* grey (PRESERVE: existing test colour) */
  --border:    1px solid #00ff41;
  --font-mono: 'Share Tech Mono', monospace;
  --scanline-opacity: 0.03;
}
```

### Pattern 2: Shared HUD Panel Class (.hud-panel)

**What:** A CSS class applied to every panel's outermost `<div>` providing the 1px military-green
border and scanline texture. Components still use inline styles for dynamic values (colours that
depend on data).

**When to use:** Every panel container: KPIBar, UnitsPanel, EventFeed, TacticalMap wrapper,
PerformancePanel.

```css
/* Source: MDN repeating-linear-gradient, box-shadow */
.hud-panel {
  background-color: var(--panel-bg);
  border: var(--border);
  position: relative;
}

/* Scanline overlay via ::before pseudo-element (avoids disrupting layout children) */
.hud-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 255, 65, var(--scanline-opacity)) 2px,
    rgba(0, 255, 65, var(--scanline-opacity)) 4px
  );
  pointer-events: none;
  z-index: 0;
}

/* Ensure children render above the scanline overlay */
.hud-panel > * {
  position: relative;
  z-index: 1;
}
```

**Alternative scanline (simpler, no z-index management):**
```css
/* Applied directly to panel background — no ::before needed */
.hud-panel {
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 255, 65, 0.03) 2px,
    rgba(0, 255, 65, 0.03) 4px
  );
}
```
The simpler `background-image` approach is recommended — it does not require z-index management
and cannot obscure child content.

### Pattern 3: Amber Pulse Animation on Value Change

**What:** When a numeric value changes (on each tick), briefly flash it with an amber glow. The
animation runs once and stops. It must retrigger on the next change.

**When to use:** KPI bar metric values (UI-03); any live-updating numeric (can be extended to
PerformancePanel in the component restyling plan).

**The key insight:** CSS animations only replay when the element is *removed and re-added* to the
DOM, OR when the animation name changes. In React, changing an element's `key` prop forces a
remount. Using `key={renderCount}` where `renderCount` increments each render achieves this
cheaply.

```css
/* Source: MDN @keyframes, animation */
@keyframes amberPulse {
  0%   { color: var(--warning); text-shadow: 0 0 8px var(--warning); }
  60%  { color: var(--warning); text-shadow: 0 0 4px var(--warning); }
  100% { color: inherit; text-shadow: none; }
}

.pulse-value {
  animation: amberPulse 0.6s ease-out forwards;
}
```

```tsx
// In KPIBar.tsx — useRef counter that increments on each render
// Since KPIBar re-renders every tick (units Map ref changes), renderCount
// increments every tick, forcing the key to change and re-triggering animation.
import { useRef } from 'react'

function PulsingValue({ value, style }: { value: React.ReactNode; style?: React.CSSProperties }) {
  const renderCount = useRef(0)
  renderCount.current += 1
  return (
    <span key={renderCount.current} className="pulse-value" style={style}>
      {value}
    </span>
  )
}
```

**Why `key` on span works:** React unmounts the old span and mounts a new one, which starts the
CSS animation from 0% on every tick. This is the idiomatic pattern — no `setTimeout`, no
`useState` animation flag, no JS overhead.

### Pattern 4: Google Font Loading in index.html

**What:** Add a `<link rel="preconnect">` and `<link rel="stylesheet">` for Share Tech Mono in
`index.html`. Then reference it in `:root` custom properties.

**When to use:** This is the approach required by UI-01 since there is no `index.css` `@import`
currently and Vite handles the HTML directly.

```html
<!-- client/index.html — in <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap"
  rel="stylesheet"
/>
```

Then in CSS:
```css
:root {
  --font-mono: 'Share Tech Mono', monospace;
}
```

And in `App.tsx`:
```tsx
<div style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg)', minHeight: '100vh', ... }}>
```

**Important:** The `vitest` test environment (jsdom) does not load Google Fonts; it falls back to
the system monospace. This is safe — no test assertion checks `fontFamily`. The font is a visual
concern only.

### Pattern 5: KPI Bar Bordered Inset Cells (UI-03)

**What:** Each KPI metric gets its own bordered `<div>` acting as an "inset cell" — a recessed
display reminiscent of military HUD readouts.

**When to use:** KPIBar restyling per UI-03.

```tsx
// Cell style constant (pure object, no import)
const CELL_STYLE: React.CSSProperties = {
  border: '1px solid var(--accent)',
  padding: '4px 12px',
  background: 'rgba(0,255,65,0.04)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  minWidth: 90,
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--accent)',
  letterSpacing: '0.1em',
  // ALLCAPS applied via textTransform or hardcoded uppercase string
  textTransform: 'uppercase',
}
```

### Anti-Patterns to Avoid

- **Touching functional colour values in UnitsPanel rows:** The test `UNITS-03-c` asserts exact
  `rgb()` values for health bar colours (`#22c55e`, `#eab308`, `#ef4444`). These must not change.
- **Touching EventFeed row `color` style:** Tests `EVENTS-01-b/c/d` assert exact `rgb()` values
  for attack/destroyed/capture colours. Do not change `EVENT_COLOURS` constants.
- **Touching PerformancePanel metric value `color` style:** `PerformancePanel.test.tsx` asserts
  exact `rgb()` colours for `thresholdColour()` results. Do not change `thresholdColour()`.
- **Wrapping event rows or health bars in extra elements:** Tests use `.closest('[style]')` to
  find the styled ancestor. Adding a wrapper `div` with a `style` prop between the text and the
  row `div` may break `EVENTS-01-b/c/d`.
- **Applying animation via inline `style` object reference that re-creates each render:** An
  inline `style={{ animation: 'amberPulse 0.6s' }}` does NOT retrigger the animation on re-render
  because React reuses the DOM node. Use the `key` prop pattern instead.
- **Using `::before` scanlines without `pointer-events: none`:** The pseudo-element will intercept
  click events on the panel, breaking filter interactions in UnitsPanel.
- **Changing `border` on existing elements where tests count elements via querySelectorAll:**
  Unlikely but worth noting — UnitsPanel test uses `document.querySelectorAll('[style]')` to find
  health bars. Adding more `style`-bearing wrapper divs may increase the count unexpectedly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retrigger CSS animation on React state change | Custom JS animation system | `key` prop increment pattern | CSS handles the timing; key forces remount; zero runtime overhead |
| Scanline texture | PNG/SVG asset | `repeating-linear-gradient` in CSS | No network request; scales perfectly; zero bundle size |
| Design token system | JS constants object | CSS custom properties at `:root` | Composable with `calc()`; accessible in pseudo-elements; browser-native |
| Font loading | Bundling the font | Google Fonts `<link>` | Cached across sites; zero bundle size; instant setup |

**Key insight:** Everything in this phase is a presentation concern. CSS is the right tool.
The only React-specific pattern needed is the `key` trick for animation retriggering.

---

## Common Pitfalls

### Pitfall 1: CSS Animation Doesn't Retrigger on Re-render

**What goes wrong:** Developer adds `animation: amberPulse 0.6s` via inline style. The first
render plays the animation. Subsequent renders do not retrigger it because React reuses the same
DOM node and the `style` object reference is identical.

**Why it happens:** CSS animations fire when an element's animation property is *first applied*
(or when the element is re-inserted into the DOM). Updating the same element's inline style with
the same animation string does nothing.

**How to avoid:** Use `key={renderCount.current}` on the value span. Each tick increments the
counter, React sees a new key, remounts the span, and the animation fires from 0%.

**Warning signs:** Animation plays once on load and never again.

---

### Pitfall 2: Breaking Existing Colour Assertions in Tests

**What goes wrong:** Restyling changes the `color` or `backgroundColor` of elements that have
existing inline styles used in test assertions. All colour tests use `rgb()` format (jsdom
normalises hex).

**Why it happens:** The theme introduces new CSS classes, but if a wrapper div in the component
JSX is given a `style={{ color: 'var(--accent)' }}`, the test's `.closest('[style]')` selector
may match that wrapper instead of the intended element.

**How to avoid:**
- Preserve ALL existing inline `color` values on elements directly tested:
  - `EVENT_COLOURS` in EventFeed.tsx — do not change
  - `healthColour()` in UnitsPanel.tsx — do not change
  - `thresholdColour()` in PerformancePanel.tsx — do not change
- Use CSS classes (`.hud-panel`) for structural theming, not inline styles that might interfere
- Add new wrapper elements only when they do NOT sit between tested text nodes and their styled
  ancestor (checked via `.closest('[style]')`)

**Warning signs:** `EVENTS-01-b/c/d` or `UNITS-03-c` or `PerformancePanel` colour tests fail.

---

### Pitfall 3: `var()` in Inline Styles — jsdom vs Browser

**What goes wrong:** `style={{ color: 'var(--accent)' }}` works in the real browser (CSS engine
resolves custom properties) but jsdom does NOT resolve CSS custom properties in inline styles.
Tests that assert `element.style.color === 'var(--accent)'` will pass, but tests asserting a
specific colour like `'rgb(0, 255, 65)'` will fail because jsdom sees the literal string
`var(--accent)`, not the resolved value.

**Why it happens:** jsdom does not implement CSS cascade resolution for custom properties in inline
styles.

**How to avoid:**
- Use `var()` references freely in inline styles for visual elements that are NOT colour-tested
- For elements whose colours ARE tested (event rows, health bars, perf metrics), continue using
  literal hex values (the current pattern) — do not convert these to `var()` references
- For KPI bar team colours specifically (UI-03), use literal hex `'#3b82f6'` and `'#ef4444'`
  in inline styles rather than `var(--alpha)` and `var(--bravo)` if tests assert these colours

**Warning signs:** KPI bar cell colour tests fail with `'var(--alpha)'` instead of `'rgb(59, 130, 246)'`

---

### Pitfall 4: Scanline z-index Obscures Interactive Elements

**What goes wrong:** Using `::before` pseudo-element for scanlines creates a stacking context.
If `pointer-events` is not `none`, the pseudo-element intercepts mouse clicks, breaking
UnitsPanel dropdown and slider interactions.

**How to avoid:** Use `background-image: repeating-linear-gradient(...)` directly on `.hud-panel`
instead of `::before`. No z-index management needed.

---

### Pitfall 5: `index.css` Not Imported in the Project

**What goes wrong:** `index.css` does not currently exist (the file-read returned "does not
exist"). The `:root` custom properties and `@keyframes` will not be available if the CSS file
is not imported.

**How to avoid:**
1. Create `client/src/index.css` with all theme tokens and animations
2. Import it in `client/src/main.tsx` (the Vite entry point) — e.g. `import './index.css'`

Check `main.tsx` to confirm the import path. The `.hud-panel` class and `@keyframes` will not
work at all until the file is imported.

---

## Code Examples

### Complete :root Token Block

```css
/* client/src/index.css */
/* Source: CSS Custom Properties spec — MDN */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  /* Colours */
  --bg:           #0a0a0a;
  --panel-bg:     #0d0d0d;
  --accent:       #00ff41;
  --warning:      #ff8c00;
  --alpha-colour: #3b82f6;
  --bravo-colour: #ef4444;
  --text-primary: #c8ffc8;
  --text-muted:   #5a7a5a;
  --border:       1px solid #00ff41;

  /* Typography */
  --font-mono: 'Share Tech Mono', monospace;
  --font-size-base: 13px;
  --font-size-label: 10px;

  /* Scanline */
  --scanline-stripe: rgba(0, 255, 65, 0.03);
}

body {
  background: var(--bg);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
}

/* Shared HUD panel style */
.hud-panel {
  border: var(--border);
  background-color: var(--panel-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    var(--scanline-stripe) 2px,
    var(--scanline-stripe) 4px
  );
  padding: 8px;
}

/* Amber pulse animation for live values */
@keyframes amberPulse {
  0%   { color: var(--warning); text-shadow: 0 0 10px var(--warning), 0 0 20px rgba(255, 140, 0, 0.4); }
  70%  { color: var(--warning); text-shadow: 0 0 5px var(--warning); }
  100% { color: inherit; text-shadow: none; }
}

.pulse-value {
  animation: amberPulse 0.8s ease-out forwards;
  display: inline-block;
}

/* Section labels — ALLCAPS */
.hud-label {
  text-transform: uppercase;
  font-size: var(--font-size-label);
  letter-spacing: 0.12em;
  color: var(--text-muted);
}
```

---

### KPI Cell Pattern

```tsx
// Source: Requirements UI-03 — each metric in bordered inset cell
// Note: PulsingValue uses key trick to retrigger animation each tick

const CELL: React.CSSProperties = {
  border: '1px solid #00ff41',
  background: 'rgba(0,255,65,0.03)',
  padding: '4px 10px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minWidth: 80,
  gap: 2,
}

// In KPIBar return JSX:
<div style={{ display: 'flex', gap: 8, padding: '6px 8px' }} className="hud-panel">
  <div style={CELL}>
    <span className="hud-label">Alpha</span>
    <PulsingValue value={kpi.alphaAlive} style={{ color: '#3b82f6' }} />
  </div>
  <div style={CELL}>
    <span className="hud-label">Bravo</span>
    <PulsingValue value={kpi.bravoAlive} style={{ color: '#ef4444' }} />
  </div>
  {/* ... etc */}
</div>
```

---

### App.tsx Layout Update

```tsx
// Apply global background and font to the root div
<div style={{
  fontFamily: 'var(--font-mono)',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  minHeight: '100vh',
  padding: '1rem',
}}>
  <h1 style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '1rem' }}>
    War Room Control
  </h1>
  {/* ... rest of layout */}
</div>
```

---

### TacticalMap Legend Overlay Update

```tsx
// Legend div in TacticalMap — replace rgba(0,0,0,0.6) backdrop with HUD style
<div style={{
  position: 'absolute', bottom: 8, left: 8,
  border: '1px solid #00ff41',
  background: 'rgba(0,0,0,0.8)',
  color: '#c8ffc8',
  padding: '4px 8px',
  fontSize: '10px',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.08em',
  display: 'flex',
  gap: 12,
}}>
  <span><span style={{ color: '#3b82f6' }}>■</span> ALPHA</span>
  <span><span style={{ color: '#ef4444' }}>■</span> BRAVO</span>
  <span><span style={{ color: '#6b7280' }}>■</span> KIA</span>
  <span style={{ color: '#5a7a5a' }}>ZONE = CONTROL</span>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JS animation with `setTimeout` + state | CSS `@keyframes` + `key` prop remount | CSS animations standard since ~2013; key pattern idiomatic in React hooks era | No JS timer overhead; no extra renders |
| Google Fonts via `@import` in CSS | `<link rel="preconnect">` + `<link>` in HTML | Performance best practice current in 2024 | Parallel font preconnect; faster FOIT |
| Inline style objects per component | CSS custom properties at `:root` + classes | CSS custom props supported since 2017; fully baseline | Single source of truth; composable with pseudo-elements |

**Deprecated/outdated:**
- Sass/Less variables for theming: replaced by CSS custom properties in modern workflows
- CSS-in-JS libraries (styled-components) for this project: explicitly excluded by project constraints

---

## Open Questions

1. **Does `client/src/main.tsx` already import any CSS file?**
   - What we know: `index.css` does not exist yet; `main.tsx` not read
   - What's unclear: whether there is an existing import statement to update vs. a new one to add
   - Recommendation: Plan 08-01 should start by reading `main.tsx` and adding the import if absent

2. **PulsingValue component location**
   - What we know: the pulse pattern needs a small helper
   - What's unclear: whether it lives in `KPIBar.tsx` inline, or in a shared `components/ui/PulsingValue.tsx`
   - Recommendation: keep it inline in `KPIBar.tsx` for Phase 8 (YAGNI); no new files needed for this

3. **CSS `var()` resolution in jsdom for `background-image`**
   - What we know: jsdom does not resolve custom properties in inline styles
   - What's unclear: whether `background-image` with `var()` inside `.hud-panel` CSS class is safe
   - Recommendation: it IS safe — CSS class properties are applied via stylesheet, not inline
     style, and tests do not assert `backgroundImage`; jsdom parsing of CSS files via Vite is
     irrelevant in the jsdom test environment anyway (no CSS is executed in vitest/jsdom)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `client/vite.config.ts` (vitest config embedded) |
| Quick run command | `cd client && npx vitest run --reporter=verbose src/components/KPIBar.test.tsx src/components/EventFeed.test.tsx src/components/UnitsPanel.test.tsx src/components/PerformancePanel.test.tsx` |
| Full suite command | `cd client && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Global CSS tokens present in `:root`; `body` has correct `font-family` | visual/smoke | Manual verify in browser | N/A |
| UI-01 | All existing tests still pass after adding index.css and modifying App.tsx | regression | `cd client && npx vitest run` | ✅ existing |
| UI-02 | All panels have `.hud-panel` class applied; scanline visible | visual/smoke | Manual verify in browser | N/A |
| UI-02 | EventFeed row colours unchanged (attack=yellow, destroyed=red, capture=green) | regression | `cd client && npx vitest run src/components/EventFeed.test.tsx` | ✅ existing |
| UI-02 | UnitsPanel health bar colours unchanged | regression | `cd client && npx vitest run src/components/UnitsPanel.test.tsx` | ✅ existing |
| UI-02 | PerformancePanel threshold colours unchanged | regression | `cd client && npx vitest run src/components/PerformancePanel.test.tsx` | ✅ existing |
| UI-03 | KPI bar metric cells render correct count values | regression | `cd client && npx vitest run src/components/KPIBar.test.tsx` | ✅ existing |
| UI-03 | Amber pulse animation class applied to value spans | unit | `cd client && npx vitest run src/components/KPIBar.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd client && npx vitest run`
- **Per wave merge:** `cd client && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `client/src/components/KPIBar.test.tsx` — add test `UI-03-f` asserting pulse-value class
      present on value spans (checks `element.className.includes('pulse-value')`)
- [ ] `client/src/index.css` — must be created (currently does not exist; Wave 0 for Plan 08-01)

*(All other test infrastructure already covers the regression surface)*

---

## Sources

### Primary (HIGH confidence)
- MDN CSS Custom Properties — https://developer.mozilla.org/en-US/docs/Web/CSS/--*
- MDN @keyframes — https://developer.mozilla.org/en-US/docs/Web/CSS/@keyframes
- MDN repeating-linear-gradient — https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-linear-gradient
- MDN CSS animation — https://developer.mozilla.org/en-US/docs/Web/CSS/animation
- Google Fonts — Share Tech Mono — https://fonts.google.com/specimen/Share+Tech+Mono
- React key prop docs — https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key

### Secondary (MEDIUM confidence)
- Project source files (read directly): App.tsx, KPIBar.tsx, UnitsPanel.tsx, EventFeed.tsx,
  PerformancePanel.tsx, TacticalMap.tsx, all *.test.tsx files — current colour constants and
  test assertions verified by direct code inspection

### Tertiary (LOW confidence)
- jsdom CSS custom property resolution behaviour: derived from project test patterns
  (existing tests use `rgb()` literal assertions, consistent with known jsdom limitation)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure CSS, zero new deps; all features native to browsers and fully
  specified in MDN
- Architecture: HIGH — patterns derived from direct reading of current codebase and test files
- Pitfalls: HIGH — colour assertions verified by reading every test file; z-index and animation
  pitfalls from CSS specification behaviour

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (CSS specifications are stable; Google Fonts API is stable)
