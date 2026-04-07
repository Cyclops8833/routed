---
phase: 07-push-notifications
plan: 04
subsystem: notifications
tags: [fcm, push-notifications, shame, react-hooks, firestore]

# Dependency graph
requires:
  - phase: 07-push-notifications/07-01
    provides: sendNotification() utility
  - phase: 07-push-notifications/07-02
    provides: fcmToken on UserProfile, useFCMSetup pattern
  - phase: 07-push-notifications/07-03
    provides: useTripNotifications pattern, App.tsx hook mounting pattern
provides:
  - useShameNotifications hook -- 72hr + daily shame logic (D-08, D-09)
  - shameLog subcollection schema (trips/{tripId}/shameLog/{uid})
affects: [App.tsx -- shame hook mounted]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure shouldSendShame() function for testable timestamp comparison logic
    - processing ref prevents concurrent onSnapshot handlers double-processing shame
    - Optimistic shameLog write before sendNotification() call for cross-client deduplication
    - shameLog subcollection per user per trip for persistent cross-session shame tracking

key-files:
  created:
    - src/hooks/useShameNotifications.ts
  modified:
    - src/App.tsx

key-decisions:
  - "Write shameLog immediately (before awaiting sendNotification) to prevent concurrent clients from both firing shame for the same user in the same window"
  - "shouldSendShame() extracted as pure function for clarity and testability"
  - "TWENTY_THREE_HOURS_MS (23hr) dedup window allows for daily shame without exact-24hr synchronisation issues"
  - "shameCount=1 uses D-08 eyes emoji message; shameCount>1 uses D-09 'Day N' pointing emoji message"

requirements-completed: [NOTIF-06]

# Metrics
duration: ~10min
completed: 2026-04-08
---

# Phase 07 Plan 04: Shame Notifications Summary

**useShameNotifications hook: 72hr initial shame (D-08) + daily follow-up (D-09) dispatched via CF Worker for non-voters in active voting trips**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-08T00:00:00Z
- **Completed:** 2026-04-08
- **Tasks completed:** 2 of 3 (Task 3 is checkpoint:human-verify)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `useShameNotifications` hook with pure `shouldSendShame()` function
- 72hr threshold check against `votingStartedAt` Timestamp on each onSnapshot fire
- 23hr deduplication window prevents daily shame from firing more than once per ~day
- `shameLog` Firestore subcollection (`trips/{tripId}/shameLog/{uid}`) tracks `lastShamedAt` and `shameCount` for persistent cross-session dedup
- `processing` ref guards against concurrent onSnapshot callbacks double-processing
- D-08 message: "Still waiting on your vote for [TripName] 👀"
- D-09 message: "Day N — still no vote for [TripName] 🫵"
- Mounted `useShameNotifications()` in App.tsx after `useTripNotifications()`
- Build passes cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: useShameNotifications hook** - `1f85f43` (feat)
2. **Task 2: Mount in App.tsx** - `ce125ef` (feat)
3. **Task 3: End-to-end smoke test** - checkpoint (human-verify)

## Files Created/Modified

- `src/hooks/useShameNotifications.ts` — useShameNotifications hook with shouldSendShame() pure function, 72hr + daily shame logic, shameLog subcollection writes
- `src/App.tsx` — Added import and `useShameNotifications()` call after `useTripNotifications()`

## Decisions Made

- **Optimistic shameLog write:** Write `lastShamedAt` to Firestore _before_ calling `sendNotification()`. This prevents two clients that simultaneously detect the shame condition from both firing — the first writer wins, the second will read the updated `lastShamedAt` on the next snapshot and see the 23hr window hasn't elapsed.
- **Pure shouldSendShame function:** Extracted timestamp comparison logic into a pure function for clarity and future testability.
- **23hr window:** Uses 23hr rather than 24hr for the daily dedup window to account for drift — if shame fires at 10:01am one day and 9:58am the next, the 23hr window still allows it through.

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed as written.

**Note:** Plan 03's `useTripNotifications` hook was already present in App.tsx (plan 03 had run in a parallel wave prior to this plan). The shame hook was added after it as specified.

## Known Stubs

None — all data flows wired to real Firestore state. `votingStartedAt` read from trip doc, `shameLog` subcollection read/written per user per trip, FCM tokens sourced from `allUsers` in CrewContext.

## Threat Surface Scan

No new network endpoints or auth paths introduced. `shameLog` subcollection writes are noted in the plan's threat model (T-07-12, T-07-13 accepted at 7-user scale; T-07-14 mitigated by `processing` ref and 23hr dedup window).

## Checkpoint: End-to-end Smoke Test

Task 3 is a `checkpoint:human-verify` gate. The complete push notification system (Plans 01-04) requires user to:

1. Set up VAPID key, CF Worker secrets, deploy worker
2. Verify FCM token registration, notification prompt, and at least one trigger type (vote/propose/confirm)
3. Optionally test shame by setting `votingStartedAt` 73hr in the past in Firestore Console

See Task 3 in 07-04-PLAN.md for full smoke test steps.

---
*Phase: 07-push-notifications*
*Completed: 2026-04-08*
