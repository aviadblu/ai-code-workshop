import { create } from 'zustand'
import type { Unit, TickDelta, GameEvent } from '../types'

interface UnitsStore {
  units: Map<string, Unit>
  events: GameEvent[]
  tick: number
  applySnapshot: (units: Unit[]) => void
  applyDelta: (delta: TickDelta) => void
}

export const useUnitsStore = create<UnitsStore>((set) => ({
  units: new Map<string, Unit>(),
  events: [] as GameEvent[],
  tick: 0,

  applySnapshot: (units) =>
    set({ units: new Map(units.map((u) => [u.id, u])) }),

  applyDelta: (delta) =>
    set((state) => {
      const next = new Map(state.units)
      for (const u of delta.changes) {
        next.set(u.id, u)
      }
      return {
        units: next,
        tick: delta.tick,
        events: [...state.events, ...delta.events].slice(-50),
      }
    }),
}))
