---
phase: 04-client-state
plan: 01
subsystem: client-state
tags: [zustand, vitest, jsdom, typescript, tdd]
provides:
  - Zustand store with Map<string,Unit> + ring buffer (useUnitsStore)
  - Vitest test environment with jsdom for client-side unit tests
  - STATE-01 and STATE-02 test coverage (8 tests, all passing)
affects: [04-02-useSSE, Phase 5 Canvas, Phase 6 panels]
tech-stack:
  added: [zustand@5.0.11, vitest@3.2.4, jsdom@26.1.0, @testing-library/react@16.3.2]
  patterns: [Zustand Map immutability via new Map(state.units), ring buffer via slice(-50), TDD RED-GREEN cycle, direct getState() testing without renderHook]
key-files:
  created:
    - client/vitest.config.ts
    - client/src/store/units.ts
    - client/src/store/units.test.ts
  modified:
    - client/package.json
    - client/tsconfig.json
    - package-lock.json
key-decisions:
  - "vitest globals:true requires types:[vitest/globals] in tsconfig for tsc --noEmit to pass — added as auto-fix"
  - "zustand@5.0.11 installed in client dependencies; hoisted to workspace root node_modules by npm workspaces"
duration: 5min
completed: 2026-03-15
---

# Phase 4 Plan 01: Zustand Units Store Summary

**Zustand Map<string,Unit> store with ring buffer wired up via TDD: 8 tests across STATE-01/STATE-02 all green, TypeScript clean.**

## Performance
- **Duration:** ~5 min
- **Tasks:** 2 completed
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Installed zustand@5.0.11, vitest@3.2.4, jsdom@26.1.0, @testing-library/react@16.3.2 via npm workspaces
- Created `client/vitest.config.ts` with jsdom environment and globals:true
- Implemented `useUnitsStore` with `Map<string,Unit>` state, `applySnapshot`, `applyDelta`, ring-buffered `events`, `tick` counter
- All 8 STATE-01/STATE-02 tests pass: 5 Map-behavior tests + 3 ring-buffer tests
- TypeScript check (tsc --noEmit) passes with zero errors

## Task Commits
1. **Task 1: Install deps and create Vitest config** - `bfdcad4`
2. **Task 2 RED: Failing STATE-01/STATE-02 tests** - `959cd27`
3. **Task 2 GREEN: Zustand units store implementation** - `7262353`
4. **Auto-fix: tsconfig vitest globals** - `04b93ff`

## Files Created/Modified
- `client/vitest.config.ts` — Vitest config, jsdom environment, globals:true
- `client/src/store/units.ts` — useUnitsStore: Map<string,Unit> + applySnapshot + applyDelta + ring buffer
- `client/src/store/units.test.ts` — 8 tests covering STATE-01 (Map behavior) and STATE-02 (ring buffer)
- `client/package.json` — Added zustand dep + vitest/jsdom/testing-library devDeps
- `client/tsconfig.json` — Added `"types": ["vitest/globals"]` so tsc recognizes test globals
- `package-lock.json` — Updated workspace lockfile

## Decisions & Deviations

**Decisions:**
- zustand hoisted to workspace root (npm workspaces behavior) — works correctly; no client-level node_modules needed
- `new Map(state.units)` always used in applyDelta — required for Zustand reactivity (same-reference mutations not detected)
- `[...state.events, ...delta.events].slice(-50)` for ring buffer — idiomatic, zero extra dependencies

**Deviations:**

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added vitest/globals types to tsconfig**
- **Found during:** Task 2 GREEN verification (`npx tsc --noEmit`)
- **Issue:** TypeScript reported 29 errors — `describe`, `it`, `expect`, `beforeEach` not found because tsconfig had no vitest type declarations, even though vitest.config.ts has `globals: true`
- **Fix:** Added `"types": ["vitest/globals"]` to `client/tsconfig.json` compilerOptions
- **Files modified:** `client/tsconfig.json`
- **Commit:** `04b93ff`

## Next Phase Readiness
- `useUnitsStore` is ready for 04-02 (useSSE hook) — `applySnapshot` and `applyDelta` actions are the exact API the hook calls
- Vitest test environment is set up for all future client-side tests (04-02 hook tests, Phase 5 Canvas)
- Canvas rAF loop (Phase 5) can use `useUnitsStore.getState().units` directly — no hook needed

## Self-Check: PASSED
- `client/vitest.config.ts` — FOUND
- `client/src/store/units.ts` — FOUND
- `client/src/store/units.test.ts` — FOUND
- Commit `bfdcad4` — FOUND
- Commit `959cd27` — FOUND
- Commit `7262353` — FOUND
- Commit `04b93ff` — FOUND
- All 8 tests GREEN — CONFIRMED
- `tsc --noEmit` exits 0 — CONFIRMED
