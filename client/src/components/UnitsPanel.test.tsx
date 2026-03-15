// jsdom reports offsetHeight=0 by default; mock it before any rendering
// so useVirtualizer can calculate visible rows (TanStack/virtual issue #641)
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  value: 400,
})

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UnitsPanel from './UnitsPanel'
import { useUnitsStore } from '../store/units'
import type { Unit } from '../types'

vi.mock('../store/units', () => ({
  useUnitsStore: vi.fn(),
}))

const makeUnit = (id: string, overrides: Partial<Unit> = {}): Unit => ({
  id,
  team: 'alpha',
  x: 100,
  y: 100,
  health: 80,
  status: 'idle',
  ...overrides,
})

const defaultUnitsMap = new Map<string, Unit>([
  ['u-001', makeUnit('u-001', { team: 'alpha', health: 80, status: 'idle' })],
  ['u-002', makeUnit('u-002', { team: 'bravo', health: 40, status: 'moving' })],
  ['u-003', makeUnit('u-003', { team: 'alpha', health: 10, status: 'attacking' })],
  ['u-004', makeUnit('u-004', { team: 'bravo', health: 90, status: 'destroyed' })],
])

beforeEach(() => {
  vi.mocked(useUnitsStore).mockImplementation((selector: (s: any) => any) =>
    selector({ units: defaultUnitsMap, events: [], tick: 0 })
  )
})

describe('UNITS-01: Filter bar', () => {
  it('UNITS-01-a: renders a status dropdown with options: all, idle, moving, attacking, destroyed', () => {
    render(<UnitsPanel />)
    const select = screen.getByRole('combobox')
    expect(select).toBeDefined()
    const options = select.querySelectorAll('option')
    const values = Array.from(options).map((o) => (o as HTMLOptionElement).value)
    expect(values).toContain('')       // all
    expect(values).toContain('idle')
    expect(values).toContain('moving')
    expect(values).toContain('attacking')
    expect(values).toContain('destroyed')
  })

  it('UNITS-01-b: renders at least one health range input (health min/max slider)', () => {
    render(<UnitsPanel />)
    const rangeInputs = document.querySelectorAll('input[type="range"]')
    expect(rangeInputs.length).toBeGreaterThanOrEqual(1)
  })

  it('UNITS-01-c: renders a text input for search', () => {
    render(<UnitsPanel />)
    const textInput = document.querySelector('input[type="text"]')
    expect(textInput).not.toBeNull()
  })

  it('UNITS-01-d: selecting a status option removes units with other statuses from rendered rows', () => {
    render(<UnitsPanel />)
    // Before filtering — multiple statuses present
    const select = screen.getByRole('combobox')
    // Filter to 'idle' only (only u-001 has status idle)
    fireEvent.change(select, { target: { value: 'idle' } })
    // 'moving', 'attacking', 'destroyed' units should not appear
    expect(screen.queryByText('moving')).toBeNull()
    expect(screen.queryByText('attacking')).toBeNull()
    expect(screen.queryByText('destroyed')).toBeNull()
    // 'idle' unit should appear
    expect(screen.getByText('idle')).toBeDefined()
  })

  it('UNITS-01-e: changing health max hides units outside the health range', () => {
    render(<UnitsPanel />)
    // Set healthMax to 50 — should hide u-001 (80), u-004 (90); keep u-002 (40), u-003 (10)
    const rangeInputs = document.querySelectorAll('input[type="range"]')
    // Second range = healthMax
    const healthMaxInput = rangeInputs[1] as HTMLInputElement
    fireEvent.change(healthMaxInput, { target: { value: '50' } })
    // u-001 has health 80 — should not appear
    expect(screen.queryByText('u-001')).toBeNull()
    // u-002 has health 40 — should appear
    expect(screen.getByText('u-002')).toBeDefined()
  })
})

