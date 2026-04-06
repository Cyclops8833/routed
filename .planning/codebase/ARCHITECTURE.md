# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Mobile-first PWA, React SPA with Firebase backend and Mapbox GL map canvas.

**Key Characteristics:**
- Auth gate at app root — three render paths: `Landing` (unauthenticated), `Onboarding` (no profile), `Layout + Routes` (authenticated)
- No global state store (Redux/Zustand/etc) — state is local to pages/components, supplemented by `onSnapshot` real-time Firestore listeners
- Map page is the primary screen (`/map` is the default redirect); all other pages are supporting views
- `NotificationContext` is the single app-wide context — drives badge counts on TabBar
- Mapbox GL canvas is managed entirely via imperative refs inside `MapPage`; React state only tracks UI overlay states (sheet mode, plan mode, pitch angle)

## Layers

**Entry / Bootstrap:**
- Purpose: Mount React app, initialise theme before first render (avoids FOUC)
- Location: `src/main.tsx`, `src/App.tsx`
- Contains: `StrictMode` wrapper, `BrowserRouter`, `NotificationProvider`, `AppContent` auth gate, `initTheme()` call in `useLayoutEffect`
- Depends on: `useAuth`, `useTheme`, `NotificationContext`, `Layout`, all page components

**Auth + Session Layer:**
- Purpose: Firebase Auth state management, Firestore user profile loading
- Location: `src/hooks/useAuth.ts`
- Contains: `onAuthStateChanged` listener, `getRedirectResult` for mobile OAuth, profile `getDoc` from `users` collection
- Returns `{ user, profile, loading }` — consumed only by `AppContent` in `App.tsx`

**Page Layer:**
- Purpose: Full-screen route targets; each page owns its own Firestore subscriptions
- Location: `src/pages/`
- Contains: `Map.tsx`, `Trips.tsx`, `TripDetail.tsx`, `Crew.tsx`, `Availability.tsx`, `Profile.tsx`, `Landing.tsx`, `Onboarding.tsx`
- Pattern: Each page calls `onAuthStateChanged` directly (rather than using the `useAuth` hook) to get the current UID for Firestore queries; this is intentional to avoid re-mounting issues with lazy-loaded pages
- Depends on: Firebase SDK, `src/data/`, `src/utils/`, `src/components/`, `src/types/`

**Component Layer:**
- Purpose: Reusable UI — overlays, sheets, cards, panels
- Location: `src/components/`
- Contains: `Layout.tsx` (shell + TabBar), `TabBar.tsx`, `TripSheet.tsx`, `QuickPlanSheet.tsx`, `DirectTripSheet.tsx`, `VotingPanel.tsx`, `CostBreakdown.tsx`, `DestinationCard.tsx`, `ShortlistButton.tsx`, `TopoPattern.tsx`
- Sheet components (`TripSheet`, `QuickPlanSheet`, `DirectTripSheet`) are large; each contains its own Firestore reads and local form state

**Utility Layer:**
- Purpose: Pure functions and Firebase mutation helpers
- Location: `src/utils/`
- Key files:
  - `rankDestinations.ts` — scores all destinations for a set of attendees; uses cached drive times or Mapbox Directions API
  - `costEngine.ts` — pure function `calculateCosts()` that computes per-member trip costs
  - `mapDestinations.ts` — adds/manages all destination GeoJSON layers on the Mapbox instance
  - `mapRoutes.ts` — draws per-member route polylines on the Mapbox instance
  - `driveCache.ts` — builds and persists the drive-time cache to Firestore (`users/{uid}.driveCache`)
  - `shortlistUtils.ts` — Firestore CRUD for the `shortlists` collection
  - `availabilityUtils.ts` — Firestore CRUD for the `availability` collection
  - `tripActions.ts` — Firestore mutations for trip lifecycle (openVoting, closeVoting, startTrip, completeTrip, cancelTrip, reopenVoting)
  - `spotlight.ts` — picks 3 curated destinations from short/medium/long distance buckets for the map welcome cards

**Data Layer:**
- Purpose: Static data bundled at build time
- Location: `src/data/`
- Contains: `destinations.ts` (full destination database, ~70+ entries), `publicHolidays.ts`, `longWeekends.ts`, `vehicleDefaults.ts`
- Note: Destinations are **not** stored in Firestore — they are a hardcoded TypeScript array. All destination filtering/ranking works against this array.

