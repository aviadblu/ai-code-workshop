---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (scaffold phase — no test framework yet) |
| **Config file** | none |
| **Quick run command** | `npm run dev:server &; curl -s http://localhost:3000/health` |
| **Full suite command** | `npm install && npm run dev:server &; sleep 2 && curl -sf http://localhost:3000/health` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm install` in root, verify no errors
- **After every plan wave:** Run server + curl health check; open client in browser
- **Before `/gsd:verify-work`:** Both server and client must start cleanly
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01-01 | 1 | INFRA-01 | manual | `npm install` exits 0 | ✅ | ⬜ pending |
| 1-01-02 | 01-01 | 1 | INFRA-01 | file check | `test -f server/src/types.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 01-02 | 2 | INFRA-02 | curl | `curl -sf http://localhost:3000/health \| grep ok` | ❌ W0 | ⬜ pending |
| 1-03-01 | 01-03 | 2 | INFRA-03 | manual | Browser loads `http://localhost:5173` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` at root with workspaces field
- [ ] `server/package.json` exists
- [ ] `client/package.json` exists

*No test framework in this scaffold phase — verification is via process start + curl.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npm run dev:client` loads React page in browser | INFRA-03 | Browser UI cannot be curl-checked | Run `npm run dev:client`, open `http://localhost:5173`, verify page renders |
| TypeScript types resolve correctly | INFRA-01 | No test runner yet | Run `npx tsc --noEmit` in both `server/` and `client/` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
