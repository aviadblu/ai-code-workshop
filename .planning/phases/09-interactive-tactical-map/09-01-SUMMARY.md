---
phase: 09-interactive-tactical-map
plan: 01
subsystem: ui
tags: [react, canvas, zoom, pan, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 05-tactical-map
    provides: TacticalMap component with rAF draw loop, computeZoneOwner, zone overlay
provides:
  - worldToScreen/screenToWorld coordinate conversion pure functions (exported)
  - clampPan — constrained pan offset clamping pure function (exported)
  - applyZoom — cursor-centred zoom with scale clamping pure function (exported)
  - MIN_SCALE=0.5, MAX_SCALE=20 constants (exported)
  - scaleRef/offsetRef/isDraggingRef/dragStartRef inside TacticalMap component
  - displayZoom useState(100) ready for 09-02 controls bar
  - Wheel event handler (non-passive) for zoom interaction
  - Drag event handler (mousedown on canvas, mousemove/mouseup on window)
  - rAF loop wrapped in ctx.save/translate/scale/restore transform
affects:
  - 09-interactive-tactical-map (plan 09-02 adds zoom controls bar using displayZoom)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure exported math functions for coordinate transforms (same pattern as computeZoneOwner)
    - Refs-not-state for interaction values (scale/offset/drag state bypass React renders)
    - Non-passive wheel addEventListener to enable e.preventDefault()
    - window-level mouse event listeners for drag-outside-canvas support
    - ctx.save/translate/scale/restore wrapping all per-frame draw calls

key-files:
  created: []
  modified:
    - client/src/components/TacticalMap.tsx
    - client/src/components/TacticalMap.test.tsx

key-decisions:
  - "Refs not useState for scale/offset — no React re-renders from wheel/drag interactions"
  - "window.addEventListener for mousemove/mouseup — drag continues even when cursor leaves canvas"
  - "Non-passive wheel listener (addEventListener not JSX onWheel) — required to call e.preventDefault() and block page scroll"
  - "displayZoom useState(100) declared now but used in Plan 09-02 — avoids needing to pass state up later"

patterns-established:
  - "Coordinate math as pure exported functions — tested without mounting component"
  - "Interaction refs pattern: scaleRef/offsetRef updated in event handlers, read in rAF draw callback"

requirements-completed:
  - MAP-04
  - MAP-05

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 9 Plan 01: Interactive Tactical Map — Zoom and Pan Summary

**Cursor-centred mouse-wheel zoom (0.5x-20x) and constrained drag pan added to TacticalMap via pure exported coordinate math functions and interaction refs; 31 MAP-01 through MAP-05 tests green**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-15T23:11:46Z
- **Completed:** 2026-03-15T23:13:22Z
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files modified:** 2

## Accomplishments
- Exported MIN_SCALE, MAX_SCALE, worldToScreen, screenToWorld, clampPan, applyZoom pure functions
- Added scaleRef, offsetRef, isDraggingRef, dragStartRef refs inside TacticalMap (no re-renders)
- Wrapped rAF draw body in ctx.save/translate(offset)/scale(scale)/restore transform
- Added non-passive wheel event handler for cursor-centred zoom
- Added drag handler with mousedown on canvas, mousemove/mouseup on window for drag-outside-canvas
- Extended mockCtx with save/restore/translate/scale stubs; all 79 client tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Extend mockCtx and write failing MAP-04/MAP-05 tests** - `7639a27` (test)
2. **Task 2: GREEN — Pure exports + refs + wheel/drag handlers + rAF transform** - `24030ce` (feat)

_Note: TDD tasks have two commits (test RED then feat GREEN)_

## Files Created/Modified
- `client/src/components/TacticalMap.tsx` — Added 118 lines: pure exports, transform refs, displayZoom state, wheel/drag useEffects, ctx.save/restore wrapping in rAF loop
- `client/src/components/TacticalMap.test.tsx` — Added 89 lines: save/restore/translate/scale mocks in mockCtx; MAP-04 (8 tests) and MAP-05 (4 tests) describe blocks

## Decisions Made
- Refs not useState for scale/offset — avoids triggering React re-renders on every wheel tick or mouse move, keeping 60fps rAF loop independent of React lifecycle
- window.addEventListener for mousemove/mouseup — drag continues even when cursor leaves the canvas boundary (drag-outside-canvas is standard map UX)
- Non-passive wheel listener via addEventListener({ passive: false }) rather than JSX onWheel — required to call e.preventDefault() and prevent the page from scrolling while zooming
- displayZoom useState(100) declared in this plan for use by Plan 09-02 controls bar — avoids lifting state later

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 09-02 can use displayZoom (useState) and scaleRef to render a zoom controls bar
- All pure functions are exported and stable — Plan 09-02 tests can import them directly if needed
- No blockers or concerns

---
*Phase: 09-interactive-tactical-map*
*Completed: 2026-03-15*
