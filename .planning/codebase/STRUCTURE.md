# Codebase Structure

**Analysis Date:** 2026-04-06

## Directory Layout

```
routed/
├── public/               # Static assets served at root
│   ├── manifest.json     # PWA manifest
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon.svg
│   ├── routed-icon.svg
│   └── apple-touch-icon.png
├── src/
│   ├── main.tsx          # App entry point — creates React root
│   ├── App.tsx           # Router, auth gate, theme init
│   ├── firebase.ts       # Firebase app + auth + Firestore singletons
│   ├── config.ts         # Env var exports (MAPBOX_TOKEN, FIREBASE_CONFIG)
│   ├── index.css         # Global styles, CSS variables, animations
│   ├── vite-env.d.ts     # Vite env type declarations
│   ├── pages/            # Full-screen route components
│   ├── components/       # Reusable UI components and overlays
│   ├── hooks/            # Custom React hooks
│   ├── contexts/         # React context providers
│   ├── utils/            # Pure functions + Firebase mutation helpers
│   ├── data/             # Static data bundled at build time
│   └── types/            # TypeScript interfaces
├── .planning/            # GSD planning documents
│   ├── STATE.md
│   ├── codebase/         # Codebase analysis docs (this file)
│   └── phases/           # Phase planning docs
├── dist/                 # Build output (gitignored)
├── index.html            # Vite HTML entry with #root mount point
├── vite.config.ts        # Vite + React + PWA plugin config
├── tailwind.config.js    # Tailwind config (utility classes)
├── postcss.config.js     # PostCSS config
├── tsconfig.json         # TypeScript config (strict)
├── tsconfig.node.json    # TypeScript config for Vite config file
├── vercel.json           # Vercel deployment config (SPA rewrites)
├── package.json
└── package-lock.json
```

## Directory Purposes

**`src/pages/`**
- Purpose: Full-screen route targets rendered by React Router
- Each file corresponds to one route
- Key files:
  - `src/pages/Map.tsx` — primary page; Mapbox canvas + all overlay sheets + crew markers
  - `src/pages/Trips.tsx` — trip list, crew wishlist, long weekend planning prompts
  - `src/pages/TripDetail.tsx` — trip management, voting, checklist, comments, cost breakdown
  - `src/pages/Crew.tsx` — crew member directory with vehicle info
  - `src/pages/Availability.tsx` — crew availability grid for long weekends + custom dates
  - `src/pages/Profile.tsx` — user profile editing, vehicle management, home location, theme toggle
  - `src/pages/Landing.tsx` — unauthenticated landing with Google sign-in
  - `src/pages/Onboarding.tsx` — first-time user setup flow

**`src/components/`**
- Purpose: Reusable UI — overlays rendered on top of the map, layout shell, shared widgets
- Key files:
  - `src/components/Layout.tsx` — outer shell; wraps page content with fixed `<TabBar>` at bottom
  - `src/components/TabBar.tsx` — bottom navigation bar; 5 tabs (Map, Trips, Dates, Crew, Profile); reads `NotificationContext` for badge dot
  - `src/components/TripSheet.tsx` — full trip planning sheet; date/budget/crew form → ranked destination results → save trip
  - `src/components/DirectTripSheet.tsx` — streamlined trip creation with a pre-selected destination (entered from map popup)
  - `src/components/QuickPlanSheet.tsx` — quick/simplified trip planning variant
  - `src/components/VotingPanel.tsx` — destination voting UI within `TripDetailPage`
  - `src/components/CostBreakdown.tsx` — per-member cost breakdown display within `TripDetailPage`
  - `src/components/DestinationCard.tsx` — card for a ranked destination in TripSheet results view
  - `src/components/ShortlistButton.tsx` — heart/wishlist toggle button for a destination
  - `src/components/TopoPattern.tsx` — decorative SVG topographic line pattern used in page headers

