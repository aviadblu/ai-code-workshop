import type { Unit, Team, TickDelta } from './types.js'

// Module-closure singleton — nothing leaks to global
const units = new Map<string, Unit>()
let tick = 0
const subscribers: Array<(delta: TickDelta) => void> = []

// ─── Public API ───────────────────────────────────────────────────────────────

export function initSimulation(): void {
  units.clear()
  tick = 0
  generateUnits()
  console.log(`[sim] ${units.size} units generated`)
}

export function getUnits(): Map<string, Unit> {
  return units
}

export function subscribe(cb: (delta: TickDelta) => void): () => void {
  subscribers.push(cb)
  return () => {
    const idx = subscribers.indexOf(cb)
    if (idx !== -1) subscribers.splice(idx, 1)
  }
}

/** Stub — implemented in plan 02-02 */
export function startTickLoop(): NodeJS.Timeout {
  return setInterval(() => {}, 1_000_000) // no-op placeholder
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function generateUnits(): void {
  let n = 0
  for (const team of ['alpha', 'bravo'] as Team[]) {
    for (let i = 0; i < 10_000; i++) {
      n++
      const id = 'u-' + String(n).padStart(5, '0')
      units.set(id, {
        id,
        team,
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        health: Math.random() * 100,
        status: 'idle',
      })
    }
  }
}
