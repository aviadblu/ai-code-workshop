import { useEffect, useRef } from 'react'
import { useUnitsStore } from '../store/units'
import type { Unit } from '../types'

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

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '400px', background: '#111' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        background: 'rgba(0,0,0,0.6)', color: '#fff',
        padding: '4px 8px', fontSize: '11px', borderRadius: 4,
        display: 'flex', gap: 12,
      }}>
        <span><span style={{ color: '#3b82f6' }}>■</span> Alpha</span>
        <span><span style={{ color: '#ef4444' }}>■</span> Bravo</span>
        <span><span style={{ color: '#6b7280' }}>■</span> Destroyed</span>
        <span style={{ color: '#aaa' }}>Zone circle = control</span>
      </div>
    </div>
  )
}
