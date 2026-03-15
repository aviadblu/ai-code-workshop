import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useUnitsStore } from '../store/units'
import type { GameEvent } from '../types'
import EventFeed from './EventFeed'

vi.mock('../store/units', () => ({
  useUnitsStore: vi.fn(),
}))

const sampleEvents: GameEvent[] = [
  { type: 'attack',    unitId: 'u-001', targetId: 'u-002', tick: 1 },
  { type: 'destroyed', unitId: 'u-003',                    tick: 2 },
  { type: 'capture',   unitId: 'u-004',                    tick: 3 },
]

beforeEach(() => {
  vi.mocked(useUnitsStore).mockImplementation((selector: (s: any) => any) =>
    selector({ units: new Map(), events: sampleEvents, tick: 3 })
  )
})

describe('EVENTS-01: colour-coded event feed', () => {
  it('EVENTS-01-a: renders a row for each event in the store', () => {
    render(<EventFeed />)
    // All three unitIds should appear
    expect(screen.getByText('u-001')).toBeInTheDocument()
    expect(screen.getByText('u-003')).toBeInTheDocument()
    expect(screen.getByText('u-004')).toBeInTheDocument()
  })

  it('EVENTS-01-b: attack event row has yellow colour (#eab308)', () => {
    render(<EventFeed />)
    const attackText = screen.getByText('attack')
    // Check the element or its parent has the correct colour
    const row = attackText.closest('[style]') as HTMLElement
    expect(row?.style.color).toBe('#eab308')
  })

  it('EVENTS-01-c: destroyed event row has red colour (#ef4444)', () => {
    render(<EventFeed />)
    const destroyedText = screen.getByText('destroyed')
    const row = destroyedText.closest('[style]') as HTMLElement
    expect(row?.style.color).toBe('#ef4444')
  })

  it('EVENTS-01-d: capture event row has green colour (#22c55e)', () => {
    render(<EventFeed />)
    const captureText = screen.getByText('capture')
    const row = captureText.closest('[style]') as HTMLElement
    expect(row?.style.color).toBe('#22c55e')
  })

  it('EVENTS-01-e: each row displays the event type text', () => {
    render(<EventFeed />)
    expect(screen.getByText('attack')).toBeInTheDocument()
    expect(screen.getByText('destroyed')).toBeInTheDocument()
    expect(screen.getByText('capture')).toBeInTheDocument()
  })

  it('EVENTS-01-f: each row displays the event unitId text', () => {
    render(<EventFeed />)
    expect(screen.getByText('u-001')).toBeInTheDocument()
    expect(screen.getByText('u-003')).toBeInTheDocument()
    expect(screen.getByText('u-004')).toBeInTheDocument()
  })
})
