---
phase: 07-push-notifications
plan: 03
subsystem: notifications
tags: [fcm, push-notifications, trip-notifications, react, hooks, firestore]

# Dependency graph
requires:
  - phase: 07-push-notifications/07-01
    provides: sendNotification() utility, CF Worker relay
  - phase: 07-push-notifications/07-02
    provides: useFCMSetup hook, fcmToken in UserProfile, allUsers from CrewContext
provides:
  - useTripNotifications hook with onSnapshot-based D-04/D-05/D-07 trigger detection
  - votingStartedAt timestamp written to Firestore on openVoting()
  - D-06 trip_proposed notification in TripSheet, DirectTripSheet, QuickPlanSheet
affects:
  - 07-04-PLAN (shame notifications build on same onSnapshot pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - onSnapshot status transition detection via prevStatuses Map + docChanges() loop
    - Session-scoped deduplication via notifiedKeys Set + initialLoad ref flag
    - Cross-session D-07 dedup via Firestore approachingNotifiedAt field
    - Fire-and-forget notification dispatch (no await on sendNotification in creation components)

key-files:
  created:
    - src/hooks/useTripNotifications.ts
  modified:
    - src/utils/tripActions.ts
    - src/App.tsx
    - src/components/TripSheet.tsx
    - src/components/DirectTripSheet.tsx
    - src/components/QuickPlanSheet.tsx

key-decisions:
  - "Notification dispatch in onSnapshot hook (not in tripActions.ts action functions) — action functions stay pure Firestore writes; notification side-effects handled by observer pattern"
  - "initialLoad ref skips first onSnapshot batch to avoid re-notifying on app load for existing trip states"
  - "D-06 wired inline in each creation component (not extracted to createTrip utility) — avoids refactoring three components with different addDoc payloads; achieves D-06 fully with minimal scope"
  - "D-07 uses 6.5–7.5 day window check on each confirmed trip snapshot + Firestore approachingNotifiedAt for cross-session dedup"

patterns-established:
  - "Pattern: status transition detection — prevStatuses Map records last known status; docChanges() loop only processes 'modified' events where prevStatus !== current status"
  - "Pattern: getRecipientTokens helper — filters allUsers by recipientUids, excludes currentUid, maps to fcmToken (Pitfall 5 mitigation)"

requirements-completed: [NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05]

# Metrics
duration: ~3 min
completed: 2026-04-08
---

# Phase 07 Plan 03: Notification Triggers (D-04/D-05/D-06/D-07) Summary

**useTripNotifications hook detects voting/confirmed/approaching trip transitions via onSnapshot; all three creation components dispatch D-06 trip_proposed notification after addDoc**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-07T23:41:37Z
- **Completed:** 2026-04-08
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- `tripActions.ts`: `openVoting()` now writes `votingStartedAt: serverTimestamp()` to trip doc
- `useTripNotifications.ts`: new hook using `onSnapshot` to detect trip status transitions and fire push notifications:
  - D-04 `vote_requested`: fires when trip transitions to `voting` from `proposed` or `confirmed`
  - D-05 `trip_confirmed`: fires when trip transitions to `confirmed` from `voting`
  - D-07 `trip_approaching`: fires when confirmed trip is 6.5–7.5 days from departure (once per trip, cross-session dedup via Firestore)
- Session deduplication via `notifiedKeys` Set — prevents re-firing on re-render
- `initialLoad` ref skips first snapshot batch — prevents false triggers on app load
- `getRecipientTokens` helper excludes current user from all notification sends
- D-06 `trip_proposed`: all three creation components (TripSheet, DirectTripSheet, QuickPlanSheet) fire notification after addDoc resolves, before navigating away
- `App.tsx`: `useTripNotifications()` mounted after `useFCMSetup()` in AppContent

## Task Commits

Each task was committed atomically:

1. **Task 1: useTripNotifications hook + tripActions + App.tsx** — `ded87dc` (feat)
2. **Task 2: D-06 trip_proposed in TripSheet, DirectTripSheet, QuickPlanSheet** — `75af1f6` (feat)

## Files Created/Modified

- `src/hooks/useTripNotifications.ts` — Created: onSnapshot hook for D-04/D-05/D-07 triggers with deduplication
- `src/utils/tripActions.ts` — Modified: `openVoting()` adds `votingStartedAt: serverTimestamp()`
- `src/App.tsx` — Modified: import + call `useTripNotifications()`
- `src/components/TripSheet.tsx` — Modified: D-06 notification after addDoc with first selected destination name
- `src/components/DirectTripSheet.tsx` — Modified: D-06 notification after addDoc with locked destination name
- `src/components/QuickPlanSheet.tsx` — Modified: D-06 notification after addDoc with first selected destination name

## Decisions Made

- **Observer pattern for triggers:** Notification dispatch lives in the hook that watches state, not in `tripActions.ts`. Action functions remain pure Firestore writes; side-effects are handled by the observer.
- **D-06 inline, not extracted:** Adding notification after each `addDoc` inline in each component avoids refactoring three components with different payload shapes. Achieves D-06 fully without scope creep.
- **D-07 window 6.5–7.5 days:** Catches the notification exactly once per day check cycle. Firestore `approachingNotifiedAt` provides cross-session dedup guarantee.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] useShameNotifications import in App.tsx from parallel agent**
- **Found during:** Task 2 verification
- **Issue:** App.tsx was modified by the parallel Plan 04 agent to import `useShameNotifications` from `./hooks/useShameNotifications`. This file already existed (Plan 04 created it). No action needed — build passed cleanly.
- **Impact:** None — both hooks coexist correctly in AppContent.

## Known Stubs

None — all notification triggers are wired to real Firestore data. Token lookup uses live `allUsers` from CrewContext. Self-exclusion and deduplication are fully implemented.

## Threat Surface Scan

No new network endpoints or auth paths introduced. `useTripNotifications` reads from Firestore via authenticated `onSnapshot` (same trust boundary as existing contexts). `approachingNotifiedAt` write uses `setDoc` with `merge: true` on an existing authenticated trip doc.

T-07-10 (notification storms) mitigated: `notifiedKeys` Set + `initialLoad` flag.
T-07-11 (self-notification) mitigated: `getRecipientTokens` excludes `auth.currentUser.uid`.

## Self-Check

- [x] `src/hooks/useTripNotifications.ts` exists
- [x] `src/utils/tripActions.ts` contains `votingStartedAt` and `serverTimestamp`
- [x] `src/App.tsx` contains `useTripNotifications()`
- [x] `src/components/TripSheet.tsx` contains `sendNotification` and `proposed a trip`
- [x] `src/components/DirectTripSheet.tsx` contains `sendNotification` and `proposed a trip`
- [x] `src/components/QuickPlanSheet.tsx` contains `sendNotification` and `proposed a trip`
- [x] Commits `ded87dc` and `75af1f6` exist
- [x] Build passes (`✓ built in 4.91s`)

## Self-Check: PASSED

---
*Phase: 07-push-notifications*
*Completed: 2026-04-08*
