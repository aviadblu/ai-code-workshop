# Requirements: War Room Control

**Defined:** 2026-03-14
**Core Value:** Tactical map and dashboard panels update live from a server-pushed stream, showing the full 20k-unit battlefield state at all times without DOM thrashing or page reloads.

## v1 Requirements

### Infrastructure

- [ ] **INFRA-01**: Root npm workspace installs both `server/` and `client/` packages with a single `npm install`
- [ ] **INFRA-02**: Server starts with a single command and serves on a configured port
- [ ] **INFRA-03**: Client starts with a single command and connects to the server

### Simulation

- [ ] **SIM-01**: Server generates 10,000 Alpha and 10,000 Bravo units with random positions (0–1000) and random health (0–100) on startup
- [ ] **SIM-02**: Server runs a 1-second tick loop that selects 200–350 random living units per tick
- [ ] **SIM-03**: Each selected unit performs one action per tick: move (±5 x/y), attack (reduce nearby enemy health 5–20), or idle
- [ ] **SIM-04**: Units reaching health ≤ 0 transition to `destroyed` status

### SSE Transport

- [ ] **SSE-01**: Client receives a full snapshot of all 20k units on SSE connection (`event: snapshot`)
- [ ] **SSE-02**: Client receives a `TickDelta` (changed units + game events) every second (`event: tick`)
- [ ] **SSE-03**: SSE connection auto-reconnects on drop and re-bootstraps from a new snapshot before resuming delta application

### API

- [ ] **API-01**: `GET /units` validates query params (`team`, `status`, `healthMin`, `healthMax`, `search`) via Fastify AJV schema and returns 400 with error detail on invalid input

### Client State

- [ ] **STATE-01**: Zustand store holds all units in a `Map<string, Unit>` and applies deltas via O(1) `map.set()` patching — only changed units touched
- [ ] **STATE-02**: Store maintains a ring buffer of the last 50 game events — capped regardless of events per tick

### Tactical Map

- [ ] **MAP-01**: Canvas 2D renders all 20k unit dots at 60fps via `requestAnimationFrame` — reads store via `getState()`, never via React hooks
- [ ] **MAP-02**: Unit dots are colour-coded: Alpha=blue, Bravo=red, destroyed=grey
- [ ] **MAP-03**: Canvas renders a zone control overlay (tinted circle) indicating which team owns the central zone based on unit centroids

### Units Panel

- [ ] **UNITS-01**: Units panel has a filter bar with status dropdown, health range slider (0–100), and ID/name search input
- [ ] **UNITS-02**: Filtered unit list is virtualized with `@tanstack/virtual` — only visible rows rendered regardless of result size
- [ ] **UNITS-03**: List columns show: ID, Team, Status, Health (colour-coded progress bar)

### Event Feed

- [ ] **EVENTS-01**: Event feed displays the last 50 game events as a scrolling list, colour-coded: attack=yellow, destroyed=red, capture=green

### KPI Bar

- [ ] **KPI-01**: KPI bar shows live counts: Alpha alive, Bravo alive, total destroyed, zone control % per team — updates every tick

### Performance Panel

- [ ] **PERF-01**: Performance panel displays FPS, frame time (ms), JS heap (MB), API latency, and store update rate — all sourced from browser APIs only
- [ ] **PERF-02**: Performance panel updates at 2Hz, is conditionally mounted (zero overhead when closed), and applies green/yellow/red health thresholds per metric

## v2 Requirements

### Potential Future Scope

- **V2-01**: Replay mode — scrub through tick history
- **V2-02**: Unit detail panel — click a dot on the map to inspect a unit
- **V2-03**: Multi-client support with shared simulation state (currently stateful per-process)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Authentication | Not required for this exercise |
| Database / persistence | Simulation is ephemeral in-memory; persistence adds infra complexity |
| Deployment configuration | Local dev only |
| Pixel-perfect styling | Functional UI sufficient |
| WebSocket transport | SSE sufficient — client never sends data |
| WebGL / PixiJS rendering | Canvas 2D handles 20k dots; no added value |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| SIM-01 | Phase 2 | Pending |
| SIM-02 | Phase 2 | Pending |
| SIM-03 | Phase 2 | Pending |
| SIM-04 | Phase 2 | Pending |
| SSE-01 | Phase 3 | Pending |
| SSE-02 | Phase 3 | Pending |
| SSE-03 | Phase 3 | Pending |
| API-01 | Phase 3 | Pending |
| STATE-01 | Phase 4 | Pending |
| STATE-02 | Phase 4 | Pending |
| MAP-01 | Phase 5 | Pending |
| MAP-02 | Phase 5 | Pending |
| MAP-03 | Phase 5 | Pending |
| UNITS-01 | Phase 6 | Pending |
| UNITS-02 | Phase 6 | Pending |
| UNITS-03 | Phase 6 | Pending |
| EVENTS-01 | Phase 6 | Pending |
| KPI-01 | Phase 6 | Pending |
| PERF-01 | Phase 7 | Pending |
| PERF-02 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after initial definition*
