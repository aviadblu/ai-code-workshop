# Phase 2: Simulation Engine — Research

**Researched:** 2026-03-14
**Domain:** In-memory game simulation in Node.js TypeScript — unit generation, tick loop, action dispatch
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SIM-01 | Server generates 10,000 Alpha and 10,000 Bravo units with random positions (0–1000) and random health (0–100) on startup | Unit generation patterns, Map<string, Unit> initialisation, ID formatting |
| SIM-02 | Server runs a 1-second tick loop that selects 200–350 random living units per tick | setInterval semantics, Fisher-Yates / reservoir sampling, living-unit filtering |
| SIM-03 | Each selected unit performs one action per tick: move (±5 x/y), attack (reduce nearby enemy health 5–20), or idle | Action dispatch, proximity check, mutation-then-collect pattern |
| SIM-04 | Units reaching health ≤ 0 transition to `destroyed` status | Status lifecycle, dual-update (attacker + target both appear in changes[]) |
</phase_requirements>

---

## Summary

Phase 2 is a pure in-memory simulation module with zero external dependencies. Everything required — `Map`, `setInterval`, `Math.random`, `Math.clamp` — is native Node.js. The design spec prescribes the exact file (`server/src/simulation.ts`), the storage type (`Map<string, Unit>`), the output shape (`TickDelta`), and the tick budget (200–350 living units per tick). No library research or ecosystem choices need to be made; the research focus is on **correctness patterns** that prevent subtle bugs at 20k-entity scale.

The main pitfalls are (1) accidental mutation of the `units` Map entry before it is cloned into `changes[]`, causing the broadcast to send a reference rather than a snapshot; (2) O(n) neighbour search inside a hot loop producing visible latency at 20k units; and (3) `setInterval` drift accumulating errors if the tick timestamp is never tracked. Each has a well-understood mitigation described below.

**Primary recommendation:** Build `simulation.ts` as a self-contained module that exports `initSimulation()` returning `{ units, subscribe, start }`. Keep the tick loop, action logic, and unit map all inside the module closure. The rest of the server (`index.ts`, future `sse.ts`) subscribes to deltas via a callback — no global state.

---

## Standard Stack

### Core (all built-in — no npm installs required)

| Facility | Version | Purpose | Why Standard |
|----------|---------|---------|--------------|
| `Map<string, Unit>` | ES2015+ / Node.js built-in | O(1) unit lookup by ID | Matches client store design; spec mandates it |
| `setInterval` | Node.js built-in | 1-second tick driver | Simple, sufficient; no scheduler library needed |
| `Math.random()` | Node.js built-in | Random positions, health, action weights, target selection | Crypto-strength not required for simulation |
| `crypto.randomUUID()` | Node.js 14.17+ built-in | Unit ID generation (alternative) | Collision-free; but a zero-padded counter is simpler and predictable |

### No External Libraries Required

The design spec explicitly rules out simulation libraries. The entire module is vanilla TypeScript with the Node.js standard library.

**Installation:** none — no new packages for this phase.

---

## Architecture Patterns

### Recommended File Layout

```
server/src/
├── index.ts          # Fastify entry — imports simulation, calls initSimulation()
├── simulation.ts     # NEW: unit generation + tick loop + action logic
├── sse.ts            # Phase 3: subscribes to simulation deltas
└── types.ts          # Existing: Unit, Team, UnitStatus, TickDelta, GameEvent
```

`simulation.ts` is the only new file in this phase. `index.ts` gets a small addition to call `initSimulation()` at startup. No other files change.

### Pattern 1: Module-Closure Singleton

**What:** Wrap `units` Map and tick counter in the module scope; export only the public API. Nothing leaks to global.

**When to use:** Whenever a stateful service has exactly one instance per process.

```typescript
// server/src/simulation.ts
import type { Unit, TickDelta, GameEvent, Team } from './types.js'

const units = new Map<string, Unit>()
let tick = 0
const subscribers: Array<(delta: TickDelta) => void> = []

export function initSimulation(): void {
  generateUnits()
  console.log(`[sim] ${units.size} units generated`)
}

export function startTickLoop(): NodeJS.Timeout {
  return setInterval(runTick, 1000)
}

export function subscribe(cb: (delta: TickDelta) => void): () => void {
  subscribers.push(cb)
  return () => subscribers.splice(subscribers.indexOf(cb), 1)
}

export function getUnits(): Map<string, Unit> {
  return units
}
```

