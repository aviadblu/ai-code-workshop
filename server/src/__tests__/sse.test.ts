import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import http from 'node:http'

// ─── Mock simulation.ts ───────────────────────────────────────────────────────
// We mock the simulation module so:
// 1. getUnits() returns a controlled 20k-unit map
// 2. subscribe() captures the registered callback so we can trigger ticks in tests

// Use vi.hoisted to define variables that need to be available inside the vi.mock factory.
// vi.mock() is hoisted to the top of the file, so regular const/let declarations aren't available.
const { capturedSubscribers, subscribeMock, mockUnits } = vi.hoisted(() => {
  const capturedSubscribers: Array<(delta: { tick: number; changes: unknown[]; events: unknown[] }) => void> = []
  const mockUnits = new Map<string, { id: string; team: string; x: number; y: number; health: number; status: string }>()
  for (let i = 1; i <= 20000; i++) {
    const id = 'u-' + String(i).padStart(5, '0')
    mockUnits.set(id, {
      id,
      team: i <= 10000 ? 'alpha' : 'bravo',
      x: 100,
      y: 200,
      health: 80,
      status: 'idle',
    })
  }
  const subscribeMock = vi.fn((cb: (delta: { tick: number; changes: unknown[]; events: unknown[] }) => void) => {
    capturedSubscribers.push(cb)
    return () => {
      const idx = capturedSubscribers.indexOf(cb)
      if (idx !== -1) capturedSubscribers.splice(idx, 1)
    }
  })
  return { capturedSubscribers, subscribeMock, mockUnits }
})

vi.mock('../simulation.js', () => ({
  getUnits: () => mockUnits,
  subscribe: subscribeMock,
  initSimulation: vi.fn(),
  startTickLoop: vi.fn(),
}))

// ─── Import registerSSE AFTER mock is set up ─────────────────────────────────
import { registerSSE } from '../sse.js'

// ─── Helper: make GET /stream request to a live server, capture initial chunk ─
// Resolves with the body received before the connection is destroyed.
// We destroy the connection after a short timeout to avoid hanging the test.

function sseGet(port: number, timeoutMs = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    const req = http.get(`http://127.0.0.1:${port}/stream`, (res) => {
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        body += chunk
        // Once we have the snapshot, destroy the connection immediately
        if (body.includes('event: snapshot') && body.includes('\n\n')) {
          req.destroy()
          resolve(body)
        }
      })
      res.on('end', () => resolve(body))
      res.on('error', (err) => {
        // Ignore ECONNRESET — that's our own destroy()
        if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(err)
      })
    })
    req.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(err)
    })
    // Safety timeout
    const timer = setTimeout(() => {
      req.destroy()
      resolve(body)
    }, timeoutMs)
    req.on('close', () => clearTimeout(timer))
  })
}

// ─── Helper: build a test server bound to a random port ──────────────────────

async function buildAndStartServer(): Promise<{ server: FastifyInstance; port: number }> {
  const server = Fastify({ logger: false })
  await server.register(cors, { origin: 'http://localhost:5173' })
  registerSSE(server)
  await server.listen({ port: 0, host: '127.0.0.1' })
  const address = server.server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return { server, port }
}

// ─── SSE-01: Snapshot on connect ─────────────────────────────────────────────

