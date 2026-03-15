import { useEffect, useRef } from 'react'
import { useUnitsStore } from '../store/units'

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
    </div>
  )
}
