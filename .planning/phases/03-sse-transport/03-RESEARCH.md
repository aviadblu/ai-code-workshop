# Phase 3: SSE Transport - Research

**Researched:** 2026-03-15
**Domain:** Fastify 5 SSE streaming + AJV querystring schema validation
**Confidence:** HIGH

---

## Summary

Phase 3 wires simulation output to the network layer. Two server-side concerns dominate:
(1) a long-lived streaming endpoint that holds open HTTP responses and pushes `event: snapshot`
then `event: tick` deltas, and (2) a standard REST endpoint that uses Fastify's built-in AJV
schema to reject malformed query params with a 400.

The SSE endpoint requires `reply.hijack()` in Fastify 5 to prevent the framework from auto-closing
the response after the handler returns. Connection cleanup is done by listening on
`request.raw.on('close', ...)`, which fires when the browser closes or drops the EventSource.
The subscriber set is `Set<FastifyReply>` — when a connection closes, the reply is removed and
any future `reply.raw.write()` on it is skipped. The snapshot payload (20k units as JSON) is
expected to be ~2-4 MB uncompressed; this is within HTTP streaming limits but worth noting for
the `@fastify/cors` keep-alive budget.

The GET /units endpoint uses Fastify's `querystring` (or `query`) schema block — no extra
libraries required. AJV coerces query string values to declared types automatically; strings that
cannot coerce to `number` (e.g. `healthMin=abc`) trigger an automatic 400 with a structured error
body before the route handler runs.

**Primary recommendation:** Use `reply.hijack()` + `reply.raw` directly. No SSE plugin required;
the project needs precise control over the connection set and the simulation subscriber. Keep
`sse.ts` as the sole module managing both: it owns the `Set<FastifyReply>`, registers the
simulation subscriber once on server startup, and never leaks global state.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SSE-01 | Client receives full snapshot of all 20k units on SSE connect (`event: snapshot`) | `reply.hijack()` + `reply.raw.write(format('snapshot', JSON.stringify([...getUnits().values()])))` immediately after headers |
| SSE-02 | Client receives `TickDelta` every second (`event: tick`) | `subscribe(cb)` from simulation.ts; cb calls `broadcast('tick', delta)` on every tick |
| SSE-03 | SSE auto-reconnects and re-bootstraps from a new snapshot on reconnect | Browser EventSource native reconnect = new GET /stream = new snapshot; server only needs to send snapshot on every new connection |
| API-01 | GET /units validates query params via Fastify AJV schema; returns 400 with detail on invalid input | `schema: { querystring: { type: 'object', properties: {...} } }` in route options; Fastify auto-400s before handler runs |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | ^5.8.2 (already installed) | HTTP server + schema validation | ESM-first, built-in AJV, already in server/package.json |
| @fastify/cors | ^11.2.0 (already installed) | CORS for Vite dev client | Already registered in index.ts |

### No new dependencies required

All SSE and validation functionality is available via Fastify 5 core. No plugin needed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `reply.hijack()` + `reply.raw` | `fastify-sse-v2` or `@fastify/sse` | Plugin adds abstraction but we need explicit control of the `Set<FastifyReply>` subscriber pattern; raw is cleaner for this use case |
| Manual response filtering in handler | Fastify `querystring` schema | Schema approach runs before the handler, zero handler code for validation |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended File Structure

```
server/src/
├── index.ts         # Fastify app entry — registers routes from sse.ts
├── simulation.ts    # Unit generation + tick loop (already complete)
├── sse.ts           # NEW: SSE connection manager + /stream + /units routes
└── types.ts         # Shared types (already complete)
```

The design spec explicitly names `sse.ts` as the SSE module. All route registration should live
there, exported as a Fastify plugin or plain registration function called from `index.ts`.

### Pattern 1: SSE Connection Manager

**What:** Module-level `Set<FastifyReply>` tracks all open connections. One simulation subscriber
registered at startup broadcasts ticks to every reply in the set.

**When to use:** Any long-lived server-push endpoint where subscribers are server-managed.

```typescript
// Source: Fastify docs + GitHub issue #3979 pattern
import type { FastifyInstance, FastifyReply } from 'fastify'
import { getUnits, subscribe } from './simulation.js'

const clients = new Set<FastifyReply>()

function formatSSE(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`
}

function broadcast(event: string, data: string): void {
  const msg = formatSSE(event, data)
  for (const reply of clients) {
    try {
      reply.raw.write(msg)
    } catch {
      clients.delete(reply)
    }
  }
}

