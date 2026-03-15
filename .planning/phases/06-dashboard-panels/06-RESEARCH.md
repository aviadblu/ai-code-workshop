# Phase 6: Dashboard Panels - Research

**Researched:** 2026-03-15
**Domain:** React virtualized lists, Zustand subscriptions, filtered derived state
**Confidence:** HIGH

---

## Summary

Phase 6 fills in three stub components — `UnitsPanel`, `EventFeed`, and `KPIBar` — that currently render
placeholder text. All three consume the already-complete Zustand store (`useUnitsStore`) and require no
server-side changes. The Zustand store shape, data types, and App layout are fully established, so this
phase is purely UI wiring.

The largest technical surface area is `@tanstack/react-virtual`. The library is headless (no bundled CSS),
requires an explicit fixed-height scroll container referenced via `useRef`, and exposes `useVirtualizer`
which calculates which rows are visible. Only visible rows are mounted into the DOM; all rows share a
positioned ancestor sized to `getTotalSize()` pixels, and each row is absolutely placed via
`transform: translateY(virtualItem.start + "px")`.

KPI and event feed are simpler: both subscribe to Zustand slices and derive counts or display arrays
directly in the render path with `useMemo` or inline selectors. The zone percentage reuses the
`computeZoneOwner` logic already exported from `TacticalMap.tsx`.

**Primary recommendation:** Install `@tanstack/react-virtual` (the React-specific package, not the
framework-agnostic `@tanstack/virtual`), apply `useVirtualizer` to the filtered unit array in
`UnitsPanel`, and use Zustand selectors directly in `EventFeed` and `KPIBar` with `useMemo` for
derived counts.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UNITS-01 | Units panel has a filter bar with status dropdown, health range slider (0–100), and ID/name search input | `useState` for filter state; `useMemo` to derive filtered array from `useUnitsStore` on each render |
| UNITS-02 | Filtered unit list is virtualized with `@tanstack/virtual` — only visible rows rendered regardless of result size | `useVirtualizer` from `@tanstack/react-virtual`; scroll container `ref`, `count`, `estimateSize`, `getTotalSize`, `getVirtualItems` |
| UNITS-03 | List columns show ID, Team, Status, Health (colour-coded progress bar) | Inline styles on each virtual row; progress bar via `<div>` with `width: health%` and colour computed from health value |
| EVENTS-01 | Event feed displays the last 50 game events as a scrolling list, colour-coded: attack=yellow, destroyed=red, capture=green | Subscribe to `events` slice via `useUnitsStore(s => s.events)`; colour map object keyed by `GameEvent.type` |
| KPI-01 | KPI bar shows live counts: Alpha alive, Bravo alive, total destroyed, zone control % per team — updates every tick | Subscribe to `units` and `tick` via `useUnitsStore`; derive counts with `useMemo`; reuse `computeZoneOwner` from `TacticalMap.tsx` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-virtual` | ^3.x (latest stable) | Row virtualization — renders only visible items in a large list | Headless, zero DOM requirements, works with any CSS, locked in design spec |
| `zustand` | ^5.0.11 (already installed) | Store subscriptions for live unit/event/tick data | Already the project standard; Map-based store is in place |
| `react` | ^19.2.4 (already installed) | `useState`, `useMemo`, `useRef` for filter state and virtual scroll | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/virtual` | — | Core virtualizer logic (peer dep, installed automatically with react-virtual) | Do NOT import directly; import from `@tanstack/react-virtual` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/react-virtual` | `react-window` / `react-virtuoso` | These are heavier, not required by spec, and locked out by decision |
| Inline `useMemo` filter | Zustand `subscribe` + local state | More complex; inline memo is simpler and correctly re-runs on React renders triggered by store updates |

**Installation:**
```bash
cd client && npm install @tanstack/react-virtual
```

---

## Architecture Patterns

### Recommended Project Structure

No new directories required. All components are stubs at existing paths:

```
client/src/
├── components/
│   ├── UnitsPanel.tsx      # stub → full implementation (UNITS-01/02/03)
│   ├── EventFeed.tsx       # stub → full implementation (EVENTS-01)
│   └── KPIBar.tsx          # stub → full implementation (KPI-01)
└── store/
    └── units.ts            # unchanged — already complete
