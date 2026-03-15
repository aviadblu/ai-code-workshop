---
phase: 04-client-state
plan: 02
subsystem: client-sse
tags: [react, hooks, EventSource, SSE, zustand]
provides:
  - useSSE hook connecting EventSource('/stream') to Zustand store
  - App.tsx wired to open SSE connection on app load
affects: [phase-05-canvas, phase-06-panels]
tech-stack:
  added: []
  patterns: [EventSource lifecycle hook, useEffect cleanup, getState() outside React tree]
key-files:
  created: [client/src/hooks/useSSE.ts]
  modified: [client/src/App.tsx]
key-decisions:
  - "Empty dep array [] — open once on mount, close on unmount; native EventSource reconnect handles retries"
  - "useUnitsStore.getState() (not hook) inside useEffect — hooks-in-hooks not allowed"
  - "No try/catch on JSON.parse for v1 — acceptable per research scope"
duration: 2min
completed: 2026-03-15
---

# Phase 4 Plan 02: useSSE Hook Summary

**EventSource lifecycle hook routing snapshot/tick SSE events to the Zustand Map store, wired into App.tsx**

## Performance
- **Duration:** ~2min
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments
- Created `client/src/hooks/useSSE.ts` — opens EventSource('/stream') once on mount, closes on unmount
- Snapshot SSE events route to `applySnapshot()`, populating the Map store with the full 20k-unit array
- Tick SSE events route to `applyDelta()`, patching only changed units per tick
- Updated `client/src/App.tsx` — `useSSE()` called as first statement in App component body
- TypeScript compiles clean (`npx tsc --noEmit` exits 0)
- All 8 Vitest tests (STATE-01/STATE-02) still pass

## Task Commits
1. **Task 1: Create useSSE hook** - `df8a2fa`
2. **Task 2: Wire useSSE into App.tsx** - `71f4ba4`

## Files Created/Modified
- `client/src/hooks/useSSE.ts` - EventSource lifecycle hook wired to Zustand store actions
- `client/src/App.tsx` - Added useSSE() call at top of App component body

## Decisions & Deviations
- No deviations — plan executed exactly as written.
- Key pattern: `useUnitsStore.getState()` inside `useEffect` (not `useUnitsStore()` hook) is the correct approach; hooks cannot be called inside other hooks.
- Native EventSource auto-reconnect: on reconnect the server emits a fresh `snapshot` event which resets the Map, so no manual retry logic is needed.

## Next Phase Readiness
Phase 5 (Canvas rendering) and Phase 6 (panel components) can now read `useUnitsStore` — the store will be populated as soon as the app loads and the SSE connection receives its first `snapshot` event.

## Self-Check: PASSED
- client/src/hooks/useSSE.ts: FOUND
- client/src/App.tsx: FOUND
- 04-02-SUMMARY.md: FOUND
- Commit df8a2fa: FOUND
- Commit 71f4ba4: FOUND