**Context Layer:**
- Purpose: Cross-cutting concerns shared across the whole component tree
- Location: `src/contexts/NotificationContext.tsx`
- Contains: `NotificationProvider` (Firestore `onSnapshot` for voting trips and imminent confirmed trips), `useNotifications()` hook
- Consumed by: `TabBar.tsx` to display notification dots on the Trips tab

## Data Flow

**Auth Flow:**
1. `main.tsx` renders `<App>` → `initTheme()` fires in `useLayoutEffect`
2. `AppContent` calls `useAuth()` which subscribes to `onAuthStateChanged`
3. While `loading === true`: `<LoadingScreen>` shown
4. `user === null`: `<Landing>` shown (Google sign-in via `signInWithPopup` desktop / `signInWithRedirect` mobile)
5. `user` exists but `!profile || !profile.onboardingComplete`: `<Onboarding>` shown
6. Fully authenticated: `<Layout><Routes></Routes></Layout>` shown, default redirect to `/map`

**Map → Destination Popup → Trip Creation Flow:**
1. `MapPage` initialises `mapboxgl.Map` in a `useEffect` on mount; stores ref in `mapRef`
2. On map `load` event: `addDestinationDots()` adds a GeoJSON source (`destinations-source`) and three circle layers (`destinations-dots`, `destinations-dots-hover`, `destinations-shortlist-ring`) to the map
3. User clicks a dot → Mapbox `click` event fires → `buildPopupHtml()` reads live shortlist data from `shortlistsRef.current` and crew members from `crewMembersRef.current` (both stored as refs so popup closures always have fresh data)
4. Popup HTML contains an inline button with `onclick="window.__routedPlanTrip && window.__routedPlanTrip('${destId}')"` — a global bridge from the Mapbox DOM context back to React state
5. `window.__routedPlanTrip` is registered in `addDestinationDots` and calls the `onPlanTrip` callback passed from `MapPage`
6. `onPlanTrip` sets React state: `setPreselectDestId(destinationId)`, `setSheetMode('full')`, `setPlanMode('destination')` → renders `<DirectTripSheet>`

**Trip Planning Flow (full ranking):**
1. User taps FAB (+) on map → `setSheetMode('full')`, `setPlanMode('picker')`
2. `<TripSheet>` renders; user picks dates, budget, crew, trip length
3. User taps "Find Destinations" → `rankDestinations()` called from `src/utils/rankDestinations.ts`
4. `rankDestinations` checks if all attendees have valid `driveCache` in their Firestore profiles
   - **Fast path** (cache hit): scores all destinations using cached `durationMinutes` / `distanceKm` — no API calls
   - **Slow path** (no cache): calls Mapbox Directions API for each member→destination pair
5. Scoring formula: `avgDriveScore × 0.4 + maxDriveScore × 0.2 + budgetScore × 0.25 + seasonScore × 0.15`
6. Ranked results returned to `TripSheet` as `RankedDestination[]` — displayed as scrollable `DestinationCard` list
7. User selects destinations → taps "Save Trip" → `addDoc(collection(db, 'trips'), {...})` → `navigate('/trips/:id')`

**Firestore → Map Shortlist Visuals Flow:**
1. `MapPage` subscribes to `collection(db, 'shortlists')` via `onSnapshot`
2. Results stored in `shortlistsRef.current` (ref, not state — avoids re-renders)
3. Also calls `updateDestinationShortlistVisuals(map, shortlistedDestinationIds)` which adds an amber ring layer around destinations with 2+ shortlists

**Drive Cache Build Flow:**
1. `MapPage` checks current user profile on mount — if `driveCache` is missing or stale (> 30 days or home location moved > ~100m), triggers `buildDriveCache()`
2. `buildDriveCache` calls Mapbox Directions API in batches of 5 destinations with 350ms delays between batches
3. Progress tracked in `cacheProgress` state → shown as progress indicator on map
4. On completion: `saveDriveCache()` persists cache to `users/{uid}.driveCache` and `.driveCacheLocation` in Firestore

**Trip Detail Data Flow:**
1. `TripDetailPage` subscribes to `doc(db, 'trips', tripId)` via `onSnapshot`
2. Also subscribes to subcollections: `trips/{tripId}/checklist` and `trips/{tripId}/comments`
3. Votes are stored in `trips/{tripId}/votes/{uid}` — `VotingPanel` reads these via `onSnapshot(collection(db, 'trips', tripId, 'votes'))`
4. When voting closes, `closeVoting()` in `tripActions.ts` updates `trips/{tripId}` with `status: 'confirmed'` and `confirmedDestinationId`

