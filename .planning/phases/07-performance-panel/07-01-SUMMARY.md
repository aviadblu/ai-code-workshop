---
phase: 07-performance-panel
plan: "01"
subsystem: client-hooks
tags: [usePerformance, PerfSnapshot, rAF, PerformanceObserver, Zustand, TDD]
provides:
  - "usePerformance hook returning PerfSnapshot with fps, frameTime, heap, apiLatency, storeRate"
  - "PerfSnapshot interface exported for PerformancePanel (07-02)"
  - "PERF-01 full test coverage — 8 unit tests"
affects: [07-performance-panel, client-hooks]
tech-stack:
  added: []
  patterns:
    - "rAF timestamp ring buffer (up to 60 frames) for FPS averaging"
    - "Ref accumulation pattern — metricsRef mutated in rAF, setSnapshot only in 2Hz setInterval"
    - "vi.useFakeTimers() + vi.stubGlobal pattern for jsdom timer/API mocking"
key-files:
  created:
    - "client/src/hooks/usePerformance.ts"
    - "client/src/hooks/usePerformance.test.ts"
  modified: []
key-decisions:
  - "vi.useFakeTimers() added to beforeEach — vi.advanceTimersByTime(500) requires fake timers active"
  - "clearInterval stubbed per-test (not globally) in cleanup test — vi.useFakeTimers() does not make clearInterval a vi spy"
  - "All metric accumulation via metricsRef — setSnapshot only inside 500ms interval to keep React renders at 2Hz"
duration: 4min
completed: 2026-03-15
---

# Phase 07 Plan 01: usePerformance Hook Summary

**usePerformance hook wiring five browser API metrics (rAF FPS ring buffer, PerformanceObserver latency, Zustand counter) with 2Hz setSnapshot throttle and full cleanup**

## Performance
- **Duration:** ~4 min
- **Tasks:** 2 completed (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Created `usePerformance.ts` exporting `PerfSnapshot` interface and `usePerformance` hook
- FPS averaged over last 60 rAF timestamps using ring buffer (`rafTimestampsRef`)
- frameTime is raw rAF delta rounded to 2 decimal places
- heap reads `(performance as any).memory?.usedJSHeapSize ?? 0` divided by 1048576 — Chrome guard applied
- apiLatency captured via PerformanceObserver watching `resource` entries containing `/stream`
- storeRate counts Zustand `useUnitsStore.subscribe()` callbacks since last 500ms interval; counter reset to 0 after each capture
- All 4 side effects fully cleaned up on unmount: cancelAnimationFrame, clearInterval, observer.disconnect, unsubscribe
- 8 unit tests written (RED then GREEN) covering all 5 metrics + cleanup
- Full suite 57/57 tests passing — no regressions

## PerfSnapshot Type

```typescript
export interface PerfSnapshot {
  fps: number        // averaged over last 60 rAF frames
  frameTime: number  // ms delta of most recent rAF call
  heap: number       // MB from performance.memory, 0 if unavailable
  apiLatency: number // ms from PerformanceObserver resource entry for /stream
  storeRate: number  // Zustand store updates since last 500ms interval reset
}
```

## Task Commits
1. **Task 1: RED — failing tests for usePerformance** - `47c24f1`
2. **Task 2: GREEN — usePerformance implementation** - `6cb1a0b`

## Files Created/Modified
- `client/src/hooks/usePerformance.ts` — hook + PerfSnapshot interface, 73 lines
- `client/src/hooks/usePerformance.test.ts` — 8 unit tests with jsdom mocks, 185 lines

## Decisions & Deviations

### Deviations from Plan

**1. [Rule 1 - Bug] Added vi.useFakeTimers() to beforeEach**
- **Found during:** Task 2 GREEN verification
- **Issue:** Tests calling `vi.advanceTimersByTime(500)` failed with "Timers are not mocked" — the plan's `beforeEach` block did not include `vi.useFakeTimers()`
- **Fix:** Added `vi.useFakeTimers()` call at the top of each `beforeEach`
- **Files modified:** `client/src/hooks/usePerformance.test.ts`
- **Commit:** `6cb1a0b`

**2. [Rule 1 - Bug] Per-test clearInterval stub in cleanup test**
- **Found during:** Task 2 GREEN verification
- **Issue:** `expect(clearInterval).toHaveBeenCalled()` threw "not a spy" — `vi.useFakeTimers()` replaces clearInterval but does not make it a vi spy assertable with `toHaveBeenCalled()`
- **Fix:** Added `vi.stubGlobal('clearInterval', vi.fn())` inside the cleanup test only, and asserted on the stub
- **Files modified:** `client/src/hooks/usePerformance.test.ts`
- **Commit:** `6cb1a0b`

## Self-Check: PASSED

- client/src/hooks/usePerformance.ts: FOUND
- client/src/hooks/usePerformance.test.ts: FOUND
- .planning/phases/07-performance-panel/07-01-SUMMARY.md: FOUND
- Commit 47c24f1 (RED): FOUND
- Commit 6cb1a0b (GREEN): FOUND
- `(performance as any).memory?.usedJSHeapSize ?? 0` guard: FOUND
- useUnitsStore.subscribe: 1 match (correct)

## Next Phase Readiness
- `PerfSnapshot` interface and `usePerformance` hook are ready for consumption by 07-02 `PerformancePanel`
- `PerfMetrics` child component pattern documented in RESEARCH.md — call `usePerformance()` inside the conditionally-mounted inner component to satisfy React hook rules
