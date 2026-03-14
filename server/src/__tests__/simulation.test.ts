import { describe, it, expect, beforeEach } from 'vitest'
import { initSimulation, getUnits } from '../simulation.js'

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
