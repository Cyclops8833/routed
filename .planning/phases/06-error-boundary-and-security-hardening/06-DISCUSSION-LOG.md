# Phase 6: Error boundary and security hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-08
**Phase:** 06-error-boundary-and-security-hardening
**Mode:** assumptions (user selected "None — looks clear, just write context")

## Gray Areas Identified

| Area | Disposition |
|------|-------------|
| Error boundary UI | Assumption confirmed — match LoadingScreen style, reload button |
| Firestore rules scope | Assumption confirmed — per-collection uid guards, firebase.json, manual deploy |
| popup.on('open') approach | Assumption confirmed — DOM querySelector + JS listener |
| Mapbox token consolidation | Trivial — 2 files, straightforward import swap |

## Assumptions Confirmed

### Error Boundary
| Assumption | Evidence |
|------------|----------|
| Class component with componentDidCatch | React requirement |
| Wraps AppContent in App.tsx, inside BrowserRouter, outside providers | App.tsx structure — catches provider crashes too |
| Recovery screen matches LoadingScreen (topo-bg, Fraunces, moss green) | LoadingScreen in App.tsx lines 18–46 |
| Reload button calls window.location.reload() | Standard pattern |

### Firestore Rules
| Assumption | Evidence |
|------------|----------|
| 4 collections: users, trips, shortlists, availability | Grep of all collection(db, ...) calls |
| No firebase.json exists — needs creating | ls check confirmed absence |
| Deploy as manual step — CLI environment-dependent | No .firebaserc or firebase.json found |
| trips write guard uses attendees + createdBy | Trip document fields observed in Trips.tsx / TripDetail.tsx |

### window.__routedPlanTrip
| Assumption | Evidence |
|------------|----------|
| popup.on('open') + querySelector('button') approach | mapDestinations.ts:218-228 — popup var is in scope, addTo(map) is the trigger |
| destId is in closure scope from click handler | mapDestinations.ts:209+ — click handler captures feature props |
| Remove inline onclick from HTML string | mapDestinations.ts:126 |
| Remove global window assignment | mapDestinations.ts:206 |

### Mapbox Token
| Assumption | Evidence |
|------------|----------|
| Only 2 stragglers (Onboarding.tsx:116, Profile.tsx:154) | grep confirmed |
| config.ts already exports MAPBOX_TOKEN | src/config.ts line 1 |

## Corrections Made

No corrections — user confirmed all assumptions were clear.
