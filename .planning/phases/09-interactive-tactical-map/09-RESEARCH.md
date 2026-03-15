# Phase 9: Interactive Tactical Map - Research

**Researched:** 2026-03-15
**Domain:** Canvas 2D coordinate transforms, mouse event handling, React refs, pure coordinate-space math
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAP-04 | Tactical map supports mouse-wheel zoom (0.5×–20× range, centered on cursor position) — zoom transforms the canvas rendering coordinate system, not CSS scale | ctx.save()/translate()/scale()/restore() pattern in rAF loop; cursor-centered zoom math derived and verified below |
| MAP-05 | Tactical map supports mouse-drag pan — left-button drag shifts the canvas origin offset; pan is constrained so the map cannot be dragged fully off-screen | mousedown/mousemove/mouseup handler pattern; clampPan math documented below |
| MAP-06 | Map controls bar shows current zoom level, zoom-in (+), zoom-out (−), and reset-to-fit buttons; `R` keyboard shortcut also resets view | HTML overlay pattern; keydown event handler on window; React state for zoom display value |
</phase_requirements>

---

## Summary

Phase 9 adds mouse-wheel zoom and left-button drag-to-pan to the existing Canvas 2D tactical map. All transform state (scale and offset) lives in `useRef` — never in React `useState` — so no React re-renders are triggered by user interaction. The rAF draw loop already runs at 60fps; it simply calls `ctx.save() / ctx.translate(offsetX, offsetY) / ctx.scale(scale, scale)` at the top of each frame and `ctx.restore()` at the bottom. All existing unit-dot and zone-overlay draw logic requires zero modification — it operates in "world space" and the transform stack handles mapping to screen.

The coordinate-space math (worldToScreen, screenToWorld, clampPan) is straightforward 2D affine arithmetic. These three functions must be extracted as pure named exports so they can be unit-tested without canvas. The critical subtlety is cursor-centered zoom: when the wheel fires, the offset must be adjusted so the world point under the cursor stays fixed. This is a two-step calculation: (1) compute the world point under the cursor using current scale/offset, (2) compute the new offset that places that same world point under the cursor at the new scale.

The controls bar is an HTML overlay (`<div>` absolutely positioned above the canvas, same pattern as the existing legend). Zoom percentage is displayed as React state — this is the only React state added in this phase. The `R` keyboard shortcut binds to `window` via a `useEffect` cleanup, matching the existing pattern for side-effect lifecycle in this component.

**Primary recommendation:** Store transform state entirely in refs. Extract coordinate math as pure functions. Apply `ctx.save()/translate()/scale()/restore()` wrapping in the existing rAF loop. Add an HTML overlay controls bar with a single `useState` for the displayed zoom percentage.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D transform API | Browser native | `ctx.save()`, `ctx.translate()`, `ctx.scale()`, `ctx.restore()` | The correct Canvas 2D mechanism for coordinate-space transforms; no CSS involved |
| `useRef` (React) | React 19.2.4 | Store scale and offset without triggering re-renders | Mutable refs are the correct escape hatch for high-frequency state that must not cause renders |
| `useState` (React) | React 19.2.4 | Expose current zoom % to the controls bar UI | Only one piece of state needs to reach the React tree: the displayed zoom label |
| `WheelEvent` | Browser native | Detect mouse-wheel input on the canvas element | Standard DOM wheel event; `deltaY` gives scroll direction and magnitude |
| `MouseEvent` | Browser native | Detect mousedown/mousemove/mouseup for drag-to-pan | Standard DOM pointer events |
| `KeyboardEvent` on `window` | Browser native | `R` keyboard shortcut for reset | Same pattern as other keyboard shortcuts in the project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useEffect` (React) | React 19.2.4 | Register and cleanup event listeners | Already used in component for rAF loop and ResizeObserver |
| `useCallback` (React) | React 19.2.4 | Stable reference to reset handler | Needed if reset is called from both button click and keydown handler |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ctx.save()/translate()/scale()/restore()` | CSS `transform: scale()` on the canvas element | CSS transform would not re-render canvas content at new resolution — dots would appear blurry at high zoom. Requirement explicitly forbids this. |
| `useRef` for transform state | `useState` for transform state | `useState` would trigger a React re-render on every wheel tick and every drag mousemove — at 60fps this causes unnecessary reconciliation. Refs are the correct choice. |
| Pure extracted functions | Inline math in component | Inline math cannot be unit-tested. Extracting `worldToScreen`, `screenToWorld`, `clampPan` as named exports enables isolated unit tests without canvas or React. |

