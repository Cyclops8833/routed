---
phase: 04-live-petrol-price-integration
verified: 2026-04-07T00:00:00Z
status: human_needed
score: 6/7 must-haves verified
human_verification:
  - test: "Live fuel price display end-to-end"
    expected: "Open a confirmed trip in the browser. Fuel prices appear in CostBreakdown as '$2.30/L est.' (fallback, no API key set) or a real live price. An 'Override' link is visible to the trip creator. Tapping it reveals petrol/diesel inputs. Entering a price and navigating away then back resets to live/fallback price."
    why_human: "Requires a running dev server and a confirmed trip in Firestore. Cannot test browser rendering, animation (shimmer skeleton), or session-reset behaviour programmatically."
  - test: "Non-creator view — no Override toggle"
    expected: "Viewing the same trip as a non-creator user shows fuel prices but no 'Override' link."
    why_human: "Requires two test accounts and a browser session to verify the editable prop pathway."
---

# Phase 04: Live Petrol Price Integration — Verification Report

**Phase Goal:** Replace the manual `fuelPrices` field in trip `costConfig` with live average fuel prices fetched from an Australian petrol price API, keyed to each user's homebase suburb/postcode. Cache price per user for 24 hours in Firestore. Fuel cost in TripDetail and CostBreakdown reflects current market price.
**Verified:** 2026-04-07
**Status:** HUMAN NEEDED (all automated checks pass; human verification of browser rendering and session-only override behaviour outstanding)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | fetchFuelPrices returns petrol and diesel prices in $/L with isEstimated flag | VERIFIED | `fuelPrices.ts` line 176: `export async function fetchFuelPrices(suburb: string): Promise<LiveFuelPrices>` — returns `{ petrol, diesel, isEstimated: false }` on success, `FALLBACK_PRICES` (isEstimated: true) on any failure or missing env var |
| 2 | loadFuelPriceCache returns cached prices from Firestore if cachedAt is within 24 hours, null otherwise | VERIFIED | `fuelPrices.ts` lines 31–49: reads `users/{uid}`, calls `cache.cachedAt.toMillis()`, compares against `CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000`, returns null if stale |
| 3 | saveFuelPriceCache writes petrol, diesel, and cachedAt Timestamp to users/{uid}.fuelPriceCache | VERIFIED | `fuelPrices.ts` lines 59–67: `updateDoc(doc(db, 'users', uid), { fuelPriceCache: { petrol, diesel, cachedAt: Timestamp.now() } })` |
| 4 | TripDetail loads live fuel prices on mount from cache or API before computing costs | VERIFIED | `TripDetail.tsx` lines 221–254: useEffect with `loadFuelPriceCache(creatorUid)` → `fetchFuelPrices(suburb)` → `setLiveFuelPrices`; `fuelPrices` derived from `liveFuelPrices` at lines 290–293 and passed into `calculateCosts` at line 322 |
| 5 | Cost figures show a loading skeleton while fuel prices are being fetched | VERIFIED | `TripDetail.tsx` line 1242–1244: `{fuelPricesLoading && <div className="skeleton" style={{ height: '80px', marginBottom: '20px' }} />}` — uses existing `.skeleton` CSS class |
| 6 | CostBreakdown displays live prices with 'est.' suffix when using fallback and Override toggle collapses inputs by default | VERIFIED | `CostBreakdown.tsx` lines 492–499: `priceIsEstimated && !showOverride` gates `<span>est.</span>` for both petrol and diesel. Lines 503–521: Override button gated by `editable`, toggles `showOverride`. Lines 523–546: inputs gated by `showOverride && editable` |
| 7 | Override is session-only — does not write to Firestore | VERIFIED | `TripDetail.tsx` lines 355–358: `handleUpdateFuelPrices` calls `setLiveFuelPrices(...)` only — no `updateCostConfig` or Firestore write. Session-only by design per D-04. (Requires human verification that navigating away actually resets state.) |

**Score:** 7/7 truths verified via code inspection

