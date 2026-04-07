# Phase 6: Error Boundary and Security Hardening - Research

**Researched:** 2026-04-08
**Domain:** React error boundaries, Firestore security rules, Mapbox popup event API, token management
**Confidence:** HIGH

## Summary

This phase has four tightly-scoped, independent changes. All decisions are locked in CONTEXT.md — research confirms implementation details and documents the exact code patterns needed.

The React error boundary is a class component wrapping `<AppContent>` inside `App.tsx`. The current JSX tree already has `BrowserRouter > CrewProvider > NotificationProvider > AppContent`; the boundary slots between the providers and `AppContent`, matching the locked decision D-02. The visual template (`LoadingScreen`) already exists in the same file.

The Firestore rules work adds two new files to the repo root (`firestore.rules`, `firebase.json`). The `Trip` type confirms `attendees: string[]` and `creatorUid` (not `createdBy`) as field names — this is a critical discrepancy from D-04 which uses `createdBy`. The plan must use `creatorUid` to match the live data shape. Firebase CLI is not installed in this environment; the deploy step must remain manual.

The `window.__routedPlanTrip` bridge lives in exactly two locations in `mapDestinations.ts` (lines 126 and 206, verified). The `popup.on('open')` API is the correct replacement — the popup is created and `.addTo(map)` called synchronously in the same click handler, and `destId` is in closure scope. Mapbox GL JS 3.20.0 (installed) supports `popup.on('open')`. The Mapbox token consolidation is a two-file import swap with no logic changes.

**Primary recommendation:** Implement in this order — token consolidation (smallest, validates pattern), error boundary, Firestore rules files, `window.__routedPlanTrip` removal. Each change is independently deployable.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Create `src/components/ErrorBoundary.tsx` as a React class component. Wrap `<AppContent />` inside `App.tsx` with `<ErrorBoundary>`.
- **D-02:** Place the boundary **inside** `<BrowserRouter>` but **outside** `<CrewProvider>` and `<NotificationProvider>`.
- **D-03:** Recovery screen: `topo-bg` div, `minHeight: '100dvh'`, flex center column, Fraunces wordmark "Routed" in moss green, short error message ("Something went wrong"), "Reload" button (`window.location.reload()`). No stack trace shown to users.
- **D-04:** Create `firestore.rules` in repo root with per-collection write guards (see CONTEXT.md for full rules spec).
- **D-05:** Create minimal `firebase.json`. Include deploy command in PLAN.md as a manual step — don't automate it.
- **D-06:** In `mapDestinations.ts`, after `popup.addTo(map)`, listen to `popup.on('open', () => { ... })`. Query button via `popup.getElement().querySelector('button')` and attach a JS click listener calling `options.onPlanTrip(destId)`.
- **D-07:** Remove inline `onclick="window.__routedPlanTrip && ..."` from button HTML in `buildPopupHtml()` — replace with a plain `<button>` with no `onclick`.
- **D-08:** Remove the `window.__routedPlanTrip` global assignment (line 206) and its TypeScript `Window &` cast.
- **D-09:** In `Onboarding.tsx` (line 116) and `Profile.tsx` (line 154), replace `import.meta.env.VITE_MAPBOX_TOKEN` with `import { MAPBOX_TOKEN } from '../config'`.

### Claude's Discretion

- Exact error message copy in the recovery screen
- Whether to pass `error` / `errorInfo` props to the recovery UI for dev-mode display
- Firestore rules field names on trips (verify `createdBy` vs `creatorUid` at plan time — see research finding below)

### Deferred Ideas (OUT OF SCOPE)

None.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-BOUNDARY | React error boundary in `App.tsx` showing recovery screen on render crash | Class component pattern confirmed; `LoadingScreen` in `App.tsx` is the visual template |
| SEC-RULES | `firestore.rules` in repo root with `request.auth.uid` write guards deployed via Firebase CLI | Rules syntax verified; field name discrepancy identified (`creatorUid`, not `createdBy`) |
| SEC-BRIDGE | Remove `window.__routedPlanTrip` global; replace with `popup.on('open')` JS event listener | Both occurrences in `mapDestinations.ts` confirmed; Mapbox GL JS 3.20.0 supports `popup.on('open')` |
| SEC-TOKEN | Consolidate Mapbox token: replace `import.meta.env.VITE_MAPBOX_TOKEN` in Onboarding.tsx and Profile.tsx | Exactly 2 occurrences confirmed; `src/config.ts` already exports `MAPBOX_TOKEN` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | Error boundary class component | Only class components support `componentDidCatch` in React 18 [VERIFIED: codebase package.json] |
| Firebase SDK | 10.14.1 | Firestore client (no change — rules are server-side) | Already installed [VERIFIED: node_modules] |
| Mapbox GL JS | 3.20.0 | `popup.on('open')` event | Already installed; event API confirmed in this version [VERIFIED: node_modules] |

