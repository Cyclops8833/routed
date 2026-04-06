---
phase: 01-port-map-enhancements
plan: 01
subsystem: map
tags: [attribution, mapbox, ui]
dependency_graph:
  requires: []
  provides: [compact-attribution-control]
  affects: [src/pages/Map.tsx]
tech_stack:
  added: []
  patterns: [mapboxgl.AttributionControl compact mode]
key_files:
  created: []
  modified:
    - src/pages/Map.tsx
decisions:
  - Use mapboxgl.AttributionControl({ compact: true }) placed at bottom-right; NavigationControl remains at top-right — no conflict
metrics:
  duration: ~5 minutes
  completed: 2026-04-06
---

# Phase 1 Plan 01: Compact Attribution (i) Icon Summary

**One-liner:** Replaced full-text Mapbox attribution bar with compact (i) icon via `attributionControl: false` + `AttributionControl({ compact: true })`.

## What Was Built

Disabled the default always-visible Mapbox attribution text bar and added the built-in `AttributionControl` in compact mode. The compact control renders as a small (i) circle icon in the bottom-right corner; clicking it expands the full attribution text. This removes visual clutter while remaining fully compliant with Mapbox ToS.

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Map.tsx` | Added `attributionControl: false` to `mapboxgl.Map` constructor options; added `map.addControl(new mapboxgl.AttributionControl({ compact: true }))` after the NavigationControl line |

## Changes Made

```typescript
// Before
const map = new mapboxgl.Map({
  container: mapContainerRef.current,
  style: MAP_STYLE_TERRAIN,
  center: [133.7751, -25.2744],
  zoom: 4,
})
map.addControl(new mapboxgl.NavigationControl(), 'top-right')

// After
const map = new mapboxgl.Map({
  container: mapContainerRef.current,
  style: MAP_STYLE_TERRAIN,
  center: [133.7751, -25.2744],
  zoom: 4,
  attributionControl: false,
})
map.addControl(new mapboxgl.NavigationControl(), 'top-right')
map.addControl(new mapboxgl.AttributionControl({ compact: true }))
```

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — exit 0, no errors |
| `npm run build` | PASS — exit 0, built in 4.89s |

## Deviations from Plan

None — plan executed exactly as written.

## Status: COMPLETE

**Commit:** `265dcc3` — feat(01-01): replace attribution bar with compact (i) icon

## Self-Check: PASSED

- File `src/pages/Map.tsx` modified and contains `attributionControl: false` and `AttributionControl({ compact: true })`
- Commit `265dcc3` exists in git log
