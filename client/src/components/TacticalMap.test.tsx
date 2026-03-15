import { render, unmountComponentAtNode } from 'react-dom'
import { act } from 'react'
import { render as rtlRender } from '@testing-library/react'
import TacticalMap from './TacticalMap'

// Canvas mock — jsdom does not implement Canvas 2D
const mockCtx = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillStyle: '' as string,
  strokeStyle: '' as string,
  lineWidth: 0,
}
HTMLCanvasElement.prototype.getContext = vi.fn(
  () => mockCtx as unknown as CanvasRenderingContext2D
)

// Mock requestAnimationFrame / cancelAnimationFrame
let rafCallback: FrameRequestCallback | null = null
const mockRaf = vi.fn((cb: FrameRequestCallback) => {
  rafCallback = cb
  return 1
})
const mockCancelRaf = vi.fn()
vi.stubGlobal('requestAnimationFrame', mockRaf)
vi.stubGlobal('cancelAnimationFrame', mockCancelRaf)

// Mock useUnitsStore
vi.mock('../store/units', () => ({
  useUnitsStore: {
    getState: vi.fn(() => ({ units: new Map(), events: [], tick: 0 })),
  },
}))

import { useUnitsStore } from '../store/units'

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  disconnect = vi.fn()
}
vi.stubGlobal('ResizeObserver', MockResizeObserver)

beforeEach(() => {
  vi.clearAllMocks()
  rafCallback = null
})

describe('MAP-01: rAF loop + canvas scaffold', () => {
  test('MAP-01-a: Rendering TacticalMap mounts a <canvas> element in the DOM', () => {
    const { container } = rtlRender(<TacticalMap />)
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
  })

  test('MAP-01-b: After mount, requestAnimationFrame has been called (rAF loop started)', () => {
    rtlRender(<TacticalMap />)
    expect(mockRaf).toHaveBeenCalled()
  })

  test('MAP-01-c: After unmount, cancelAnimationFrame is called (no leak)', () => {
    const { unmount } = rtlRender(<TacticalMap />)
    unmount()
    expect(mockCancelRaf).toHaveBeenCalled()
  })

  test('MAP-01-d: rAF draw callback calls useUnitsStore.getState() to read units (not the hook)', () => {
    const { container } = rtlRender(<TacticalMap />)
    const canvas = container.querySelector('canvas') as HTMLCanvasElement

    // Give canvas a non-zero size so the guard passes
    Object.defineProperty(canvas, 'width', { value: 100, writable: true })
    Object.defineProperty(canvas, 'height', { value: 100, writable: true })

    // Trigger the rAF callback manually
    expect(rafCallback).not.toBeNull()
    act(() => {
      rafCallback!(performance.now())
    })

    expect(useUnitsStore.getState).toHaveBeenCalled()
  })

  test('MAP-01-e: When canvas.width is 0, clearRect is NOT called (guard fires, reschedules)', () => {
    const { container } = rtlRender(<TacticalMap />)
    const canvas = container.querySelector('canvas') as HTMLCanvasElement

    // canvas.width defaults to 0 in jsdom
    Object.defineProperty(canvas, 'width', { value: 0, writable: true })

    expect(rafCallback).not.toBeNull()
    act(() => {
      rafCallback!(performance.now())
    })

    expect(mockCtx.clearRect).not.toHaveBeenCalled()
    // Should have rescheduled
    expect(mockRaf).toHaveBeenCalledTimes(2) // initial + reschedule
  })

  test('MAP-01-f: When canvas.width > 0, clearRect IS called each frame', () => {
    const { container } = rtlRender(<TacticalMap />)
    const canvas = container.querySelector('canvas') as HTMLCanvasElement

    Object.defineProperty(canvas, 'width', { value: 800, writable: true })
    Object.defineProperty(canvas, 'height', { value: 600, writable: true })

    expect(rafCallback).not.toBeNull()
    act(() => {
      rafCallback!(performance.now())
    })

    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
  })
})
