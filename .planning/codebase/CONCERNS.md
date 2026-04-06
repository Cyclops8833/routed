# Codebase Concerns

**Analysis Date:** 2026-04-06

---

## God Components (files doing too much)

**`src/pages/TripDetail.tsx` — 1,453 lines:**
- Issue: Single component handles auth, real-time trip listening, attendee profile loading, checklist CRUD, comments CRUD, cost config editing, voting state transitions, cancel/complete/reopen actions, and all render logic.
- Files: `src/pages/TripDetail.tsx`
- Impact: Any change to trip detail touches a file with 15+ state variables and 6 separate `useEffect` chains. High collision risk in parallel dev.
- Fix approach: Extract `CommentsSection`, `ChecklistSection`, `TripHeader`, and `CostSection` as separate components. Move Firestore mutation logic into a `useTripActions` hook.

**`src/pages/Map.tsx` — 1,263 lines:**
- Issue: Single component manages map init, satellite/topo/3D terrain toggle, crew pin rendering, drive cache build, shortlist subscription, welcome card, spotlight row, coach mark tooltip, and the full planning bottom sheet state machine.
- Files: `src/pages/Map.tsx`
- Impact: Map init logic is duplicated between the initial `load` event and the `style.load` event (lines 317–375 and 343–375). The component has 20+ state variables. Sheet content conditionals are deeply nested in JSX.
- Fix approach: Extract `MapControls`, `WelcomeCard`, `SpotlightRow`, and `PlanningSheet` as separate components. Extract map init into a `useMapbox` hook.

**`src/components/TripSheet.tsx` — 888 lines, `src/pages/Profile.tsx` — 737 lines, `src/pages/Onboarding.tsx` — 760 lines:**
- Issue: Each component is large but individually manageable — a lower priority than the two above.
- Files: as named above
- Impact: Moderate — slower to navigate and comprehend.
- Fix approach: Split on natural boundaries (form steps in Onboarding, results vs form views in TripSheet) when those files are next touched.

---

## Auth Listener Duplication

**`onAuthStateChanged` called in 5 separate files:**
- Issue: Each page/context registers its own `onAuthStateChanged` listener independently. There is already a `useAuth` hook (`src/hooks/useAuth.ts`) but pages bypass it, calling `auth` directly.
- Files: `src/pages/Map.tsx:252`, `src/pages/TripDetail.tsx:165`, `src/pages/Trips.tsx:49`, `src/pages/Availability.tsx:222`, `src/contexts/NotificationContext.tsx:34`
- Impact: Multiple Firebase Auth subscriptions active simultaneously. If auth state changes, all five listeners fire independently. Silent errors in one don't propagate to others.
- Fix approach: Lift auth state into a context (or expand the existing `useAuth` hook into a context) so all pages consume a single subscription.

---

## Security Concerns

**No Firestore security rules in repository:**
- Issue: No `firestore.rules` file is present in the repo. The database rules exist only in the Firebase console. This means rules cannot be reviewed in code review, cannot be tested locally, and can diverge from what is deployed.
- Files: (absent — should be `firestore.rules` at project root)
- Impact: Any rules change requires console access. Rules could regress to open read/write with no code-level guard. Unknown whether reads are currently restricted by authenticated user.
- Fix approach: Create `firestore.rules`, deploy via Firebase CLI, and commit to repo with a `firebase.json` config. Add rules that verify `request.auth.uid` matches the document's owner field for write operations.

**Mapbox token accessed directly outside config in two places:**
- Issue: `src/pages/Onboarding.tsx:116` and `src/pages/Profile.tsx:131` both call `import.meta.env.VITE_MAPBOX_TOKEN` directly instead of importing `MAPBOX_TOKEN` from `src/config.ts`.
- Files: `src/pages/Onboarding.tsx:116`, `src/pages/Profile.tsx:131`
- Impact: The config abstraction is incomplete; token references are scattered. If the env var name changes, two files will silently receive `undefined` while `src/config.ts` is updated.
- Fix approach: Replace both direct `import.meta.env.VITE_MAPBOX_TOKEN` references with `import { MAPBOX_TOKEN } from '../config'`.

