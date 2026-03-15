---
phase: 05-tactical-map
plan: "02"
subsystem: client-canvas
tags: [canvas, colour-coding, dot-rendering, requestAnimationFrame, zustand, vitest, tdd]
provides:
  - COLOURS constant at module level (alpha=#3b82f6, bravo=#ef4444, destroyed=#6b7280)
  - Per-unit dot rendering loop using for...of units.values() (no array spread)
  - ctx.beginPath() + ctx.arc(r=1) + ctx.fill() per unit each rAF frame
  - Coordinate scaling: px = (unit.x / 1000) * canvas.width
  - MAP-02 Vitest test suite (6 cases, all green)
affects: [05-tactical-map, client-rendering]
tech-stack:
  added: []
  patterns: [canvas-dot-rendering, colour-lookup-by-status-team, coordinate-scaling]
key-files:
  created: []
  modified:
    - client/src/components/TacticalMap.test.tsx
    - client/src/components/TacticalMap.tsx
key-decisions:
  - "COLOURS const defined at module level (not inside component) — avoids object recreation on every render"
  - "for (const unit of units.values()) over [...units.values()] — prevents 20k-element array allocation per frame at 60fps"
  - "ctx.beginPath() called before every ctx.arc() — prevents path accumulation bug documented in Pitfall 4"
  - "Destroyed status takes priority over team colour regardless of team field value"
duration: 6min
completed: 2026-03-15
---

# Phase 05 Plan 02: TacticalMap Dot Rendering Summary

**COLOURS constant + per-unit arc loop added to rAF draw callback: 20k units rendered as colour-coded 2px dots with correct coordinate scaling — MAP-02 tests green via TDD.**

## Performance
- **Duration:** ~6min
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Added MAP-02 test suite (6 cases) covering fillStyle per team/status, beginPath call count, arc call count, and coordinate scaling
- Added COLOURS const with locked hex values: alpha=#3b82f6, bravo=#ef4444, destroyed=#6b7280
- Replaced `void units` placeholder with `for (const unit of units.values())` loop
- Per-unit draw sequence: colour lookup (destroyed takes priority) → px/py scaling → fillStyle → beginPath → arc(r=1) → fill
- No array spread (`[...units.values()]`) — iterates Map directly to avoid 1.2M allocations/sec at 60fps/20k units
- All MAP-01 + MAP-02 tests green: 12/12 in TacticalMap suite, 20/20 full client suite
- TypeScript clean (`tsc --noEmit` exits 0)

## Task Commits
1. **Task 1: Add MAP-02 failing tests (RED)** - `d98afce`
2. **Task 2: Implement per-unit dot rendering (GREEN)** - `29c6e95`

## Files Created/Modified
- `client/src/components/TacticalMap.test.tsx` - Added 6 MAP-02 test cases with fillStyle spy, canvas sizing helpers, and 3-unit fixture
- `client/src/components/TacticalMap.tsx` - Added COLOURS const + dot rendering loop inside rAF draw callback

## Decisions & Deviations

### Decisions
- COLOURS defined at module level to avoid re-creation per render cycle
- `for...of units.values()` chosen over spread to avoid per-frame array allocation
- Test fillStyle tracking uses `Object.defineProperty` setter spy since mockCtx.fillStyle is a plain property (not a vi.fn); restored after each test to avoid inter-test pollution

### Deviations from Plan
None - plan executed exactly as written.

## Next Phase Readiness
- Plan 05-03 can now add the zone control overlay after the unit dot loop (ctx.arc for the tinted circle, ctx.stroke for outline)
- The draw loop placeholder comment is replaced; 05-03's insertion point is the line after the dot loop closes
- MAP-01 (6 tests) + MAP-02 (6 tests) all green; 05-03 tests will bring MAP-03 coverage
</content>
</invoke>