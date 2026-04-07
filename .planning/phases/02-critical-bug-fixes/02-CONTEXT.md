# Phase 2: Critical bug fixes - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the four user-visible bugs identified in the GSD codebase audit: fuel cost showing $0 in TripDetail, SpotlightCard using hardcoded central-Vic coordinates as drive fallback, TripSheet "today" date going stale past midnight, and drive cache progress total hardcoded at 70. No new capabilities — only these four fixes.

</domain>

<decisions>
## Implementation Decisions

### BUG-FUEL — Fuel cost always $0 in TripDetail
- **D-01:** Build `distancesKm` from each attendee's existing `driveCache` — `profile.driveCache?.[confirmedDestinationId]?.distanceKm`. `attendeeProfiles` are already loaded in TripDetail so this requires no API calls and no new Firestore reads. Attendees without a cache entry get `0` (same as today, but only for those missing a cache, not everyone).
- **D-02:** If an attendee has no `driveCache` entry for the confirmed destination, fall back to `0` (unchanged behaviour for that individual). Do not block rendering or show an error.

### BUG-COORDS — Hardcoded central-Vic fallback in SpotlightCard
- **D-03:** Pass `currentUser.homeLocation` as a prop into `SpotlightCard`. Replace the hardcoded `lat1 = -37.0, lng1 = 144.5` with `homeLocation.lat` / `homeLocation.lng` in the haversine fallback.
- **D-04:** If `currentUser.homeLocation` is null (user hasn't set a home), keep the existing fallback label text (the IIFE formula will be unreachable). Do not change the component's null guard pattern.

### BUG-DATE — Stale "today" in TripSheet
- **D-05:** Move `const today = new Date().toISOString().split('T')[0]` from module scope into the component body (top of `TripSheet` function, before state declarations). This recomputes it each mount without changing any existing logic.

### BUG-CACHE — Hardcoded `total: 70` in drive cache progress
- **D-06:** Replace `setCacheProgress({ done: 0, total: 70 })` at `Map.tsx:441` with `setCacheProgress({ done: 0, total: destinations.length })`. The `destinations` array is imported at the top of Map.tsx — no new imports needed. Apply the same substitution wherever `total: 70` appears in the same `checkAndBuildCache` function.

### Claude's Discretion
- Exact wording of any inline comments added/updated alongside the fixes
- Whether to include a `// fix: BUG-FUEL` comment or just clean up the existing `// placeholder` comment

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug locations (read before touching)
- `src/pages/TripDetail.tsx` lines 260–276 — BUG-FUEL: `distancesKm = {}` and the `calculateCosts` call that consumes it
- `src/pages/Map.tsx` lines 113–131 — BUG-COORDS: `SpotlightCard` component and hardcoded fallback
- `src/pages/Map.tsx` lines 424–456 — BUG-CACHE: `checkAndBuildCache` and the hardcoded `total: 70`
- `src/components/TripSheet.tsx` line 37 — BUG-DATE: module-level `today` const

### Types (for understanding DriveCache shape)
- `src/types/index.ts` — `UserProfile`, `DriveCache`, `DriveCacheEntry` (distanceKm field), `HomeLocation`

### Codebase audit
- `.planning/codebase/CONCERNS.md` — Full description of all four bugs with root cause and exact line numbers

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `attendeeProfiles: UserProfile[]` in TripDetail — already loaded before the cost calc, each has `driveCache?: DriveCache`
- `driveCache` prop already passed into `SpotlightCard` — adding `userHomeLocation` follows the same pattern
- `destinations` array imported at top of `Map.tsx` — already in scope for the `total` fix

### Established Patterns
- Component function scope: all stateful constants in this codebase live inside the component function, not at module level — D-05 aligns with the established pattern
- Props interfaces: `SpotlightCard` already has an explicit prop interface — add `userHomeLocation: HomeLocation | null` following the same inline interface pattern

### Integration Points
- `calculateCosts()` in `src/utils/costEngine.ts` accepts `distancesKm: Record<string, number>` keyed by attendee UID — that's what D-01 populates
- `SpotlightCard` is rendered by `MapPage` which has `currentUser` state with `homeLocation` — the prop can be passed directly

</code_context>

<specifics>
## Specific Ideas

No specific design preferences raised — all four fixes are corrective, not aesthetic.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-critical-bug-fixes*
*Context gathered: 2026-04-06*
