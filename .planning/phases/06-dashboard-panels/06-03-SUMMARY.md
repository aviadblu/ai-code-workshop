---
phase: 06-dashboard-panels
plan: "03"
subsystem: client-ui
tags: [react, zustand, useMemo, kpi, tdd]
provides:
  - KPIBar with Zustand units subscription and useMemo derived counts
  - 6 Vitest tests covering KPI-01 alive counts, destroyed count, zone %, tick-update reactivity
affects: [06-dashboard-panels]
tech-stack:
  added: []
  patterns: [useUnitsStore selector, useMemo derived counts, alive-count ratio for zone %]
key-files:
  created:
    - client/src/components/KPIBar.test.tsx
  modified:
    - client/src/components/KPIBar.tsx
key-decisions:
  - "Zone % computed as alive-count ratio (not computeZoneOwner canvas call) — simpler, no canvas dimensions needed, continuous metric"
  - "useMemo dep is [units] only — Map reference changes each tick via applyDelta new Map()"
  - "KPI derivation in single for..of units.values() loop — avoids spread allocation"
  - "Guard total = alphaAlive + bravoAlive || 1 prevents division by zero when all units are destroyed"
duration: ~2min
completed: 2026-03-15
requirements:
  - KPI-01
---

# Phase 6 Plan 03: KPIBar — Live KPI Counts Summary

**KPIBar stub replaced with full implementation: subscribes to Zustand units Map, derives alive counts per team and zone % via useMemo in a single for..of loop, renders four live metrics — Alpha alive, Bravo alive, Destroyed, Zone Alpha%/Bravo%.**

## Performance
- **Duration:** ~2 minutes
- **Tasks:** 2 of 2 completed
- **Files modified:** 2 (KPIBar.tsx, KPIBar.test.tsx)

## Accomplishments
- Created 6 Vitest TDD tests (KPI-01-a through KPI-01-f) that were RED against the stub and GREEN after implementation
- Replaced stub KPIBar (just a div with "KPIBar" text) with full live-data component
- useUnitsStore(s => s.units) selector — re-renders on every new Map reference (each tick delta)
- useMemo kpi block iterates units.values() once, counting alphaAlive, bravoAlive, destroyed
- Zone % = alive-count ratio: alphaZonePct = Math.round(alphaAlive / total * 100); bravoZonePct = 100 - alpha
- Division-by-zero guard: `total = alphaAlive + bravoAlive || 1`
- All 6 KPI-01 tests pass; 49 total tests in suite (43 unrelated passing)

## Task Commits
1. **Task 1: Write KPI-01 failing tests (RED)** - `221f7a4`
2. **Task 2: Implement KPIBar — units subscription, useMemo derived counts (GREEN)** - `a0cb4fd`

## Files Created/Modified
- `client/src/components/KPIBar.test.tsx` — 6 test cases covering KPI-01-a (alpha alive), KPI-01-b (bravo alive), KPI-01-c (destroyed count), KPI-01-d (alpha zone %), KPI-01-e (bravo zone %), KPI-01-f (tick-update reactivity)
- `client/src/components/KPIBar.tsx` — full implementation replacing stub; 29 lines

## Decisions & Deviations

### Auto-fixed Issues

None — plan executed exactly as written.

### Deferred Issues (Out of Scope)

**EventFeed.test.tsx failing (pre-existing from Plan 06-02)**
- `EventFeed.test.tsx` was committed in RED state during Plan 06-02 and never made GREEN in that plan
- 6 tests fail with `toBeInTheDocument` matcher issues (TypeScript type mismatch)
- These failures pre-date this plan and are not caused by KPIBar changes
- KPIBar's own 6 tests and all other 43 unrelated tests pass
- Deferred to Plan 06-02 retroactive fix or Phase 6 cleanup

## Next Phase Readiness
- KPIBar is feature-complete and KPI-01 requirement satisfied
- Phase 6 Wave 2 (06-03) complete; EventFeed (06-02) still needs its GREEN phase
- No new dependencies added

## Self-Check: PASSED
- `client/src/components/KPIBar.test.tsx` — FOUND
- `client/src/components/KPIBar.tsx` — FOUND (replaced stub)
- Commit `221f7a4` — FOUND
- Commit `a0cb4fd` — FOUND
- 6/6 KPI-01 tests passing — VERIFIED
- useMemo, useUnitsStore, s.units, units.values(), alphaZonePct/bravoZonePct, destroyed all present — VERIFIED
