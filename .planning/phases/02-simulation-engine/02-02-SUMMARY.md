---
phase: 02-simulation-engine
plan: "02"
subsystem: simulation
tags: [typescript, simulation, tick-loop, action-dispatch, tdd, vitest]
provides:
  - runTick(): selects 200-350 living units per tick, dispatches move/attack/idle actions, emits TickDelta to subscribers
  - startTickLoop(): real setInterval(runTick, 1000) replaces stub
  - clamp() helper for coordinate and health bounds
  - pickAction() weighted random: 40% move / 30% attack / 30% idle
  - findNearbyEnemy() O(n) scan with radius-50 proximity check
  - selectLivingUnits() Fisher-Yates partial shuffle
  - changesMap Map<string,Unit> deduplication — last write wins
affects: [sse, client-store, phase-03]
tech-stack:
  added: []
  patterns:
    - Mutate-then-snapshot: spread unit into changesMap, not live reference
    - Map deduplication: changesMap accumulator, Array.from(changesMap.values())
    - Fisher-Yates partial shuffle for O(n) random unit selection
    - Skip-destroyed guard: check status before dispatching action in same tick
key-files:
  created: []
  modified:
    - server/src/simulation.ts
    - server/src/__tests__/simulation.test.ts
key-decisions:
  - "Skip destroyed units mid-tick: unit attacked to 0 health in same tick must not have status overwritten by its own subsequent move/attack action"
  - "ATTACK_RADIUS = 50 as named constant: tunable, 5% of 0-1000 grid, gives realistic combat density"
  - "changesMap.set(target.id, spread) called twice on destroy path: first for health=0, second after status=destroyed — last write wins, correct"
duration: 2min
completed: "2026-03-14"
---

# Phase 02 Plan 02: Tick Loop and Action Logic Summary

**Complete simulation tick engine with move/attack/idle dispatch, changesMap deduplication, and real setInterval loop — all 15 SIM-01 through SIM-04 tests green.**

## Performance
- **Duration:** ~2min
- **Tasks:** 2 completed (RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Added SIM-02/03/04 failing tests (RED commit) then implemented full simulation.ts (GREEN commit)
- runTick() increments tick, selects 200-350 living units via Fisher-Yates partial shuffle, dispatches actions, builds changesMap, emits TickDelta to all subscribers
- Move action: x/y mutated by +-5 (Math.random()*10-5), clamped to [0,1000], status = 'moving', spread snapshot into changesMap
- Attack action: findNearbyEnemy() O(n) scan radius-50; damage = Math.floor(Math.random()*16)+5 (5-20); target.health = Math.max(0, ...); attack event pushed; if health <= 0 then status = 'destroyed' and destroyed event pushed
- Idle action and no-nearby-enemy attack: no mutation, no changesMap entry
- changesMap = Map<string,Unit>: attacker and target both set with spread snapshots; last write wins for duplicates
- startTickLoop() returns setInterval(runTick, 1000) — not the placeholder stub
- TypeScript compiles clean (tsc --noEmit exits 0)

## Task Commits
1. **Task 1: Add SIM-02/03/04 tests (RED)** - `11c42bf`
2. **Task 2: Implement action logic and real tick loop (GREEN)** - `80e64aa`

## Files Created/Modified
- `/Users/aviad/code/ai-code-workshop/server/src/simulation.ts` - Complete implementation: clamp, pickAction, findNearbyEnemy, selectLivingUnits, runTick, real startTickLoop
- `/Users/aviad/code/ai-code-workshop/server/src/__tests__/simulation.test.ts` - Appended SIM-02 (2 tests), SIM-03 (2 tests), SIM-04 (2 tests); total 15 tests

## Decisions & Deviations

### Key Decisions
- ATTACK_RADIUS = 50 named constant (5% of grid) gives realistic combat density with O(n) scan staying within 1s tick budget
- changesMap deduplication ensures client receives clean delta with no duplicate unit IDs

### Deviations from Plan

**1. [Rule 1 - Bug] Skip destroyed units mid-tick to prevent status overwrite**
- **Found during:** Task 2 (GREEN phase), first test run
- **Issue:** A unit attacked to health=0 (status='destroyed') this tick, if also selected for an action, would have its status overwritten to 'moving' or 'attacking'. Test `a unit with health 0 in changes has status destroyed` caught this.
- **Fix:** Added `if (unit.status === 'destroyed') continue` guard at top of the per-unit action loop in runTick()
- **Files modified:** server/src/simulation.ts (1 line added to runTick)
- **Commit:** 80e64aa (included in GREEN commit)

## Next Phase Readiness
- subscribe() and startTickLoop() are ready for Phase 3 (SSE endpoint) to wire into Fastify's /events route
- TickDelta shape (tick, changes[], events[]) matches the SSE JSON payload contract exactly
- getUnits() returns the live Map for the initial snapshot endpoint Phase 3 needs

## Self-Check: PASSED
- server/src/simulation.ts: FOUND
- server/src/__tests__/simulation.test.ts: FOUND
- Commit 11c42bf (RED tests): FOUND
- Commit 80e64aa (GREEN implementation): FOUND
