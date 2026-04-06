# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- Pages: PascalCase, e.g. `Map.tsx`, `TripDetail.tsx` — named after the feature, not the route
- Components: PascalCase, e.g. `TripSheet.tsx`, `DestinationCard.tsx`
- Hooks: camelCase with `use` prefix, e.g. `useAuth.ts`, `useTheme.ts`
- Utilities: camelCase module names, e.g. `rankDestinations.ts`, `driveCache.ts`, `tripActions.ts`
- Data files: camelCase, e.g. `destinations.ts`, `publicHolidays.ts`
- Types: `src/types/index.ts` — single shared types barrel

**Functions:**
- Exported page/component functions: PascalCase — `export default function MapPage()`
- Internal helper functions: camelCase — `function formatDateRange()`, `function calcNights()`
- Utility exports: camelCase — `export async function rankDestinations()`
- Hook exports: camelCase with `use` prefix — `export function useAuth()`
- Context provider: PascalCase suffix `Provider` — `export function NotificationProvider()`
- Context hook: `use` + context name — `export function useNotifications()`

**Variables:**
- State: camelCase descriptive nouns — `const [trips, setTrips] = useState<Trip[]>([])`
- Refs: camelCase with `Ref` suffix — `mapContainerRef`, `mapRef`, `markersRef`
- Constants (module-level): SCREAMING_SNAKE_CASE — `const MAP_STYLE_TERRAIN`, `const CREW_COLOURS`, `const PENDING_DATES_KEY`
- Local storage keys: kebab-case string constants — `'routed-pending-trip-dates'`, `'routed-welcome-seen'`

**Types/Interfaces:**
- Interfaces: PascalCase, `interface` keyword — `interface TripSheetProps`, `interface NotificationContextValue`
- Type aliases: PascalCase, `type` keyword — `type SheetMode = 'closed' | 'full' | 'peek'`, `type Theme = 'light' | 'dark'`
- Exported types from utils: PascalCase interfaces adjacent to the function that returns them — `export interface RankedDestination` in `rankDestinations.ts`
- Local types scoped to a file: declared at the top of that file, before components

## TypeScript Usage

**Strict mode enabled** — `tsconfig.json` has `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`.

**Type imports:** `import type { X }` used for type-only imports throughout:
```typescript
import type { UserProfile } from '../types'
import type { Trip } from '../types'
import type { RefObject } from 'react'
```

**Inline type assertions — used sparingly and only when necessary:**
```typescript
setProfile(snap.data() as UserProfile)
const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip))
```

**`satisfies` operator — used in `mapRoutes.ts` to validate return shape:**
```typescript
return { ... } satisfies RouteResult
```

**Discriminated union literals** for status enums (not `enum` keyword):
```typescript
status: 'proposed' | 'voting' | 'confirmed' | 'active' | 'completed'
type SheetMode = 'closed' | 'full' | 'peek'
```

**Generic state typing always explicit:**
```typescript
const [user, setUser] = useState<User | null>(null)
const [trips, setTrips] = useState<Trip[]>([])
const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
```

**No `any` usage detected** across the codebase.

**Type narrowing via optional chaining and nullish coalescing:**
```typescript
const uid = user?.uid ?? null
const cached = driveCache?.[dest.id]
onProgress?.(done, total)
```

## React Patterns

**Components:**
- All components are function components — no class components anywhere
- Default exports for pages and components: `export default function MapPage()`
- Named exports for hooks, context providers, and utilities: `export function useAuth()`
- Props interfaces declared inline above the component they belong to

**Hooks:**
- `useState` — used for all local state; always explicitly typed
- `useEffect` — used for side effects; each logical concern gets its own `useEffect` (not combined)
- `useRef` — used for Mapbox map instance, marker arrays, and DOM container refs
- `useCallback` — used selectively in `Profile.tsx` and `Onboarding.tsx` for stable function references
- `useLayoutEffect` — used once in `App.tsx` to apply theme before first paint (prevents FOUC)
- `useContext` via named hook wrappers (never raw `useContext` in components)
- Lazy loading: `lazy(() => import('./pages/Map'))` for heavy pages (Map, TripDetail, Availability)

**Effect cleanup pattern — always return the unsubscribe function directly:**
```typescript
useEffect(() => {
  return onAuthStateChanged(auth, (user) => { ... })
}, [])

useEffect(() => {
  const unsub = onSnapshot(q, (snap) => { ... })
  return unsub
}, [uid])
```

**Multiple independent effects pattern** (one concern per effect):
```typescript
// Effect 1: auth listener
useEffect(() => { return onAuthStateChanged(auth, ...) }, [])
// Effect 2: load crew
useEffect(() => { getDocs(...).then(...) }, [])
// Effect 3: subscribe trips
useEffect(() => { if (uid === null) { ... }; const q = query(...); return onSnapshot(q, ...) }, [uid])
```

**Refs for Mapbox:**
```typescript
const mapContainerRef = useRef<HTMLDivElement>(null)
const mapRef = useRef<mapboxgl.Map | null>(null)
const markersRef = useRef<mapboxgl.Marker[]>([])
```

