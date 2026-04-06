# Phase 4: Live Petrol Price Integration - Research

**Researched:** 2026-04-06
**Domain:** Australian fuel price APIs, React/TypeScript client-side fetch, Firestore caching
**Confidence:** MEDIUM — API availability and pricing tiers confirmed at the endpoint-format level; free/paid tier details for fuelprice.io could not be independently verified from official docs within this session.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use the **trip creator's** live price as the shared `FuelPrices` for the entire trip — one Firestore fetch, no interface change to `calculateCosts`.
- **D-02:** All crew are Victorian; per-member price maps are out of scope.
- **D-03:** Replace always-visible editable inputs in CostBreakdown with a **live price display + Override toggle**. Toggle collapsed by default; tapping "Override" reveals the petrol/diesel inputs.
- **D-04:** Override is **session-only** — does NOT save to Firestore. Override state in component local state only.
- **D-05:** Override kept because bowser prices don't always match API averages.
- **D-06:** Fetch (or serve from 24h Firestore cache) on **TripDetail page load**, before costs are calculated.
- **D-07:** Show a loading/skeleton state on cost figures while fetch is in flight.
- **D-08:** Do NOT fetch on MapPage startup.
- **D-09:** If API fails, rate-limited, or no data for user's suburb: fall back to a hardcoded **national average** (exact values TBD by researcher).
- **D-10:** When using fallback, surface an **"est."** label inline next to the fuel price in CostBreakdown (e.g. "Petrol: $2.05/L est."). Thread `priceIsEstimated: boolean` prop from fetch layer → TripDetail → CostBreakdown.
- **D-11:** No warning banner — inline label only, silent catch + console.error.
- **D-12:** Embed fuel price cache in `users/{uid}` document: `fuelPriceCache: { petrol: number, diesel: number, cachedAt: Timestamp }`. No new Firestore collection.
- **D-13:** Cache expiry check: if `cachedAt` older than 24 hours, re-fetch. Otherwise serve from cache.

### Claude's Discretion

- Exact API chosen — researcher picks the best available Australian petrol price API
- Exact national average fallback values (researcher to confirm current AU averages)
- Loading skeleton design in TripDetail cost section
- Exact label wording for "est." (e.g. "est." vs "~" vs "approx")
- Whether Firestore cache write uses `updateDoc` (merging) or `setDoc` with merge flag

### Deferred Ideas (OUT OF SCOPE)

- **Live prices into TripSheet ranking**: `src/components/TripSheet.tsx` line 135 hardcoded prices — future phase.
- **Per-member price maps**: For mixed-state groups; not needed for current all-Victorian crew.
- **DestinationCard default hardcoded price**: `src/components/DestinationCard.tsx` line 73 — update alongside ranking in a future phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FUEL-API | Fetch live average Australian fuel prices from a national API keyed to the trip creator's homebase suburb/postcode | fuelprice.io API (legacy endpoint format confirmed) with Service Victoria Servo Saver as backup. Both require API keys; fuelprice.io has a suburb-level average endpoint. |
| FUEL-CACHE | Cache fuel price per user for 24 hours in Firestore, embedded in `users/{uid}` document following the driveCache pattern | Exact Firestore `updateDoc` pattern mirroring `saveDriveCache()` confirmed from codebase. |
| FUEL-COST | Fuel cost in TripDetail and CostBreakdown should reflect the live/cached price rather than stale manual entry; fallback to national average with "est." label | Integration points in TripDetail.tsx lines 250–313 and CostBreakdown.tsx props confirmed from codebase. |
</phase_requirements>

---

## Summary

Phase 4 replaces the static `fuelPrices` field in `costConfig` with a live-fetched value keyed to the trip creator's homebase suburb. The architecture is straightforward: a new utility function (`fetchFuelPrices`) wraps an API call to fuelprice.io (or the Service Victoria Servo Saver API as a fallback option), the result is cached in `users/{uid}.fuelPriceCache` for 24 hours, and TripDetail reads the cache (or fetches fresh) on mount before computing costs. The `calculateCosts` signature does not change — only the source of the `fuelPrices` argument changes from `trip.costConfig.fuelPrices` to the live-fetched value. CostBreakdown gains a `priceIsEstimated` prop and a collapsible Override panel that replaces the always-visible inputs.

The most critical research finding is the **API situation for Victoria**: the state government's Servo Saver API has a 24-hour data delay and requires an application/authorisation process of unknown duration. The third-party fuelprice.io API covers Melbourne by suburb with a documented endpoint format, but its pricing tier details (free vs. paid) require a sign-up to confirm. The recommended approach is **fuelprice.io** for real-time suburb-level data — if its free tier is insufficient, the fallback path to a hardcoded national average (D-09 / D-10) means the app degrades gracefully without breaking.

