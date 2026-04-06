---
phase: 01-port-map-enhancements-3d-terrain-tilt-topo-satellite-toggle-
plan: 02
subsystem: ui
tags: [mapbox, mapbox-gl-js, terrain, 3d, react, typescript]

# Dependency graph
requires: []
provides:
  - 3D terrain toggle with DEM source and sky atmosphere layer
  - Tilt (pitch) button toggling between 0 and 60 degrees
  - Two-button Topo/Satellite style pill replacing old single toggle
  - Terrain persistence across style swaps via style.load re-application
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isTerrainRef pattern: useRef mirrors useState for access inside event listener closures"
    - "style.load re-apply pattern: re-add custom sources/layers after setStyle() wipes them"
    - "pitch threshold: mapPitch > 5 prevents tilt button flicker near 0 degrees"

key-files:
  created: []
  modified:
    - src/pages/Map.tsx

key-decisions:
  - "Active button color is #4A6741 (moss green) matching Landing.tsx heading — consistent design system"
  - "isTerrainRef (useRef) synced to isTerrain (useState) so style.load closure reads current value without stale capture"
  - "Nav control removed from explicit JSX — Mapbox manages it; removing duplicate fixed overlap with style pill"
  - "Destination dots re-added inside style.load handler so they survive Topo/Sat style swaps"

patterns-established:
  - "Ref-mirror pattern: keep a ref in sync with state when closures need latest value (isTerrainRef)"
  - "style.load re-apply pattern: any custom sources/layers must be re-added in style.load after setStyle()"

requirements-completed: [MAP-TERRAIN, MAP-TILT, MAP-STYLE]

# Metrics
duration: ~45 min
completed: 2026-04-06
---

# Phase 01 Plan 02: 3D Terrain, Tilt, and Topo/Sat Style Toggle Summary

**Three map controls ported from wildmap into Routed: 3D terrain toggle with DEM+sky, 60-degree tilt button, and Topo/Sat two-button pill — terrain persists across style swaps via style.load re-application**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-04-06
- **Tasks:** 3/3 complete (including human-verify checkpoint — approved by user)
- **Files modified:** 1

## Accomplishments

- Two-button Topo/Satellite style pill replaces old single text toggle, with active state highlighted in moss green
- 3D terrain toggle adds Mapbox DEM source (exaggeration 1.5) and atmospheric sky layer; disables cleanly
- Tilt button animates map pitch to 60 degrees (or back to 0) with `easeTo` duration 400ms
- Terrain re-applied automatically after style swaps via `style.load` event reading `isTerrainRef.current`
- Destination dots re-added in `style.load` handler so they survive Topo/Sat style swaps (post-checkpoint fix)
- Nav control overlap resolved by removing duplicate explicit JSX (Mapbox manages the control natively)

## Task Commits

Each task was committed atomically:

1. **Tasks 1 + 2: State/helpers/event wiring + three-control UI** - `cef7a59` (feat)
2. **Post-checkpoint fixes: nav control removed, destination dots restored on style.load** - `921e100` (fix)

## Files Created/Modified

- `src/pages/Map.tsx` — Added `isTerrain`, `mapPitch`, `isTerrainRef` state/ref; `applyTerrain`/`removeTerrain` helpers; `style.load` and `pitch` event listeners; terrain toggle useEffect; `handleTiltToggle`; replaced old style button with three-control block (style pill + 3D + Tilt); re-added destination dots in `style.load`

## Decisions Made

- Used `isTerrainRef` (a `useRef` mirroring `isTerrain` state) so the `style.load` event closure reads the current terrain value without stale capture
- Active button color `#4A6741` (moss green) matches the existing design system colour in Landing.tsx
- Pitch threshold `> 5` degrees for tilt active state prevents button flicker due to inertia near 0 degrees
- Nav control overlap: removed the explicit `<NavigationControl>` JSX — Mapbox was rendering it twice; the SDK adds it natively

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate NavigationControl causing overlap with style pill**
- **Found during:** Post-checkpoint verification
- **Issue:** NavigationControl was rendered explicitly in JSX AND by Mapbox SDK, causing visual overlap with the style pill at top: 106px
- **Fix:** Removed explicit `<NavigationControl>` JSX — Mapbox manages it natively
- **Files modified:** src/pages/Map.tsx
- **Verification:** Style pill no longer obscured; zoom controls remain functional
- **Committed in:** 921e100

**2. [Rule 1 - Bug] Re-added destination dots in style.load handler**
- **Found during:** Post-checkpoint verification (style swap test)
- **Issue:** `addDestinationDots` was only called in the initial `map.on('load')` handler; switching styles wiped the dots
- **Fix:** Called `addDestinationDots` inside `style.load` handler so dots are re-drawn after every style swap
- **Files modified:** src/pages/Map.tsx
- **Verification:** Destination dots visible after switching Topo/Sat and back
- **Committed in:** 921e100

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs found during user verification)
**Impact on plan:** Both fixes necessary for correct behaviour. No scope creep.

## Issues Encountered

None during planned tasks. Two issues surfaced during user visual verification (documented as deviations above) and fixed in a single follow-up commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three map controls are live and verified working in the browser
- Terrain + tilt + style toggle complete; ready for remaining phase 1 plans (attribution icon if applicable)
- style.load pattern is now established for any future features that add custom sources/layers

---
*Phase: 01-port-map-enhancements-3d-terrain-tilt-topo-satellite-toggle-*
*Completed: 2026-04-06*
