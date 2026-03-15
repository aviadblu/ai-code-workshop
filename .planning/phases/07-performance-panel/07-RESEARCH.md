# Phase 7: Performance Panel - Research

**Researched:** 2026-03-15
**Domain:** Browser Performance APIs, React conditional mounting, Zustand subscriptions, 2Hz update throttling
**Confidence:** HIGH

---

## Summary

Phase 7 implements a collapsible performance overlay that reads five metrics entirely from browser APIs: FPS (via rAF timestamps), frame time (raw rAF delta), JS heap (`performance.memory`), API latency (`PerformanceObserver` on `/stream` resource entries), and store update rate (Zustand subscription counter). All design decisions are locked by the spec — no library choices remain open.

The critical architectural concern is self-monitoring overhead: the panel must not materially affect the app it monitors. This is solved by three mechanisms already specified: (1) conditional mounting so the panel is entirely absent from the React tree when closed, (2) throttling display to 2Hz via `setInterval(500)` while metrics accrue in refs between samples, and (3) keeping the rAF measurement loop inside a custom hook (`usePerformance`) that shares the existing rAF tick rather than starting a second one.

The second critical concern is jsdom test limitations: `performance.memory`, `PerformanceObserver`, and `requestAnimationFrame` are not faithfully implemented in jsdom. Tests must mock all three. This is the same pattern used in Phase 5 (TacticalMap canvas tests) and Phase 6 (jsdom colour normalization), so the project already has an established mock pattern.

**Primary recommendation:** Implement `usePerformance` hook first (data collection, fully testable via mocks), then wire `PerformancePanel` around it (2Hz display + collapsible state). Two plans as specified in ROADMAP.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 | Performance panel displays FPS, frame time (ms), JS heap (MB), API latency, and store update rate — all sourced from browser APIs only | Browser API section documents each source; hook pattern provides clean separation for testing |
| PERF-02 | Performance panel updates at 2Hz, is conditionally mounted (zero overhead when closed), and applies green/yellow/red health thresholds per metric | setInterval(500) throttle pattern; conditional mount via parent boolean state; threshold table documents colour values |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 (already installed) | Conditional mount via `{isOpen && <PerformancePanel />}` | Project standard; conditional render causes true unmount |
| Zustand | 5.0.11 (already installed) | `useUnitsStore.subscribe()` for store update counter | Project standard; `.subscribe()` is the escape hatch for non-reactive counting |
| Vitest | 3.2.4 (already installed) | Test framework | Project standard; all prior phases use it |
| @testing-library/react | 16.3.2 (already installed) | Component render/query | Project standard |

### No New Dependencies
This phase requires zero new npm packages. All browser APIs (`requestAnimationFrame`, `performance.memory`, `PerformanceObserver`) are native globals.

**Installation:**
```bash
# No new packages needed
```

---

## Architecture Patterns

### Recommended Project Structure

The design spec already defines the file layout. Phase 7 touches exactly:

```
client/src/
├── hooks/
│   └── usePerformance.ts     # NEW — data collection hook
├── components/
│   └── PerformancePanel.tsx  # REPLACE stub — UI + collapsible toggle
└── App.tsx                   # NO CHANGE needed (already imports PerformancePanel)
```

`App.tsx` already renders `<PerformancePanel />` unconditionally. The collapsible toggle must be owned inside `PerformancePanel` — it renders a toggle button, and when closed renders only the button (not the metrics). This avoids needing to lift state into `App.tsx`.

### Pattern 1: usePerformance Hook — Data Collection

**What:** A custom hook that wires up all five metric sources and returns a snapshot object. It owns the rAF loop for FPS/frame-time measurement and the setInterval for display-rate throttling.

**When to use:** Mounted only while `PerformancePanel` is open (hook lives inside the panel body, not the outer wrapper).

**Key implementation notes:**
- FPS ring buffer: use a `useRef<number[]>` to accumulate the last 60 rAF timestamps. FPS = 60 / (timestamps[last] - timestamps[first]) * 1000. Reset when full (sliding window, not clear-and-restart).
- Frame time: the raw delta between consecutive rAF calls in ms.
- JS heap: `(performance as any).memory?.usedJSHeapSize / 1048576` — always cast and guard with `?.` because `performance.memory` is Chrome-only and `undefined` in Firefox/Safari.
- PerformanceObserver: observe `'resource'` entries and filter by `entry.name.includes('/stream')`. Use the latest entry's `duration` in ms. Keep the last seen value in a ref.
- Store update rate: call `useUnitsStore.subscribe(() => { counterRef.current++ })` inside a `useEffect`. Reset `counterRef.current = 0` each second via the same setInterval.