**Context pattern:**
```typescript
// 1. Create context with default value
const NotificationContext = createContext<NotificationContextValue>({ unvotedTrips: 0, imminentTrips: 0 })
// 2. Export named hook wrapper
export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext)
}
// 3. Export named provider component
export function NotificationProvider({ children }: { children: ReactNode }) { ... }
```

**Conditional rendering via early returns:**
```typescript
if (loading) return <LoadingScreen />
if (!user) return <Landing />
if (!profile || !profile.onboardingComplete) return <Onboarding ... />
```

## Styling System

**Hybrid approach — CSS custom properties + inline styles (dominant) + Tailwind utility classes (minimal).**

**Design tokens** defined as CSS custom properties in `src/index.css`:
```css
:root {
  --color-base: #FAFAF7;
  --color-moss: #4A6741;
  --color-ochre: #C4893B;
  --color-terracotta: #B85C38;
  --color-charcoal: #2D2D2D;
  --color-stone: #8C8578;
  --color-violet: #7C5CBF;
  --color-coral: #E07A5F;
  --color-surface: #FFFFFF;
  --color-border: rgba(44, 44, 44, 0.12);
}
```

**Inline styles are the dominant pattern** for layout and component-specific styles. Components reference tokens via `var(--color-*)`:
```tsx
style={{ backgroundColor: 'var(--color-base)', color: 'var(--color-moss)' }}
```

**Hardcoded hex values** appear alongside token references — a known inconsistency. Examples:
- `background: 'rgba(255,255,255,0.92)'` instead of `var(--color-surface)`
- `color: '#2D2D2D'` hardcoded in popup HTML strings (Mapbox popups cannot use CSS vars)
- `'#4A6741'` directly in `CREW_COLOURS` array and Mapbox layer configs

**Global CSS classes** in `src/index.css` for shared patterns:
- `.card` — surface card container
- `.btn-primary`, `.btn-secondary`, `.btn-danger` — button variants
- `.input` — form input base style
- `.spinner` — loading spinner
- `.skeleton` — skeleton loading placeholder
- `.card-animate` — `fadeSlideUp` entrance animation
- `.topo-bg`, `.topo-bg-wrapper` — topographic background pattern
- `.topo-pattern` — SVG topo component wrapper

**Tailwind** is configured (`tailwind.config.js`) with the design token colours and fonts, but is only used for a handful of utility classes (e.g. `className="topo-bg"`, `className="spinner"`). Tailwind is **not** used for layout or spacing — that is handled entirely by inline styles.

**Hover effects** are handled via `onMouseEnter`/`onMouseLeave` event handlers mutating `style` directly:
```tsx
onMouseEnter={(e) => {
  const el = e.currentTarget
  el.style.transform = 'translateY(-2px)'
  el.style.boxShadow = '0 6px 24px rgba(196, 137, 59, 0.15)'
}}
onMouseLeave={(e) => {
  const el = e.currentTarget
  el.style.transform = ''
  el.style.boxShadow = ''
}}
```

**Vendor-prefixed properties** used where needed:
```tsx
WebkitBackdropFilter: 'blur(4px)'
WebkitLineClamp: 2
WebkitBoxOrient: 'vertical' as const
WebkitTapHighlightColor: 'transparent'
```

**Inline `<style>` tags** inside components for keyframe animations that can't live in CSS files (e.g. notification dot pulse in `TabBar.tsx`).

## Firebase Patterns

**Initialisation** — single module `src/firebase.ts` exports `auth`, `db`, `googleProvider`. All files import from here.

**Firestore read — one-time fetch:**
```typescript
const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
if (snap.exists()) { setProfile(snap.data() as UserProfile) }
```

**Firestore read — real-time listener (dominant pattern):**
```typescript
const q = query(
  collection(db, 'trips'),
  where('attendees', 'array-contains', uid),
  orderBy('createdAt', 'desc')
)
const unsub = onSnapshot(q, (snap) => { ... })
return unsub  // returned from useEffect for cleanup
```

**Firestore write — update existing document:**
```typescript
await updateDoc(doc(db, 'trips', tripId), { status: 'voting' })
```

**Firestore write — create with auto ID:**
```typescript
await addDoc(collection(db, 'trips'), { ...fields, createdAt: Timestamp.now() })
```

**Firestore write — create with deterministic ID (upsert pattern):**
```typescript
const docId = `${memberUid}_${destinationId}`
await setDoc(doc(db, 'shortlists', docId), { ... })
```

**Subcollection deletion** — manual cascade (Firestore does not cascade-delete):
```typescript
for (const sub of ['checklist', 'comments', 'votes']) {
  const snap = await getDocs(collection(db, 'trips', tripId, sub))
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
}
await deleteDoc(doc(db, 'trips', tripId))
```

**Timestamp usage:**
- `Timestamp.now()` for writes
- `serverTimestamp()` imported but available for server-side timestamps on trip creation
- Date comparison uses `new Date(trip.dateRange.start).getTime()` (ISO strings stored, not Timestamps, for date fields)

**Auth state** — pages that need the current user call `onAuthStateChanged` directly in a `useEffect` (local `uid` state), rather than using `useAuth()`. This avoids prop drilling but creates duplicated auth listeners across pages. The single `useAuth()` hook is only used at the top level in `App.tsx`.