Note the `.js` extension on the import — **required** by NodeNext module resolution even when the source file is `.ts`. TypeScript with `moduleResolution: NodeNext` resolves `.ts` files via their compiled `.js` names.

### Pattern 2: Zero-Padded Counter ID

**What:** Generate IDs as `u-00001` through `u-20000` using `String.prototype.padStart`.

**When to use:** When IDs must be human-readable in logs and sortable lexicographically.

```typescript
function makeId(n: number): string {
  return 'u-' + String(n).padStart(5, '0')
}
```

This is preferable to UUIDs for this use case — IDs are predictable, logged clearly, and the client spec uses the `u-NNNNN` format in design examples.

### Pattern 3: Reservoir Sampling for Random Living Unit Selection

**What:** Select exactly `count` living units from the `units` Map in O(n) without building an intermediate array of all living unit keys on every tick.

**When to use:** Hot path — called every 1000ms with 20k entries.

The naive approach — `Array.from(units.values()).filter(alive)` — allocates a 20k-element array every tick. This is acceptable at this scale (modern V8 handles it in < 1ms) but reservoir sampling avoids the allocation entirely.

For this project, the simpler approach is sufficient and clearer:

```typescript
function selectLivingUnits(count: number): Unit[] {
  // Collect living units into a single pass
  const living: Unit[] = []
  for (const unit of units.values()) {
    if (unit.status !== 'destroyed') living.push(unit)
  }
  if (living.length === 0) return []

  // Clamp selection count to available living units
  const n = Math.min(count, living.length)

  // Fisher-Yates partial shuffle (only shuffle the first n elements)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (living.length - i))
    ;[living[i], living[j]] = [living[j], living[i]]
  }
  return living.slice(0, n)
}
```

### Pattern 4: Mutate-Then-Snapshot for TickDelta changes[]

**What:** Mutate the unit object in-place in the Map, then push a **shallow copy** into `changes[]`.

**When to use:** Always — spreading the object before pushing ensures the SSE broadcast sends the state at tick time, not a live reference that may be mutated by the next tick before serialisation.

```typescript
// Mutate in-place
unit.x = clamp(unit.x + dx, 0, 1000)
unit.status = 'moving'

// Push shallow copy into changes — NOT the live reference
changes.push({ ...unit })
```

### Pattern 5: Random Count in [200, 350] Range

**What:** `Math.floor(Math.random() * 151) + 200` produces integers uniformly in [200, 350].

```typescript
const tickCount = Math.floor(Math.random() * 151) + 200
```

### Pattern 6: Attack — Find a Nearby Enemy

**What:** For an attacking unit, find an enemy within a proximity radius. Full O(n) scan is acceptable at 20k scale given the 1-second tick budget.

```typescript
function findNearbyEnemy(attacker: Unit): Unit | undefined {
  const RADIUS = 50 // tunable
  for (const candidate of units.values()) {
    if (candidate.team === attacker.team) continue
    if (candidate.status === 'destroyed') continue
    const dx = candidate.x - attacker.x
    const dy = candidate.y - attacker.y
    if (dx * dx + dy * dy <= RADIUS * RADIUS) return candidate
  }
  return undefined
}
```

The early `continue` guards mean most candidates are rejected in 2 comparisons. A spatial index (quad tree, grid) would be O(log n) but introduces hand-rolled complexity for no observable benefit at this scale and tick rate.

### Pattern 7: Action Weight Distribution

**What:** Use a weighted random to decide move / attack / idle proportions.

```typescript
function pickAction(): 'move' | 'attack' | 'idle' {
  const r = Math.random()
  if (r < 0.40) return 'move'
  if (r < 0.70) return 'attack'
  return 'idle'
}
```

Weights are tunable; 40/30/30 gives a lively simulation with visible combat events.

### Pattern 8: Clamp Helper

```typescript
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
```

Used for both coordinate bounds (0–1000) and health (prevent negative values from propagating).

### Anti-Patterns to Avoid