```

### Pattern 1: Zustand Slice Selector

**What:** Pass a selector function to `useUnitsStore` to subscribe to a specific slice of the store.
The component re-renders only when the selected slice reference changes — not on every tick if the
slice is stable.

**When to use:** `EventFeed` (subscribe to `events[]`), `KPIBar` (subscribe to `units` Map and `tick`).

```typescript
// Source: Zustand v5 official docs — selector pattern
const events = useUnitsStore(s => s.events)          // re-renders when events[] reference changes
const units  = useUnitsStore(s => s.units)           // re-renders when units Map reference changes
const tick   = useUnitsStore(s => s.tick)            // re-renders each tick (number scalar)
```

**Important:** `applyDelta` creates a `new Map(...)` on every delta — so `units` reference always
changes each tick. KPI and UnitsPanel will re-render every second, which is correct for live data.

### Pattern 2: useMemo for Derived/Filtered Arrays

**What:** Compute the filtered unit array inside the component using `useMemo` keyed on the raw
`units` Map and the current filter values. Avoids re-running O(20k) filter on every keystroke if
`units` hasn't changed.

**When to use:** `UnitsPanel` filter logic.

```typescript
// Source: React docs — useMemo for expensive derivations
const filtered = useMemo(() => {
  const arr: Unit[] = []
  for (const unit of units.values()) {
    if (statusFilter && unit.status !== statusFilter) continue
    if (unit.health < healthMin || unit.health > healthMax) continue
    if (searchStr && !unit.id.includes(searchStr)) continue
    arr.push(unit)
  }
  return arr
}, [units, statusFilter, healthMin, healthMax, searchStr])
```

**Key:** Dependency on `units` (the Map reference, not its contents) is sufficient because
`applyDelta` always produces a new Map reference.

### Pattern 3: @tanstack/react-virtual Fixed-Size List

**What:** A headless virtualizer that calculates which rows are currently in the scroll viewport
and returns only those for rendering. The total scroll height is communicated to the browser via
a spacer div sized to `getTotalSize()`.

**When to use:** `UnitsPanel` unit list (UNITS-02).

```typescript
// Source: @tanstack/react-virtual v3 official docs + verified usage pattern
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

// Inside component:
const parentRef = useRef<HTMLDivElement>(null)

const virtualizer = useVirtualizer({
  count: filtered.length,           // total item count (filtered array length)
  getScrollElement: () => parentRef.current,
  estimateSize: () => 36,           // fixed row height in px
})

