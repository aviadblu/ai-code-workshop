## RESEARCH COMPLETE

**Researched:** 2026-03-14
**Environment:** Node.js v24.14.0 / npm 11.9.0 / macOS Darwin 25.3.0

---

### Stack Versions (verified current)

| Package | Version | Notes |
|---|---|---|
| `typescript` | `^5.9.3` | Latest stable |
| `tsx` | `^4.21.0` | Requires Node 18+ |
| `fastify` | `^5.8.2` | Fastify 5.x — current major |
| `@fastify/cors` | `^11.2.0` | Fastify 5 compatible |
| `@types/node` | `^25.5.0` | For server TypeScript |
| `vite` | `^8.0.0` | Requires Node 20.19+ or 22.12+ — Node 24 satisfies this |
| `@vitejs/plugin-react` | `^6.0.1` | Vite 8 compatible |
| `react` | `^19.2.4` | React 19 is current — spec says "React 18" but 19 is the right choice |
| `react-dom` | `^19.2.4` | Must match react version |
| `@types/react` | `^19.2.14` | React 19 types — no separate @types/react-dom needed in React 19 |

**React 18 vs 19 decision:** The spec says "React 18" but React 19.2.4 is the current stable release. React 19 has no breaking changes to `createRoot`, JSX transform, or basic component patterns used in this phase. Use React 19. The only gotcha is that `@types/react-dom` is merged into `@types/react` in React 19 — do not install `@types/react-dom` separately.

---

### npm Workspaces Setup

**Root `package.json` — exact structure:**

```json
{
  "name": "war-room-control",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "server",
    "client"
  ],
  "scripts": {
    "dev:server": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client",
    "install:all": "npm install"
  }
}
```

Key rules:
- `"private": true` is required — npm refuses to publish a workspaces root
- `"workspaces"` paths are relative to root, must be directory names matching the workspace `package.json` location
- A single `npm install` from root installs all workspace dependencies and symlinks them under root `node_modules/`
- `npm run dev --workspace=server` delegates to the `dev` script inside `server/package.json`
- Do NOT set `"type": "module"` at the root level — let each workspace control its own module type

---

### Server Setup (Fastify + tsx)

**`server/package.json`:**

```json
{
  "name": "@war-room/server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "fastify": "^5.8.2",
    "@fastify/cors": "^11.2.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "tsx": "^4.21.0",
    "@types/node": "^25.5.0"
  }
}
```

**`server/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`server/src/index.ts` — entry point pattern:**

```typescript
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
```

Note: Fastify 5 supports top-level `await` and works cleanly with `"type": "module"` + NodeNext. The `await server.register(...)` pattern (instead of callback-style) is the idiomatic Fastify 5 approach.

---

### Client Setup (Vite + React 19)

**`client/package.json`:**

```json
{
  "name": "@war-room/client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "@types/react": "^19.2.14",
    "vite": "^8.0.0",
    "@vitejs/plugin-react": "^6.0.1"
  }
}
```

**`client/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`client/vite.config.ts`:**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/stream': 'http://localhost:3000',
      '/units': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
```

**`client/index.html`:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>War Room Control</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### TypeScript Config Details

| Setting | Server (NodeNext) | Client (Bundler) |
|---|---|---|
| `module` | `"NodeNext"` | `"ESNext"` |
| `moduleResolution` | `"NodeNext"` | `"Bundler"` |
| `jsx` | not set | `"react-jsx"` |
| `lib` | not needed (defaults to ES2022) | `["ES2022", "DOM", "DOM.Iterable"]` |
| `noEmit` | not set (tsc does emit to dist/) | `true` (Vite handles emit) |
| `outDir` | `"dist"` | not set |
| `rootDir` | `"src"` | not set |

**NodeNext critical rule:** All relative imports within server source files MUST use `.js` extension even though the files are `.ts`. TypeScript resolves `.js` to `.ts` at compile time under NodeNext. Example:

```typescript
// CORRECT under NodeNext
import { Unit } from './types.js'

// WRONG — will cause runtime module not found
import { Unit } from './types'
```

**Bundler mode:** Extensions are optional — Vite's bundler resolves them. You can write `import { Unit } from './types'` without `.js` and it works fine.

---

### Shared Types Strategy

The spec explicitly says: types live in `server/src/types.ts` and are duplicated in `client/src/types.ts`. No shared package is needed for this exercise.

**`server/src/types.ts`** and **`client/src/types.ts`** contain identical content:

```typescript
export type Team = 'alpha' | 'bravo'

export type UnitStatus = 'idle' | 'moving' | 'attacking' | 'destroyed'

