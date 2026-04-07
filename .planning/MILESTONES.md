# Milestones

## v1.0 Core App (Shipped: 2026-04-08)

**Phases completed:** 7 phases · 13 plans · ~20 tasks  
**Timeline:** 2026-03-23 → 2026-04-08 (16 days)  
**Codebase:** ~13,900 LOC TypeScript · 124 files changed

**Key accomplishments:**

- 4 Mapbox controls ported: 3D terrain toggle with DEM+sky, 60° tilt button, Topo/Sat style pill, compact attribution icon — terrain persists across style swaps via style.load re-application
- 4 critical bug fixes: fuel cost $0 (distances never fetched), hardcoded central-Vic coordinates fallback, stale "today" date past midnight, hardcoded cache total of 70
- 70 destination hero photos curated from Unsplash CDN — displayed in Mapbox popups and DestinationCard banners with topo-bg fallback
- Live petrol prices via fuelprice.io API with 24hr Firestore cache and session-only override toggle in CostBreakdown
- Trip voting flow fix — full plan→vote→confirm lifecycle now works end-to-end
- CrewContext eliminating 7 duplicate Firestore reads; avatar photos migrated to Firebase Storage; React.memo on DestinationCard + SpotlightCard; drive cache saves incrementally
- React error boundary with branded recovery screen; Firestore security rules with per-collection uid guards; popup.on('open') replaces window global; Mapbox token consolidated

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

---