return (
  <div
    ref={parentRef}
    style={{ height: '400px', overflowY: 'auto' }}
  >
    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
      {virtualizer.getVirtualItems().map(virtualRow => {
        const unit = filtered[virtualRow.index]
        return (
          <div
            key={unit.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {/* row content */}
          </div>
        )
      })}
    </div>
  </div>
)
```

**Critical constraints:**
- The scroll container (`parentRef`) MUST have a fixed `height` and `overflowY: auto` (or `scroll`).
  Without a fixed height, `getTotalSize()` — and thus `getVirtualItems()` — returns 0 items.
- `key` must be a stable, unique identifier per item. Use `unit.id`, NOT `virtualRow.index` (index
  changes as items scroll in/out of view).
- `position: absolute` on each row and `position: relative` on the inner spacer are mandatory for
  the translateY positioning to work correctly.

### Pattern 4: KPI Derived Counts with useMemo

**What:** Compute alive counts, destroyed count, and zone % from the units Map. `computeZoneOwner`
is already exported from `TacticalMap.tsx` and can be re-used here.

**When to use:** `KPIBar` (KPI-01).

```typescript
// Re-uses existing exported function — no duplication
import { computeZoneOwner } from './TacticalMap'

const units = useUnitsStore(s => s.units)

const kpi = useMemo(() => {
  let alphaAlive = 0, bravoAlive = 0, destroyed = 0
  for (const unit of units.values()) {
    if (unit.status === 'destroyed') { destroyed++; continue }
    if (unit.team === 'alpha') alphaAlive++
    else bravoAlive++
  }
  const total = alphaAlive + bravoAlive || 1
  const alphaZonePct = Math.round((alphaAlive / total) * 100)
  const bravoZonePct = 100 - alphaZonePct
  return { alphaAlive, bravoAlive, destroyed, alphaZonePct, bravoZonePct }
}, [units])
```

**Note:** `computeZoneOwner` requires canvas width/height as arguments (it scales unit coordinates
to canvas space). For KPI purposes, simpler team alive-count ratios can stand in for zone %; the
plan can decide whether to call `computeZoneOwner` with fixed 1000x1000 nominal values or use
proportional alive counts. Both approaches are correct per the requirement.

### Anti-Patterns to Avoid

- **Spreading `units.values()` into an array at render time when not necessary:** The `useMemo`
  filter loop iterates `.values()` directly — do not do `[...units.values()]` outside the memo
  as it allocates a 20k array on every render.
- **Using `virtualRow.index` as the React `key`:** Virtual indices shift as the user scrolls;
  always key by the data item's stable id (`unit.id`).
- **Setting scroll container height in CSS classes only without explicit `height` style:** jsdom
  in tests reports `offsetHeight = 0` for CSS-class-only heights; use inline `style={{ height }}`.
- **Calling `useUnitsStore` with no selector in a high-frequency component:** Without a selector,
  the component subscribes to the entire store and re-renders on any change, including `tick`
  increments that don't affect displayed data. Use specific selectors.
- **Importing `computeZoneOwner` from a canvas-side file in test environments where canvas is
  mocked:** The function has no canvas dependency (it's a pure calculation), so the import is
  safe; confirm via the existing Phase 5 tests.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtualizing 10k+ rows | Custom windowing logic, IntersectionObserver hacks | `useVirtualizer` from `@tanstack/react-virtual` | Scroll position edge cases, overscan, resize handling, key stability are all solved |
| Scroll spacer sizing | Manual height calculations | `virtualizer.getTotalSize()` | Accounts for item size variability, overscan, and boundary conditions |
| Row position offsets | Index * rowHeight math | `virtualItem.start` | Handles non-uniform rows and dynamic measurement correctly |

**Key insight:** Manual row windowing always breaks at edge cases (partial rows at top/bottom,
rapid scroll, resizes). `useVirtualizer` solves all of these in ~1KB of logic.

---

## Common Pitfalls

### Pitfall 1: Scroll Container Without a Fixed Height
**What goes wrong:** `getVirtualItems()` returns 0 rows; the list appears empty.
**Why it happens:** The virtualizer measures the scroll container's height to determine how many
items fit in the viewport. If height is 0 (jsdom default, or a flex container with no explicit
height), no items are considered visible.
**How to avoid:** Always set `style={{ height: '400px', overflowY: 'auto' }}` (or similar) on the
element you pass to `getScrollElement`. In tests, mock the scroll container's `offsetHeight`.
**Warning signs:** `virtualizer.getVirtualItems()` returns `[]`; no rows render.

### Pitfall 2: Wrong Key Prop on Virtual Rows
**What goes wrong:** React throws key warnings; rows flicker or lose focus on scroll.
**Why it happens:** Using `virtualRow.index` as key. When the user scrolls, the same index can
point to different data — React sees "same key, different content" and patches incorrectly.
**How to avoid:** Use `filtered[virtualRow.index].id` as the key (the unit's stable string id).

### Pitfall 3: useMemo Dependency on Map Contents (Not Reference)
**What goes wrong:** Filter re-runs only when `units` reference changes, which is correct, but
developer adds `units.size` as a dep "to be safe" — `size` can remain the same across deltas
that do update content.
**How to avoid:** The reference change produced by `applyDelta`'s `new Map(...)` is the canonical
signal. Depend on `units` (the reference), not `units.size`.

### Pitfall 4: computeZoneOwner Canvas-Coordinate Mismatch in KPI
**What goes wrong:** `computeZoneOwner` takes `canvasWidth` and `canvasHeight` to scale unit
coordinates (0-1000 space) to canvas pixel space. If called with arbitrary values, zone ownership
calculation is wrong.
**How to avoid:** Either call `computeZoneOwner(units, 500, 500, 200, 1000, 1000)` using the
nominal 1000x1000 grid (which is the unit coordinate space itself), or compute a simpler alive-count
ratio for zone % in KPI. The requirement says "zone control % per team" — alive count ratio is
the simplest correct proxy.

### Pitfall 5: @tanstack/react-virtual Not Installed
**What goes wrong:** Import fails at build time; `@tanstack/virtual` (core) may be present as a
transitive dep but is not the React entrypoint.
**How to avoid:** Explicitly install `@tanstack/react-virtual` in `client/`. Current `client/package.json`
does NOT list it — it must be added in Wave 0 / Plan 06-01.

---

## Code Examples

### Minimal useVirtualizer Fixed-Size List
```typescript
// Source: verified from @tanstack/react-virtual v3 docs (tanstack.com/virtual)
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

const parentRef = useRef<HTMLDivElement>(null)
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 36,
})