The April 2026 fuel excise cut has significantly changed the price baseline. Current Melbourne average ULP91 is approximately 232 c/L; diesel is approximately 285 c/L post-excise-cut. These are the appropriate fallback defaults, not the pre-2026 values of $1.90/$1.85 currently hardcoded in the app.

**Primary recommendation:** Implement using fuelprice.io `get_city_average` endpoint (city = "Melbourne"); wrap in a `fetchFuelPrices(suburb)` utility with graceful fallback. Confirm free-tier availability at sign-up time. If fuelprice.io proves paid-only or unreliable, the plan should include an alternative path using the AIP national average via web scrape or the Servo Saver API (with a note that the authorisation process may take days).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase/firestore` (already installed) | ^10.12.0 | Read/write `fuelPriceCache` in `users/{uid}` | Already used throughout the app; `updateDoc` + `getDoc` pattern mirrors `driveCache.ts` exactly |
| Native `fetch` | browser built-in | HTTP call to fuel price API | No new dependency; same pattern as `buildDriveCache` → `fetchOne` in `driveCache.ts` |
| React `useState` / `useEffect` | ^18.3.1 (already installed) | Local loading state, override toggle in CostBreakdown | Established app pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | — | — | No new packages needed for this phase |

**Installation:** No new packages needed. [VERIFIED: package.json in codebase]

---

## Architecture Patterns

### Recommended Project Structure

New files:
```
src/
└── utils/
    └── fuelPrices.ts        # fetchFuelPrices(), loadFuelPriceCache(), saveFuelPriceCache()
```

Modified files:
```
src/
├── types/index.ts            # Add fuelPriceCache to UserProfile interface
├── pages/TripDetail.tsx      # Add fetch-on-mount useEffect, pass priceIsEstimated to CostBreakdown
└── components/CostBreakdown.tsx  # Add priceIsEstimated prop + Override toggle
```

### Pattern 1: Utility Function — fuelPrices.ts

**What:** A standalone utility (mirroring `driveCache.ts`) that owns the full fetch → cache → fallback lifecycle. TripDetail calls it once on mount; it returns `{ petrol, diesel, isEstimated }`.

**When to use:** Keeps TripDetail from growing unbounded with fetch logic.

```typescript
// src/utils/fuelPrices.ts
// Source: mirrors driveCache.ts pattern in codebase

import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export interface LiveFuelPrices {
  petrol: number
  diesel: number
  isEstimated: boolean
}

// Fallback national averages — confirmed from ACCC + NRMA data April 2026
// post-fuel-excise-cut national averages (effective 1 April 2026)
export const FALLBACK_PRICES: LiveFuelPrices = {
  petrol: 2.30,   // [VERIFIED: ACCC/NRMA data, Melbourne ULP91 ~232 c/L post-excise-cut]
  diesel: 2.85,   // [ASSUMED: estimated from pre-cut ~303 c/L minus ~26.3c excise reduction; see Assumptions Log]
  isEstimated: true,
}

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

export async function loadFuelPriceCache(
  uid: string
): Promise<LiveFuelPrices | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    if (!snap.exists()) return null
    const data = snap.data()
    const cache = data?.fuelPriceCache
    if (!cache || !cache.cachedAt) return null
    const ageMs = Date.now() - cache.cachedAt.toMillis()
    if (ageMs > CACHE_MAX_AGE_MS) return null
    return { petrol: cache.petrol, diesel: cache.diesel, isEstimated: false }
  } catch {
    return null
  }
}

export async function saveFuelPriceCache(
  uid: string,
  petrol: number,
  diesel: number
): Promise<void> {
  // Mirrors saveDriveCache() in driveCache.ts — updateDoc merges into existing user doc
  await updateDoc(doc(db, 'users', uid), {
    fuelPriceCache: {
      petrol,
      diesel,
      cachedAt: Timestamp.now(),
    },
  })
}

