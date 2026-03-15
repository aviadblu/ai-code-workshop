# Phase 5: Tactical Map - Research

**Researched:** 2026-03-15
**Domain:** Canvas 2D rendering, requestAnimationFrame loop, React/Zustand decoupling, ResizeObserver
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAP-01 | Canvas 2D renders all 20k unit dots at 60fps via `requestAnimationFrame` — reads store via `getState()`, never via React hooks | rAF loop pattern, getState() access, jsdom canvas mock strategy documented below |
| MAP-02 | Unit dots are colour-coded: Alpha=blue (#3b82f6), Bravo=red (#ef4444), destroyed=grey (#6b7280) | fillStyle per-unit draw pattern documented below |
| MAP-03 | Canvas renders a zone control overlay (tinted circle) indicating which team owns the central zone based on unit centroids | Centroid computation + arc() overlay pattern documented below |
</phase_requirements>

---

## Summary

Phase 5 replaces the `TacticalMap.tsx` stub with a fully imperative Canvas 2D component. The entire render path is decoupled from React: a `useRef` holds the `<canvas>` DOM element, a `ResizeObserver` keeps the canvas dimensions matching its CSS container, and a `requestAnimationFrame` loop iterates all 20k units per frame using `useUnitsStore.getState()` — never a hook or subscription. This means React never re-renders due to canvas activity.

The store (`client/src/store/units.ts`) is already complete and exports `useUnitsStore` with `getState()` available. The `applyDelta` path creates a new `Map` reference each tick, but the rAF loop reads the map reference fresh on every frame via `getState()`, so there is zero coordination needed between the store and the render loop.

Zone control (MAP-03) requires computing the centroid of each team's living units each frame, determining which team has more units within a central radius, and drawing a tinted `arc()` circle. The spec calls for a midpoint circle between the two centroids, filled with a semi-transparent team colour. The HTML legend is a positioned `<div>` overlay, not a canvas draw call.

**Primary recommendation:** Implement `TacticalMap.tsx` as a single React component with three internal concerns — canvas sizing via `ResizeObserver`, the rAF draw loop, and an HTML legend overlay — with no Zustand subscriptions anywhere in the component.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Browser native | Drawing 20k dots per frame | Zero deps; sufficient for this scale; locked decision |
| `requestAnimationFrame` | Browser native | 60fps draw loop outside React | Decouples render from React cycle; locked decision |
| `useRef` (React) | React 19.2.4 | Access `<canvas>` DOM node | Standard React escape hatch for imperative DOM |
| `ResizeObserver` | Browser native | Respond to container size changes | More accurate than window resize event; locked decision |
| Zustand `getState()` | zustand 5.0.11 | Read unit state inside rAF | Avoids hook-in-callback error; locked decision |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useEffect` (React) | React 19.2.4 | Wire up rAF loop and ResizeObserver on mount | Standard lifecycle for imperative side-effects |
| `useCallback` (React) | React 19.2.4 | Stable draw function reference | Only if draw function is referenced by multiple effects |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas 2D | WebGL / PixiJS | Higher throughput, but unnecessary complexity at 20k dots — Canvas 2D handles this load comfortably. Locked out of scope. |
| `getState()` in rAF | Zustand subscription | Subscription triggers re-render every tick; defeats the entire architecture. |
| `ResizeObserver` | `window.resize` event | window.resize doesn't fire for CSS-only container resizes (e.g., flex/grid reflow). ResizeObserver is accurate. |

**Installation:** No new dependencies needed for this phase. Canvas 2D, rAF, and ResizeObserver are all browser-native APIs. React and Zustand are already installed.

---

## Architecture Patterns

### Recommended Component Structure

```
client/src/
├── components/
│   └── TacticalMap.tsx      # single file — canvas ref, rAF loop, ResizeObserver, HTML legend
└── store/
    └── units.ts             # already complete — getState() is the only interface needed
```

No new files needed beyond `TacticalMap.tsx` itself.

### Pattern 1: Canvas ref + ResizeObserver

**What:** Attach a `useRef<HTMLCanvasElement>` to the `<canvas>` element. In a `useEffect`, create a `ResizeObserver` on the canvas's parent container (or the canvas itself). On each resize callback, set `canvas.width` and `canvas.height` to the observed `contentRect` dimensions.

**When to use:** Any time a canvas must fill a flex/grid container that can change size.

**Critical detail:** Setting `canvas.width` or `canvas.height` clears the canvas and resets the 2D context state. This is fine because the rAF loop redraws every frame. Do NOT cache the `CanvasRenderingContext2D` in a ref across a resize — re-acquire it from `canvas.getContext('2d')` each frame, or re-acquire after each resize event.

**Example:**

```typescript
// Pattern: ResizeObserver wiring in useEffect
useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas) return

  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      canvas.width = entry.contentRect.width
      canvas.height = entry.contentRect.height
    }
  })
  ro.observe(canvas)

  return () => ro.disconnect()
}, [])
```

### Pattern 2: rAF loop reading getState()

**What:** Start a `requestAnimationFrame` loop in a `useEffect`. Inside the loop callback, call `useUnitsStore.getState()` to get the current map reference. Draw all units. Schedule the next frame. Return a cleanup that cancels the pending frame on unmount.

**When to use:** Any 60fps draw loop that reads Zustand state without triggering React re-renders.

**Critical detail:** Store the rAF handle in a `useRef<number>`, not a local variable, so the cleanup function in the `useEffect` return can reliably cancel it.

**Example:**

```typescript
useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas) return
  let rafId: number

  const draw = () => {
    const ctx = canvas.getContext('2d')
    if (!ctx) { rafId = requestAnimationFrame(draw); return }

    const { units } = useUnitsStore.getState()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // iterate and draw — see Pattern 3
    for (const unit of units.values()) {
      // ...
    }

    rafId = requestAnimationFrame(draw)
  }

  rafId = requestAnimationFrame(draw)
  return () => cancelAnimationFrame(rafId)
}, [])
```

### Pattern 3: Per-unit dot rendering (MAP-02)

**What:** For each unit, choose `fillStyle` based on `team` and `status`, then draw a 2px filled arc.

**When to use:** Any Canvas 2D scatter plot where marker appearance depends on data category.

**Performance note:** Changing `fillStyle` on the context is cheap. Batching by colour (draw all alpha first, all bravo second, all destroyed third) avoids unnecessary `fillStyle` switches and can be ~2x faster on large counts — but at 20k dots this is optional, not required for 60fps.

**Coordinate mapping:** Unit coordinates are 0–1000 (both axes). Canvas coordinates are `[0, canvas.width]` × `[0, canvas.height]`. Scale: `px = (unit.x / 1000) * canvas.width`.

**Example:**

```typescript
const COLOURS = {
  alpha: '#3b82f6',
  bravo: '#ef4444',
  destroyed: '#6b7280',
} as const