**`window.__routedPlanTrip` global namespace bridge:**
- Issue: `src/utils/mapDestinations.ts:121` injects a function onto `window` so that raw HTML inside a Mapbox popup can invoke React state. Only one instance of this handler can exist at a time; if two map instances ever existed, the second would overwrite the first.
- Files: `src/utils/mapDestinations.ts:199-202`
- Impact: Fragile architecture. If `addDestinationDots` is called before `onPlanTrip` is provided, the global is stale. Currently not a bug because map is a singleton, but creates XSS surface if popup HTML is ever user-influenced.
- Fix approach: Use Mapbox's `popup.on('open')` event to bind click handlers in JS rather than relying on `window.__routedPlanTrip` in inline HTML.

**Photos stored as base64 data URIs in Firestore:**
- Issue: `src/pages/Profile.tsx` processes and stores user avatar photos as JPEG data URIs directly in the `users/{uid}` Firestore document (up to ~70 KB per document). There is no Firebase Storage involved.
- Files: `src/pages/Profile.tsx:76-93`, `src/pages/Profile.tsx:220-233`
- Impact: Large Firestore documents increase read costs and transfer size on every user profile fetch. Every page that loads crew profiles (`getDocs(collection(db, 'users'))` — 7 call sites) pulls the full blob for every member. At 10 users × 70 KB = 700 KB per unfiltered crew load.
- Fix approach: Move avatar upload to Firebase Storage and store only the download URL in Firestore.

---

## Performance Bottlenecks

**`getDocs(collection(db, 'users'))` — 7 unbounded call sites:**
- Issue: Seven separate components/pages each independently fetch every document in the `users` collection without any query filter.
- Files: `src/components/DirectTripSheet.tsx:48`, `src/components/QuickPlanSheet.tsx:82`, `src/components/TripSheet.tsx:82`, `src/pages/Availability.tsx:229`, `src/pages/Crew.tsx:225`, `src/pages/Map.tsx:467`, `src/pages/Trips.tsx:57`
- Impact: Each navigation event can trigger a full collection read. With photos stored as base64, each read can transfer hundreds of KB. No caching between components — Map.tsx and TripSheet.tsx load the same data independently within the same session.
- Fix approach: Create a React context that caches crew profiles for the session duration. A single `onSnapshot` on the users collection would serve all consumers.

**`subscribeToAllShortlists` / `onSnapshot(collection(db, 'shortlists'))` — 2 active listeners:**
- Issue: Both `src/pages/Map.tsx:415` and `src/pages/Trips.tsx:64` (via `subscribeToAllShortlists`) subscribe to the entire `shortlists` collection without any filter. Every shortlist change by any user triggers a snapshot in both pages.
- Files: `src/utils/shortlistUtils.ts:48`, `src/pages/Map.tsx:415`
- Impact: Grows linearly with crew size × destinations shortlisted. Firestore bills per document read per listener.
- Fix approach: Either filter by crew UIDs known to the current user, or merge into a single context-level subscription.

**Drive cache build fires 70+ sequential Mapbox API calls on first login:**
- Issue: `src/utils/driveCache.ts` calls the Mapbox Directions API for every destination (currently 70, growing) on first profile load, batched 5 at a time with 350ms delays. Total duration is ~5–6 seconds.
- Files: `src/utils/driveCache.ts:71-97`, `src/pages/Map.tsx:425-456`
- Impact: On first load, the user sees a progress bar blocking the map. If `buildDriveCache` fails partway, no partial cache is saved — the whole build must restart. The hardcoded `total: 70` on line 441 of Map.tsx will desync when destinations are added.
- Fix approach: Save partial cache on progress (or at each batch), and derive total from `destinations.length` rather than hardcoding.

**No React memoization on large list components:**
- Issue: `DestinationCard`, `SpotlightCard`, `CrewCard`, and comment list items have no `React.memo` wrapper. TripSheet renders ranking results (up to 70 destination cards) on each parent re-render.
- Files: `src/components/DestinationCard.tsx`, `src/pages/Map.tsx:113`, `src/pages/Crew.tsx:49`
- Impact: Any state change in TripSheet (e.g. typing in the trip name field) re-renders all destination cards.
- Fix approach: Wrap `DestinationCard` and `SpotlightCard` with `React.memo`. Results list in TripSheet should be a memoized derived value.

---

## Known Bugs / Fragile Areas

