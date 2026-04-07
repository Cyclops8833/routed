---
phase: 06-error-boundary-and-security-hardening
plan: "01"
subsystem: frontend-safety, firestore-security
tags: [error-boundary, firestore-rules, security, react-class-component]
dependency_graph:
  requires: []
  provides: [ErrorBoundary, firestore.rules, firebase.json]
  affects: [src/App.tsx, src/components/ErrorBoundary.tsx, firestore.rules, firebase.json]
tech_stack:
  added: []
  patterns: [React class error boundary, Firestore server-side security rules]
key_files:
  created:
    - src/components/ErrorBoundary.tsx
    - firestore.rules
    - firebase.json
  modified:
    - src/App.tsx
decisions:
  - "ErrorBoundary placed inside BrowserRouter but outside CrewProvider/NotificationProvider per D-02 so provider crashes are caught"
  - "firestore.rules uses creatorUid for trips (not createdBy) and memberUid for shortlists/availability — field names verified against src/types/index.ts and utils"
  - "DEV-only console logging in componentDidCatch; production recovery screen shows only generic 'Something went wrong'"
metrics:
  duration: ~10 min
  completed_date: "2026-04-08"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 4
---

# Phase 06 Plan 01: Error Boundary and Security Hardening Summary

**One-liner:** React class error boundary with branded recovery screen wired into App.tsx, plus Firestore rules with request.auth.uid write guards for all 4 collections.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ErrorBoundary component and wire into App.tsx | 10ecfa1 | src/components/ErrorBoundary.tsx, src/App.tsx |
| 2 | Create Firestore security rules and firebase.json | 7b8399e | firestore.rules, firebase.json |
| 3 | Deploy Firestore rules (manual) | — | Informational checkpoint — no code changes |

## What Was Built

**Task 1 — ErrorBoundary component:**
- New `src/components/ErrorBoundary.tsx` as a React class component with `getDerivedStateFromError` and `componentDidCatch`
- Recovery screen matches `LoadingScreen` visual style: `topo-bg` div, `minHeight: 100dvh`, flex center column, Fraunces wordmark "Routed" in `var(--color-moss)`, "Something went wrong" message, "Reload" button that calls `window.location.reload()`
- Stack trace only logged to console in `import.meta.env.DEV` mode — never shown to production users
- `src/App.tsx` updated: added import and wrapped `<CrewProvider>` inside `<ErrorBoundary>` which is inside `<BrowserRouter>` per D-02

**Task 2 — Firestore security rules:**
- `firestore.rules` in repo root with `rules_version = '2'`, `isAuthenticated()` helper, and per-collection rules:
  - `users/{uid}`: read = any authenticated; write = `request.auth.uid == uid` (path-match)
  - `trips/{tripId}`: read + create = any authenticated; update/delete = `creatorUid` OR `attendees[]` member
  - `shortlists/{doc}` and `availability/{doc}`: read = any authenticated; write = `request.auth.uid == resource.data.memberUid`
- `firebase.json` with minimal config pointing to `firestore.rules` for `firebase deploy --only firestore:rules`

**Task 3 — Deploy (manual, informational):**
- Deployment requires Firebase CLI: `npm install -g firebase-tools && firebase login && firebase deploy --only firestore:rules`
- Rules file is ready in repo root; no automation possible without Firebase CLI in dev environment

## Deviations from Plan

None — plan executed exactly as written. Field name corrections (creatorUid, memberUid) were already incorporated into the plan from RESEARCH.md findings.

## Known Stubs

None — no placeholder data or deferred wiring.

## Threat Flags

All threats from the plan's threat model are mitigated:

| Threat | Mitigation |
|--------|-----------|
| T-06-01 Spoofing (Firestore writes) | `request.auth != null` required for all writes |
| T-06-02 Tampering (trips) | Only `creatorUid` or `attendees[]` member can update/delete |
| T-06-03 Tampering (users) | `request.auth.uid == uid` path-match ensures own-doc-only writes |
| T-06-04 Tampering (shortlists/availability) | `request.auth.uid == resource.data.memberUid` owner guard |
| T-06-05 DoS (React render tree) | ErrorBoundary catches render crashes, shows recovery screen |
| T-06-06 Info Disclosure (error boundary) | Stack traces only in DEV mode; production shows generic message |

No new security surface introduced beyond what was planned.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/components/ErrorBoundary.tsx exists | FOUND |
| firestore.rules exists | FOUND |
| firebase.json exists | FOUND |
| commit 10ecfa1 (Task 1) | FOUND |
| commit 7b8399e (Task 2) | FOUND |