for (const unit of units.values()) {
  const colour = unit.status === 'destroyed'
    ? COLOURS.destroyed
    : COLOURS[unit.team]

  const px = (unit.x / 1000) * canvas.width
  const py = (unit.y / 1000) * canvas.height

  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.arc(px, py, 1, 0, Math.PI * 2)  // radius 1 → 2px dot diameter
  ctx.fill()
}
```

### Pattern 4: Zone control overlay (MAP-03)

**What:** Each frame, compute the centroid (mean x/y) of all living Alpha units and all living Bravo units separately. The zone is a circle at the canvas centre with a fixed radius (e.g., 20% of the smaller canvas dimension). The team with more living units within that radius "owns" the zone. Draw a semi-transparent filled circle coloured for the owning team.

**Spec detail (from design doc):** "team with more units within a central zone radius owns it; draw tinted circle." The midpoint overlay described in the additional context is the filled circle at the zone centre — not a line between centroids.

**When to use:** Every frame, after drawing all unit dots.

**Example:**

```typescript
// Zone control overlay
const zoneRadius = Math.min(canvas.width, canvas.height) * 0.2
const cx = canvas.width / 2
const cy = canvas.height / 2

let alphaInZone = 0
let bravoInZone = 0

for (const unit of units.values()) {
  if (unit.status === 'destroyed') continue
  const px = (unit.x / 1000) * canvas.width
  const py = (unit.y / 1000) * canvas.height
  const dx = px - cx
  const dy = py - cy
  if (dx * dx + dy * dy <= zoneRadius * zoneRadius) {
    if (unit.team === 'alpha') alphaInZone++
    else bravoInZone++
  }
}