**Fuel cost always shows $0 in TripDetail:**
- Issue: `src/pages/TripDetail.tsx:262` initialises `distancesKm` as an empty object `{}` with a comment acknowledging this is a placeholder. The cost engine defaults to `distanceKm ?? 0` when the key is missing, so all fuel costs are zero on the trip detail page.
- Files: `src/pages/TripDetail.tsx:260-268`
- Impact: CostBreakdown displayed on the trip detail page shows inaccurate $0 fuel costs for all attendees. Users see a misleading breakdown.
- Fix approach: Store routes in Firestore when a trip is confirmed, or fetch live routes from Mapbox on TripDetail load.

**Hardcoded Melbourne fallback coordinate in SpotlightCard:**
- Issue: `src/pages/Map.tsx:126` computes straight-line distance using a hardcoded `lat1 = -37.0, lng1 = 144.5` (central Victoria) when no drive cache entry exists for a destination. This appears in the spotlight card's drive label.
- Files: `src/pages/Map.tsx:124-131`
- Impact: Users outside Victoria see incorrect drive estimates in the spotlight row before their cache is built.
- Fix approach: Use the current user's `homeLocation` coordinates from `currentUser` state, or show "No estimate yet" when cache is absent.

**Trip attendees hard-capped at 10 in TripDetail:**
- Issue: `src/pages/TripDetail.tsx:204` slices `trip.attendees` to 10 before a Firestore `where('uid', 'in', ...)` query. The Firestore `in` operator supports up to 10 values. If a trip ever has more than 10 attendees, the remaining profiles silently do not load.
- Files: `src/pages/TripDetail.tsx:204`
- Impact: Silent data loss on trips with 11+ attendees. No error is shown.
- Fix approach: Batch `where...in` queries in groups of 10 and merge results, or restructure to fetch profiles individually.

**`cancelTrip` deletes subcollections with `Promise.all` but no transaction:**
- Issue: `src/utils/tripActions.ts:37-44` deletes checklist, comments, and votes subcollections then deletes the parent trip document sequentially. If any individual `deleteDoc` throws, the parent document may still be deleted while some subcollections remain, or vice versa.
- Files: `src/utils/tripActions.ts:37-44`
- Impact: Orphaned subcollection documents remain in Firestore if partial failure occurs. Firestore charges for storage of orphaned docs.
- Fix approach: Either accept eventual consistency (document is gone, orphaned subs are low cost) or use a Cloud Function with a Firestore batch/transaction to guarantee atomicity.

**`today` const in TripSheet is module-level (stale after midnight):**
- Issue: `src/components/TripSheet.tsx:37` initialises `const today = new Date().toISOString().split('T')[0]` at module load time. If the app is kept open past midnight, the "today" date used as the default `dateFrom` becomes yesterday.
- Files: `src/components/TripSheet.tsx:37`
- Impact: Minor — users who keep the app open past midnight would see an incorrect default start date.
- Fix approach: Move the `today` calculation inside the component function or compute it lazily with `useState(() => new Date().toISOString().split('T')[0])`.

---

## Missing Error Boundaries

**No React error boundaries anywhere in the app:**
- Issue: `src/App.tsx` wraps routes in `<Suspense>` but has no `<ErrorBoundary>`. An unhandled render-time exception in any page component will crash the entire app and show a blank screen.
- Files: `src/App.tsx`, all page components
- Impact: A crash in (e.g.) Map.tsx or TripDetail.tsx takes down the whole app with no recovery path. On mobile PWA, the user must force-quit and relaunch.
- Fix approach: Add a class-based `ErrorBoundary` wrapping `<Suspense>` in App.tsx. Consider route-level boundaries so one crashed page doesn't kill navigation.

---

## Missing Features / Stub UI

**TripDetail map section is a placeholder:**
- Issue: `src/pages/TripDetail.tsx:1222-1236` renders a dashed "Routes shown on the main map" placeholder where a route map should appear. No map is embedded in the trip detail view.
- Files: `src/pages/TripDetail.tsx:1222-1236`
- Impact: Users see a stub where they would expect route visualisation for their confirmed trip. Forces context switch to the Map page.
- Fix approach: Embed a small Mapbox instance or a static map image for the confirmed destination when `confirmedDestinationId` is set.

---

## Test Coverage Gaps