describe('SSE-01: GET /stream sends event: snapshot on connect', () => {
  let server: FastifyInstance
  let port: number

  beforeEach(async () => {
    capturedSubscribers.length = 0
    subscribeMock.mockClear()
    ;({ server, port } = await buildAndStartServer())
  })

  afterEach(async () => {
    await server.close()
  })

  it('responds with event: snapshot in the body', async () => {
    const body = await sseGet(port)
    expect(body).toContain('event: snapshot')
  })

  it('snapshot data is a JSON array of 20000 units', async () => {
    const body = await sseGet(port)
    const dataLine = body.split('\n').find(line => line.startsWith('data:'))
    expect(dataLine).toBeDefined()
    const parsed = JSON.parse(dataLine!.replace(/^data:\s*/, ''))
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(20000)
  })

  it('Content-Type header is text/event-stream', async () => {
    const headers = await new Promise<http.IncomingHttpHeaders>((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}/stream`, (res) => {
        resolve(res.headers)
        req.destroy()
      })
      req.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(err)
      })
    })
    expect(headers['content-type']).toContain('text/event-stream')
  })

  it('registers a cleanup listener on request.raw close event', async () => {
    // Verify that the close listener is registered by connecting then disconnecting.
    // After disconnect, the client should be removed from the set.
    // We verify this indirectly: calling tick callback after close does not write to the dead client.
    const body = await sseGet(port)
    expect(body).toContain('event: snapshot')

    // After connection destroyed, allow cleanup to propagate
    await new Promise(r => setTimeout(r, 50))

    // capturedSubscribers should have the tick callback registered
    expect(capturedSubscribers.length).toBeGreaterThan(0)
    // Calling broadcast should not throw even with the connection closed
    const fakeDelta: import('../types.js').TickDelta = { tick: 1, changes: [], events: [] }
    expect(() => capturedSubscribers[0](fakeDelta)).not.toThrow()
  })
})

// ─── SSE-02: Tick broadcast ───────────────────────────────────────────────────

describe('SSE-02: Tick broadcast writes event: tick to connected clients', () => {
  let server: FastifyInstance
  let port: number

  beforeEach(async () => {
    capturedSubscribers.length = 0
    subscribeMock.mockClear()
    ;({ server, port } = await buildAndStartServer())
  })

  afterEach(async () => {
    await server.close()
  })

  it('subscribe() is called exactly once when registerSSE is called', () => {
    expect(subscribeMock).toHaveBeenCalledTimes(1)
  })

  it('tick callback broadcasts event: tick to connected client', async () => {
    // Capture SSE output from a live connection with tick trigger
    const fakeDelta: import('../types.js').TickDelta = {
      tick: 42,
      changes: [{ id: 'u-00001', team: 'alpha', x: 100, y: 200, health: 50, status: 'moving' }],
      events: [],
    }

    const received = await new Promise<string>((resolve, reject) => {
      let body = ''
      let snapshotReceived = false
      const req = http.get(`http://127.0.0.1:${port}/stream`, (res) => {
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          body += chunk
          if (!snapshotReceived && body.includes('event: snapshot')) {
            snapshotReceived = true
            // Fire a tick immediately after snapshot received
            setTimeout(() => {
              capturedSubscribers[0](fakeDelta)
            }, 10)
          }
          if (body.includes('event: tick')) {
            req.destroy()
            resolve(body)
          }
        })
        res.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(err)
        })
      })
      req.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(err)
      })
      // Safety timeout
      setTimeout(() => { req.destroy(); resolve(body) }, 3000)
    })

    expect(received).toContain('event: tick')
    expect(received).toContain(JSON.stringify(fakeDelta))
  })

  it('tick event follows SSE wire format: event: tick\\ndata: ...\\n\\n', async () => {
    const fakeDelta: import('../types.js').TickDelta = { tick: 7, changes: [], events: [] }

    const received = await new Promise<string>((resolve, reject) => {
      let body = ''
      const req = http.get(`http://127.0.0.1:${port}/stream`, (res) => {
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          body += chunk
          if (body.includes('event: snapshot')) {
            setTimeout(() => capturedSubscribers[0](fakeDelta), 10)
          }
          if (body.includes('event: tick')) {
            req.destroy()
            resolve(body)
          }
        })
        res.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(err)
        })
      })
      req.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(err)
      })
      setTimeout(() => { req.destroy(); resolve(body) }, 3000)
    })

    // Find tick event block
    const tickEventBlock = received.substring(received.indexOf('event: tick'))
    expect(tickEventBlock).toMatch(/^event: tick\ndata: .+\n\n/)
  })
})

// ─── SSE-03: Reconnect = new snapshot ────────────────────────────────────────

describe('SSE-03: Second connection (reconnect) also receives event: snapshot', () => {
  let server: FastifyInstance
  let port: number

  beforeEach(async () => {
    capturedSubscribers.length = 0
    subscribeMock.mockClear()
    ;({ server, port } = await buildAndStartServer())
  })

  afterEach(async () => {
    await server.close()
  })

  it('first connection contains event: snapshot', async () => {
    const body = await sseGet(port)
    expect(body).toContain('event: snapshot')
  })

  it('second connection (reconnect) also contains event: snapshot', async () => {
    // First connection
    await sseGet(port)
    // Second connection (simulating reconnect after disconnect)
    const body2 = await sseGet(port)
    expect(body2).toContain('event: snapshot')
  })

  it('both connections receive independent snapshots concurrently', async () => {
    const [body1, body2] = await Promise.all([sseGet(port), sseGet(port)])
    expect(body1).toContain('event: snapshot')
    expect(body2).toContain('event: snapshot')
  })
})

// ─── Cleanup: close removes client from Set ──────────────────────────────────

describe('Cleanup: request.raw close event removes client from clients Set', () => {
  let server: FastifyInstance
  let port: number

  beforeEach(async () => {
    capturedSubscribers.length = 0
    subscribeMock.mockClear()
    ;({ server, port } = await buildAndStartServer())
  })

  afterEach(async () => {
    await server.close()
  })

  it('tick broadcast does not throw after client disconnects', async () => {
    // Connect and disconnect
    await sseGet(port)

    // Give close event time to propagate
    await new Promise(r => setTimeout(r, 100))

    // Broadcast should not throw even though client is gone
    const fakeDelta: import('../types.js').TickDelta = { tick: 1, changes: [], events: [] }
    expect(capturedSubscribers.length).toBeGreaterThan(0)
    expect(() => capturedSubscribers[0](fakeDelta)).not.toThrow()
    // Second call: client was removed after first attempt, still no throw
    expect(() => capturedSubscribers[0](fakeDelta)).not.toThrow()
  })
})
