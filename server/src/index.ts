import Fastify from 'fastify'
import cors from '@fastify/cors'

const server = Fastify({ logger: true })

await server.register(cors, {
  origin: 'http://localhost:5173',
})

server.get('/health', async () => {
  return { status: 'ok' }
})

const port = Number(process.env.PORT) || 3000

try {
  await server.listen({ port, host: '0.0.0.0' })
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