- **Pushing live Map references into `changes[]`:** The SSE layer will `JSON.stringify` the delta some milliseconds later. If the same unit object is mutated by the next tick in between, the serialised value will be the next tick's state. Always spread: `{ ...unit }`.
- **`Array.from(units.keys())` then `units.get(id)` in the loop body:** Double lookup. Iterate `units.values()` or `units.entries()` directly.
- **Modifying the `units` Map while iterating it:** `Map` iteration order is insertion order and is safe to read while iterating, but deleting/adding entries mid-iteration is undefined behaviour. Never delete `destroyed` units — the client needs them in the snapshot. Keep them in the Map with `status: 'destroyed'`.
- **Calling `setInterval` multiple times without storing the handle:** Always store the return value to allow clean shutdown / testing.
- **`idle` units appear in `changes[]`:** Only push units whose state actually changed (move or attack outcomes). Idle means nothing changed — omit from `changes[]`. This keeps the delta minimal and matches the 200–350 range (not all selected units will change if some idle).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Module-level singleton | Global variable with `export let units = ...` | Module closure (unexported `const units`) | Global `let` allows external reassignment; closure enforces encapsulation |
| Coordinate clamping | Inline `if` branches everywhere | `clamp()` helper | Easy to miss edge cases; one place to fix |
| Action weighting | `switch` on `Math.floor(Math.random() * 3)` | Weighted threshold function | Easier to adjust proportions without changing code structure |

**Key insight:** There is nothing in this phase that requires an external library. All complexity is domain logic, not infrastructure.

---

## Common Pitfalls

### Pitfall 1: NodeNext Import Extensions

**What goes wrong:** TypeScript compiles fine but `tsx` (or compiled `node dist/`) throws `ERR_MODULE_NOT_FOUND` at runtime.

**Why it happens:** `moduleResolution: NodeNext` requires explicit `.js` extensions in import paths, even when the source is `.ts`. TypeScript resolves the `.ts` file but the emitted JS uses the literal extension written in the source.

**How to avoid:** Always write `import ... from './simulation.js'` in `index.ts`. The `.js` extension refers to the compiled output; `tsx` handles the redirect to the `.ts` source during dev.

**Warning signs:** Works in `ts-node` (legacy resolution), breaks in `tsx` or compiled output.

### Pitfall 2: setInterval Drift

**What goes wrong:** Over hours, ticks accumulate small delays. If the tick counter is used for relative timing (e.g. event timestamps), it drifts from wall-clock time.

**Why it happens:** `setInterval` fires "at least" N ms later, not exactly N ms later. Callback execution time adds up.

**How to avoid:** For this project, `tick` is a simple monotonic counter (++tick) used only as an identifier. No wall-clock dependence. Drift is harmless.

**Warning signs:** Would only matter if ticks were used to compute elapsed real time.

### Pitfall 3: Destroyed Units Accumulate in the Living Pool

**What goes wrong:** After thousands of ticks, the living-unit scan slows down as most units are destroyed but still iterated.

**Why it happens:** Units are never removed from the Map — they stay with `status: 'destroyed'`.

**How to avoid:** The `selectLivingUnits` function filters `status !== 'destroyed'` in O(n). As the destroyed count grows, the living count shrinks, keeping the selected 200–350 proportionally correct. The overall scan of 20k is always O(20k) — acceptable.

**Warning signs:** `living.length` shrinks to zero. The spec handles this: "select 200–350 random living units, **or all remaining living units if fewer than 200 survive**." The `Math.min(count, living.length)` in `selectLivingUnits` handles this edge case.

### Pitfall 4: Target Health Goes Below Zero

**What goes wrong:** Health is set to a negative number instead of clamped to 0. Downstream clients rendering health bars or computing alive counts get incorrect results.

**Why it happens:** `target.health -= damage` without a floor.

**How to avoid:** `target.health = Math.max(0, target.health - damage)`. The `destroyed` status check should be `health <= 0` (includes exact zero from multiple attacks).

### Pitfall 5: Attack Target Also Selected This Tick

**What goes wrong:** Unit A attacks Unit B. Unit B is also selected this tick and attacks Unit A. Both are mutated. Unit B's health was already reduced when Unit B's action runs — but since we mutated the live object and spread it into `changes[]` at the end of B's action, the final state is correct. **This is not actually a bug** — just a footgun to be aware of.

