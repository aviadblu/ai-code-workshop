import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import KPIBar from './KPIBar'
import { useUnitsStore } from '../store/units'
import type { Unit } from '../types'

vi.mock('../store/units', () => ({
  useUnitsStore: vi.fn(),
}))

const makeUnit = (id: string, team: 'alpha' | 'bravo', status: Unit['status'] = 'idle'): Unit => ({
  id, team, x: 100, y: 100, health: 80, status,
})

// Fixture: 4 alpha alive, 2 bravo alive, 1 alpha destroyed, 1 bravo destroyed
// alphaAlive=4, bravoAlive=2, destroyed=2, total=6
// alphaZonePct = round(4/6*100) = 67, bravoZonePct = 33
const unitsMap = new Map([
  ['u-1', makeUnit('u-1', 'alpha', 'idle')],
  ['u-2', makeUnit('u-2', 'alpha', 'moving')],
  ['u-3', makeUnit('u-3', 'alpha', 'attacking')],
  ['u-4', makeUnit('u-4', 'alpha', 'idle')],
  ['u-5', makeUnit('u-5', 'bravo', 'idle')],
  ['u-6', makeUnit('u-6', 'bravo', 'moving')],
  ['u-7', makeUnit('u-7', 'alpha', 'destroyed')],
  ['u-8', makeUnit('u-8', 'bravo', 'destroyed')],
])

beforeEach(() => {
  vi.mocked(useUnitsStore).mockImplementation((selector: (s: any) => any) =>
    selector({ units: unitsMap, events: [], tick: 1 })
  )
})

describe('KPI-01: derived counts', () => {
  it('KPI-01-a: shows correct Alpha alive count', () => {
    render(<KPIBar />)
    expect(screen.getByText('4')).toBeTruthy()
  })

  it('KPI-01-b: shows correct Bravo alive count', () => {
    render(<KPIBar />)
    // Alpha=4, Bravo=2 — find element with text "2"
    const elements = screen.getAllByText('2')
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })

  it('KPI-01-c: shows correct total destroyed count', () => {
    render(<KPIBar />)
    // 2 destroyed total — but "2" may match bravo alive too; check label context
    expect(screen.getByText(/Destroyed/i)).toBeTruthy()
    // The destroyed count rendered in the Destroyed span should be 2
    const destroyedSpan = screen.getByText(/Destroyed/i).closest('span')
    expect(destroyedSpan?.textContent).toContain('2')
  })

  it('KPI-01-d: shows correct Alpha zone % (alive-count ratio, rounded)', () => {
    render(<KPIBar />)
    expect(screen.getByText('67%')).toBeTruthy()
  })

  it('KPI-01-e: shows correct Bravo zone %', () => {
    render(<KPIBar />)
    expect(screen.getByText('33%')).toBeTruthy()
  })

  it('KPI-01-f: updates displayed counts when units Map reference changes', () => {
    const { rerender } = render(<KPIBar />)
    // Initial: alphaAlive=4
    expect(screen.getByText('4')).toBeTruthy()

    // New map: 1 alpha alive, 3 bravo alive, no destroyed
    // alphaZonePct = round(1/4*100) = 25, bravoZonePct = 75
    const newUnitsMap = new Map([
      ['u-1', makeUnit('u-1', 'alpha', 'idle')],
      ['u-2', makeUnit('u-2', 'bravo', 'idle')],
      ['u-3', makeUnit('u-3', 'bravo', 'idle')],
      ['u-4', makeUnit('u-4', 'bravo', 'idle')],
    ])

    vi.mocked(useUnitsStore).mockImplementation((selector: (s: any) => any) =>
      selector({ units: newUnitsMap, events: [], tick: 2 })
    )

    rerender(<KPIBar />)
    // alphaAlive=1, bravoAlive=3
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    // alphaZonePct=25, bravoZonePct=75
    expect(screen.getByText('25%')).toBeTruthy()
    expect(screen.getByText('75%')).toBeTruthy()
  })

  it('UI-03-f: value spans carry pulse-value class for amber animation', () => {
    const { container } = render(<KPIBar />)
    const pulseSpans = container.querySelectorAll('.pulse-value')
    // Expect at least 5 pulse-value spans: alphaAlive, bravoAlive, destroyed, alphaZonePct, bravoZonePct
    expect(pulseSpans.length).toBeGreaterThanOrEqual(5)
  })
})