**Example skeleton:**
```typescript
// Source: MDN PerformanceObserver + project pattern from TacticalMap.tsx
export function usePerformance() {
  const metricsRef = useRef({ fps: 0, frameTime: 0, heap: 0, apiLatency: 0, storeRate: 0 })
  const [snapshot, setSnapshot] = useState(metricsRef.current)
  const rafTimestampsRef = useRef<number[]>([])
  const storeCounterRef = useRef(0)
  const lastRafRef = useRef<number>(0)

  useEffect(() => {
    // PerformanceObserver for API latency
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries().filter(e => e.name.includes('/stream'))
      if (entries.length > 0) {
        metricsRef.current.apiLatency = entries[entries.length - 1].duration
      }
    })
    observer.observe({ type: 'resource', buffered: true })

    // Zustand store update counter
    const unsubscribe = useUnitsStore.subscribe(() => { storeCounterRef.current++ })

    // rAF loop for FPS + frame time
    let rafId: number
    const tick = (now: number) => {
      const delta = now - lastRafRef.current
      lastRafRef.current = now
      metricsRef.current.frameTime = delta

      const ts = rafTimestampsRef.current
      ts.push(now)
      if (ts.length > 60) ts.shift()
      if (ts.length >= 2) {
        metricsRef.current.fps = Math.round((ts.length - 1) / ((ts[ts.length - 1] - ts[0]) / 1000))
      }

      metricsRef.current.heap = (performance as any).memory?.usedJSHeapSize / 1048576 ?? 0
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    // 2Hz display throttle
    const intervalId = setInterval(() => {
      metricsRef.current.storeRate = storeCounterRef.current
      storeCounterRef.current = 0
      setSnapshot({ ...metricsRef.current })
    }, 500)

    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(intervalId)
      observer.disconnect()
      unsubscribe()
    }
  }, [])

  return snapshot
}
```

### Pattern 2: PerformancePanel — Collapsible Wrapper

**What:** The component owns its own open/closed toggle. When closed, it renders only a toggle button. When open, it renders the metrics grid by calling `usePerformance()` (which is inside the open branch, so the hook only runs when mounted).

**Critical:** `usePerformance` must be called inside a child component, not conditionally in the parent. React rules prohibit conditional hook calls. The standard pattern is to split into an outer wrapper and an inner `PerfMetrics` component:

```typescript
// Outer: always rendered, owns toggle state
export default function PerformancePanel() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}>
        {open ? 'Hide Perf' : 'Show Perf'}
      </button>
      {open && <PerfMetrics />}   // conditional mount — zero overhead when false
    </div>
  )
}

// Inner: only mounted when open, calls usePerformance safely
function PerfMetrics() {
  const metrics = usePerformance()
  return <MetricsGrid metrics={metrics} />
}
```

### Pattern 3: Threshold Colouring

**What:** Each metric has a green/yellow/red threshold. A pure function maps value to colour string.

**Recommended thresholds** (based on spec guidance of "health" indicators for this app):

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| FPS | >= 50 | >= 30 | < 30 |
| Frame time (ms) | <= 20 | <= 33 | > 33 |
| JS Heap (MB) | <= 200 | <= 500 | > 500 |
| API latency (ms) | <= 100 | <= 500 | > 500 |
| Store updates/s | <= 5 | <= 20 | > 20 |

Implement as a pure function for testability:
```typescript
type HealthColour = '#22c55e' | '#eab308' | '#ef4444'  // green / yellow / red

function metricColour(metric: keyof Metrics, value: number): HealthColour {
  // per-metric threshold lookup
}
```

### Anti-Patterns to Avoid

