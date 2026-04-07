# Phase 7: Push Notifications - Research

**Researched:** 2026-04-08
**Domain:** Firebase Cloud Messaging (FCM) web push, Cloudflare Workers, browser Notification API
**Confidence:** HIGH (delivery architecture), HIGH (FCM web SDK), MEDIUM (shame timing), HIGH (trigger points)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `fcmToken` field added to existing `users/{uid}` Firestore document. One token per user (last device wins). No new collection.
- **D-02:** Token registration in background — request FCM token on app load if permission already granted. Store/refresh in `users/{uid}`.
- **D-03:** Contextual permission prompt — request at the moment a relevant event fires for a user who hasn't opted in. NOT on app launch or onboarding.
- **D-04:** `vote_requested` — trip transitions to `voting`. Recipients: attendees who haven't voted. Message: "[TripName] needs your vote."
- **D-05:** `trip_confirmed` — trip transitions to `confirmed`. Recipients: all attendees. Message: "[TripName] is on — check the details."
- **D-06:** `trip_proposed` — new trip created. Recipients: all crew (all users). Message: "[CreatorName] proposed a trip to [DestinationName]."
- **D-07:** `trip_approaching` — X days before confirmed trip's start date. Recipients: all attendees. Message: "[TripName] is 7 days away." (X = 7)
- **D-08:** `shame_72hr` — 72 hours after trip moves to voting, non-voters only. Message: "Still waiting on your vote for [TripName] 👀"
- **D-09:** `shame_daily` — daily after 72hr shame until user votes or trip moves out of voting. Message: "Day [N] — still no vote for [TripName] 🫵"
- **D-10:** Delivery architecture — **research dependency** (now resolved — see Primary Recommendation below)
- **D-11:** New `useFCMNotifications()` hook alongside existing `NotificationContext.tsx`. Existing context stays unchanged.

### Claude's Discretion
- Service worker registration pattern for FCM web push
- Exact "X days before" value for `trip_approaching` (confirmed: 7 days is standard)
- Whether shame counter resets if trip creator extends voting deadline
- Notification deduplication (avoid sending same notification twice on re-render)

### Deferred Ideas (OUT OF SCOPE)
- Per-notification-type opt-out preferences — v1.2+
- Rich notifications with action buttons — backlog
- Multi-device support (array of FCM tokens) — deferred
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-01 | Users can opt in to push notifications (FCM token registration) | FCM web SDK + getToken pattern documented |
| NOTIF-02 | Notification sent when trip moves to voting | `openVoting()` in tripActions.ts is the trigger point |
| NOTIF-03 | Notification sent when trip is confirmed | `closeVoting()` in tripActions.ts is the trigger point |
| NOTIF-04 | Notification sent when new trip is proposed | `addDoc(collection(db, 'trips'), ...)` in TripSheet/DirectTripSheet/QuickPlanSheet |
| NOTIF-05 | Reminder X days before confirmed trip start date | Client-side check on `onSnapshot` confirmed trips; timestamp comparison pattern established |
| NOTIF-06 | Shame notification after threshold period without voting | Client-side timer architecture documented below |
| NOTIF-07 | Delivery within Firebase Spark tier (no Cloud Functions) | Cloudflare Worker free tier — primary recommendation |
| NOTIF-08 | FCM tokens stored in Firestore per user, refreshed on app load | Pattern: getToken on load if permission granted, setDoc to users/{uid} |
</phase_requirements>

---

## Summary

The primary blocker — delivery architecture on Spark tier — has a clean answer: **a Cloudflare Worker (free tier) acting as a stateless FCM relay**. The React client detects state transitions via its existing `onSnapshot` subscriptions, then calls the Cloudflare Worker endpoint with the target FCM tokens and message payload. The Worker authenticates to Google's FCM HTTP v1 API using a service account stored as a Worker Secret, then dispatches the notification. No Firebase billing upgrade required.

FCM's web SDK is straightforward to add to the existing codebase. The project already uses `vite-plugin-pwa`, which creates a complication: FCM requires its own `firebase-messaging-sw.js` service worker, and running two service workers causes conflicts. The solution is to use the `injectManifest` strategy in VitePWA, which lets a single custom service worker handle both Workbox caching and FCM background messages.

Shame notifications (D-08, D-09) cannot use server-side scheduling on Spark tier. The viable approach is **client-side timestamp comparison**: the trip document stores a `votingStartedAt` timestamp; on each app load (and via `onSnapshot`), the hook checks whether 72+ hours have passed for each non-voter. If the condition is met and the user has not yet been shamed today (tracked via a `lastShamedAt` field in Firestore), the client fires the notification via the Cloudflare Worker relay. This is imperfect (requires app open) but is documented as acceptable given the 7-user scale.

