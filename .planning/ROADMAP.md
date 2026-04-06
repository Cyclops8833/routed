# Routed — Roadmap

## Milestone 1: Core App

> Group trip planning app — map-based voting, crew management, trip lifecycle.

### Phase 1: Port map enhancements — 3D terrain, tilt, topo/satellite toggle, attribution icon

**Goal:** Port four map features from wildmap into routed: compact attribution icon, 3D terrain toggle with sky layer, tilt/pitch button, and two-button Topo/Satellite style pill. All controls use vanilla mapbox-gl APIs against the existing Map.tsx ref pattern.
**Requirements**: MAP-ATTR, MAP-TERRAIN, MAP-TILT, MAP-STYLE
**Depends on:** Phase 0
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Compact attribution (i) icon
- [x] 01-02-PLAN.md — 3D terrain, tilt, and Topo/Satellite style pill controls

---

### Phase 2: Critical bug fixes

**Goal:** Fix the four user-visible bugs identified in the GSD codebase audit: fuel cost showing $0 in TripDetail (distances never fetched), drive time estimate using hardcoded central-Vic coordinates as fallback, TripSheet "today" date going stale past midnight, and drive cache total hardcoded at 70 rather than derived from destinations array length.
**Requirements**: BUG-FUEL, BUG-COORDS, BUG-DATE, BUG-CACHE
**Depends on:** Phase 1
**Plans:** 2 plans

Plans:
- [ ] 02-01-PLAN.md — BUG-FUEL (distancesKm from driveCache in TripDetail) + BUG-DATE (today moved into TripSheet function body)
- [ ] 02-02-PLAN.md — BUG-COORDS (SpotlightCard userHomeLocation prop) + BUG-CACHE (destinations.length replaces hardcoded 70)

---

### Phase 3: Destination photos

**Goal:** Add at least one photo per destination — add a `photos` field (array of URLs) to each destination in `src/data/destinations.ts`, source one hero image per destination (Unsplash/Wikimedia or bundled assets), display the hero image in the Mapbox popup and in DestinationCard. No new backend required — URLs bundled with destination data.
**Requirements**: PHOTO-DATA, PHOTO-POPUP, PHOTO-CARD
**Depends on:** Phase 2
**Plans:** TBD

---

### Phase 4: Live petrol price integration

**Goal:** Replace the manual `fuelPrices` field in trip `costConfig` with live average fuel prices fetched from a national Australian petrol price API (researched during plan phase), keyed to each user's homebase suburb/postcode. Fuel cost in TripDetail and CostBreakdown should reflect current market price, not a stale manual entry. Cache price per user for 24 hours in Firestore.
**Requirements**: FUEL-API, FUEL-CACHE, FUEL-COST
**Depends on:** Phase 2
**Plans:** TBD

---

### Phase 5: Performance foundation

**Goal:** Eliminate the 7 duplicate `getDocs(collection(db, 'users'))` calls by creating a shared `CrewContext` with a single `onSnapshot` subscription. Move user avatar photos from base64 Firestore blobs to Firebase Storage download URLs. Wrap `DestinationCard` and `SpotlightCard` in `React.memo`. Save drive cache incrementally per batch rather than only on full completion.
**Requirements**: PERF-CREW-CTX, PERF-AVATAR, PERF-MEMO, PERF-CACHE
**Depends on:** Phase 3
**Plans:** TBD

---

### Phase 6: Error boundary and security hardening

**Goal:** Add a React error boundary in `App.tsx` so render crashes show a recovery screen instead of a blank app. Add `firestore.rules` to the repo and deploy via Firebase CLI with `request.auth.uid` guards on write operations. Replace `window.__routedPlanTrip` global bridge with a Mapbox `popup.on('open')` JS event handler. Consolidate Mapbox token to import from `src/config.ts` everywhere.
**Requirements**: SEC-BOUNDARY, SEC-RULES, SEC-BRIDGE, SEC-TOKEN
**Depends on:** Phase 5
**Plans:** TBD

---
