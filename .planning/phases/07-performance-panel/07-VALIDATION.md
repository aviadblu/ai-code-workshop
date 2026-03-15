---
phase: 7
slug: performance-panel
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-15
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `client/vitest.config.ts` |
| **Quick run command** | `cd client && npx vitest run src/hooks/usePerformance.test.ts src/components/PerformancePanel.test.tsx` |
| **Full suite command** | `cd client && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx vitest run src/hooks/usePerformance.test.ts src/components/PerformancePanel.test.tsx`
- **After every plan wave:** Run `cd client && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-T1 | 07-01 | 1 | PERF-01 | unit (RED) | `cd client && npx vitest run src/hooks/usePerformance.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-T2 | 07-01 | 1 | PERF-01 | unit (GREEN) | `cd client && npx vitest run src/hooks/usePerformance.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-T1 | 07-02 | 2 | PERF-02 | unit (RED) | `cd client && npx vitest run src/components/PerformancePanel.test.tsx` | ❌ W0 | ⬜ pending |
| 07-02-T2 | 07-02 | 2 | PERF-02 | unit (GREEN) | `cd client && npx vitest run src/components/PerformancePanel.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `client/src/hooks/usePerformance.test.ts` — covers PERF-01 (FPS, frame time, heap guard, PerformanceObserver, Zustand subscribe counter; mocks rAF + PerformanceObserver + performance.memory)
- [ ] `client/src/components/PerformancePanel.test.tsx` — covers PERF-02 (conditional mount, threshold colouring, toggle button)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FPS updates at ~60fps in live browser with 20k units | PERF-01 | Requires real rAF timing (jsdom has no frame budget) | Open app, open panel, observe FPS display over 5s |
| Panel closed = zero rAF/interval overhead | PERF-02 | Requires React DevTools profiler | Close panel, open React DevTools, confirm no renders |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-15