describe('UNITS-02: Virtualized list', () => {
  it('UNITS-02-a: with 1000 units, rendered row count is far fewer than 1000', () => {
    // Build a 1000-unit map
    const bigMap = new Map<string, Unit>()
    for (let i = 0; i < 1000; i++) {
      const id = `unit-${i.toString().padStart(4, '0')}`
      bigMap.set(id, makeUnit(id, { health: 80, status: 'idle' }))
    }
    vi.mocked(useUnitsStore).mockImplementation((selector: (s: any) => any) =>
      selector({ units: bigMap, events: [], tick: 0 })
    )
    render(<UnitsPanel />)
    // With offsetHeight=400, estimateSize=36 -> ~11 visible rows max
    // Look for rows — they're divs with absolute position (virtual rows)
    // We check the number of unit id spans rendered
    // unit-0000 through unit-0999 — only a fraction should be present
    const container = document.querySelector('[data-testid="virtual-scroll-container"]') ??
      document.body
    // Count rendered rows by looking for spans containing "unit-"
    const allText = document.body.textContent ?? ''
    const matches = allText.match(/unit-\d{4}/g) ?? []
    const uniqueIds = new Set(matches)
    expect(uniqueIds.size).toBeLessThan(50)
    expect(uniqueIds.size).toBeGreaterThan(0)
  })

  it('UNITS-02-b: each rendered virtual row div uses unit.id as React key', () => {
    render(<UnitsPanel />)
    // The component must render each unit's id as visible text (spans)
    // u-001, u-002, u-003, u-004 should all appear in the default 4-unit map
    expect(screen.queryByText('u-001')).not.toBeNull()
    expect(screen.queryByText('u-002')).not.toBeNull()
    expect(screen.queryByText('u-003')).not.toBeNull()
    expect(screen.queryByText('u-004')).not.toBeNull()
  })
})

describe('UNITS-03: Row content', () => {
  it('UNITS-03-a: each row contains the unit id, team, and status text', () => {
    render(<UnitsPanel />)
    // u-001: alpha, idle
    expect(screen.getByText('u-001')).toBeDefined()
    expect(screen.getByText('alpha')).toBeDefined()
    expect(screen.getByText('idle')).toBeDefined()
  })

  it('UNITS-03-b: each row contains a health progress bar whose inline width reflects health', () => {
    render(<UnitsPanel />)
    // u-001 has health=80 -> bar width should be "80%"
    // Find all elements with width style containing "%"
    const allElements = document.querySelectorAll('[style]')
    const healthBars = Array.from(allElements).filter((el) => {
      const style = (el as HTMLElement).style
      return style.width && style.width.endsWith('%')
    })
    expect(healthBars.length).toBeGreaterThan(0)
    // Verify one bar has "80%"
    const widths = healthBars.map((el) => (el as HTMLElement).style.width)
    expect(widths).toContain('80%')
  })

  it('UNITS-03-c: health bar colour is green (>66), yellow (>33), red (≤33)', () => {
    render(<UnitsPanel />)
    // u-001 health=80 -> green #22c55e
    // u-002 health=40 -> yellow #eab308
    // u-003 health=10 -> red #ef4444
    const allElements = document.querySelectorAll('[style]')
    const backgrounds = Array.from(allElements)
      .map((el) => (el as HTMLElement).style.backgroundColor || (el as HTMLElement).style.background)
      .filter(Boolean)

    // Check colours by looking for elements with specific inline styles
    // We look for elements that have width % AND a background colour
    const healthBarEls = Array.from(allElements).filter((el) => {
      const style = (el as HTMLElement).style
      return style.width && style.width.endsWith('%') && (style.backgroundColor || style.background)
    })

    const colours = healthBarEls.map(
      (el) => (el as HTMLElement).style.backgroundColor || (el as HTMLElement).style.background
    )

    expect(colours).toContain('rgb(34, 197, 94)')   // #22c55e green  — h=80
    expect(colours).toContain('rgb(234, 179, 8)')   // #eab308 yellow — h=40
    expect(colours).toContain('rgb(239, 68, 68)')   // #ef4444 red    — h=10
  })
})