- **Calling usePerformance unconditionally in PerformancePanel:** hooks cannot be conditionally called, but the hook itself should only run when the panel is open. Solution: split into outer (toggle) and inner (metrics) components.
- **Starting a second rAF loop:** the performance panel's rAF loop runs alongside TacticalMap's rAF loop. Two rAF loops at 60fps is fine (browser merges them) but avoid a third.
- **Reading performance.memory without a guard:** it's undefined in Firefox and Safari. Always `?.` chain and fallback to 0.
- **Updating state every rAF frame:** this would cause 60 React renders/second from the performance panel, which is worse than what we're measuring. All metric accumulation goes through `metricsRef`; only `setSnapshot` inside the 500ms interval triggers a React render.
- **Using useState for accumulated rAF data:** use `useRef` for ring buffers and counters. `useState` is only for the display snapshot.
- **Forgetting to unsubscribe from Zustand:** `useUnitsStore.subscribe()` returns an unsubscribe function. Must be called in the `useEffect` cleanup.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FPS measurement | Custom timing library | `requestAnimationFrame` timestamps natively | rAF is the browser's own frame budget mechanism |
| Memory reporting | Server-side memory endpoint | `performance.memory` (Chrome) | Client-side only, no server round-trip needed |
| Network latency tracking | Manual fetch wrapper with timing | `PerformanceObserver('resource')` | Already instruments all resource fetches including SSE |
| Throttled updates | Debounce library | `setInterval(fn, 500)` | Exact 2Hz requirement; no library needed for a single interval |

**Key insight:** All five metrics are available as browser primitives. The implementation is wiring, not building.

---

## Common Pitfalls

### Pitfall 1: performance.memory is Chrome-only
**What goes wrong:** `performance.memory` is `undefined` in Firefox, Safari, and any non-Chrome browser. Accessing `.usedJSHeapSize` throws.
**Why it happens:** The API is not part of the Web Performance spec — it's a Chrome V8 extension.
**How to avoid:** Always guard: `(performance as any).memory?.usedJSHeapSize ?? 0`
**Warning signs:** Runtime TypeError "Cannot read properties of undefined" in non-Chrome.

### Pitfall 2: PerformanceObserver resource entries for SSE arrive once, not per message
**What goes wrong:** SSE is a single long-lived HTTP connection. The `resource` PerformanceObserver entry fires once when the connection opens (the initial response), not per SSE message. After that, there are no more resource timing entries for `/stream`.
**Why it happens:** `PerformanceObserver` on `'resource'` tracks HTTP request/response pairs. SSE keeps the connection open indefinitely, so `duration` represents time-to-first-byte, not streaming latency.
**How to avoid:** The spec says "API latency" from `PerformanceObserver` watching resource entries for `/stream`. This is deliberately measuring connection setup latency (time-to-first-byte), not per-message latency. Display the initial value and freeze it — it correctly represents API round-trip time at connect.
**Warning signs:** API latency shows 0 or never updates after first connection.

### Pitfall 3: jsdom does not implement requestAnimationFrame, performance.memory, or PerformanceObserver
**What goes wrong:** Tests crash with "requestAnimationFrame is not defined" or "PerformanceObserver is not a constructor".
**Why it happens:** jsdom's goal is DOM compatibility, not browser timing APIs.
**How to avoid:** Mock all three in test setup:
```typescript
// In each test file or vitest setup
vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => { setTimeout(() => cb(performance.now()), 16); return 1 }))
vi.stubGlobal('cancelAnimationFrame', vi.fn())
vi.stubGlobal('PerformanceObserver', vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
})))
Object.defineProperty(performance, 'memory', {
  get: () => ({ usedJSHeapSize: 50 * 1048576 }),
  configurable: true,
})
```
**Warning signs:** "X is not defined" or "X is not a constructor" in test output.

### Pitfall 4: FPS jitter from single-frame delta
**What goes wrong:** FPS calculated as `1000 / frameDelta` varies wildly (40fps one frame, 80fps the next) because individual frame deltas jitter.
**Why it happens:** rAF timing is affected by garbage collection pauses, paint, and other work.
**How to avoid:** Average over 60 frames: `fps = (frameCount - 1) / ((lastTimestamp - firstTimestamp) / 1000)`. This is the spec requirement.
**Warning signs:** FPS display flickering rapidly between very different values.