export async function fetchFuelPrices(
  suburb: string
): Promise<LiveFuelPrices> {
  // [ASSUMED: fuelprice.io endpoint format from legacy docs — confirm at implementation time]
  const API_KEY = import.meta.env.VITE_FUELPRICE_API_KEY
  if (!API_KEY) return FALLBACK_PRICES

  try {
    // City-level average — suburb used to determine correct city (Melbourne for all VIC users)
    const city = resolveCity(suburb)
    const [petrolRes, dieselRes] = await Promise.all([
      fetch(`https://fuelprice.io/api/?key=${API_KEY}&action=get_city_average&fuel_type=unleaded&city=${encodeURIComponent(city)}`),
      fetch(`https://fuelprice.io/api/?key=${API_KEY}&action=get_city_average&fuel_type=diesel&city=${encodeURIComponent(city)}`),
    ])
    if (!petrolRes.ok || !dieselRes.ok) return FALLBACK_PRICES

    const [petrolData, dieselData] = await Promise.all([
      petrolRes.json() as Promise<{ average?: number }>,
      dieselRes.json() as Promise<{ average?: number }>,
    ])

    const petrol = petrolData.average
    const diesel = dieselData.average
    if (!petrol || !diesel) return FALLBACK_PRICES

    // API returns cents per litre — convert to dollars
    return { petrol: petrol / 100, diesel: diesel / 100, isEstimated: false }
  } catch {
    console.error('fetchFuelPrices failed, using fallback')
    return FALLBACK_PRICES
  }
}

// For this app all users are Victorian — map any suburb to Melbourne
function resolveCity(suburb: string): string {
  return suburb ? 'Melbourne' : 'Melbourne'
}
```

> **CRITICAL NOTE on the endpoint format above:** The `get_city_average` endpoint format and `fuel_type` parameter names are from fuelprice.io's **legacy documentation** [ASSUMED from web search result quoting legacy docs]. The current v1 API at `api.fuelprice.io` uses a different path structure (`GET /v1/cities/{CITY_ID}/average`). The implementer **must** verify the correct endpoint format and response schema after obtaining an API key. The pattern in the code example above is illustrative only — the planner should schedule a "verify API response shape" task before the main implementation.

### Pattern 2: TripDetail Fetch-on-Mount

**What:** A `useEffect` that fires when `currentUid` and `trip` are both available, reads the cache, and falls back to a fresh fetch if stale. Sets two new state vars: `liveFuelPrices` and `fuelPricesLoading`.

**When to use:** Replaces the static line 250 derivation in `TripDetail.tsx`.

```typescript
// src/pages/TripDetail.tsx — new state variables (add alongside existing state)
const [liveFuelPrices, setLiveFuelPrices] = useState<LiveFuelPrices | null>(null)
const [fuelPricesLoading, setFuelPricesLoading] = useState(false)

// New useEffect — add after the existing attendee profiles effect
useEffect(() => {
  if (!currentUid || !trip?.creatorUid) return

  // Only fetch if this user is the creator, OR always fetch creator's price
  const creatorUid = trip.creatorUid

  async function loadPrices() {
    setFuelPricesLoading(true)
    try {
      // Try Firestore cache first
      const cached = await loadFuelPriceCache(creatorUid)
      if (cached) {
        setLiveFuelPrices(cached)
        return
      }
      // Cache miss or stale — fetch creator's homebase suburb
      // Requires creator's UserProfile; attendeeProfiles includes creator after Phase 2 fix
      const creatorProfile = attendeeProfiles.find(p => p.uid === creatorUid)
      const suburb = creatorProfile?.homeLocation?.suburb ?? ''
      const prices = await fetchFuelPrices(suburb)
      setLiveFuelPrices(prices)
      if (!prices.isEstimated) {
        // Save to creator's user doc
        await saveFuelPriceCache(creatorUid, prices.petrol, prices.diesel)
      }
    } catch {
      setLiveFuelPrices(FALLBACK_PRICES)
    } finally {
      setFuelPricesLoading(false)
    }
  }

  loadPrices()
}, [currentUid, trip?.creatorUid, attendeeProfiles.length])

// Replace line 250 derivation:
// OLD: const fuelPrices = trip?.costConfig?.fuelPrices ?? { petrol: 1.90, diesel: 1.85 }
// NEW:
const fuelPrices: FuelPrices = liveFuelPrices
  ? { petrol: liveFuelPrices.petrol, diesel: liveFuelPrices.diesel }
  : { petrol: 2.30, diesel: 2.85 }
const priceIsEstimated = liveFuelPrices?.isEstimated ?? true
```

### Pattern 3: CostBreakdown Override Toggle

**What:** New `priceIsEstimated` prop + `showOverride` local state replacing always-visible inputs with a collapsed display + toggle.

**When to use:** CostBreakdown already receives `fuelPrices` as a prop; the override inputs and `onUpdateFuelPrices` callback stay in place but move inside the toggled section.

```typescript
// CostBreakdown.tsx — prop interface change
interface CostBreakdownProps {
  // ... existing props
  priceIsEstimated?: boolean   // new — true when using fallback national average
}