**Installation:** No new dependencies. Canvas 2D transform API, DOM events, and React hooks are already available.

---

## Architecture Patterns

### Recommended Component Structure

The existing `TacticalMap.tsx` is modified in-place. No new files are strictly required, though extracting pure math functions to a sibling file (`mapTransform.ts`) is an option for cleanliness. Either approach works.

```
client/src/
├── components/
│   ├── TacticalMap.tsx          # modified: refs, event handlers, controls bar, transform in rAF
│   └── mapTransform.ts          # OPTIONAL: extracted pure math (worldToScreen, screenToWorld, clampPan)
└── store/
    └── units.ts                 # unchanged
```

If functions are extracted to `mapTransform.ts`, the test file `TacticalMap.test.tsx` should be supplemented with `mapTransform.test.ts` for pure function tests.

If functions stay in `TacticalMap.tsx` as named exports (same pattern as `computeZoneOwner`), the existing test file is augmented.

### Pattern 1: Transform state in refs

**What:** Store `scale` and `offset: { x, y }` in `useRef`. Read them inside the rAF draw callback. Update them inside event handler callbacks. Never call `setState`.

**When to use:** Any high-frequency state that feeds the canvas draw loop but must not trigger React re-renders.

```typescript
const scaleRef = useRef<number>(1)
const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
```

### Pattern 2: ctx.save()/translate()/scale()/restore() in rAF loop

**What:** Wrap the entire draw body in a save/restore pair. Apply translate and scale BEFORE drawing any content. All existing draw code (unit dots, zone overlay) works unchanged — it still uses "world" coordinates.

**When to use:** Any Canvas 2D component adding pan/zoom without refactoring existing draw logic.

**Example:**

```typescript
// Source: MDN CanvasRenderingContext2D.save() / MDN Canvas transforms
const draw = () => {
  // ... guard for canvas.width === 0 ...
  const ctx = canvas.getContext('2d')
  if (!ctx) { rafId = requestAnimationFrame(draw); return }

  const scale = scaleRef.current
  const offset = offsetRef.current

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.save()
  ctx.translate(offset.x, offset.y)
  ctx.scale(scale, scale)

  // --- all existing draw logic here, unchanged ---
  // unit dots, zone overlay, etc.

  ctx.restore()

  rafId = requestAnimationFrame(draw)
}
```

### Pattern 3: Cursor-centered zoom on wheel event

**What:** When the wheel fires, compute the world point under the cursor, then compute the new offset such that the same world point appears under the cursor at the new scale.

**When to use:** Any pan-zoom canvas where zoom must be centered on the cursor, not the canvas center.

**The math:**

```
worldX = (cursorX - offset.x) / scale
worldY = (cursorY - offset.y) / scale

newScale = clamp(scale * zoomFactor, MIN_SCALE, MAX_SCALE)

newOffsetX = cursorX - worldX * newScale
newOffsetY = cursorY - worldY * newScale
```

Where `cursorX / cursorY` are the mouse coordinates relative to the canvas element (use `event.offsetX / event.offsetY`).

**Example:**

```typescript
// Source: derived from standard pinch-zoom / scroll-zoom math; well-established pattern
const MIN_SCALE = 0.5
const MAX_SCALE = 20

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  const canvas = canvasRef.current
  if (!canvas) return

  const scale = scaleRef.current
  const offset = offsetRef.current

  const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * zoomFactor))

  // cursor position relative to canvas
  const cursorX = e.offsetX
  const cursorY = e.offsetY

  // world point under cursor
  const worldX = (cursorX - offset.x) / scale
  const worldY = (cursorY - offset.y) / scale

  // new offset: cursor stays over the same world point
  const newOffsetX = cursorX - worldX * newScale
  const newOffsetY = cursorY - worldY * newScale

  scaleRef.current = newScale
  offsetRef.current = clampPan(
    { x: newOffsetX, y: newOffsetY },
    newScale,
    canvas.width,
    canvas.height,
  )

  setDisplayZoom(Math.round(newScale * 100))
}
```

