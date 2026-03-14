# War Room Control — Design Spec
**Date:** 2026-03-14
**Status:** Approved

---

## Overview

A live battle dashboard tracking a simulated battlefield of 20,000 units in real time. The server runs a continuous simulation; the client visualises the battlefield as it evolves without page refresh.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Server runtime | Node.js + TypeScript (`tsx watch`) | Required by spec |
| Server framework | Fastify | Built-in AJV schema validation for query params |
| Transport | Server-Sent Events (SSE) | One-way push, no bidirectional need, works through any proxy |
| Client build | Vite + React 18 + TypeScript | Fast HMR, zero config for this scope |
| State management | Zustand | Outside React tree — SSE writes directly, Canvas reads via `getState()` |
| Map rendering | Canvas 2D + `requestAnimationFrame` | Sufficient for 20k dots at 60fps, zero extra dependencies |
| List virtualization | `@tanstack/virtual` | Handles large filtered unit lists without DOM bloat |
| Repo structure | npm workspaces (root `package.json`) | Single install, independent run commands per app |

---

## Repository Structure

```
war-room-control/
├── package.json              # root — npm workspaces
├── README.md
├── server/
│   ├── package.json
│   └── src/
│       ├── index.ts          # Fastify app entry
│       ├── simulation.ts     # unit generation + tick loop
│       ├── sse.ts            # SSE connection manager
│       └── types.ts          # shared server types
└── client/
    ├── package.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── store/
        │   └── units.ts      # Zustand store
        ├── components/
        │   ├── TacticalMap.tsx
        │   ├── UnitsPanel.tsx
        │   ├── EventFeed.tsx
        │   ├── KPIBar.tsx
        │   └── PerformancePanel.tsx
        ├── hooks/
        │   ├── useSSE.ts
        │   └── usePerformance.ts
        └── types.ts
```

---

## Data Model

```typescript
type Team = 'alpha' | 'bravo';
type UnitStatus = 'idle' | 'moving' | 'attacking' | 'destroyed';

interface Unit {
  id: string;          // e.g. "u-00001"
  team: Team;
  x: number;           // 0–1000 (normalized grid)
  y: number;           // 0–1000
  health: number;      // 0–100
  status: UnitStatus;
}

interface TickDelta {
  tick: number;
  changes: Unit[];     // only mutated units (200–350 per tick)
  events: GameEvent[];
}

interface GameEvent {
  type: 'attack' | 'destroyed' | 'capture';
  unitId: string;
  targetId?: string;
  tick: number;
}
```

---

## Server Design

### Simulation (`simulation.ts`)
- On startup: generate 10,000 Alpha + 10,000 Bravo units with random positions (0–1000) and random health (0–100)
- Every 1000ms tick: select 200–350 random living units (or all remaining living units if fewer than 200 survive), apply one action per unit:
  - **move** — adjust x/y by ±5
  - **attack** — reduce a nearby enemy's health by 5–20; if health ≤ 0, transition to `destroyed`
  - **idle** — no change
- Emit a `TickDelta` (changed units + events) to all SSE subscribers

