# Roadmap: War Room Control

## Overview

Build a live battle dashboard from scratch in 7 phases. Start with repo scaffolding and TypeScript setup, layer in the server simulation and SSE transport, then build the client state layer and canvas renderer, and finish with the dashboard panels and performance monitoring. Each phase delivers a working, independently testable slice of the system.

## Phases

- [x] **Phase 1: Foundation** — Repo scaffold, TypeScript config, shared types, basic server + client running
- [x] **Phase 2: Simulation Engine** — 20k unit generation, 1-second tick loop, move/attack/idle/destroyed logic (completed 2026-03-14)
- [ ] **Phase 3: SSE Transport** — SSE connection manager, snapshot on connect, tick broadcast, GET /units endpoint
- [ ] **Phase 4: Client State** — Zustand store with Map-based unit state, ring buffer events, useSSE hook
- [ ] **Phase 5: Tactical Map** — Canvas 2D rAF loop, unit dot rendering, zone control overlay
- [ ] **Phase 6: Dashboard Panels** — Units panel (filters + virtual list), Event feed, KPI bar
- [ ] **Phase 7: Performance Panel** — FPS/heap/latency monitoring, 2Hz updates, collapsible UI

## Phase Details

### Phase 1: Foundation
**Goal**: Both `server/` and `client/` apps scaffold and run; shared TypeScript types defined; npm workspace wired up
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. `npm install` at root installs all packages
  2. `npm run dev:server` starts Fastify and responds to a health check
  3. `npm run dev:client` starts Vite and loads a React page in the browser
  4. `types.ts` defines `Unit`, `Team`, `UnitStatus`, `TickDelta`, `GameEvent`
**Plans**: 3 plans

Plans:
- [x] 01-01: Root workspace + TypeScript config + shared types (`types.ts`)
- [x] 01-02: Fastify server scaffold (entry point, CORS, health check endpoint)
- [x] 01-03: Vite + React 19 client scaffold (basic layout, component stubs)

---

### Phase 2: Simulation Engine
**Goal**: Server generates all 20k units and runs a live tick loop emitting TickDeltas
**Depends on**: Phase 1
**Requirements**: SIM-01, SIM-02, SIM-03, SIM-04
**Success Criteria** (what must be TRUE):
  1. Server logs 20,000 units generated on startup (10k Alpha, 10k Bravo)
  2. Server logs a TickDelta every second containing 200–350 changed units
  3. Attack actions reduce target health; units at health ≤ 0 show status `destroyed`
  4. Move actions change unit x/y by ±5 within 0–1000 bounds
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Vitest scaffold + unit generation (SIM-01, TDD RED→GREEN)
- [ ] 02-02-PLAN.md — Action logic + tick loop: move/attack/idle/destroyed, TickDelta construction (SIM-02/03/04, TDD RED→GREEN)
- [ ] 02-03-PLAN.md — Wire simulation into index.ts + human-verify live server output

---

### Phase 3: SSE Transport
**Goal**: Client can connect and receive a snapshot then live tick deltas; REST endpoint validates queries
**Depends on**: Phase 2
**Requirements**: SSE-01, SSE-02, SSE-03, API-01
**Success Criteria** (what must be TRUE):
  1. Browser `EventSource('/stream')` receives `event: snapshot` with all 20k units on connect
  2. Browser receives `event: tick` with TickDelta JSON every ~1 second thereafter
  3. Killing and restarting the EventSource triggers a new snapshot automatically
  4. `GET /units?team=alpha` returns filtered units; `GET /units?healthMin=abc` returns 400
**Plans**: 2 plans

Plans:
- [ ] 03-01: SSE connection manager — `Set<FastifyReply>`, snapshot on connect, cleanup on close
- [ ] 03-02: Tick broadcast to all subscribers + `GET /units` endpoint with AJV schema validation

---

