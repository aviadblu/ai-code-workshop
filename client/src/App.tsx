import TacticalMap from './components/TacticalMap'
import UnitsPanel from './components/UnitsPanel'
import EventFeed from './components/EventFeed'
import KPIBar from './components/KPIBar'
import PerformancePanel from './components/PerformancePanel'

export default function App() {
  return (
    <div style={{ fontFamily: 'monospace', padding: '1rem' }}>
      <h1>War Room Control</h1>
      <div style={{ marginBottom: '1rem' }}>
        <KPIBar />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div>
          <TacticalMap />
        </div>
        <div>
          <UnitsPanel />
          <EventFeed />
          <PerformancePanel />
        </div>
      </div>
    </div>
  )
}