### Pitfall 5: Hook called conditionally (React rules violation)
**What goes wrong:** `if (open) { const metrics = usePerformance() }` — React throws "Rendered more hooks than during the previous render".
**Why it happens:** React requires hooks to be called in the same order every render.
**How to avoid:** Split into `PerformancePanel` (toggle state, renders `{open && <PerfMetrics />}`) and `PerfMetrics` (calls `usePerformance()`). The hook is only called when `PerfMetrics` is mounted — which only happens when `open` is true.
**Warning signs:** React hook order error in console.

### Pitfall 6: Zustand subscribe inside render (not useEffect)
**What goes wrong:** `useUnitsStore.subscribe(...)` called at component render time creates a new subscription every render without cleanup.
**Why it happens:** Subscribe is a side-effect — it must live in `useEffect`.
**How to avoid:** Always wrap in `useEffect(() => { const unsub = store.subscribe(...); return unsub }, [])`.
**Warning signs:** Subscription count grows unboundedly; memory leak.

---

## Code Examples

### FPS averaging over 60 frames
```typescript
// Source: MDN requestAnimationFrame + project TacticalMap.tsx pattern
const timestamps = useRef<number[]>([])

const tick = (now: number) => {
  timestamps.current.push(now)
  if (timestamps.current.length > 60) timestamps.current.shift()
  const len = timestamps.current.length
  if (len >= 2) {
    const elapsed = (timestamps.current[len - 1] - timestamps.current[0]) / 1000
    metricsRef.current.fps = Math.round((len - 1) / elapsed)
  }
  rafId = requestAnimationFrame(tick)
}
```

### PerformanceObserver for /stream resource entry
```typescript
// Source: MDN PerformanceObserver API
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name.includes('/stream')) {
      metricsRef.current.apiLatency = Math.round(entry.duration)
    }
  }
})
observer.observe({ type: 'resource', buffered: true })
// buffered: true catches entries that fired before observer was registered
```

### Zustand update rate counter
```typescript
// Source: Zustand docs — subscribe() for non-reactive observation
// Project precedent: useUnitsStore.getState() in TacticalMap and useSSE
const counter = useRef(0)
useEffect(() => {
  const unsubscribe = useUnitsStore.subscribe(() => { counter.current++ })
  return unsubscribe
}, [])
```

### Threshold colour pure function
```typescript
// Pure function — fully testable without DOM
function thresholdColour(metric: string, value: number): string {
  const thresholds: Record<string, [number, number]> = {
    fps:        [50, 30],   // green if >= 50, yellow if >= 30, else red
    frameTime:  [20, 33],   // green if <= 20, yellow if <= 33, else red
    heap:       [200, 500],
    apiLatency: [100, 500],
    storeRate:  [5, 20],
  }
  const [good, warn] = thresholds[metric] ?? [Infinity, Infinity]
  // For fps: higher is better; for others: lower is better
  const higherIsBetter = metric === 'fps'
  if (higherIsBetter) {
    return value >= good ? '#22c55e' : value >= warn ? '#eab308' : '#ef4444'
  }
  return value <= good ? '#22c55e' : value <= warn ? '#eab308' : '#ef4444'
}
```

