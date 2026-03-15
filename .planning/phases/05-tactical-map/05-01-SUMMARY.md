---
phase: 05-tactical-map
plan: "01"
subsystem: client-canvas
tags: [canvas, requestAnimationFrame, ResizeObserver, zustand, vitest, tdd]
provides:
  - TacticalMap canvas element with useRef<HTMLCanvasElement>
  - ResizeObserver writes canvas.width/height directly (no React state)
  - rAF draw loop with canvas.width===0 guard and cancelAnimationFrame cleanup
  - useUnitsStore.getState() as sole store access inside rAF callback
  - MAP-01 Vitest test suite (6 cases, all green)
affects: [05-tactical-map, client-rendering]
tech-stack:
  added: []
  patterns: [imperative-canvas-in-react, raf-draw-loop, resize-observer-sizing, zustand-getstate-in-raf]
key-files:
  created:
    - client/src/components/TacticalMap.test.tsx
  modified:
    - client/src/components/TacticalMap.tsx
key-decisions:
  - "canvas.width/height written directly from ResizeObserver — no useState to avoid React re-renders on resize"
  - "useUnitsStore.getState() (not hook) inside rAF draw callback — hooks cannot be called inside non-hook functions"
  - "canvas.width===0 guard reschedules without drawing — prevents 0×0 draw on first frame before ResizeObserver fires"
  - "TacticalMap.test.tsx uses (HTMLCanvasElement.prototype as any).getContext cast — avoids TypeScript overload mismatch with vi.fn()"
  - "Removed react-dom v16 render/unmountComponentAtNode imports — React 19 only exposes createRoot API"
duration: 4min
completed: 2026-03-15
---

# Phase 05 Plan 01: TacticalMap Canvas Scaffold Summary

**Canvas infrastructure wired: useRef canvas, ResizeObserver sizing, rAF loop with getState() and 0-width guard — all MAP-01 tests green via TDD.**

## Performance
- **Duration:** ~4min
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Created `TacticalMap.test.tsx` with 6 MAP-01 test cases (RED first, committed before implementation)
- Replaced stub `<div>` with canvas element backed by `useRef<HTMLCanvasElement>`
- ResizeObserver effect writes `contentRect.width/height` directly to `canvas.width/height` — zero React state involved
- rAF loop guards `canvas.width === 0` to avoid 0×0 draws before first resize observation fires
- `cancelAnimationFrame` cleanup in useEffect return prevents loop leak on unmount
- `useUnitsStore.getState()` is the only store access — no Zustand hook subscription
- Full suite passes: 14/14 tests (6 MAP-01 + 8 existing units store tests)
- TypeScript clean (`tsc --noEmit` exits 0)

## Task Commits
1. **Task 1: Write MAP-01 failing tests (RED)** - `a406d6a`
2. **Task 2: Implement canvas ref + ResizeObserver + rAF scaffold (GREEN)** - `2853c0d`

## Files Created/Modified
- `client/src/components/TacticalMap.test.tsx` - 6 MAP-01 Vitest cases with canvas mock, rAF mock, ResizeObserver mock
- `client/src/components/TacticalMap.tsx` - Canvas component with ref, ResizeObserver, rAF draw loop

## Decisions & Deviations

### Decisions
- Used `(HTMLCanvasElement.prototype as any).getContext` cast in tests to avoid TypeScript overload mismatch with `vi.fn()` return type
- Removed unused `react-dom` v16 `render`/`unmountComponentAtNode` imports from test file (React 19 removed these APIs)

### Deviations from Plan
**[Rule 1 - Bug] Fixed TypeScript errors in test file**
- **Found during:** Task 2 (tsc --noEmit after GREEN implementation)
- **Issue 1:** Test imported `render`/`unmountComponentAtNode` from `react-dom` — React 19 removed these exports
- **Issue 2:** `HTMLCanvasElement.prototype.getContext = vi.fn(...)` failed TypeScript overload check
- **Fix:** Removed unused react-dom imports; added `(HTMLCanvasElement.prototype as any)` cast for getContext mock
- **Files modified:** `client/src/components/TacticalMap.test.tsx`
- **Commit:** `2853c0d`

## Next Phase Readiness
- Plan 05-02 can now add the per-unit dot rendering loop inside the rAF draw callback (the `void units` placeholder marks the insertion point)
- Plan 05-03 can add the zone control overlay after dot rendering
- No architectural changes needed — skeleton is complete and tested
