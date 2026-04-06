---
phase: 03-destination-photos
verified: 2026-04-06T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Open the app, click a destination dot on the map, verify a landscape hero photo appears at the top of the popup above the destination name"
    expected: "A 150px-tall Unsplash landscape image fills the popup header; the destination name and details appear below it"
    why_human: "Mapbox popup HTML rendering and image network fetch cannot be verified without a running browser session"
  - test: "Open the app, navigate to a ranked results list (QuickPlanSheet or TripSheet), verify each DestinationCard shows a hero photo at the top of the card"
    expected: "A full-width, aspect-ratio 3/2 landscape photo appears above the card title row for each destination"
    why_human: "React component render and image load from Unsplash CDN requires live browser session"
  - test: "In browser DevTools, throttle network to simulate a failed image load (block images.unsplash.com). Click a popup and view a card."
    expected: "Popup: image slot disappears, name and content move up cleanly, no broken-image icon. Card: topo-bg topographic pattern placeholder renders at same height as image would have"
    why_human: "Fallback behavior requires network simulation in a browser DevTools session"
---

# Phase 3: Destination Photos Verification Report

**Phase Goal:** Add at least one photo per destination — add a `photos` field (array of URLs) to each destination in `src/data/destinations.ts`, source one hero image per destination (Unsplash CDN), display the hero image in the Mapbox popup and in DestinationCard. No new backend required — URLs bundled with destination data.
**Verified:** 2026-04-06
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every destination in the array has a photos field containing at least one URL | VERIFIED | `grep -c 'photos: \[' destinations.ts` = 70; zero empty `photos: []` entries found |
| 2 | The Destination interface includes `photos: string[]` | VERIFIED | Line 46 of `src/data/destinations.ts`: `photos: string[];` — non-optional, after `bookingInfo: BookingInfo;` |
| 3 | All 70 photo URLs point to images.unsplash.com with w=800 and auto=format parameters | VERIFIED | `grep -c '?w=800&auto=format' destinations.ts` = 70; `grep -c 'images.unsplash.com/photo-'` = 70 |
| 4 | The Mapbox popup shows a hero photo banner at the top when a destination dot is clicked | VERIFIED (code) | `photoHtml` const at line 104–106 of `mapDestinations.ts`; interpolated at line 110 before destination name div; `onerror` fallback present |
| 5 | If the popup photo URL fails, the image slot disappears without breaking the layout | VERIFIED (code) | `onerror="this.style.display='none'"` inline handler on the `<img>` tag at line 105 |
| 6 | The DestinationCard shows a hero photo banner at the top of the card, above the title | VERIFIED (code) | Image/placeholder block at lines 176–197 of `DestinationCard.tsx`; placed before `<div style={{ padding: '16px' }}>` at line 199 |
| 7 | If the card photo fails or is missing, a topo-bg placeholder appears at the same dimensions | VERIFIED (code) | `onError={() => setImgError(true)}` triggers re-render to `className="topo-bg"` div at same `aspectRatio: '3 / 2'` |

**Score:** 6/6 truths verified (7 truths total; truth 4 through 7 need human confirmation for live rendering — see Human Verification section)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/destinations.ts` | Destination interface with photos field + all 70 entries populated | VERIFIED | Interface at line 46; 70 `photos: [...]` entries confirmed; 70 Unsplash URLs all matching `?w=800&auto=format`; TypeScript compiles clean |
| `src/utils/mapDestinations.ts` | Popup HTML with hero image banner | VERIFIED | `photoHtml` const constructed at lines 104–106; interpolated at line 110 inside `buildPopupHtml()` return; `onerror`, `object-fit:cover`, `height:150px`, `border-radius:4px 4px 0 0`, `margin-bottom:10px` all present |
| `src/components/DestinationCard.tsx` | Card with hero image banner and topo-bg fallback | VERIFIED | `useState` import at line 1; `imgError` state at line 80; conditional render block at lines 176–197; `aspectRatio: '3 / 2'` on both img and fallback div; `topo-bg` className; `loading="lazy"`; `onError` handler |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/utils/mapDestinations.ts` | `src/data/destinations.ts` | `dest.photos[0]` access in `buildPopupHtml` | WIRED | `import { destinations } from '../data/destinations'` at line 2; `dest.photos[0]` accessed at lines 104, 105 |
| `src/components/DestinationCard.tsx` | `src/data/destinations.ts` | `dest.photos[0]` access in render | WIRED | `RankedDestination.destination` typed as `Destination` (which includes `photos: string[]`); `dest.photos[0]` at lines 176, 178 |
| `src/components/DestinationCard.tsx` | `src/index.css` | `topo-bg` CSS class for fallback placeholder | WIRED | `.topo-bg` defined at line 76 of `src/index.css`; `className="topo-bg"` at line 191 of `DestinationCard.tsx` |
| `src/utils/mapDestinations.ts` | `src/pages/Map.tsx` | `addDestinationDots` called with Popup | WIRED | `addDestinationDots` imported and called at lines 322 and 347 of `Map.tsx` |
| `src/components/DestinationCard.tsx` | `QuickPlanSheet.tsx` / `TripSheet.tsx` | Component rendered with ranked destination prop | WIRED | Imported and rendered in both `QuickPlanSheet.tsx` (line 437) and `TripSheet.tsx` (line 871) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `src/utils/mapDestinations.ts` | `dest.photos[0]` | Static array in `src/data/destinations.ts` — 70 hardcoded Unsplash CDN URLs | Yes — all 70 entries have non-empty arrays with real Unsplash photo IDs | FLOWING |
| `src/components/DestinationCard.tsx` | `dest.photos[0]` via `ranked.destination` | Same static `destinations` array, typed as `Destination` through `RankedDestination.destination` | Yes — same data source; `rankDestinations()` returns `{ destination: Destination, ... }` where `destination` is the full typed object | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — both artifacts produce browser-rendered UI (Mapbox popup HTML and React component). Live rendering cannot be verified without a running browser session. All code-path checks are routed to Human Verification.

