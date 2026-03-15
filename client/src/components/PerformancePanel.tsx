import { useState } from 'react'
import { usePerformance } from '../hooks/usePerformance'
import type { PerfSnapshot } from '../hooks/usePerformance'

export function thresholdColour(metric: string, value: number): string {
  const GREEN  = '#22c55e'
  const YELLOW = '#eab308'
  const RED    = '#ef4444'
  switch (metric) {
    case 'fps':
      return value >= 50 ? GREEN : value >= 30 ? YELLOW : RED
    case 'frameTime':
      return value <= 20 ? GREEN : value <= 33 ? YELLOW : RED
    case 'heap':
      return value <= 200 ? GREEN : value <= 500 ? YELLOW : RED
    case 'apiLatency':
      return value <= 100 ? GREEN : value <= 500 ? YELLOW : RED
    case 'storeRate':
      return value <= 5 ? GREEN : value <= 20 ? YELLOW : RED
    default:
      return GREEN
  }
}

function PerfMetrics() {
  const metrics = usePerformance()
  const rows: Array<{ label: string; metric: keyof PerfSnapshot; display: string }> = [
    { label: 'FPS',             metric: 'fps',         display: `${metrics.fps} fps`        },
    { label: 'Frame time',      metric: 'frameTime',   display: `${metrics.frameTime} ms`   },
    { label: 'Heap',            metric: 'heap',        display: `${metrics.heap} MB`         },
    { label: 'API latency',     metric: 'apiLatency',  display: `${metrics.apiLatency} ms`  },
    { label: 'Store updates/s', metric: 'storeRate',   display: `${metrics.storeRate}/s`    },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '12px', marginTop: '8px' }}>
      {rows.map(({ label, metric, display }) => (
        <div key={metric} style={{ display: 'contents' }}>
          <span style={{ color: '#888' }}>{label}</span>
          <span style={{ color: thresholdColour(metric, metrics[metric]) }}>{display}</span>
        </div>
      ))}
    </div>
  )
}

export default function PerformancePanel() {
  const [open, setOpen] = useState(false)
  return (
    <div className="hud-panel" style={{ padding: '8px', fontFamily: 'var(--hud-font)' }}>
      <button onClick={() => setOpen(o => !o)} style={{ fontSize: '12px', cursor: 'pointer' }}>
        {open ? 'Hide Perf' : 'Show Perf'}
      </button>
      {open && <PerfMetrics />}
    </div>
  )
}
