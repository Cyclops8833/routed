# Phase 3: Destination photos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-06
**Phase:** 03-destination-photos
**Mode:** discuss
**Areas discussed:** Photo sourcing, Card image layout, Load failure fallback

## Gray Areas Presented

| Area | Options offered |
|------|----------------|
| Photo sourcing | Specific Unsplash photo IDs; Wikimedia Commons URLs; Bundled local assets |
| Card image layout | Full-width banner at top; Thumbnail beside title |
| Load failure fallback | Topo-pattern placeholder; Hide slot on error; Solid colour placeholder |

## Decisions Made

### Photo sourcing
- **Chosen:** Specific Unsplash CDN photo IDs
- **User reasoning:** "Zero cost, zero build bloat, reliable CDN, and the photos are consistently high quality. Wikimedia is hit-and-miss visually, and bundling 70 images adds unnecessary weight to the build for a PWA that's already carrying Mapbox. The one-time curation of 70 photos is a bit of a task, but you could knock it out in one session — or even have Claude Code help by searching Unsplash for each destination name and picking the top result."

### Card image layout
- **Chosen:** Full-width banner at top of DestinationCard
- **Reason:** Recommended option, no additional comment

### Load failure fallback
- **Chosen:** Topo-pattern placeholder (.topo-bg)
- **Reason:** Recommended option — on-brand, consistent with page header pattern

## No Corrections Required

All recommended options were accepted without pushback.
