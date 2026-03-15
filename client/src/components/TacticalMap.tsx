import { useEffect, useRef, useState } from 'react'
import { useUnitsStore } from '../store/units'
import type { Unit } from '../types'

export const MIN_SCALE = 0.5
export const MAX_SCALE = 20

export function worldToScreen(
  worldX: number, worldY: number,
  scale: number, offset: { x: number; y: number },
  canvasWidth: number, canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (worldX / 1000) * canvasWidth * scale + offset.x,
    y: (worldY / 1000) * canvasHeight * scale + offset.y,
  }
}

export function screenToWorld(
  screenX: number, screenY: number,
  scale: number, offset: { x: number; y: number },
  canvasWidth: number, canvasHeight: number,
): { x: number; y: number } {
  return {
    x: ((screenX - offset.x) / scale / canvasWidth) * 1000,
    y: ((screenY - offset.y) / scale / canvasHeight) * 1000,
  }
}

export function clampPan(
  offset: { x: number; y: number },
  scale: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  const worldW = canvasWidth * scale
  const worldH = canvasHeight * scale
  const margin = 0.1
  const minX = canvasWidth * margin - worldW
  const maxX = canvasWidth * (1 - margin)
  const minY = canvasHeight * margin - worldH
  const maxY = canvasHeight * (1 - margin)
  return {
    x: Math.max(minX, Math.min(maxX, offset.x)),
    y: Math.max(minY, Math.min(maxY, offset.y)),
  }
}

export function applyZoom(
  cursorX: number, cursorY: number,
  currentScale: number, currentOffset: { x: number; y: number },
  zoomFactor: number,
  canvasWidth: number, canvasHeight: number,
): { scale: number; offset: { x: number; y: number } } {
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScale * zoomFactor))
  const worldX = (cursorX - currentOffset.x) / currentScale
  const worldY = (cursorY - currentOffset.y) / currentScale
  const newOffset = {
    x: cursorX - worldX * newScale,
    y: cursorY - worldY * newScale,
  }
  return { scale: newScale, offset: clampPan(newOffset, newScale, canvasWidth, canvasHeight) }
}

export function computeZoneOwner(
  units: Map<string, Unit>,
  cx: number,
  cy: number,
  zoneRadius: number,
  canvasWidth: number,
  canvasHeight: number,
): 'alpha' | 'bravo' {
  let alphaCount = 0
  let bravoCount = 0
  for (const unit of units.values()) {
    if (unit.status === 'destroyed') continue
    const px = (unit.x / 1000) * canvasWidth
    const py = (unit.y / 1000) * canvasHeight
    const dx = px - cx
    const dy = py - cy
    if (dx * dx + dy * dy <= zoneRadius * zoneRadius) {
      if (unit.team === 'alpha') alphaCount++
      else bravoCount++
    }
  }
  return alphaCount >= bravoCount ? 'alpha' : 'bravo'
}

const COLOURS = {
  alpha: '#3b82f6',
  bravo: '#ef4444',
  destroyed: '#6b7280',
} as const

export default function TacticalMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scaleRef = useRef<number>(1)
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const [displayZoom, setDisplayZoom] = useState(100)

  // ResizeObserver — writes directly to canvas dimensions, no React state
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width
        canvas.height = entry.contentRect.height
      }
    })
    ro.observe(canvas)

    return () => ro.disconnect()
  }, [])

  // rAF draw loop — reads getState(), never hooks
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let rafId: number

    const draw = () => {
      if (canvas.width === 0 || canvas.height === 0) {
        rafId = requestAnimationFrame(draw)
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        rafId = requestAnimationFrame(draw)
        return
      }

      const { units } = useUnitsStore.getState()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(offsetRef.current.x, offsetRef.current.y)
      ctx.scale(scaleRef.current, scaleRef.current)

      for (const unit of units.values()) {
        const colour = unit.status === 'destroyed' ? COLOURS.destroyed : COLOURS[unit.team]
        const px = (unit.x / 1000) * canvas.width
        const py = (unit.y / 1000) * canvas.height
        ctx.fillStyle = colour
        ctx.beginPath()
        ctx.arc(px, py, 1, 0, Math.PI * 2)
        ctx.fill()
      }

      // Zone control overlay (MAP-03)
      const zoneRadius = Math.min(canvas.width, canvas.height) * 0.2
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      const owner = computeZoneOwner(units, cx, cy, zoneRadius, canvas.width, canvas.height)
      ctx.fillStyle = owner === 'alpha' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)'
      ctx.beginPath()
      ctx.arc(cx, cy, zoneRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = owner === 'alpha' ? '#3b82f6' : '#ef4444'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.restore()
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Wheel handler — non-passive to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      const result = applyZoom(
        cursorX, cursorY,
        scaleRef.current, offsetRef.current,
        e.deltaY < 0 ? 1.1 : 1 / 1.1,
        canvas.width, canvas.height,
      )
      scaleRef.current = result.scale
      offsetRef.current = result.offset
      setDisplayZoom(Math.round(result.scale * 100))
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [])

  function handleReset() {
    scaleRef.current = 1
    offsetRef.current = { x: 0, y: 0 }
    setDisplayZoom(100)
  }

  function handleZoomStep(factor: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const result = applyZoom(cx, cy, scaleRef.current, offsetRef.current, factor, canvas.width, canvas.height)
    scaleRef.current = result.scale
    offsetRef.current = result.offset
    setDisplayZoom(Math.round(result.scale * 100))
  }

  // Drag handler — mousemove/mouseup on window so drag continues outside canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      isDraggingRef.current = true
      dragStartRef.current = { x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y }
    }
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const raw = { x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y }
      offsetRef.current = clampPan(raw, scaleRef.current, canvas.width, canvas.height)
    }
    const handleMouseUp = () => { isDraggingRef.current = false }
    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // R key shortcut — resets view
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') handleReset()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '400px', background: '#111' }}>
      <div style={{ display: 'flex', gap: 8, padding: '4px 8px', background: 'rgba(0,0,0,0.7)', alignItems: 'center' }}>
        <button aria-label="Zoom in" onClick={() => handleZoomStep(1.25)}>+</button>
        <button aria-label="Zoom out" onClick={() => handleZoomStep(1 / 1.25)}>−</button>
        <span>{displayZoom}%</span>
        <button aria-label="Reset view" onClick={handleReset}>Reset [R]</button>
      </div>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        border: '1px solid #00ff41',
        background: 'rgba(0,0,0,0.85)',
        color: '#c8ffc8',
        padding: '4px 8px',
        fontSize: '10px',
        fontFamily: 'var(--hud-font)',
        letterSpacing: '0.08em',
        display: 'flex',
        gap: 12,
      }}>
        <span><span style={{ color: '#3b82f6' }}>■</span> ALPHA</span>
        <span><span style={{ color: '#ef4444' }}>■</span> BRAVO</span>
        <span><span style={{ color: '#6b7280' }}>■</span> KIA</span>
        <span style={{ color: '#5a7a5a' }}>ZONE = CONTROL</span>
      </div>
    </div>
  )
}
