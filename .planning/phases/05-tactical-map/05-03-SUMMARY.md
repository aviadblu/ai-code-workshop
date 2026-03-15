---
phase: 05-tactical-map
plan: "03"
subsystem: client-canvas
tags: [canvas, zone-control, overlay, legend, pure-function, requestAnimationFrame, zustand, vitest, tdd]
provides:
  - computeZoneOwner exported pure function — counts living units within zoneRadius at canvas centre; tie goes to alpha
  - Zone control arc drawn after dot loop — semi-transparent fill + stroke coloured by owning team
  - HTML legend div positioned absolute bottom-left — Alpha / Bravo / Destroyed / Zone circle labels
  - MAP-03 Vitest test suite (7 cases, all green)
  - Phase 5 complete — full TacticalMap implementation with MAP-01 + MAP-02 + MAP-03 all green
affects: [05-tactical-map, client-rendering]
tech-stack:
  added: []
  patterns: [pure-function-extraction-for-testability, canvas-zone-overlay, html-legend-over-canvas, count-within-radius]
key-files:
  created: []
  modified:
    - client/src/components/TacticalMap.tsx
    - client/src/components/TacticalMap.test.tsx
key-decisions:
  - "computeZoneOwner extracted as named export above component declaration — importable as pure function without React render"
  - "count-within-radius algorithm used for zone ownership (not centroid distance) — matches design doc spec"
  - "alphaCount >= bravoCount tie-breaks to alpha — consistent with spec MAP-03-c"
  - "destroyed units skip via early continue in computeZoneOwner — same guard pattern as unit dot loop"
  - "MAP-02-d/e test assertions updated from 3 to 4 arc/beginPath calls — zone arc correctly adds 1 extra call"
duration: 4min
completed: 2026-03-15
---

# Phase 05 Plan 03: Zone Control Overlay + HTML Legend Summary

**computeZoneOwner pure function + semi-transparent zone arc + HTML legend overlay complete Phase 5 canvas rendering — 19/19 MAP-01+MAP-02+MAP-03 tests green via TDD.**

## Performance
- **Duration:** ~4min
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Added MAP-03 test suite (7 cases): MAP-03-a through MAP-03-e test computeZoneOwner directly as a pure function; MAP-03-f verifies extra arc call; MAP-03-g verifies legend DOM labels
- Extracted `computeZoneOwner` as named export above the component — takes `Map<string, Unit>`, canvas dimensions, and zone radius; returns `'alpha' | 'bravo'`
- Zone overlay drawn after unit dot loop: `Math.min(w,h) * 0.2` radius arc at canvas centre, rgba fill + 1px stroke in team colour
- HTML legend absolutely positioned bottom-left inside relative wrapper — contains Alpha, Bravo, Destroyed, Zone circle labels with correct hex colours
- Updated MAP-02-d/e to count 4 arc/beginPath calls (3 dots + 1 zone arc) — correct after zone overlay addition
- All 19 TacticalMap tests green; full client suite 27/27 green; TypeScript clean

## Task Commits
1. **Task 1: Add MAP-03 failing tests (RED)** - `f6bb3f8`
2. **Task 2: Implement zone overlay + HTML legend (GREEN)** - `41019c9`

## Files Created/Modified
- `client/src/components/TacticalMap.tsx` - Added computeZoneOwner export, zone arc draw sequence, HTML legend JSX
- `client/src/components/TacticalMap.test.tsx` - Added MAP-03 describe block (7 tests); updated MAP-02-d/e assertion counts

## Decisions & Deviations

### Decisions
- computeZoneOwner placed as named export before component — importable without React context
- count-within-radius (not centroid-based) for zone ownership — clearer of the two spec statements
- Tie goes to alpha (`alphaCount >= bravoCount`) — specified explicitly in MAP-03-c behavior
- `screen.getByText('Alpha')` for legend test — text split across spans works because getByText finds partial matches within element content

### Deviations from Plan

**1. [Rule 1 - Bug] Updated MAP-02-d/e test assertions from 3 to 4**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** MAP-02-d asserted `beginPath.mock.calls.length === 3` and MAP-02-e asserted `arc.mock.calls.length === 3`. After adding zone arc, both are now 4 (3 unit dots + 1 zone arc). The zone overlay is the correct new behavior.
- **Fix:** Updated assertions to `toBe(4)` with explanatory comments; updated test names to reflect new count
- **Files modified:** `client/src/components/TacticalMap.test.tsx`
- **Commit:** `41019c9`

## Next Phase Readiness
- Phase 5 complete — TacticalMap renders 20k dots at 60fps with colour coding and zone control overlay
- Phase 6 or downstream phases can use TacticalMap as-is; no changes needed to component interface
- computeZoneOwner is independently testable and can be imported by any other module that needs zone ownership logic

## Self-Check: PASSED
- `client/src/components/TacticalMap.tsx` — FOUND (contains computeZoneOwner export, zone arc, legend JSX)
- `client/src/components/TacticalMap.test.tsx` — FOUND (contains MAP-03 describe block, 7 tests)
- Commit `f6bb3f8` — FOUND (RED tests)
- Commit `41019c9` — FOUND (GREEN implementation)
- 19/19 TacticalMap tests green, 27/27 full client suite green, TypeScript clean