### Pattern 4: Left-button drag-to-pan

**What:** Track `isDragging` flag and `lastMousePos` in refs. On `mousedown` (button 0), start dragging. On `mousemove`, compute delta from last position and add it to `offsetRef`. Clamp the result. On `mouseup` or `mouseleave`, stop dragging.

**When to use:** Canvas drag-to-pan without CSS transform.

**Example:**

```typescript
const isDraggingRef = useRef(false)
const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return
  isDraggingRef.current = true
  lastMousePosRef.current = { x: e.clientX, y: e.clientY }
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isDraggingRef.current) return
  const canvas = canvasRef.current
  if (!canvas) return

  const dx = e.clientX - lastMousePosRef.current.x
  const dy = e.clientY - lastMousePosRef.current.y
  lastMousePosRef.current = { x: e.clientX, y: e.clientY }

  const newOffset = {
    x: offsetRef.current.x + dx,
    y: offsetRef.current.y + dy,
  }
  offsetRef.current = clampPan(newOffset, scaleRef.current, canvas.width, canvas.height)
}

const handleMouseUp = () => {
  isDraggingRef.current = false
}
```

### Pattern 5: clampPan — constraining pan bounds

**What:** Prevent the user from panning the map entirely off screen. The world coordinate space is 0–1000 × 0–1000. At any given scale, the world occupies `scale * canvasWidth` × `scale * canvasHeight` pixels. At minimum, some portion of the world must remain visible.

**Constraint:** At least one pixel of the mapped world must remain on-screen in each direction. In practice, constrain so the map edges don't go past the canvas edges by more than 20% of the canvas dimension (a common UX convention).

**Pure function — testable:**

```typescript
// Source: derived from standard canvas pan-clamp pattern
export function clampPan(
  offset: { x: number; y: number },
  scale: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  // World dimensions in screen pixels at current scale
  const worldW = canvasWidth * scale   // world x-axis spans full canvas width at scale 1
  const worldH = canvasHeight * scale

  // Allow panning so at least ~10% of canvas remains occupied
  const margin = 0.1
  const minX = canvasWidth * margin - worldW   // leftmost valid offsetX
  const maxX = canvasWidth * (1 - margin)      // rightmost valid offsetX
  const minY = canvasHeight * margin - worldH
  const maxY = canvasHeight * (1 - margin)

  return {
    x: Math.max(minX, Math.min(maxX, offset.x)),
    y: Math.max(minY, Math.min(maxY, offset.y)),
  }
}
```

**Note on the margin:** The exact margin value is a UX decision. The requirement says "cannot be dragged fully off-screen." Using a 10% margin (at most 90% of the world can be off-screen before clamping kicks in) is a reasonable default. The planner can choose any value between 0 (strict edge constraint) and 0.5 (half off-screen allowed).

### Pattern 6: worldToScreen and screenToWorld (pure, exported)

These are the inverse operations of the transform. They are used in tests to verify the math but may also be used in future features (e.g., click-to-select a unit).

```typescript
// Source: standard affine transform inverse

export function worldToScreen(
  worldX: number,
  worldY: number,
  scale: number,
  offset: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (worldX / 1000) * canvasWidth * scale + offset.x,
    y: (worldY / 1000) * canvasHeight * scale + offset.y,
  }
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  scale: number,
  offset: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: ((screenX - offset.x) / scale / canvasWidth) * 1000,
    y: ((screenY - offset.y) / scale / canvasHeight) * 1000,
  }
}
```

### Pattern 7: Controls bar as HTML overlay

**What:** An absolutely-positioned `<div>` overlay above the canvas, following the exact same pattern as the existing legend overlay in `TacticalMap.tsx`.

**What is in the controls bar (MAP-06):**
- Current zoom level as a percentage (e.g., `100%`) — sourced from `displayZoom` React state
- Zoom-in button (`+`) — calls the zoom-in handler
- Zoom-out button (`−`) — calls the zoom-out handler
- Reset-to-fit button — resets scale to 1 and offset to `{ x: 0, y: 0 }`

