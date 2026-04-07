---
phase: "05"
plan: "01"
subsystem: "data-layer"
tags: [firestore, context, performance, react]
dependency_graph:
  requires: []
  provides: [CrewContext, useCrewContext]
  affects: [Map, TripSheet, DirectTripSheet, QuickPlanSheet, Trips, Crew, TripDetail, Availability, App]
tech_stack:
  added: [CrewContext (onSnapshot-based shared subscription)]
  patterns: [React Context, onAuthStateChanged guard, useMemo for derived data]
key_files:
  created:
    - src/contexts/CrewContext.tsx
  modified:
    - src/App.tsx
    - src/pages/Map.tsx
    - src/pages/Trips.tsx
    - src/pages/Crew.tsx
    - src/pages/TripDetail.tsx
    - src/pages/Availability.tsx
    - src/components/TripSheet.tsx
    - src/components/DirectTripSheet.tsx
    - src/components/QuickPlanSheet.tsx
decisions:
  - "CrewProvider wraps NotificationProvider (outer) in App.tsx — ordering is arbitrary, outer chosen for symmetry"
  - "Availability.tsx migrated as undocumented 8th callsite — same pattern, same fix"
  - "TripDetail attendeeProfiles converted from useState+useEffect to useMemo — re-derives whenever allUsers or trip.attendees changes"
  - "Map.tsx getDocs kept for trips hasTrips check — only the users collection getDocs was removed"
  - "crewMembersRef kept in sync via dedicated useEffect([allUsers]) — required for Mapbox popup closures (D-05)"
metrics:
  duration: "~20 min"
  completed: "2026-04-07"
  tasks_completed: 9
  files_modified: 9
  files_created: 1
---

# Phase 05 Plan 01: CrewContext — eliminate duplicate Firestore reads Summary

Single `onSnapshot(collection(db,'users'))` subscription in CrewContext replaces 8 independent `getDocs` calls across all pages and sheets, eliminating duplicate Firestore reads on every page load.

## What Was Built

Created `src/contexts/CrewContext.tsx` — a React context that:
- Guards the `onSnapshot` subscription behind `onAuthStateChanged` (uid !== null), matching the NotificationContext pattern
- Exposes `allUsers: UserProfile[]` to any component via `useCrewContext()`
- Clears `allUsers` to `[]` on sign-out

Mounted `CrewProvider` in `App.tsx` as the outer wrapper around `NotificationProvider`.

Migrated 8 callsites (7 planned + 1 discovered):

| File | Old pattern | New pattern |
|------|-------------|-------------|
| Map.tsx | `getDocs(collection(db,'users'))` in loadCrewMarkers | `useCrewContext()` + marker useEffect on `[mapLoaded, allUsers]` |
| TripSheet.tsx | async `loadCrew` getDocs | synchronous useEffect on `[allUsers]` |
| DirectTripSheet.tsx | getDocs then | synchronous useEffect on `[allUsers]` |
| QuickPlanSheet.tsx | async `loadCrew` getDocs | synchronous useEffect on `[allUsers]` |
| Trips.tsx | getDocs → setAllMembers state | `const { allUsers: allMembers } = useCrewContext()` (state removed) |
| Crew.tsx | async `loadCrew` getDocs | useEffect `setMembers(allUsers)` on `[allUsers]` |
| TripDetail.tsx | getDocs with where('uid','in') query | `useMemo` filter of `allUsers` on `[allUsers, trip?.attendees.join(',')]` |
| Availability.tsx | getDocs → setAllMembers state | `const { allUsers: allMembers } = useCrewContext()` (state removed) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored `collection` import in TripSheet, DirectTripSheet, QuickPlanSheet**
- **Found during:** Tasks 4-6 TypeScript compile
- **Issue:** Removing `getDocs` from the firestore import accidentally dropped `collection`, which is still needed for `addDoc(collection(db, 'trips'), ...)`
- **Fix:** Added `collection` back to each firestore import
- **Files modified:** TripSheet.tsx, DirectTripSheet.tsx, QuickPlanSheet.tsx
- **Commit:** ba50e11

**2. [Rule 2 - Missing migration] Migrated undocumented 8th callsite in Availability.tsx**
- **Found during:** Post-task grep verification
- **Issue:** `Availability.tsx` had an identical `getDocs(collection(db,'users'))` pattern not listed among the 7 planned callsites
- **Fix:** Applied the same context migration pattern (replaced state + getDocs with `const { allUsers: allMembers } = useCrewContext()`)
- **Files modified:** src/pages/Availability.tsx
- **Commit:** ae98307

**3. [Rule 1 - Bug] Restored `getDocs` import in Map.tsx**
- **Found during:** TypeScript compile after Task 3
- **Issue:** Map.tsx still uses `getDocs` for the trips hasTrips check (`getDocs(q)` on trips collection — not users). The import was removed when removing the users getDocs.
- **Fix:** Added `getDocs` back to the firestore import in Map.tsx
- **Files modified:** src/pages/Map.tsx
- **Commit:** ae98307

## Known Stubs

None — all data flows are wired from the live Firestore subscription.

## Verification

- TypeScript: `npx tsc --noEmit` — clean (0 errors)
- Build: `npm run build` — succeeds in 4.78s
- Post-condition grep: zero `getDocs(collection(db, 'users'))` in any migrated file
- Post-condition grep: zero `where('uid', 'in', ...)` on users in TripDetail

## Self-Check: PASSED

- `src/contexts/CrewContext.tsx` — exists
- Commits 88ed02b, ba50e11, ae98307 — all present in git log
- Zero remaining `getDocs(collection(db,'users'))` across all migrated files