// New local state
const [showOverride, setShowOverride] = useState(false)

// In the editable section, replace the always-visible fuel price inputs:
// Show: live price display row + "Override" button
// When showOverride === true: reveal the existing petrol/diesel inputs
```

### Pattern 4: Loading Skeleton

**What:** While `fuelPricesLoading === true`, render a skeleton placeholder over the cost summary cards in TripDetail.

**When to use:** Triggered by the `fuelPricesLoading` state; the 24h cache means this fires at most once per day per user.

```typescript
// Inline skeleton — matches existing app style
{fuelPricesLoading && (
  <div style={{
    height: '80px',
    borderRadius: '12px',
    background: 'rgba(140,133,120,0.12)',
    animation: 'pulse 1.5s ease-in-out infinite',
    marginBottom: '20px',
  }} />
)}
```

### Anti-Patterns to Avoid

- **Writing `fuelPrices` back to `trip.costConfig`**: The live price must NOT be saved to Firestore in `costConfig.fuelPrices` — that field should be removed from the save path. The live price is ephemeral state derived at page load.
- **Re-fetching on every re-render**: The `useEffect` must depend on stable identifiers (`creatorUid`, `attendeeProfiles.length`) — not on `attendeeProfiles` array reference which changes every snapshot.
- **Fetching for every attendee**: Decision D-01 is explicit — fetch the creator's price only, once per TripDetail mount.
- **Exposing the API key client-side without restrictions**: The fuelprice.io API key is read from `import.meta.env.VITE_FUELPRICE_API_KEY`. It will be visible in the bundle. Document that the key should have domain restrictions applied in the fuelprice.io dashboard if that feature exists.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 24h cache staleness check | Custom timestamp comparison logic | Mirror `isCacheValid` pattern from `driveCache.ts`, using `Timestamp.now().toMillis()` | Already battle-tested in this codebase |
| Suburb → city resolution | Complex geocoding | Simple Victoria-specific function: always return "Melbourne" | D-02: all users are Victorian; regional variance doesn't justify complexity |
| Retry logic on API failure | Exponential backoff retry loop | Immediate fallback to `FALLBACK_PRICES` on any error | D-09 decision; app should never stall on fuel price fetch |
| Cents-to-dollars conversion | None | API returns cents/L; divide by 100 | Only applies to fuelprice.io; verify against actual response before assuming |

**Key insight:** The fuel price fetch is non-blocking and non-critical. The app works correctly with the fallback. The architecture should reflect this: fail fast, show "est." label, never stall.

---

## Runtime State Inventory

> This phase is not a rename/refactor. No runtime state inventory required.

Step 2.5: SKIPPED (not a rename/refactor/migration phase).

---

## Common Pitfalls

### Pitfall 1: Victoria Has No Real-Time Station-Level Data
**What goes wrong:** The fuelprice.io API documentation notes that Victoria (unlike NSW, QLD, WA) has no real-time fuel station pricing data. The API returns data for Melbourne but based on aggregated/modelled data rather than live pump reporting.
**Why it happens:** Victoria only mandated price reporting (via Servo Saver) in 2023; the data pipeline for real-time station-level data is newer and has a 24h delay.
**How to avoid:** Use city-level average endpoint, not station-level. The city average is more reliable than attempting suburb-level for Victoria.
**Warning signs:** API returns empty or null for Victoria suburbs that aren't "Melbourne" — implement fallback immediately.

### Pitfall 2: API Key Exposure in Vite Bundle
**What goes wrong:** Any `VITE_` prefixed env var is embedded in the JavaScript bundle and visible to end users via browser DevTools.
**Why it happens:** Vite's env variable design intentionally exposes `VITE_` vars at build time for client-side use.
**How to avoid:** Use a domain-restricted API key if fuelprice.io supports it. Accept this as a known limitation for a personal app with low abuse risk. Do NOT use server-side-only env vars (non-`VITE_`) for this — they won't be available at runtime in a Vite SPA.
**Warning signs:** None at build time — the exposure is by design.

### Pitfall 3: Firestore Write Requires Creator's Document Access
**What goes wrong:** The fuel price cache is saved to `users/{creatorUid}`, but the current user may not be the creator. Firestore security rules may deny writes to another user's document.
**Why it happens:** Firestore rules typically lock `users/{uid}` writes to `request.auth.uid == uid`.
**How to avoid:** Only save the cache when `currentUid === trip.creatorUid`. If the current user is not the creator, use the fetched price ephemerally (don't attempt to write the cache).
**Warning signs:** Firestore permission denied error in console when a non-creator views the trip.

### Pitfall 4: attendeeProfiles Loads After Mount
**What goes wrong:** The fuel price `useEffect` runs when `currentUid` and `trip?.creatorUid` are set, but `attendeeProfiles` (which contains the creator's `homeLocation.suburb`) may not be populated yet when the effect first fires.
**Why it happens:** `attendeeProfiles` is loaded in a separate `useEffect` that depends on `trip?.attendees.join(',')` — which itself requires the trip snapshot to have arrived.
**How to avoid:** Chain the dependency correctly — include `attendeeProfiles.length` in the fuel price `useEffect` dependency array, or add a guard: `if (attendeeProfiles.length === 0) return`. The effect will re-run once profiles load.
**Warning signs:** Suburb is always empty string, causing city resolution to default to Melbourne regardless of homeLocation — acceptable but worth noting.

### Pitfall 5: Override Toggle UX on Price Update
**What goes wrong:** If the live price changes (24h cache expires, user navigates away and returns), the override inputs reset to the new live price — but the user had manually entered a custom value. This is acceptable per D-04 (session-only) but must not persist override state across mounts.
**Why it happens:** `localPetrol`/`localDiesel` state in CostBreakdown initialises from the `fuelPrices` prop. If the component unmounts and remounts, state resets.
**How to avoid:** This is intentional per D-04. Document it — do not attempt to persist override via useRef or localStorage.

### Pitfall 6: Timestamp.now() vs Date.now() in Cache Check
**What goes wrong:** `driveCache.ts` stores `cachedAt` as a plain millisecond number (`Date.now()`). The new `fuelPriceCache` spec (D-12) uses `Timestamp` (Firestore native type). These are not interchangeable.
**Why it happens:** The CONTEXT.md spec says `cachedAt: Timestamp`, but it's tempting to mirror driveCache's `cachedAt: number` directly.
**How to avoid:** Use `Timestamp.now()` when writing, and `cache.cachedAt.toMillis()` when reading in the staleness check. Update `UserProfile` type in `types/index.ts` accordingly: `fuelPriceCache?: { petrol: number; diesel: number; cachedAt: Timestamp }`.

---

## Code Examples

Verified patterns from official sources and codebase inspection:

### Firestore updateDoc — embed in user document
```typescript
// Source: mirrors saveDriveCache() in src/utils/driveCache.ts (codebase read)
import { doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

await updateDoc(doc(db, 'users', uid), {
  fuelPriceCache: {
    petrol: 2.30,
    diesel: 2.85,
    cachedAt: Timestamp.now(),
  },
})
```

### Firestore getDoc — read cache from user document
```typescript
// Source: established getDoc pattern confirmed in codebase
import { doc, getDoc } from 'firebase/firestore'

const snap = await getDoc(doc(db, 'users', uid))
const cache = snap.data()?.fuelPriceCache
if (cache && cache.cachedAt.toMillis() > Date.now() - 86_400_000) {
  // Cache is fresh — use it
}
```

### Environment variable access in Vite + TypeScript
```typescript
// Source: Vite docs pattern [ASSUMED — standard Vite practice]
const apiKey = import.meta.env.VITE_FUELPRICE_API_KEY as string | undefined
if (!apiKey) {
  console.warn('VITE_FUELPRICE_API_KEY not set — using fallback fuel prices')
  return FALLBACK_PRICES
}
```

### TypeScript: UserProfile type extension
```typescript
// src/types/index.ts — add to UserProfile interface
import { Timestamp } from 'firebase/firestore'

export interface UserProfile {
  // ... existing fields
  fuelPriceCache?: {
    petrol: number
    diesel: number
    cachedAt: Timestamp
  }
}
```

---

## Australian Fuel Price API Landscape

### API Options Evaluated

| API | Coverage | Data Freshness | Auth | Cost | Verdict |
|-----|----------|---------------|------|------|---------|
| **fuelprice.io** | All states, 281+ cities, suburb-level | Real-time (live) | API key (sign-up) | Unknown — website returns 403; listed at "$0 AUD" in one source but unconfirmed | **Recommended** — covers Melbourne, has city average endpoint |
| **Service Victoria Servo Saver** | Victoria only | 24-hour delay | Free but requires application/authorisation | Free | Backup — good coverage but delay and setup friction |
| **NSW FuelCheck** | NSW + Tasmania only | Real-time | API key (api.nsw.gov.au) | Free | Not applicable — wrong state |
| **FuelWatch WA** | WA only (RSS) | Daily | None | Free | Not applicable — wrong state |
| **AIP (Australian Institute of Petroleum)** | National | Weekly Excel | No API | Free | Web scrape not recommended — no stable API |
| **ACCC weekly report** | National | Weekly PDF | No API | Free | PDF only — not machine-readable |

### Recommended API: fuelprice.io

**Why:** Only service with documented city-level average endpoint covering Melbourne/Victoria with real-time data. All other Australian government APIs either cover different states or have a 24-hour delay.

**Endpoint format** (from legacy documentation — MUST VERIFY at implementation):
```
GET https://fuelprice.io/api/
  ?key={API_KEY}
  &action=get_city_average
  &fuel_type=unleaded        # or diesel
  &city=Melbourne
```

**Response** (assumed from search results citing legacy docs — MUST VERIFY):
```json
{ "average": 232 }   // cents per litre
```
Divide by 100 to get dollars per litre.

**Current v1 API** (from api.fuelprice.io):
```
GET https://api.fuelprice.io/v1/cities/{CITY_ID}/average
Authorization: Bearer {API_KEY}
```
The city ID for Melbourne is unknown without an API key — needs discovery call to `GET /v1/cities`.

**Implementation decision:** Start with whichever endpoint format works after obtaining the API key. The utility function abstracts this away from TripDetail.

**CRITICAL CAVEAT — Victoria real-time data:** fuelprice.io's own documentation states "unlike NSW, QLD, WA, the NT or TAS, VIC has no real-time or even daily fuel station pricing data." [VERIFIED: WebSearch result citing fuelprice.io docs] This means the API likely uses modelled or aggregated data for Melbourne, not live pump prices. This is still better than a stale hardcoded value, but worth noting in the "est." label rationale.

### Fallback Prices (researcher-recommended)

Based on ACCC, NRMA, and fuelprice.io data for Melbourne as of April 2026 (post-fuel-excise-cut effective 1 April 2026):

| Fuel Type | Recommended Fallback | Basis |
|-----------|---------------------|-------|
| Petrol (ULP91) | **$2.30/L** | Melbourne city average ~232 c/L per fuelprice.io website (3 April 2026) [VERIFIED: WebSearch result citing fuelprice.io Melbourne page] |
| Diesel | **$2.85/L** | [ASSUMED: Pre-cut diesel average was ~303 c/L; excise reduction ~26.3 c/L; rounded to 285 c/L — see Assumptions Log A2] |

> **Note on price volatility:** April 2026 prices are elevated due to Middle East conflict disrupting oil supply (US-Iran war began late February 2026). The normal baseline is ~$1.69/L. The fallback values above reflect the current market. The "est." label (D-10) is important precisely because these prices can shift 50 c/L in weeks. The live API is the primary data source; the fallback is the safety net.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `{ petrol: 1.90, diesel: 1.85 }` in TripDetail line 250 | Live-fetched + Firestore-cached via `fuelPrices.ts` utility | Phase 4 | Costs reflect current market; fallback replaces hardcoded stale values |
| Always-visible petrol/diesel inputs in CostBreakdown | Collapsed override panel; live price displayed by default | Phase 4 | Cleaner UI; manual override preserved as escape hatch per D-03/D-04 |
| `fuelPrices` saved back to `costConfig` in Firestore | Live price is ephemeral state; NOT persisted to `costConfig` | Phase 4 | `costConfig.fuelPrices` field becomes vestigial — planner should decide whether to remove it from the Trip interface or leave it |

**Deprecated/outdated:**
- `trip.costConfig.fuelPrices` as the cost calculation source: replaced by `liveFuelPrices` state in TripDetail. The field can remain in the `Trip` type for backward compatibility but is no longer written or read for cost calculations.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | fuelprice.io `get_city_average` endpoint format: `?action=get_city_average&fuel_type=unleaded&city=Melbourne` returns `{ "average": 232 }` in cents/L | Standard Stack, Code Examples | Wrong endpoint format → all API calls fail → fallback activates → no functional regression, but feature never activates |
| A2 | Post-excise-cut diesel fallback price of $2.85/L | Standard Stack, Common Pitfalls | Diesel was ~$3.03/L pre-cut nationally; $2.85 is an estimate. Actual post-cut diesel may differ by ±$0.20 | 
| A3 | fuelprice.io has a free tier sufficient for ~1 API call/day per user | Standard Stack | If API is paid-only, need to choose Service Victoria Servo Saver or hardcoded national average as primary |
| A4 | Vite `import.meta.env.VITE_FUELPRICE_API_KEY` is the correct env var access pattern for this project's build setup | Code Examples | Standard Vite practice; no custom env config observed in vite.config.ts |
| A5 | fuelprice.io `fuel_type` parameter accepts `"unleaded"` and `"diesel"` as values | Code Examples | May use different values (e.g., "U91", "PDL") — verify against API docs at sign-up |

---

## Open Questions (RESOLVED)

1. **fuelprice.io free tier availability**
   - What we know: The API requires a key; one source listed it as "$0 AUD" in API docs; website returns 403 on direct fetch
   - What's unclear: Whether there is a free tier with adequate call volume (~100 calls/day for a small crew app)
   - Recommendation: Sign up first. If paid-only: use Service Victoria Servo Saver (free, authorisation required, 24h delay) as primary, or drop API integration and use hardcoded fallback as the primary display with a note that prices are approximate.

2. **Firestore security rules — writing to creator's document as a non-creator**
   - What we know: Standard Firestore security rule pattern restricts writes to `users/{uid}` to `request.auth.uid == uid`
   - What's unclear: The app's actual Firestore security rules are not in the repo (cloud-only)
   - Recommendation: Implement the cache write with a guard `if (currentUid !== creatorUid) return` — the price is fetched but not cached. This is a safe degradation.

3. **Trip.costConfig.fuelPrices — remove or keep?**
   - What we know: Phase 4 makes `liveFuelPrices` the source of truth; `costConfig.fuelPrices` is no longer written or read
   - What's unclear: Whether old trips in Firestore that have `costConfig.fuelPrices` will cause confusion
   - Recommendation: Leave the field in the TypeScript `Trip` interface for backward compatibility; simply stop reading it in TripDetail (the static line 250 derivation is replaced). Do not add a migration task.

4. **env var for API key — .env.local or deployed env?**
   - What we know: Vercel is the deployment target (vercel.json is present); Vite supports `.env.local` for local dev
   - What's unclear: Whether the user has set up Vercel environment variables for this project
   - Recommendation: Planner should include a Wave 0 task: "Add `VITE_FUELPRICE_API_KEY` to `.env.local` and to Vercel project settings." App falls back gracefully if the var is missing.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `firebase/firestore` (Firestore SDK) | FUEL-CACHE | ✓ | ^10.12.0 in package.json | — |
| `fuelprice.io` API key | FUEL-API | Unknown | — | Hardcoded national average fallback (D-09) |
| `VITE_FUELPRICE_API_KEY` env var | FUEL-API | Unknown | — | App detects missing key, uses fallback |
| Network access to `fuelprice.io` | FUEL-API | ✓ (browser fetch) | — | — |

**Missing dependencies with no fallback:**
- None that block the phase. If `VITE_FUELPRICE_API_KEY` is absent, the feature degrades to `FALLBACK_PRICES` with "est." label — the app remains functional.

**Missing dependencies with fallback:**
- `VITE_FUELPRICE_API_KEY`: requires sign-up at fuelprice.io. Fallback is `FALLBACK_PRICES` + `priceIsEstimated: true`.

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed — no test runner in `package.json` or `vite.config.ts` |
| Config file | None — see Wave 0 |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FUEL-API | `fetchFuelPrices()` returns `{ petrol, diesel, isEstimated: false }` when API responds | unit | `vitest run src/utils/fuelPrices.test.ts` | ❌ Wave 0 |
| FUEL-API | `fetchFuelPrices()` returns `FALLBACK_PRICES` with `isEstimated: true` when API call throws | unit | `vitest run src/utils/fuelPrices.test.ts` | ❌ Wave 0 |
| FUEL-CACHE | `loadFuelPriceCache()` returns null when `cachedAt` is older than 24h | unit | `vitest run src/utils/fuelPrices.test.ts` | ❌ Wave 0 |
| FUEL-CACHE | `loadFuelPriceCache()` returns cached prices when fresh | unit | `vitest run src/utils/fuelPrices.test.ts` | ❌ Wave 0 |
| FUEL-COST | `priceIsEstimated` prop propagates from TripDetail to CostBreakdown "est." label | manual | Visual inspection in browser | manual-only — UI rendering test |
| FUEL-COST | Override toggle reveals inputs; price override does NOT persist after navigation | manual | Navigate away and back; confirm live price is restored | manual-only — session state behaviour |

> Note: `calculateCosts()` in `costEngine.ts` is a pure function with no side effects — it can be tested with vitest without any mocking. Its signature does not change in Phase 4, so no new tests for it are strictly required.

### Sampling Rate
- **Per task commit:** `vitest run src/utils/fuelPrices.test.ts` (once file exists)
- **Per wave merge:** `vitest run` (full suite, once configured)
- **Phase gate:** Full suite green + manual override/fallback verification before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/utils/fuelPrices.test.ts` — covers FUEL-API and FUEL-CACHE requirements
- [ ] `vitest.config.ts` — test framework not yet installed (`vitest` + `@testing-library/react` not in `package.json`)
- [ ] Framework install: `npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom`

**Alternative:** Given the zero existing test infrastructure, the planner may elect to mark all validation as manual-only for this phase and defer vitest setup to a dedicated infrastructure phase. The pure-function nature of `fuelPrices.ts` makes unit tests high-value but not blocking for delivery.

---

## Security Domain

> `security_enforcement` is not set in `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth surface |
| V3 Session Management | No | No new session handling |
| V4 Access Control | Yes (low) | Firestore write guard: `currentUid === creatorUid` before writing cache to other user's doc |
| V5 Input Validation | Yes (low) | Validate API response: check `typeof average === 'number'` and value is in plausible range (50–500 c/L) before using |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposed in client bundle | Information Disclosure | Accept for personal app; apply domain restriction in fuelprice.io dashboard if available |
| Malformed API response injected (e.g., negative price) | Tampering | Validate response range: `if (value < 50 || value > 500) return FALLBACK_PRICES` |
| CORS error on API call | DoS (indirect) | Wrap in try/catch; immediate fallback |
| Firestore write to another user's document | Elevation of Privilege | Guard: only write cache if `currentUid === creatorUid` |

---

## Sources

### Primary (HIGH confidence)
- Codebase read (`src/utils/driveCache.ts`, `src/utils/costEngine.ts`, `src/pages/TripDetail.tsx`, `src/components/CostBreakdown.tsx`, `src/types/index.ts`) — integration points, type structure, Firestore patterns
- `package.json` — confirmed no test framework installed; Firebase 10.x confirmed

### Secondary (MEDIUM confidence)
- [fuelprice.io API docs page](https://api.fuelprice.io/) — endpoint structure, bearer token auth, city-level average endpoints
- [NSW Fuel API - api.nsw.gov.au](https://api.nsw.gov.au/Product/Index/22) — confirmed OAuth2, V1/V2 endpoints, NSW+TAS coverage only
- [Service Victoria Servo Saver Public API](https://service.vic.gov.au/find-services/transport-and-driving/servo-saver/help-centre/servo-saver-public-api) — confirmed free, 24h delay, JSON format, requires authorisation
- [NRMA Weekly Fuel Report](https://www.mynrma.com.au/cars-and-driving/fuel-finder/weekly-report) — Sydney ULP91 $2.58/L, diesel $3.23/L as of 30 March 2026
- [ACCC fuel price monitoring](https://www.accc.gov.au/about-us/publications/weekly-fuel-price-monitoring-update) — national average ULP91 ~252 c/L, diesel ~304 c/L week of 25 March 2026
- [fuelprice.io Melbourne ULP91 page](https://fuelprice.io/vic/melbourne/unleaded/) — Melbourne average 232.6 c/L as of 3 April 2026 (post-excise cut)
- [ACCC media release on fuel excise cut](https://www.accc.gov.au/media-release/accc-monitors-fuel-excise-cut-fuel-surcharges-and-fuel-price-movements) — excise halved to 26.3 c/L effective 1 April 2026

### Tertiary (LOW confidence)
- WebSearch results citing fuelprice.io legacy docs: `get_city_average` endpoint format — single source, unverified against live API; flagged as [ASSUMED] in code examples
- WebSearch result claiming fuelprice.io API costs "$0 AUD" — single source, contradicted by the fact that API key registration is required; flagged as unconfirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; Firebase and fetch patterns verified from codebase
- Architecture patterns: HIGH — integration points directly verified from codebase
- API choice (fuelprice.io): MEDIUM — endpoint format from legacy docs; pricing tier and Victoria real-time data limitations confirmed but exact response shape unverified
- Fallback values: MEDIUM — petrol $2.30/L confirmed; diesel $2.85/L is an estimate
- Pitfalls: HIGH — all derived from direct codebase inspection or documented API limitations

**Research date:** 2026-04-06
**Valid until:** 2026-04-20 (13 days) — fuel prices are extremely volatile in April 2026 due to geopolitical events; the fallback values may need updating if the excise cut expires or global conditions change
