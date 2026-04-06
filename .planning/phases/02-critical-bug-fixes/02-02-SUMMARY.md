---
phase: 02-critical-bug-fixes
plan: "02"
subsystem: map
tags: [bug-fix, spotlight, drive-cache, coordinates, haversine]
dependency_graph:
  requires: []
  provides: [BUG-COORDS, BUG-CACHE]
  affects: [SpotlightCard, checkAndBuildCache]
tech_stack:
  added: []
  patterns: [optional-chaining-nullish-coalescing, dynamic-array-length]
key_files:
  created: []
  modified:
    - src/pages/Map.tsx
decisions:
  - (02-02) SpotlightCard userHomeLocation prop falls back to -37.0/144.5 when homeLocation is null (central-Vic sentinel preserved)
  - (02-02) destinations imported as value (not just type) to expose .length for cache progress total
metrics:
  duration: ~8 min
  completed: 2026-04-06
  tasks_completed: 2
  files_modified: 1
---

# Phase 02 Plan 02: BUG-COORDS and BUG-CACHE Fixes Summary

Fixed two bugs in Map.tsx: SpotlightCard now uses the current user's homeLocation for the haversine drive-time fallback instead of hardcoded central-Victoria coordinates, and checkAndBuildCache initialises its progress total from destinations.length rather than the literal 70.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | BUG-COORDS: Replace hardcoded coordinates in SpotlightCard | 99d4d74 | src/pages/Map.tsx |
| 2 | BUG-CACHE: Replace hardcoded total:70 with destinations.length | 99d4d74 | src/pages/Map.tsx |

(Both tasks committed together as a single atomic change to Map.tsx.)

## What Was Built

**Task 1 — BUG-COORDS**

SpotlightCard previously had a haversine fallback that hardcoded `lat1 = -37.0, lng1 = 144.5` (central Victoria). Any user with a homeLocation outside Victoria would see an incorrect drive-time estimate before their cache was built.

Changes:
- Added `HomeLocation` to the types import on line 8
- Added `userHomeLocation: HomeLocation | null` to the SpotlightCard prop interface
- Replaced `lat1 = -37.0, lng1 = 144.5` with `lat1 = userHomeLocation?.lat ?? -37.0, lng1 = userHomeLocation?.lng ?? 144.5`
- Updated JSX callsite to pass `userHomeLocation={currentUser?.homeLocation ?? null}`

The `-37.0, 144.5` values are retained as a last-resort fallback for users who have not completed onboarding (null homeLocation).

**Task 2 — BUG-CACHE**

`checkAndBuildCache` initialised progress with `total: 70`, a hardcoded value that became incorrect if destinations were added or removed from `src/data/destinations.ts`.

Changes:
- Added `import { destinations } from '../data/destinations'` (value import, not type-only)
- Replaced `setCacheProgress({ done: 0, total: 70 })` with `setCacheProgress({ done: 0, total: destinations.length })`

The destinations array is a bundled static TypeScript array — its length is resolved at build time and cannot be manipulated at runtime.

## Verification Results

- `grep -c "userHomeLocation" src/pages/Map.tsx` → 4 (within acceptable range 3-5)
- `grep -c "lat1 = -37.0, lng1 = 144.5" src/pages/Map.tsx` → 0 (bare hardcoded literals removed)
- `grep -c "total: 70" src/pages/Map.tsx` → 0 (hardcoded value removed)
- `npm run build` → exit 0, no TypeScript errors

## Deviations from Plan

None — plan executed exactly as written.

The plan noted that HomeLocation may not be imported; it was correct — HomeLocation was not in the types import and was added as part of Task 1.

The plan noted that destinations may not be imported as a value; it was correct — only `import type { Destination }` existed, so the value import was added as part of Task 2.

## Known Stubs

None.

## Threat Flags

No new security-relevant surface introduced. Both changes are display-only (haversine estimate label, progress bar total). Threat register items T-02-04, T-02-05, T-02-06 accepted per plan.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/pages/Map.tsx exists | FOUND |
| 02-02-SUMMARY.md exists | FOUND |
| Commit 99d4d74 exists | FOUND |
