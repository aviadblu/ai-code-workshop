import { act } from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import TacticalMap, { computeZoneOwner, worldToScreen, screenToWorld, clampPan, applyZoom, MIN_SCALE, MAX_SCALE } from './TacticalMap'
import type { Unit } from '../types'

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
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(HTMLCanvasElement.prototype as any).getContext = vi.fn(
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

describe('MAP-02: unit dot colour coding', () => {
  const testUnits = new Map([
    ['u-001', { id: 'u-001', team: 'alpha' as const, x: 500, y: 250, health: 80, status: 'moving' as const }],
    ['u-002', { id: 'u-002', team: 'bravo' as const, x: 100, y: 100, health: 50, status: 'idle' as const }],
    ['u-003', { id: 'u-003', team: 'alpha' as const, x: 0, y: 1000, health: 0, status: 'destroyed' as const }],
  ])

  function setupCanvas(container: Element, width = 1000, height = 1000) {
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    Object.defineProperty(canvas, 'width', { value: width, writable: true, configurable: true })
    Object.defineProperty(canvas, 'height', { value: height, writable: true, configurable: true })
    return canvas
  }

  beforeEach(() => {
    ;(useUnitsStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      units: testUnits,
      events: [],
      tick: 0,
    })
  })

  test('MAP-02-a: Alpha living unit sets fillStyle to #3b82f6 and arc at scaled coords', () => {
    const fillStyles: string[] = []
    const origFillStyleDescriptor = Object.getOwnPropertyDescriptor(mockCtx, 'fillStyle')
    Object.defineProperty(mockCtx, 'fillStyle', {
      get() { return this._fillStyle ?? '' },
      set(v: string) { this._fillStyle = v; fillStyles.push(v) },
      configurable: true,
    })

    const { container } = rtlRender(<TacticalMap />)
    setupCanvas(container)

    act(() => { rafCallback!(performance.now()) })

    expect(fillStyles).toContain('#3b82f6')
    // u-001: x=500, y=250 on 1000×1000 canvas → arc(500, 250, ...)
    expect(mockCtx.arc).toHaveBeenCalledWith(500, 250, 1, 0, Math.PI * 2)

    // restore
    if (origFillStyleDescriptor) {
      Object.defineProperty(mockCtx, 'fillStyle', origFillStyleDescriptor)
    } else {
      delete (mockCtx as any).fillStyle
      ;(mockCtx as any).fillStyle = ''
    }
  })

  test('MAP-02-b: Bravo living unit sets fillStyle to #ef4444', () => {
    const fillStyles: string[] = []
    Object.defineProperty(mockCtx, 'fillStyle', {
      get() { return this._fillStyle ?? '' },
      set(v: string) { this._fillStyle = v; fillStyles.push(v) },
      configurable: true,
    })

    const { container } = rtlRender(<TacticalMap />)
    setupCanvas(container)

    act(() => { rafCallback!(performance.now()) })

    expect(fillStyles).toContain('#ef4444')

    Object.defineProperty(mockCtx, 'fillStyle', { value: '', writable: true, configurable: true })
  })

  test('MAP-02-c: Destroyed unit (any team) sets fillStyle to #6b7280', () => {
    const fillStyles: string[] = []
    Object.defineProperty(mockCtx, 'fillStyle', {
      get() { return this._fillStyle ?? '' },
      set(v: string) { this._fillStyle = v; fillStyles.push(v) },
      configurable: true,
    })

    const { container } = rtlRender(<TacticalMap />)
    setupCanvas(container)

    act(() => { rafCallback!(performance.now()) })

    expect(fillStyles).toContain('#6b7280')

    Object.defineProperty(mockCtx, 'fillStyle', { value: '', writable: true, configurable: true })
  })

  test('MAP-02-d: ctx.beginPath() is called once per unit plus one extra for the zone arc (3 units → 4 beginPath calls)', () => {
    const { container } = rtlRender(<TacticalMap />)
    setupCanvas(container)

    act(() => { rafCallback!(performance.now()) })

    // 3 unit dots + 1 zone control arc = 4 total beginPath calls
    expect(mockCtx.beginPath.mock.calls.length).toBe(4)
  })

  test('MAP-02-e: With 3 units, ctx.arc is called 3 times for dots plus 1 for zone arc (4 total)', () => {
    const { container } = rtlRender(<TacticalMap />)
    setupCanvas(container)

    act(() => { rafCallback!(performance.now()) })

    // 3 unit dots + 1 zone control arc = 4 total arc calls
    expect(mockCtx.arc.mock.calls.length).toBe(4)
  })

  test('MAP-02-f: Coordinates scaled correctly — u-003 at x=0, y=1000 draws arc at (0, 1000)', () => {
    const { container } = rtlRender(<TacticalMap />)
    setupCanvas(container)

    act(() => { rafCallback!(performance.now()) })

    // u-003: x=0, y=1000 on 1000×1000 canvas → arc(0, 1000, 1, 0, Math.PI * 2)
    expect(mockCtx.arc).toHaveBeenCalledWith(0, 1000, 1, 0, Math.PI * 2)
  })
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

// ─── MAP-03: zone control overlay ──────────────────────────────────────────

describe('MAP-03: zone control overlay', () => {
  // 1000×1000 canvas, centre (500,500), zoneRadius = 200 (= 1000 * 0.2)
  const CX = 500, CY = 500, R = 200, W = 1000, H = 1000

  function makeUnit(
    id: string,
    team: 'alpha' | 'bravo',
    x: number,
    y: number,
    status: 'idle' | 'destroyed' = 'idle',
  ): Unit {
    return { id, team, x, y, health: 80, status }
  }

  function setupCanvas(container: Element, width = 1000, height = 1000) {
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    Object.defineProperty(canvas, 'width', { value: width, writable: true, configurable: true })
    Object.defineProperty(canvas, 'height', { value: height, writable: true, configurable: true })
    return canvas
  }

  // MAP-03-a: 3 alpha + 1 bravo inside radius → alpha wins
  test('MAP-03-a: returns alpha when more living Alpha units are within the radius', () => {
    const units = new Map<string, Unit>([
      ['a1', makeUnit('a1', 'alpha', 500, 500)],
      ['a2', makeUnit('a2', 'alpha', 500, 500)],
      ['a3', makeUnit('a3', 'alpha', 500, 500)],
      ['b1', makeUnit('b1', 'bravo', 500, 500)],
    ])
    expect(computeZoneOwner(units, CX, CY, R, W, H)).toBe('alpha')
  })

  // MAP-03-b: 1 alpha + 3 bravo inside radius → bravo wins
  test('MAP-03-b: returns bravo when more living Bravo units are within the radius', () => {
    const units = new Map<string, Unit>([
      ['a1', makeUnit('a1', 'alpha', 500, 500)],
      ['b1', makeUnit('b1', 'bravo', 500, 500)],
      ['b2', makeUnit('b2', 'bravo', 500, 500)],
      ['b3', makeUnit('b3', 'bravo', 500, 500)],
    ])
    expect(computeZoneOwner(units, CX, CY, R, W, H)).toBe('bravo')
  })

  // MAP-03-c: 2 alpha + 2 bravo → tie → alpha wins
  test('MAP-03-c: returns alpha on a tie (alphaCount >= bravoCount)', () => {
    const units = new Map<string, Unit>([
      ['a1', makeUnit('a1', 'alpha', 500, 500)],
      ['a2', makeUnit('a2', 'alpha', 500, 500)],
      ['b1', makeUnit('b1', 'bravo', 500, 500)],
      ['b2', makeUnit('b2', 'bravo', 500, 500)],
    ])
    expect(computeZoneOwner(units, CX, CY, R, W, H)).toBe('alpha')
  })

  // MAP-03-d: 2 alpha destroyed + 1 bravo living → bravo wins (destroyed excluded)
  test('MAP-03-d: excludes destroyed units from the zone count', () => {
    const units = new Map<string, Unit>([
      ['a1', makeUnit('a1', 'alpha', 500, 500, 'destroyed')],
      ['a2', makeUnit('a2', 'alpha', 500, 500, 'destroyed')],
      ['b1', makeUnit('b1', 'bravo', 500, 500)],
    ])
    expect(computeZoneOwner(units, CX, CY, R, W, H)).toBe('bravo')
  })

  // MAP-03-e: empty alpha, 1 bravo → bravo wins
  test('MAP-03-e: returns bravo when the only in-zone units are Bravo', () => {
    const units = new Map<string, Unit>([
      ['b1', makeUnit('b1', 'bravo', 500, 500)],
    ])
    expect(computeZoneOwner(units, CX, CY, R, W, H)).toBe('bravo')
  })

  // MAP-03-f: In rAF draw callback, ctx.arc is called an extra time beyond per-unit calls
  test('MAP-03-f: ctx.arc is called an extra time (zone arc) beyond the per-unit calls', () => {
    const testUnits = new Map<string, Unit>([
      ['u1', makeUnit('u1', 'alpha', 500, 500)],
      ['u2', makeUnit('u2', 'bravo', 300, 300)],
    ])
    ;(useUnitsStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      units: testUnits,
      events: [],
      tick: 0,
    })

    const { container } = rtlRender(<TacticalMap />)
    setupCanvas(container)

    act(() => { rafCallback!(performance.now()) })

    // 2 units → 2 unit arc calls, plus 1 zone arc call = 3 total
    expect(mockCtx.arc.mock.calls.length).toBeGreaterThan(testUnits.size)
  })

  // MAP-03-g: Legend div renders in the DOM with ALPHA, BRAVO, KIA labels (HUD ALLCAPS style)
  test('MAP-03-g: legend div renders in the DOM with Alpha, Bravo, Destroyed labels', () => {
    rtlRender(<TacticalMap />)
    expect(screen.getByText(/ALPHA/)).toBeTruthy()
    expect(screen.getByText(/BRAVO/)).toBeTruthy()
    expect(screen.getByText(/KIA/)).toBeTruthy()
  })
})

// ─── MAP-04: coordinate math pure functions ────────────────────────────────

describe('MAP-04: coordinate math pure functions', () => {
  test('MAP-04-a: worldToScreen identity at scale=1, offset={0,0}', () => {
    const result = worldToScreen(500, 500, 1, { x: 0, y: 0 }, 1000, 1000)
    expect(result).toEqual({ x: 500, y: 500 })
  })

  test('MAP-04-b: worldToScreen with scale=2 and non-zero offset', () => {
    const result = worldToScreen(0, 0, 2, { x: 50, y: 50 }, 1000, 1000)
    expect(result).toEqual({ x: 50, y: 50 })
  })

  test('MAP-04-c: screenToWorld identity at scale=1, offset={0,0}', () => {
    const result = screenToWorld(500, 500, 1, { x: 0, y: 0 }, 1000, 1000)
    expect(result).toEqual({ x: 500, y: 500 })
  })

  test('MAP-04-d: worldToScreen and screenToWorld are inverses', () => {
    const wx = 200, wy = 300, s = 2, off = { x: 10, y: 20 }, W = 1000, H = 1000
    const screen = worldToScreen(wx, wy, s, off, W, H)
    const back = screenToWorld(screen.x, screen.y, s, off, W, H)
    expect(back.x).toBeCloseTo(wx, 5)
    expect(back.y).toBeCloseTo(wy, 5)
  })

  test('MAP-04-e: applyZoom returns ~1.1 scale from scale=1 with zoomFactor=1.1', () => {
    const result = applyZoom(500, 500, 1, { x: 0, y: 0 }, 1.1, 1000, 1000)
    expect(Math.abs(result.scale - 1.1)).toBeLessThan(0.001)
  })

  test('MAP-04-f: applyZoom clamps scale at MAX_SCALE=20', () => {
    const result = applyZoom(500, 500, 20, { x: 0, y: 0 }, 1.1, 1000, 1000)
    expect(result.scale).toBe(MAX_SCALE)
    expect(result.scale).toBe(20)
  })

  test('MAP-04-g: applyZoom clamps scale at MIN_SCALE=0.5', () => {
    const result = applyZoom(500, 500, 0.5, { x: 0, y: 0 }, 1 / 1.1, 1000, 1000)
    expect(result.scale).toBe(MIN_SCALE)
    expect(result.scale).toBe(0.5)
  })

  test('MAP-04-h: applyZoom preserves cursor world-point', () => {
    const cx = 400, cy = 300, s = 1.5, off = { x: 10, y: 20 }, W = 1000, H = 1000
    const worldBefore = screenToWorld(cx, cy, s, off, W, H)
    const result = applyZoom(cx, cy, s, off, 1.1, W, H)
    const worldAfter = screenToWorld(cx, cy, result.scale, result.offset, W, H)
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 5)
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 5)
  })
})

