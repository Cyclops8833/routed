---
phase: 02-critical-bug-fixes
plan: "01"
subsystem: cost-engine, trip-sheet
tags: [bug-fix, fuel-cost, date-stale, driveCache, component-scope]
dependency_graph:
  requires: []
  provides: [BUG-FUEL-fix, BUG-DATE-fix]
  affects: [src/pages/TripDetail.tsx, src/components/TripSheet.tsx]
tech_stack:
  added: []
  patterns: [Object.fromEntries, optional-chaining-nullish-coalesce, component-scope-const]
key_files:
  created: []
  modified:
    - src/pages/TripDetail.tsx
    - src/components/TripSheet.tsx
decisions:
  - "(02-01) distancesKm built via Object.fromEntries over attendeeProfiles using driveCache?.[confirmedDestinationId!]?.distanceKm ?? 0 — no new Firestore reads"
  - "(02-01) today const added inside both TripSheet and FormView function bodies — FormView is a separate top-level function requiring its own declaration"
metrics:
  duration: ~10 min
  completed: 2026-04-06
  tasks_completed: 2
  files_modified: 2
---

# Phase 02 Plan 01: BUG-FUEL and BUG-DATE Fix Summary

**One-liner:** Fuel cost now reads real km from attendee driveCache; TripSheet date default recomputes fresh on each component mount.

## What Was Built

### Task 1 — BUG-FUEL: Populate distancesKm from attendee driveCache (commit: 271ab34)

Replaced the `distancesKm: Record<string, number> = {}` placeholder in `TripDetail.tsx` with an `Object.fromEntries` expression that maps each attendee's `driveCache?.[confirmedDestinationId!]?.distanceKm ?? 0`. The `attendeeProfiles` array was already in scope so this required no new Firestore reads or imports. Attendees without a cache entry silently receive 0 (D-02). The `calculateCosts()` call below was untouched — it already consumed `distancesKm`.

### Task 2 — BUG-DATE: Move today inside component scope (commit: ba1b057)

Removed the module-level `const today = new Date().toISOString().split('T')[0]` from `TripSheet.tsx`. Added the same line as the first statement inside the `TripSheet` function body and also inside the `FormView` function body (see deviation below). A user who keeps the app open past midnight now sees the correct current date when opening the trip planner.

## Acceptance Criteria Verification

- `src/pages/TripDetail.tsx` contains `profile.driveCache?.[trip.confirmedDestinationId!]?.distanceKm ?? 0` — YES (line 266)
- `src/pages/TripDetail.tsx` does NOT contain plain empty-object `distancesKm` assignment — YES (removed)
- `src/pages/TripDetail.tsx` does NOT contain "use 0 as placeholder" comment — YES (removed)
- `grep -c "const today" src/components/TripSheet.tsx` is NOT 1 — see deviation (2 occurrences, both inside function bodies)
- No module-level `today` exists — YES (confirmed by indentation at lines 45 and 421)
- `npm run build` exits 0 — YES

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added today const inside FormView as well as TripSheet**

- **Found during:** Task 2 build verification
- **Issue:** The plan's acceptance criterion said "exactly one occurrence" but `FormView` is a separate top-level function at line 401 that used `today` from module scope. Moving `today` only into `TripSheet`'s scope caused `TS2304: Cannot find name 'today'` at lines 512 and 532 inside `FormView`.
- **Fix:** Added `const today = new Date().toISOString().split('T')[0]` as the first line of `FormView`'s body too. Both occurrences are inside function bodies (indented), achieving the intent of the plan: no module-level stale const.
- **Files modified:** `src/components/TripSheet.tsx`
- **Commit:** ba1b057

## Known Stubs

None — both fixes wire real data through existing paths.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All threats reviewed in plan's threat model are accepted.

## Self-Check: PASSED

- FOUND: /s/Claude/routed/.planning/phases/02-critical-bug-fixes/02-01-SUMMARY.md
- FOUND: commit 271ab34 (fix TripDetail distancesKm)
- FOUND: commit ba1b057 (fix TripSheet today scope)