**`src/hooks/`**
- Purpose: Custom hooks for shared stateful logic
- Key files:
  - `src/hooks/useAuth.ts` — Firebase Auth state + Firestore user profile loading; returns `{ user, profile, loading }`; used only in `App.tsx`
  - `src/hooks/useTheme.ts` — theme toggle with `localStorage` persistence; exports `useTheme()` and `initTheme()`

**`src/contexts/`**
- Purpose: App-wide React context for cross-cutting data
- Key files:
  - `src/contexts/NotificationContext.tsx` — tracks `unvotedTrips` and `imminentTrips` counts via Firestore subscriptions; provides `useNotifications()` hook

**`src/utils/`**
- Purpose: All business logic, Firestore operations, and Mapbox helpers
- Key files:
  - `src/utils/rankDestinations.ts` — core destination ranking algorithm; fast path (driveCache) + slow path (Mapbox Directions API)
  - `src/utils/costEngine.ts` — pure function `calculateCosts()` for per-member trip cost calculation
  - `src/utils/mapDestinations.ts` — `addDestinationDots()`, `updateDestinationShortlistVisuals()`, `highlightRankedDestinations()` — all Mapbox layer manipulation for destinations
  - `src/utils/mapRoutes.ts` — `fetchRoutes()`, `drawRoutes()`, `clearRoutes()`, `setDestination()` — Mapbox route polylines and destination marker
  - `src/utils/driveCache.ts` — `isCacheValid()`, `buildDriveCache()`, `saveDriveCache()`, `formatDriveTime()`
  - `src/utils/shortlistUtils.ts` — `toggleShortlist()`, `subscribeToDestinationShortlists()`, `subscribeToMemberShortlists()`, `subscribeToAllShortlists()`
  - `src/utils/availabilityUtils.ts` — `setWeekendAvailability()`, `setCustomAvailability()`, `subscribeToAllAvailability()`
  - `src/utils/tripActions.ts` — `openVoting()`, `closeVoting()`, `startTrip()`, `completeTrip()`, `cancelTrip()`, `reopenVoting()`
  - `src/utils/spotlight.ts` — `getSpotlightDestinations()` — picks 3 map welcome cards by distance bucket
  - `src/utils/userPhoto.ts` — photo URL resolution helper
  - `src/utils/availabilityUtils.ts` — availability read/write helpers

**`src/data/`**
- Purpose: Static typed data bundled at build time (not fetched from Firestore)
- Key files:
  - `src/data/destinations.ts` — master destination database; exports `destinations: Destination[]`, `Destination` interface, helper functions `filterByVehicleAccess()`, `filterByTripLength()`, `getCurrentSeason()`
  - `src/data/publicHolidays.ts` — Australian public holidays + `getUpcomingLongWeekends()`
  - `src/data/longWeekends.ts` — static `LongWeekend[]` array
  - `src/data/vehicleDefaults.ts` — `getConsumptionDefault()` lookup for L/100km by vehicle name/type

**`src/types/`**
- Purpose: Shared TypeScript interfaces
- Key file: `src/types/index.ts` — exports `Vehicle`, `HomeLocation`, `DriveCacheEntry`, `DriveCache`, `UserProfile`, `Vote`, `Shortlist`, `Trip`

## Key File Locations

**Entry Points:**
- `src/main.tsx` — React root creation
- `src/App.tsx` — auth gate, router, theme init
- `index.html` — HTML shell with `<div id="root">`

**Firebase:**
- `src/firebase.ts` — exports `auth`, `db`, `googleProvider`
- `src/config.ts` — exports `MAPBOX_TOKEN` and `FIREBASE_CONFIG` from env vars

**Styles:**
- `src/index.css` — all global CSS; CSS custom properties for theme colours, typography scale, animations (`card-animate`, `spinner`, `skeleton`)

**Types:**
- `src/types/index.ts` — all shared interfaces
- `src/data/destinations.ts` — also exports `Destination`, `Activity`, `RoadType`, `Season`, `TripLength`, `BookingInfo` types