## Firestore Data Model

**Collection: `users`**
- Document ID: Firebase Auth UID
- Fields: `uid`, `displayName`, `email`, `photoURL`, `customPhotoURL?`, `homeLocation: { suburb, lat, lng }`, `vehicles: Vehicle[]`, `createdAt`, `onboardingComplete`, `driveCache?: DriveCache`, `driveCacheLocation?: { lat, lng }`
- Key: `driveCache` is a map of `{ [destinationId]: { durationMinutes, distanceKm, cachedAt } }` — embedded in the user document

**Collection: `trips`**
- Document ID: Auto-generated
- Fields: `name`, `dateRange: { start, end }`, `tripLength`, `maxBudget`, `creatorUid`, `attendees: string[]`, `selectedDestinationIds: string[]`, `status` (`proposed` | `voting` | `confirmed` | `active` | `completed`), `createdAt`, `confirmedDestinationId?`, `votingDeadline?`, `costConfig?: { fuelPrices, dailyFoodRate, lineItems[] }`
- Queried with `where('attendees', 'array-contains', uid)` for per-user trip lists
- **Subcollections:**
  - `trips/{id}/checklist`: `{ text, assignee, done }`
  - `trips/{id}/comments`: `{ uid, displayName, photoURL, text, createdAt }`
  - `trips/{id}/votes`: Document ID is the voter's UID; `{ destinationId, votedAt }`

**Collection: `shortlists`**
- Document ID: `${memberUid}_${destinationId}` (composite, deterministic)
- Fields: `memberUid`, `destinationId`, `createdAt`
- No per-user scoping — entire collection is readable; `subscribeToAllShortlists()` reads it all for the Crew Wishlist view

**Collection: `availability`**
- Document ID: `${memberUid}_${weekendId}` for long weekends; auto-generated for custom date ranges
- Fields: `memberUid`, `weekendId` (nullable), `startDate`, `endDate`, `available`, `updatedAt`

## Entry Points

**App Bootstrap:**
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html`, Vite serves the bundle
- Responsibilities: Creates React root, wraps in `StrictMode`, mounts `<App>`

**App Router:**
- Location: `src/App.tsx` — `AppContent` function
- Triggers: Auth state resolves
- Responsibilities: Auth gate logic, theme initialisation, route declarations

**Map Page (primary):**
- Location: `src/pages/Map.tsx`
- Triggers: Navigation to `/map` or app default redirect
- Responsibilities: Mapbox map init, crew marker placement, destination dots, drive cache check, shortlist subscription, sheet/FAB/overlay rendering

## Error Handling

**Strategy:** Best-effort with silent catch — most async operations catch errors and log to `console.error` without surfacing to the user.

**Patterns:**
- Firebase subscriptions wrap in try/catch; failures typically just leave state at default (empty array / null)
- `onSnapshot` error callbacks set loading state to false without error message
- `rankDestinations` uses `Promise.allSettled` so individual route failures are filtered out without aborting the whole ranking
- Drive cache build failure logs to console but does not block map usage

## Cross-Cutting Concerns

**Theme:** `src/hooks/useTheme.ts` — `localStorage` key `routed-theme`, applied as `data-theme` attribute on `<html>`. `initTheme()` called in `useLayoutEffect` in `App.tsx` for FOUC prevention. CSS variables in `src/index.css` switch based on `[data-theme="dark"]`.

**Validation:** No form validation library — all validation is inline imperative checks before submit (e.g., checking `dateFrom` is set before enabling "Find Destinations").

**Authentication:** `onAuthStateChanged` is called directly in each page component rather than through a shared context. The `useAuth` hook is used only in `App.tsx` for the top-level auth gate.

**Cross-page Communication:** Via `localStorage` — the key `routed-pending-trip-dates` is written by `Trips.tsx` (long weekend / wishlist "Start planning" buttons) and read by `Map.tsx` on mount to pre-populate the trip sheet.

**Global Bridge:** `window.__routedPlanTrip` is a function registered by `addDestinationDots()` so Mapbox popup HTML (which runs outside React) can trigger React state updates in `MapPage`.

---

*Architecture analysis: 2026-04-06*
