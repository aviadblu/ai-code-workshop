---
phase: 01-foundation
plan: 01-01
subsystem: infrastructure
tags: [npm-workspaces, typescript, monorepo, types]
provides:
  - npm workspace monorepo with server and client workspaces
  - TypeScript configs for NodeNext (server) and Bundler (client)
  - Shared domain types (Team, UnitStatus, Unit, TickDelta, GameEvent)
  - All workspace dependencies installed
affects: [all phases — foundation for every subsequent plan]
tech-stack:
  added: [fastify ^5.8.2, @fastify/cors ^11.2.0, tsx ^4.21.0, typescript ^5.9.3, react ^19.2.4, react-dom ^19.2.4, vite ^8.0.0, @vitejs/plugin-react ^6.0.1, @types/node ^25.5.0, @types/react ^19.2.14]
  patterns: [npm workspaces monorepo, NodeNext module resolution, Bundler module resolution, type duplication over shared package]
key-files:
  created:
    - package.json
    - server/package.json
    - client/package.json
    - server/tsconfig.json
    - client/tsconfig.json
    - server/src/types.ts
    - client/src/types.ts
    - package-lock.json
  modified: []
key-decisions:
  - "Types duplicated in server/src/types.ts and client/src/types.ts — no shared package to avoid NodeNext symlink complexity"
  - "React 19.2.4 used (spec said 18, but 19 is current stable with no breaking changes for this phase)"
  - "No @types/react-dom — merged into @types/react in React 19"
  - "No type: module at root — each workspace declares its own module type"
duration: ~10min
completed: 2026-03-14
---

# Phase 1, Plan 01-01: Root Workspace + TypeScript Config + Shared Types

**npm workspace monorepo established with TypeScript configs and shared domain types; all dependencies installed.**

## Performance
- **Duration:** ~10 min
- **Tasks:** 8 completed
- **Files modified:** 8 created, 0 modified

## Accomplishments
- Root `package.json` with `"workspaces": ["server", "client"]`, `"private": true`, and `dev:server`/`dev:client` scripts
- `server/package.json` with Fastify 5, tsx, TypeScript, and @types/node
- `client/package.json` with React 19, Vite 8, and @types/react (no separate @types/react-dom)
- `server/tsconfig.json` with `NodeNext` module resolution, ES2022 target, strict mode, output to dist/
- `client/tsconfig.json` with `Bundler` module resolution, `react-jsx` transform, DOM libs, `noEmit: true`
- `server/src/types.ts` exporting all 5 domain types: `Team`, `UnitStatus`, `Unit`, `TickDelta`, `GameEvent`
- `client/src/types.ts` with identical content (intentional duplication)
- `npm install` succeeded — 82 packages installed, `node_modules/fastify/` and `node_modules/vite/` hoisted to root

## Task Commits
1. **Task 1-01-01: Root package.json** - `296949e`
2. **Task 1-01-02: server/package.json** - `3abd9c1`
3. **Task 1-01-03: client/package.json** - `c4db392`
4. **Task 1-01-04: server/tsconfig.json** - `8404533`
5. **Task 1-01-05: client/tsconfig.json** - `1d8a01a`
6. **Task 1-01-06: server/src/types.ts** - `39a79d5`
7. **Task 1-01-07: client/src/types.ts** - `316992a`
8. **Task 1-01-08: npm install / package-lock.json** - `0023334`

## Files Created/Modified
- `package.json` — Root workspace config with workspaces array and dev scripts
- `server/package.json` — Server workspace config with Fastify and tsx deps
- `client/package.json` — Client workspace config with React 19 and Vite deps
- `server/tsconfig.json` — TypeScript config: NodeNext resolution, ES2022, strict, dist output
- `client/tsconfig.json` — TypeScript config: Bundler resolution, react-jsx, DOM libs, noEmit
- `server/src/types.ts` — Shared domain types (server copy)
- `client/src/types.ts` — Shared domain types (client copy, identical)
- `package-lock.json` — Lock file from npm install (82 packages, 0 vulnerabilities)

## Decisions & Deviations
- **React 19 over React 18**: Spec mentions React 18, but research confirmed React 19.2.4 is current stable with no breaking changes for Phase 1 patterns. Used React 19.
- **Type duplication**: Research confirmed copy-paste is the correct tradeoff vs a shared/ package (avoids NodeNext symlink complexity, third tsconfig, exports field).
- **No root `"type": "module"`**: Deliberately omitted per research — each workspace declares its own.
- All other implementation followed the plan exactly.

## Next Phase Readiness
- Plan 01-02 (Fastify server scaffold) can proceed: `server/package.json`, `server/tsconfig.json`, `server/src/types.ts`, and `node_modules/fastify` are all in place.
- Plan 01-03 (Vite + React 19 client scaffold) can proceed: `client/package.json`, `client/tsconfig.json`, `client/src/types.ts`, and `node_modules/vite` are all in place.