**Primary recommendation:** Cloudflare Worker as FCM relay + client-side trigger detection + VitePWA `injectManifest` strategy for service worker.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase/messaging` | 10.12.0 (already installed) | FCM token registration, foreground message handler | Part of Firebase JS SDK — already a dependency [VERIFIED: package.json] |
| `firebase/messaging/sw` | 10.12.0 | Service worker background message handler | Same SDK, different entry point for SW context [VERIFIED: Firebase docs] |

### Infrastructure

| Service | Cost | Purpose | Notes |
|---------|------|---------|-------|
| Cloudflare Workers | Free tier (100k req/day) | FCM HTTP v1 relay — sends notifications on behalf of client | Verified free tier adequate for 7-user app [VERIFIED: Cloudflare docs] |
| Firebase Cloud Messaging | Free (Spark) | Token management, push delivery to browsers | No quota for FCM sends [VERIFIED: Firebase docs] |

### No New npm Packages Required

`firebase` (v10.12.0) already installed includes `firebase/messaging`. No additional packages needed. [VERIFIED: package.json]

**VAPID key:** Must be generated in Firebase Console → Project Settings → Cloud Messaging → Web Push certificates. Stored as `VITE_FIREBASE_VAPID_KEY` env var. [CITED: firebase.google.com/docs/cloud-messaging/js/client]

---

## Architecture Patterns

### Delivery Architecture: Cloudflare Worker as FCM Relay

**The core problem:** FCM HTTP v1 API requires a service account (private key) for authentication. Private keys must never be embedded in client-side JavaScript. Firebase Cloud Functions would normally hold this key, but Cloud Functions require Blaze (paid) tier.

**The solution:** A Cloudflare Worker (free) acts as the trusted relay:

```
React client (detects state change via onSnapshot)
  → POST to Cloudflare Worker endpoint
  → Worker authenticates to Google OAuth2 using service account secret
  → Worker calls FCM HTTP v1 API: POST https://fcm.googleapis.com/v1/projects/{projectId}/messages:send
  → FCM delivers push to browser via registered FCM token
```

**Security posture:** The Cloudflare Worker endpoint is the only surface that holds the service account key (as a Worker Secret, encrypted at rest). The endpoint should validate that the caller is authenticated — the simplest approach is to require the caller to include the Firebase Auth ID token (JWT) in the request header, and have the Worker verify it against Firebase's public keys before dispatching. This prevents arbitrary external callers from triggering notifications.

**Authentication flow for Worker requests:**
```typescript
// Client: get current user's ID token
const idToken = await auth.currentUser?.getIdToken()
// Include in request:
fetch('https://your-worker.workers.dev/notify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ tokens: [...], notification: { title, body } })
})
```

**Why not Web Push (VAPID) without FCM?**
Web Push with raw VAPID works on Chrome/Firefox but requires a separate VAPID key pair, a VAPID-compliant push server, and does not use FCM token infrastructure. It would require more server-side work and abandons the existing FCM token design (D-01). Not recommended. [ASSUMED — no official comparative benchmark found, rationale is architectural coherence]

**Why not client-side FCM v1 API calls?**
The FCM HTTP v1 API requires a Google OAuth2 access token derived from a service account. Embedding a service account private key in client-side JavaScript is a critical security vulnerability — any user inspecting the bundle can extract it and send notifications to any FCM token. This option is definitively ruled out. [CITED: firebase.google.com/docs/cloud-messaging/js/client]

**Why not Firebase Admin SDK from client?**
Firebase Admin SDK is Node.js/server-only. It bundles `google-auth-library` which requires Node crypto APIs unavailable in browsers. Not viable. [VERIFIED: Firebase docs — SDK explicitly states it does not work in browser context]

### Recommended Project Structure

```
src/
├── hooks/
│   └── useFCMNotifications.ts    # New hook: token registration + trigger detection
├── firebase.ts                   # Add: getMessaging export
├── types/index.ts                # Add: fcmToken to UserProfile
public/
├── firebase-messaging-sw.js      # FCM background message handler (static, not bundled)
cloudflare-worker/
├── src/
│   └── index.ts                  # FCM relay Worker
├── wrangler.toml                 # Worker config + cron schedule
```

### Pattern 1: FCM Token Registration Hook

```typescript
// src/hooks/useFCMNotifications.ts
// Source: [CITED: firebase.google.com/docs/cloud-messaging/js/client]

import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc } from 'firebase/firestore'
import { db, auth } from '../firebase'

