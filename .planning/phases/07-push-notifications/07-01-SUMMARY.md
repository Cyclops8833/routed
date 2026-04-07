---
phase: 07-push-notifications
plan: 01
subsystem: infra
tags: [fcm, firebase-messaging, cloudflare-workers, service-worker, vite-pwa, push-notifications]

# Dependency graph
requires:
  - phase: 05-performance-foundation
    provides: existing VitePWA config (autoUpdate) that was upgraded to injectManifest
provides:
  - FCM messaging initialised in firebase.ts and exported
  - UserProfile.fcmToken field for token storage
  - sendNotification() utility for dispatching push notifications via CF Worker
  - Cloudflare Worker FCM relay (cloudflare-worker/) ready for wrangler deploy
  - Service worker (sw-firebase-messaging.js) with Workbox precaching + FCM background handler
affects: [07-02-token-registration, 07-03-notification-triggers, 07-04-shame-notifications]

# Tech tracking
tech-stack:
  added: [firebase/messaging (already installed, now used), cloudflare-workers (new CF project)]
  patterns:
    - VitePWA injectManifest strategy for unified SW with Workbox + FCM
    - Cloudflare Worker as FCM HTTP v1 relay (pre-shared secret auth, service account JWT minting)
    - Build-time env var injection into service worker via Vite transform plugin
    - Notification dispatch via fetch to CF Worker with VITE_NOTIFY_SECRET bearer token

key-files:
  created:
    - src/utils/notifications.ts
    - src/sw-firebase-messaging.js
    - cloudflare-worker/src/index.ts
    - cloudflare-worker/wrangler.toml
    - cloudflare-worker/package.json
    - cloudflare-worker/tsconfig.json
  modified:
    - src/types/index.ts
    - src/firebase.ts
    - vite.config.ts

key-decisions:
  - "Pre-shared secret (VITE_NOTIFY_SECRET / NOTIFY_SHARED_SECRET) chosen over Firebase ID token verification in CF Worker — adequate for 7-user private app, simpler implementation"
  - "injectManifest VitePWA strategy required to merge Workbox precaching with FCM background handler in single SW file"
  - "Build-time replaceSWEnvVars plugin injects Firebase config into SW at build time — service workers cannot access import.meta.env"
  - "CF Worker mints Google OAuth2 JWT from service account using Web Crypto API (no external deps) — service account key stored only as Cloudflare Worker Secret"

patterns-established:
  - "Pattern: CF Worker JWT minting — getAccessToken() uses crypto.subtle.importKey/sign with RSASSA-PKCS1-v1_5 to sign JWT claims"
  - "Pattern: SW env injection — transform plugin replaces __VITE_*__ placeholders at build, keyed on id.includes('sw-firebase-messaging')"

requirements-completed: [NOTIF-07, NOTIF-08]

# Metrics
duration: 25min
completed: 2026-04-08
---

# Phase 07 Plan 01: Push Notification Infrastructure Summary

**Cloudflare Worker FCM relay + VitePWA injectManifest service worker + sendNotification utility — full push infrastructure ready for token registration and trigger wiring**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-08T00:00:00Z
- **Completed:** 2026-04-08
- **Tasks:** 2
- **Files modified:** 9 (3 modified, 6 created)

## Accomplishments

- FCM messaging initialised in firebase.ts with Notification API guard (iOS/SSR safety)
- UserProfile type updated with optional `fcmToken` field for Firestore token storage
- `sendNotification()` utility dispatches to Cloudflare Worker with pre-shared secret auth, filters empty tokens, truncates payload
- Cloudflare Worker FCM relay scaffolded: mints Google OAuth2 JWT from service account, sanitises input, CORS-enabled, ready for `wrangler deploy`
- VitePWA switched from `generateSW` to `injectManifest` strategy — single service worker handles both Workbox precaching and FCM background messages
- Build-time plugin injects Firebase config values into SW file (service workers cannot read import.meta.env)

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, FCM init, notification dispatch utility, and service worker** - `d047040` (feat)
2. **Task 2: Cloudflare Worker FCM relay scaffold** - `a85e9f4` (feat)

## Files Created/Modified

- `src/types/index.ts` — Added `fcmToken?: string` to UserProfile interface
- `src/firebase.ts` — Added `getMessaging` import, exported `messaging: Messaging | null` with browser guard
- `src/utils/notifications.ts` — `sendNotification(tokens, payload)` utility using VITE_NOTIFY_SECRET + VITE_NOTIFY_WORKER_URL
- `src/sw-firebase-messaging.js` — Workbox precaching + FCM compat SDK background message handler via importScripts
- `vite.config.ts` — Switched VitePWA to `injectManifest` strategy; added `replaceSWEnvVars` build plugin
- `cloudflare-worker/src/index.ts` — FCM HTTP v1 relay Worker with JWT minting, input sanitisation, CORS
- `cloudflare-worker/wrangler.toml` — Wrangler config documenting required secrets
- `cloudflare-worker/package.json` — CF Worker project config
- `cloudflare-worker/tsconfig.json` — TypeScript config for Cloudflare Workers types

## Decisions Made

- **Pre-shared secret auth:** VITE_NOTIFY_SECRET (client env) + NOTIFY_SHARED_SECRET (CF Worker secret) instead of Firebase ID token verification. Simpler at 7-user scale; avoids CF Worker needing to verify Firebase JWTs.
- **injectManifest strategy:** Required to merge Workbox precaching with FCM background handler in a single service worker — running two SWs causes conflicts.
- **Build-time env injection:** `replaceSWEnvVars` Vite plugin replaces `__VITE_FIREBASE_*__` placeholders at build time since SWs cannot access `import.meta.env`.
- **Web Crypto JWT minting:** CF Worker mints Google OAuth2 JWT natively using `crypto.subtle` — no external dependencies needed.

## Deviations from Plan

None — plan executed exactly as written. Task 2 noted in the plan itself that `notifications.ts` should use pre-shared secret (not Firebase ID token), which was implemented from the start in Task 1.

## Issues Encountered

None. Build passed cleanly on first attempt with VitePWA injectManifest mode confirmed in output: `mode injectManifest`.

## User Setup Required

Before push notifications can work end-to-end, the user must:

1. **Firebase Console** → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair → copy VAPID key → add as `VITE_FIREBASE_VAPID_KEY` in Vercel env vars
2. **Firebase Console** → Project Settings → Service Accounts → Generate new private key → copy JSON → set as CF Worker secret: `wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON` (from `cloudflare-worker/` dir)
3. **Cloudflare** → Create free account at https://dash.cloudflare.com/sign-up if not already done
4. **Deploy CF Worker:** `cd cloudflare-worker && npm install && wrangler deploy`
5. **Generate shared secret:** any random string → set as `wrangler secret put NOTIFY_SHARED_SECRET` AND as `VITE_NOTIFY_SECRET` in Vercel env vars
6. **After deploy:** Copy worker URL (e.g. `https://routed-notify.<subdomain>.workers.dev`) → add as `VITE_NOTIFY_WORKER_URL` in Vercel env vars

## Next Phase Readiness

- Plan 02 (token registration hook) can now import `messaging` from `firebase.ts` and `sendNotification` from `utils/notifications.ts`
- Plans 03-04 (triggers) can import `sendNotification` to dispatch notifications on trip state changes
- CF Worker is code-complete; user must deploy it before end-to-end testing

---
*Phase: 07-push-notifications*
*Completed: 2026-04-08*
