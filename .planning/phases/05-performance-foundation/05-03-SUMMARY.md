---
phase: "05"
plan: "03"
subsystem: "ui-components"
tags: [react, performance, memo, useCallback, refactor]
dependency_graph:
  requires: [05-01]
  provides: [SpotlightCard (memoised), DestinationCard (memoised)]
  affects: [Map, QuickPlanSheet, TripSheet]
tech_stack:
  added: []
  patterns: [React.memo, useCallback with empty dep array]
key_files:
  created:
    - src/components/SpotlightCard.tsx
  modified:
    - src/pages/Map.tsx
    - src/components/DestinationCard.tsx
decisions:
  - "SpotlightCard driveCache prop kept as DriveCache | null to match what Map.tsx passes — avoids any caller changes"
  - "formatDriveTime and HomeLocation imports removed from Map.tsx after extraction — no longer used in that file"
  - "useCallback dep array is empty — mapRef is a React ref, .current read at call time, not captured"
metrics:
  duration: "~8 min"
  completed: "2026-04-07"
  tasks_completed: 3
  files_modified: 2
  files_created: 1
---

# Phase 05 Plan 03: React.memo — SpotlightCard extraction and DestinationCard memoisation Summary

Extracted `SpotlightCard` from `Map.tsx` into its own file with `memo()` export, wrapped `DestinationCard` with `memo()`, and stabilised the `onTap` prop reference with `useCallback` — making both memo wrappings effective at preventing unnecessary re-renders.

## What Was Built

**`src/components/SpotlightCard.tsx` (new file):**
- Self-contained component extracted verbatim from Map.tsx lines 116–214
- Imports: `memo` from react, `Destination` type, `DriveCache`/`HomeLocation` types, `formatDriveTime`
- Exported as `export default memo(SpotlightCard)`

**`src/pages/Map.tsx` (modified):**
- Removed the local `SpotlightCard` function definition (99 lines removed)
- Added `import SpotlightCard from '../components/SpotlightCard'`
- Wrapped `handleSpotlightTap` with `useCallback(fn, [])` — stable reference across re-renders
- Removed `formatDriveTime` from driveCache import (no longer used in Map.tsx body)
- Removed `HomeLocation` from types import (no longer used in Map.tsx body)

**`src/components/DestinationCard.tsx` (modified):**
- Added `memo` to the React import
- Converted `export default function DestinationCard(...)` to named function
- Added `export default memo(DestinationCard)` at bottom
- Zero changes to component body, props interface, or callers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `formatDriveTime` import from Map.tsx**
- **Found during:** TypeScript compile check after extraction
- **Issue:** `formatDriveTime` was imported in Map.tsx solely for the SpotlightCard function body; after extraction it became unused
- **Fix:** Removed `formatDriveTime` from the driveCache import line
- **Files modified:** src/pages/Map.tsx
- **Commit:** ad7c2af

**2. [Rule 1 - Bug] Removed unused `HomeLocation` import from Map.tsx**
- **Found during:** TypeScript compile — `error TS6196: 'HomeLocation' is declared but never used`
- **Issue:** `HomeLocation` was used as the inline prop type for SpotlightCard inside Map.tsx; after extraction only `UserProfile` (via `currentUser?.homeLocation`) is needed
- **Fix:** Removed `HomeLocation` from the types import
- **Files modified:** src/pages/Map.tsx
- **Commit:** ad7c2af

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Verification

- TypeScript: `npx tsc --noEmit` — clean (0 errors)
- Build: `npm run build` — succeeds in 4.94s
- Post-conditions:
  - `src/components/SpotlightCard.tsx` exists with `export default memo(SpotlightCard)`
  - Map.tsx has no local `SpotlightCard` function definition
  - Map.tsx imports `SpotlightCard` from `../components/SpotlightCard`
  - `handleSpotlightTap` in Map.tsx uses `useCallback(fn, [])`
  - `DestinationCard` default export is `memo(DestinationCard)`

## Self-Check: PASSED

- `src/components/SpotlightCard.tsx` — exists
- `src/components/DestinationCard.tsx` — memo export confirmed
- `src/pages/Map.tsx` — SpotlightCard import confirmed, useCallback confirmed
- Commits ad7c2af, 1fd3e4f — present in git log
