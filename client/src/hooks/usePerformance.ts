import { useEffect, useRef, useState } from 'react'
import { useUnitsStore } from '../store/units'

export interface PerfSnapshot {
  fps: number
  frameTime: number
  heap: number
  apiLatency: number
  storeRate: number
}

const INITIAL: PerfSnapshot = { fps: 0, frameTime: 0, heap: 0, apiLatency: 0, storeRate: 0 }

export function usePerformance(): PerfSnapshot {
  const metricsRef = useRef<PerfSnapshot>({ ...INITIAL })
  const [snapshot, setSnapshot] = useState<PerfSnapshot>(INITIAL)
  const rafTimestampsRef = useRef<number[]>([])
  const storeCounterRef = useRef(0)
  const lastRafRef = useRef<number>(0)

  useEffect(() => {
    // 1. PerformanceObserver — captures /stream connection latency once
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes('/stream')) {
          metricsRef.current.apiLatency = Math.round(entry.duration)
        }
      }
    })
    observer.observe({ type: 'resource', buffered: true })

    // 2. Zustand store update counter
    const unsubscribe = useUnitsStore.subscribe(() => {
      storeCounterRef.current++
    })

    // 3. rAF loop — FPS ring buffer + frameTime + heap (all via refs, no setState)
    let rafId: number
    const tick = (now: number) => {
      const delta = now - lastRafRef.current
      lastRafRef.current = now
      metricsRef.current.frameTime = Math.round(delta * 100) / 100

      const ts = rafTimestampsRef.current
      ts.push(now)
      if (ts.length > 60) ts.shift()
      if (ts.length >= 2) {
        const elapsed = (ts[ts.length - 1] - ts[0]) / 1000
        metricsRef.current.fps = Math.round((ts.length - 1) / elapsed)
      }

      metricsRef.current.heap = Math.round(
        ((performance as any).memory?.usedJSHeapSize ?? 0) / 1048576
      )

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    // 4. 2Hz display throttle — only place that calls setSnapshot
    const intervalId = setInterval(() => {
      metricsRef.current.storeRate = storeCounterRef.current
      storeCounterRef.current = 0
      setSnapshot({ ...metricsRef.current })
    }, 500)

    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(intervalId)
      observer.disconnect()
      unsubscribe()
    }
  }, [])

  return snapshot
}
