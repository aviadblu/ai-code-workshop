import TacticalMap from './components/TacticalMap'
import UnitsPanel from './components/UnitsPanel'
import EventFeed from './components/EventFeed'
import KPIBar from './components/KPIBar'
import PerformancePanel from './components/PerformancePanel'
import { useSSE } from './hooks/useSSE'

export default function App() {
  useSSE()
  return (
    <div style={{
      fontFamily: 'var(--hud-font)',
      background: 'var(--hud-bg)',
      color: 'var(--hud-green)',
      minHeight: '100vh',
      padding: '1rem',
    }}>
      <h1 style={{
        color: 'var(--hud-green)',
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        fontSize: '1.1rem',
        marginBottom: '1rem',
      }}>
        War Room Control
      </h1>
      <div style={{ marginBottom: '1rem' }}>
        <KPIBar />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div>
          <TacticalMap />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <UnitsPanel />
          <EventFeed />
          <PerformancePanel />
        </div>
      </div>
    </div>
  )
}
