---
phase: 9
slug: interactive-tactical-map
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-15
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `client/vitest.config.ts` |
| **Quick run command** | `cd client && npx vitest run src/components/TacticalMap.test.tsx` |
| **Full suite command** | `cd client && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx vitest run src/components/TacticalMap.test.tsx`
- **After every plan wave:** Run `cd client && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-T1 | 09-01 | 1 | MAP-04 | unit (RED) | `cd client && npx vitest run src/components/TacticalMap.test.tsx` | ❌ W0 | ⬜ pending |
| 09-01-T2 | 09-01 | 1 | MAP-04 | unit (GREEN) | `cd client && npx vitest run src/components/TacticalMap.test.tsx` | ❌ W0 | ⬜ pending |
| 09-01-T3 | 09-01 | 1 | MAP-05 | unit (RED) | `cd client && npx vitest run src/components/TacticalMap.test.tsx` | ❌ W0 | ⬜ pending |
| 09-01-T4 | 09-01 | 1 | MAP-05 | unit (GREEN) | `cd client && npx vitest run src/components/TacticalMap.test.tsx` | ❌ W0 | ⬜ pending |
| 09-02-T1 | 09-02 | 2 | MAP-06 | unit (RED) | `cd client && npx vitest run src/components/TacticalMap.test.tsx` | ❌ W0 | ⬜ pending |
| 09-02-T2 | 09-02 | 2 | MAP-06 | unit (GREEN) | `cd client && npx vitest run src/components/TacticalMap.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Augment `client/src/components/TacticalMap.test.tsx` — add MAP-04/05/06 describe blocks; extend `mockCtx` to include `save`, `restore`, `translate`, `scale` as `vi.fn()` stubs
- [ ] If pure math extracted to `mapTransform.ts`: create `client/src/components/mapTransform.test.ts` — pure function tests (no canvas mock, no React, no rAF mock needed)

*No framework changes needed — existing `vitest.config.ts` with jsdom + globals covers all new tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mouse wheel zooms map smoothly at 60fps during live updates | MAP-04 | rAF timing + real mouse events not available in jsdom | Open app, scroll wheel on map, confirm smooth zoom centered on cursor |
| Drag pan moves map; cannot drag fully off-screen | MAP-05 | Real mouse drag requires browser | Open app, drag map, confirm constrained panning |
| R key resets to full view | MAP-06 | Keyboard + DOM focus not testable in isolation | Open app, zoom in, press R, confirm map fits canvas |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-15
