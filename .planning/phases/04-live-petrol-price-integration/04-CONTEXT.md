# Phase 4: Live petrol price integration - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the hardcoded/manual `fuelPrices` field in trip `costConfig` with live average Australian petrol prices fetched from a national API, keyed to the trip creator's homebase suburb. Fuel cost in TripDetail and CostBreakdown reflects current market price, cached per user for 24 hours in Firestore. No new backend runtime required — pure client-side fetch with Firestore caching.

</domain>

<decisions>
## Implementation Decisions

### Pricing strategy
- **D-01:** Use the **trip creator's** live price as the shared `FuelPrices` for the entire trip — one Firestore fetch, no interface change to `calculateCosts`. Do NOT implement per-member prices.
- **D-02:** Rationale: all crew are Victorian; regional variance is 10-15c/L, which translates to a few dollars difference per person on a typical trip — not worth the added complexity. The real per-member cost difference already lives in vehicle fuel consumption (L/100km), which is already implemented.

### Manual override UX
- **D-03:** Replace the always-visible editable inputs in CostBreakdown with a **live price display + Override toggle**. The toggle is collapsed by default (live price shown). Tapping "Override" reveals the petrol/diesel inputs.
- **D-04:** Override is **session-only** — it does NOT save to Firestore. Override state lives in component local state only. If the user navigates away and returns, the live price is shown again.
- **D-05:** Rationale: fuel prices fluctuate and bowser prices don't always match API averages (e.g. a member filling up at $2.10/L vs a live-fetched $1.98). The hidden override keeps the UI clean while preserving the escape hatch.

### Fetch trigger
- **D-06:** Fetch (or serve from 24h Firestore cache) on **TripDetail page load** — when the component mounts, before costs are calculated.
- **D-07:** Show a loading/skeleton state on the cost figures while the fetch is in flight. The 24h cache means this loading state fires at most once per day per user.
- **D-08:** Do NOT fetch on MapPage startup — this would compound an already-loaded startup sequence (driveCache build + Mapbox batch calls) for a value only consumed in TripDetail.

### Fallback behavior
- **D-09:** If the API fails, is rate-limited, or has no data for the user's suburb: fall back to a hardcoded **national average** (exact values TBD by planner — approximately $2.05 petrol, $2.10 diesel based on 2024 AU averages).
- **D-10:** When using the fallback, surface an **"est."** label inline next to the fuel price in CostBreakdown (e.g. "Petrol: $2.05/L est."). This requires a `priceIsEstimated: boolean` prop threaded from the fetch layer through TripDetail to CostBreakdown.
- **D-11:** No warning banner — an inline label matches the app's error posture (silent catch + console.error) and avoids visual noise on mobile.

### Firestore cache structure
- **D-12:** Follow the existing `driveCache` pattern: embed fuel price cache in the `users/{uid}` document. Suggested fields: `fuelPriceCache: { petrol: number, diesel: number, cachedAt: Timestamp }`. No new Firestore collection needed.
- **D-13:** Cache expiry check: if `cachedAt` is older than 24 hours, re-fetch. Otherwise serve from cache.

### Claude's Discretion
- Exact API chosen — FUEL-API requirement says "researched during plan phase"; researcher picks the best available Australian petrol price API (FuelCheck NSW, FuelWatch WA, GLD, or third-party aggregator)
- Exact national average fallback values (researcher will confirm current AU averages)
- Loading skeleton design in TripDetail cost section
- Exact label wording for "est." (e.g. "est." vs "~" vs "approx")
- Whether the Firestore cache write uses `updateDoc` (merging into existing user doc) or `setDoc` with merge flag

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Cost calculation (primary change surface)
- `src/utils/costEngine.ts` — `calculateCosts()` function and `FuelPrices` interface. Phase 4 passes the trip creator's live-fetched price into this function's existing `fuelPrices` param — no signature change needed.
- `src/pages/TripDetail.tsx` lines 250–313 — where `fuelPrices` is read from `costConfig` (line 250), where `calculateCosts` is called (line 279), and where `updateCostConfig` saves back to Firestore (lines 285–313). The fetch trigger and cache read belong here.
- `src/components/CostBreakdown.tsx` — editable `localPetrol`/`localDiesel` inputs and `onUpdateFuelPrices` callback. These inputs become the hidden override section; `priceIsEstimated` prop threads in here.

