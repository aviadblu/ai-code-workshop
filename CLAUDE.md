# War Room Control — CLAUDE.md

Live battle dashboard: 20k units, 1Hz server simulation, SSE transport, 60fps canvas render.

## Quick Start

```bash
npm install                  # Install all workspace deps (server + client)
npm run dev:server           # Terminal 1: Fastify on :3000 (tsx watch)
npm run dev:client           # Terminal 2: Vite on :5173, proxies API to :3000
npm test                     # All tests (both workspaces)
```

## Architecture

```
Server (Fastify :3000)
  simulation.ts  →  1Hz tick → 200–350 unit changes → TickDelta
  sse.ts         →  SSE /stream: snapshot on connect, broadcast on tick

Client (Vite :5173)
  useSSE.ts      →  EventSource('/stream') → applySnapshot / applyDelta
  store/units.ts →  Zustand Map<id, Unit>  (O(1) delta patching)
  TacticalMap    →  60fps rAF loop reads getState() — no React re-renders
```

**Key decisions:**
- SSE not WebSocket — client never sends data; simpler, works through proxies
- Canvas 2D not WebGL — 20k dots within limits, zero extra deps
- `getState()` in rAF loop — decouples 60fps rendering from React render cycle
- Zustand `Map<id, Unit>` — O(1) set per changed unit, not O(n) array replace

## Project Structure

```
server/src/
  index.ts        Fastify app setup, CORS, simulation lifecycle
  simulation.ts   Unit generation (20k), 1Hz tick, move/attack/idle/destroyed logic
  sse.ts          /stream SSE, /units query endpoint (AJV validated), /reset
  types.ts        Shared types: Unit, Team, UnitStatus, TickDelta, GameEvent

client/src/
  App.tsx                    Layout, tabs, connection indicator
  components/
    TacticalMap.tsx          Canvas rAF loop; zoom/pan; colored dots; zone overlay
    UnitsPanel.tsx           Virtualized unit list (@tanstack/react-virtual)
    EventFeed.tsx            Last 50 game events, color-coded
    KPIBar.tsx               Live KPIs (unit counts, zone %, destroyed)
    PerformancePanel.tsx     FPS, heap, latency, update rate at 2Hz
  hooks/
    useSSE.ts                EventSource lifecycle, connection status (module-level)
    usePerformance.ts        rAF FPS, performance.memory, PerformanceObserver
  store/units.ts             Zustand store: Map + 50-event ring buffer
  index.css                  HUD design tokens, scanline texture, pulse keyframes
```

## Tests

- **Framework:** Vitest + React Testing Library (jsdom for client, node for server)
- **Coverage:** 85 tests across 9 phases (all passing)
- **Run:** `npm test` (root) or `npm test --workspace=client|server`
- **Watch:** `npm test -- --watch` from workspace dir

**Gotchas:**
- jsdom normalizes hex → `rgb()` — write color assertions as `rgb(r, g, b)`
- `vi.useFakeTimers()` required for timer-based tests (PerformancePanel)
- SSE server tests use real HTTP on port 0 — `server.inject()` hangs on endless streams
- Access store in hooks/effects with `useUnitsStore.getState()`, not the hook

## Common Tasks

**Add a new dashboard panel:**
1. Create `client/src/components/MyPanel.tsx`
2. Read from store: `const units = useUnitsStore(s => s.units)`
3. Add tab/route in `App.tsx`
4. Co-locate test: `MyPanel.test.tsx`

**Modify simulation behavior:**
- Edit `server/src/simulation.ts` — action selection, tick interval, unit counts

**Debug canvas rendering:**
- Check `TacticalMap.tsx` — rAF loop, zoom/pan refs, `drawingBufferRef`

**Debug SSE / connection issues:**
- Check `useSSE.ts` — EventSource lifecycle, `onmessage` handlers
- Server: `sse.ts` — broadcast, snapshot serialization

## Constraints

- **No `any` types** — strict TypeScript throughout; all types explicitly declared
- **No polling** — SSE only for live data; `EventSource` not `setInterval` fetch
- **No DOM in rAF loop** — canvas renders via `getState()`, never via React state
- **Workspaces** — `server/` and `client/` are independent npm workspaces with separate configs

## Planning Artifacts

`.planning/` contains GSD state tracking:
- `ROADMAP.md` — 9-phase plan (all completed, March 2026)
- `REQUIREMENTS.md` — v1/v2 requirement specs with pass/fail checklist
- `STATE.md` — Milestone state, architecture decisions, velocity data
- `PROJECT.md` — Project reference and key decisions table
