---
phase: 03-sse-transport
plan: 01
subsystem: server/sse
tags: [fastify, sse, streaming, server-sent-events, vitest, tdd]
provides:
  - SSE connection manager (server/src/sse.ts) with formatSSE, clients Set, broadcast, registerSSE
  - GET /stream endpoint: sends event: snapshot on connect, event: tick on every simulation tick
  - Test scaffold (server/src/__tests__/sse.test.ts) covering SSE-01, SSE-02, SSE-03, cleanup
  - index.ts wired to call registerSSE(server) at startup
affects: [03-sse-transport, 04-client-store]
tech-stack:
  added: []
  patterns:
    - reply.hijack() + reply.raw.write for long-lived SSE in Fastify 5
    - Module-level Set<FastifyReply> for connection tracking
    - subscribe() called once at registerSSE startup (not per connection)
    - vi.hoisted() for mock variables accessed inside vi.mock() factory
    - Real HTTP server (port 0) + http.get() for SSE integration testing
key-files:
  created:
    - server/src/sse.ts
    - server/src/__tests__/sse.test.ts
  modified:
    - server/src/index.ts
key-decisions:
  - "Access-Control-Allow-Origin set manually in writeHead (not via @fastify/cors) because hijacked replies bypass Fastify's lifecycle hooks"
  - "Real HTTP server (port 0) used for SSE tests instead of server.inject() — inject hangs on never-ending SSE response"
  - "vi.hoisted() used to define mock state variables accessible inside vi.mock() factory (standard Vitest hoisting workaround)"
  - "subscribe() called once inside registerSSE, not per connection — prevents N×subscriber accumulation across clients"
duration: 12min
completed: 2026-03-15
---

# Phase 3 Plan 1: SSE Connection Manager Summary

**SSE module with reply.hijack(), module-level client Set, and subscribe-once tick broadcast — 11 tests green, TypeScript clean**

## Performance
- **Duration:** 12min
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments
- Created `server/src/sse.ts`: SSE connection manager with `formatSSE`, `broadcast`, `registerSSE` export
- GET /stream sends `event: snapshot` (20k units JSON) immediately on connect (SSE-01)
- `subscribe()` called once at registerSSE startup; broadcasts `event: tick` on every simulation tick (SSE-02)
- Second/reconnect connection independently receives fresh snapshot (SSE-03)
- `request.raw.on('close')` removes client from Set; `broadcast` has try/catch EPIPE guard
- Wired `registerSSE(server)` into `server/src/index.ts` try block after `startTickLoop()`
- 11 SSE tests + 15 simulation tests = 26 total, all passing; TypeScript clean

## Task Commits
1. **Task 1: RED test scaffold** - `1a1d004`
2. **Task 2: GREEN sse.ts implementation** - `092fc79`
3. **Task 3: Wire registerSSE into index.ts** - `4e4ce1c`

## Files Created/Modified
- `server/src/sse.ts` — SSE connection manager: formatSSE, clients Set, broadcast, registerSSE
- `server/src/__tests__/sse.test.ts` — Integration tests using real HTTP server + vi.hoisted mock
- `server/src/index.ts` — Added registerSSE import and call in server startup block

## Decisions & Deviations

### Decisions
- CORS header set manually in `reply.raw.writeHead()` (not via `@fastify/cors`) because hijacked replies bypass Fastify's response lifecycle hooks
- Used real HTTP server on port 0 + Node `http.get()` for SSE tests instead of `server.inject()` — inject hangs indefinitely on a never-ending SSE response
- Used `vi.hoisted()` to initialize mock state variables before `vi.mock()` factory execution (required by Vitest's ESM hoisting behavior)

### Deviations from Plan
**[Rule 1 - Bug] Test approach redesigned — inject() unsuitable for SSE**
- **Found during:** Task 1 initial test run
- **Issue:** `server.inject()` hangs on `/stream` because `reply.hijack()` + `reply.raw.write()` never calls `reply.raw.end()`, so inject's response promise never resolves
- **Fix:** Rewrote tests to use `server.listen({ port: 0 })` + `http.get()` with early connection destroy after receiving snapshot
- **Files modified:** `server/src/__tests__/sse.test.ts`
- **Commit:** `092fc79`

**[Rule 1 - Bug] vi.hoisted() required for mock factory variables**
- **Found during:** Task 1 second iteration
- **Issue:** `vi.mock()` is hoisted to top of file; `subscribeMock` const defined after it was inaccessible
- **Fix:** Wrapped mock state initialization in `vi.hoisted()` callback
- **Files modified:** `server/src/__tests__/sse.test.ts`
- **Commit:** `092fc79`

## Next Phase Readiness
- GET /stream endpoint is live and delivers snapshot + tick events
- Phase 03-02 (GET /units REST endpoint) can proceed: `registerUnitsRoute(server)` follows the same registration pattern
- Client (Phase 04) can connect to `http://localhost:3000/stream` and receive SSE events immediately

## Self-Check: PASSED

- FOUND: server/src/sse.ts
- FOUND: server/src/__tests__/sse.test.ts
- FOUND: .planning/phases/03-sse-transport/03-01-SUMMARY.md
- FOUND commit: 1a1d004 (test RED scaffold)
- FOUND commit: 092fc79 (feat sse.ts GREEN)
- FOUND commit: 4e4ce1c (chore index.ts wiring)
