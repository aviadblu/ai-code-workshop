---
phase: 06-dashboard-panels
plan: "01"
subsystem: client-ui
tags: [react, virtualization, tanstack-virtual, zustand, useMemo, filter]
provides:
  - UnitsPanel with status dropdown, health min/max sliders, search text input filter bar
  - useMemo-derived filtered unit array from Zustand Map store
  - useVirtualizer-powered list rendering only visible rows (not all N units)
  - Health progress bar with colour-coded thresholds (green >66, yellow >33, red <=33)
  - 10 Vitest tests covering UNITS-01/02/03 requirements
affects: [06-dashboard-panels]
tech-stack:
  added: ["@tanstack/react-virtual ^3.13.22"]
  patterns: [useVirtualizer fixed-size list, useMemo filtered array, Zustand selector, jsdom offsetHeight mock]
key-files:
  created:
    - client/src/components/UnitsPanel.test.tsx
  modified:
    - client/src/components/UnitsPanel.tsx
    - client/package.json
    - package-lock.json
key-decisions:
  - "Test queries use getAllByText for status values that appear in both dropdown options and virtual row spans"
  - "useVirtualizer keyed by unit.id not virtualRow.index — stable key across scroll position changes"
  - "useMemo deps: [units, statusFilter, healthMin, healthMax, searchStr] — units Map reference changes each delta"
  - "Scroll container height 40vh inline style — required for jsdom virtualizer to report non-zero offsetHeight"
duration: 3min
completed: 2026-03-15
---

# Phase 6 Plan 01: UnitsPanel — Filter Bar + Virtual List Summary

**UnitsPanel replaced with full implementation: status/health/search filter bar feeding a useVirtualizer list that renders only visible rows from the Zustand units Map, with colour-coded health progress bars.**

## Performance
- **Duration:** ~3 minutes
- **Tasks:** 2 of 2 completed
- **Files modified:** 4 (UnitsPanel.tsx, UnitsPanel.test.tsx, package.json, package-lock.json)

## Accomplishments
- Installed `@tanstack/react-virtual ^3.13.22` — first external UI library added to client
- Created 10 Vitest tests (UNITS-01/02/03) that were RED against the stub and GREEN after implementation
- Replaced stub UnitsPanel with full filter bar (status `<select>`, dual `type="range"` sliders, `type="text"` search) + `useMemo` filtered array + `useVirtualizer` list
- Virtual rows keyed by `unit.id` not index; scroll container given explicit inline height so jsdom virtualizer returns non-zero items
- Health bar renders at `width: ${unit.health}%` with background `#22c55e` / `#eab308` / `#ef4444` per threshold
- All 37 client tests pass (37/37); TypeScript clean

## Task Commits
1. **Task 1: Install @tanstack/react-virtual + write RED tests** - `25a3e4d`
2. **Task 2: Implement UnitsPanel — filter bar + useMemo + virtual list (GREEN)** - `ce8295a`

## Files Created/Modified
- `client/src/components/UnitsPanel.test.tsx` — 10 test cases covering UNITS-01 (filter bar), UNITS-02 (virtualization), UNITS-03 (row content + health bar colours)
- `client/src/components/UnitsPanel.tsx` — full implementation replacing stub
- `client/package.json` — added `@tanstack/react-virtual` dependency
- `package-lock.json` — lockfile updated

## Decisions & Deviations

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test queries ambiguous between dropdown options and row spans**
- **Found during:** Task 2 GREEN phase
- **Issue:** `getByText('idle')` failed with "Found multiple elements" because the status value appears in both the `<option>idle</option>` element and the virtual row `<span>idle</span>`. Same issue for 'moving', 'attacking', 'destroyed'. `getByText('alpha')` failed because two alpha rows exist.
- **Fix:** Changed `getByText` to `getAllByText(...).length >= 1` for all values that appear in dropdown options; revised UNITS-01-d to check that filtered-out unit IDs (u-002, u-003, u-004) are absent rather than checking for absence of status text strings.
- **Files modified:** `client/src/components/UnitsPanel.test.tsx`
- **Commit:** `ce8295a`

## Next Phase Readiness
- Plan 06-02 (EventFeed) and 06-03 (KPIBar) can proceed — virtualization strategy confirmed, Zustand selector pattern established, test infrastructure proven
- `@tanstack/react-virtual` is now available in `client/` for any future plans that need virtualization

## Self-Check: PASSED
- `client/src/components/UnitsPanel.test.tsx` — FOUND
- `client/src/components/UnitsPanel.tsx` — FOUND (replaced stub)
- Commit `25a3e4d` — FOUND
- Commit `ce8295a` — FOUND
- 37/37 tests passing — VERIFIED
- TypeScript clean — VERIFIED
