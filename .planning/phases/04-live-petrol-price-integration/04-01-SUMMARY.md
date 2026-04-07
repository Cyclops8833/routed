---
phase: 04-live-petrol-price-integration
plan: "01"
subsystem: fuel-price-utility
tags: [fuel-prices, firestore, api-integration, caching, fallback]
dependency_graph:
  requires: []
  provides: [src/utils/fuelPrices.ts, UserProfile.fuelPriceCache]
  affects: [src/types/index.ts]
tech_stack:
  added: []
  patterns: [dual-endpoint-fallback, firestore-cache, vite-env-vars]
key_files:
  created:
    - src/utils/fuelPrices.ts
  modified:
    - src/types/index.ts
decisions:
  - "resolveCity always returns Melbourne — all Routed users are Victorian, regional variance not worth complexity (D-02)"
  - "FALLBACK_PRICES set to post-April-2026-excise-cut values: $2.30 petrol, $2.85 diesel (D-09)"
  - "fuelPriceCache.cachedAt uses Firestore Timestamp (not number like driveCache) for .toMillis() staleness check (D-12)"
  - "24h cache max age prevents repeated API calls and manages rate-limit risk (D-13)"
  - "Dual-endpoint strategy: legacy query-string format first, then v1 RESTful format — endpoint certainty requires live key test"
metrics:
  duration: "~2 min"
  completed: "2026-04-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 04 Plan 01: Fuel Price Utility — Data Layer Summary

**One-liner:** Firestore-cached fuelprice.io integration with dual-endpoint fallback returning live Melbourne petrol/diesel prices in dollars-per-litre.

## What Was Built

Two changes constitute the data layer for live fuel prices:

**`src/types/index.ts`** — `UserProfile` now carries an optional `fuelPriceCache` field typed with Firestore `Timestamp` for the `cachedAt` field. This enables `.toMillis()` staleness checks in the utility.

**`src/utils/fuelPrices.ts`** — A standalone utility mirroring the `driveCache.ts` pattern. Exports:
- `LiveFuelPrices` interface (petrol, diesel as dollars-per-litre, isEstimated flag)
- `FALLBACK_PRICES` constant ($2.30 petrol, $2.85 diesel — post-April-2026-excise-cut national averages)
- `loadFuelPriceCache(uid)` — reads Firestore, validates 24h freshness via `cachedAt.toMillis()`
- `saveFuelPriceCache(uid, petrol, diesel)` — writes to `users/{uid}.fuelPriceCache` with `Timestamp.now()`
- `fetchFuelPrices(suburb)` — dual-endpoint fetch (legacy then v1) with graceful fallback

Internal helpers (not exported):
- `resolveCity()` — always returns `'Melbourne'` (D-02: all users are Victorian)
- `tryFetchPrices()` — attempts legacy `fuelprice.io/api/` endpoint first, then `api.fuelprice.io/v1/` endpoint; validates `typeof === 'number' && > 0` on all response values before use

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add fuelPriceCache to UserProfile | 907e3c3 | src/types/index.ts |
| 2 | Create fuelPrices.ts utility | 6174127 | src/utils/fuelPrices.ts |

## Verification

- `npx tsc --noEmit` exits with 0 — no type errors
- All 18 Task 2 acceptance criteria verified via grep checks
- Both endpoint strategies (legacy and v1) implemented with bounded failure — max 4 HTTP requests before fallback
- FALLBACK_PRICES used when: API key missing, network error, unexpected response shape, or any unhandled exception

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `fetchFuelPrices` returns real data when `VITE_FUELPRICE_API_KEY` is set. The `VITE_FUELPRICE_API_KEY` environment variable must be configured in Vercel before Plan 02 wires this into TripDetail. Until then, `FALLBACK_PRICES` is returned with `isEstimated: true`.

## User Setup Required

Before Plan 02 wires this utility into TripDetail, the user must:
1. Sign up at https://fuelprice.io and obtain an API key
2. Test the key against both endpoint formats to confirm which is live
3. Add `VITE_FUELPRICE_API_KEY` to Vercel project environment variables

## Threat Flags

No new security-relevant surface beyond what the threat model covers.

The plan's `T-04-02` mitigation (validate response shape) is fully implemented: `typeof ... === 'number' && ... > 0` checks applied to all API response values before use in both endpoint branches.

## Self-Check: PASSED

- `src/utils/fuelPrices.ts` — FOUND
- `src/types/index.ts` (modified) — FOUND
- Commit 907e3c3 — verified in git log
- Commit 6174127 — verified in git log
