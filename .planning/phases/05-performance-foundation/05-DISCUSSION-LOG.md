# Phase 5: Performance foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-07
**Phase:** 05-performance-foundation
**Mode:** discuss (advisor mode — parallel research agents per area)
**Areas discussed:** CrewContext scope, Avatar migration, Incremental cache save, SpotlightCard extraction

## Areas and Decisions

### CrewContext scope
| Option | Chosen |
|--------|--------|
| Context for 6 callsites; TripDetail keeps filtered where() query | No |
| **Context for all 7; TripDetail derives subset in-memory via useMemo** | **Yes** |
| Context with getUsersByIds() helper | No |

User rationale: "At 8 users there's zero performance concern with the in-memory filter, and eliminating all 7 duplicate Firestore reads is the clean outcome. Option 3's abstraction isn't justified when there's no roadmap for additional filtered views. Just make sure Claude Code handles the crewMembersRef sync in Map.tsx properly — that's the only tricky bit."

### Avatar migration
| Option | Chosen |
|--------|--------|
| **Lazy migration on next login** | **Yes** |
| Big-bang script before deploy | No |
| New uploads to Storage, existing base64 stays | No |

User rationale: "Self-healing, zero-ops, and at 8 users everyone will have logged in within a week. The base64 bloat clears itself."

### Incremental cache save
| Option | Chosen |
|--------|--------|
| **Per-batch save + partial resume (skip already-cached IDs)** | **Yes** |
| Per-batch save only (no resume logic) | No |
| Keep single save + localStorage fallback | No |

Note: Recommended option also closes a latent correctness bug where the 90% threshold in `isCacheValid` could accept a 63/70 partial cache as "valid", silently leaving 7 destinations uncached.

### SpotlightCard extraction
| Option | Chosen |
|--------|--------|
| **Extract to src/components/SpotlightCard.tsx + React.memo** | **Yes** |
| Hoist above MapPage in same file + React.memo | No |

Companion requirement noted: `handleSpotlightTap` (Map.tsx:649) must be wrapped in `useCallback` or memo is bypassed by unstable `onTap` prop reference.

## Research Performed (Advisor Mode)

4 parallel `gsd-advisor-researcher` agents spawned, one per area. All returned structured comparison tables with pros/cons/complexity/recommendation columns. User selected the recommended option for all 4 areas.