**Zero test files in the repository:**
- Issue: No `*.test.*` or `*.spec.*` files exist. No jest, vitest, or other test runner is configured.
- Files: (absent)
- Impact: All regressions are caught manually. The scoring algorithm in `src/utils/rankDestinations.ts`, the cost engine in `src/utils/costEngine.ts`, and the drive cache validation in `src/utils/driveCache.ts` are pure functions that would be straightforward to unit test. The trip status state machine (proposed → voting → confirmed → active → completed) has no automated guard.
- Priority: High for utility functions; medium for component rendering.

---

## Scaling Limits

**Crew size assumed small (app is single-group hardcoded):**
- Issue: The app has no concept of groups or organisations. All queries read from global collections (`users`, `shortlists`, `trips`) without partitioning by group. Any user in the Firebase project can read any other user's profile.
- Files: `src/utils/shortlistUtils.ts`, `src/pages/Crew.tsx`, `src/pages/Map.tsx:415`
- Impact: At small crew sizes (current intended use: 5–10 people) this is fine. If the app were opened to multiple groups, all users would see all other users' data.
- Scaling path: Introduce a `groupId` field on all documents and scope queries accordingly.

**Destinations are a static bundled TypeScript array (1,619 lines):**
- Issue: `src/data/destinations.ts` is a static in-memory array of ~70 destinations compiled into the JS bundle. Adding or removing destinations requires a code deploy.
- Files: `src/data/destinations.ts`
- Impact: Bundle includes the full dataset on every page load. Can't update destinations without a Vercel redeploy. At current size (1,619 lines) this is acceptable but will grow.
- Scaling path: Move destinations to Firestore or a static JSON file fetched at runtime, enabling admin edits without deploys.

---

## Code Smell / Minor Issues

**`generateId()` uses `Math.random()` (not cryptographically random):**
- Issue: `src/pages/Onboarding.tsx:29` and `src/pages/Profile.tsx:31` both define `generateId()` as `Math.random().toString(36).slice(2) + Date.now().toString(36)`. This is duplicated code and uses a weak random source.
- Files: `src/pages/Onboarding.tsx:29`, `src/pages/Profile.tsx:31`
- Fix approach: Use `crypto.randomUUID()` (already used in `src/pages/TripDetail.tsx:294`) and extract to a shared utility.

**16 `console.*` statements in production code:**
- Issue: Counted across all source files — these are non-fatal but will surface in end-user browser consoles.
- Files: spread across `src/pages/`, `src/components/`, `src/utils/`
- Fix approach: Replace with a proper logger utility that can be silenced in production builds, or remove non-critical logging.

**Silent empty catch blocks in 14 locations:**
- Issue: Patterns like `} catch { /* ignore */ }` and bare `} catch {` suppress errors without logging or user notification. Found in Map.tsx, Trips.tsx, Availability.tsx, driveCache.ts, spotlight.ts.
- Files: `src/pages/Map.tsx:534`, `src/pages/Trips.tsx:530`, `src/pages/Trips.tsx:585`, `src/pages/Availability.tsx:182`, `src/utils/driveCache.ts:57`, `src/utils/spotlight.ts:56`, `src/utils/spotlight.ts:91`
- Impact: Failed operations silently produce no feedback. Spotlighted destinations may silently fail to shuffle. Drive cache build errors surface via `console.error` only.
- Fix approach: At minimum log suppressed errors at debug level. Surface user-facing failures via the `NotificationContext` toast or an inline error state.

**`FIREBASE_CONFIG` object in `src/config.ts` is unused:**
- Issue: `src/config.ts` exports `FIREBASE_CONFIG` but `src/firebase.ts` re-reads the same env vars directly (lines 5–12 of firebase.ts). The exported `FIREBASE_CONFIG` object is never imported anywhere.
- Files: `src/config.ts:3-10`, `src/firebase.ts:5-12`
- Fix approach: Either remove `FIREBASE_CONFIG` from `src/config.ts` or update `src/firebase.ts` to import it.

**`TripDetail.tsx` constructs a synthetic `UserProfile` object for comment avatars:**
- Issue: Lines 1411–1419 build a fake `UserProfile` object from comment data just to pass to the `<Avatar>` component, which only uses `photoURL` and `displayName`. This creates unnecessary type gymnastics.
- Files: `src/pages/TripDetail.tsx:1411-1420`
- Fix approach: Add optional `name` and `photoURL` props to `Avatar`, or create a `<CommentAvatar>` component that accepts primitive strings.

---

*Concerns audit: 2026-04-06*
