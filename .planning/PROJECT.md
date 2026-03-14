# War Room Control

## What This Is

A live battle dashboard that tracks a simulated battlefield of 20,000 units in real time. The server runs a continuous 1-second simulation loop; the client visualises the evolving battlefield — unit positions, health, status, and zone control — without ever requiring a page refresh.

## Core Value

The tactical map and dashboard panels update live from a server-pushed stream, showing the full 20k-unit battlefield state at all times without DOM thrashing or page reloads.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Repo scaffolded as npm workspace with `server/` and `client/` packages
- [ ] Server generates 20k units and runs a 1-second tick simulation
- [ ] Server streams only changed units (200–350/tick) via SSE
- [ ] Client bootstraps full state from SSE snapshot on connect
- [ ] Canvas 2D renders all 20k unit dots at 60fps without React re-renders
- [ ] Units panel filterable by status, health range, and search; virtualized list
- [ ] Event feed shows last 50 game events colour-coded by type
- [ ] KPI bar shows live unit counts and zone control per team
- [ ] Performance panel shows FPS, frame time, heap, API latency, update rate
- [ ] GET /units endpoint validates query params via Fastify AJV

### Out of Scope

- Authentication — not required for this exercise
- Database / persistence — simulation is ephemeral in-memory
- Deployment configuration — local dev only
- Pixel-perfect styling — functional UI sufficient

## Context

- Greenfield project, nothing exists yet
- Design spec approved: `docs/superpowers/specs/2026-03-14-war-room-control-design.md`
- Key architectural constraint: Canvas reads Zustand via `getState()` — never via React hooks — to decouple 60fps render loop from React's render cycle

## Constraints

- **Tech stack**: Node.js + TypeScript (tsx watch), Fastify, Vite + React 18, Zustand, Canvas 2D — all pre-decided
- **Transport**: SSE only — server pushes, client never sends mutations
- **Rendering**: Canvas 2D only — no DOM unit elements, no WebGL
- **Performance**: 20k units, 60fps canvas, <1s tick latency

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SSE over WebSocket | Client never sends data; SSE simpler, works through any proxy | — Pending |
| Canvas 2D over WebGL/PixiJS | 20k dots at 60fps within Canvas limits; zero extra deps | — Pending |
| Zustand Map<id, Unit> | O(1) delta patching; lives outside React tree | — Pending |
| Canvas reads getState() not hooks | Decouples 60fps rAF loop from React render cycle | — Pending |
| Fastify + AJV validation | Built-in schema validation satisfies query param requirement | — Pending |
| npm workspaces | Single install, independent run commands per app | — Pending |

---
*Last updated: 2026-03-14 after initialization*
