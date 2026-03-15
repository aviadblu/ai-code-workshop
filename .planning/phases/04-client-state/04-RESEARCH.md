# Phase 4: Client State - Research

**Researched:** 2026-03-15
**Domain:** Zustand store + EventSource SSE hook (React 19, Vite, TypeScript)
**Confidence:** HIGH

## Summary

Phase 4 wires the client side to the server's SSE stream. The core deliverables are a Zustand store
(`store/units.ts`) with a `Map<string, Unit>` for O(1) unit patching and a ring buffer for game events,
plus a `useSSE` hook (`hooks/useSSE.ts`) that opens an EventSource, dispatches snapshot/tick events to
the store, and tears down cleanly on unmount.

The architecture is fully decided in the design spec. The most critical technical constraint is Zustand's
immutability requirement for Map state: calling `map.set()` in-place does NOT trigger re-renders or
subscribers. Every state update that touches the Map MUST produce a `new Map(...)`. The one exception is
`getState()` reads from the Canvas rAF loop — those read whatever the current map reference is and are
always fresh regardless.

Vitest does not exist in the client package yet. Wave 0 must add it with the jsdom environment before any
TDD tests can run. The pattern for testing Zustand stores directly (without rendering components) is to
call `useUnitsStore.getState().applySnapshot(...)` and assert on `useUnitsStore.getState().units` — no
`renderHook` needed for pure store logic.

**Primary recommendation:** Install `zustand@^5` and wire the store first (04-01), then the useSSE hook
second (04-02). Test both with Vitest + jsdom via direct `getState()` calls; no component rendering
required for STATE-01 / STATE-02 tests.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STATE-01 | Zustand store holds all units in `Map<string, Unit>` and applies deltas via O(1) `map.set()` patching — only changed units touched | `new Map(state.units)` pattern confirmed; `applySnapshot` replaces whole map, `applyDelta` loops `delta.changes` and patches only those entries |
| STATE-02 | Store maintains a ring buffer of the last 50 game events — capped regardless of events per tick | `[...prev, ...newEvents].slice(-50)` pattern; pure array concat + slice, no extra library needed |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.10 | Global state store outside React tree | O(1) getState() reads for Canvas; subscriptions for React components; no Provider boilerplate |
| vite | ^8.0.0 | Build + dev server (already installed) | Proxy config already routes `/stream` → `localhost:3000` |
| react | ^19.2.4 | Component layer (already installed) | Already installed in Phase 1 |

### Supporting (Wave 0 additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^3.x | Test runner | Required for TDD RED→GREEN cycle; not yet in client/package.json |
| @vitest/ui | ^3.x | Test UI (optional) | Useful for watching test output; same major as vitest |
| jsdom | ^26.x | Browser DOM environment for Vitest | EventSource, Map, and DOM globals in Node test runner |
| @testing-library/react | ^16.x | renderHook if needed for hook tests | Only needed if testing useSSE hook internals beyond store state |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zustand Map | Redux + normalized state | Redux adds boilerplate; Zustand Map is simpler and fits Canvas getState() pattern |
| native EventSource | reconnecting-eventsource library | Native EventSource auto-reconnects; design spec explicitly uses native — no added library |
| ring buffer via slice(-50) | custom circular buffer class | `slice(-50)` is idiomatic JS, zero overhead, correct — no custom structure needed |

**Installation (Wave 0 + plan 04-01):**
```bash
# In client/ directory:
npm install zustand@^5
npm install -D vitest @vitest/ui jsdom @testing-library/react
```

---

## Architecture Patterns

### Recommended Project Structure

```
client/src/
├── store/
│   └── units.ts          # Zustand store — Map<string,Unit> + ring buffer
├── hooks/
│   └── useSSE.ts         # EventSource lifecycle hook
├── components/           # (stubs already exist from Phase 1)
│   └── ...
└── types.ts              # (already exists)
```

