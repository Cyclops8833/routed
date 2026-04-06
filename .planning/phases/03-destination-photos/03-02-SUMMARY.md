---
phase: 03-destination-photos
plan: 02
subsystem: ui
tags: [destinations, photos, popup, card, unsplash, react]

# Dependency graph
requires:
  - 03-01 (Destination interface with photos: string[] field and all 70 URLs populated)
provides:
  - Mapbox popup hero image banner with onerror fallback
  - DestinationCard hero image banner with topo-bg fallback
affects:
  - src/utils/mapDestinations.ts
  - src/components/DestinationCard.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Popup inline onerror handler hides broken image without JS framework (collapses slot gracefully)"
    - "React imgError state + topo-bg fallback keeps card slot at constant aspect-ratio 3/2"
    - "aspectRatio: '3 / 2' on both img and fallback div prevents layout shift on load failure"

key-files:
  created: []
  modified:
    - src/utils/mapDestinations.ts
    - src/components/DestinationCard.tsx

key-decisions:
  - "onerror=this.style.display='none' for popup: hides image slot on failure, name/content moves up — no placeholder needed in HTML string context"
  - "React useState(false) imgError approach for card: allows topo-bg placeholder at identical dimensions on failure"
  - "aspectRatio: '3 / 2' (not fixed height) on card banner so slot height is always proportional to card width"

requirements-completed: [PHOTO-POPUP, PHOTO-CARD]

# Metrics
duration: ~8min
completed: 2026-04-06
---

# Phase 03 Plan 02: Destination Photos UI Display Summary

**Hero photos wired into Mapbox popup and DestinationCard — both show dest.photos[0] with graceful degradation on image failure**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-04-06
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Added `photoHtml` variable in `buildPopupHtml()` that renders a 150px hero image banner at the top of the Mapbox popup; on error the img hides itself via inline `onerror` handler and the content below moves up naturally
- Added `useState(false)` imgError state in `DestinationCard`, inserted image/placeholder block before the `padding: '16px'` content div; on error the `.topo-bg` placeholder renders at identical `aspectRatio: '3 / 2'` so there is no layout shift
- TypeScript compiles with zero errors across both files

## Task Commits

Each task committed atomically:

1. **Task 1: Add hero image banner to Mapbox popup** - `84209d7` (feat)
2. **Task 2: Add hero image banner to DestinationCard with topo-bg fallback** - `f717156` (feat)

## Files Created/Modified

- `src/utils/mapDestinations.ts` — Added `photoHtml` const and interpolated before destination name div in `buildPopupHtml()`
- `src/components/DestinationCard.tsx` — Added `useState` import, `imgError` state, img/topo-bg block before content padding div

## Decisions Made

- Popup uses inline `onerror="this.style.display='none'"` rather than a React-based approach because `buildPopupHtml` returns a plain HTML string for Mapbox's `setHTML()` — no React lifecycle available
- Card uses React `useState` + conditional render because DestinationCard is a React component — cleaner than DOM mutation
- `aspectRatio: '3 / 2'` chosen over a fixed pixel height for the card banner so the slot scales proportionally with card width on any viewport

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed per spec. TypeScript compilation passes with zero errors.

## Known Stubs

None. Both the popup and the card wire `dest.photos[0]` which is a real Unsplash CDN URL for all 70 destinations (populated in plan 03-01). No placeholders, no empty arrays.

## Threat Flags

No new threat surface introduced beyond what was already modelled in the plan's threat register. T-03-05 (image load failure DoS) mitigated as specified: popup uses `onerror` hide, card uses `onError` + topo-bg fallback.

---
*Phase: 03-destination-photos*
*Completed: 2026-04-06*