**`R` key shortcut:** Attach a `keydown` listener to `window` inside a `useEffect`. Check `e.key === 'r' || e.key === 'R'`. Call the same reset function as the reset button.

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'r' || e.key === 'R') {
      resetView()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [resetView])
```

**Example controls bar JSX:**

```tsx
<div style={{
  position: 'absolute', top: 8, right: 8,
  background: 'rgba(0,0,0,0.6)', color: '#fff',
  padding: '4px 8px', fontSize: '11px', borderRadius: 4,
  display: 'flex', gap: 8, alignItems: 'center',
}}>
  <button onClick={handleZoomOut} aria-label="Zoom out">−</button>
  <span>{displayZoom}%</span>
  <button onClick={handleZoomIn} aria-label="Zoom in">+</button>
  <button onClick={resetView} aria-label="Reset view">Reset</button>
</div>
```

### Pattern 8: Event listener registration in useEffect

All mouse and wheel event listeners must be added via `useEffect` (not JSX `onWheel`/`onMouseMove`) because:
1. `wheel` events need `{ passive: false }` to call `preventDefault()` (stops page scroll during zoom)
2. `mousemove` and `mouseup` should be on `window`, not the canvas, so pan continues even if the cursor leaves the canvas while dragging

```typescript
useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas) return

  canvas.addEventListener('wheel', handleWheel, { passive: false })
  canvas.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)

  return () => {
    canvas.removeEventListener('wheel', handleWheel)
    canvas.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }
}, [])  // stable handler refs via useCallback, or handlers inside useEffect
```

### Anti-Patterns to Avoid

- **CSS transform on the canvas element:** Applying `style={{ transform: `scale(${scale})` }}` to the `<canvas>` element scales the displayed bitmap, not the coordinate system. Dots become blurry at high zoom and do not re-render at new resolution. Requirement MAP-04 explicitly forbids this approach.
- **React state for scale and offset:** Storing `scale` and `offset` in `useState` triggers a full React re-render on every wheel tick and every drag pixel. At 60fps and active panning this creates thousands of re-renders per second. Use `useRef` exclusively.
- **Passive wheel listeners:** If `wheel` is registered without `{ passive: false }`, calling `e.preventDefault()` throws a console warning and the page may still scroll. Always use `{ passive: false }` for canvas zoom.
- **mouseup only on the canvas:** If `mouseup` is on the canvas, releasing the mouse button outside the canvas bounds leaves `isDraggingRef.current = true`. The pan then jumps on the next entry into the canvas. Register `mouseup` on `window`.
- **Computing offset delta without clamping:** Raw offset can easily push the map entirely off-screen. Always pass through `clampPan` after any offset change.
- **Re-creating handler functions on every render:** If handlers are defined inside the component body (not in `useEffect` or `useCallback`), they will be new function references on every render, causing the `useEffect` cleanup-and-reregister cycle to fire unnecessarily. Use `useCallback` or define handlers inside the `useEffect`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canvas coordinate transform | Custom matrix multiplication or transform utilities | `ctx.save() / ctx.translate() / ctx.scale() / ctx.restore()` | Canvas 2D has native affine transforms; the API is two lines of code |
| Zoom-centered-on-cursor formula | Trial and error offset adjustments | The standard two-step worldX/worldY formula (Pattern 3 above) | This formula is mathematically exact; guessing leads to subtle drift at edge scales |
| Pan boundary detection | Custom "is the map off-screen?" checks | The `clampPan` pure function pattern (Pattern 5 above) | Clamping with min/max per axis is the complete solution; anything more complex is over-engineering |

**Key insight:** The Canvas 2D transform stack was designed for exactly this use case. `ctx.save()/translate()/scale()/restore()` around the draw body is the idiomatic solution — no matrices, no external libraries.

---

## Common Pitfalls

### Pitfall 1: Zoom not centered on cursor — world "drifts" on zoom

**What goes wrong:** The map zooms in/out but the point under the cursor moves after zoom. The center of zoom is the canvas origin (top-left) or canvas center instead of the cursor.

**Why it happens:** The naive implementation only updates `scale` without compensating the offset. The world-to-screen mapping shifts because the origin changes.

**How to avoid:** Always apply the two-step formula: (1) compute world point under cursor using *old* scale/offset, (2) compute new offset using *new* scale so the same world point maps to the same screen position. Pattern 3 above shows the exact math.

**Warning signs:** Zoom works but the map pans in the direction of the zoom — the cursor no longer points to the same spot after zooming.

### Pitfall 2: Wheel event causes page scroll while zooming

**What goes wrong:** When the user scrolls the wheel over the canvas, the page scrolls AND the map zooms, creating a jittery experience.

**Why it happens:** The default browser behaviour for `wheel` events is to scroll the nearest scrollable ancestor. `e.preventDefault()` suppresses this, but only works if the listener is registered as non-passive.

**How to avoid:** Register the wheel listener with `{ passive: false }` and call `e.preventDefault()` inside the handler. Never use JSX `onWheel` for this (React registers all synthetic wheel events as passive in React 17+).

**Warning signs:** The page scrolls while zooming; console warning: "Unable to preventDefault inside passive event listener."

### Pitfall 3: Pan continues after mouseup outside canvas

**What goes wrong:** User starts dragging, moves mouse outside the canvas, releases the button — but dragging keeps occurring when the mouse re-enters the canvas.

**Why it happens:** `mouseup` on the canvas only fires if the cursor is over the canvas at release time.

**How to avoid:** Register `mousemove` and `mouseup` on `window`, not the canvas element. (Pattern 8 above.)

**Warning signs:** Pan "sticks" — releasing the mouse button outside the canvas does not stop panning.

### Pitfall 4: `ctx.save()/restore()` with existing draw code — missing ctx methods in mock

**What goes wrong:** Adding `ctx.save()` and `ctx.restore()` to the rAF loop causes the existing canvas mock in `TacticalMap.test.tsx` to throw: `TypeError: ctx.save is not a function`.

**Why it happens:** The existing `mockCtx` object in `TacticalMap.test.tsx` only includes the methods that existed before Phase 9. `save`, `restore`, `translate`, `scale` are not mocked.

**How to avoid:** When extending the canvas mock in tests, add `save: vi.fn()`, `restore: vi.fn()`, `translate: vi.fn()`, `scale: vi.fn()` to `mockCtx`. All existing tests must still pass.

**Warning signs:** Existing MAP-01/MAP-02/MAP-03 tests fail after Phase 9 changes with `TypeError: ctx.X is not a function`.

### Pitfall 5: displayZoom React state causes infinite re-render loop

**What goes wrong:** `setDisplayZoom()` is called inside the rAF draw loop, triggering a React re-render every frame.

**Why it happens:** The rAF loop runs 60 times per second; calling `setState` from it re-renders the component 60 times per second.

**How to avoid:** `setDisplayZoom()` must ONLY be called from event handlers (wheel, zoom button clicks, reset), not from the rAF draw loop. The rAF loop only reads `scaleRef.current` — it does not call `setState`.

**Warning signs:** React DevTools profiler shows the component re-rendering 60 times per second even without user interaction.

### Pitfall 6: Incorrect `e.offsetX` vs `e.clientX` for cursor position

**What goes wrong:** The zoom centres on the wrong position — appears to be correct but is offset by the canvas element's position in the page.

**Why it happens:** `e.clientX / e.clientY` are relative to the viewport; `e.offsetX / e.offsetY` are relative to the target element. For cursor-centered zoom, `offsetX/offsetY` is always correct.

**How to avoid:** Use `e.offsetX / e.offsetY` in the wheel handler. Use `e.clientX / e.clientY` only for computing drag deltas (where only the delta matters, not absolute position).

**Warning signs:** Zoom appears correct at small scales but centres on wrong point when the canvas is not at the top-left of the page.

---

## Code Examples

Verified patterns from Canvas 2D MDN documentation and established canvas zoom/pan implementations:

### Minimal transform wrapper in rAF loop

```typescript
// Source: MDN CanvasRenderingContext2D.save()
// https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/save

