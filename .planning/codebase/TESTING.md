# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Framework

**Runner:** None — no test framework is installed.

Confirmed by `package.json` inspection:
- No `jest`, `vitest`, `@testing-library/react`, `mocha`, or any test runner in `dependencies` or `devDependencies`
- No `test` script in `package.json` scripts block (only `dev`, `build`, `preview`)
- No `jest.config.*`, `vitest.config.*`, or any test configuration file at the project root

## Test File Organization

**No test files exist in the codebase.**

Search for `*.test.*` and `*.spec.*` across all of `src/` returned zero results.

## Coverage

**Requirements:** None enforced — no coverage configuration present.

**Current coverage:** 0% — no tests of any kind exist.

## What Is Tested vs Untested

### Untested (everything)

**High-value pure functions that are immediately testable:**

- `src/utils/costEngine.ts` — `calculateCosts()` is a pure function with well-defined inputs and outputs. Accepts `{ attendees, distancesKm, destination, nights, maxBudget, fuelPrices, dailyFoodRate, lineItems }`, returns `CostBreakdown`. No side effects. High business logic complexity.

- `src/utils/rankDestinations.ts` — `rankDestinations()` scoring algorithm (composite score: avg drive 40%, max drive 20%, budget 25%, season 15%). The fast path (cache-based) is pure enough to test. Edge cases: zero attendees, all over budget, no home locations.

- `src/utils/driveCache.ts` — `isCacheValid()` is a pure predicate. `formatDriveTime()` is a pure formatter. Both trivial to unit test.

- `src/utils/availabilityUtils.ts` — Firestore wrapper functions; could be tested with mock Firestore or integration tests.

- `src/utils/shortlistUtils.ts` — Firestore wrapper functions; same as above.

- `src/utils/tripActions.ts` — Firestore mutations (`openVoting`, `cancelTrip`, etc.); the cascade-delete logic in `cancelTrip` is high-risk with no test coverage.

- `src/utils/mapRoutes.ts` — `fetchRoutes()` calls Mapbox API; would require mocking `fetch`.

- Helper functions duplicated across pages:
  - `formatDateRange()` in `src/pages/Trips.tsx` and `src/pages/TripDetail.tsx`
  - `calcNights()` in `src/components/TripSheet.tsx`
  - `daysUntil()` / `daysRemaining()` in `src/pages/Trips.tsx`
  - `countdownText()` in `src/pages/TripDetail.tsx`

**React components — not tested:**
- All pages: `src/pages/Map.tsx`, `src/pages/TripDetail.tsx`, `src/pages/Trips.tsx`, `src/pages/Crew.tsx`, `src/pages/Profile.tsx`, `src/pages/Onboarding.tsx`, `src/pages/Landing.tsx`, `src/pages/Availability.tsx`
- All components: `src/components/TripSheet.tsx`, `src/components/QuickPlanSheet.tsx`, `src/components/DirectTripSheet.tsx`, `src/components/DestinationCard.tsx`, `src/components/CostBreakdown.tsx`, `src/components/VotingPanel.tsx`, `src/components/TabBar.tsx`, `src/components/Layout.tsx`

**Hooks — not tested:**
- `src/hooks/useAuth.ts`
- `src/hooks/useTheme.ts`

**Context — not tested:**
- `src/contexts/NotificationContext.tsx` — notification counting logic has branching conditions that would benefit from tests

## Test Types

**Unit Tests:** Not present. Priority targets are the pure utility functions listed above.

**Integration Tests:** Not present. Firebase interactions (Firestore reads/writes, auth state) have no test coverage.

**E2E Tests:** Not present. No Cypress, Playwright, or similar framework installed.

## Recommendations

**Immediate value (no mocking required):**

Add a test file `src/utils/costEngine.test.ts` to cover `calculateCosts()`:
```typescript
import { describe, it, expect } from 'vitest'
import { calculateCosts } from './costEngine'

describe('calculateCosts', () => {
  it('splits campsite cost evenly across attendees', () => { ... })
  it('doubles distance for return trip fuel calculation', () => { ... })
  it('marks members over budget', () => { ... })
  it('handles zero attendees without dividing by zero', () => { ... })
})
```

Add `src/utils/driveCache.test.ts`:
```typescript
describe('isCacheValid', () => {
  it('returns false when cache is empty', () => { ... })
  it('returns false when home location moved more than 100m', () => { ... })
  it('returns false when oldest entry exceeds 30 days', () => { ... })
})

describe('formatDriveTime', () => {
  it('formats sub-hour durations', () => { ... })
  it('formats whole hours without minutes', () => { ... })
  it('formats hours and minutes', () => { ... })
})
```

**Setup required (to add testing at all):**

1. Install Vitest (matches existing Vite build toolchain):
   ```bash
   npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom
   ```

2. Add `vitest.config.ts`:
   ```typescript
   import { defineConfig } from 'vitest/config'
   export default defineConfig({
     test: { environment: 'jsdom', globals: true }
   })
   ```

3. Add test scripts to `package.json`:
   ```json
   "test": "vitest",
   "test:coverage": "vitest run --coverage"
   ```

**Testing Firebase interactions** — use `src/firebase.ts` mock (mock the module):
```typescript
vi.mock('../firebase', () => ({ db: {}, auth: {} }))
vi.mock('firebase/firestore', () => ({ getDoc: vi.fn(), ... }))
```

**Priority order for adding tests:**
1. `src/utils/costEngine.ts` — `calculateCosts()` is pure, complex, and business-critical
2. `src/utils/driveCache.ts` — `isCacheValid()` and `formatDriveTime()` are trivially pure
3. `src/utils/rankDestinations.ts` — scoring algorithm has many branches; cache-fast-path is testable without API mocks
4. `src/contexts/NotificationContext.tsx` — notification count logic has state branching
5. `src/hooks/useTheme.ts` — `getInitialTheme()` and `applyTheme()` can be tested with jsdom

---

*Testing analysis: 2026-04-06*