export function registerSSE(server: FastifyInstance): void {
  // Register simulation subscriber once
  subscribe((delta) => {
    broadcast('tick', JSON.stringify(delta))
  })

  server.get('/stream', (request, reply) => {
    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // Send snapshot immediately on connect
    const snapshot = [...getUnits().values()]
    reply.raw.write(formatSSE('snapshot', JSON.stringify(snapshot)))

    clients.add(reply)

    // Cleanup on disconnect
    request.raw.on('close', () => {
      clients.delete(reply)
    })
  })
}
```

### Pattern 2: Fastify AJV Querystring Schema

**What:** Declare a JSON Schema object under `schema.querystring` in route options. Fastify/AJV
validates and coerces before the handler runs; invalid input returns 400 automatically.

**When to use:** Any route that accepts URL query parameters.

```typescript
// Source: https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
import type { FastifyInstance } from 'fastify'
import { getUnits } from './simulation.js'
import type { Team, UnitStatus } from './types.js'

const unitsQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      team:      { type: 'string', enum: ['alpha', 'bravo'] },
      status:    { type: 'string', enum: ['idle', 'moving', 'attacking', 'destroyed'] },
      healthMin: { type: 'number', minimum: 0, maximum: 100 },
      healthMax: { type: 'number', minimum: 0, maximum: 100 },
      search:    { type: 'string', maxLength: 50 },
    },
  },
}

export function registerUnitsRoute(server: FastifyInstance): void {
  server.get('/units', { schema: unitsQuerySchema }, (request, reply) => {
    const { team, status, healthMin, healthMax, search } =
      request.query as {
        team?: Team
        status?: UnitStatus
        healthMin?: number
        healthMax?: number
        search?: string
      }

    let results = [...getUnits().values()]
    if (team)      results = results.filter(u => u.team === team)
    if (status)    results = results.filter(u => u.status === status)
    if (healthMin !== undefined) results = results.filter(u => u.health >= healthMin)
    if (healthMax !== undefined) results = results.filter(u => u.health <= healthMax)
    if (search)    results = results.filter(u => u.id.includes(search))

    return results
  })
}
```

**AJV coercion:** `healthMin=abc` → AJV cannot coerce `"abc"` to `number` → Fastify auto-returns:
```json
{ "statusCode": 400, "error": "Bad Request", "message": "querystring/healthMin must be number" }
```

### Pattern 3: Wiring into index.ts

**What:** Call `registerSSE(server)` and `registerUnitsRoute(server)` from `index.ts` after
`server.listen()`. This matches the existing pattern where `initSimulation()` is called there too.

```typescript
// In index.ts — additions only
import { registerSSE } from './sse.js'

