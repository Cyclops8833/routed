---
phase: 06-error-boundary-and-security-hardening
plan: "02"
subsystem: map-interaction
tags: [security, refactor, mapbox, popup]
dependency_graph:
  requires: []
  provides: [popup-plan-trip-wiring, mapbox-token-consolidation]
  affects: [src/utils/mapDestinations.ts, src/pages/Onboarding.tsx, src/pages/Profile.tsx]
tech_stack:
  added: []
  patterns: [popup-event-listener, config-module-import]
key_files:
  modified:
    - src/utils/mapDestinations.ts
    - src/pages/Onboarding.tsx
    - src/pages/Profile.tsx
decisions:
  - "Use popup.on('open') + getElement().querySelector('button') to attach click handler — avoids global window pollution"
  - "Keep local `token` variable in geocodeSuburb functions so template literal lines remain unchanged"
metrics:
  duration: ~8 min
  completed: "2026-04-08"
  tasks: 2
  files_modified: 3
---

# Phase 06 Plan 02: Global Bridge Removal and Token Consolidation Summary

**One-liner:** Replaced `window.__routedPlanTrip` global callback with a scoped `popup.on('open')` DOM event listener, and consolidated `MAPBOX_TOKEN` imports to `src/config.ts` in Onboarding and Profile pages.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace window.__routedPlanTrip with popup.on('open') | 8fd573e | src/utils/mapDestinations.ts |
| 2 | Consolidate Mapbox token imports in Onboarding and Profile | d42c125 | src/pages/Onboarding.tsx, src/pages/Profile.tsx |

## What Was Built

### Task 1 — popup.on('open') event wiring (mapDestinations.ts)

Three changes to `src/utils/mapDestinations.ts`:

1. **Removed `onclick` attribute** from the popup button HTML in `buildPopupHtml()`. The button now has no inline event handler.
2. **Removed the global registration block** — the 4-line block that set `window.__routedPlanTrip` and its TypeScript `Window &` cast is gone entirely.
3. **Added `popup.on('open')` listener** after `popup.addTo(map)`. The listener queries `popup.getElement().querySelector('button')`, then attaches a JS `addEventListener('click')` that calls `options.onPlanTrip!(String(props.id))` directly. The `props` variable is in scope from the enclosing `map.on('click', DOTS_LAYER)` callback.

### Task 2 — Token consolidation (Onboarding.tsx, Profile.tsx)

Mechanical import swap in both page files:
- Added `import { MAPBOX_TOKEN } from '../config'` to each file
- Changed `const token = import.meta.env.VITE_MAPBOX_TOKEN` to `const token = MAPBOX_TOKEN`
- `src/config.ts` already exported `MAPBOX_TOKEN` — no changes needed there

## Verification Results

- `grep -r "__routedPlanTrip" src/` — no matches (exit 1)
- `grep -r "VITE_MAPBOX_TOKEN" src/pages/` — no matches (exit 1)
- `src/utils/mapDestinations.ts` contains `popup.on('open'`, `getElement()?.querySelector('button')`, `addEventListener('click'`
- `src/pages/Onboarding.tsx` contains `import { MAPBOX_TOKEN } from '../config'` and `const token = MAPBOX_TOKEN`
- `src/pages/Profile.tsx` contains `import { MAPBOX_TOKEN } from '../config'` and `const token = MAPBOX_TOKEN`
- `npm run build` exits 0 (TypeScript + Vite build clean)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — T-06-07 mitigated (global removed, attack surface eliminated). T-06-08 accepted (Mapbox client token is public, domain-restricted; consolidation is hygiene).

## Self-Check: PASSED

- src/utils/mapDestinations.ts — modified, confirmed present
- src/pages/Onboarding.tsx — modified, confirmed present
- src/pages/Profile.tsx — modified, confirmed present
- Commit 8fd573e — confirmed in git log
- Commit d42c125 — confirmed in git log
