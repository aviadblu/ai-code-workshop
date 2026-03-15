import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import type { PerfSnapshot } from '../hooks/usePerformance'

// Mock the hook — PerformancePanel tests own the UI, not data collection
vi.mock('../hooks/usePerformance', () => ({
  usePerformance: vi.fn((): PerfSnapshot => ({
    fps: 60, frameTime: 16, heap: 100, apiLatency: 50, storeRate: 2,
  })),
}))

import { usePerformance } from '../hooks/usePerformance'
import PerformancePanel from './PerformancePanel'

describe('PerformancePanel', () => {
  beforeEach(() => {
    vi.mocked(usePerformance).mockReturnValue({
      fps: 60, frameTime: 16, heap: 100, apiLatency: 50, storeRate: 2,
    })
  })

  it('renders "Show Perf" button and no metrics when closed by default', () => {
    render(<PerformancePanel />)
    expect(screen.getByRole('button', { name: 'Show Perf' })).toBeTruthy()
    expect(screen.queryByText('FPS')).toBeNull()
    expect(screen.queryByText('Frame time')).toBeNull()
    expect(screen.queryByText('Heap')).toBeNull()
    expect(screen.queryByText('API latency')).toBeNull()
    expect(screen.queryByText('Store updates/s')).toBeNull()
  })

  it('renders "Hide Perf" and all metric labels after toggle open', () => {
    render(<PerformancePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Perf' }))
    expect(screen.getByRole('button', { name: 'Hide Perf' })).toBeTruthy()
    expect(screen.getByText('FPS')).toBeTruthy()
    expect(screen.getByText('Frame time')).toBeTruthy()
    expect(screen.getByText('Heap')).toBeTruthy()
    expect(screen.getByText('API latency')).toBeTruthy()
    expect(screen.getByText('Store updates/s')).toBeTruthy()
  })

  it('hides metrics after toggle closed', () => {
    render(<PerformancePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Perf' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide Perf' }))
    expect(screen.queryByText('FPS')).toBeNull()
    expect(screen.queryByText('Frame time')).toBeNull()
    expect(screen.queryByText('Heap')).toBeNull()
  })

  it('colours FPS value green when fps >= 50', () => {
    vi.mocked(usePerformance).mockReturnValue({
      fps: 60, frameTime: 16, heap: 100, apiLatency: 50, storeRate: 2,
    })
    render(<PerformancePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Perf' }))
    const fpsValue = screen.getByText('60 fps')
    expect((fpsValue as HTMLElement).style.color).toBe('#22c55e')
  })

  it('colours FPS value yellow when fps >= 30 and < 50', () => {
    vi.mocked(usePerformance).mockReturnValue({
      fps: 40, frameTime: 16, heap: 100, apiLatency: 50, storeRate: 2,
    })
    render(<PerformancePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Perf' }))
    const fpsValue = screen.getByText('40 fps')
    expect((fpsValue as HTMLElement).style.color).toBe('#eab308')
  })

  it('colours FPS value red when fps < 30', () => {
    vi.mocked(usePerformance).mockReturnValue({
      fps: 20, frameTime: 16, heap: 100, apiLatency: 50, storeRate: 2,
    })
    render(<PerformancePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Perf' }))
    const fpsValue = screen.getByText('20 fps')
    expect((fpsValue as HTMLElement).style.color).toBe('#ef4444')
  })

  it('colours frameTime green when <= 20ms', () => {
    vi.mocked(usePerformance).mockReturnValue({
      fps: 60, frameTime: 15, heap: 100, apiLatency: 50, storeRate: 2,
    })
    render(<PerformancePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Perf' }))
    const ftValue = screen.getByText('15 ms')
    expect((ftValue as HTMLElement).style.color).toBe('#22c55e')
  })

  it('colours frameTime red when > 33ms', () => {
    vi.mocked(usePerformance).mockReturnValue({
      fps: 60, frameTime: 40, heap: 100, apiLatency: 50, storeRate: 2,
    })
    render(<PerformancePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Perf' }))
    const ftValue = screen.getByText('40 ms')
    expect((ftValue as HTMLElement).style.color).toBe('#ef4444')
  })

  it('colours heap green <= 200, yellow <= 500, red > 500', () => {
    // green
    vi.mocked(usePerformance).mockReturnValue({
      fps: 60, frameTime: 16, heap: 100, apiLatency: 50, storeRate: 2,
    })
    const { unmount: unmount1 } = render(<PerformancePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Perf' }))
    expect((screen.getByText('100 MB') as HTMLElement).style.color).toBe('#22c55e')
    unmount1()

    // yellow
    vi.mocked(usePerformance).mockReturnValue({
      fps: 60, frameTime: 16, heap: 300, apiLatency: 50, storeRate: 2,
    })
    const { unmount: unmount2 } = render(<PerformancePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Perf' }))
    expect((screen.getByText('300 MB') as HTMLElement).style.color).toBe('#eab308')
    unmount2()

    // red
    vi.mocked(usePerformance).mockReturnValue({
      fps: 60, frameTime: 16, heap: 600, apiLatency: 50, storeRate: 2,
    })
    render(<PerformancePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Perf' }))
    expect((screen.getByText('600 MB') as HTMLElement).style.color).toBe('#ef4444')
  })
})