**How to avoid:** Run all action dispatch in a single pass. Each unit's action reads the current live Map state (including damage already dealt to it this tick) and writes back. The final `changes[]` array contains the end-of-tick state for all mutated units, which is what clients need.

### Pitfall 6: `changes[]` Contains Duplicate Unit Entries

**What goes wrong:** Unit B is attacked by Unit A and mutated (pushed to `changes[]`). Unit B is also selected as an active unit this tick and performs an action (pushed to `changes[]` again). The delta has two entries for Unit B.

**Why it happens:** The changes array is built by appending — no deduplication.

**How to avoid:** Use a `Map<string, Unit>` as the `changesMap` accumulator during tick processing. After all actions, convert to array: `Array.from(changesMap.values())`. Last write wins, which is correct since each write is the post-action state.

```typescript
const changesMap = new Map<string, Unit>()
// ... after mutating a unit:
changesMap.set(unit.id, { ...unit })
// At end of tick:
const changes = Array.from(changesMap.values())
```

---

## Code Examples

Verified patterns based on the project's established types and TypeScript config:

### Full Tick Function Skeleton

```typescript
// server/src/simulation.ts
function runTick(): void {
  tick++
  const count = Math.floor(Math.random() * 151) + 200
  const selected = selectLivingUnits(count)

  const changesMap = new Map<string, Unit>()
  const events: GameEvent[] = []

  for (const unit of selected) {
    const action = pickAction()

    if (action === 'move') {
      const dx = (Math.random() * 10) - 5   // ±5
      const dy = (Math.random() * 10) - 5
      unit.x = clamp(unit.x + dx, 0, 1000)
      unit.y = clamp(unit.y + dy, 0, 1000)
      unit.status = 'moving'
      changesMap.set(unit.id, { ...unit })

    } else if (action === 'attack') {
      const target = findNearbyEnemy(unit)
      if (target) {
        const damage = Math.floor(Math.random() * 16) + 5  // 5–20
        target.health = Math.max(0, target.health - damage)
        unit.status = 'attacking'

        events.push({ type: 'attack', unitId: unit.id, targetId: target.id, tick })
        changesMap.set(unit.id, { ...unit })
        changesMap.set(target.id, { ...target })

        if (target.health <= 0) {
          target.status = 'destroyed'
          changesMap.set(target.id, { ...target })
          events.push({ type: 'destroyed', unitId: target.id, tick })
        }
      } else {
        // No nearby enemy — treat as idle, no change recorded
      }
    }
    // idle: no mutation, no entry in changesMap
  }

  const delta: TickDelta = { tick, changes: Array.from(changesMap.values()), events }
  console.log(`[sim] tick ${tick}: ${delta.changes.length} changes, ${events.length} events`)

  for (const cb of subscribers) cb(delta)
}
```

### Unit Generation

```typescript
function generateUnits(): void {
  let n = 0
  for (const team of ['alpha', 'bravo'] as Team[]) {
    for (let i = 0; i < 10_000; i++) {
      n++
      const id = 'u-' + String(n).padStart(5, '0')
      units.set(id, {
        id,
        team,
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        health: Math.random() * 100,
        status: 'idle',
      })
    }
  }
}
```

### Wiring into index.ts

```typescript
// server/src/index.ts (addition)
import { initSimulation, startTickLoop } from './simulation.js'

// After server.listen():
initSimulation()
startTickLoop()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ts-node` with CommonJS | `tsx` with ESM NodeNext | Node.js 12 → 14+ | `.js` extensions required in imports |
| Manual UUID library (`uuid`) | `crypto.randomUUID()` (built-in) | Node.js 14.17 | No extra dependency needed for IDs |
| `require()` dynamic imports | Static ESM `import` | TypeScript 4+ / Node 14+ | Top-level await available, no wrapper function needed |

**Deprecated/outdated:**
- `ts-node` with `esm` loader flag: replaced by `tsx` which handles NodeNext cleanly without flags
- `--experimental-specifier-resolution=node` flag: was used to skip `.js` extensions; removed in Node.js 20; don't use

---

## Open Questions