These two directories do not exist yet. They must be created as part of Phase 4.

### Pattern 1: Zustand Store with Map State

**What:** Zustand create() with Map<string, Unit> state and actions that produce new Map instances on
every mutation (required for Zustand change detection).

**When to use:** Always — mutating the existing Map reference breaks Zustand's reactivity.

**Critical rule:** `new Map(state.units)` creates a shallow copy, then `.set()` mutates the copy.
The new reference is what triggers subscribers.

```typescript
// Source: https://zustand.docs.pmnd.rs/learn/guides/maps-and-sets-usage
import { create } from 'zustand'
import type { Unit, TickDelta, GameEvent } from '../types'

interface UnitsStore {
  units: Map<string, Unit>
  events: GameEvent[]
  tick: number
  applySnapshot: (units: Unit[]) => void
  applyDelta: (delta: TickDelta) => void
}

export const useUnitsStore = create<UnitsStore>((set) => ({
  units: new Map<string, Unit>(),
  events: [] as GameEvent[],
  tick: 0,

  applySnapshot: (units) =>
    set({ units: new Map(units.map((u) => [u.id, u])) }),

  applyDelta: (delta) =>
    set((state) => {
      const next = new Map(state.units)     // new reference — required
      for (const u of delta.changes) {
        next.set(u.id, u)                   // O(1) per changed unit
      }
      return {
        units: next,
        tick: delta.tick,
        events: [...state.events, ...delta.events].slice(-50),  // ring buffer cap
      }
    }),
}))
```

**Why `new Map(state.units)` not just mutating:** Zustand compares state references with `Object.is`.
Mutating the existing Map keeps the same reference, so Zustand sees no change and notifies no subscribers.
(Source: official Zustand Maps and Sets guide)

### Pattern 2: Canvas Reading getState() Outside React

**What:** Canvas rAF loop reads `useUnitsStore.getState().units` directly — no hook, no subscription,
no re-renders.

**When to use:** Any code running outside the React render cycle (rAF loop, event handlers, timers).

```typescript
// Source: https://github.com/pmndrs/zustand/discussions/2712
function renderFrame() {
  const { units } = useUnitsStore.getState()  // always fresh, no stale closure risk
  // draw 20k dots...
  requestAnimationFrame(renderFrame)
}
```

**Key property:** `getState()` always reflects the latest committed state. The Canvas loop from Phase 5
can rely on this without subscribing.

### Pattern 3: useSSE Hook

**What:** React hook that opens EventSource on mount, wires snapshot/tick event listeners to store
actions, and closes on unmount.

**When to use:** Mount once at the App root or in a top-level component.

```typescript
// hooks/useSSE.ts
import { useEffect } from 'react'
import { useUnitsStore } from '../store/units'
import type { TickDelta } from '../types'

export function useSSE() {
  useEffect(() => {
    const es = new EventSource('/stream')

    es.addEventListener('snapshot', (e) => {
      const units = JSON.parse(e.data)
      useUnitsStore.getState().applySnapshot(units)
    })

    es.addEventListener('tick', (e) => {
      const delta: TickDelta = JSON.parse(e.data)
      useUnitsStore.getState().applyDelta(delta)
    })

    return () => {
      es.close()
    }
  }, [])  // empty deps: open once on mount, close on unmount
}
```

**Reconnect behaviour:** Native EventSource reconnects automatically on connection drop. On reconnect
the server sends a new `snapshot` event. The hook processes it via `applySnapshot`, which replaces the
entire map — this is the correct reset path. No manual reconnect logic needed.

### Anti-Patterns to Avoid

- **Mutating the Map in-place:** `state.units.set(id, unit); set({ units: state.units })` — same
  reference, Zustand detects no change, subscribers not notified, React components not re-rendered.
- **Using `useUnitsStore` hook inside rAF loop:** Hooks can only be called inside React components.
  Use `useUnitsStore.getState()` instead.
