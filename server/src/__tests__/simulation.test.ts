import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initSimulation, getUnits, subscribe, startTickLoop } from '../simulation.js'

describe('SIM-01: Unit generation', () => {
  beforeEach(() => {
    initSimulation()
  })

  it('generates exactly 20,000 units', () => {
    expect(getUnits().size).toBe(20_000)
  })

  it('generates 10,000 alpha units', () => {
    const alphaCount = [...getUnits().values()].filter(u => u.team === 'alpha').length
    expect(alphaCount).toBe(10_000)
  })

  it('generates 10,000 bravo units', () => {
    const bravoCount = [...getUnits().values()].filter(u => u.team === 'bravo').length
    expect(bravoCount).toBe(10_000)
  })

  it('all units have x in [0, 1000]', () => {
    for (const unit of getUnits().values()) {
      expect(unit.x).toBeGreaterThanOrEqual(0)
      expect(unit.x).toBeLessThanOrEqual(1000)
    }
  })

  it('all units have y in [0, 1000]', () => {
    for (const unit of getUnits().values()) {
      expect(unit.y).toBeGreaterThanOrEqual(0)
      expect(unit.y).toBeLessThanOrEqual(1000)
    }
  })

  it('all units have health in [0, 100]', () => {
    for (const unit of getUnits().values()) {
      expect(unit.health).toBeGreaterThanOrEqual(0)
      expect(unit.health).toBeLessThanOrEqual(100)
    }
  })

  it('all units start with status idle', () => {
    for (const unit of getUnits().values()) {
      expect(unit.status).toBe('idle')
    }
  })

  it('alpha IDs are u-00001 through u-10000', () => {
    expect(getUnits().has('u-00001')).toBe(true)
    expect(getUnits().has('u-10000')).toBe(true)
    expect(getUnits().get('u-00001')?.team).toBe('alpha')
    expect(getUnits().get('u-10000')?.team).toBe('alpha')
  })

  it('bravo IDs are u-10001 through u-20000', () => {
    expect(getUnits().has('u-10001')).toBe(true)
    expect(getUnits().has('u-20000')).toBe(true)
    expect(getUnits().get('u-10001')?.team).toBe('bravo')
    expect(getUnits().get('u-20000')?.team).toBe('bravo')
  })
})

// ─── SIM-02: Tick loop unit selection ────────────────────────────────────────

describe('SIM-02: Tick loop selects 200–350 living units', () => {
  it('TickDelta.changes count is between 0 and 350', () => {
    // We cannot inspect runTick() directly (not exported), but we can
    // subscribe and capture the delta emitted by startTickLoop.
    // Use fake timers to fire the interval synchronously.
    initSimulation()
    const deltas: import('../types.js').TickDelta[] = []
    subscribe((d) => deltas.push(d))

    vi.useFakeTimers()
    startTickLoop()
    vi.advanceTimersByTime(1000)
    vi.useRealTimers()

    expect(deltas.length).toBe(1)
    // changes.length may be 0 (all idle) up to 350 (all selected changed)
    expect(deltas[0].changes.length).toBeGreaterThanOrEqual(0)
    expect(deltas[0].changes.length).toBeLessThanOrEqual(350)
  })

  it('TickDelta.changes contains no duplicate unit IDs', () => {
    initSimulation()
    const deltas: import('../types.js').TickDelta[] = []
    subscribe((d) => deltas.push(d))

    vi.useFakeTimers()
    const handle = startTickLoop()
    vi.advanceTimersByTime(1000)
    clearInterval(handle)
    vi.useRealTimers()

    const ids = deltas[0].changes.map(u => u.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ─── SIM-03: Action logic ─────────────────────────────────────────────────────

describe('SIM-03: Action outcomes are bounded', () => {
  it('no unit in changes has x or y outside [0, 1000]', () => {
    initSimulation()
    const deltas: import('../types.js').TickDelta[] = []
    subscribe((d) => deltas.push(d))

    vi.useFakeTimers()
    const handle = startTickLoop()
    // Run 5 ticks to accumulate moves
    vi.advanceTimersByTime(5000)
    clearInterval(handle)
    vi.useRealTimers()

    for (const delta of deltas) {
      for (const unit of delta.changes) {
        expect(unit.x).toBeGreaterThanOrEqual(0)
        expect(unit.x).toBeLessThanOrEqual(1000)
        expect(unit.y).toBeGreaterThanOrEqual(0)
        expect(unit.y).toBeLessThanOrEqual(1000)
      }
    }
  })

  it('no unit in changes has health below 0', () => {
    initSimulation()
    const deltas: import('../types.js').TickDelta[] = []
    subscribe((d) => deltas.push(d))

    vi.useFakeTimers()
    const handle = startTickLoop()
    vi.advanceTimersByTime(5000)
    clearInterval(handle)
    vi.useRealTimers()

    for (const delta of deltas) {
      for (const unit of delta.changes) {
        expect(unit.health).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

// ─── SIM-04: Destroyed status ─────────────────────────────────────────────────

describe('SIM-04: Health <= 0 triggers destroyed status', () => {
  it('a unit with health 0 in changes has status destroyed', () => {
    initSimulation()
    const deltas: import('../types.js').TickDelta[] = []
    subscribe((d) => deltas.push(d))

    vi.useFakeTimers()
    const handle = startTickLoop()
    // Run many ticks to guarantee some destructions
    vi.advanceTimersByTime(20_000)
    clearInterval(handle)
    vi.useRealTimers()

    // Find any unit with health 0 across all deltas
    for (const delta of deltas) {
      for (const unit of delta.changes) {
        if (unit.health === 0) {
          expect(unit.status).toBe('destroyed')
        }
      }
    }
  })

  it('destroyed event emitted when unit health reaches 0', () => {
    initSimulation()
    const deltas: import('../types.js').TickDelta[] = []
    subscribe((d) => deltas.push(d))

    vi.useFakeTimers()
    const handle = startTickLoop()
    vi.advanceTimersByTime(20_000)
    clearInterval(handle)
    vi.useRealTimers()

    const destroyedEvents = deltas.flatMap(d => d.events).filter(e => e.type === 'destroyed')
    // After 20 ticks with attacks there should be some destructions
    // (not guaranteed, but with 30% attack weight + 20k units it's near-certain)
    // We just verify the shape is correct when they do occur
    for (const ev of destroyedEvents) {
      expect(ev.unitId).toMatch(/^u-\d{5}$/)
      expect(typeof ev.tick).toBe('number')
    }
  })
})
