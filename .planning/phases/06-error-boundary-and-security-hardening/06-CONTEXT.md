# Phase 6: Error boundary and security hardening - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a React error boundary in `App.tsx` so render crashes show a recovery screen instead of a blank app. Add `firestore.rules` to the repo and deploy via Firebase CLI with `request.auth.uid` guards on write operations. Replace `window.__routedPlanTrip` global bridge with a Mapbox `popup.on('open')` JS event handler. Consolidate Mapbox token to import from `src/config.ts` everywhere.

</domain>

<decisions>
## Implementation Decisions

### Error boundary
- **D-01:** Create `src/components/ErrorBoundary.tsx` as a React class component (class is required for `componentDidCatch`). Wrap `<AppContent />` inside `App.tsx` with `<ErrorBoundary>`.
- **D-02:** Place the boundary **inside** `<BrowserRouter>` but **outside** `<CrewProvider>` and `<NotificationProvider>` so provider-level crashes are also caught.
- **D-03:** Recovery screen matches the existing `LoadingScreen` visual style: `topo-bg` div, `minHeight: '100dvh'`, flex center column, Fraunces wordmark "Routed" in moss green, a short error message ("Something went wrong"), and a "Reload" button (`window.location.reload()`). No stack trace shown to users.

### Firestore rules
- **D-04:** Create `firestore.rules` in repo root. Rules: authenticated read on all collections; write guards per collection:
  - `users/{uid}` — only `request.auth.uid == uid` can write
  - `trips/{tripId}` — only authenticated users who are listed in `resource.data.attendees` OR are the `createdBy` user can write; create allowed for any authenticated user
  - `shortlists/{doc}` — write only if `request.auth.uid == resource.data.uid`
  - `availability/{doc}` — write only if `request.auth.uid == resource.data.uid`
- **D-05:** Create minimal `firebase.json` (`{ "firestore": { "rules": "firestore.rules" } }`) so `firebase deploy --only firestore:rules` works. Include deploy command in PLAN.md as a manual step with instructions — don't automate it since Firebase CLI setup is environment-dependent.

### window.__routedPlanTrip replacement
- **D-06:** In `mapDestinations.ts`, after `popup.addTo(map)`, listen to `popup.on('open', () => { ... })`. Inside the callback, query the button via `popup.getElement().querySelector('button')` and attach a JS `click` event listener that calls `options.onPlanTrip(destId)` directly. `destId` is already in closure scope from the `map.on('click', DOTS_LAYER)` handler.
- **D-07:** Remove the inline `onclick="window.__routedPlanTrip && ..."` from the button HTML string in `buildPopupHtml()` — replace with a plain `<button>` with no `onclick` attribute (the `popup.on('open')` listener does the wiring).
- **D-08:** Remove the `window.__routedPlanTrip` global assignment (line 206) and its TypeScript `Window &` cast.

### Mapbox token consolidation
- **D-09:** In `src/pages/Onboarding.tsx` (line 116) and `src/pages/Profile.tsx` (line 154), replace `import.meta.env.VITE_MAPBOX_TOKEN` with `import { MAPBOX_TOKEN } from '../config'`. `src/config.ts` already exports this — no changes needed to the config file itself.

### Claude's Discretion
- Exact error message copy in the recovery screen
- Whether to pass `error` / `errorInfo` props to the recovery UI for dev-mode display
- Firestore rules field names on trips (use `createdBy` and `attendees` as observed in codebase — verify at plan time)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Error boundary
- `src/App.tsx` — where `ErrorBoundary` wraps `AppContent`; `LoadingScreen` component (lines 18–46) is the visual template for the recovery screen

### Firestore collections and data shapes
- `src/pages/Trips.tsx` — trip document structure, `attendees` and `createdBy` field names
- `src/pages/TripDetail.tsx` — confirms trip doc fields used in read/write paths
- `src/firebase.ts` — Firestore db export used everywhere

### window.__routedPlanTrip replacement
- `src/utils/mapDestinations.ts` lines 125–130 — inline `onclick` HTML in `buildPopupHtml()` to remove
- `src/utils/mapDestinations.ts` lines 204–208 — global assignment to remove
- `src/utils/mapDestinations.ts` lines 209–230 — `map.on('click', DOTS_LAYER)` handler where `popup.addTo(map)` is called; `popup.on('open')` listener goes here

### Mapbox token
- `src/config.ts` — already exports `MAPBOX_TOKEN`
- `src/pages/Onboarding.tsx` line 116 — direct `import.meta.env.VITE_MAPBOX_TOKEN` to replace
- `src/pages/Profile.tsx` line 154 — direct `import.meta.env.VITE_MAPBOX_TOKEN` to replace

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LoadingScreen` in `src/App.tsx` — visual template for the error recovery screen (topo-bg, Fraunces wordmark, flex center); copy structure, swap spinner for error message + reload button
- `src/config.ts` — already centralises `MAPBOX_TOKEN`; pattern already established for Map.tsx, driveCache.ts, mapRoutes.ts

### Established Patterns
- Context mounting: `CrewProvider` and `NotificationProvider` wrap `AppContent` in `App.tsx` — `ErrorBoundary` mounts at the same level (wrapping both providers)
- Popup HTML strings: `buildPopupHtml()` returns raw HTML injected via `.setHTML()` — inline `onclick` is the current pattern for popup button interactions
- Mapbox popup lifecycle: popup created fresh on each dot click; `popup.on('open')` fires after `.addTo(map)` so DOM is available for querySelector

### Integration Points
- `src/App.tsx` — `ErrorBoundary` wraps the JSX tree, `LoadingScreen` provides the visual reference
- `src/utils/mapDestinations.ts` — two changes: remove global registration, rewrite button onclick to use popup DOM listener
- `src/pages/Onboarding.tsx` and `src/pages/Profile.tsx` — import swap only, no logic changes
- Repo root — new `firestore.rules` and `firebase.json` files

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-error-boundary-and-security-hardening*
*Context gathered: 2026-04-08*