const draw = () => {
  if (canvas.width === 0 || canvas.height === 0) {
    rafId = requestAnimationFrame(draw)
    return
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) { rafId = requestAnimationFrame(draw); return }

  const scale = scaleRef.current
  const { x: ox, y: oy } = offsetRef.current

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(scale, scale)

  // --- existing draw logic: units, zone overlay ---

  ctx.restore()
  rafId = requestAnimationFrame(draw)
}
```

### Pure coordinate math functions

```typescript
// All pure — no canvas, no React — fully unit-testable

export const MIN_SCALE = 0.5
export const MAX_SCALE = 20

export function worldToScreen(
  worldX: number,
  worldY: number,
  scale: number,
  offset: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (worldX / 1000) * canvasWidth * scale + offset.x,
    y: (worldY / 1000) * canvasHeight * scale + offset.y,
  }
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  scale: number,
  offset: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: ((screenX - offset.x) / scale / canvasWidth) * 1000,
    y: ((screenY - offset.y) / scale / canvasHeight) * 1000,
  }
}

export function clampPan(
  offset: { x: number; y: number },
  scale: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  const worldW = canvasWidth * scale
  const worldH = canvasHeight * scale
  const margin = 0.1
  const minX = canvasWidth * margin - worldW
  const maxX = canvasWidth * (1 - margin)
  const minY = canvasHeight * margin - worldH
  const maxY = canvasHeight * (1 - margin)
  return {
    x: Math.max(minX, Math.min(maxX, offset.x)),
    y: Math.max(minY, Math.min(maxY, offset.y)),
  }
}