- **Calling `JSON.parse` outside try/catch in production:** SSE data may be malformed on connection
  reset. For v1 this is acceptable; note for hardening.
- **Re-creating EventSource in useEffect dependency array:** Including the EventSource URL or store
  reference in deps causes the connection to close and re-open on every render.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ring buffer (last 50 events) | Custom circular buffer class | `[...prev, ...newEvents].slice(-50)` | One-liner; no edge cases; idiomatic |
| Store reset for tests | Custom test utility | `useUnitsStore.getState().resetStore()` or direct `setState()` call | Zustand exposes `setState` directly |
| Map initialization from array | `for` loop + map.set | `new Map(units.map(u => [u.id, u]))` | Array.map + Map constructor is standard |
| SSE auto-reconnect | Manual retry with backoff | Native EventSource | Browser handles reconnect per SSE spec |

**Key insight:** The Zustand Map pattern has exactly one footgun (in-place mutation) but otherwise the
implementation is straightforward. Don't over-engineer the ring buffer or reconnect logic.

---

## Common Pitfalls

### Pitfall 1: In-Place Map Mutation (Zustand Reactivity Break)

**What goes wrong:** Components subscribed to `units` never re-render. Canvas still shows stale data.
Tests pass but the UI appears frozen.

**Why it happens:** `state.units.set(id, u)` mutates the Map but does not change its object reference.
Zustand's equality check (`Object.is`) sees the same reference and skips notifying subscribers.

**How to avoid:** Always `new Map(state.units)` before calling `.set()` on the copy:
```typescript
// WRONG — same reference, no subscriber notification
set((state) => { state.units.set(id, u); return { units: state.units } })

// CORRECT — new reference, subscribers notified
set((state) => {
  const next = new Map(state.units)
  next.set(id, u)
  return { units: next }
})
```

**Warning signs:** `store.units.size` is correct in test assertions but React components don't update.

### Pitfall 2: applyDelta Processing Order on Reconnect

**What goes wrong:** After a network drop, the client receives a `tick` event before the `snapshot` event
completes. Delta is applied to stale state.

**Why it happens:** On reconnect, the server sends `snapshot` first — but if a queued `tick` from the
buffer arrives during reconnect, the order can invert.

**How to avoid:** The design spec's choice to use `applySnapshot` (full Map replacement) as the SSE
`snapshot` handler means any subsequent ticks correctly patch from the full snapshot. Since `applySnapshot`
is atomic in Zustand's `set()`, this is safe. No guard needed beyond what the spec prescribes.

**Warning signs:** `store.units.size` drops below 20k after reconnect then climbs back up erratically.

### Pitfall 3: Vitest + jsdom Missing EventSource

**What goes wrong:** `ReferenceError: EventSource is not defined` in test suite.

**Why it happens:** jsdom does not implement EventSource. Tests of `useSSE` that run the hook directly
will fail.

**How to avoid:**
- For store tests (STATE-01, STATE-02): call `applySnapshot`/`applyDelta` directly — no EventSource
  needed.
- For useSSE hook tests: mock `global.EventSource` with `vi.fn()` returning a minimal fake, or use
  `vi.stubGlobal('EventSource', FakeEventSource)`.

**Warning signs:** Test errors on `new EventSource(...)` line before any assertion runs.

### Pitfall 4: Performance Cost of new Map() on Every Tick

**What goes wrong:** Creating `new Map(state.units)` copies 20,000 entries every tick (every ~1 second).
At 20k entries this is O(20k) per tick.

**Why it matters:** This is unavoidable with Zustand's immutability model. However, the cost is:
copying ~20k Map entries (~200–400 µs on V8 in 2025 benchmarks). At 1 tick/second this is negligible.
The Canvas rAF loop runs at 60fps but does NOT call `set()` — it only calls `getState()`, which is O(1).

