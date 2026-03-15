import { useRef, useMemo } from 'react'
import { useUnitsStore } from '../store/units'

function PulsingValue({ value, style }: { value: React.ReactNode; style?: React.CSSProperties }) {
  const renderCount = useRef(0)
  renderCount.current += 1
  return (
    <span key={renderCount.current} className="pulse-value" style={style}>
      {value}
    </span>
  )
}

const CELL: React.CSSProperties = {
  border: '1px solid #00ff41',
  background: 'rgba(0,255,65,0.03)',
  padding: '4px 10px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minWidth: 80,
  gap: 2,
}

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
    <div className="hud-panel" style={{ display: 'flex', gap: 8, padding: '6px 8px', flexWrap: 'wrap' }}>
      <div style={CELL}>
        <div className="hud-label">Alpha</div>
        <PulsingValue value={kpi.alphaAlive} style={{ color: '#3b82f6' }} />
      </div>
      <div style={CELL}>
        <div className="hud-label">Bravo</div>
        <PulsingValue value={kpi.bravoAlive} style={{ color: '#ef4444' }} />
      </div>
      <div style={CELL}>
        <span>
          <div className="hud-label" style={{ marginBottom: 2 }}>Destroyed</div>
          <PulsingValue value={kpi.destroyed} />
        </span>
      </div>
      <div style={CELL}>
        <div className="hud-label">Alpha Zone</div>
        <PulsingValue value={`${kpi.alphaZonePct}%`} style={{ color: '#3b82f6' }} />
      </div>
      <div style={CELL}>
        <div className="hud-label">Bravo Zone</div>
        <PulsingValue value={`${kpi.bravoZonePct}%`} style={{ color: '#ef4444' }} />
      </div>
    </div>
  )
}
