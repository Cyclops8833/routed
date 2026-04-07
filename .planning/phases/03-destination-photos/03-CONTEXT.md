# Phase 3: Destination photos - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Add at least one photo per destination: add a `photos: string[]` field to each entry in `src/data/destinations.ts`, source one hero image URL per destination, display the hero in the Mapbox popup and in DestinationCard. No new backend required — URLs bundled with static destination data.

</domain>

<decisions>
## Implementation Decisions

### Data field
- **D-01:** Add `photos: string[]` to the `Destination` interface in `src/data/destinations.ts`. Even though only one photo is sourced per destination now, the array type keeps future multi-photo support open without a schema migration.
- **D-02:** The first element (`photos[0]`) is the hero image used everywhere in Phase 3. Downstream code always reads `dest.photos[0]`.

### Photo sourcing
- **D-03:** Source specific Unsplash CDN photo IDs per destination. Bundle the direct CDN URL in each destination object, e.g. `https://images.unsplash.com/photo-ID?w=800&auto=format`. No build bloat, no Unsplash Source API (deprecated), reliable CDN.
- **D-04:** Include photo curation as an explicit plan task — search Unsplash for each destination name/region and pick the top landscape/nature result. All 70 destinations must have a URL before the plan task is complete. Claude Code can assist in bulk.

### DestinationCard image
- **D-05:** Full-width banner at the very top of the card, above the title/name row. Uses `overflow: hidden` on the card container (already set) so rounded top corners clip the image naturally.
- **D-06:** Aspect ratio `3/2` (matches the Mapbox popup width). Height: ~160px is sufficient; do not add an explicit height — use `aspect-ratio` or `object-fit: cover` on the `<img>` tag so it scales correctly.

### Mapbox popup image
- **D-07:** Banner image at the top of the popup HTML string (above the destination name), full popup width (300px). Use inline style `width:100%;height:150px;object-fit:cover;display:block;border-radius:4px 4px 0 0;margin-bottom:10px;` since popup HTML cannot use CSS custom properties.
- **D-08:** The popup renders an `<img>` tag with `onerror="this.style.display='none'"` so a broken URL simply removes the image slot from the popup without layout breakage.

### Load failure fallback
- **D-09:** In DestinationCard, if `photos[0]` is missing or the image fails to load, show the `.topo-bg` placeholder div (same topographic pattern used in page headers) at the same dimensions as the banner. Use React `onError` on the `<img>` to swap to the placeholder. The card layout must not shift — the image slot stays the same height regardless of load state.

### Claude's Discretion
- Exact `w=` pixel width parameter for Unsplash URLs (800 is a reasonable default)
- Whether to lazy-load the card image (`loading="lazy"` attribute)
- Exact pixel height of the banner (aim for ~150–180px)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data layer
- `src/data/destinations.ts` — `Destination` interface (add `photos` field here) + all 70 destination entries (each needs a `photos` array added)

### Display targets
- `src/utils/mapDestinations.ts` lines 46–135 — `buildPopupHtml()` function; add banner `<img>` at top of the returned HTML string
- `src/components/DestinationCard.tsx` — add hero banner before the `<div style={{ padding: '16px' }}>` wrapper that contains the current card content

### Styling reference
- `src/index.css` — `.topo-bg` class definition (used as placeholder fallback in DestinationCard)

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.topo-bg` CSS class in `src/index.css` — topographic SVG pattern, used in page headers; reuse as the image placeholder div in DestinationCard
- `src/components/DestinationCard.tsx` — existing card has `overflow: hidden` and `borderRadius: '12px'` on the outer container; a full-width image at the top will naturally clip to rounded corners without extra CSS

### Established Patterns
- Popup HTML: string interpolation with hardcoded hex values and inline styles — CSS custom properties are not available inside Mapbox popup HTML strings (confirmed in CONVENTIONS.md). `onerror` JS attribute is the correct fallback mechanism here.
- Image loading: the codebase has no existing `<img>` usage for content images — `userPhoto.ts` resolves avatars but they are data URIs. This phase introduces the first content images.

### Integration Points
- `Destination` interface exported from `src/data/destinations.ts` — adding `photos: string[]` will require a TypeScript build check across all consumers; a non-optional field means all 70 entries must be populated at once
- `buildPopupHtml()` in `src/utils/mapDestinations.ts` — receives `destId`, looks up the destination from the imported array; `dest.photos[0]` is directly accessible
- `DestinationCard` receives `ranked.destination` as `dest` — `dest.photos[0]` directly accessible in render

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants Unsplash over Wikimedia: "Wikimedia is hit-and-miss visually" — prioritise aesthetic quality of photos
- User noted most Victorian destinations (Wilsons Prom, Grampians, Lake Eildon, Harrietville) will have great Unsplash coverage
- User open to Claude Code assisting with bulk photo URL curation during the plan execution phase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-destination-photos*
*Context gathered: 2026-04-06*
