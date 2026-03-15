import { useUnitsStore } from './units'
import type { Unit, TickDelta, GameEvent } from '../types'

const makeUnit = (id: string, overrides: Partial<Unit> = {}): Unit => ({
  id,
  team: 'alpha',
  x: 500,
  y: 500,
  health: 100,
  status: 'idle',
  ...overrides,
})

const makeEvent = (unitId: string, tick = 1): GameEvent => ({
  type: 'attack',
  unitId,
  tick,
})

beforeEach(() => {
  useUnitsStore.setState({ units: new Map(), events: [], tick: 0 })
})

// ── STATE-01: Map behavior ────────────────────────────────────────────────────

describe('STATE-01: applySnapshot', () => {
  it('populates 20k units correctly', () => {
    const snapshot = Array.from({ length: 20000 }, (_, i) =>
      makeUnit(`u-${String(i).padStart(5, '0')}`)
    )
    useUnitsStore.getState().applySnapshot(snapshot)
    expect(useUnitsStore.getState().units.size).toBe(20000)
  })

  it('replaces the whole map — 3 units after snapshot of 3', () => {
    // First populate 10 units
    useUnitsStore.getState().applySnapshot(
      Array.from({ length: 10 }, (_, i) => makeUnit(`u-${i}`))
    )
    expect(useUnitsStore.getState().units.size).toBe(10)

    // Then snapshot with only 3 units — should replace entirely
    useUnitsStore.getState().applySnapshot([
      makeUnit('a'),
      makeUnit('b'),
      makeUnit('c'),
    ])
    expect(useUnitsStore.getState().units.size).toBe(3)
  })
})

describe('STATE-01: applyDelta', () => {
  it('updates only changed units, size unchanged', () => {
    const snapshot = Array.from({ length: 5 }, (_, i) => makeUnit(`u-${i}`))
    useUnitsStore.getState().applySnapshot(snapshot)
    const sizeBeforeDelta = useUnitsStore.getState().units.size

    const delta: TickDelta = {
      tick: 2,
      changes: [
        makeUnit('u-0', { health: 50 }),
        makeUnit('u-1', { status: 'moving' }),
      ],
      events: [],
    }
    useUnitsStore.getState().applyDelta(delta)

    const afterState = useUnitsStore.getState()
    expect(afterState.units.size).toBe(sizeBeforeDelta)
    expect(afterState.units.get('u-0')!.health).toBe(50)
    expect(afterState.units.get('u-1')!.status).toBe('moving')
    // Unchanged units still have original values
    expect(afterState.units.get('u-2')!.health).toBe(100)
  })

  it('produces a NEW Map reference after applyDelta', () => {
    useUnitsStore.getState().applySnapshot([makeUnit('u-0')])
    const mapBefore = useUnitsStore.getState().units

    const delta: TickDelta = { tick: 1, changes: [makeUnit('u-0', { health: 80 })], events: [] }
    useUnitsStore.getState().applyDelta(delta)

    const mapAfter = useUnitsStore.getState().units
    expect(mapAfter).not.toBe(mapBefore)       // new reference
    expect(mapAfter).toEqual(new Map([['u-0', makeUnit('u-0', { health: 80 })]]))
  })

  it('increments tick counter', () => {
    expect(useUnitsStore.getState().tick).toBe(0)
    const delta: TickDelta = { tick: 7, changes: [], events: [] }
    useUnitsStore.getState().applyDelta(delta)
    expect(useUnitsStore.getState().tick).toBe(7)
  })
})

// ── STATE-02: Ring buffer ─────────────────────────────────────────────────────

describe('STATE-02: ring buffer', () => {
  it('caps events at 50 when 60 arrive in one tick', () => {
    const delta: TickDelta = {
      tick: 1,
      changes: [],
      events: Array.from({ length: 60 }, (_, i) => makeEvent(`u-${i}`)),
    }
    useUnitsStore.getState().applyDelta(delta)
    expect(useUnitsStore.getState().events.length).toBe(50)
  })

  it('caps at 50 after two ticks of 30 events each', () => {
    const delta1: TickDelta = {
      tick: 1,
      changes: [],
      events: Array.from({ length: 30 }, (_, i) => makeEvent(`a-${i}`, 1)),
    }
    useUnitsStore.getState().applyDelta(delta1)
    expect(useUnitsStore.getState().events.length).toBe(30)

    const delta2: TickDelta = {
      tick: 2,
      changes: [],
      events: Array.from({ length: 30 }, (_, i) => makeEvent(`b-${i}`, 2)),
    }
    useUnitsStore.getState().applyDelta(delta2)
    expect(useUnitsStore.getState().events.length).toBe(50)
  })

  it('keeps the LAST 50 events, not the first 50', () => {
    // Apply 50 events with unitId 'a-{i}'
    const delta1: TickDelta = {
      tick: 1,
      changes: [],
      events: Array.from({ length: 50 }, (_, i) => makeEvent(`a-${i}`, 1)),
    }
    useUnitsStore.getState().applyDelta(delta1)

    // Apply 10 more with unitId 'b-{i}'
    const delta2: TickDelta = {
      tick: 2,
      changes: [],
      events: Array.from({ length: 10 }, (_, i) => makeEvent(`b-${i}`, 2)),
    }
    useUnitsStore.getState().applyDelta(delta2)

    const events = useUnitsStore.getState().events
    expect(events.length).toBe(50)
    // Last entry should be from the 'b' batch
    expect(events[events.length - 1].unitId).toBe('b-9')
    // First entry should be from second half of 'a' batch (a-10 onward)
    expect(events[0].unitId).toBe('a-10')
  })
})
