---
phase: 02-critical-bug-fixes
verified: 2026-04-06T00:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 02: Critical Bug Fixes — Verification Report

**Phase Goal:** Fix the four user-visible bugs identified in the GSD codebase audit: fuel cost showing $0 in TripDetail (distances never fetched), drive time estimate using hardcoded central-Vic coordinates as fallback, TripSheet "today" date going stale past midnight, and drive cache total hardcoded at 70 rather than derived from destinations array length.
**Verified:** 2026-04-06
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                    | Status     | Evidence                                                                                                |
|----|------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------------|
| 1  | TripDetail builds distancesKm from attendee driveCache, not a plain empty object         | VERIFIED   | `Object.fromEntries` over `attendeeProfiles` at TripDetail.tsx lines 262-269                            |
| 2  | TripSheet "today" const is never at module scope — only inside function bodies           | VERIFIED   | Two occurrences: line 45 inside `TripSheet` body, line 421 inside `FormView` body; no module-level decl |
| 3  | SpotlightCard accepts `userHomeLocation: HomeLocation | null` and uses it in haversine   | VERIFIED   | Prop declared at Map.tsx line 122; used as `userHomeLocation?.lat ?? -37.0` at line 129                 |
| 4  | `checkAndBuildCache` initialises progress total from `destinations.length`, not literal 70 | VERIFIED | `setCacheProgress({ done: 0, total: destinations.length })` at Map.tsx line 444; `total: 70` has 0 hits |

**Score:** 4/4 truths verified

---

## Required Artifacts

| Artifact                           | Expected                                          | Status     | Details                                                    |
|------------------------------------|---------------------------------------------------|------------|------------------------------------------------------------|
| `src/pages/TripDetail.tsx`         | distancesKm built from driveCache                 | VERIFIED   | Object.fromEntries at lines 262-269; driveCache path confirmed |
| `src/components/TripSheet.tsx`     | today const moved inside function bodies          | VERIFIED   | Lines 45 and 421 both indented inside function bodies      |
| `src/pages/Map.tsx`                | SpotlightCard prop + destinations.length for cache | VERIFIED  | userHomeLocation prop × 4 hits; total:70 × 0 hits          |

---

## Key Link Verification

| From                    | To                                | Via                                      | Status   | Details                                                              |
|-------------------------|-----------------------------------|------------------------------------------|----------|----------------------------------------------------------------------|
| TripDetail distancesKm  | attendeeProfiles.driveCache       | Object.fromEntries + optional chaining   | WIRED    | Line 266: `profile.driveCache?.[trip.confirmedDestinationId!]?.distanceKm ?? 0` |
| SpotlightCard           | currentUser.homeLocation          | `userHomeLocation={currentUser?.homeLocation ?? null}` prop | WIRED | Line 911 in Map.tsx JSX callsite                          |
| checkAndBuildCache      | destinations array (static import) | `destinations.length`                   | WIRED    | `destinations` imported as value at line 16; used at line 444        |

---

## Verification Checks (as specified)

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| BUG-FUEL | `grep -n "driveCache" src/pages/TripDetail.tsx` | Lines 260, 266 show Object.fromEntries expression using driveCache | PASS |
| BUG-DATE | `grep -n "const today" src/components/TripSheet.tsx` — module-level count | 0 module-level occurrences; both at lines 45 and 421 are indented inside function bodies | PASS |
| BUG-COORDS | `grep -c "userHomeLocation" src/pages/Map.tsx` | 4 occurrences (within required range 3-5) | PASS |
| BUG-CACHE (no literal) | `grep -c "total: 70" src/pages/Map.tsx` | 0 — literal removed | PASS |
| BUG-CACHE (dynamic) | `grep -n "destinations.length" src/pages/Map.tsx` | Line 444: `setCacheProgress({ done: 0, total: destinations.length })` | PASS |
| Build | `npm run build` | Exits 0; TypeScript clean; 90 modules transformed; no type errors | PASS |

---

## Data-Flow Trace (Level 4)

| Artifact                    | Data Variable   | Source                                      | Produces Real Data | Status   |
|-----------------------------|-----------------|---------------------------------------------|--------------------|----------|
| TripDetail.tsx distancesKm  | distancesKm     | attendeeProfiles (already-loaded Firestore) | Yes — live per-user driveCache | FLOWING |
| Map.tsx SpotlightCard       | userHomeLocation | currentUser (onAuthStateChanged + Firestore) | Yes — live user document | FLOWING |
| Map.tsx checkAndBuildCache  | destinations.length | static bundled array in src/data/destinations.ts | Yes — resolved at build time | FLOWING |

---

## Anti-Patterns Found

No blockers found. Chunk size warnings from Vite are pre-existing (Map.tsx at 1782 kB) and not introduced by this phase.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found in changed files | — | — |

---

## Human Verification Required

None. All four bug fixes are verifiable programmatically via grep and build checks. The behavioral correctness (correct km, correct date, correct drive time, correct progress total) is fully determined by the code paths confirmed above — no UI interaction required to confirm the fix structure is in place.

---

## Requirements Coverage

| Requirement | Source Plan   | Description                                               | Status    | Evidence                                          |
|-------------|---------------|-----------------------------------------------------------|-----------|---------------------------------------------------|
| BUG-FUEL    | 02-01-PLAN.md | distancesKm built from attendee driveCache                | SATISFIED | TripDetail.tsx lines 262-269                      |
| BUG-DATE    | 02-01-PLAN.md | today const inside function scope only                    | SATISFIED | TripSheet.tsx lines 45, 421 — both inside bodies  |
| BUG-COORDS  | 02-02-PLAN.md | SpotlightCard uses live homeLocation for haversine        | SATISFIED | Map.tsx lines 117-129, 911                        |
| BUG-CACHE   | 02-02-PLAN.md | Cache progress total derived from destinations.length     | SATISFIED | Map.tsx line 444                                  |

---

## Gaps Summary

No gaps. All four requirements are satisfied. The phase goal is fully achieved.

---

_Verified: 2026-04-06_
_Verifier: Claude (gsd-verifier)_
