export type Team = 'alpha' | 'bravo'

export type UnitStatus = 'idle' | 'moving' | 'attacking' | 'destroyed'

export interface Unit {
  id: string
  team: Team
  x: number       // 0–1000
  y: number       // 0–1000
  health: number  // 0–100
  status: UnitStatus
}

export interface TickDelta {
  tick: number
  changes: Unit[]
  events: GameEvent[]
}

export interface GameEvent {
  type: 'attack' | 'destroyed' | 'capture'
  unitId: string
  targetId?: string
  tick: number
}
