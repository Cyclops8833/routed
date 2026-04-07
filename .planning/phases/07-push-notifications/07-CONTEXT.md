# Phase 7: Push notifications - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

FCM token registration for each user, plus OS-level push notifications for 6 trigger types: (1) trip moves to voting — vote needed, (2) trip confirmed — locked in, (3) new trip proposed, (4) trip approaching — X days before start, (5) 72hr non-voter shame, (6) daily follow-up shame until voted. Tokens stored in `users/{uid}` Firestore doc. Permission requested contextually. Delivery architecture to be determined by researcher (Spark tier constraint — no Cloud Functions).

</domain>

<decisions>
## Implementation Decisions

### FCM Token Registration
- **D-01:** Add an `fcmToken` field to the existing `users/{uid}` Firestore document. One token per user (last device wins — fine for 7-8 users on single primary devices). No new collection needed.
- **D-02:** Token registration happens in the background — request FCM token on app load if the user has already granted notification permission. Store/refresh in `users/{uid}`.

### Permission Prompt Timing
- **D-03:** Contextual trigger — request notification permission at the moment the first relevant event fires for the user who hasn't opted in yet. Example: when a trip moves to voting, check if current user has granted permission before sending; if not, prompt then. Do NOT prompt on app launch or onboarding. This maximises acceptance rate.

### Notification Triggers (all 6)
- **D-04:** `vote_requested` — fires when a trip transitions to `voting` status. Recipients: all trip attendees who haven't voted yet. Message: "[TripName] needs your vote."
- **D-05:** `trip_confirmed` — fires when a trip transitions to `confirmed` status. Recipients: all trip attendees. Message: "[TripName] is on — check the details."
- **D-06:** `trip_proposed` — fires when a new trip is created. Recipients: all crew members (all users). Message: "[CreatorName] proposed a trip to [DestinationName]."
- **D-07:** `trip_approaching` — fires X days before a confirmed trip's start date. Recipients: all trip attendees. X = 7 days (researcher to confirm reasonable default; this is the first meaningful "countdown" point). Message: "[TripName] is 7 days away."
- **D-08:** `shame_72hr` — fires 72 hours after a trip moves to voting if a crew member has not yet voted. Recipients: non-voters only. Message: "Still waiting on your vote for [TripName] 👀"
- **D-09:** `shame_daily` — fires daily after the 72hr shame until the user votes or the trip moves out of voting state. Recipients: persistent non-voters. Message: "Day [N] — still no vote for [TripName] 🫵"

### Delivery Architecture
- **D-10:** Delivery approach is a **research dependency** — no Cloud Functions on Spark tier. Researcher must determine the viable path: options include client-triggered FCM v1 API calls (requires handling the service account key safely), Cloudflare Worker free tier as thin relay, or falling back to Web Push (VAPID) without FCM. Researcher should evaluate and recommend.

### Extending NotificationContext
- **D-11:** The existing `NotificationContext.tsx` (tracks `unvotedTrips` and `imminentTrips` in-app badge counts) stays unchanged. The push layer is additive — a new `useFCMNotifications()` hook or similar handles token registration and trigger detection independently.

### Claude's Discretion
- Service worker registration pattern for FCM web push
- Exact "X days before" value for `trip_approaching` (researcher may find 7 days is convention)
- Whether shame counter resets if trip creator extends voting deadline
- Notification deduplication (avoid sending same notification twice on re-render)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing notification infrastructure
- `src/contexts/NotificationContext.tsx` — existing in-app badge context; structural pattern for any new notification-related hook or context
- `src/contexts/CrewContext.tsx` — onSnapshot subscription pattern; shows how to react to Firestore state changes in context

### User document shape (token storage target)
- `src/firebase.ts` — db/auth exports
- `src/types.ts` — `UserProfile` type to understand existing fields before adding `fcmToken`

### Trip state transitions (trigger sources)
- `src/pages/Trips.tsx` — trip document structure, status field values (`voting`, `confirmed`, etc.)
- `src/pages/TripDetail.tsx` — confirms trip lifecycle transitions and attendees array shape

### App entry point (provider placement)
- `src/App.tsx` — where new FCM provider/hook should be mounted alongside existing providers

### Requirements for this phase
- `.planning/REQUIREMENTS.md` §REQ-NOTIF — all 8 notification requirements including Spark tier constraint

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/contexts/NotificationContext.tsx` — template for subscription-based context. Handles `onAuthStateChanged` + `onSnapshot` combo. New FCM layer should follow same pattern.
- `src/contexts/CrewContext.tsx` — shows `allUsers: UserProfile[]` from Firestore; FCM trigger detection can use this to know who to notify.
- `src/firebase.ts` — exports `db`, `auth`, and already imports from `firebase/app`. FCM (`getMessaging`, `getToken`) would be added here.

### Established Patterns
- Firestore `onSnapshot` for real-time state — NotificationContext and CrewContext both use this
- `onAuthStateChanged` guard before Firestore subscriptions — standard in all contexts
- Firestore writes to `users/{uid}` — Profile.tsx already writes to this doc; adding `fcmToken` is additive

### Integration Points
- `src/App.tsx` — FCM hook/provider mounts here alongside existing providers
- `users/{uid}` Firestore doc — `fcmToken` field added (existing write path in Profile.tsx)
- Trip status transitions (wherever status is updated to `voting` / `confirmed`) — these are the trigger points for sending notifications

</code_context>

<specifics>
## Specific Ideas

- Shame notifications should feel appropriately guilt-inducing — "Day [N] — still no vote for [TripName] 🫵"
- Permission prompt should appear naturally at the moment the user would *want* the notification — not as a cold ask on load
- Delivery architecture is genuinely unknown — researcher should treat this as the primary investigation task

</specifics>

<deferred>
## Deferred Ideas

- Per-notification-type opt-out preferences (e.g., "I want vote notifications but not shame") — v1.2+
- Rich notifications with action buttons (e.g., "Vote now" deep link in the notification) — add to backlog
- Multi-device support (array of FCM tokens per user) — deferred; single token fine at 7-user scale

</deferred>

---

*Phase: 07-push-notifications*
*Context gathered: 2026-04-08*