**Core Business Logic:**
- `src/utils/rankDestinations.ts` — destination scoring
- `src/utils/costEngine.ts` — trip cost calculation
- `src/utils/tripActions.ts` — trip lifecycle mutations

**Mapbox Integration:**
- `src/utils/mapDestinations.ts` — destination layer management
- `src/utils/mapRoutes.ts` — route layer management
- `src/pages/Map.tsx` — map initialisation and imperative map ref

**Testing:**
- Not present — no test files or test framework configured

## Naming Conventions

**Files:**
- Pages: PascalCase matching the page/concept name — `Map.tsx`, `TripDetail.tsx`, `Availability.tsx`
- Components: PascalCase — `TripSheet.tsx`, `TabBar.tsx`, `TopoPattern.tsx`
- Hooks: camelCase with `use` prefix — `useAuth.ts`, `useTheme.ts`
- Utils: camelCase describing the domain — `rankDestinations.ts`, `costEngine.ts`, `mapRoutes.ts`
- Data: camelCase — `destinations.ts`, `publicHolidays.ts`, `vehicleDefaults.ts`
- Context: PascalCase with `Context` suffix — `NotificationContext.tsx`

**Directories:**
- Lowercase plural — `pages/`, `components/`, `hooks/`, `utils/`, `data/`, `types/`, `contexts/`

**Exports:**
- Pages: single default export — `export default function MapPage()`
- Components: single default export — `export default function TripSheet(...)`
- Utils: named exports — `export async function rankDestinations(...)`, `export function calculateCosts(...)`
- Types: named exports — `export interface UserProfile`
- Context: named exports — `export function NotificationProvider(...)`, `export function useNotifications()`

**Local Storage Keys:**
- All prefixed `routed-` — `routed-theme`, `routed-pending-trip-dates`, `routed-welcome-seen`, `routed-fab-seen`, `routed-spotlight`

## Where to Add New Code

**New page / route:**
- Implementation: `src/pages/NewPage.tsx`
- Register route in `src/App.tsx` inside the `<Routes>` block
- Add tab to `src/components/TabBar.tsx` tabs array if it needs a tab bar entry
- Lazy load with `lazy(() => import('./pages/NewPage'))` if it's non-critical path

**New reusable UI component:**
- Implementation: `src/components/NewComponent.tsx`
- Default export, props interface defined inline above the component

**New Firestore collection operations:**
- Implementation: new file `src/utils/newCollectionUtils.ts`
- Follow pattern from `shortlistUtils.ts` or `availabilityUtils.ts` — named exports for subscribe/set/delete functions

**New business logic / algorithm:**
- Implementation: `src/utils/newFeature.ts`
- Pure functions only (no React hooks, no direct DOM manipulation)
- If it touches Mapbox, put it in a file prefixed `map` — `mapNewFeature.ts`

**New data types:**
- Add to `src/types/index.ts`
- If types are specific to a data module (like `Destination`), export from that module's file in `src/data/`

**New static data:**
- Implementation: `src/data/newData.ts`
- Export a typed array or typed constants; avoid any async operations in data files

**New React hook:**
- Implementation: `src/hooks/useNewHook.ts`
- Named export `export function useNewHook()`

**Adding a destination to the database:**
- Edit `src/data/destinations.ts`; add entry to the `destinations` array following the `Destination` interface
- No Firestore changes needed — destinations are static

## Special Directories

**`dist/`**
- Purpose: Vite production build output
- Generated: Yes
- Committed: No (gitignored)

**`node_modules/`**
- Purpose: NPM dependencies
- Generated: Yes
- Committed: No

**`.planning/`**
- Purpose: GSD planning documents — codebase analysis, phase plans, project state
- Generated: By GSD commands
- Committed: Yes

**`public/`**
- Purpose: Static files copied verbatim to dist root; not processed by Vite
- Committed: Yes — contains PWA icons and `manifest.json`

---

*Structure analysis: 2026-04-06*