// ─── MAP-05: clampPan ─────────────────────────────────────────────────────

describe('MAP-05: clampPan', () => {
  test('MAP-05-a: no-op when offset is within bounds at scale=1', () => {
    const result = clampPan({ x: 0, y: 0 }, 1, 1000, 1000)
    expect(result).toEqual({ x: 0, y: 0 })
  })

  test('MAP-05-b: clamps large positive offset to maxX/maxY', () => {
    const result = clampPan({ x: 10000, y: 10000 }, 1, 1000, 1000)
    // maxX = 1000 * (1 - 0.1) = 900, maxY = 900
    expect(result.x).toBe(900)
    expect(result.y).toBe(900)
  })

  test('MAP-05-c: clamps large negative offset to minX/minY', () => {
    const result = clampPan({ x: -10000, y: -10000 }, 1, 1000, 1000)
    // minX = 1000 * 0.1 - 1000 * 1 = 100 - 1000 = -900
    expect(result.x).toBe(-900)
    expect(result.y).toBe(-900)
  })

  test('MAP-05-d: correct bounds at scale=2', () => {
    // worldW = 1000*2 = 2000, minX = 100-2000 = -1900, maxX = 900
    // offset {x:0} is within bounds → returns {x:0, y:0}
    const result = clampPan({ x: 0, y: 0 }, 2, 1000, 1000)
    expect(result).toEqual({ x: 0, y: 0 })
  })
})

