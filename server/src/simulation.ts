import type { Unit, Team, TickDelta, GameEvent } from './types.js'

// ─── Module state ─────────────────────────────────────────────────────────────

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

export function startTickLoop(): NodeJS.Timeout {
  return setInterval(runTick, 1000)
}

// ─── Unit generation ──────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function pickAction(): 'move' | 'attack' | 'idle' {
  const r = Math.random()
  if (r < 0.40) return 'move'
  if (r < 0.70) return 'attack'
  return 'idle'
}

const ATTACK_RADIUS = 50

function findNearbyEnemy(attacker: Unit): Unit | undefined {
  for (const candidate of units.values()) {
    if (candidate.team === attacker.team) continue
    if (candidate.status === 'destroyed') continue
    const dx = candidate.x - attacker.x
    const dy = candidate.y - attacker.y
    if (dx * dx + dy * dy <= ATTACK_RADIUS * ATTACK_RADIUS) return candidate
  }
  return undefined
}

function selectLivingUnits(count: number): Unit[] {
  const living: Unit[] = []
  for (const unit of units.values()) {
    if (unit.status !== 'destroyed') living.push(unit)
  }
  if (living.length === 0) return []

  const n = Math.min(count, living.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (living.length - i))
    ;[living[i], living[j]] = [living[j], living[i]]
  }
  return living.slice(0, n)
}

// ─── Tick ─────────────────────────────────────────────────────────────────────

function runTick(): void {
  tick++
  const count = Math.floor(Math.random() * 151) + 200
  const selected = selectLivingUnits(count)

  const changesMap = new Map<string, Unit>()
  const events: GameEvent[] = []

  for (const unit of selected) {
    // Skip units destroyed earlier this tick (e.g. by another unit's attack)
    if (unit.status === 'destroyed') continue

    const action = pickAction()

    if (action === 'move') {
      const dx = Math.random() * 10 - 5
      const dy = Math.random() * 10 - 5
      unit.x = clamp(unit.x + dx, 0, 1000)
      unit.y = clamp(unit.y + dy, 0, 1000)
      unit.status = 'moving'
      changesMap.set(unit.id, { ...unit })

    } else if (action === 'attack') {
      const target = findNearbyEnemy(unit)
      if (target) {
        const damage = Math.floor(Math.random() * 16) + 5
        target.health = Math.max(0, target.health - damage)
        unit.status = 'attacking'

        events.push({ type: 'attack', unitId: unit.id, targetId: target.id, tick })
        changesMap.set(unit.id, { ...unit })
        changesMap.set(target.id, { ...target })

        if (target.health <= 0) {
          target.status = 'destroyed'
          changesMap.set(target.id, { ...target })
          events.push({ type: 'destroyed', unitId: target.id, tick })
        }
      }
      // No nearby enemy: treat as idle — no changesMap entry
    }
    // idle: no mutation, no changesMap entry
  }

  const delta: TickDelta = { tick, changes: Array.from(changesMap.values()), events }
  console.log(`[sim] tick ${tick}: ${delta.changes.length} changes, ${events.length} events`)

  for (const cb of subscribers) cb(delta)
}