1. **Action weight tuning**
   - What we know: move/attack/idle weights determine how many events appear in the feed and how fast units die
   - What's unclear: no specific weights specified in requirements
   - Recommendation: use 40% move / 30% attack / 30% idle as a starting point; easy to adjust

2. **Attack proximity radius**
   - What we know: spec says "reduce a nearby enemy's health" but does not define "nearby"
   - What's unclear: radius affects how often attacks succeed vs. fall back to idle
   - Recommendation: use radius = 50 (5% of the 0–1000 grid); tunable constant at module top

3. **`capture` event type**
   - What we know: `GameEvent.type` includes `'capture'` per `types.ts`; the Phase 2 requirements do not mention it
   - What's unclear: capture events are only specified in Phase 5 (zone control overlay)
   - Recommendation: Phase 2 need not emit any `capture` events; the type exists in the schema for Phase 5 use

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in project — no jest.config, vitest.config, or test/ directory |
| Config file | Wave 0: create `server/vitest.config.ts` |
| Quick run command | `cd /path/to/server && npx vitest run --reporter=verbose` |
| Full suite command | `cd /path/to/server && npx vitest run` |

`vitest` is the natural choice: works with ESM natively, no Babel, aligns with TypeScript NodeNext config, and the client already uses Vite (same ecosystem).

### Phase Requirements — Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIM-01 | `generateUnits()` produces exactly 20k units: 10k alpha + 10k bravo, positions in [0,1000], health in [0,100] | unit | `npx vitest run src/__tests__/simulation.test.ts` | Wave 0 |
| SIM-02 | `runTick()` selects 200–350 living units per tick (when >= 200 living exist) | unit | `npx vitest run src/__tests__/simulation.test.ts` | Wave 0 |
| SIM-03 | Move action mutates x/y by ±5 within bounds; attack action reduces target health by 5–20 | unit | `npx vitest run src/__tests__/simulation.test.ts` | Wave 0 |
| SIM-04 | Unit health ≤ 0 results in `status: 'destroyed'`; destroyed event emitted | unit | `npx vitest run src/__tests__/simulation.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd server && npx vitest run --reporter=verbose`
- **Per wave merge:** same (all tests in one file for this phase)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `server/vitest.config.ts` — vitest config for ESM + NodeNext
- [ ] `server/src/__tests__/simulation.test.ts` — covers SIM-01 through SIM-04
- [ ] Framework install: `npm install --save-dev vitest` in `server/` — if not already present

---

## Sources

### Primary (HIGH confidence)

- Direct read of `server/src/types.ts` — definitive type definitions for `Unit`, `Team`, `UnitStatus`, `TickDelta`, `GameEvent`
- Direct read of `server/tsconfig.json` — confirmed `moduleResolution: NodeNext`, `module: NodeNext`, `target: ES2022`
- Direct read of `server/package.json` — confirmed `"type": "module"`, `tsx` as dev runner, Fastify 5
- Direct read of `server/src/index.ts` — confirmed existing server pattern, `await server.listen()` top-level await in ESM
- Direct read of `.planning/REQUIREMENTS.md` — authoritative SIM-01 through SIM-04 definitions
- Direct read of `docs/superpowers/specs/2026-03-14-war-room-control-design.md` — canonical design decisions

### Secondary (MEDIUM confidence)

- Node.js 14.17+ `crypto.randomUUID()` built-in — established fact, no verification needed for Node.js >= 18 (confirmed by `@types/node ^25.5.0` in devDeps)
- Fisher-Yates partial shuffle — standard algorithm, well-documented in Knuth TAOCP

### Tertiary (LOW confidence)

- Vitest ESM compatibility with NodeNext resolution — assumed based on ecosystem knowledge; Wave 0 config verification recommended before committing to this choice

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external deps; all built-in Node.js
- Architecture: HIGH — fully prescribed by design spec (`simulation.ts` file, `Map<string, Unit>`, `TickDelta` shape)
- Pitfalls: HIGH — identified from direct code analysis of types and patterns (not training assumptions)
- Test framework choice: MEDIUM — Vitest is the logical fit but project has no existing test infrastructure to confirm against

**Research date:** 2026-03-14
**Valid until:** 2026-09-14 (stable domain — pure Node.js standard library, no versioned API surface to expire)