### SSE Connection Manager (`sse.ts`)
- Tracks open connections in a `Set<FastifyReply>`
- On new connection: send `event: snapshot` with all 20k units (client bootstraps state)
- Each tick: broadcast `event: tick` with `TickDelta` JSON
- Cleans up closed connections on reply close/error

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/stream` | SSE stream — snapshot on connect, tick deltas thereafter |
| `GET` | `/units` | Query units with validated params |

**`GET /units` query schema (Fastify AJV):**
```typescript
{
  team?: 'alpha' | 'bravo',
  status?: UnitStatus,
  healthMin?: number (0–100),
  healthMax?: number (0–100),
  search?: string (max 50 chars)
}
```
Returns 400 with error detail on invalid params.

---

## Client Design

### Zustand Store (`store/units.ts`)
```typescript
interface UnitsStore {
  units: Map<string, Unit>;       // full 20k unit map — O(1) patch
  events: GameEvent[];            // last 50 events (ring buffer)
  tick: number;
  applySnapshot: (units: Unit[]) => void;
  applyDelta: (delta: TickDelta) => void;
}
```
- `applySnapshot`: replaces entire map
- `applyDelta`: loops `delta.changes`, calls `map.set(unit.id, unit)` — O(changed) not O(20k)
- Events ring buffer: `[...prev, ...newEvents].slice(-50)` — always capped at 50 regardless of how many events arrive in a single tick

### SSE Hook (`hooks/useSSE.ts`)
- Opens `new EventSource('/stream')` once on mount
- `snapshot` → `store.applySnapshot()`
- `tick` → `store.applyDelta()`
- Native `EventSource` auto-reconnects on drop; on reconnect, waits for a new `snapshot` event before resuming delta application — stale state is preserved but not re-rendered until the snapshot resets it
- Closes connection on unmount

### Tactical Map (`TacticalMap.tsx`)
- `<canvas>` element, sized via `ResizeObserver`
- `requestAnimationFrame` loop runs outside React — reads `useUnitsStore.getState().units` directly
- Each frame:
  1. Clear canvas
  2. Iterate all units in map
  3. Draw 2px filled circle per unit: Alpha=blue, Bravo=red, destroyed=grey (dimmed)
- **Zone control overlay**: compute centroid of each team's living units; team with more units within a central zone radius owns it; draw tinted circle
- Legend (Alpha=blue, Bravo=red, Zone=tinted circle) rendered as an HTML overlay positioned over the canvas — not a canvas draw call
- No React re-renders from canvas — purely imperative

### Units Panel (`UnitsPanel.tsx`)
- Filter bar: status dropdown, health range slider (0–100), name/id search input
- `useMemo` derives filtered array from Zustand `units` map on each tick
- `@tanstack/virtual` virtualizes the list — only visible rows rendered
- Columns: ID · Team · Status · Health (colour-coded progress bar)

### Event Feed (`EventFeed.tsx`)
- Subscribes to `events` slice of store
- Renders last 50 events as scrolling list
- Colour-coded: attack=yellow, destroyed=red, capture=green

### KPI Bar (`KPIBar.tsx`)
- Derived counts from store on each tick:
  - Alpha alive / Bravo alive
  - Total destroyed
  - Zone control % per team

### Performance Panel (`PerformancePanel.tsx`)
- All data sourced from browser APIs only:
  - **FPS** — `requestAnimationFrame` timestamp delta, averaged over 60 frames
  - **Frame time** — raw rAF delta in ms
  - **JS heap** — `(performance as any).memory.usedJSHeapSize / 1048576` MB
  - **API latency** — `PerformanceObserver` on `resource` entries matching `/stream`
  - **Store update rate** — Zustand subscription counter, reset each second
- Updates display at 2Hz to avoid self-inflicted render cost
- Conditionally mounted — zero overhead when closed
- Visual health indicator: green / yellow / red thresholds per metric

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  KPI BAR: Units Alive | Destroyed | Zone Control    │
├─────────────────────┬───────────────────────────────┤
│                     │  UNITS PANEL                  │
│   TACTICAL MAP      │  [search] [status] [health]   │
│   (Canvas 2D)       │  ┌─ virtualized list ────────┐│
│                     │  │ id  team  status  health  ││
│   · · · · · ·       │  └───────────────────────────┘│
│   · · · · · ·       ├───────────────────────────────┤
│                     │  EVENT FEED                   │
│  [legend]           │  attack: u-001 → u-442        │
│  Alpha  Bravo  Zone │  destroyed: u-887             │
├─────────────────────┴───────────────────────────────┤
│  PERFORMANCE PANEL (collapsible)                    │
│  FPS · Frame time · Heap · API latency · Update rate│
└─────────────────────────────────────────────────────┘
```

---

## Data Flow

```
Simulation (1s tick)
  └─► TickDelta (200–350 changed units + events)
        └─► SSE broadcast  (event: tick)
              └─► useSSE hook
                    └─► Zustand applyDelta()
                          ├─► units Map (patched in-place)
                          │     ├─► Canvas rAF loop (getState(), redraws)
                          │     └─► UnitsPanel (filtered useMemo, virtualized)
                          ├─► events[] (ring buffer)
                          │     └─► EventFeed
                          └─► tick counter
                                └─► KPIBar (derived counts)
```

---

## Architecture Decisions

- **SSE over WebSocket**: client never sends data; SSE is simpler and works through any HTTP proxy
- **Canvas 2D over WebGL**: 20k dots at 60fps is well within Canvas 2D limits; PixiJS/Three.js add dependencies without benefit at this scale
- **Zustand `Map<id, Unit>`**: O(1) delta patching; store lives outside React tree so Canvas and SSE handler can interact with it without triggering re-renders
- **Canvas reads `getState()` not hooks**: decouples the 60fps render loop from React's render cycle entirely
- **`@tanstack/virtual`**: DOM-safe list rendering regardless of filter result size
- **Fastify AJV validation**: satisfies "validate all query params" with zero extra libraries
- **PerformancePanel at 2Hz**: self-monitoring must not degrade the app it monitors

---

## Out of Scope

- Authentication
- Database / persistence
- Deployment configuration
- Pixel-perfect styling
