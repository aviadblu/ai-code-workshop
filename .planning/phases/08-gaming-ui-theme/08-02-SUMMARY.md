---
phase: 08-gaming-ui-theme
plan: 02
subsystem: ui
tags: [react, vitest, css, hud, animation, pulse, gaming-ui]

# Dependency graph
requires:
  - phase: 08-01
    provides: HUD CSS tokens (.hud-panel, .pulse-value, .hud-label, --hud-font, --hud-border)
provides:
  - PulsingValue component in KPIBar with useRef renderCount key trick for CSS retrigger
  - All dashboard panels (EventFeed, UnitsPanel, PerformancePanel) using .hud-panel class
  - KPIBar as bordered-cell tactical readout with amber pulse animation
  - TacticalMap legend with military-green border and var(--hud-font)
  - UI-03-f regression test asserting .pulse-value class on KPI value spans
affects: [any future panel or dashboard layout work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PulsingValue: useRef renderCount incremented per render, passed as key prop to force remount and retrigger @keyframes"
    - "Destroyed cell uses outer span wrapper so .closest('span') traversal finds combined label+value text"
    - "Non-span label elements (div.hud-label) allow .closest('span') to correctly traverse to parent span"

key-files:
  created: []
  modified:
    - client/src/components/KPIBar.tsx
    - client/src/components/KPIBar.test.tsx
    - client/src/components/EventFeed.tsx
    - client/src/components/UnitsPanel.tsx
    - client/src/components/PerformancePanel.tsx
    - client/src/components/TacticalMap.tsx
    - client/src/components/TacticalMap.test.tsx

key-decisions:
  - "PulsingValue Destroyed cell: outer span wrapper with div.hud-label inside — .closest('span') finds the outer span containing both label text and value (passes KPI-01-c)"
  - "TacticalMap legend text updated to ALLCAPS (ALPHA/BRAVO/KIA) per HUD aesthetic; MAP-03-g test updated to match"

patterns-established:
  - "PulsingValue pattern: useRef counter as key prop on span forces remount every render, retriggering CSS @keyframes animation"
  - "DOM traversal-aware markup: use div labels (not span) when test .closest('span') must find a parent span containing label+value"

requirements-completed: [UI-02, UI-03]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 8 Plan 02: HUD Component Restyling Summary

**KPIBar restyled as bordered-cell tactical readout with PulsingValue amber animation; all five dashboard panels adopt .hud-panel class; TacticalMap legend gets military-green HUD border and font**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-15T15:07:27Z
- **Completed:** 2026-03-15T15:09:55Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- KPIBar rebuilt with bordered cells (#00ff41), PulsingValue helper using renderCount useRef key trick to retrigger `pulse-amber` animation per render
- EventFeed, UnitsPanel, PerformancePanel each have `className="hud-panel"` on outermost div; inline border styles removed
- TacticalMap legend replaced with 1px #00ff41 border, dark background, `var(--hud-font)`, ALLCAPS ALPHA/BRAVO/KIA labels
- UI-03-f test added and passes: confirms >= 5 `.pulse-value` spans in KPIBar
- All 67 tests green including all KPI-01 assertions and protected colour assertions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add UI-03-f failing test (RED)** - `3b18cd5` (test)
2. **Task 2: Restyle KPIBar with PulsingValue + cells (GREEN)** - `f79f0a2` (feat)
3. **Task 3: Apply .hud-panel to all panels + TacticalMap legend** - `5acbd9f` (feat)

## Files Created/Modified
- `client/src/components/KPIBar.tsx` - Replaced with PulsingValue helper, CELL style const, bordered cells, .hud-panel wrapper
- `client/src/components/KPIBar.test.tsx` - Added UI-03-f test for .pulse-value class
- `client/src/components/EventFeed.tsx` - Added className="hud-panel", removed inline border, added Event Log label
- `client/src/components/UnitsPanel.tsx` - Added className="hud-panel", removed inline border, added Units label
- `client/src/components/PerformancePanel.tsx` - Added className="hud-panel", changed fontFamily to var(--hud-font)
- `client/src/components/TacticalMap.tsx` - Legend overlay restyled with #00ff41 border, HUD font, ALLCAPS text
- `client/src/components/TacticalMap.test.tsx` - Updated MAP-03-g assertions to match ALLCAPS ALPHA/BRAVO/KIA text

## Decisions Made
- **PulsingValue Destroyed cell structure:** The "Destroyed" label must be a `<div>` (not `<span>`) inside an outer `<span>`, so that KPI-01-c's `.closest('span')` call traverses up to the outer span whose `textContent` contains both "Destroyed" and "2".
- **TacticalMap test update (MAP-03-g):** Updated to use regex `/ALPHA/`, `/BRAVO/`, `/KIA/` to match the new ALLCAPS legend text. This is intentional: the plan specifies ALLCAPS and the test was verifying old text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated MAP-03-g test to match ALLCAPS legend text**
- **Found during:** Task 3 (Apply .hud-panel to panels and restyle TacticalMap legend)
- **Issue:** TacticalMap.test.tsx MAP-03-g queried `screen.getByText('Alpha')`, `'Bravo'`, `'Destroyed'` — exact strings that no longer exist after ALLCAPS rename to ALPHA/BRAVO/KIA
- **Fix:** Changed test assertions to regex `/ALPHA/`, `/BRAVO/`, `/KIA/`
- **Files modified:** `client/src/components/TacticalMap.test.tsx`
- **Verification:** All 67 tests pass
- **Committed in:** `5acbd9f` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test assertion update to match intentional text change)
**Impact on plan:** Required to keep test suite green after ALLCAPS legend rename. No scope creep.

## Issues Encountered
- KPI-01-c assertion `screen.getByText(/Destroyed/i).closest('span')?.textContent.toContain('2')` required careful DOM structure: "Destroyed" label as `<div>` inside an outer `<span>` so `.closest('span')` finds the containing span with both texts. First attempt used `<span className="hud-label">` which returned itself (just "Destroyed"), failing the test.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 08 complete: HUD tokens (08-01) and component restyling (08-02) both done
- All dashboard panels use .hud-panel; KPIBar has amber pulse animation
- 67 tests green; protected colours (EVENT_COLOURS, healthColour, thresholdColour) unchanged
- Ready for Phase 09 or any further UI polish

## Self-Check: PASSED

All files confirmed present on disk. All task commits verified in git log.

---
*Phase: 08-gaming-ui-theme*
*Completed: 2026-03-15*
