# Phase 5: Performance foundation - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate the 7 duplicate `getDocs(collection(db, 'users'))` calls via a shared `CrewContext` with a single `onSnapshot` subscription. Move user avatar photos from base64 Firestore blobs to Firebase Storage download URLs. Wrap `DestinationCard` and `SpotlightCard` in `React.memo`. Save drive cache incrementally per batch with partial-resume support. No new user-facing features — all changes are internal performance and correctness improvements.

</domain>

<decisions>
## Implementation Decisions

### CrewContext — eliminate 7 duplicate Firestore reads
- **D-01:** Create `src/contexts/CrewContext.tsx` with a single `onSnapshot(collection(db, 'users'))` subscription. Expose `allUsers: UserProfile[]` and a `useCrewContext()` hook. Follow the `NotificationContext` pattern as the structural template.
- **D-02:** Mount `CrewProvider` in `App.tsx` alongside `NotificationProvider` (same level).
- **D-03:** Migrate all 7 callsites: Map.tsx, TripSheet.tsx, DirectTripSheet.tsx, QuickPlanSheet.tsx, Trips.tsx, Crew.tsx, and TripDetail.tsx — all replace their `getDocs(collection(db, 'users'))` / `where()`-filtered queries with context consumption.
- **D-04:** TripDetail derives its attendee subset **in-memory** via `useMemo`: `allUsers.filter(u => trip.attendees.includes(u.uid))` using `trip.attendees.join(',')` as the memoization dep. No separate Firestore query. Safe at crew scale (≤20 users).
- **D-05:** `crewMembersRef` in `Map.tsx` (currently updated inside the `getDocs` callback) must be kept in sync with context value — update the ref inside a `useEffect(() => { crewMembersRef.current = allUsers }, [allUsers])` so Mapbox event callbacks always read current crew.

### Avatar migration — base64 → Firebase Storage
- **D-06:** New uploads in `Profile.tsx`: after `canvas.toDataURL()` compression, upload to `storage/avatars/{uid}.jpg` via `uploadBytes()`, then get the download URL via `getDownloadURL()`, and write that URL string to `users/{uid}.customPhotoURL` — replacing the current data URI write.
- **D-07:** Lazy migration for existing base64 photos: on profile load in `Profile.tsx`, detect legacy values with `profile.customPhotoURL?.startsWith('data:')`. If detected, perform the Storage upload + URL overwrite immediately (one-time, self-healing). No admin script required.
- **D-08:** `getUserPhoto()` in `userPhoto.ts` requires **no change** — it already returns `customPhotoURL ?? photoURL ?? null` and works correctly regardless of whether the value is a data URI or HTTPS download URL.
- **D-09:** Add `getStorage` import to `src/firebase.ts` (one line — already in the installed `firebase@^10` bundle).

### React.memo — DestinationCard and SpotlightCard
- **D-10:** Extract `SpotlightCard` from `Map.tsx:116` to its own file `src/components/SpotlightCard.tsx`. Wrap with `React.memo`. Props interface: `{ dest: Destination, driveCache: DriveCache | undefined, userHomeLocation: HomeLocation | null, onTap: (dest: Destination) => void }` — no Map.tsx closure variables are captured, so extraction is clean.
- **D-11:** Wrap `DestinationCard` in `React.memo` in `src/components/DestinationCard.tsx`.
- **D-12:** Wrap `handleSpotlightTap` in `Map.tsx` with `useCallback` (deps: `currentUser`, `setSpotlightDest` or equivalent). This is a **required companion change** — without stable `onTap` reference, `React.memo` on SpotlightCard re-renders on every MapPage render regardless.

### Drive cache — incremental save + partial resume
- **D-13:** Modify `buildDriveCache(homeLat, homeLng, uid, existingCache?, onProgress?)` to accept the user's existing cache and the `uid` needed for mid-build saves. Skip destination IDs already present in `existingCache` (non-null `cachedAt` entry).
- **D-14:** After each batch of 5 completes inside `buildDriveCache`, call `saveDriveCache(uid, currentCache, homeLat, homeLng)` — ~14 writes per full build vs 1 currently. Write count for a resumed interrupted build is proportionally lower.
- **D-15:** Pass `profile.driveCache` as `existingCache` from the `checkAndBuildCache` call in `Map.tsx`. This also closes the latent correctness bug: `isCacheValid`'s 90% threshold could previously treat a 63/70 partial save as "valid", silently leaving 7 destinations uncached forever. With resume logic, a partial cache is completed rather than accepted.

