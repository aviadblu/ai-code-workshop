---
phase: 8
slug: gaming-ui-theme
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-15
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `client/vitest.config.ts` |
| **Quick run command** | `cd client && npx vitest run src/components/KPIBar.test.tsx src/components/EventFeed.test.tsx src/components/UnitsPanel.test.tsx src/components/PerformancePanel.test.tsx` |
| **Full suite command** | `cd client && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx vitest run`
- **After every plan wave:** Run `cd client && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-T1 | 08-01 | 1 | UI-01 | regression | `cd client && npx vitest run` | ✅ existing | ⬜ pending |
| 08-01-T2 | 08-01 | 1 | UI-01 | regression | `cd client && npx vitest run` | ✅ existing | ⬜ pending |
| 08-02-T1 | 08-02 | 2 | UI-02 | regression | `cd client && npx vitest run src/components/EventFeed.test.tsx src/components/UnitsPanel.test.tsx src/components/PerformancePanel.test.tsx` | ✅ existing | ⬜ pending |
| 08-02-T2 | 08-02 | 2 | UI-03 | unit + regression | `cd client && npx vitest run src/components/KPIBar.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `client/src/components/KPIBar.test.tsx` — add `UI-03-f` test asserting `.pulse-value` class present on value spans (`element.className.includes('pulse-value')`)
- [ ] `client/src/index.css` — must be created in Plan 08-01 (Wave 0 artifact); imported in `main.tsx`

*All other test infrastructure already covers the regression surface.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Global CSS tokens visible (dark bg, green accent, monospace font) | UI-01 | CSS custom properties not resolved by jsdom | Open app, confirm `#0a0a0a` bg, `#00ff41` borders, monospace text |
| Scanline texture visible on all panels | UI-02 | CSS background-image gradient not rendered in jsdom | Open app, visually confirm fine horizontal scanlines on each panel |
| Amber pulse animation triggers on value changes | UI-03 | CSS @keyframes animation not executed in jsdom | Watch KPI bar during live updates, confirm values briefly flash amber |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-15