<div ref={parentRef} style={{ height: '400px', overflowY: 'auto' }}>
  <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
    {virtualizer.getVirtualItems().map(row => (
      <div
        key={items[row.index].id}
        style={{
          position: 'absolute',
          top: 0,
          width: '100%',
          height: `${row.size}px`,
          transform: `translateY(${row.start}px)`,
        }}
      >
        {items[row.index].id}
      </div>
    ))}
  </div>
</div>
```

### EventFeed Colour Map
```typescript
// Source: types.ts GameEvent.type union: 'attack' | 'destroyed' | 'capture'
const EVENT_COLOURS: Record<string, string> = {
  attack:    '#eab308',  // yellow-500
  destroyed: '#ef4444',  // red-500
  capture:   '#22c55e',  // green-500
}
```

### Health Progress Bar Colour
```typescript
// Colour-coded health bar per UNITS-03 — no external library needed
const healthColour = (h: number) =>
  h > 66 ? '#22c55e' : h > 33 ? '#eab308' : '#ef4444'
```

### Testing Virtual Row Rendering in jsdom
```typescript
// Source: @tanstack/virtual GitHub issue #641 — jsdom scroll container mocking
// jsdom reports offsetHeight=0; mock it before rendering
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  value: 400,
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-virtualized` (fixed columns) | `@tanstack/react-virtual` headless hook | ~2022 (v3 stable) | No forced CSS, works with any layout |
| Zustand v4 `useStore` selector | Zustand v5 `useUnitsStore(selector)` direct call | v5 (2024) | Same API, slightly smaller bundle |

**Deprecated/outdated:**
- `react-window` / `react-virtualized`: Still functional but not the locked choice for this project. Avoid.
- `useVirtualizer` from `@tanstack/virtual` (core): Correct function name but wrong import — use `@tanstack/react-virtual` for the React binding.

---

## Open Questions

1. **Zone % calculation method in KPIBar**
   - What we know: `computeZoneOwner` returns a winner (`'alpha' | 'bravo'`), not a percentage.
     The requirement says "zone control % per team."
   - What's unclear: Whether the spec wants binary ownership (100%/0%) or a proportional alive-count
     ratio (e.g., 60% alpha / 40% bravo based on living unit counts).
   - Recommendation: Use alive-count ratio as the % metric — it's continuous, meaningful, and
     avoids needing canvas dimensions in KPIBar. The planner can decide during 06-03.

2. **UnitsPanel scroll container height**
   - What we know: The outer layout is a CSS grid (`2fr 1fr`); the right panel stacks UnitsPanel,
     EventFeed, PerformancePanel.
   - What's unclear: Whether explicit pixel heights or `flex-grow` + `flex: 1` heights are in use.
   - Recommendation: Use a fixed `height: '40vh'` (or similar) on the UnitsPanel scroll container
     to guarantee the virtualizer always has a non-zero viewport. Adjust in 06-01 implementation.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + @testing-library/react 16.x |
| Config file | `client/vitest.config.ts` (globals:true, environment:jsdom) |
| Quick run command | `cd client && npx vitest run --reporter=verbose` |
| Full suite command | `cd client && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UNITS-01 | Filter bar renders status dropdown, health slider, search input | unit | `cd client && npx vitest run --reporter=verbose src/components/UnitsPanel.test.tsx` | ❌ Wave 0 |
| UNITS-01 | Changing status filter narrows the rendered list | unit | same | ❌ Wave 0 |
| UNITS-01 | Changing health range narrows the rendered list | unit | same | ❌ Wave 0 |
| UNITS-02 | Only visible rows are in the DOM (not all 10k) | unit | same | ❌ Wave 0 |
| UNITS-02 | Row count equals virtualizer getVirtualItems().length, not items.length | unit | same | ❌ Wave 0 |
| UNITS-03 | Row contains ID, Team, Status, Health columns | unit | same | ❌ Wave 0 |
| UNITS-03 | Health progress bar width reflects health value | unit | same | ❌ Wave 0 |
| EVENTS-01 | EventFeed renders last 50 events | unit | `cd client && npx vitest run --reporter=verbose src/components/EventFeed.test.tsx` | ❌ Wave 0 |
| EVENTS-01 | Attack events styled yellow, destroyed red, capture green | unit | same | ❌ Wave 0 |
| KPI-01 | KPIBar shows correct alpha/bravo alive counts | unit | `cd client && npx vitest run --reporter=verbose src/components/KPIBar.test.tsx` | ❌ Wave 0 |
| KPI-01 | KPIBar updates when tick changes (derived counts change) | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd client && npx vitest run src/components/UnitsPanel.test.tsx` (or EventFeed / KPIBar)
- **Per wave merge:** `cd client && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `client/src/components/UnitsPanel.test.tsx` — covers UNITS-01, UNITS-02, UNITS-03
- [ ] `client/src/components/EventFeed.test.tsx` — covers EVENTS-01
- [ ] `client/src/components/KPIBar.test.tsx` — covers KPI-01
- [ ] `@tanstack/react-virtual` must be added to `client/package.json` dependencies

