# Routed — Project

> Trip planning app for a crew of mates in regional Victoria.

---

## What This Is

Routed is a group trip planning app for a crew of 7 mates (and growing) who do regular camping and 4WD trips in regional Victoria. It's map-first: 70 pre-curated destinations shown as dots on a full-bleed Mapbox map. The crew browses destinations, shortlists spots, votes on them, and plans the trip together — splitting costs, tracking availability, and following a clear trip lifecycle from idea to completion.

## Core Value

One place to go from "where should we go?" to "confirmed, here's the cost per person" — without group chats spiralling.

## Requirements

### Validated (v1.0)

- ✓ Full-bleed Mapbox map with 70 destination dots — v1.0
- ✓ Crew pins (live locations), route drawing — v1.0
- ✓ Trip lifecycle: proposed → voting → confirmed → active → completed — v1.0
- ✓ Quick Plan + Manual trip creation flows — v1.0
- ✓ "Plan a trip here" from map popup (DirectTripSheet) — v1.0
- ✓ Voting panel, cost engine, per-person breakdown — v1.0
- ✓ Availability calendar (Victorian long weekends) — v1.0
- ✓ Drive time cache (pre-fetched per user, 70 destinations) — v1.0
- ✓ Shortlists, topo pattern background, dark mode — v1.0
- ✓ PWA icon, Vercel deployment — v1.0
- ✓ 3D terrain toggle, tilt button, Topo/Sat style pill, compact attribution — v1.0
- ✓ Four critical bug fixes (fuel cost, coordinates fallback, date staleness, cache total) — v1.0
- ✓ Destination photos (70 curated Unsplash URLs, hero images in popups and cards) — v1.0
- ✓ Live petrol prices (fuelprice.io API, 24hr Firestore cache, CostBreakdown override) — v1.0
- ✓ Trip voting flow fix (move planned trip to voting state) — v1.0
- ✓ CrewContext (single Firestore subscription replacing 7 duplicate reads) — v1.0
- ✓ Avatar migration from base64 Firestore blobs to Firebase Storage URLs — v1.0
- ✓ React.memo on DestinationCard + SpotlightCard, incremental drive cache saves — v1.0
- ✓ React error boundary (branded recovery screen) — v1.0
- ✓ Firestore security rules (per-collection uid write guards) — v1.0
- ✓ popup.on('open') bridge (removed window.__routedPlanTrip global) — v1.0
- ✓ Mapbox token consolidation to src/config.ts — v1.0

### Active (v1.1)

- [ ] Push notifications — FCM token registration, 6 trigger types (vote, confirm, propose, approaching, shame, participation shame)
- [ ] Trip chat / comments — per-trip message thread, real-time Firestore
- [ ] More destinations — expand beyond 70 curated spots with Unsplash photos

### Carry-forward UAT (from v1.0)

- [ ] Deploy Firestore rules to production (firebase deploy --only firestore:rules)
- [ ] Verify error boundary recovery screen in live app
- [ ] Destination photo UAT (13 items in 03-VERIFICATION.md)

### Out of Scope

- Native mobile app — PWA is sufficient for crew's usage patterns
- Public discovery / social features — private crew tool, not a platform
- Booking integration — destination links are enough

## Context

**v1.0 shipped:** 2026-04-08  
**Stack:** React 18 + Vite + TypeScript, Tailwind CSS, Firebase Auth/Firestore/Storage, Mapbox GL JS v3, Vercel  
**Codebase:** ~13,900 LOC TypeScript, 70 destinations  
**Crew size:** 7–8 users (small scale — in-memory data operations are fine)  
**Repo:** github.com/cyclops8833/routed (main branch → Vercel auto-deploy)

## Key Decisions

| Decision | Outcome | Phase |
|----------|---------|-------|
| Compact attribution icon at bottom-right | ✓ Good | 01 |
| isTerrainRef mirrors state for style.load closure | ✓ Good — prevents stale capture | 01 |
| style.load re-apply pattern for terrain across style swaps | ✓ Good | 01 |
| fuelprice.io API with national average fallback | ✓ Good | 04 |
| Fuel price override is session-only (not persisted) | ✓ Good — simpler, covers 99% of use | 04 |
| CrewContext with onSnapshot vs per-component getDocs | ✓ Good — major perf improvement | 05 |
| Lazy base64→Storage migration (self-healing on profile load) | ✓ Good — no admin script needed | 05 |
| popup.on('open') + querySelector vs window global | ✓ Good — eliminates window pollution | 06 |
| Firestore rules use creatorUid/memberUid (not createdBy/uid) | ✓ Good — verified against source | 06 |

## Constraints

- Firebase free tier (Spark) — no Cloud Functions, keep Firestore reads minimal
- Vercel free tier — no serverless functions with long cold-start budgets
- 7-8 user max — no need for pagination, virtualization, or sharding
- Mapbox GL JS only (no React wrapper) — Map.tsx owns the map ref directly

---

*Last updated: 2026-04-08 after v1.0 milestone*
