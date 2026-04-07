---
phase: 04-live-petrol-price-integration
plan: "02"
subsystem: ui
tags: [fuel-prices, react, firestore, cost-breakdown, live-data, loading-skeleton]

# Dependency graph
requires:
  - phase: 04-live-petrol-price-integration/04-01
    provides: "src/utils/fuelPrices.ts — loadFuelPriceCache, fetchFuelPrices, saveFuelPriceCache, FALLBACK_PRICES, LiveFuelPrices"
provides:
  - "TripDetail wires fuelPrices.ts on mount: loads cache or fetches live, shows shimmer skeleton during load"
  - "CostBreakdown displays live petrol/diesel prices with est. label on fallback"
  - "Override toggle collapses manual price inputs by default; session-only, no Firestore write"
affects: [cost-calculation, trip-display, cost-breakdown]

# Tech tracking
tech-stack:
  added: []
  patterns: [fetch-on-mount-with-loading-state, session-only-override, live-price-display-with-fallback-label]

key-files:
  created: []
  modified:
    - src/pages/TripDetail.tsx
    - src/components/CostBreakdown.tsx

key-decisions:
  - "Override is session-only — handleUpdateFuelPrices calls setLiveFuelPrices (local state) not updateCostConfig (Firestore), per D-04"
  - "Fuel price useEffect depends on attendeeProfiles.length not the array ref — avoids re-fetch on every Firestore snapshot"
  - "saveFuelPriceCache guarded by currentUid === creatorUid — non-creator users cannot write to creator's Firestore document"
  - "est. label hidden when showOverride is true — user has deliberately entered a custom price, label would be misleading"
  - "Checkpoint Task 3 verified via TypeScript compilation + code review — live trip testing skipped (trip voting flow is pre-existing unrelated issue)"

patterns-established:
  - "Fuel price fetch: load cache first, fetch on miss, fall back on any error — mirrors driveCache.ts pattern from Plan 01"
  - "Loading skeleton: use existing .skeleton CSS class with inline height/marginBottom only — no inline animation or background"
  - "Live data override: always show live value prominently, collapse manual inputs behind toggle — follows D-03"

requirements-completed: [FUEL-COST]

# Metrics
duration: ~25min
completed: 2026-04-07
---

# Phase 04 Plan 02: Live Fuel Price Wiring Summary

**TripDetail now fetches live petrol/diesel prices on mount (Firestore cache or API) and CostBreakdown renders them with an "est." label on fallback and a collapsed session-only override toggle.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-07T08:00:00Z
- **Completed:** 2026-04-07
- **Tasks:** 3 (Tasks 1 + 2 implemented; Task 3 checkpoint approved via code review)
- **Files modified:** 2

## Accomplishments

- TripDetail loads live fuel prices on mount: checks Firestore cache first, fetches via fuelPrices.ts on miss, falls back to FALLBACK_PRICES ($2.30/$2.85) on any error
- Loading skeleton div with `.skeleton` class appears while prices are fetching; dismissed on completion
- CostBreakdown always shows live petrol and diesel prices in $/L format; "est." label appears when using national average fallback
- "Override" toggle collapses manual petrol/diesel inputs by default — tapping reveals inputs, tapping "Use live price" hides them again
- Override is session-only: `handleUpdateFuelPrices` calls `setLiveFuelPrices` (local component state), never `updateCostConfig` — no Firestore write
- Non-creator users see live prices but no Override toggle (`editable` is false for non-creators)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire fuel price fetch-on-mount into TripDetail.tsx** — `ca4234a` (feat)
2. **Task 2: Refactor CostBreakdown with live price display, est. label, override toggle** — `46a26fc` (feat)
3. **Task 3: Verify live fuel price integration end-to-end** — Checkpoint approved by user (code review + TypeScript compile; live testing skipped)

## Files Created/Modified

