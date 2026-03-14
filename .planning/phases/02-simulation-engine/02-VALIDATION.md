---
phase: 2
slug: simulation-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Wave 0 installs) |
| **Config file** | `server/vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `cd server && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd server && npx vitest run` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd server && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd server && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 1 | SIM-01 | unit | `cd server && npx vitest run src/__tests__/simulation.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 02-01 | 1 | SIM-01 | unit | `cd server && npx vitest run src/__tests__/simulation.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02-02 | 2 | SIM-02, SIM-03, SIM-04 | unit | `cd server && npx vitest run src/__tests__/simulation.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02-02 | 2 | SIM-02, SIM-03, SIM-04 | unit | `cd server && npx vitest run src/__tests__/simulation.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 02-03 | 3 | SIM-01–04 | integration | `cd server && npx vitest run` | ❌ W0 | ⬜ pending |
| 02-03-02 | 02-03 | 3 | SIM-01–04 | manual | See Manual-Only section | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/vitest.config.ts` — vitest ESM + NodeNext config
- [ ] `server/src/__tests__/simulation.test.ts` — test stubs for SIM-01 through SIM-04
- [ ] `npm install --save-dev vitest` in `server/` — if not already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Server logs 20k units on startup | SIM-01 | Process stdout not captured by vitest | Run `npm run dev:server`, check logs for "20000 units generated" |
| Tick delta logged every ~1s | SIM-02 | Real-time timing check | Observe server logs for `TickDelta tick=N changes=2XX` every second |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