### jsdom mock pattern for rAF-based tests (project convention)
```typescript
// Matches established project pattern from Phase 5 canvas tests
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
    cb(performance.now())
    return 1
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('PerformanceObserver', vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
  })))
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `Date.now()` timing | `requestAnimationFrame` timestamps | ~2015 | rAF timestamps are from a high-res monotonic clock (same origin as `performance.now()`); more accurate |
| Polling window.performance.memory on interval | Already doing this | N/A | Correct approach; no change needed |
| Wrapping fetch() to measure latency | `PerformanceObserver('resource')` | ~2016 | No code changes needed; browser instruments automatically |

**Deprecated/outdated:**
- `window.performance.timing` (Navigation Timing Level 1): replaced by `PerformanceObserver` and `PerformanceNavigationTiming` entries in Level 2. Not relevant here since we measure resource/rAF timing, not navigation timing.

---

## Open Questions

1. **API latency display after initial connection**
   - What we know: `PerformanceObserver('resource')` fires once when `/stream` connects; SSE does not produce further resource entries.
   - What's unclear: Should the panel show "—" before the first connection, then freeze? Or poll?
   - Recommendation: Show the initial connection setup time (time-to-first-byte) and freeze it. This correctly represents what the spec says ("API latency ... PerformanceObserver watching resource entries for /stream"). Use `buffered: true` so even if the page loaded before the panel opened, the entry is captured.

2. **Second rAF loop interaction with TacticalMap**
   - What we know: TacticalMap already runs a rAF loop. PerformancePanel would add a second.
   - What's unclear: Does measuring FPS in a separate rAF loop accurately reflect TacticalMap's frame rate?
   - Recommendation: Yes — two rAF callbacks fire at the same display refresh. The FPS measured by the performance hook is the display refresh rate, which is exactly what TacticalMap runs at. No coordination needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `client/vite.config.ts` (vitest config inline) |
| Quick run command | `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run src/hooks/usePerformance.test.ts src/components/PerformancePanel.test.tsx` |
| Full suite command | `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | FPS value exposed by usePerformance | unit | `npx vitest run src/hooks/usePerformance.test.ts` | ❌ Wave 0 |
| PERF-01 | Frame time value exposed by usePerformance | unit | `npx vitest run src/hooks/usePerformance.test.ts` | ❌ Wave 0 |
| PERF-01 | Heap MB value guarded with fallback | unit | `npx vitest run src/hooks/usePerformance.test.ts` | ❌ Wave 0 |
| PERF-01 | API latency captured from PerformanceObserver | unit | `npx vitest run src/hooks/usePerformance.test.ts` | ❌ Wave 0 |
| PERF-01 | Store update rate counted per Zustand subscribe | unit | `npx vitest run src/hooks/usePerformance.test.ts` | ❌ Wave 0 |
| PERF-02 | Panel closed — only toggle button rendered, no metrics | unit | `npx vitest run src/components/PerformancePanel.test.tsx` | ❌ Wave 0 |
| PERF-02 | Panel open — metrics grid rendered | unit | `npx vitest run src/components/PerformancePanel.test.tsx` | ❌ Wave 0 |
| PERF-02 | FPS threshold: green >= 50, yellow >= 30, red < 30 | unit | `npx vitest run src/components/PerformancePanel.test.tsx` | ❌ Wave 0 |
| PERF-02 | Frame time threshold: green <= 20ms, yellow <= 33ms | unit | `npx vitest run src/components/PerformancePanel.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run src/hooks/usePerformance.test.ts src/components/PerformancePanel.test.tsx`
- **Per wave merge:** `cd /Users/aviad/code/ai-code-workshop/client && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `client/src/hooks/usePerformance.test.ts` — covers PERF-01 (all 5 metrics, mocks rAF + PerformanceObserver + performance.memory)
- [ ] `client/src/components/PerformancePanel.test.tsx` — covers PERF-02 (conditional mount, threshold colouring, toggle button)

*(No framework gaps — Vitest + @testing-library/react already installed and configured)*

---

## Sources

### Primary (HIGH confidence)
- MDN Web Docs: `PerformanceObserver` — https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver
- MDN Web Docs: `performance.memory` — https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory (marked as non-standard/Chrome-only)
- MDN Web Docs: `requestAnimationFrame` — https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- Zustand docs: `subscribe()` — external store subscription pattern
- Project source: `client/src/components/TacticalMap.tsx` — establishes rAF loop pattern + `getState()` usage
- Project source: `client/src/store/units.ts` — confirms `useUnitsStore` export available for `.subscribe()`
- Project source: `client/src/components/KPIBar.test.tsx` — confirms jsdom + vitest mock pattern in use

### Secondary (MEDIUM confidence)
- Design spec: `docs/superpowers/specs/2026-03-14-war-room-control-design.md` — locked implementation decisions
- Project history (STATE.md accumulated decisions) — confirms jsdom colour normalization, hook patterns, and test mock approaches from phases 4–6

### Tertiary (LOW confidence)
- None — all claims grounded in official API docs or project source.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all APIs are browser natives documented on MDN
- Architecture: HIGH — pattern is consistent with TacticalMap (rAF + refs) and KPIBar (Zustand subscription); no novel patterns needed
- Pitfalls: HIGH — `performance.memory` Chrome-only is official MDN documentation; jsdom gaps confirmed by existing project test infrastructure

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (stable browser APIs; Zustand 5.x subscribe API unlikely to change)
