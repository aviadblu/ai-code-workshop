import type { FastifyInstance, FastifyReply } from 'fastify'
import { getUnits, subscribe } from './simulation.js'
import type { TickDelta, Team, UnitStatus } from './types.js'

// ─── Module-level client set ───────────────────────────────────────────────────
// All open SSE connections. Never re-created — persists across connections.
const clients = new Set<FastifyReply>()

// ─── SSE wire-format helper ───────────────────────────────────────────────────
export function formatSSE(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`
}

// ─── Broadcast to all live clients ────────────────────────────────────────────
// Wraps each write in try/catch — if write throws (dead socket), remove client.
function broadcast(event: string, data: string): void {
  const msg = formatSSE(event, data)
  for (const reply of clients) {
    try {
      reply.raw.write(msg)
    } catch {
      clients.delete(reply)
    }
  }
}

// ─── Public registration function ─────────────────────────────────────────────
export function registerSSE(server: FastifyInstance): void {
  // Register simulation subscriber ONCE at startup — NOT per connection.
  // Registering inside the route handler would create N subscribers for N clients.
  subscribe((delta: TickDelta) => {
    broadcast('tick', JSON.stringify(delta))
  })

  server.get('/stream', (request, reply) => {
    // reply.hijack() MUST be called first.
    // Without it, Fastify closes the response when the handler returns,
    // ending the SSE connection immediately after the snapshot write.
    reply.hijack()

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',  // Disable nginx/proxy buffering for real-time delivery
      // Manually set CORS: @fastify/cors hooks do not run after hijack().
      // EventSource is a GET with simple headers — no preflight OPTIONS required.
      'Access-Control-Allow-Origin': '*',
    })

    // Send full 20k-unit snapshot immediately on connect (SSE-01).
    // Intentionally large (~2-4 MB uncompressed) — acceptable for v1 single-developer use.
    const snapshot = [...getUnits().values()]
    reply.raw.write(formatSSE('snapshot', JSON.stringify(snapshot)))

    // Register this connection in the live clients set.
    clients.add(reply)

    // Cleanup on disconnect: remove from set to prevent EPIPE errors on future ticks.
    // Uses request.raw (IncomingMessage) — more reliable than reply.socket in hijack mode.
    request.raw.on('close', () => {
      clients.delete(reply)
    })
  })
}

// ─── GET /units — AJV-validated query param filtering ─────────────────────────
// Fastify's built-in AJV validates and coerces query params before the handler runs.
// Invalid inputs (e.g. healthMin=abc) return a structured 400 with zero custom handler code.
const unitsQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      team:      { type: 'string', enum: ['alpha', 'bravo'] },
      status:    { type: 'string', enum: ['idle', 'moving', 'attacking', 'destroyed'] },
      healthMin: { type: 'number', minimum: 0, maximum: 100 },
      healthMax: { type: 'number', minimum: 0, maximum: 100 },
      search:    { type: 'string', maxLength: 50 },
    },
  },
} as const

export function registerUnitsRoute(server: FastifyInstance): void {
  server.get('/units', { schema: unitsQuerySchema }, (request, reply) => {
    const { team, status, healthMin, healthMax, search } = request.query as {
      team?: Team
      status?: UnitStatus
      healthMin?: number
      healthMax?: number
      search?: string
    }

    let results = [...getUnits().values()]
    if (team      !== undefined) results = results.filter(u => u.team === team)
    if (status    !== undefined) results = results.filter(u => u.status === status)
    if (healthMin !== undefined) results = results.filter(u => u.health >= healthMin)
    if (healthMax !== undefined) results = results.filter(u => u.health <= healthMax)
    if (search    !== undefined) results = results.filter(u => u.id.includes(search))

    return results
  })
}