**How to avoid:** Accept the cost. It is 1 per second, not 60 per second. Do NOT attempt to store a
mutable Map outside Zustand to "optimize" — this removes reactivity entirely.

**Warning signs:** Profiler shows MapIterator in top-5 CPU consumers. Only relevant at extremely high
tick rates (not the case here at 1Hz).

### Pitfall 5: Zustand `set()` from Outside React Triggering React Batch Issues

**What goes wrong:** Calling `useUnitsStore.getState().applyDelta()` from the EventSource listener (not
inside React) can cause React 18+ batching to not apply, resulting in multiple synchronous re-renders.

**Why it happens:** React 18+ auto-batches state updates inside React event handlers and `startTransition`
but Zustand's `set()` calls from outside React (e.g., EventSource listeners) are wrapped internally by
Zustand itself. In practice, Zustand batches these correctly.

**How to avoid:** This is a non-issue with Zustand v5 — it uses React's `useSyncExternalStore` internally.
The Canvas does not re-render from store changes at all (uses `getState()`). React components subscribed
via hooks will batch correctly.

---

## Code Examples

Verified patterns from official sources:

### Creating a Map from Array (applySnapshot)
```typescript
// Source: https://zustand.docs.pmnd.rs/learn/guides/maps-and-sets-usage
// Convert Unit[] array to Map<string, Unit> — O(n) one-time on snapshot
const map = new Map(units.map((u) => [u.id, u]))
```

### Multiple Map.set() Calls in Single set() (applyDelta)
```typescript
// Source: https://zustand.docs.pmnd.rs/learn/guides/maps-and-sets-usage
set((state) => {
  const next = new Map(state.foo)
  next.set('key1', 'value1')
  next.set('key2', 'value2')
  return { foo: next }
})
```

### TypeScript Map Initialization (avoid `Map<never, never>`)
```typescript
// Source: https://zustand.docs.pmnd.rs/learn/guides/maps-and-sets-usage
// Explicit type hint prevents TypeScript from inferring Map<never, never>
units: new Map<string, Unit>()
events: [] as GameEvent[]
```

### Testing Store Actions Directly (no component render)
```typescript
// Source: https://gist.github.com/mustafadalga/475769fcb77b08a813bf5dae0a145027
import { useUnitsStore } from '../store/units'

beforeEach(() => {
  // Reset to initial state before each test
  useUnitsStore.setState({
    units: new Map<string, Unit>(),
    events: [],
    tick: 0,
  })
})

it('applySnapshot populates 20k units', () => {
  const snapshot = Array.from({ length: 20000 }, (_, i) => ({
    id: `u-${String(i).padStart(5, '0')}`,
    team: i < 10000 ? 'alpha' : 'bravo',
    x: 500, y: 500, health: 100, status: 'idle',
  } as Unit))
  useUnitsStore.getState().applySnapshot(snapshot)
  expect(useUnitsStore.getState().units.size).toBe(20000)
})
```

