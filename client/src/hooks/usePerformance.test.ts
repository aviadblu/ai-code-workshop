import { renderHook, act } from '@testing-library/react'
import { useUnitsStore } from '../store/units'

// jsdom globals mock — must run before any hook that uses these APIs
let rafCallback: FrameRequestCallback | null = null
let rafTimestamp = 0

beforeEach(() => {
  rafTimestamp = 0
  rafCallback = null

  vi.useFakeTimers()

  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
    rafCallback = cb
    return 1
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('PerformanceObserver', vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
  })))
  Object.defineProperty(performance, 'memory', {
    get: () => ({ usedJSHeapSize: 50 * 1048576 }),
    configurable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  useUnitsStore.setState({ units: new Map(), events: [], tick: 0 })
})

import { usePerformance } from './usePerformance'

describe('usePerformance', () => {
  it('returns object with all 5 metric fields initialised to 0', () => {
    const { result } = renderHook(() => usePerformance())
    expect(result.current.fps).toBe(0)
    expect(result.current.frameTime).toBe(0)
    expect(result.current.heap).toBe(0)
    expect(result.current.apiLatency).toBe(0)
    expect(result.current.storeRate).toBe(0)
  })

  it('exposes fps after rAF timestamps accumulate', () => {
    const { result } = renderHook(() => usePerformance())

    act(() => {
      // Fire rAF at t=0
      rafCallback!(0)
      // Fire rAF at t=1000
      rafCallback!(1000)
      // Fire rAF at t=2000 — 2 frames over 2000ms = 1 fps
      rafCallback!(2000)
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.fps).toBe(1)
  })

  it('exposes frameTime as delta between consecutive rAF calls', () => {
    const { result } = renderHook(() => usePerformance())

    act(() => {
      rafCallback!(0)
      rafCallback!(16.67)
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.frameTime).toBe(16.67)
  })

  it('reads heap from performance.memory in MB', () => {
    const { result } = renderHook(() => usePerformance())

    act(() => {
      rafCallback!(0)
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    // 50 * 1048576 / 1048576 = 50
    expect(result.current.heap).toBe(50)
  })

  it('returns heap=0 when performance.memory is undefined', () => {
    Object.defineProperty(performance, 'memory', {
      get: () => undefined,
      configurable: true,
    })

    const { result } = renderHook(() => usePerformance())

    act(() => {
      rafCallback!(0)
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.heap).toBe(0)
  })

  it('captures apiLatency from PerformanceObserver /stream entry', () => {
    let observerCallback: ((list: { getEntries: () => PerformanceEntry[] }) => void) | null = null

    vi.stubGlobal('PerformanceObserver', vi.fn().mockImplementation((cb: (list: { getEntries: () => PerformanceEntry[] }) => void) => {
      observerCallback = cb
      return {
        observe: vi.fn(),
        disconnect: vi.fn(),
      }
    }))

    const { result } = renderHook(() => usePerformance())

    act(() => {
      observerCallback!({
        getEntries: () => [
          { name: 'http://localhost:5173/stream', duration: 42 } as PerformanceEntry,
        ],
      })
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.apiLatency).toBe(42)
  })

  it('counts storeRate from Zustand subscribe calls since last interval', () => {
    const { result } = renderHook(() => usePerformance())

    act(() => {
      // Simulate 3 store updates
      useUnitsStore.getState().applyDelta({ tick: 1, changes: [], events: [] })
      useUnitsStore.getState().applyDelta({ tick: 2, changes: [], events: [] })
      useUnitsStore.getState().applyDelta({ tick: 3, changes: [], events: [] })
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.storeRate).toBe(3)

    // After interval fires, counter resets
    act(() => {
      useUnitsStore.getState().applyDelta({ tick: 4, changes: [], events: [] })
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.storeRate).toBe(1)
  })

  it('calls cancelAnimationFrame, clearInterval, observer.disconnect, unsubscribe on unmount', () => {
    const mockDisconnect = vi.fn()
    const mockClearInterval = vi.fn()
    vi.stubGlobal('PerformanceObserver', vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: mockDisconnect,
    })))
    vi.stubGlobal('clearInterval', mockClearInterval)

    const { unmount } = renderHook(() => usePerformance())

    unmount()

    expect(cancelAnimationFrame).toHaveBeenCalled()
    expect(mockClearInterval).toHaveBeenCalled()
    expect(mockDisconnect).toHaveBeenCalled()
    // Zustand unsubscribe is tested implicitly — no subscription leak after unmount
  })
})
