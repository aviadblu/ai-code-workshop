import { useEffect, useRef } from 'react'
import { useUnitsStore } from '../store/units'

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

      // Unit dots placeholder — plan 05-02 adds dot rendering
      void units

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
