# Phase 1: Foundation - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning
**Source:** PRD Express Path (docs/superpowers/specs/2026-03-14-war-room-control-design.md)

<domain>
## Phase Boundary

Scaffold the entire monorepo from nothing: root npm workspace config, TypeScript configs for both apps, shared type definitions, a minimal Fastify server that boots and health-checks, and a minimal Vite + React 18 client that renders a page. No simulation logic, no SSE, no canvas — just the skeleton both apps build on.

</domain>

<decisions>
## Implementation Decisions

### Repo Structure
- Root `package.json` with `"workspaces": ["server", "client"]`
- `server/` — Fastify app, TypeScript (tsx watch), own `package.json`
- `client/` — Vite + React 18, TypeScript, own `package.json`
- Root-level scripts: `dev:server`, `dev:client`, `install` delegates to workspaces

### Shared Types (types.ts)
- `type Team = 'alpha' | 'bravo'`
- `type UnitStatus = 'idle' | 'moving' | 'attacking' | 'destroyed'`
- `interface Unit { id: string; team: Team; x: number; y: number; health: number; status: UnitStatus; }`
- `interface TickDelta { tick: number; changes: Unit[]; events: GameEvent[]; }`
- `interface GameEvent { type: 'attack' | 'destroyed' | 'capture'; unitId: string; targetId?: string; tick: number; }`
- Types file lives in `server/src/types.ts` — re-exported or duplicated in `client/src/types.ts` (no shared package needed for this exercise)

### Server
- Framework: Fastify (latest)
- Runtime: Node.js + TypeScript via `tsx watch`
- Entry: `server/src/index.ts`
- Health check: `GET /health` → `{ status: 'ok' }`
- CORS enabled for `http://localhost:5173` (Vite default)
- Port: 3000 (configurable via `PORT` env var)
- Dev script: `tsx watch src/index.ts`

### Client
- Build tool: Vite + `@vitejs/plugin-react`
- Framework: React 18 + TypeScript
- Entry: `client/src/main.tsx` → `client/index.html`
- Root component: `App.tsx` — renders placeholder layout with labelled component stubs
- Dev script: `vite` (proxies `/stream` and `/units` to `http://localhost:3000`)
- Vite proxy: forward `/stream` and `/units` API paths to server (avoids CORS in dev)

### TypeScript Config
- Server: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"target": "ES2022"`, strict mode
- Client: `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"jsx": "react-jsx"`, strict mode

### Claude's Discretion
- Component stub content (placeholder text is fine)
- Exact Fastify plugin versions
- Whether to add `eslint`/`prettier` (skip — out of scope for this phase)
- Root README content

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Spec (source of truth)
- `docs/superpowers/specs/2026-03-14-war-room-control-design.md` — Full architecture, data model, component design, layout

### Planning Artifacts
- `.planning/REQUIREMENTS.md` — INFRA-01, INFRA-02, INFRA-03 definitions
- `.planning/ROADMAP.md` — Phase 1 success criteria and plan breakdown

</canonical_refs>

<specifics>
## Specific Ideas

- Vite config must proxy `/stream` and `/units` to `http://localhost:3000` so the client can call the server without CORS issues in dev
- Server CORS must explicitly allow `http://localhost:5173`
- `tsx watch` is the dev runner for the server (not `ts-node`, not `nodemon`)
- Component stubs needed: `TacticalMap`, `UnitsPanel`, `EventFeed`, `KPIBar`, `PerformancePanel` — just return a `<div>` with the component name as text
- Layout stub: the full 2-panel grid from the spec wireframe, even if panels are empty divs

</specifics>

<deferred>
## Deferred Ideas

- Simulation logic (Phase 2)
- SSE transport (Phase 3)
- Zustand store (Phase 4)
- Canvas rendering (Phase 5)
- Panel implementations (Phase 6–7)
- Authentication, database, deployment — permanently out of scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-14 via PRD Express Path*