export function useFCMNotifications() {
  const messaging = getMessaging()

  async function registerToken() {
    const permission = Notification.permission
    if (permission !== 'granted') return null

    const swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    if (token && auth.currentUser) {
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        { fcmToken: token },
        { merge: true }
      )
    }
    return token
  }

  return { registerToken }
}
```

### Pattern 2: Service Worker (firebase-messaging-sw.js)

Place in `public/` folder. FCM SDK requires this file at the root of the domain. [CITED: firebase.google.com/docs/cloud-messaging/js/client]

```javascript
// public/firebase-messaging-sw.js
// NOTE: Cannot use import.meta.env — must use importScripts or hardcoded config
// Use VitePWA injectManifest strategy to enable Workbox + FCM in same SW

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: '__VITE_FIREBASE_API_KEY__',        // replaced at build time
  authDomain: '__VITE_FIREBASE_AUTH_DOMAIN__',
  projectId: '__VITE_FIREBASE_PROJECT_ID__',
  storageBucket: '__VITE_FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__VITE_FIREBASE_APP_ID__',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {}
  self.registration.showNotification(title ?? 'Routed', { body, icon: '/icon-192.png' })
})
```

**Vite build concern:** Environment variables are not accessible in service workers. Two approaches:
1. Use `importScripts` with the compat SDK and replace placeholders at build time with a Vite plugin (see Pitfall 2 below) — simpler
2. Use VitePWA `injectManifest` strategy with the service worker as a Vite entry point to get `import.meta.env` support — more complex but enables tree-shaking

**For this project, approach 1 (placeholder replacement) is recommended** given the simple background message handler needed. [ASSUMED — approach 2 is more standard but overkill for this use case]

### Pattern 3: VitePWA injectManifest (if approach 2 chosen)

```typescript
// vite.config.ts addition
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'firebase-messaging-sw.ts',  // compiled from src/
  // ...existing manifest config
})
```

This compiles `src/firebase-messaging-sw.ts` into `dist/firebase-messaging-sw.js` with `import.meta.env` support and injects the Workbox precache manifest. [CITED: vite-plugin-pwa docs / medium.com/@daeram.chung/fcm-service-worker-vite]

### Pattern 4: Cloudflare Worker (FCM Relay)

```typescript
// cloudflare-worker/src/index.ts
// Service account JSON stored as Worker Secret: FIREBASE_SERVICE_ACCOUNT_JSON

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. Verify Firebase Auth ID token from Authorization header
    // 2. Extract tokens + message from request body
    // 3. Get Google OAuth2 access token from service account JWT
    // 4. POST to https://fcm.googleapis.com/v1/projects/{projectId}/messages:send
    // 5. Return result
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // CRON: check Firestore for pending shame notifications
    // (requires Firestore REST API — no firebase-admin in CF Workers)
  }
}
```

**Note on CRON in CF Workers:** Cloudflare Workers support CRON triggers (`scheduled` handler) on the free tier. However, querying Firestore from a CF Worker requires the Firestore REST API (not the JS SDK). For the shame use case, the recommended approach is client-side checking (see Shame Timing section), not Worker CRON. [VERIFIED: Cloudflare pricing docs — free tier confirmed; ASSUMED — Firestore REST from CF Worker is viable but complex]

### Anti-Patterns to Avoid

- **Embedding service account key in client bundle:** Critical security vulnerability — any user can exfiltrate it.
- **Calling FCM HTTP v1 API directly from browser:** Same as above — requires service account auth.
- **Two independent service workers (VitePWA + FCM):** Causes constant reload loops. Use one service worker that handles both concerns. [VERIFIED: github.com/vite-pwa/vite-plugin-pwa/issues/777]
- **Sending duplicate notifications on re-render:** `onSnapshot` fires on every Firestore update including ones initiated by the current client. Deduplication is required (see Pitfall 4).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FCM HTTP v1 auth | Custom OAuth2 JWT signing | `fcm-cloudflare-workers` npm package OR Cloudflare Google OAuth helper | JWT RS256 signing for Google service accounts is complex and error-prone |
| Browser permission prompting | Custom permission UI framework | Native `Notification.requestPermission()` | Browser API is sufficient; iOS has specific requirements that custom UI must still delegate to |
| Background message display | Custom SW notification logic | `onBackgroundMessage` from `firebase/messaging/sw` | Handles edge cases including notification deduplication by FCM |
| Token staleness detection | Custom expiry tracking | Firebase `UNREGISTERED` / `INVALID_ARGUMENT` error responses | FCM signals token invalidity via HTTP error codes on send; handle in Worker response |

**Key insight:** The hardest part of this phase is the delivery architecture, not the client code. The FCM client SDK is small and well-documented. The Cloudflare Worker relay is ~100 lines and handles all the server-side complexity.

---

## Runtime State Inventory

Step 2.5: SKIPPED — this is a greenfield feature addition, not a rename/refactor/migration phase. No existing runtime state needs migration.

---

## Trigger Points in Codebase

This is the most important codebase-specific finding for the planner.

### Where Trip Status Transitions Happen

All status transitions are centralised in `src/utils/tripActions.ts`. This is the correct place to add notification dispatch calls (or call the notification hook after await). [VERIFIED: codebase grep]

| Function | File | Transition | Notification Trigger |
|----------|------|-----------|----------------------|
| `openVoting(tripId, deadline?)` | `src/utils/tripActions.ts:4` | `proposed → voting` | D-04 `vote_requested` — notify all attendees who haven't voted |
| `closeVoting(tripId, winnerDestId)` | `src/utils/tripActions.ts:12` | `voting → confirmed` | D-05 `trip_confirmed` — notify all attendees |
| `reopenVoting(tripId)` | `src/utils/tripActions.ts:46` | `confirmed → voting` | D-04 again — notify all attendees (re-vote required) |

**Trip creation (proposed)** happens in three separate components — no single utility function. [VERIFIED: codebase grep]

| Component | File | Notification Trigger |
|-----------|------|----------------------|
| `TripSheet` | `src/components/TripSheet.tsx:155` | D-06 `trip_proposed` — after `addDoc` resolves |
| `DirectTripSheet` | `src/components/DirectTripSheet.tsx:84` | D-06 `trip_proposed` — after `addDoc` resolves |
| `QuickPlanSheet` | `src/components/QuickPlanSheet.tsx:151` | D-06 `trip_proposed` — after `addDoc` resolves |

**Recommendation:** Create a `createTrip()` utility function (mirroring the pattern of tripActions.ts) that wraps the `addDoc` call and fires D-06 notification. Then replace the three duplicate `addDoc` calls with it. This also eliminates code duplication.

### Attendee FCM Tokens

To send notifications, the sending client must:
1. Read `users/{uid}` for each target attendee to get their `fcmToken`
2. Include all non-null tokens in the payload to the Cloudflare Worker

`CrewContext` already provides `allUsers: UserProfile[]`. After `fcmToken` is added to `UserProfile`, the hook can filter tokens from `allUsers` without extra Firestore reads. [VERIFIED: src/contexts/CrewContext.tsx pattern, src/types/index.ts]

### D-07 (trip_approaching): Where to Hook

The existing `NotificationContext.tsx` already queries confirmed trips departing within 7 days via `onSnapshot`. The FCM hook can use the same `onSnapshot` subscription result to detect when to fire D-07. The 7-day window matches the existing `imminentTrips` logic. [VERIFIED: src/contexts/NotificationContext.tsx:74-99]

**Deduplication for D-07:** Must store `lastApproachingNotifiedAt` (or a `notifiedApproaching: true` flag) on the trip doc to avoid re-firing on each app load.

---

## Shame Timing Architecture (D-08, D-09)

**The fundamental constraint:** No server-side scheduling on Spark tier. Cloud Functions (which could run on a schedule) are Blaze-only.

### Client-Side Timestamp Comparison Approach (Recommended)

**How it works:**
1. When `openVoting()` is called, write `votingStartedAt: serverTimestamp()` to the trip doc (add this field).
2. In `useFCMNotifications`, the `onSnapshot` subscription on voting trips checks:
   - Has 72+ hours elapsed since `votingStartedAt`?
   - Has the current user voted? (check `trips/{id}/votes/{uid}` — same pattern as NotificationContext)
   - Has the shame notification already been sent today? (check `trips/{id}/shameLog/{uid}` subcollection OR a `lastShamedAt` Timestamp field in the trip's votes subcollection)
3. If all conditions met: fire notification via Cloudflare Worker, write `lastShamedAt: serverTimestamp()` to Firestore.

**Fields to add to trip doc:**
- `votingStartedAt: Timestamp` — set by `openVoting()`

**Fields to add to `trips/{tripId}/votes/{uid}` doc** (or a new `trips/{tripId}/shameLog/{uid}` doc):
- `lastShamedAt: Timestamp | null`
- `shameCount: number` (for the "Day [N]" counter in D-09)

**Shame daily counter:** `shameCount` increments each time a shame notification fires. D-09 message uses `shameCount` as N.

**Limitation acknowledged:** Shame only fires when an app user opens the app. For a 7-person crew where everyone opens the app daily, this is fine. The non-voter themselves does not need to open the app — *any* voter who has the app open will detect the condition and fire the notification to the non-voter. This means the notification can still arrive even if the non-voter never opens the app, as long as someone else does. [ASSUMED — this multi-sender approach could cause duplicate fires; deduplication via `lastShamedAt` is essential]

**Deduplication for shame:** Before firing, check `lastShamedAt`. Only fire if `Date.now() - lastShamedAt > 23 hours`. Write new `lastShamedAt` immediately (optimistic update acceptable — worst case: two senders fire within the same second, user gets two notifications. Acceptable at 7-user scale).

### Alternative: Cloudflare Worker CRON

A CF Worker scheduled handler could query Firestore REST API daily to find stale voters. This is more reliable (fires regardless of who has the app open) but adds complexity: Firestore REST auth from CF Worker, and the Worker needs to know all trip/user state. **Deferred to backlog** — the client-side approach is sufficient for MVP at 7 users. [ASSUMED — Firestore REST from CF Worker is technically viable but adds 2-3x implementation complexity]

---

## Browser Notification Permission API

### Standard Flow

```typescript
// Source: [CITED: MDN Web Docs / Firebase docs]
const permission = await Notification.requestPermission()
// Returns: 'granted' | 'denied' | 'default'
```

**D-03 Implementation:** Call `requestPermission()` only inside a user gesture handler (button click). For contextual prompting:

```typescript
// Example: When user opens TripDetail and trip is in voting status
async function promptForNotifications() {
  if (Notification.permission !== 'default') return  // Already decided
  const permission = await Notification.requestPermission()
  if (permission === 'granted') {
    await registerToken()
  }
}
```

### iOS Safari Limitations

[VERIFIED: Apple Developer Docs / MagicBell blog]

| Condition | Behavior |
|-----------|---------|
| Safari on iOS 16.4+, app installed as PWA (Add to Home Screen) | Push notifications supported |
| Safari in browser tab (not installed) | Push API NOT available — `Notification` is undefined or permission always denied |
| EU users on iOS 17.4+ | PWA standalone mode removed; web push not available |
| iOS < 16.4 | No web push support at all |

**PWA manifest requirement:** `display: "standalone"` must be set — already the case in `vite.config.ts`. [VERIFIED: vite.config.ts:79]

**Practical implication for Routed:** Users who access via browser tab on iOS will not receive push notifications. This is a known platform limitation. The permission prompt should gracefully handle `Notification === undefined` (guard with `'Notification' in window`).

```typescript
// Guard for environments without Notification API
if (!('Notification' in window)) {
  console.log('Push notifications not supported in this browser')
  return
}
```

---

## FCM Token Lifecycle

[CITED: firebase.google.com/docs/cloud-messaging/manage-tokens]

| Scenario | Token Status | Action |
|----------|-------------|--------|
| App load, permission already granted | Existing token valid | Call `getToken()`, update Firestore if changed |
| Permission newly granted | New token generated | Call `getToken()`, write to Firestore |
| Token > 1 month inactive | May be stale | FCM returns `UNREGISTERED` on send; Worker should delete token from Firestore |
| App reinstall / cache clear | New token generated | `getToken()` returns new value; write to Firestore overwrites old |
| iOS/Android: 270 days no connect | Token expired | FCM returns `INVALID_ARGUMENT`; delete from Firestore |

**Refresh strategy for this app (D-02):**
- On every app load, if `Notification.permission === 'granted'`, call `getToken()` and write result to `users/{uid}.fcmToken`. This is cheap (returns cached token if unchanged) and ensures the stored token stays current. [CITED: firebase.google.com/docs/cloud-messaging/manage-tokens — "update frequency of once per month is sufficient" but on-load is fine for small apps]

**Token change detection:** `getToken()` returns the current valid token. Compare with stored `fcmToken`; only write to Firestore if different to avoid unnecessary writes.

---

## Common Pitfalls

### Pitfall 1: Two Service Workers Causing Reload Loop
**What goes wrong:** Adding `firebase-messaging-sw.js` as a separate service worker alongside VitePWA's generated service worker causes constant page reloads after PWA updates.
**Why it happens:** Two service workers compete for control of the same scope. The VitePWA `autoUpdate` strategy triggers on the FCM SW update too.
**How to avoid:** Use one service worker. Either (a) put Firebase messaging init inside the VitePWA-managed SW via `injectManifest` strategy, or (b) register `firebase-messaging-sw.js` at a distinct scope (`/firebase-cloud-msg-push-sw.js`) and pass the registration explicitly to `getToken()`.
**Warning signs:** Page reloads every ~5 seconds in production. Two service workers visible in DevTools → Application → Service Workers.
[VERIFIED: github.com/vite-pwa/vite-plugin-pwa/issues/777]

### Pitfall 2: Environment Variables in Service Worker
**What goes wrong:** `import.meta.env.VITE_FIREBASE_API_KEY` is undefined in service workers — SW runs in a separate context outside Vite's module graph.
**Why it happens:** Service workers are not bundled with the rest of the app in Vite's default config.
**How to avoid:** Two options: (a) Use `importScripts` with the Firebase compat CDN and replace config placeholders with a custom Vite plugin, or (b) Use VitePWA `injectManifest` strategy to build the SW as a Vite entry point (gains `import.meta.env` support).
**Warning signs:** Firebase initialization fails silently in SW; background notifications never arrive.
[CITED: medium.com/@daeram.chung/fcm-service-worker-vite]

### Pitfall 3: Permission Prompt on Page Load
**What goes wrong:** Calling `Notification.requestPermission()` on app mount triggers the browser permission dialog immediately. Users dismiss it. On iOS, calling outside a user gesture silently fails.
**Why it happens:** FCM token registration is often naively placed in `useEffect` on mount.
**How to avoid:** D-03 is already the correct approach — only call `requestPermission()` inside a click handler at a contextually relevant moment.
**Warning signs:** Permission denied rate approaches 100%; no tokens ever stored in Firestore.

### Pitfall 4: Notification Storms on Re-render
**What goes wrong:** `onSnapshot` fires every time any field on a trip document changes. If the notification trigger condition is evaluated naively, every Firestore update causes a notification to be re-sent.
**Why it happens:** The `onSnapshot` callback doesn't distinguish between the initial load and subsequent changes.
**How to avoid:** Use Firestore's `docChanges()` API with `type === 'modified'` and check the specific field that changed (e.g., `status`). Or track `prevStatus` in a ref and only trigger on status field transitions. Also, maintain a Set of `notifiedTripIds` in the hook's state for the session.
**Warning signs:** Crew receives 10+ identical notifications within seconds of a trip status change.

### Pitfall 5: Sender Sends Notification to Themselves
**What goes wrong:** When user A triggers `openVoting()`, the notification fires for all attendees including user A.
**Why it happens:** The notification is sent from the triggering user's browser, which looks up all attendees and sends to all their tokens.
**How to avoid:** Filter out `auth.currentUser.uid` from recipients before sending. The triggering user already knows about the state change — they caused it.

### Pitfall 6: iOS Notification Never Arrives
**What goes wrong:** iOS users don't receive any push notifications.
**Why it happens:** App is accessed via Safari tab, not installed as PWA. Or iOS version < 16.4.
**How to avoid:** Guard `'Notification' in window` before any push code. Consider showing an "Install to Home Screen" prompt if the user is on iOS and the app is not installed.
**Warning signs:** `navigator.standalone === false` on iOS.

### Pitfall 7: Cloudflare Worker Service Account Size Limit
**What goes wrong:** Cloudflare Worker Secrets have size limitations; the Firebase service account JSON (~2.4KB) may hit limits if using the free tier's KV system.
**Why it happens:** Service account JSON includes a full RSA private key.
**How to avoid:** Cloudflare Worker Secrets (not KV) support up to 5KB per secret, which is sufficient for a service account JSON. Store the entire JSON as a single secret named `FIREBASE_SERVICE_ACCOUNT_JSON`.
[ASSUMED — based on Cloudflare community documentation; verify against current Cloudflare limits at deploy time]

---

## Code Examples

### Token Registration on App Load

```typescript
// Source: [CITED: firebase.google.com/docs/cloud-messaging/js/client]
import { getMessaging, getToken } from 'firebase/messaging'
import { doc, setDoc, getDoc } from 'firebase/firestore'