### Phase 4: Client State
**Goal**: Zustand store receives SSE events and maintains accurate unit state; hook handles reconnection
**Depends on**: Phase 3
**Requirements**: STATE-01, STATE-02
**Success Criteria** (what must be TRUE):
  1. After snapshot, `store.units` contains exactly 20,000 entries
  2. After each tick, only changed units are updated in the map (200–350 `map.set` calls)
  3. `store.events` never exceeds 50 entries
  4. Dropping the network connection and reconnecting restores full state from new snapshot
**Plans**: 2 plans

Plans:
- [ ] 04-01: Zustand store — `Map<string, Unit>`, ring buffer events, `applySnapshot`, `applyDelta`
- [ ] 04-02: `useSSE` hook — `EventSource` lifecycle, snapshot/tick handlers, reconnect on drop

---

### Phase 5: Tactical Map
**Goal**: Canvas renders all 20k units as coloured dots at 60fps without triggering React re-renders
**Depends on**: Phase 4
**Requirements**: MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. Canvas draws ~20,000 dots at 60fps (no React re-renders in React DevTools profiler)
  2. Alpha dots are blue, Bravo dots are red, destroyed dots are grey
  3. A tinted zone circle indicates which team controls the central zone
  4. Canvas resizes correctly when the browser window is resized
**Plans**: 3 plans

Plans:
- [ ] 05-01: Canvas setup — `<canvas>` ref, `ResizeObserver`, `requestAnimationFrame` loop reading `getState()`
- [ ] 05-02: Unit dot rendering — 2px filled circles, Alpha/Bravo/destroyed colour scheme
- [ ] 05-03: Zone control overlay — centroid computation, tinted zone circle, HTML legend overlay

---

### Phase 6: Dashboard Panels
**Goal**: Units panel, event feed, and KPI bar all render live data from the Zustand store
**Depends on**: Phase 4
**Requirements**: UNITS-01, UNITS-02, UNITS-03, EVENTS-01, KPI-01
**Success Criteria** (what must be TRUE):
  1. Units panel filter bar narrows the list by status, health range, and search string
  2. Units list virtualizes rows — scrolling 10k results has no DOM bloat
  3. Event feed shows last 50 events with correct colours (attack=yellow, destroyed=red, capture=green)
  4. KPI bar shows correct Alpha/Bravo alive counts and zone % updating every tick
**Plans**: 3 plans

Plans:
- [ ] 06-01: Units panel — filter bar (status dropdown, health slider, search), `useMemo` filtering, `@tanstack/virtual` list
- [ ] 06-02: Event feed — subscribe to `events` slice, scrolling list, colour-coded event types
- [ ] 06-03: KPI bar — derived counts (alive per team, destroyed, zone %), Zustand subscription

---

### Phase 7: Performance Panel
**Goal**: Collapsible performance overlay shows all 5 metrics at 2Hz with health thresholds, zero overhead when closed
**Depends on**: Phase 5
**Requirements**: PERF-01, PERF-02
**Success Criteria** (what must be TRUE):
  1. FPS counter shows current frames per second (averaged over 60 frames)
  2. JS heap, frame time, API latency, and store update rate all display and update
  3. Panel updates at 2Hz — not every rAF frame
  4. Closing the panel unmounts the component; opening it remounts with fresh metrics
  5. Metrics show green/yellow/red colouring based on health thresholds
**Plans**: 2 plans

Plans:
- [ ] 07-01: Performance data collection — rAF FPS counter, `performance.memory`, `PerformanceObserver`, Zustand update counter
- [ ] 07-02: Performance panel UI — 2Hz display update, collapsible mount/unmount, threshold colouring

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-03-14 |
| 2. Simulation Engine | 3/3 | Complete   | 2026-03-14 |
| 3. SSE Transport | 0/2 | Not started | - |
| 4. Client State | 0/2 | Not started | - |
| 5. Tactical Map | 0/3 | Not started | - |
| 6. Dashboard Panels | 0/3 | Not started | - |
| 7. Performance Panel | 0/2 | Not started | - |