const zoneOwner = alphaInZone >= bravoInZone ? 'alpha' : 'bravo'
ctx.fillStyle = zoneOwner === 'alpha'
  ? 'rgba(59, 130, 246, 0.15)'
  : 'rgba(239, 68, 68, 0.15)'
ctx.beginPath()
ctx.arc(cx, cy, zoneRadius, 0, Math.PI * 2)
ctx.fill()
// Outline for visibility
ctx.strokeStyle = zoneOwner === 'alpha' ? '#3b82f6' : '#ef4444'
ctx.lineWidth = 1
ctx.stroke()
```

### Pattern 5: HTML legend overlay

**What:** A `<div>` absolutely positioned over the canvas using CSS `position: relative` on the wrapper and `position: absolute` on the legend. Contains colour swatches for Alpha, Bravo, and Zone.

**When to use:** Labels/legends that would require complex text layout in canvas — HTML is easier and maintains accessibility.

**Example:**

```tsx
<div style={{ position: 'relative', width: '100%', height: '100%' }}>
  <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
  <div style={{
    position: 'absolute', bottom: 8, left: 8,
    background: 'rgba(0,0,0,0.6)', color: '#fff',
    padding: '4px 8px', fontSize: '11px', borderRadius: 4,
    display: 'flex', gap: 12
  }}>
    <span><span style={{ color: '#3b82f6' }}>■</span> Alpha</span>
    <span><span style={{ color: '#ef4444' }}>■</span> Bravo</span>
    <span><span style={{ color: '#6b7280' }}>■</span> Destroyed</span>
  </div>
