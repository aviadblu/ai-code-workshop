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
    // getByText throws if not found — truthy confirms presence
    expect(screen.getByText('u-001')).toBeTruthy()
    expect(screen.getByText('u-003')).toBeTruthy()
    expect(screen.getByText('u-004')).toBeTruthy()
  })

  it('EVENTS-01-b: attack event row has yellow colour (#eab308)', () => {
    render(<EventFeed />)
    const attackText = screen.getByText('attack')
    // jsdom normalises hex to rgb — check the closest styled ancestor
    const row = attackText.closest('[style]') as HTMLElement
    expect(row?.style.color).toBe('rgb(234, 179, 8)')  // #eab308 yellow-500
  })

  it('EVENTS-01-c: destroyed event row has red colour (#ef4444)', () => {
    render(<EventFeed />)
    const destroyedText = screen.getByText('destroyed')
    const row = destroyedText.closest('[style]') as HTMLElement
    expect(row?.style.color).toBe('rgb(239, 68, 68)')  // #ef4444 red-500
  })

  it('EVENTS-01-d: capture event row has green colour (#22c55e)', () => {
    render(<EventFeed />)
    const captureText = screen.getByText('capture')
    const row = captureText.closest('[style]') as HTMLElement
    expect(row?.style.color).toBe('rgb(34, 197, 94)')  // #22c55e green-500
  })

  it('EVENTS-01-e: each row displays the event type text', () => {
    render(<EventFeed />)
    expect(screen.getByText('attack')).toBeTruthy()
    expect(screen.getByText('destroyed')).toBeTruthy()
    expect(screen.getByText('capture')).toBeTruthy()
  })

  it('EVENTS-01-f: each row displays the event unitId text', () => {
    render(<EventFeed />)
    expect(screen.getByText('u-001')).toBeTruthy()
    expect(screen.getByText('u-003')).toBeTruthy()
    expect(screen.getByText('u-004')).toBeTruthy()
  })
})