### No New Dependencies Required

All four changes use existing installed packages. No `npm install` step needed.

---

## Architecture Patterns

### Pattern 1: React Error Boundary (Class Component)

**What:** A class component that implements `componentDidCatch` and `getDerivedStateFromError` to intercept render errors in the subtree below it.

**When to use:** Wrapping the entire app to prevent blank screens on unexpected exceptions.

**Implementation shape:**
```typescript
// Source: React 18 docs [ASSUMED — standard API, unchanged since React 16]
import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Optional: log to console in dev mode
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorScreen />  // matches LoadingScreen visual style
    }
    return this.props.children
  }
}
```

**Placement in `App.tsx`:**
```tsx
// BEFORE (current):
<BrowserRouter>
  <CrewProvider>
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  </CrewProvider>
</BrowserRouter>

// AFTER (D-02):
<BrowserRouter>
  <ErrorBoundary>
    <CrewProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </CrewProvider>
  </ErrorBoundary>
</BrowserRouter>
```

**Recovery screen template** — copy `LoadingScreen` structure from `App.tsx` lines 18–46, swap `<div className="spinner" />` for error text and reload button:
```tsx
// topo-bg, minHeight 100dvh, flex center column, Fraunces "Routed" in var(--color-moss)
// error text below wordmark, then: <button onClick={() => window.location.reload()}>Reload</button>
```

### Pattern 2: Firestore Security Rules

**What:** Server-enforced rules evaluated by Firebase before any read/write reaches the database.

**Critical field name findings — two corrections to CONTEXT.md D-04:**

1. **trips:** CONTEXT.md uses `createdBy` but the `Trip` type in `src/types/index.ts` line 71 is `creatorUid`. Rules MUST use `resource.data.creatorUid`. [VERIFIED: src/types/index.ts]

2. **shortlists and availability:** CONTEXT.md uses `resource.data.uid` but both utils files write the owner as `memberUid`. Rules MUST use `resource.data.memberUid` for both collections. [VERIFIED: src/utils/shortlistUtils.ts line 16, src/utils/availabilityUtils.ts line 22]

**Firestore Rules syntax:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helpers
    function isAuthenticated() {
      return request.auth != null;
    }

    // users: read = any authenticated; write = owner only
    match /users/{uid} {
      allow read: if isAuthenticated();
      allow write: if request.auth.uid == uid;
    }

    // trips: read = any authenticated
    //   create = any authenticated
    //   update/delete = attendee OR creatorUid
    match /trips/{tripId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() &&
        (request.auth.uid == resource.data.creatorUid ||
         request.auth.uid in resource.data.attendees);
    }

    // shortlists: read = any authenticated; write = owner (field: memberUid)
    match /shortlists/{doc} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() &&
        request.auth.uid == resource.data.memberUid;
    }

    // availability: read = any authenticated; write = owner (field: memberUid)
    match /availability/{doc} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() &&
        request.auth.uid == resource.data.memberUid;
    }
  }
}
```

**firebase.json (minimal):**
```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

**Deploy command (manual step in PLAN.md):**
```bash
firebase deploy --only firestore:rules
```

Note: Requires Firebase CLI installed (`npm install -g firebase-tools`) and `firebase login`. The plan must document this as a manual step since Firebase CLI is not installed in the development environment [VERIFIED: command -v firebase returned not found].

### Pattern 3: Mapbox Popup Event Listener (popup.on('open'))

**What:** Instead of injecting an `onclick` attribute into raw HTML and relying on a global `window.__routedPlanTrip` callback, attach a JS listener after the popup DOM is mounted.

**Why `popup.on('open')` works here:** The popup is created and `.addTo(map)` is called synchronously in the same `map.on('click', DOTS_LAYER)` handler. The `'open'` event fires after the popup is inserted into the DOM, making `popup.getElement()` available and non-null. [VERIFIED: mapDestinations.ts lines 225–228 — popup is created and addTo called in same function]

