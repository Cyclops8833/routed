---
phase: 4
slug: live-petrol-price-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | FUEL-API | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | FUEL-CACHE | — | Cache write only when currentUid === creatorUid | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 2 | FUEL-COST | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/fuelPrice.test.ts` — stubs for FUEL-API, FUEL-CACHE, FUEL-COST
- [ ] Existing vitest infrastructure confirmed present — no new framework install needed

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live price appears in CostBreakdown on TripDetail load | FUEL-API | Requires real API key and network | Open TripDetail on a trip with a creator who has a homebase suburb; verify fuel price displays within 2s |
| Override toggle collapses/expands correctly | FUEL-COST | Visual UI interaction | Tap "Override" in CostBreakdown; verify inputs appear; navigate away and return; verify live price shown again |
| "est." label shown when API fallback used | FUEL-API | Requires simulating API failure | Disable network or use invalid API key; verify "est." label appears next to fuel price |
| 24h cache served on repeat load | FUEL-CACHE | Requires time manipulation | Load TripDetail; note cachedAt in Firestore; reload within 24h; verify no new API call made |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
