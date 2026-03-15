# Requirements: War Room Control

**Defined:** 2026-03-14
**Core Value:** Tactical map and dashboard panels update live from a server-pushed stream, showing the full 20k-unit battlefield state at all times without DOM thrashing or page reloads.

## v1 Requirements

### Infrastructure

- [ ] **INFRA-01**: Root npm workspace installs both `server/` and `client/` packages with a single `npm install`
- [ ] **INFRA-02**: Server starts with a single command and serves on a configured port
- [ ] **INFRA-03**: Client starts with a single command and connects to the server

### Simulation

- [x] **SIM-01**: Server generates 10,000 Alpha and 10,000 Bravo units with random positions (0–1000) and random health (0–100) on startup
- [x] **SIM-02**: Server runs a 1-second tick loop that selects 200–350 random living units per tick
- [x] **SIM-03**: Each selected unit performs one action per tick: move (±5 x/y), attack (reduce nearby enemy health 5–20), or idle
- [x] **SIM-04**: Units reaching health ≤ 0 transition to `destroyed` status

### SSE Transport

- [x] **SSE-01**: Client receives a full snapshot of all 20k units on SSE connection (`event: snapshot`)
- [x] **SSE-02**: Client receives a `TickDelta` (changed units + game events) every second (`event: tick`)
- [x] **SSE-03**: SSE connection auto-reconnects on drop and re-bootstraps from a new snapshot before resuming delta application

### API

- [x] **API-01**: `GET /units` validates query params (`team`, `status`, `healthMin`, `healthMax`, `search`) via Fastify AJV schema and returns 400 with error detail on invalid input

### Client State

- [x] **STATE-01**: Zustand store holds all units in a `Map<string, Unit>` and applies deltas via O(1) `map.set()` patching — only changed units touched
- [x] **STATE-02**: Store maintains a ring buffer of the last 50 game events — capped regardless of events per tick

### Tactical Map

- [x] **MAP-01**: Canvas 2D renders all 20k unit dots at 60fps via `requestAnimationFrame` — reads store via `getState()`, never via React hooks
- [x] **MAP-02**: Unit dots are colour-coded: Alpha=blue, Bravo=red, destroyed=grey
- [x] **MAP-03**: Canvas renders a zone control overlay (tinted circle) indicating which team owns the central zone based on unit centroids

### Units Panel

- [x] **UNITS-01**: Units panel has a filter bar with status dropdown, health range slider (0–100), and ID/name search input
- [x] **UNITS-02**: Filtered unit list is virtualized with `@tanstack/virtual` — only visible rows rendered regardless of result size
- [x] **UNITS-03**: List columns show: ID, Team, Status, Health (colour-coded progress bar)

### Event Feed

- [x] **EVENTS-01**: Event feed displays the last 50 game events as a scrolling list, colour-coded: attack=yellow, destroyed=red, capture=green

### KPI Bar

- [x] **KPI-01**: KPI bar shows live counts: Alpha alive, Bravo alive, total destroyed, zone control % per team — updates every tick

### Performance Panel

- [x] **PERF-01**: Performance panel displays FPS, frame time (ms), JS heap (MB), API latency, and store update rate — all sourced from browser APIs only
- [x] **PERF-02**: Performance panel updates at 2Hz, is conditionally mounted (zero overhead when closed), and applies green/yellow/red health thresholds per metric

## v2 Requirements

### Gaming UI Theme

- [x] **UI-01**: Global dark military theme applied to all panels — `#0a0a0a` background, military green (`#00ff41`) primary accent, amber (`#ff8c00`) warning, monospace font (`'Share Tech Mono', monospace`), CSS custom properties at `:root` level
- [x] **UI-02**: All panels styled as HUD overlays — 1px military-green border, subtle scanline background texture (CSS repeating-linear-gradient), glow effects on live-updating values, ALLCAPS section labels
- [x] **UI-03**: KPI bar restyled as tactical readout — each metric in a bordered inset cell, team-coloured alpha/bravo values, amber pulse animation on value changes

### Interactive Tactical Map

- [x] **MAP-04**: Tactical map supports mouse-wheel zoom (0.5×–20× range, centered on cursor position) — zoom transforms the canvas rendering coordinate system, not CSS scale
- [x] **MAP-05**: Tactical map supports mouse-drag pan — left-button drag shifts the canvas origin offset; pan is constrained so the map cannot be dragged fully off-screen
- [ ] **MAP-06**: Map controls bar shows current zoom level, zoom-in (+), zoom-out (−), and reset-to-fit buttons; `R` keyboard shortcut also resets view

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
| SIM-01 | Phase 2 | Complete |
| SIM-02 | Phase 2 | Complete |
| SIM-03 | Phase 2 | Complete |
| SIM-04 | Phase 2 | Complete |
| SSE-01 | Phase 3 | Complete |
| SSE-02 | Phase 3 | Complete |
| SSE-03 | Phase 3 | Complete |
| API-01 | Phase 3 | Complete |
| STATE-01 | Phase 4 | Complete |
| STATE-02 | Phase 4 | Complete |
| MAP-01 | Phase 5 | Complete |
| MAP-02 | Phase 5 | Complete |
| MAP-03 | Phase 5 | Complete |
| UNITS-01 | Phase 6 | Complete |
| UNITS-02 | Phase 6 | Complete |
| UNITS-03 | Phase 6 | Complete |
| EVENTS-01 | Phase 6 | Complete |
| KPI-01 | Phase 6 | Complete |
| PERF-01 | Phase 7 | Complete |
| PERF-02 | Phase 7 | Complete |
| UI-01 | Phase 8 | Complete |
| UI-02 | Phase 8 | Complete |
| UI-03 | Phase 8 | Complete |
| MAP-04 | Phase 9 | Complete |
| MAP-05 | Phase 9 | Complete |
| MAP-06 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 23 total
- v2 requirements: 6 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after initial definition*