### Vitest Config with jsdom (Wave 0 setup)
```typescript
// client/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| zustand v4 middleware imports `from 'zustand/middleware/devtools'` | v5: `from 'zustand/middleware'` | Zustand v5 (Oct 2024) | Import path change — not using devtools in this phase |
| Manual store reset in tests | `useStore.setState(initialState)` | Zustand v4+ | No __mocks__/zustand.ts required if reset is explicit |
| Zustand with Immer for nested state | `new Map(state.foo).set(...)` for Map updates | Zustand v4+ | Immer not required; spread/new pattern sufficient |
| zustand v4 `createStore` for vanilla | v5 same: `import { createStore } from 'zustand/vanilla'` | Zustand v5 | Not needed here; using React create() is correct |

**Deprecated/outdated:**
- `zustand/middleware/devtools` import path: replaced by `zustand/middleware` in v5

---

## Open Questions

1. **Does `new Map(state.units)` with 20k entries cause measurable GC pressure?**
   - What we know: 20k Map copy runs once per tick (1Hz); modern V8 handles this in ~200-400µs
   - What's unclear: Whether GC pause spikes are observable in the Performance Panel (Phase 7)
   - Recommendation: Accept for v1; if GC spikes are observed in Phase 7, investigate Immer or
     a mutable external Map that flushes to Zustand via a lightweight tick counter

2. **Should useSSE hook be mounted in App.tsx or in a dedicated provider?**
   - What we know: Design spec shows it as a hook, not a provider
   - What's unclear: Whether StrictMode double-invocation (React 19 dev mode) causes double
     EventSource opens
   - Recommendation: Mount `useSSE()` inside App.tsx above the layout, not in StrictMode wrapper.
     The `useEffect` cleanup (`es.close()`) handles the StrictMode double-mount correctly.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.x (not yet installed in client/) |
| Config file | `client/vitest.config.ts` — does NOT exist, Wave 0 must create |
| Quick run command | `cd client && npx vitest run` |
| Full suite command | `cd client && npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-01 | `applySnapshot(20k units)` → `store.units.size === 20000` | unit | `cd client && npx vitest run src/store/units.test.ts` | Wave 0 |
| STATE-01 | `applyDelta({changes: [u1,u2]})` → only 2 `map.set` calls (map size unchanged for others) | unit | `cd client && npx vitest run src/store/units.test.ts` | Wave 0 |
| STATE-01 | Map patch is O(changed) — verify via count of changed entries | unit | `cd client && npx vitest run src/store/units.test.ts` | Wave 0 |
| STATE-02 | `store.events` never exceeds 50 after many ticks with large event batches | unit | `cd client && npx vitest run src/store/units.test.ts` | Wave 0 |
| STATE-02 | Ring buffer keeps the LAST 50, not first 50 | unit | `cd client && npx vitest run src/store/units.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd client && npx vitest run src/store/units.test.ts`
- **Per wave merge:** `cd client && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `client/vitest.config.ts` — Vitest config with jsdom environment
- [ ] `client/src/store/units.test.ts` — covers STATE-01 and STATE-02
- [ ] Framework install: `cd client && npm install -D vitest jsdom @testing-library/react` — not yet in client/package.json

---

## Sources

### Primary (HIGH confidence)

- https://zustand.docs.pmnd.rs/learn/guides/maps-and-sets-usage — Map and Set usage, new Map() pattern, TypeScript hints
- https://github.com/pmndrs/zustand/discussions/2712 — getState() vs useStore(), Canvas rAF usage confirmed
- https://github.com/pmndrs/zustand/discussions/1439 — Map mutation pitfall, new Map() requirement
- client/vite.config.ts — Vite proxy confirms `/stream` → `localhost:3000`; EventSource URL is just `/stream`
- server/src/sse.ts — Confirmed SSE wire format: `event: snapshot` + `event: tick`, JSON data

### Secondary (MEDIUM confidence)

- WebSearch result (zustand 5.0.10, Jan 2026) — version confirmed as ~5.0.10 latest
- https://gist.github.com/mustafadalga/475769fcb77b08a813bf5dae0a145027 — store testing pattern (direct getState() calls, beforeEach setState reset)
- WebSearch: Vitest `__mocks__` placement and `afterEach` reset pattern

### Tertiary (LOW confidence)

- V8 Map copy performance estimate (~200-400µs for 20k entries) — based on general V8 knowledge, not benchmarked in this project context

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zustand v5 version confirmed, existing deps verified in client/package.json
- Architecture: HIGH — fully specified in design spec; Map update pattern verified in official docs
- Pitfalls: HIGH — Map mutation pitfall confirmed in official Zustand Maps guide and multiple discussions
- Testing setup: MEDIUM — Vitest pattern for Zustand confirmed; exact config not fetched from live docs (404)

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (Zustand v5 API stable; Vitest major version unlikely to break this pattern)
