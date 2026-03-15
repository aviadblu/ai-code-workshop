---
phase: 3
slug: sse-transport
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 (already installed) |
| **Config file** | `server/vitest.config.ts` (exists from Phase 2) |
| **Quick run command** | `cd server && npx vitest run src/__tests__/sse.test.ts` |
| **Full suite command** | `cd server && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** `cd server && npx vitest run src/__tests__/sse.test.ts`
- **After every plan wave:** `cd server && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 03-01 | 1 | SSE-01, SSE-02, SSE-03 | unit/integration | `cd server && npx vitest run src/__tests__/sse.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | SSE-01, SSE-02, SSE-03 | unit/integration | `cd server && npx vitest run src/__tests__/sse.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-T3 | 03-01 | 1 | SSE-01, SSE-02, SSE-03 | unit/integration | `cd server && npx vitest run src/__tests__/sse.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-T1 | 03-02 | 2 | API-01 | integration | `cd server && npx vitest run src/__tests__/sse.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-T2 | 03-02 | 2 | API-01 | integration | `cd server && npx vitest run src/__tests__/sse.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-T3 | 03-02 | 2 | SSE-01–SSE-03, API-01 | integration | `cd server && npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/__tests__/sse.test.ts` — covers SSE-01, SSE-02, SSE-03, API-01

*(Existing `simulation.test.ts` covers SIM-01–04; no changes needed to it.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser EventSource reconnects and receives fresh snapshot | SSE-03 | Real browser EventSource behavior | Open DevTools Network tab, connect to `/stream`, close and reopen — verify new `snapshot` event appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