export function applyZoom(
  cursorX: number,
  cursorY: number,
  currentScale: number,
  currentOffset: { x: number; y: number },
  zoomFactor: number,
  canvasWidth: number,
  canvasHeight: number,
): { scale: number; offset: { x: number; y: number } } {
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScale * zoomFactor))
  const worldX = (cursorX - currentOffset.x) / currentScale
  const worldY = (cursorY - currentOffset.y) / currentScale
  const newOffset = {
    x: cursorX - worldX * newScale,
    y: cursorY - worldY * newScale,
  }
  return {
    scale: newScale,
    offset: clampPan(newOffset, newScale, canvasWidth, canvasHeight),
  }
}
```

### Reset view

```typescript
function resetView() {
  scaleRef.current = 1
  offsetRef.current = { x: 0, y: 0 }
  setDisplayZoom(100)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `canvas.style.transform` CSS scale | `ctx.save()/translate()/scale()/restore()` in draw loop | Always been wrong for canvas content | Canvas content re-renders at new scale; no blur at high zoom |
| React `onWheel` prop | DOM `addEventListener('wheel', handler, { passive: false })` | React 17+ made synthetic wheel events passive | `preventDefault()` actually works; page scroll suppressed |
| `useState` for transform | `useRef` for scale/offset | Established React canvas pattern | Zero re-renders from interaction |

**Deprecated/outdated:**
- `event.wheelDelta`: Non-standard, removed in Firefox. Use `event.deltaY` (positive = scroll down = zoom out, negative = scroll up = zoom in).
- `canvas.getContext('2d', { willReadFrequently: true })`: Not needed here — we are not doing pixel reads.

---

## Open Questions

1. **Exact clampPan margin value**
   - What we know: Requirement says "cannot be dragged fully off-screen" — a margin of 0 (strict edge clamp) technically satisfies this
   - What's unclear: Whether the intended UX allows any portion to go off-screen or enforces strict edge-to-edge clamping
   - Recommendation: Use 10% margin (allows dragging until 90% of the world is off-screen in any direction); this prevents the map from "locking" at extreme zoom-in levels. If strict is desired, use `margin = 0` and `maxX = 0`, `minX = canvasWidth - worldW` style clamping.

2. **Function placement: TacticalMap.tsx vs mapTransform.ts**
   - What we know: `computeZoneOwner` was placed as a named export directly in `TacticalMap.tsx` in Phase 5; tests import it from there
   - What's unclear: Phase 9 adds 3–5 more exported pure functions; the file may become long
   - Recommendation: For consistency with Phase 5 pattern, keep all exports in `TacticalMap.tsx`. If file exceeds ~200 lines, extract to `mapTransform.ts` — both approaches are valid.

3. **Zoom step size for +/− buttons**
   - What we know: Wheel-based zoom uses a factor of 1.1 per tick (10% per step)
   - What's unclear: Whether +/− buttons should use the same factor or a larger step (e.g., 25% or 2×)
   - Recommendation: Use a factor of 1.25 (25% per click) for buttons — fast enough to be useful, fine enough to not overshoot.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `client/vitest.config.ts` |
| Quick run command | `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run src/components/TacticalMap.test.tsx` |
| Full suite command | `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-04 | `applyZoom()` returns scale clamped to 0.5–20×, offset computed so cursor world-point is preserved | unit (pure fn) | `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run -t MAP-04` | ❌ Wave 0 |
| MAP-04 | `screenToWorld()` and `worldToScreen()` are inverse operations | unit (pure fn) | `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run -t MAP-04` | ❌ Wave 0 |
| MAP-05 | `clampPan()` prevents offset from making map fully off-screen | unit (pure fn) | `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run -t MAP-05` | ❌ Wave 0 |
| MAP-05 | Left-button drag updates `offsetRef` (not `useState`); `mouseup` on window ends drag | integration | `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run -t MAP-05` | ❌ Wave 0 |
| MAP-06 | Controls bar renders zoom %, +/− buttons, reset button | unit (React render) | `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run -t MAP-06` | ❌ Wave 0 |
| MAP-06 | `R` key press calls reset: scale → 1, offset → {x:0,y:0} | unit (keydown sim) | `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run -t MAP-06` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run src/components/TacticalMap.test.tsx`
- **Per wave merge:** `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Augment `client/src/components/TacticalMap.test.tsx` — add MAP-04/05/06 describe blocks; extend `mockCtx` to include `save`, `restore`, `translate`, `scale` as `vi.fn()` stubs
- [ ] If pure math is extracted: create `client/src/components/mapTransform.test.ts` — pure function tests require no canvas mock, no React, no rAF mock
- [ ] No framework changes needed — existing `vitest.config.ts` with jsdom + globals covers all new tests

---

## Sources

### Primary (HIGH confidence)

- MDN `CanvasRenderingContext2D.save()` / `.restore()` / `.translate()` / `.scale()` — confirms Canvas 2D native transform API; stable, widely supported
- MDN `WheelEvent.deltaY` — confirms standard wheel delta property; `deltaMode` not needed for simple zoom
- MDN `MouseEvent.offsetX/offsetY` — confirms coordinates relative to element, not viewport
- Project source: `client/src/components/TacticalMap.tsx` (read directly) — confirms current rAF loop structure, draw pattern, canvas ref pattern; exact integration points identified
- Project source: `client/src/components/TacticalMap.test.tsx` (read directly) — confirms `mockCtx` shape that must be extended; confirms `vi.stubGlobal` pattern for rAF
- Project source: `client/vitest.config.ts` (read directly) — confirms jsdom environment, globals:true
- Project source: `client/package.json` (read directly) — confirms no new dependencies needed; React 19.2.4, Vitest 3.2.4 installed

### Secondary (MEDIUM confidence)

- Standard canvas pan-zoom pattern (cursor-centered zoom math): multiple authoritative sources confirm the two-step worldX/worldY formula; it is a direct consequence of affine transform inversion
- React passive event listener behaviour (wheel): React 17+ registers synthetic events as passive; confirmed by React changelog

### Tertiary (LOW confidence)

- None — all critical claims are verified against primary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all technologies are browser-native or already in the project; no new dependencies
- Architecture: HIGH — transform pattern confirmed against MDN; integration points confirmed against live source code
- Coordinate math: HIGH — worldToScreen/screenToWorld/clampPan are closed-form affine arithmetic; no ambiguity
- Pitfalls: HIGH — passive wheel, mouseup-on-window, CSS-vs-context-transform, and mock-extension gaps are all well-documented and confirmed against project source

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (Canvas 2D API and DOM event APIs are stable; React 19 has no planned breaking changes in this area)