// Inside try block, after server.listen():
registerSSE(server)
```

Or combine both route registrations into `registerSSE` for a single import.

### Anti-Patterns to Avoid

- **Calling `reply.send()` after `reply.hijack()`:** The hijacked reply bypasses Fastify's send
  machinery. Use `reply.raw.write()` and `reply.raw.end()` only.
- **Registering simulation subscriber inside the route handler:** This creates a new subscriber
  per client connection and leaks memory. Register once at module level or in `registerSSE()`.
- **Not handling `reply.raw.write()` errors:** When a client has disconnected but cleanup hasn't
  fired yet, `write()` can throw. Wrap in try/catch and delete from set on error.
- **Using `reply.socket.on('close')` instead of `request.raw.on('close')`:** In Fastify 5 with
  hijacked replies, listening on `request.raw` (the IncomingMessage) is the reliable close event.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query param validation | Custom validation logic in handler | Fastify `schema.querystring` + AJV | AJV handles coercion, enum checks, range checks, error formatting, 400 status automatically |
| SSE event formatting | Ad-hoc string concatenation | `formatSSE(event, data)` utility — one function | SSE spec requires exact `event:\ndata:\n\n` format; one util avoids bugs across broadcast + snapshot |

**Key insight:** Fastify's AJV integration handles all of API-01 — the planner should not include
tasks for custom validation middleware, error formatters, or schema parsers.

---

## Common Pitfalls

### Pitfall 1: Missing reply.hijack() — Fastify Closes the Response

**What goes wrong:** In Fastify 5, when a route handler function returns (or the async function
resolves), Fastify automatically ends the response. Without `reply.hijack()`, the SSE connection
closes after the first write.

**Why it happens:** Fastify v4+ changed implicit streaming behaviour. The framework now owns the
response lifecycle unless explicitly relinquished.

**How to avoid:** Call `reply.hijack()` as the first line of the `/stream` handler, before any
`reply.raw` calls.

**Warning signs:** Client connects, receives the snapshot, then immediately gets an `error` event
and tries to reconnect in a loop.

### Pitfall 2: Subscriber Registered Per-Connection

**What goes wrong:** If `subscribe(cb)` is called inside the route handler, each new SSE
connection adds another subscriber. After 10 clients connect and disconnect, there are 10
subscribers calling `broadcast()` on every tick, sending duplicate data to the remaining clients.

**Why it happens:** Module-level vs handler-level scope confusion.

**How to avoid:** Call `subscribe()` once, at module initialization time in `registerSSE()`, not
inside the handler. The `broadcast()` function iterates the `clients` Set which is connection-scoped.

**Warning signs:** Each tick logs N×broadcast messages where N grows over time; clients receive
duplicate tick events.

### Pitfall 3: Snapshot Payload Size (~2-4 MB)

**What goes wrong:** Serializing 20,000 Unit objects via `JSON.stringify` produces ~2-4 MB of
text per connection. If many clients connect simultaneously, this spikes server memory and latency.

**Why it happens:** Each Unit has 6 fields; at ~150 bytes/unit average, 20k units = ~3 MB.

**How to avoid:** For this project (single-developer local exercise), this is acceptable. The
`data:` line in SSE can be arbitrarily large — HTTP streaming handles it in chunks automatically.
No action needed. Document in code that snapshot is intentionally large.

**Warning signs:** Snapshot takes >5s for client to parse in DevTools → optimize if needed (not
required for v1).

### Pitfall 4: Client Disconnect Not Cleaned Up

**What goes wrong:** A client disconnects but the reply is not removed from the `clients` Set.
The tick broadcast keeps calling `reply.raw.write()` on a dead socket, generating EPIPE errors
or silently swallowing writes.

**Why it happens:** `request.raw.on('close')` not registered, or cleanup handler not hooked.

**How to avoid:** Register `request.raw.on('close', () => clients.delete(reply))` in the
handler. Additionally, wrap `reply.raw.write()` in try/catch and delete on error.

**Warning signs:** `clients.size` grows unbounded; server logs EPIPE or ERR_STREAM_WRITE_AFTER_END.

### Pitfall 5: AJV Coercion for Numbers Passes Strings Through Silently

**What goes wrong:** `healthMin=50` works (string `"50"` coerced to number `50`), but the
planner might assume `additionalProperties: false` is not needed and unknown params are silently
ignored.

**Why it happens:** Fastify's default AJV config has `removeAdditional: true` which removes
unknown properties but does NOT return 400 for them unless `additionalProperties: false` is in
the schema.

**How to avoid:** Add `additionalProperties: false` to the querystring schema to ensure
unrecognized params are stripped. If strictness is wanted (400 on unknown params), use
`additionalProperties: false` combined with no `removeAdditional` override.

---

## Code Examples

### SSE Format Helper

```typescript
// Canonical SSE wire format
function formatSSE(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`
}
```

### Connection Lifecycle (Complete Handler)

```typescript
// Source: Fastify GitHub issue #3979 + official Reply docs
server.get('/stream', (request, reply) => {
  reply.hijack()                          // Step 1: claim the socket

  reply.raw.writeHead(200, {             // Step 2: SSE headers
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',           // Disable nginx buffering
  })

  const snapshot = [...getUnits().values()]
  reply.raw.write(                       // Step 3: send snapshot
    formatSSE('snapshot', JSON.stringify(snapshot))
  )

  clients.add(reply)                     // Step 4: register client

  request.raw.on('close', () => {        // Step 5: cleanup on disconnect
    clients.delete(reply)
  })
})
```

### GET /units — Schema Validation

```typescript
// Source: https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
// AJV coerces string query params to declared types automatically.
// "healthMin=abc" → cannot coerce to number → Fastify returns 400 before handler.
server.get('/units', {
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        team:      { type: 'string', enum: ['alpha', 'bravo'] },
        status:    { type: 'string', enum: ['idle', 'moving', 'attacking', 'destroyed'] },
        healthMin: { type: 'number', minimum: 0, maximum: 100 },
        healthMax: { type: 'number', minimum: 0, maximum: 100 },
        search:    { type: 'string', maxLength: 50 },
      },
    },
  },
}, handler)
```

### Automatic 400 Response Body (for reference)

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "querystring/healthMin must be number"
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No `reply.hijack()` — implicit streaming in Fastify v3 | Explicit `reply.hijack()` required in v4+ | Fastify v4 (2022) | Must be first call in SSE handler |
| `querystring` schema key | Both `querystring` and `query` accepted | Fastify v4+ | Either works; prefer `querystring` for clarity |
| AJV v6 default | AJV v8 with strict mode | Fastify v4 | Unknown keywords cause errors; schemas must be clean |

**Deprecated/outdated:**
- `reply.socket.on('close')`: Prefer `request.raw.on('close')` — more reliable in hijack mode.
- Fastify `@fastify/sse` plugin v1: Was tied to Fastify v3 API; not required for this project.

---

## Open Questions

1. **CORS headers on /stream in hijack mode**
   - What we know: `@fastify/cors` registered in index.ts; hijacked replies bypass Fastify lifecycle including CORS hook
   - What's unclear: Whether `@fastify/cors` injects CORS headers before hijack or relies on post-handler hooks
   - Recommendation: Manually set `Access-Control-Allow-Origin: http://localhost:5173` in `reply.raw.writeHead()` for the `/stream` endpoint to be safe. Test with a browser EventSource to confirm.

2. **`/stream` route and CORS preflight**
   - What we know: EventSource does not send a preflight OPTIONS request (it's a GET with simple headers)
   - What's unclear: Nothing material — SSE GET does not trigger CORS preflight
   - Recommendation: No action needed; document for future reference.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `server/vitest.config.ts` |
| Quick run command | `cd server && npx vitest run src/__tests__/sse.test.ts` |
| Full suite command | `cd server && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SSE-01 | GET /stream sends `event: snapshot` with 20k units on connect | integration | `cd server && npx vitest run src/__tests__/sse.test.ts` | ❌ Wave 0 |
| SSE-02 | GET /stream sends `event: tick` after each simulation tick | integration | `cd server && npx vitest run src/__tests__/sse.test.ts` | ❌ Wave 0 |
| SSE-03 | Second connection receives fresh snapshot (reconnect = new snapshot) | integration | `cd server && npx vitest run src/__tests__/sse.test.ts` | ❌ Wave 0 |
| API-01 | GET /units?healthMin=abc returns 400; GET /units?team=alpha returns 200 | integration | `cd server && npx vitest run src/__tests__/sse.test.ts` | ❌ Wave 0 |

**Test approach for SSE:** Use Fastify's `server.inject()` for the `/units` route (synchronous
HTTP, easy to test). For `/stream`, use `server.inject()` with `{ method: 'GET', url: '/stream' }`
and capture the reply body — or use Fastify's `fastify.listen()` + Node's `http.get()` with a
custom stream reader in tests, leveraging Vitest fake timers to advance simulation ticks.

The simplest reliable approach: build the server in test setup via `registerSSE(server)`, use
`server.inject()` for `/units`, and test the SSE handler by calling `request.raw.emit('close')`
to verify cleanup. Tick delivery can be tested by calling the subscribed callback directly (via
`subscribe()` return).

### Sampling Rate

- **Per task commit:** `cd server && npx vitest run src/__tests__/sse.test.ts`
- **Per wave merge:** `cd server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `server/src/__tests__/sse.test.ts` — covers SSE-01, SSE-02, SSE-03, API-01

*(Existing `simulation.test.ts` covers SIM-01–04; no changes needed to it.)*

---

## Sources

### Primary (HIGH confidence)

- [Fastify Reply docs](https://fastify.dev/docs/latest/Reference/Reply/) — `reply.hijack()`, `reply.raw`, SSE header setup
- [Fastify Validation and Serialization docs](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) — `querystring` schema, AJV coercion, 400 error format
- `server/src/simulation.ts` (read directly) — `getUnits()`, `subscribe()`, `startTickLoop()` API surface

### Secondary (MEDIUM confidence)

- [Fastify GitHub issue #3979](https://github.com/fastify/fastify/issues/3979) — confirms `reply.hijack()` requirement in Fastify v4+; SSE handler pattern with `reply.raw.writeHead()`
- WebSearch (multiple sources): `request.raw.on('close')` and `request.socket.on('close')` both used in Fastify SSE examples for connection cleanup

### Tertiary (LOW confidence)

- Snapshot payload size estimate (~2-4 MB for 20k units) — estimated from Unit type field count; not benchmarked against this exact simulation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Fastify 5 + AJV already installed; no new dependencies needed
- Architecture: HIGH — `reply.hijack()` pattern verified against official docs and GitHub issue thread; SSE format is a fixed spec
- Pitfalls: HIGH for hijack/subscriber pitfalls (verified); MEDIUM for CORS-in-hijack-mode (untested assumption flagged as open question)

**Research date:** 2026-03-15
**Valid until:** 2026-09-15 (Fastify 5 stable; SSE spec is not changing)
