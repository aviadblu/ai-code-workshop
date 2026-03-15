import { useMemo } from 'react'
import { useUnitsStore } from '../store/units'

export default function KPIBar() {
  const units = useUnitsStore(s => s.units)

  const kpi = useMemo(() => {
    let alphaAlive = 0, bravoAlive = 0, destroyed = 0
    for (const unit of units.values()) {
      if (unit.status === 'destroyed') { destroyed++; continue }
      if (unit.team === 'alpha') alphaAlive++
      else bravoAlive++
    }
    const total = alphaAlive + bravoAlive || 1
    const alphaZonePct = Math.round((alphaAlive / total) * 100)
    const bravoZonePct = 100 - alphaZonePct
    return { alphaAlive, bravoAlive, destroyed, alphaZonePct, bravoZonePct }
  }, [units])

  return (
    <div style={{
      border: '1px solid #444', padding: '0.5rem',
      display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13,
    }}>
      <span>Alpha alive: <strong>{kpi.alphaAlive}</strong></span>
      <span>Bravo alive: <strong>{kpi.bravoAlive}</strong></span>
      <span>Destroyed: <strong>{kpi.destroyed}</strong></span>
      <span>Zone: Alpha <strong>{kpi.alphaZonePct}%</strong> / Bravo <strong>{kpi.bravoZonePct}%</strong></span>
    </div>
  )
}