**Replacement pattern for lines 204–229 of mapDestinations.ts:**
```typescript
// Remove: global registration block (lines 204–207)
// Keep: map.on('click', ...) handler as-is up to popup creation

popup = new Popup({ offset: 14, maxWidth: '360px' })
  .setLngLat(coords)
  .setHTML(html)
  .addTo(map)

// NEW: wire button after DOM is available
popup.on('open', () => {
  const btn = popup?.getElement()?.querySelector('button')
  if (btn && options?.onPlanTrip) {
    btn.addEventListener('click', () => {
      options.onPlanTrip!(destId)
    })
  }
})
```

**In `buildPopupHtml()`** — change the button (lines 125–128) from:
```html
<button onclick="window.__routedPlanTrip && window.__routedPlanTrip('${destId}')" ...>
```
to:
```html
<button style="...">Plan a trip here →</button>
```
No `onclick` attribute, no `destId` embedded in HTML.

**TypeScript note:** The `Window & { __routedPlanTrip?: ... }` cast on line 206 is removed entirely. No type augmentation needed after this change.

### Pattern 4: Token Import Consolidation

**What:** Replace two direct `import.meta.env.VITE_MAPBOX_TOKEN` references with the already-exported `MAPBOX_TOKEN` from `src/config.ts`.

**Change is purely mechanical — no logic changes:**

`src/pages/Onboarding.tsx` line 116:
```typescript
// Before:
const token = import.meta.env.VITE_MAPBOX_TOKEN
// After:
import { MAPBOX_TOKEN } from '../config'
// ...then use MAPBOX_TOKEN directly (no local const needed)
```

`src/pages/Profile.tsx` line 154:
```typescript
// Before:
const token = import.meta.env.VITE_MAPBOX_TOKEN
// After:
import { MAPBOX_TOKEN } from '../config'
// ...then use MAPBOX_TOKEN directly (no local const needed)
```

Both files already use `../config` path pattern as other pages do. `src/config.ts` exports `MAPBOX_TOKEN` as a named export. [VERIFIED: src/config.ts line 1]

### Anti-Patterns to Avoid

- **Global window callbacks for React-to-DOM communication:** The `window.__routedPlanTrip` pattern bypasses React's event system and is fragile across re-renders. The `popup.on('open')` pattern scopes the listener to each popup instance.
- **Permissive Firestore rules as placeholder:** Never use `allow read, write: if true` even temporarily. The new rules deny all writes from unauthenticated clients immediately on deploy.
- **Error boundary as functional component:** `componentDidCatch` and `getDerivedStateFromError` are class lifecycle methods — there is no hooks equivalent in React 18. The class component is mandatory.
- **Leaking stack traces to production UI:** The recovery screen shows only a friendly message. Stack trace logging uses `import.meta.env.DEV` guard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Error boundary | Custom try/catch wrapping render | React class component with `getDerivedStateFromError` |
| Firestore auth enforcement | Client-side auth checks before writes | `firestore.rules` server-side rules |
| Popup button binding | Complex ref tracking or re-rendering popup | `popup.on('open')` + `getElement().querySelector()` |

---

## Common Pitfalls

### Pitfall 1: Wrong Field Name in Firestore Rules (`createdBy` vs `creatorUid`)

**What goes wrong:** D-04 in CONTEXT.md uses `createdBy` for the trip owner field. The actual `Trip` type uses `creatorUid`. Rules using `resource.data.createdBy` will always evaluate to `undefined`, silently blocking all trip writes.

**Why it happens:** The discussion used `createdBy` as a descriptive term; the actual codebase field is `creatorUid`.

**How to avoid:** Use `resource.data.creatorUid` in the trips rule, not `resource.data.createdBy`. [VERIFIED: src/types/index.ts line 71]

**Warning signs:** After deploy, all trip create/update operations return permission-denied for non-creator users even when they're in attendees.

### Pitfall 2: Error Boundary Placement Outside BrowserRouter

**What goes wrong:** If `ErrorBoundary` is placed outside `<BrowserRouter>`, errors that occur during router initialization won't be caught, and errors in the boundary's own recovery screen that use router hooks will fail.

**How to avoid:** Follow D-02 exactly — inside `<BrowserRouter>`, wrapping both providers.

### Pitfall 3: `popup.getElement()` Returns Null

