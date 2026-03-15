import type { FastifyInstance, FastifyReply } from 'fastify'
import { getUnits, subscribe } from './simulation.js'
import type { TickDelta } from './types.js'

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