**jsdom virtual scroll note:** `useVirtualizer` reads `offsetHeight` from the scroll container.
jsdom returns 0 by default. Tests must mock `offsetHeight` before rendering:
```typescript
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true, value: 400,
})
```
This is a known jsdom limitation (TanStack/virtual issue #641).

---

## Sources

### Primary (HIGH confidence)
- `@tanstack/react-virtual` v3 official docs (tanstack.com/virtual/latest) — useVirtualizer API, getVirtualItems, getTotalSize, virtualItem structure
- `client/src/store/units.ts` — Zustand store shape, applyDelta, applySnapshot, ring buffer implementation (read directly)
- `client/src/types.ts` — Unit, GameEvent, TickDelta types (read directly)
- `client/src/components/TacticalMap.tsx` — computeZoneOwner export, COLOURS constants, established patterns (read directly)
- `client/vitest.config.ts` + `client/src/components/TacticalMap.test.tsx` — test infrastructure and mocking patterns (read directly)

### Secondary (MEDIUM confidence)
- DEV.to article (dev.to/sheldonwelinga) — useVirtualizer hook signature and JSX pattern, cross-verified with official docs search results
- TanStack/virtual GitHub issue #641 — jsdom offsetHeight=0 workaround for tests

### Tertiary (LOW confidence)
- WebSearch results for Zustand selector + useMemo patterns — consistent with official Zustand v5 documentation but not directly checked in Context7

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@tanstack/react-virtual` is the locked decision; confirmed API from official docs search
- Architecture: HIGH — store shape and component structure are fully established; all patterns follow existing Phase 4/5 conventions
- Pitfalls: HIGH — virtualizer container height and key prop issues are well-documented; confirmed via GitHub issues

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (stable library, 90-day estimate; `@tanstack/react-virtual` v3 has been stable since 2022)