describe('MAP-06: controls bar', () => {
  function setupCanvas(container: Element, width = 800, height = 600) {
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    Object.defineProperty(canvas, 'width', { value: width, writable: true, configurable: true })
    Object.defineProperty(canvas, 'height', { value: height, writable: true, configurable: true })
    return canvas
  }

  test('MAP-06-a: controls bar renders a zoom-in button with "+" text', () => {
    rtlRender(<TacticalMap />)
    expect(screen.getByRole('button', { name: /zoom in|\+/i })).toBeTruthy()
  })

  test('MAP-06-b: controls bar renders a zoom-out button with "−" text', () => {
    rtlRender(<TacticalMap />)
    expect(screen.getByRole('button', { name: /zoom out|−/i })).toBeTruthy()
  })

  test('MAP-06-c: controls bar renders a Reset button', () => {
    rtlRender(<TacticalMap />)
    expect(screen.getByRole('button', { name: /reset/i })).toBeTruthy()
  })

  test('MAP-06-d: controls bar shows initial zoom as "100%"', () => {
    rtlRender(<TacticalMap />)
    expect(screen.getByText('100%')).toBeTruthy()
  })

  test('MAP-06-e: pressing R key does not crash and zoom display remains "100%"', () => {
    rtlRender(<TacticalMap />)
    act(() => { fireEvent.keyDown(window, { key: 'R' }) })
    expect(screen.getByText('100%')).toBeTruthy()
  })

  test('MAP-06-f: pressing lowercase r key does not crash and zoom display remains "100%"', () => {
    rtlRender(<TacticalMap />)
    act(() => { fireEvent.keyDown(window, { key: 'r' }) })
    expect(screen.getByText('100%')).toBeTruthy()
  })
})
