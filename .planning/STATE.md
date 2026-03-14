# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** Tactical map and dashboard panels update live from a server-pushed stream, showing the full 20k-unit battlefield state without DOM thrashing or page reloads.
**Current focus:** Phase 2 — Simulation Engine

## Current Position

Phase: 1 of 7 (Foundation) — COMPLETE
Plan: 3 of 3 complete
Status: Phase 1 complete — ready for Phase 2
Last activity: 2026-03-14 — Plan 01-03 complete: Vite + React 19 client scaffold, 5 component stubs, TypeScript clean

Progress: [███░░░░░░░] 15%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: ~7.7min
- Total execution time: ~23min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 3/3 | ~23min | ~7.7min |

**Recent Trend:**
- Last 5 plans: 01-01 (~10min), 01-02 (~5min), 01-03 (~8min)
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: SSE over WebSocket — client never sends data
- Init: Canvas 2D over WebGL — 20k dots within Canvas limits
- Init: Zustand Map<id, Unit> — O(1) patching outside React tree
- Init: Canvas reads getState() not hooks — decouples rAF from React renders
- 01-01: React 19 over React 18 — 19.2.4 is current stable, no breaking changes for Phase 1
- 01-01: Types duplicated in server/src and client/src — no shared package avoids NodeNext symlink complexity
- 01-02: top-level await works because server/package.json has "type": "module" — Fastify 5 is ESM-first
- 01-03: @types/react-dom 19.x required alongside @types/react 19.x — they were NOT merged; both packages needed

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-14
Stopped at: Plan 01-03 complete — Vite + React 19 scaffold, 5 component stubs, TypeScript verified
Resume at: Phase 2, Plan 02-01 — Unit generation (10k Alpha + 10k Bravo)
Resume file: None
