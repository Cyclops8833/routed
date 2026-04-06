# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**Mapping & Geospatial:**
- Mapbox GL JS — interactive map rendering (vector tiles, terrain, satellite)
  - SDK: `mapbox-gl` 3.20.0, imported as `import mapboxgl from 'mapbox-gl'` in `src/pages/Map.tsx`
  - CSS: `import 'mapbox-gl/dist/mapbox-gl.css'` in `src/pages/Map.tsx`
  - Auth: `VITE_MAPBOX_TOKEN` → exported from `src/config.ts` as `MAPBOX_TOKEN`
  - Map styles used:
    - Outdoors/terrain: `mapbox://styles/mapbox/outdoors-v12`
    - Satellite: `mapbox://styles/mapbox/satellite-streets-v12`

- Mapbox Directions API — drive time and route geometry
  - Endpoint: `https://api.mapbox.com/directions/v5/mapbox/driving/{lng,lat};{lng,lat}?geometries=geojson&access_token=...`
  - Used in: `src/utils/driveCache.ts` (bulk drive-time pre-caching), `src/utils/mapRoutes.ts` (per-trip route rendering)
  - Batched in groups of 5 with 350ms delays to stay within rate limits (`src/utils/driveCache.ts`)

- Mapbox Geocoding API — suburb/place lookup to coordinates
  - Endpoint: `https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?country=AU&types=locality,place&access_token=...`
  - Used in: `src/pages/Onboarding.tsx` (home location setup), `src/pages/Profile.tsx` (home location update)
  - Debounced at 300ms before each API call

**Google Fonts:**
- Loads Fraunces, DM Sans, JetBrains Mono via `@import` in `src/index.css`
- URL: `https://fonts.googleapis.com/css2?family=Fraunces:...&family=DM+Sans:...&family=JetBrains+Mono:...&display=swap`
- No API key required; public CDN

## Data Storage

**Databases:**
- Firebase Firestore (NoSQL document database)
  - Client: `getFirestore` from `firebase/firestore`, exported as `db` from `src/firebase.ts`
  - Connection: via `VITE_FIREBASE_PROJECT_ID` (and full `firebaseConfig` object)
  - SDK import: `import { getFirestore } from 'firebase/firestore'`

**Firestore Collections:**

| Collection | Description | Key operations |
|---|---|---|
| `users` | User profiles (`UserProfile`) — vehicles, home location, drive cache | `getDoc`, `setDoc`, `updateDoc`, `getDocs` |
| `trips` | Trip documents (`Trip`) — dates, attendees, status, cost config | `addDoc`, `updateDoc`, `deleteDoc`, `onSnapshot`, `query/where` |
| `trips/{id}/votes` | Per-user votes on destination for a trip | `addDoc`, `getDoc`, `getDocs` |
| `trips/{id}/checklist` | Checklist items for a trip | `addDoc`, `getDocs`, `updateDoc`, `deleteDoc`, `onSnapshot` |
| `trips/{id}/comments` | Comment thread for a trip | `addDoc`, `onSnapshot` |
| `shortlists` | User destination shortlists (`Shortlist`) | `addDoc`, `deleteDoc`, `query/where`, `onSnapshot` |
| `availability` | Member availability date ranges | `addDoc`, `onSnapshot` |

**File Storage:**
- No Firebase Storage used. User profile photos are processed client-side via Canvas API (`src/pages/Profile.tsx: processImage()`) and stored as base64 JPEG data URIs directly in the `users` Firestore document (`customPhotoURL` field). Max ~70 KB per image.

**Caching:**
- Drive time cache: stored in Firestore `users/{uid}` document fields `driveCache` and `driveCacheLocation`. Expires after 30 days or if home location moves >~100m. Logic in `src/utils/driveCache.ts`.
- localStorage keys used for UI state:
  - `routed-theme` — light/dark preference (`src/hooks/useTheme.ts`)
  - `routed-spotlight` — last spotlight destination IDs (`src/utils/spotlight.ts`)
  - `routed-pending-trip-dates` — pending date selection passed between pages (`src/pages/Map.tsx`, `src/pages/Trips.tsx`, `src/pages/Availability.tsx`)
  - `routed-fab-seen` — FAB coach mark seen flag (`src/pages/Map.tsx`)
  - `routed-welcome-seen` — welcome modal seen flag (`src/pages/Map.tsx`)

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication with Google OAuth
  - Client: `getAuth`, `GoogleAuthProvider` from `firebase/auth`, exported from `src/firebase.ts` as `auth` and `googleProvider`
  - Sign-in method:
    - Desktop: `signInWithPopup(auth, googleProvider)` — `src/pages/Landing.tsx`
    - Mobile (User-Agent `Mobi|Android`): `signInWithRedirect(auth, googleProvider)` — `src/pages/Landing.tsx`
    - Redirect result completed via `getRedirectResult(auth)` in `src/hooks/useAuth.ts`
  - Sign-out: `signOut(auth)` — `src/pages/Profile.tsx`
  - Auth state: `onAuthStateChanged(auth, ...)` listener in `src/hooks/useAuth.ts`, also used directly in `src/pages/Map.tsx`, `src/pages/Trips.tsx`, `src/contexts/NotificationContext.tsx`

**User Profile Flow:**
- On first sign-in, user is routed to Onboarding (`src/pages/Onboarding.tsx`) to complete profile
- Profile stored at `users/{uid}` in Firestore
- `useAuth()` hook (`src/hooks/useAuth.ts`) returns `{ user, profile, loading }` — the single source of truth for auth state

## Monitoring & Observability

**Error Tracking:**
- None detected. No Sentry, Datadog, or similar SDK present.

**Logs:**
- `console.error` used sparingly for sign-in errors (`src/pages/Landing.tsx`) and API failures

**Analytics:**
- None detected

## CI/CD & Deployment

**Hosting:**
- Vercel (SPA static hosting)
- `vercel.json`: all routes rewritten to `/index.html`; `/assets/` served with 1-year immutable cache headers

**CI Pipeline:**
- None detected (no GitHub Actions, Circle CI, or similar config files present)
- Vercel deploys automatically on git push (implied by comment in `src/data/destinations.ts`: "commit, and push. Vercel redeploys automatically")

## Environment Configuration

**Required env vars (all `VITE_` prefixed for Vite client exposure):**

```
VITE_FIREBASE_API_KEY          — Firebase project API key
VITE_FIREBASE_AUTH_DOMAIN      — e.g. your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID       — Firebase project ID
VITE_FIREBASE_STORAGE_BUCKET   — e.g. your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_MAPBOX_TOKEN              — Mapbox public access token
```

**Secrets location:**
- `.env` file at project root (present, gitignored)
- `.env.example` at project root documents all keys with placeholder values

## Webhooks & Callbacks

**Incoming:**
- None — no server-side endpoint; pure client-side SPA

**Outgoing:**
- None — all integrations are request/response or realtime listener patterns

---

*Integration audit: 2026-04-06*
