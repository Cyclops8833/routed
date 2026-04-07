---
phase: "05"
plan: "04"
subsystem: "data-layer"
tags: [firestore, performance, drive-cache, incremental-save, resume]
dependency_graph:
  requires: [05-01, 05-03]
  provides: [incremental-drive-cache, partial-resume]
  affects: [Map, driveCache]
tech_stack:
  added: []
  patterns: [incremental Firestore writes, partial cache resume, location-change guard]
key_files:
  created: []
  modified:
    - src/utils/driveCache.ts
    - src/pages/Map.tsx
decisions:
  - "buildDriveCache now accepts uid + existingCache to enable mid-batch Firestore saves and resume from partial state"
  - "saveDriveCache errors inside batch loop are caught and warned but do not abort the build (threat model Low)"
  - "Location-change guard in checkAndBuildCache passes undefined instead of profile.driveCache when home moved >0.001 deg, forcing full rebuild (threat model Med)"
  - "Standalone saveDriveCache call removed from Map.tsx — incremental saves inside buildDriveCache replace it"
metrics:
  duration: "~10 min"
  completed: "2026-04-07"
  tasks_completed: 2
  files_modified: 2
  files_created: 0
---

# Phase 05 Plan 04: Drive cache — incremental save and partial resume Summary

`buildDriveCache` modified to accept `uid` + `existingCache`, skip already-cached destinations, and persist to Firestore after every batch of 5 — eliminating the silent partial-cache acceptance bug when a build is interrupted.

## What Was Built

**`src/utils/driveCache.ts`:**
- New signature: `buildDriveCache(homeLat, homeLng, uid, existingCache?, onProgress?)`
- `existingCache` spread into `cache` at start; `toFetch` filtered to only uncached destination IDs (D-13)
- `done` counter initialised from already-cached count so progress bar reflects resume correctly
- Mid-batch `saveDriveCache` call after each batch completes (D-14); errors are caught + warned, build continues
- Batch loop iterates over `toFetch` instead of `destinations`

**`src/pages/Map.tsx`:**
- Location-change guard added before passing `existingCache`: compares `profile.driveCacheLocation` to current `loc` within 0.001 deg; passes `undefined` if moved (forces full rebuild — D-15 threat)
- `buildDriveCache` call updated with `currentUid!` and `existingCache` args
- Standalone `await saveDriveCache(...)` line removed (incremental saves inside `buildDriveCache` replace it)
- `saveDriveCache` removed from import line (no longer called directly in Map.tsx)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] saveDriveCache error handling inside batch loop**
- **Found during:** Task 1 — threat model entry flagged unhandled Firestore write errors
- **Issue:** Threat model noted mid-batch save failures would propagate and abort the entire build
- **Fix:** Wrapped `saveDriveCache` in try/catch that logs a warning and continues
- **Files modified:** src/utils/driveCache.ts
- **Commit:** 96341a7

**2. [Rule 1 - Bug] Removed saveDriveCache from Map.tsx import**
- **Found during:** Task 2 cleanup
- **Issue:** `saveDriveCache` remained in the import after removing the direct call; TypeScript would warn on unused import
- **Fix:** Removed `saveDriveCache` from the driveCache import line
- **Files modified:** src/pages/Map.tsx
- **Commit:** 96341a7

## Known Stubs

None — all data flows wired to live Firestore.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Existing threat mitigations applied as documented in plan threat model.

## Verification

- TypeScript: `npx tsc --noEmit` — clean (0 errors)
- Build: `npm run build` — succeeds in 4.94s
- Post-conditions:
  - `buildDriveCache` signature has `uid: string` and `existingCache?: DriveCache` parameters
  - `buildDriveCache` skips already-cached destination IDs via `toFetch` filter
  - `buildDriveCache` calls `saveDriveCache` after each batch (wrapped in try/catch)
  - `checkAndBuildCache` in Map.tsx passes `existingCache` with location-change guard
  - Standalone `await saveDriveCache(...)` removed from Map.tsx
  - `saveDriveCache` removed from Map.tsx import

## Self-Check: PASSED

- `src/utils/driveCache.ts` — modified with new signature and incremental saves
- `src/pages/Map.tsx` — updated with existingCache + location guard, saveDriveCache removed
- Commit 96341a7 — present in git log