</div>
```

### Anti-Patterns to Avoid

- **Zustand hook inside rAF callback:** `useUnitsStore` (the hook) cannot be called inside a non-hook function. Use `useUnitsStore.getState()` instead.
- **Storing ctx in a ref across resizes:** Setting `canvas.width` or `canvas.height` invalidates all context state. Re-call `canvas.getContext('2d')` inside the draw function each frame (it returns the same instance, but its state is reset by the resize).
- **React state for canvas dimensions:** Do not use `useState` for width/height; it causes React re-renders on every resize. Write directly to `canvas.width` / `canvas.height` from the `ResizeObserver` callback.
- **Two separate useEffects without coordination:** If ResizeObserver and rAF loop are in separate `useEffect` calls, ensure they don't race — both should use `canvasRef.current` defensively with null-guards.
- **Iterating units array from store:** The store holds `Map<string, Unit>`. Use `.values()` to iterate. Do not spread into an array (`[...units.values()]`) inside the rAF loop — this allocates a new array every frame (20k × 60fps = 1.2M allocations/sec).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canvas sizing | Custom dimension tracking with useState | `ResizeObserver` callback writing directly to `canvas.width/height` | ResizeObserver is precise, fires on container reflow, no React render cost |
| 60fps loop | setInterval / setTimeout | `requestAnimationFrame` | rAF is throttled to display refresh rate, pauses when tab is hidden, provides accurate timestamps |
| Accessing store in rAF | Passing store state as prop to canvas component | `useUnitsStore.getState()` directly | Props would require React re-render on every tick to stay current |

**Key insight:** The entire pattern is "imperative island inside declarative React." React mounts the component once; everything after that is vanilla JS.

---

## Common Pitfalls

### Pitfall 1: canvas.width vs canvas CSS width

**What goes wrong:** Setting `style={{ width: '100%' }}` on a canvas does NOT change its internal resolution (`canvas.width`). Drawing happens in internal pixels; display is stretched. Results in blurry rendering.

**Why it happens:** `<canvas>` has two separate size concepts: the element's CSS size and its internal bitmap resolution.

**How to avoid:** Always set `canvas.width` and `canvas.height` from the `ResizeObserver` `contentRect` values. The CSS `style` on the canvas should be `display: block` only (or `width: 100%; height: 100%` if the container has explicit height).

**Warning signs:** Dots appear at the wrong positions; dots look blurry or oversized.

### Pitfall 2: rAF cleanup leak on unmount

**What goes wrong:** The `useEffect` starts a rAF loop but does not return a cleanup function that calls `cancelAnimationFrame`. The loop continues running after the component unmounts, accessing a stale canvas ref.

**Why it happens:** rAF loops are self-perpetuating — each frame schedules the next.

**How to avoid:** Always capture the rAF handle in a ref or a closure variable and call `cancelAnimationFrame(handle)` in the `useEffect` cleanup return.

**Warning signs:** React DevTools shows the component is unmounted but GPU usage stays high; console errors about stale refs after navigation.

### Pitfall 3: ResizeObserver and rAF in a race on first render

**What goes wrong:** The rAF loop starts before the `ResizeObserver` fires, so `canvas.width` and `canvas.height` are 0 (the HTML default). The first N frames draw nothing or draw at 0×0.

**Why it happens:** `useEffect` fires after paint; `ResizeObserver` fires asynchronously. The first rAF frame may run before the first resize observation.

**How to avoid:** In the draw function, guard: `if (canvas.width === 0 || canvas.height === 0) { rafId = requestAnimationFrame(draw); return }`. Alternatively, set initial `canvas.width`/`height` synchronously in the effect before starting the rAF loop using `canvas.getBoundingClientRect()`.

**Warning signs:** The first frame or two show nothing drawn despite units being in the store.

### Pitfall 4: beginPath() missing before each arc()

**What goes wrong:** Without `ctx.beginPath()` before each `ctx.arc()`, all arcs accumulate on the same path. `ctx.fill()` fills the entire accumulated path, not just the last arc. All dots are connected by phantom lines; fill is applied globally.

**Why it happens:** Canvas path API is additive unless explicitly reset.

**How to avoid:** Call `ctx.beginPath()` before every individual `ctx.arc()` call. This is the correct pattern for individual filled shapes.

**Warning signs:** All dots appear filled but connected; performance degrades dramatically as the path object grows.

### Pitfall 5: jsdom canvas in Vitest has no 2D rendering

**What goes wrong:** Tests that render `TacticalMap.tsx` with `@testing-library/react` run in jsdom (per `vitest.config.ts`). jsdom does not implement Canvas 2D — `canvas.getContext('2d')` returns `null`. Tests that assert on draw calls will throw.

**Why it happens:** jsdom is a DOM implementation, not a browser rendering engine.

**How to avoid:** Mock `getContext` to return a spy object in test setup. For MAP-01/02/03, test the _draw logic_ in isolation (pure functions) rather than through the React component. The component integration can be tested with a canvas mock that records method calls.

**Example mock setup:**
```typescript
// In test file or vitest setup
const mockCtx = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillRect: vi.fn(),
}
HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as unknown as CanvasRenderingContext2D)
```

---

## Code Examples

Verified patterns for this phase:

### Full TacticalMap skeleton

```typescript
// client/src/components/TacticalMap.tsx
import { useEffect, useRef } from 'react'
import { useUnitsStore } from '../store/units'

const COLOURS = {
  alpha: '#3b82f6',
  bravo: '#ef4444',
  destroyed: '#6b7280',
} as const

