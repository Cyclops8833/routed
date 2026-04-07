# Phase 4: Live petrol price integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-06
**Phase:** 04-live-petrol-price-integration
**Mode:** discuss (advisor mode, standard calibration)
**Areas discussed:** Multi-member pricing, Manual override UX, Fetch trigger, Fallback behavior

## Gray Areas Identified

1. Multi-member pricing — How to handle different regional prices across trip attendees
2. Manual override UX — What happens to the editable petrol/diesel inputs in CostBreakdown
3. Fetch trigger — When does the API call happen in the app flow
4. Fallback behavior — What shows when API fails or suburb isn't covered

## Advisor Research Summaries

All 4 areas were researched by parallel advisor agents (standard calibration tier) before discussion.

### Multi-member pricing
Agents identified 3 options: shared price (no interface change), per-member map (accurate, broader change), viewer-relative (non-starter for group cost-splitting). Recommended per-member map given Phase 4's per-user cache design.

### Manual override UX
Agents identified 3 options: auto-fill editable, read-only display, override toggle. Recommended read-only as cleanest default; noted toggle is better if API coverage is patchy by postcode.

### Fetch trigger
Agents identified 3 options: TripDetail load, MapPage startup, CostBreakdown mount. Recommended TripDetail load as co-located with consumption; ruled out CostBreakdown as architectural regression.

### Fallback behavior
Agents identified 3 options: silent national average, inline "est." label, warning banner. Recommended "est." inline to match app's error posture while remaining transparent.

## Decisions Made

### Multi-member pricing
- **Presented options:** Per-member price map (recommended) vs Shared single price (trip creator's)
- **User chose:** Shared single price (trip creator's)
- **User's rationale:** "All 8 of you are in Victoria — fuel price variance between Hampton Park, Bendigo, and Ballarat is maybe 10-15c/L. On a typical trip that's a few dollars difference per person. Not worth the added complexity. The per-member fuel consumption (L/100km per vehicle) is already where the real cost difference lives, and that's already built."

### Manual override UX
- **Presented options:** Read-only display (recommended), Override toggle, Auto-fill editable
- **User chose:** Override toggle
- **User's rationale:** "Fuel prices bounce around and sometimes the live data won't match what they actually paid at the bowser on the way up. Having the escape hatch there but hidden by default keeps it clean — live price is the default, but if Woody filled up at a servo that was $2.10/L he can adjust it without everyone else needing to care."
- **Additional clarification captured:** Override is session-only, not saved to Firestore.

### Fetch trigger
- **Presented options:** TripDetail page load (recommended), MapPage startup
- **User chose:** TripDetail page load (agreed with recommendation)

### Fallback behavior
- **Presented options:** National average + "est." label (recommended), Silent fallback
- **User chose:** National average + "est." label (agreed with recommendation)

## Codebase Findings (from scout)

- `calculateCosts()` in `costEngine.ts` accepts shared `FuelPrices` — no signature change needed for shared price approach
- `fuelPrices` read from `trip.costConfig.fuelPrices` at TripDetail line 250, defaulting to `{ petrol: 1.90, diesel: 1.85 }`
- `CostBreakdown.tsx` has `localPetrol`/`localDiesel` state and `onUpdateFuelPrices` callback — these become the hidden override section
- `driveCache` pattern in `users/{uid}` document is the established Firestore cache model to mirror
- `TripSheet.tsx` calls `rankDestinations` with hardcoded `{ petrol: 2.1, diesel: 2.0 }` — noted as deferred, out of Phase 4 scope
