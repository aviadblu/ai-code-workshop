import { useEffect } from 'react'
import { useUnitsStore } from '../store/units'
import type { Unit, TickDelta } from '../types'

export function useSSE() {
  useEffect(() => {
    const es = new EventSource('/stream')

    es.addEventListener('snapshot', (e: MessageEvent) => {
      const units: Unit[] = JSON.parse(e.data)
      useUnitsStore.getState().applySnapshot(units)
    })

    es.addEventListener('tick', (e: MessageEvent) => {
      const delta: TickDelta = JSON.parse(e.data)
      useUnitsStore.getState().applyDelta(delta)
    })

    return () => {
      es.close()
    }
  }, [])
}