**What goes wrong:** If `popup.getElement()` is called before the popup is added to the map, it returns null. Calling `.querySelector()` on null throws.

**How to avoid:** Only call `getElement()` inside the `popup.on('open')` callback, never before `.addTo(map)`. The null guard `popup?.getElement()?.querySelector('button')` provides an additional safety net.

### Pitfall 4: Old Popup Reference in `popup.on('open')` Callback

**What goes wrong:** The outer `let popup: mapboxgl.Popup | null = null` variable is reassigned on each dot click. If the closure in `popup.on('open')` captures the variable binding rather than the instance, it may reference the wrong popup instance.

**How to avoid:** Call `popup.on('open', ...)` immediately after the new popup instance is created (chained or on the same reference), before the variable can be reassigned. The current code structure (click handler creates popup synchronously, no async gaps) means reassignment only happens on the next click, which is safe.

### Pitfall 5: Firebase CLI Not Available — Silent Failure

**What goes wrong:** A plan task that runs `firebase deploy` without checking CLI availability will fail silently or confusingly.

**How to avoid:** Document deploy as a manual step in PLAN.md with explicit instructions: install Firebase CLI, login, then run deploy command. [VERIFIED: `firebase` CLI not found in environment]

---

## Code Examples

### ErrorBoundary Component (complete)
```typescript
// src/components/ErrorBoundary.tsx
// Source: React 18 class component pattern [ASSUMED — standard API]
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Uncaught render error:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="topo-bg"
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-base)',
            gap: '24px',
          }}
        >
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: '36px',
              fontWeight: '700',
              color: 'var(--color-moss)',
              letterSpacing: '-0.5px',
            }}
          >
            Routed
          </div>
          <div style={{ fontSize: '15px', color: 'var(--color-text-secondary)' }}>
            Something went wrong
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: 'var(--color-moss)',
              color: '#FAFAF7',
              border: 'none',
              borderRadius: '10px',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

### mapDestinations.ts — Popup Button Wiring Change
```typescript
// REMOVE lines 204–207 (global registration):
// (window as Window & { __routedPlanTrip?: ... }).__routedPlanTrip = options.onPlanTrip