### Requirements Coverage

Note: No `REQUIREMENTS.md` file exists in `.planning/`. Requirements are defined exclusively in `ROADMAP.md`. Coverage is assessed against ROADMAP definitions.

| Requirement | Source Plan | Description (from ROADMAP) | Status | Evidence |
|-------------|------------|---------------------------|--------|----------|
| PHOTO-DATA | 03-01-PLAN.md | Add `photos: string[]` to Destination interface; populate all 70 destinations with Unsplash CDN URLs | SATISFIED | Interface field at line 46 of `destinations.ts`; 70 populated entries confirmed; all URLs use `?w=800&auto=format`; TypeScript compiles |
| PHOTO-POPUP | 03-02-PLAN.md | Display hero image in Mapbox popup | SATISFIED (code) | `photoHtml` wired in `buildPopupHtml()` with correct inline styles and `onerror` fallback; needs human confirmation for live rendering |
| PHOTO-CARD | 03-02-PLAN.md | Display hero image in DestinationCard with fallback | SATISFIED (code) | `imgError` state + conditional render + `topo-bg` fallback at matching `aspectRatio`; needs human confirmation for live rendering |

All 3 PHOTO-* requirement IDs from Phase 3 ROADMAP are claimed and evidenced. No orphaned requirements detected.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No TODO/FIXME/placeholder comments found; no empty arrays; no stub returns in modified files |

### Human Verification Required

#### 1. Popup Hero Photo Renders

**Test:** Run the app locally, open the map, click any destination dot (e.g., Harrietville / Ovens River East Branch).
**Expected:** A landscape hero photo (150px tall, full popup width, rounded top corners) appears above the destination name inside the popup.
**Why human:** Mapbox popup rendering and Unsplash CDN image fetch cannot be verified without a live browser session.

#### 2. DestinationCard Hero Photo Renders

**Test:** Navigate to a results view (QuickPlanSheet or TripSheet with ranked destinations visible). Inspect the DestinationCard components.
**Expected:** Each card shows a full-width landscape photo at the top (aspect ratio 3:2), above the destination name and detail rows.
**Why human:** React component render and CDN image load requires a live browser session.

#### 3. Fallback Behavior — Broken Image

**Test:** In browser DevTools Network panel, block requests to `images.unsplash.com`. Then click a popup and view a card.
**Expected:** Popup: the image slot disappears entirely; the destination name and content shift up cleanly with no broken-image icon or empty space. Card: the topo-bg topographic pattern placeholder fills the same slot at the same height — no layout jump.
**Why human:** Network-condition simulation and layout-shift detection requires browser DevTools interaction.

### Context Decisions Honored

All user decisions from `03-CONTEXT.md` were implemented as specified:
- D-01: `photos: string[]` added to interface (non-optional)
- D-02: `photos[0]` is the hero used everywhere
- D-03: Unsplash CDN photo IDs bundled as static strings with `?w=800&auto=format`
- D-04: Photo curation was an explicit task; all 70 populated
- D-05: DestinationCard banner is at the very top before the padding div
- D-06: `aspectRatio: '3 / 2'` used (not fixed height); `objectFit: 'cover'`
- D-07: Popup banner at top of HTML string, full width, `height:150px; object-fit:cover; margin-bottom:10px`
- D-08: Popup uses `onerror="this.style.display='none'"`
- D-09: Card uses React `onError` + `topo-bg` fallback at matching aspect ratio; no layout shift

### Commit Verification

All four task commits referenced in summaries verified present in git log:
- `2a8220b` — feat(03-01): add photos field to Destination interface
- `68ef26e` — feat(03-01): add curated Unsplash photo URLs to all 70 destinations
- `84209d7` — feat(03-02): add hero image banner to Mapbox popup
- `f717156` — feat(03-02): add hero image banner to DestinationCard with topo-bg fallback

### Gaps Summary

No gaps found. All six must-have truths are verified at the code level. The three requirement IDs are all claimed and evidenced. No anti-patterns or stubs detected.

Status is `human_needed` rather than `passed` because truths 4–7 (popup render, popup fallback, card render, card fallback) are browser UI behaviors that cannot be verified programmatically — they require a live browser session with network control.

---

_Verified: 2026-04-06_
_Verifier: Claude (gsd-verifier)_
