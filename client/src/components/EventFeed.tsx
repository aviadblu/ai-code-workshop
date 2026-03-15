import { useUnitsStore } from '../store/units'

const EVENT_COLOURS: Record<string, string> = {
  attack:    '#eab308',
  destroyed: '#ef4444',
  capture:   '#22c55e',
}

export default function EventFeed() {
  const events = useUnitsStore(s => s.events)

  return (
    <div style={{ border: '1px solid #444', padding: '0.5rem' }}>
      <div style={{ overflowY: 'auto', maxHeight: '30vh' }}>
        {events.map((event, i) => (
          <div
            key={`${event.tick}-${event.unitId}-${i}`}
            style={{
              color: EVENT_COLOURS[event.type] ?? '#fff',
              fontSize: 12,
              padding: '2px 0',
              borderBottom: '1px solid #222',
            }}
          >
            <span>{event.type}</span>
            {': '}
            <span>{event.unitId}</span>
            {event.targetId ? ` \u2192 ${event.targetId}` : ''}
          </div>
        ))}
      </div>
    </div>
  )
}
