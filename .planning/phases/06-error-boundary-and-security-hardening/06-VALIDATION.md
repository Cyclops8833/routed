---
phase: 6
slug: error-boundary-and-security-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — TypeScript build (`tsc`) is the primary static check |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build` + grep checks for removed patterns
- **Before `/gsd-verify-work`:** Build green + all manual verifications checked
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 06-01-T1 | 01 | 1 | SEC-BOUNDARY | Class component with getDerivedStateFromError/componentDidCatch; recovery screen with topo-bg + Reload | Static | `npm run build` | ⬜ pending |
| 06-01-T2 | 01 | 1 | SEC-RULES | firestore.rules and firebase.json exist in repo root with uid guards | Static | `ls firestore.rules firebase.json && grep "creatorUid" firestore.rules` | ⬜ pending |
| 06-01-T3 | 01 | 1 | SEC-RULES | Firebase rules deployed (checkpoint — informational) | Manual | Firebase console or CLI | ⬜ pending |
| 06-02-T1 | 02 | 1 | SEC-BRIDGE | window.__routedPlanTrip no longer referenced; popup button works via popup.on('open') | Static | `npm run build && ! grep -r "__routedPlanTrip" src/` | ⬜ pending |
| 06-02-T2 | 02 | 1 | SEC-TOKEN | No import.meta.env.VITE_MAPBOX_TOKEN in src/pages/ | Static | `npm run build && ! grep -r "import.meta.env.VITE_MAPBOX_TOKEN" src/pages/` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — `npm run build` is sufficient. No test files need creating.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recovery screen shows on crash | SEC-BOUNDARY | Requires browser render + simulated error | Open /map in browser, throw error from React DevTools or console (`__reactFiber` trick), confirm recovery screen appears with "Routed" wordmark and reload button |
| Firestore write guard enforced | SEC-RULES | Requires deployed rules + Firebase auth context | Use Firebase Rules Playground in console, or test from browser with unauthenticated client attempting write |
| Popup button opens trip sheet | SEC-BRIDGE | Requires live Mapbox map in browser | Click destination dot on map, click "Plan a trip here" → TripSheet/QuickPlanSheet opens with destination pre-selected |
| Geocoding still works in Onboarding + Profile | SEC-TOKEN | Requires browser + Mapbox API call | Go through onboarding geocode step; go to Profile > edit location; confirm autocomplete still returns results |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or are marked Manual-Only
- [ ] `npm run build` is the per-task sampling command
- [ ] Wave 0 is N/A — no new test infrastructure needed
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
