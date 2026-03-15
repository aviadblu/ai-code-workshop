import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useUnitsStore } from '../store/units'
import type { UnitStatus } from '../types'

const healthColour = (h: number) =>
  h > 66 ? '#22c55e' : h > 33 ? '#eab308' : '#ef4444'

export default function UnitsPanel() {
  const units = useUnitsStore((s) => s.units)
  const [statusFilter, setStatusFilter] = useState<UnitStatus | ''>('')
  const [healthMin, setHealthMin] = useState(0)
  const [healthMax, setHealthMax] = useState(100)
  const [searchStr, setSearchStr] = useState('')

  const filtered = useMemo(() => {
    const arr = []
    for (const unit of units.values()) {
      if (statusFilter && unit.status !== statusFilter) continue
      if (unit.health < healthMin || unit.health > healthMax) continue
      if (searchStr && !unit.id.includes(searchStr)) continue
      arr.push(unit)
    }
    return arr
  }, [units, statusFilter, healthMin, healthMax, searchStr])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
  })

  return (
    <div style={{ border: '1px solid #444', padding: '0.5rem' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as UnitStatus | '')}
        >
          <option value="">all</option>
          <option value="idle">idle</option>
          <option value="moving">moving</option>
          <option value="attacking">attacking</option>
          <option value="destroyed">destroyed</option>
        </select>
        <label>
          Health min
          <input
            type="range"
            min={0}
            max={100}
            value={healthMin}
            onChange={(e) => setHealthMin(Number(e.target.value))}
          />
          {healthMin}
        </label>
        <label>
          Health max
          <input
            type="range"
            min={0}
            max={100}
            value={healthMax}
            onChange={(e) => setHealthMax(Number(e.target.value))}
          />
          {healthMax}
        </label>
        <input
          type="text"
          placeholder="Search by ID"
          value={searchStr}
          onChange={(e) => setSearchStr(e.target.value)}
        />
      </div>

      {/* Virtual list */}
      <div ref={parentRef} style={{ height: '40vh', overflowY: 'auto' }}>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((row) => {
            const unit = filtered[row.index]
            return (
              <div
                key={unit.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${row.size}px`,
                  transform: `translateY(${row.start}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 4px',
                  boxSizing: 'border-box',
                  borderBottom: '1px solid #333',
                }}
              >
                <span style={{ width: 80, fontSize: 11 }}>{unit.id}</span>
                <span style={{ width: 50, fontSize: 11 }}>{unit.team}</span>
                <span style={{ width: 70, fontSize: 11 }}>{unit.status}</span>
                <div style={{ flex: 1, background: '#222', height: 8, borderRadius: 4 }}>
                  <div
                    style={{
                      width: `${unit.health}%`,
                      height: '100%',
                      background: healthColour(unit.health),
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