async function refreshFCMToken(uid: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const messaging = getMessaging()
  const swReg = await navigator.serviceWorker.getRegistration()

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: swReg,
  })

  if (!token) return

  // Only write if token changed
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)
  if (snap.data()?.fcmToken !== token) {
    await setDoc(userRef, { fcmToken: token }, { merge: true })
  }
}
```

### Sending Notification via Cloudflare Worker

```typescript
// Source: [ASSUMED — standard fetch pattern]
async function sendNotification(
  tokens: string[],
  title: string,
  body: string
): Promise<void> {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken || tokens.length === 0) return

  await fetch(import.meta.env.VITE_NOTIFY_WORKER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tokens, notification: { title, body } }),
  })
}
```

### Status Transition Trigger (openVoting example)

```typescript
// src/utils/tripActions.ts — modified openVoting
export async function openVoting(
  tripId: string,
  deadline?: Date,
  onNotify?: (tripId: string) => void
): Promise<void> {
  const updates: Record<string, unknown> = {
    status: 'voting',
    votingStartedAt: serverTimestamp(),  // ADD: for shame timer
  }
  if (deadline) updates.votingDeadline = deadline.toISOString()
  await updateDoc(doc(db, 'trips', tripId), updates)
  onNotify?.(tripId)
}
```

### Shame Timer Check

```typescript
// Source: [ASSUMED — client-side timestamp comparison pattern]
function shouldSendShame(
  votingStartedAt: Timestamp,
  lastShamedAt: Timestamp | null,
): boolean {
  const now = Date.now()
  const votingStartMs = votingStartedAt.toMillis()
  const elapsed = now - votingStartMs
  const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000
  const TWENTY_THREE_HOURS_MS = 23 * 60 * 60 * 1000

  if (elapsed < SEVENTY_TWO_HOURS_MS) return false  // Not yet 72hr
  if (!lastShamedAt) return true  // Never shamed — fire first shame
  return (now - lastShamedAt.toMillis()) > TWENTY_THREE_HOURS_MS  // Daily check
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FCM legacy HTTP API (`Authorization: key=SERVER_KEY`) | FCM HTTP v1 API (OAuth2 Bearer token from service account) | 2023 (legacy deprecated June 2024) | Must use HTTP v1 API — legacy API no longer works |
| `onTokenRefresh` callback for token refresh | Call `getToken()` on each app load + handle error responses | Firebase JS SDK v9+ | `onTokenRefresh` is deprecated; polling `getToken()` is the current pattern |
| Separate SW registration for FCM | Pass `serviceWorkerRegistration` to `getToken()` | Firebase JS SDK v9 modular | More explicit control; avoids double-registration |
| `firebase/messaging` compat import | `import { getMessaging, getToken } from 'firebase/messaging'` | Firebase SDK v9 | Modular API — tree-shakeable; project already on v10 |

**Deprecated / outdated:**
- FCM legacy HTTP API (`https://fcm.googleapis.com/fcm/send`): Shut down June 2024 — must use HTTP v1. [CITED: Firebase deprecation announcement]
- `firebase.messaging().onTokenRefresh()`: Deprecated in modular SDK. Use `getToken()` polling instead.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Web Push (raw VAPID) is less preferable than FCM + CF Worker for this project | Delivery Architecture | Low — decision is architectural preference; both are technically viable |
| A2 | Placeholder substitution approach for SW env vars is simpler than injectManifest for this use case | Service Worker | Low — if injectManifest needed, vite.config.ts change is straightforward |
| A3 | Any crew member opening the app can trigger shame notifications for non-voters | Shame Timing | Medium — if the entire crew abandons the app, shame never fires. Acceptable for 7-user crew |
| A4 | Cloudflare Worker Secrets support ~2.4KB service account JSON | Pitfall 7 | Low — limits are documented; verify at deploy time |
| A5 | Firestore REST API from CF Worker is viable but deferred | Shame Alt Architecture | Low — decision is deferred; client-side approach is primary |
| A6 | `votingStartedAt` field does not exist yet on trip docs | Trigger Points | Medium — if it exists but is named differently, adjust accordingly |

---

## Open Questions

1. **Should `openVoting()` be called from TripDetail directly, or via a new `createTrip()` utility?**
   - What we know: Trip creation currently has three separate `addDoc` sites with near-identical code
   - What's unclear: Whether consolidating into a utility is in scope for Phase 7 or should be a separate cleanup
   - Recommendation: Create `createTrip()` utility in tripActions.ts as part of Phase 7's Wave 1; it's a prerequisite for attaching the D-06 notification cleanly

2. **Cloudflare Worker authentication: Firebase ID token validation vs. shared secret?**
   - What we know: Firebase ID token validation in a CF Worker requires calling Firebase's token verification endpoint or implementing RS256 JWT verification
   - What's unclear: Whether the added complexity is worth it for a 7-user private app
   - Recommendation: For MVP, use a pre-shared secret (stored as CF Worker Secret) checked in the request header. Simpler, adequate for internal tool at this scale.

3. **Does `NotificationContext.tsx` already have the `onSnapshot` subscriptions needed for D-07 triggering?**
   - What we know: NotificationContext already queries confirmed trips within 7 days for `imminentTrips` (lines 74-99)
   - What's unclear: Whether `useFCMNotifications` should share this subscription or run its own
   - Recommendation: `useFCMNotifications` should run its own subscription with the `notifiedApproaching` deduplication field check; sharing state across contexts adds coupling

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `firebase/messaging` | FCM token + push | ✓ | 10.12.0 (in firebase pkg) | — |
| Vercel (hosting) | HTTPS requirement for SW | ✓ | Current deployment | — |
| Cloudflare Workers account | FCM relay | Unknown — user must create | Free tier | None — required |
| Firebase VAPID key | `getToken()` | Not yet generated | — | None — must generate in Firebase Console |
| `VITE_FIREBASE_VAPID_KEY` env var | Token registration | Not yet set | — | None — must add to Vercel env vars |
| `VITE_NOTIFY_WORKER_URL` env var | Notification dispatch | Not yet set | — | None — must add after CF Worker deploy |

**Missing dependencies with no fallback:**
- Cloudflare Workers account + deployed Worker (free account creation required)
- Firebase VAPID key (generate in Firebase Console → Project Settings → Cloud Messaging → Web Push certificates)
- `VITE_FIREBASE_VAPID_KEY` environment variable (Vercel + local `.env`)
- `VITE_NOTIFY_WORKER_URL` environment variable (Vercel + local `.env`)

---

## Validation Architecture

`nyquist_validation` not set in `.planning/config.json` — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — project has no test infrastructure |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

No test files found in the project. [VERIFIED: Glob search on src/]

### Phase Requirements → Test Map

Given no test framework exists, all verification is manual for this phase.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | FCM token stored in Firestore after permission grant | manual | — | ❌ No test infra |
| NOTIF-02 | Push received when trip moves to voting | manual smoke | — | ❌ No test infra |
| NOTIF-03 | Push received when trip confirmed | manual smoke | — | ❌ No test infra |
| NOTIF-04 | Push received when trip proposed | manual smoke | — | ❌ No test infra |
| NOTIF-05 | Push received 7 days before trip start | manual | — | ❌ No test infra |
| NOTIF-06 | Shame notification fires 72hr after voting starts | manual | — | ❌ No test infra |
| NOTIF-07 | No Blaze tier upgrade required | structural | — | ❌ No test infra |
| NOTIF-08 | Token refreshed on app load | manual + Firestore inspect | — | ❌ No test infra |

### Wave 0 Gaps

No test infrastructure exists in this project. Testing is entirely manual via browser DevTools and Firestore Console inspection. The planner should include a verification checklist in each plan rather than automated test commands.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes — Worker endpoint auth | Firebase ID token or pre-shared secret in CF Worker |
| V3 Session Management | No | — |
| V4 Access Control | Yes — who can trigger notifications | Sender must be authenticated Firebase user; Worker validates identity |
| V5 Input Validation | Yes — notification payload from client | Cloudflare Worker must sanitise title/body strings; max length enforcement |
| V6 Cryptography | Yes — service account private key | Store ONLY as Cloudflare Worker Secret (encrypted at rest); never in client bundle or git |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service account key exfiltration | Information Disclosure | Key stored ONLY in CF Worker Secret; never in client bundle or Firestore |
| Unauthenticated notification spam | Spoofing | Worker validates caller identity before dispatching FCM call |
| Notification payload injection (XSS via title/body) | Tampering | Worker enforces max string lengths; browser notification API escapes content by default |
| Token harvesting from Firestore | Information Disclosure | Firestore security rules must restrict `users/{uid}.fcmToken` reads to `uid == request.auth.uid` only |
| FCM token in git/logs | Information Disclosure | FCM tokens are user-specific device tokens, not secrets per se, but should not be logged |

**Critical:** The `users/{uid}` Firestore security rules must be verified to ensure only the owning user can read their own `fcmToken`. Other crew members' hooks that need tokens for sending should fetch tokens via a Firestore read, which Firestore rules must allow — BUT only for authenticated users reading other users' `fcmToken` field specifically. This requires a Firestore rule update. [ASSUMED — need to check existing Phase 6 security rules to confirm whether `fcmToken` field is covered]

---

## Sources

### Primary (HIGH confidence)
- [firebase.google.com/docs/cloud-messaging/js/client](https://firebase.google.com/docs/cloud-messaging/js/client) — Setup steps, VAPID key config, getToken API
- [firebase.google.com/docs/cloud-messaging/web/receive-messages](https://firebase.google.com/docs/cloud-messaging/web/receive-messages) — onMessage, onBackgroundMessage, SW setup
- [firebase.google.com/docs/cloud-messaging/manage-tokens](https://firebase.google.com/docs/cloud-messaging/manage-tokens) — Token staleness, refresh best practices
- [developers.cloudflare.com/workers/platform/pricing/](https://developers.cloudflare.com/workers/platform/pricing/) — Free tier limits: 100k req/day confirmed
- [developers.cloudflare.com/workers/configuration/cron-triggers/](https://developers.cloudflare.com/workers/configuration/cron-triggers/) — CRON trigger availability on free tier
- `src/utils/tripActions.ts` — Authoritative list of status transition functions [VERIFIED: codebase]
- `src/components/TripSheet.tsx`, `DirectTripSheet.tsx`, `QuickPlanSheet.tsx` — Trip creation points [VERIFIED: codebase]
- `vite.config.ts` — VitePWA already using `autoUpdate`, `display: standalone` confirmed [VERIFIED: codebase]
- `package.json` — firebase@10.12.0, vite-plugin-pwa@0.20.0 [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- [github.com/celestifyhq/fcm-cloudflare-workers](https://github.com/celestifyhq/fcm-cloudflare-workers) — CF Worker FCM relay library, zero-dependency
- [dmelo.eu/blog/vite_pwa/](https://dmelo.eu/blog/vite_pwa/) — VitePWA + FCM integration pattern, `injectManifest` strategy
- [medium.com/@daeram.chung/fcm-service-worker-vite](https://medium.com/@daeram.chung/fcm-service-worker-vite-8deccfc23fe2) — Hybrid approach for SW env vars in Vite
- [github.com/vite-pwa/vite-plugin-pwa/issues/777](https://github.com/vite-pwa/vite-plugin-pwa/issues/777) — Two-SW conflict confirmed
- [developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) — iOS PWA web push requirements

### Tertiary (LOW confidence — flag for validation)
- Cloudflare Community post on Google Service Account OAuth2 from CF Workers — pattern confirmed but specific size limits for secrets should be verified at deploy time

---

## Metadata

**Confidence breakdown:**
- Delivery architecture (Cloudflare Worker relay): HIGH — library exists, pattern is established, free tier limits confirmed
- FCM web SDK setup: HIGH — official Firebase docs verified
- Vite/VitePWA service worker integration: MEDIUM — conflict is confirmed, solutions are from community sources
- Shame timing (client-side): MEDIUM — logically sound but assumes crew opens app; no alternative at Spark tier
- iOS limitations: HIGH — official Apple Developer docs
- Token lifecycle: HIGH — official Firebase docs

**Research date:** 2026-04-08
**Valid until:** 2026-07-08 (90 days — FCM web SDK and Cloudflare free tier are stable; iOS push support evolving)