export interface Unit {
  id: string
  team: Team
  x: number       // 0–1000
  y: number       // 0–1000
  health: number  // 0–100
  status: UnitStatus
}

export interface TickDelta {
  tick: number
  changes: Unit[]
  events: GameEvent[]
}

export interface GameEvent {
  type: 'attack' | 'destroyed' | 'capture'
  unitId: string
  targetId?: string
  tick: number
}
```

Why duplicate instead of a shared package: adding a `shared/` workspace introduces symlink resolution complexity with NodeNext, requires a third `tsconfig.json`, and complicates the `package.json` exports field. For this 7-phase project, copy-paste is the right tradeoff.

If types diverge in a future phase, extract to `shared/` at that point.

---

### Validation Architecture

**Commands that prove Phase 1 is complete:**

```bash
# 1. Single install from root succeeds with no errors
npm install

# 2. Server starts and health check responds
npm run dev:server
# in another terminal:
curl http://localhost:3000/health
# expected: {"status":"ok"}

# 3. Client starts and renders at localhost:5173
npm run dev:client
# open http://localhost:5173 in browser
# expected: page renders without console errors

# 4. Client proxy reaches server (no CORS errors)
# In browser devtools console on http://localhost:5173:
fetch('/health').then(r => r.json()).then(console.log)
# expected: {status: 'ok'} — proves proxy works

# 5. TypeScript compiles both workspaces without errors
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

**What to look for in the browser:**
- `App.tsx` renders a layout div with placeholder text for: `TacticalMap`, `UnitsPanel`, `EventFeed`, `KPIBar`, `PerformancePanel`
- No React errors in console
- No CORS errors in console
- Network tab shows `/health` returning 200 through the proxy

---

### Gotchas & Pitfalls

**1. NodeNext requires `.js` extensions on all relative imports in server code**
The single most common mistake. Write `import { Unit } from './types.js'` not `'./types'`. This applies even in `.ts` files. tsx handles the resolution at runtime, but the TypeScript compiler enforces this rule under NodeNext.

**2. Do NOT set `"type": "module"` at the root `package.json`**
Setting it at root can confuse npm workspaces resolution. Let each `server/package.json` and `client/package.json` declare `"type": "module"` independently.

**3. Fastify 5 uses ESM-first — no `require('fastify')`**
Use `import Fastify from 'fastify'`. The CommonJS require path still exists but TypeScript with NodeNext will not resolve it correctly.

**4. `@types/react-dom` is gone in React 19**
React 19 merged its types into `@types/react`. Do not install `@types/react-dom` — it will either not exist or conflict. The `client/package.json` above is correct without it.

**5. Vite 8 requires Node 20.19+ or 22.12+**
Node 24 (current environment) satisfies this. If running on an older Node, downgrade to Vite 7 (`^7.x`) which has the same API surface but works on Node 18+.

**6. CORS and proxy: use one or the other per route in dev**
The Vite proxy rewrites the origin, so proxied requests (`/stream`, `/units`, `/health`) never hit the CORS check. The `@fastify/cors` plugin allowing `http://localhost:5173` is only needed if the client ever makes direct (non-proxied) calls — which won't happen in dev if all API paths are in the proxy config. Keep CORS enabled anyway for production builds and non-Vite testing.

**7. `tsx watch` vs `tsx --watch`**
The correct subcommand is `tsx watch src/index.ts` (space, not flag). `tsx --watch` is not valid in tsx 4.x.

**8. `client/tsconfig.json` should have `"noEmit": true`**
Vite ignores `tsconfig.json` for transpilation (it uses esbuild), but running `tsc --noEmit` manually for type checking requires this. Without it, `tsc` will try to emit JS files alongside the source, cluttering `src/`.

**9. npm workspaces hoist dependencies to root `node_modules/`**
If server and client both depend on `typescript`, only one copy lands in root `node_modules/`. This is intentional and fine. Do not add `--no-workspaces` or `--ignore-scripts` flags during install — they break hoisting.

**10. `vite.config.ts` proxy path matching is prefix-based**
`'/stream': 'http://localhost:3000'` proxies any request whose path starts with `/stream`. For exact path matching, use a regex: `/^\/stream$/`. For this project, prefix matching is fine since `/stream` is a unique path.

**11. Fastify logger interferes with `tsx watch` restart output**
When `tsx watch` restarts the process, Fastify's pino logger may buffer output. Set `logger: { level: 'info' }` explicitly or use `logger: true` — both are fine. If output looks garbled, add `prettyPrint: true` or install `pino-pretty` as a dev dep and pipe: `tsx watch src/index.ts | npx pino-pretty`.