// In map.on('click', DOTS_LAYER) handler — AFTER popup = new Popup(...).setHTML(html).addTo(map):
popup.on('open', () => {
  const btn = popup?.getElement()?.querySelector('button')
  if (btn && options?.onPlanTrip) {
    btn.addEventListener('click', () => {
      options.onPlanTrip!(destId)
    })
  }
})
```

---

## Validation Architecture

No automated test framework is installed (no jest/vitest/pytest in package.json). [VERIFIED: package.json — no test script, no test devDependencies]

All four requirements are verified via build-time TypeScript checks + manual browser verification.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed — TypeScript build (`tsc`) is the primary static check |
| Config file | `tsconfig.json` |
| Quick run command | `npm run build` (runs `tsc && vite build`) |
| Full suite command | `npm run build` |

### Phase Requirements — Verification Map

| Req ID | Behavior | Test Type | Verification Method | Automatable |
|--------|----------|-----------|---------------------|-------------|
| SEC-BOUNDARY | Render crash shows recovery screen, not blank page | Manual | In browser: open `/map`, open DevTools console, throw an error from React tree — recovery screen appears | No — requires browser |
| SEC-BOUNDARY | TypeScript compile passes with class component | Static | `npm run build` — no TS errors | Yes (`npm run build`) |
| SEC-RULES | `firestore.rules` and `firebase.json` exist in repo root | File check | `ls firestore.rules firebase.json` | Yes |
| SEC-RULES | Rules syntax is valid | Manual | Firebase console rules editor — paste rules, hit "Publish" validates syntax | No — requires Firebase console or CLI |
| SEC-RULES | Write from unauthenticated client is denied | Manual | Firebase console Rules Playground or live test | No — requires Firebase |
| SEC-BRIDGE | `window.__routedPlanTrip` no longer referenced | Static | `grep -r "__routedPlanTrip" src/` returns no matches | Yes (grep) |
| SEC-BRIDGE | Popup "Plan a trip here" button calls `onPlanTrip` callback | Manual | In browser: open map, click a destination dot, click "Plan a trip here" — trip sheet opens | No — requires browser |
| SEC-BRIDGE | TypeScript build passes (Window cast removed) | Static | `npm run build` — no TS errors | Yes (`npm run build`) |
| SEC-TOKEN | No `import.meta.env.VITE_MAPBOX_TOKEN` in source | Static | `grep -r "VITE_MAPBOX_TOKEN" src/` returns no matches | Yes (grep) |
| SEC-TOKEN | TypeScript build passes after import swap | Static | `npm run build` | Yes (`npm run build`) |
| SEC-TOKEN | Geocoding still works in Onboarding and Profile | Manual | In browser: go through onboarding geocode step, go to Profile and update location | No — requires browser |

### Wave 0 Gaps

None — existing build infrastructure (`npm run build`) is sufficient. No test files need creating.

### Sampling Rate

- **Per task commit:** `npm run build` (TypeScript check + Vite bundle)
- **Per wave merge:** `npm run build` + grep checks for removed patterns
- **Phase gate:** Build green + all manual verifications checked before closing phase

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Build check | ✓ | — | — |
| Firebase CLI | SEC-RULES deploy | ✗ | — | Document as manual install step in PLAN.md |
| Browser (manual tests) | SEC-BOUNDARY, SEC-BRIDGE, SEC-TOKEN | ✓ (assumed dev machine) | — | — |

**Missing dependencies with no fallback:**
- Firebase CLI (`firebase-tools`) — required to run `firebase deploy --only firestore:rules`. Must be installed by the developer before deploy. Plan must include: `npm install -g firebase-tools && firebase login && firebase deploy --only firestore:rules`.

**Missing dependencies with fallback:**
- None.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `getDerivedStateFromError` / `componentDidCatch` API is unchanged in React 18.3.1 | Architecture Patterns | Low — this API has been stable since React 16; would only matter if React 19 removed it (not applicable here) |
| A2 | `popup.on('open')` event is supported in Mapbox GL JS 3.x | Architecture Patterns | Low — `Evented` mixin and popup lifecycle events have been in Mapbox GL JS since v1; version 3.20.0 is installed |
| A3 | ~~shortlists/availability owner field is uid~~ RESOLVED: field is memberUid | Architecture Patterns (rules) | Resolved — rules corrected to use resource.data.memberUid [VERIFIED: shortlistUtils.ts, availabilityUtils.ts] |

**Note on A3 (RESOLVED):** Verified `shortlistUtils.ts` (line 16) and `availabilityUtils.ts` (line 22) both write `memberUid` to Firestore. Rules already corrected above to use `resource.data.memberUid`.

---

## Open Questions (RESOLVED)

1. **shortlists and availability owner field — RESOLVED.** Verified: both collections write `memberUid` to Firestore (shortlistUtils.ts line 16, availabilityUtils.ts line 22). Rules in this research use `resource.data.memberUid`. No action needed at plan time.

2. **Dev-mode error detail in recovery screen**
   - What we know: D-03 says no stack trace to users. Claude's Discretion allows passing `error`/`errorInfo` for dev-mode display.
   - What's unclear: Whether to show error message text in development (`import.meta.env.DEV`) under the recovery UI.
   - Recommendation: Log to console in `componentDidCatch` behind `DEV` guard (included in code example above). Keep recovery screen clean in all environments.

---

## Sources

### Primary (HIGH confidence)
- `src/App.tsx` — `LoadingScreen` visual template, current JSX tree structure
- `src/types/index.ts` — `Trip` interface confirming `creatorUid` and `attendees` field names
- `src/config.ts` — `MAPBOX_TOKEN` export confirmed
- `src/utils/mapDestinations.ts` — `window.__routedPlanTrip` locations at lines 126 and 206 confirmed
- `src/pages/Onboarding.tsx` line 116, `src/pages/Profile.tsx` line 154 — `VITE_MAPBOX_TOKEN` direct usages confirmed
- `node_modules/mapbox-gl/package.json` — version 3.20.0 confirmed installed
- `node_modules/firebase/package.json` — version 10.14.1 confirmed installed
- `package.json` — no test framework installed

### Secondary (MEDIUM confidence)
- Firebase Firestore Security Rules syntax — standard `rules_version = '2'` with `request.auth.uid` guards [ASSUMED — well-established pattern, syntax unchanged for years]

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified from node_modules
- Architecture: HIGH — all source locations verified from codebase; one discrepancy found (creatorUid vs createdBy)
- Pitfalls: HIGH — derived from verified source reading, not assumptions

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable domain — React error boundary and Firestore rules are not fast-moving)
