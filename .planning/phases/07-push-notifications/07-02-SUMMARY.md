---
phase: 07-push-notifications
plan: 02
subsystem: ui
tags: [fcm, firebase, push-notifications, react, hooks]

# Dependency graph
requires:
  - phase: 07-push-notifications/07-01
    provides: messaging export from firebase.ts, fcmToken on UserProfile (added here as deviation)
provides:
  - useFCMSetup hook — FCM token registration/refresh on auth state change, requestPermission() for contextual prompting
  - NotificationPrompt component — contextual permission banner triggered by unvotedTrips > 0
  - messaging export on firebase.ts (getMessaging with iOS/SSR guard)
  - fcmToken?: string field on UserProfile type
affects:
  - 07-03-PLAN
  - 07-04-PLAN

# Tech tracking
tech-stack:
  added: [firebase/messaging (getToken, getMessaging — already in firebase package)]
  patterns:
    - useFCMSetup hook with onAuthStateChanged listener mirrors NotificationContext subscription pattern
    - tokenRegistered ref prevents duplicate getToken calls on re-render
    - Firestore setDoc with merge:true only writes if token changed

key-files:
  created:
    - src/hooks/useFCMSetup.ts
    - src/components/NotificationPrompt.tsx
  modified:
    - src/firebase.ts
    - src/types/index.ts
    - src/App.tsx

key-decisions:
  - "useFCMSetup called unconditionally at top of AppContent (before early returns) to satisfy React rules-of-hooks; hook handles unauthenticated state internally via onAuthStateChanged"
  - "messaging and fcmToken prerequisites added in this plan (Deviation Rule 3) since Plan 01 runs in parallel and file sets do not overlap"
  - "tokenRegistered ref resets to false on sign-out to allow re-registration on next sign-in"

patterns-established:
  - "Pattern: FCM guard triple: 'Notification' in window + messaging !== null + Notification.permission === 'granted'"
  - "Pattern: Contextual prompt — only shows when isSupported + permission=default + relevant event (unvotedTrips>0) + not dismissed"

requirements-completed: [NOTIF-01, NOTIF-08]

# Metrics
duration: 15min
completed: 2026-04-08
---

# Phase 07 Plan 02: FCM Token Registration and Contextual Permission Prompt Summary

**useFCMSetup hook registers/refreshes FCM token in users/{uid}.fcmToken on auth state change; NotificationPrompt shows contextual permission banner when user has unvoted trips**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-08T00:00:00Z
- **Completed:** 2026-04-08T00:15:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `useFCMSetup` hook: auto-registers/refreshes FCM token on auth state change when permission already granted; exposes `requestPermission()` for contextual prompting
- Created `NotificationPrompt` component: non-intrusive bottom banner that only appears when `unvotedTrips > 0` and permission is `default` — never on app launch
- Added `messaging` export to `firebase.ts` with iOS/SSR guard (`'Notification' in window`)
- Added `fcmToken?: string` to `UserProfile` type
- Mounted `useFCMSetup()` unconditionally at the top of `AppContent` in `App.tsx`

## Task Commits

Each task was committed atomically:

1. **Task 1: useFCMSetup hook** - `a4e2340` (feat)
2. **Task 2: NotificationPrompt + App.tsx** - `a2c233f` (feat)

## Files Created/Modified
- `src/hooks/useFCMSetup.ts` - FCM token registration hook with registerToken + requestPermission
- `src/components/NotificationPrompt.tsx` - Contextual notification permission prompt banner
- `src/firebase.ts` - Added getMessaging export with iOS/SSR guard
- `src/types/index.ts` - Added fcmToken?: string to UserProfile
- `src/App.tsx` - Mounted useFCMSetup() and rendered NotificationPrompt in Layout

## Decisions Made
- Placed `useFCMSetup()` call at the top of `AppContent` (before early returns) to satisfy React rules-of-hooks. The hook handles the unauthenticated case internally via `onAuthStateChanged`, so calling it unconditionally is correct.
- `tokenRegistered` ref resets to `false` on sign-out, allowing re-registration when the user signs back in on the same session.
- `registerToken` only writes to Firestore if the token value has changed, avoiding redundant writes on every app load.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added messaging export and fcmToken type before they existed**
- **Found during:** Task 1 (useFCMSetup hook creation)
- **Issue:** `useFCMSetup.ts` imports `messaging` from `../firebase` and writes `fcmToken` to Firestore, but Plan 01 (parallel wave-1 peer) hadn't yet added these. Without them the build would fail.
- **Fix:** Added `getMessaging` import + `messaging` export to `src/firebase.ts`; added `fcmToken?: string` to `UserProfile` in `src/types/index.ts`. These are the exact same changes Plan 01 Task 1 specifies — no overlap since file sets don't conflict.
- **Files modified:** `src/firebase.ts`, `src/types/index.ts`
- **Verification:** Build passes after changes
- **Committed in:** `a4e2340` (Task 1 commit)

**2. [Rule 1 - Bug] Moved useFCMSetup() call to before early returns**
- **Found during:** Task 2 (App.tsx update)
- **Issue:** Plan spec said to add hook call after the `!profile` guard, which would be a conditional hook call — violates React rules-of-hooks.
- **Fix:** Moved `useFCMSetup()` to immediately after `useAuth()` at the top of `AppContent`, before any early returns. Hook handles unauthenticated/loading state internally.
- **Files modified:** `src/App.tsx`
- **Verification:** Build passes, no lint errors
- **Committed in:** `a2c233f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## Known Stubs
None — all data flows are wired. `isSupported`, `permission`, `unvotedTrips` all come from real runtime values.

## User Setup Required
None for this plan — VAPID key (`VITE_FIREBASE_VAPID_KEY`) is needed at runtime but is documented in Plan 01's user setup. This plan's code gracefully warns and skips if the key is absent.

## Next Phase Readiness
- `useFCMSetup` and `NotificationPrompt` are complete prerequisites for Plans 03 and 04
- `requestPermission()` is exported from `useFCMSetup` — notification trigger hooks (Plan 03) can import and call it when a relevant event fires
- FCM token stored in `users/{uid}.fcmToken` — Plans 03/04 can read tokens from CrewContext user profiles to send notifications

---
*Phase: 07-push-notifications*
*Completed: 2026-04-08*