### Claude's Discretion
- Exact dependency arrays for `useCallback` wrappers
- Whether to add a loading/skeleton state to any context consumer while `allUsers` resolves on first mount
- JPEG quality and path convention for Storage avatars (e.g., `avatars/{uid}` vs `avatars/{uid}.jpg`)
- Whether `buildDriveCache` saves with `setDoc` merge or `updateDoc` for mid-build writes

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Context pattern (template to follow)
- `src/contexts/NotificationContext.tsx` — existing `onSnapshot` context; structural template for CrewContext

### All 7 callsites to migrate
- `src/pages/Map.tsx` lines 234–245 — `getDocs(collection(db, 'users'))` + `crewMembersRef` pattern (ref must sync with context)
- `src/components/TripSheet.tsx` line 82 — `getDocs(collection(db, 'users'))`
- `src/components/DirectTripSheet.tsx` line 48 — `getDocs(collection(db, 'users'))`
- `src/components/QuickPlanSheet.tsx` line 82 — `getDocs(collection(db, 'users'))`
- `src/pages/Trips.tsx` line 57 — `getDocs(collection(db, 'users'))`
- `src/pages/Crew.tsx` line 225 — `getDocs(collection(db, 'users'))`
- `src/pages/TripDetail.tsx` lines 210–213 — `getDocs(q)` with `where('uid', 'in', attendees)` — replace with in-memory useMemo filter

### Avatar upload flow (Profile.tsx)
- `src/pages/Profile.tsx` lines 76–88 — `canvas.toDataURL()` compression loop
- `src/pages/Profile.tsx` line 226 — `updateDoc(users/uid, { customPhotoURL: dataUri })` — this write changes to a Storage URL
- `src/utils/userPhoto.ts` — `getUserPhoto()` — read-only, no changes required
- `src/firebase.ts` — add `getStorage` export

### Memo candidates
- `src/components/DestinationCard.tsx` — wrap entire export in `React.memo`
- `src/pages/Map.tsx` line 116 — `function SpotlightCard(...)` — extract to `src/components/SpotlightCard.tsx`
- `src/pages/Map.tsx` line 649 — `handleSpotlightTap` — wrap in `useCallback`

### Drive cache (incremental save)
- `src/utils/driveCache.ts` — `buildDriveCache()` and `saveDriveCache()` — both modified
- `src/pages/Map.tsx` lines 454–465 — `checkAndBuildCache` block — updated call site
- `src/types/index.ts` — `UserProfile` interface (confirm `driveCache?: DriveCache` field location)

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/contexts/NotificationContext.tsx` — structural template: `createContext` → `useContext` hook → `Provider` component with `onAuthStateChanged` guard and `onSnapshot` subscriptions; CrewContext follows the same pattern
- `getUserPhoto()` in `src/utils/userPhoto.ts` — unchanged; already handles any string value for `customPhotoURL`
- `buildDriveCache` + `saveDriveCache` in `src/utils/driveCache.ts` — both modified in-place; no new utility files needed

### Established Patterns
- Context mounting: `NotificationProvider` wraps the app in `App.tsx:83-85` — `CrewProvider` mounts at the same level
- Firestore cache embed: `driveCache` embedded in `users/{uid}` doc (Phase 2/4 pattern) — `saveDriveCache` already does `updateDoc` merge; mid-build saves use the same call
- Photo display: all avatar consumers already call `getUserPhoto(profile)` — no callsite changes needed after Storage migration
- `crewMembersRef` pattern: Map.tsx stores user list in a `useRef` for use inside Mapbox closures — ref must be synced via `useEffect` when switching to context

### Integration Points
- `App.tsx` — add `<CrewProvider>` wrapping (alongside `<NotificationProvider>`)
- All 7 callsite files — remove `getDocs` import + call, add `useCrewContext()` hook call
- `firebase.ts` — add `getStorage` export for Storage upload in Profile.tsx
- `src/pages/Map.tsx` — remove SpotlightCard definition, add import, add `useCallback` on `handleSpotlightTap`, add `useEffect` for `crewMembersRef` sync

</code_context>

<specifics>
## Specific Ideas

- User explicitly noted crew is 8 users — in-memory filter in TripDetail is a non-issue at that scale
- `crewMembersRef` sync flagged by user as the critical wiring point for the CrewContext migration — deserves explicit attention in the plan
- Lazy avatar migration: user expects everyone to have logged in within a week at 8-user crew scale, so the base64 bloat self-clears quickly

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-performance-foundation*
*Context gathered: 2026-04-07*