### Types
- `src/types/index.ts` — `Trip` interface with `costConfig?: { fuelPrices, dailyFoodRate, lineItems }`. The `fuelPriceCache` field added to `UserProfile` also belongs here.

### Firestore cache pattern to mirror
- `src/utils/driveCache.ts` — `buildDriveCache()`, `saveDriveCache()`, and the cache staleness check. Fuel price cache should follow the same embed-in-user-doc pattern.
- `src/types/index.ts` — `UserProfile` interface (add `fuelPriceCache` field here alongside `driveCache`).

### Also uses fuelPrices (out of Phase 4 scope — note only)
- `src/components/TripSheet.tsx` line 135 — `rankDestinations` called with hardcoded `{ petrol: 2.1, diesel: 2.0 }`. Phase 4 does NOT touch this. Noted for a future phase.
- `src/components/DestinationCard.tsx` line 73 — uses hardcoded default `{ petrol: 1.90, diesel: 1.85 }`. Phase 4 does NOT touch this.
- `src/utils/rankDestinations.ts` lines 156, 228–231 — consumes fuelPrices for destination scoring. Phase 4 does NOT touch this.

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `users/{uid}` Firestore document — already has `driveCache` and `driveCacheLocation` embedded in it; adding `fuelPriceCache: { petrol, diesel, cachedAt }` follows the same pattern with no new collection
- `updateDoc(doc(db, 'users', uid), { fuelPriceCache: ... })` — the write pattern is identical to how `saveDriveCache` persists the drive cache
- `onAuthStateChanged` called directly in TripDetail (line ~240) already provides `uid` for the Firestore read/write without a prop

### Established Patterns
- Firestore cache pattern: embed in user document, check `cachedAt` timestamp before deciding to re-fetch (see `driveCache.ts`)
- Async data loading in TripDetail: the page already has multiple `onSnapshot` subscriptions that load and set state on mount — the fuel price fetch fits the same pattern, can use `useEffect` + local state (`fuelPrices` + `priceIsEstimated`)
- CostBreakdown currently receives `fuelPrices` as a prop and manages `localPetrol`/`localDiesel` state internally — the live price becomes the prop default, the override inputs become conditionally rendered inside the existing editable block

### Integration Points
- `TripDetail.tsx` is where the fetch trigger and cache read live — `attendeeProfiles` is already loaded here (Phase 2 fix), so creator UID is accessible from `trip.creatorUid`
- `CostBreakdown.tsx` receives `fuelPrices` + new `priceIsEstimated: boolean` prop; adds an override toggle inside the existing editable section
- `types/index.ts` `UserProfile` — needs a `fuelPriceCache?: { petrol: number, diesel: number, cachedAt: string }` field added

</code_context>

<specifics>
## Specific Ideas

- User's crew are all Victorian — regional price variance (~10-15c/L) doesn't justify per-member price maps. Shared price is the right call.
- The manual override was kept because bowser prices don't always match API averages: "if Woody filled up at a servo that was $2.10/L he can adjust it". Override must remain accessible but hidden by default.
- Override is intentionally session-only — user expectation is "correct this trip, this time", not "permanently override the live price".

</specifics>

<deferred>
## Deferred Ideas

- **Live prices into TripSheet ranking**: `src/components/TripSheet.tsx` line 135 calls `rankDestinations` with hardcoded prices `{ petrol: 2.1, diesel: 2.0 }`. Phase 4 does not touch this — future phase to plumb live prices into destination ranking.
- **Per-member price maps**: Would improve accuracy for mixed-state groups. Not needed for current all-Victorian crew. Revisit if the app expands to interstate users.
- **DestinationCard default hardcoded price**: `src/components/DestinationCard.tsx` line 73 uses `{ petrol: 1.90, diesel: 1.85 }` — update alongside ranking in a future phase.

</deferred>

---

*Phase: 04-live-petrol-price-integration*
*Context gathered: 2026-04-06*
