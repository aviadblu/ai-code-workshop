---
phase: 03-sse-transport
plan: 02
subsystem: server-api
tags: [fastify, ajv, querystring-validation, rest-api, filtering]
provides:
  - "GET /units endpoint with AJV querystring schema validation"
  - "registerUnitsRoute export from server/src/sse.ts"
  - "Phase 3 fully complete: SSE-01, SSE-02, SSE-03, API-01 all tested"
affects: [04-client-sse, client-api-integration]
tech-stack:
  added: []
  patterns: [fastify-ajv-querystring-schema, sequential-filter-guards, ajv-coercion-400]
key-files:
  created: []
  modified:
    - server/src/sse.ts
    - server/src/index.ts
    - server/src/__tests__/sse.test.ts
key-decisions:
  - "AJV schema uses additionalProperties: false to strip unknown query params"
  - "Filter guards use !== undefined (not truthiness) so healthMin=0 works correctly"
  - "registerUnitsRoute wired in index.ts startup try block alongside registerSSE"
duration: 2min
completed: 2026-03-15
---

# Phase 3 Plan 02: GET /units with AJV Querystring Validation Summary

**GET /units endpoint with AJV schema validation — healthMin=abc returns 400 before handler; team=alpha filters to 10k units; full suite 32/32 green.**

## Performance
- **Duration:** ~2 minutes
- **Tasks:** 3 completed (TDD: RED + GREEN + wire)
- **Files modified:** 3

## Accomplishments
- Added 6 API-01 tests (a-f) to sse.test.ts covering valid filters, invalid healthMin, enum rejection, and no-filter 20k return
- Added `registerUnitsRoute` to `server/src/sse.ts` with full AJV querystring schema (team, status, healthMin, healthMax, search)
- AJV coercion: `healthMin=50` (string) coerced to number; `healthMin=abc` returns 400 before handler runs
- `additionalProperties: false` strips unknown params without 400
- Wired `registerUnitsRoute(server)` into `server/src/index.ts` startup block
- Full vitest suite: 32/32 green (17 SSE/API + 15 simulation tests)
- TypeScript compiles clean

## Task Commits
1. **Task 1: Add API-01 tests (RED)** - `4f4ecd5`
2. **Task 2: Add registerUnitsRoute (GREEN)** - `64471b4`
3. **Task 3: Wire registerUnitsRoute into index.ts** - `43fe8b0`

## Files Created/Modified
- `server/src/__tests__/sse.test.ts` - Added 6 API-01 tests in GET /units describe block; imported registerUnitsRoute and Unit type
- `server/src/sse.ts` - Added unitsQuerySchema constant and registerUnitsRoute export; added Team/UnitStatus imports
- `server/src/index.ts` - Updated import and added registerUnitsRoute(server) call in startup try block

## Decisions & Deviations

**Decisions:**
- Filter guards use `!== undefined` (plan spec) rather than truthiness — ensures `healthMin=0` and `healthMax=0` work correctly (truthiness would skip 0)
- `as const` on unitsQuerySchema satisfies TypeScript strict mode without relaxing AJV types

**Deviations:** None — plan executed exactly as specified.

## Next Phase Readiness

Phase 3 fully complete. All 4 requirements (SSE-01, SSE-02, SSE-03, API-01) have passing automated coverage.

Phase 4 (Client SSE) can now:
- Connect to `GET /stream` and receive the 20k-unit snapshot + tick deltas
- Query `GET /units?team=alpha&status=idle` for filtered unit views
- Trust that invalid params return structured 400 responses

## Self-Check: PASSED

- FOUND: server/src/sse.ts
- FOUND: server/src/index.ts
- FOUND: server/src/__tests__/sse.test.ts
- FOUND: .planning/phases/03-sse-transport/03-02-SUMMARY.md
- FOUND: commit 4f4ecd5 (test RED)
- FOUND: commit 64471b4 (feat GREEN)
- FOUND: commit 43fe8b0 (feat wire)