- `src/pages/TripDetail.tsx` — Added liveFuelPrices/fuelPricesLoading state, fuel price useEffect (cache-first fetch), replaced static costConfig.fuelPrices derivation with live-price-derived FuelPrices, updated handleUpdateFuelPrices to local-state-only, added skeleton div, passes priceIsEstimated to CostBreakdown
- `src/components/CostBreakdown.tsx` — Added priceIsEstimated prop, showOverride state, replaced always-visible inputs with live price display row + Override toggle + collapsible inputs

## Decisions Made

- **Override session-only (D-04):** `handleUpdateFuelPrices` was previously writing to Firestore via `updateCostConfig`. Changed to `setLiveFuelPrices` — override prices are never persisted.
- **attendeeProfiles.length dependency:** useEffect deps use `.length` not the array reference to prevent re-fetch on every Firestore snapshot update.
- **saveFuelPriceCache guard:** Only called when `!prices.isEstimated && currentUid === creatorUid` — prevents non-creator users writing to creator's Firestore document.
- **est. label hidden during override:** When `showOverride` is true the user has set a manual price; showing "est." alongside it would be misleading.
- **Checkpoint verification approach:** User approved checkpoint based on TypeScript compile pass + code review confirming implementation matches plan. Live browser testing skipped — trip voting flow (needed to get a confirmed trip in testable state) is a pre-existing unrelated issue.

## Deviations from Plan

None — plan executed exactly as written. The Task 1 and Task 2 commits were cherry-picked from worktree `worktree-agent-a776b3d0` (where the previous agent executed) into main, since the worktree's branch had not yet been merged.

## Issues Encountered

- The prior agent executed Tasks 1 and 2 in worktree `S:/Claude/routed/.claude/worktrees/agent-a776b3d0` but the commits were never merged into main. This continuation agent discovered the worktree, verified the commits (e9b2df9, f31edec in the worktree), and cherry-picked them into main as ca4234a and 46a26fc.

## User Setup Required

The `VITE_FUELPRICE_API_KEY` environment variable must be configured in Vercel for live prices to be fetched. Without it, `fetchFuelPrices` always returns `FALLBACK_PRICES` with `isEstimated: true`, so users will see "$2.30/L est." and "$2.85/L est." — functionally correct but not live data.

Steps:
1. Sign up at https://fuelprice.io and obtain an API key
2. Add `VITE_FUELPRICE_API_KEY=<your-key>` to Vercel project environment variables
3. Redeploy — live prices will then fetch on TripDetail mount for trips where the creator has a homeLocation suburb set

## Next Phase Readiness

- Live fuel price data layer (Plan 01) and UI wiring (Plan 02) are complete
- Cost calculation in `calculateCosts` now uses real petrol/diesel prices sourced from fuelprice.io
- Phase 04 is complete — any further fuel price work (e.g., per-user location, state-level pricing) would be a new phase

## Threat Surface

No new security surface beyond the threat model. All three threat register items mitigated:
- T-04-05 (Elevation of Privilege): handleUpdateFuelPrices changed to local state — no Firestore write
- T-04-06 (Tampering): saveFuelPriceCache guarded by `currentUid === creatorUid`
- T-04-07 (Information Disclosure): est. label is intentional per D-10

## Self-Check: PASSED

- `src/pages/TripDetail.tsx` — FOUND (modified, contains liveFuelPrices, fuelPricesLoading, loadFuelPriceCache)
- `src/components/CostBreakdown.tsx` — FOUND (modified, contains priceIsEstimated, showOverride)
- Commit ca4234a — FOUND (feat(04-02): wire live fuel price fetch-on-mount into TripDetail)
- Commit 46a26fc — FOUND (feat(04-02): refactor CostBreakdown with live price display, est. label, override toggle)
- `npx tsc --noEmit` — exits with 0, no errors

---
*Phase: 04-live-petrol-price-integration*
*Completed: 2026-04-07*