## Mapbox Patterns

**Map initialisation** — inside `useEffect` checking `mapContainerRef.current` and `mapRef.current` guard:
```typescript
useEffect(() => {
  if (!mapContainerRef.current || mapRef.current) return
  mapboxgl.accessToken = MAPBOX_TOKEN
  mapRef.current = new mapboxgl.Map({ container: mapContainerRef.current, ... })
  mapRef.current.on('load', () => setMapLoaded(true))
}, [])
```

**Marker creation** — DOM elements built imperatively with `el.style.cssText` (not React-rendered), appended via `new mapboxgl.Marker({ element: el })`. This is the correct Mapbox pattern for custom markers.

**Layer/source management** — guard with `map.getSource(id)` / `map.getLayer(id)` before adding:
```typescript
if (!map.getSource(sourceId)) { map.addSource(...) }
if (!map.getLayer(layerId)) { map.addLayer(...) }
```

**Route animation** — `requestAnimationFrame` loop driving `line-dasharray` paint property:
```typescript
function animate(timestamp: number) {
  const progress = Math.min((timestamp - start) / duration, 1)
  map.setPaintProperty(solidLayerId, 'line-dasharray', [progress * 200, 0])
  if (progress < 1) requestAnimationFrame(animate)
}
requestAnimationFrame(animate)
```

**Popup HTML** — built via string interpolation (not React), so inline styles only — CSS custom properties unavailable inside popup HTML strings. This is why hardcoded hex values appear in popup builders.

**Map style switching** — `map.setStyle(url)` then re-adding sources/layers on the `'style.data'` event.

## Error Handling

**Async operations in event handlers — try/catch with `console.error`:**
```typescript
try {
  await saveProfile()
} catch (err) {
  console.error('Save error:', err)
}
```

**Async operations in effects — `.catch(() => {})` to swallow non-critical errors:**
```typescript
getRedirectResult(auth).catch(() => {})
```

**Firebase fetch errors in effects — silent catch with fallback state:**
```typescript
getDocs(collection(db, 'users')).then((snap) => {
  setAllMembers(snap.docs.map((d) => d.data() as UserProfile))
}).catch(() => {})
```

**Async operations in effects using async IIFE** (when `useEffect` callback cannot be async):
```typescript
useEffect(() => {
  async function loadCrew() { ... }
  loadCrew()
}, [])
```

**No global error boundary** — errors in render are unhandled. No `ErrorBoundary` component exists.

**User-facing error state** — ad hoc string state variables:
```typescript
const [rankError, setRankError] = useState<string | null>(null)
// Shown conditionally in JSX
```

No toast/notification system for error feedback — errors are shown inline where they occur, or only logged to console.

## Comments

**Inline comments for non-obvious logic:**
```typescript
// Key must match the one exported from Trips.tsx
const PENDING_DATES_KEY = 'routed-pending-trip-dates'

// Firestore doesn't cascade-delete
for (const sub of ['checklist', 'comments', 'votes']) { ... }
```

**Section dividers in large files** using dash-lines:
```typescript
// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
```

**JSDoc** — used only on utility functions with non-obvious parameters:
```typescript
/**
 * Fetches drive times from a home location to all destinations.
 * Batches calls in groups of BATCH_SIZE with a delay between batches.
 * onProgress(done, total) is called after each individual fetch.
 */
export async function buildDriveCache(...): Promise<DriveCache>
```

No JSDoc on React components or hooks.

## Import Organization

**Order (observed):**
1. React and built-in React hooks
2. External library imports (react-router-dom, firebase/*, mapbox-gl)
3. Internal aliases/config (`../config`, `../firebase`)
4. Type imports (`import type { ... }`)
5. Component imports
6. Utility/data imports

No path aliases configured — all imports use relative paths (`../`, `./`).

## Function Design

**Small, pure utility functions** extracted to `src/utils/`:
- `haversineKm()`, `formatDriveTime()`, `calcNights()`, `formatDateRange()` — pure, easily testable
- `isCacheValid()` — pure predicate function

**Large page components** (e.g. `Map.tsx`, `TripDetail.tsx`) contain extensive logic inline with JSX. These files are the longest in the codebase and have the most state variables.

**Helper components** declared in the same file as the page that uses them (e.g. `SpotlightCard` in `Map.tsx`, `StepDots` in `Onboarding.tsx`, `CrewCardSkeleton` in `Crew.tsx`). Only promoted to `src/components/` when reused.

## Module Design

**Exports:**
- Pages and components: `export default`
- Hooks, context, utilities: named exports
- Types: named exports from `src/types/index.ts`

**No barrel files** (`index.ts`) — each module is imported directly by path.

**Duplication note:** `CREW_COLOURS` array is defined identically in three files: `src/pages/Map.tsx`, `src/components/TripSheet.tsx`, and `src/utils/rankDestinations.ts`. Similarly, `formatDateRange` appears in both `src/pages/Trips.tsx` and `src/pages/TripDetail.tsx`.

---

*Convention analysis: 2026-04-06*