export default function TacticalMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ResizeObserver — writes directly to canvas dimensions, no React state
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width
        canvas.height = entry.contentRect.height
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // rAF draw loop — reads getState(), never hooks
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let rafId: number

    const draw = () => {
      if (canvas.width === 0 || canvas.height === 0) {
        rafId = requestAnimationFrame(draw)
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) { rafId = requestAnimationFrame(draw); return }

      const { units } = useUnitsStore.getState()
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Unit dots (MAP-01, MAP-02)
      for (const unit of units.values()) {
        const colour = unit.status === 'destroyed' ? COLOURS.destroyed : COLOURS[unit.team]
        const px = (unit.x / 1000) * canvas.width
        const py = (unit.y / 1000) * canvas.height
        ctx.fillStyle = colour
        ctx.beginPath()
        ctx.arc(px, py, 1, 0, Math.PI * 2)
        ctx.fill()
      }

      // Zone control overlay (MAP-03)
      const zoneRadius = Math.min(canvas.width, canvas.height) * 0.2
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      let alphaInZone = 0
      let bravoInZone = 0
      for (const unit of units.values()) {
        if (unit.status === 'destroyed') continue
        const px = (unit.x / 1000) * canvas.width
        const py = (unit.y / 1000) * canvas.height
        const dx = px - cx
        const dy = py - cy
        if (dx * dx + dy * dy <= zoneRadius * zoneRadius) {
          if (unit.team === 'alpha') alphaInZone++
          else bravoInZone++
        }
      }
      const owner = alphaInZone >= bravoInZone ? 'alpha' : 'bravo'
      ctx.fillStyle = owner === 'alpha' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)'
      ctx.beginPath()
      ctx.arc(cx, cy, zoneRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = owner === 'alpha' ? '#3b82f6' : '#ef4444'
      ctx.lineWidth = 1
      ctx.stroke()

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '400px', background: '#111' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        background: 'rgba(0,0,0,0.6)', color: '#fff',
        padding: '4px 8px', fontSize: '11px', borderRadius: 4,
        display: 'flex', gap: 12,
      }}>
        <span><span style={{ color: '#3b82f6' }}>■</span> Alpha</span>
        <span><span style={{ color: '#ef4444' }}>■</span> Bravo</span>
        <span><span style={{ color: '#6b7280' }}>■</span> Destroyed</span>
        <span style={{ color: '#aaa' }}>Zone circle = control</span>
      </div>
    </div>
  )
}
```

### Extractable draw logic for testing

```typescript
// Pure functions that can be unit-tested without canvas
export function computeZoneOwner(
  units: Map<string, Unit>,
  cx: number, cy: number,
  zoneRadius: number,
  canvasWidth: number,
  canvasHeight: number,
): 'alpha' | 'bravo' {
  let alphaCount = 0
  let bravoCount = 0
  for (const unit of units.values()) {
    if (unit.status === 'destroyed') continue
    const px = (unit.x / 1000) * canvasWidth
    const py = (unit.y / 1000) * canvasHeight
    const dx = px - cx
    const dy = py - cy
    if (dx * dx + dy * dy <= zoneRadius * zoneRadius) {
      if (unit.team === 'alpha') alphaCount++
      else bravoCount++
    }
  }
  return alphaCount >= bravoCount ? 'alpha' : 'bravo'
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rendering canvas via `react-konva` / third-party | Direct `canvas.getContext('2d')` | Ongoing — project locked to no extra deps | No dependency overhead |
| `window.addEventListener('resize', ...)` | `ResizeObserver` | ~2019 (broad support) | Responds to container reflow, not just window resize |
| Zustand v4 `getState()` | Zustand v5 `getState()` (same API) | Zustand 5 released 2024 | No API change for this pattern |

**Deprecated/outdated:**
- `ReactDOM.createPortal` for canvas overlays: Not needed; simple CSS absolute positioning suffices.
- `canvas.style.width = px + 'px'` for sizing: Wrong approach — must set `canvas.width` (attribute) not CSS width.

---

## Open Questions

1. **Zone radius definition**
   - What we know: "central zone radius" — spec says 20% of smaller dimension as a reasonable default
   - What's unclear: No explicit pixel/coordinate value given in requirements
   - Recommendation: Use `Math.min(canvas.width, canvas.height) * 0.2` — makes zone visible at any aspect ratio; can be adjusted in a single constant

2. **Two-loop vs one-loop for zone counting**
   - What we know: Zone counting requires a second iteration over all living units (separate from the dot-drawing loop)
   - What's unclear: Whether combining into one loop with extra branching is better than two clean loops
   - Recommendation: Two clear loops (dots first, then zone) — easier to read and test; 20k iterations in < 1ms at 60fps is not a bottleneck

3. **Centroid vs density for zone ownership**
   - What we know: Spec says "team with more units within a central zone radius owns it" — this is a count-within-radius approach, not centroid-based
   - What's unclear: Additional context says "centroid of each team's living units" but requirements say "zone control overlay indicating which team owns the central zone based on unit centroids" — these are slightly different algorithms
   - Recommendation: Implement count-within-radius (the clearer of the two spec statements in the design doc). If centroid distance is needed, it is a minor change.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `client/vitest.config.ts` |
| Quick run command | `cd client && npx vitest run src/components/TacticalMap.test.tsx` |
| Full suite command | `cd client && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | rAF loop reads `getState()` and calls `clearRect` + draw methods each frame | unit | `cd client && npx vitest run src/components/TacticalMap.test.tsx -t MAP-01` | ❌ Wave 0 |
| MAP-02 | Alpha units use #3b82f6, Bravo use #ef4444, destroyed use #6b7280 | unit | `cd client && npx vitest run src/components/TacticalMap.test.tsx -t MAP-02` | ❌ Wave 0 |
| MAP-03 | `computeZoneOwner` returns correct team based on unit distribution within central radius | unit | `cd client && npx vitest run src/components/TacticalMap.test.tsx -t MAP-03` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd client && npx vitest run src/components/TacticalMap.test.tsx`
- **Per wave merge:** `cd client && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `client/src/components/TacticalMap.test.tsx` — covers MAP-01, MAP-02, MAP-03; requires canvas mock (`HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx)`)
- [ ] No new framework setup needed — `vitest.config.ts` with `environment: 'jsdom'` and `globals: true` already exists

---

## Sources

### Primary (HIGH confidence)

- MDN Canvas API — `CanvasRenderingContext2D`, `arc()`, `clearRect()`, `beginPath()`, `fillStyle` — well-established stable API
- MDN `requestAnimationFrame` — scheduling, cleanup via `cancelAnimationFrame`, behaviour when tab hidden
- MDN `ResizeObserver` — `contentRect`, `observe()`/`disconnect()` lifecycle
- Project source: `client/src/store/units.ts` — confirms `useUnitsStore.getState()` is available (Zustand v5 `create()` returns store with `.getState()` method)
- Project source: `client/vitest.config.ts` — confirms `jsdom` environment + `globals: true`
- Project source: `docs/superpowers/specs/2026-03-14-war-room-control-design.md` — confirms all colour values, zone algorithm, legend as HTML overlay

### Secondary (MEDIUM confidence)

- Zustand v5 docs: `getState()` is a stable method on the store object returned by `create()` — no subscription, no selector, snapshot of current state at call time

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all technologies are browser-native or already installed in the project; no new dependencies
- Architecture: HIGH — patterns verified against existing store implementation and locked design decisions
- Pitfalls: HIGH — canvas sizing and beginPath() are well-documented gotchas; jsdom canvas limitation is a known Vitest constraint
- Zone algorithm: MEDIUM — slight ambiguity between "centroid" wording and "count within radius" wording in spec; recommendation made but may need clarification

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (Canvas 2D API is stable; no risk of breaking changes)
