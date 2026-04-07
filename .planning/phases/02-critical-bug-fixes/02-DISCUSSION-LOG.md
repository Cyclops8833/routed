> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-06
**Phase:** 02-critical-bug-fixes
**Mode:** discuss
**Areas discussed:** Fuel distance source, SpotlightCard fallback

## Gray Areas Presented

| Area | Gray area question | Selected |
|------|--------------------|----------|
| Fuel distance source (BUG-FUEL) | How should TripDetail get km-per-attendee? | ✓ |
| SpotlightCard fallback (BUG-COORDS) | What to show before drive cache is built? | ✓ |
| BUG-DATE fix | Module-level today — move inside component | (no decision needed) |
| BUG-CACHE fix | Replace hardcoded 70 with destinations.length | (no decision needed) |

## Discussion Results

### Fuel distance source (BUG-FUEL)
| Option | Chosen |
|--------|--------|
| Use each attendee's drive cache | ✓ |
| Fetch live Mapbox routes on load | |

**Rationale:** attendeeProfiles already loaded, driveCache has distanceKm, zero extra API calls.

### SpotlightCard fallback (BUG-COORDS)
| Option | Chosen |
|--------|--------|
| Use homeLocation haversine | ✓ |
| Show "No estimate yet" | |

**Rationale:** Personalised estimate is more useful than a blank label; homeLocation already available on currentUser.

## No Corrections Made

All decisions accepted as presented.