Note: Truth 7 is verified at the code level (no Firestore write path exists in the handler) but the session-reset behaviour when navigating away cannot be confirmed without a running browser session.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/fuelPrices.ts` | Fuel price fetch, cache, and fallback utility | VERIFIED | 197 lines; exports `LiveFuelPrices`, `FALLBACK_PRICES`, `loadFuelPriceCache`, `saveFuelPriceCache`, `fetchFuelPrices`. Internal helpers: `resolveCity`, `tryFetchPrices`. |
| `src/types/index.ts` | UserProfile with fuelPriceCache field | VERIFIED | Lines 37–41: `fuelPriceCache?: { petrol: number; diesel: number; cachedAt: Timestamp }` present in `UserProfile` interface; Timestamp imported at line 1. |
| `src/pages/TripDetail.tsx` | Fuel price fetch-on-mount, loading state, live price integration | VERIFIED | Imports from `fuelPrices.ts` at lines 20–21; `liveFuelPrices` and `fuelPricesLoading` state at lines 164–165; useEffect at lines 221–254; `fuelPrices` and `priceIsEstimated` derived at lines 290–293; skeleton at line 1243; `priceIsEstimated` prop passed at line 1254. |
| `src/components/CostBreakdown.tsx` | Live price display, est. label, override toggle, session-only inputs | VERIFIED | `priceIsEstimated?: boolean` prop at line 16; destructured with default `false` at line 155; `showOverride` state at line 164; live display with est. label at lines 490–501; Override button at lines 504–521; collapsed inputs at lines 523–546. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pages/TripDetail.tsx` | `src/utils/fuelPrices.ts` | `import { loadFuelPriceCache, fetchFuelPrices, saveFuelPriceCache, FALLBACK_PRICES }` | WIRED | Lines 20–21 of TripDetail.tsx; all four named imports confirmed used in the fuel price useEffect |
| `src/pages/TripDetail.tsx` | `src/components/CostBreakdown.tsx` | `priceIsEstimated={priceIsEstimated}` prop | WIRED | TripDetail line 1254 passes prop; CostBreakdown line 16 declares it, line 155 destructures it |
| `src/pages/TripDetail.tsx` | `src/utils/costEngine.ts` | `calculateCosts` receives `fuelPrices` derived from `liveFuelPrices` | WIRED | `fuelPrices` at lines 290–292 is derived from `liveFuelPrices`; passed to `calculateCosts` at line 322 |
| `src/utils/fuelPrices.ts` | Firestore `users/{uid}` | `getDoc` / `updateDoc` on user document | WIRED | Lines 33 (`getDoc`) and 64 (`updateDoc`) confirmed present |
| `src/utils/fuelPrices.ts` | fuelprice.io API | `fetch` in `tryFetchPrices` with API key | WIRED | Lines 93–98 (legacy endpoint), lines 124–137 (v1 endpoint); reads `VITE_FUELPRICE_API_KEY` at line 178 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `TripDetail.tsx` — cost section | `fuelPrices` / `breakdown` | `liveFuelPrices` state ← `loadFuelPriceCache` (Firestore) or `fetchFuelPrices` (API) | Yes — when `VITE_FUELPRICE_API_KEY` is set; FALLBACK_PRICES ($2.30/$2.85) when not set (isEstimated: true) | FLOWING (graceful degradation to fallback when API key absent) |
| `CostBreakdown.tsx` — fuel price row | `fuelPrices.petrol` / `fuelPrices.diesel` | Prop from TripDetail | Yes — populated by live fetch or fallback | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles with zero errors | `npx tsc --noEmit` | Exit 0, no output | PASS |
| `fuelPrices.ts` exports all required symbols | `grep -c "export" src/utils/fuelPrices.ts` | 5 export statements (LiveFuelPrices, FALLBACK_PRICES, loadFuelPriceCache, saveFuelPriceCache, fetchFuelPrices) | PASS |
| `UserProfile.fuelPriceCache` present in types | `grep "fuelPriceCache" src/types/index.ts` | Found at line 37 | PASS |
| Static `costConfig.fuelPrices` derivation removed | `grep "costConfig?.fuelPrices" src/pages/TripDetail.tsx` | Not found (removed per plan) | PASS |
| `updateCostConfig` still exists (used by other handlers) | `grep "function updateCostConfig" src/pages/TripDetail.tsx` | Found at line 328 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FUEL-API | 04-01 | Fetch live average Australian fuel prices from a national API keyed to trip creator's suburb | SATISFIED | `fuelPrices.ts` implements dual-endpoint fetch against fuelprice.io with `VITE_FUELPRICE_API_KEY`; graceful fallback to `FALLBACK_PRICES` on failure or missing key |
| FUEL-CACHE | 04-01 | Cache fuel price per user for 24 hours in Firestore, embedded in `users/{uid}` | SATISFIED | `loadFuelPriceCache` reads and validates 24h staleness; `saveFuelPriceCache` writes with `Timestamp.now()`; both operate on `users/{uid}.fuelPriceCache` |
| FUEL-COST | 04-02 | Fuel cost in TripDetail and CostBreakdown reflects live/cached price; fallback with "est." label | SATISFIED | `calculateCosts` receives `fuelPrices` derived from `liveFuelPrices`; CostBreakdown renders prices with `est.` label when `priceIsEstimated && !showOverride` |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/utils/fuelPrices.ts` | 178 | Reads `VITE_FUELPRICE_API_KEY` — PLAN specified `VITE_SERVO_SAVER_CONSUMER_ID` and Servo Saver API | INFO | API choice deviated from final PLAN spec but aligns with RESEARCH primary recommendation (fuelprice.io). SUMMARY documents the change. No functional impact — fallback path works correctly in both cases. |

No stub patterns, empty returns, or unconnected state found.

---

### Human Verification Required

#### 1. End-to-end live fuel price display

**Test:** Run `npm run dev`, open an existing confirmed trip as the trip creator.
**Expected:** Fuel prices appear in the CostBreakdown section as "$2.30/L est." and "$2.85/L est." (since no API key is configured). An "Override" link is visible below the prices. Tapping "Override" reveals petrol and diesel input fields. The cost breakdown updates when override prices are entered. Tapping "Use live price" hides the inputs again.
**Why human:** Requires a running dev server, a confirmed trip in Firestore, and visual confirmation of rendering and interaction.

#### 2. Session-only override reset on navigation

**Test:** Enter a custom price via the Override inputs (e.g. $3.00 petrol). Navigate to another page (e.g. the map), then navigate back to the same trip.
**Expected:** Fuel prices have reset to the live/fallback values ($2.30/L est.). The custom override price is gone.
**Why human:** Component unmount/remount behaviour on navigation requires a running browser session to confirm.

#### 3. Non-creator view — Override toggle absent

**Test:** View the same confirmed trip as a user who is not the trip creator.
**Expected:** Fuel prices display correctly but no "Override" link is visible.
**Why human:** Requires a second test account and browser session.

#### 4. Loading skeleton visibility

**Test:** On a slow connection (or with network throttling), load TripDetail for a trip whose creator has no Firestore fuel price cache (or where the 24h cache has expired).
**Expected:** A shimmer skeleton placeholder (~80px tall) appears briefly in the cost section before the CostBreakdown renders.
**Why human:** Skeleton is only visible during the async fetch window; requires timing/network throttling.

---

### Gaps Summary

No blocking gaps found. All seven observable truths are verified at the code level. TypeScript compiles cleanly. The four human verification items above represent browser-testable behaviours that cannot be confirmed programmatically.

**API deviation (INFO, non-blocking):** The executed plan uses `fuelprice.io` with `VITE_FUELPRICE_API_KEY`, while the final Plan 04-01 spec describes the Servo Saver API with `VITE_SERVO_SAVER_CONSUMER_ID`. The RESEARCH.md document lists fuelprice.io as the primary recommendation and Servo Saver as a secondary option. The SUMMARY documents this deviation and confirms the implementation is intentional. The fallback path (`FALLBACK_PRICES`) works correctly regardless of which API key is configured, so there is no user-visible regression.

---

_Verified: 2026-04-07_
_Verifier: Claude (gsd-verifier)_
