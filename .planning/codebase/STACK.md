# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- TypeScript 5.4.5 — all source code in `src/`
- TSX — React component files throughout `src/components/`, `src/pages/`

**Secondary:**
- CSS — `src/index.css` (Tailwind base + custom properties + global component styles)
- JavaScript — `tailwind.config.js`, `postcss.config.js`

## Runtime

**Environment:**
- Browser (SPA — no server-side runtime)
- Node.js — development/build tooling only (no .nvmrc; uses ambient version)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 18.3.1 — UI rendering (`src/main.tsx`, `src/App.tsx`)
- React Router DOM 6.23.1 — client-side routing (`src/App.tsx`)
  - `BrowserRouter` wrapping entire app
  - Routes: `/map`, `/trips`, `/trips/:tripId`, `/crew`, `/profile`, `/availability`
  - Three pages lazy-loaded via `React.lazy`: `Map`, `TripDetail`, `Availability`

**Styling:**
- Tailwind CSS 3.4.4 — utility classes configured in `tailwind.config.js`
  - `darkMode: 'media'` (OS-level dark mode detection)
  - Custom color palette: `moss`, `ochre`, `terracotta`, `charcoal`, `stone`, `violet`, `coral`
  - Custom fonts: `fraunces`, `sans`, `mono`
- PostCSS 8.4.38 — Tailwind processing (`postcss.config.js`)
- Autoprefixer 10.4.19 — vendor prefixes
- CSS custom properties for theming (`:root`, `[data-theme="dark"]`, `[data-theme="light"]`) in `src/index.css`

**Fonts:**
- Fraunces (serif, variable) — headings and branding, loaded from Google Fonts
- DM Sans (sans-serif, variable) — body text
- JetBrains Mono — monospace
- All loaded via `@import` in `src/index.css`

## Build & Dev Tools

**Bundler:**
- Vite 5.3.1 — configured in `vite.config.ts`
- `@vitejs/plugin-react` 4.3.0 — React fast refresh + JSX transform

**PWA:**
- `vite-plugin-pwa` 0.20.0 — Service Worker (Workbox) + web manifest generation
  - `registerType: 'autoUpdate'`
  - `maximumFileSizeToCacheInBytes: 4 MiB` (allows caching large mapbox-gl bundle)
  - Manifest: `name: 'Routed'`, `display: 'standalone'`, `orientation: 'portrait'`
  - Icons: `routed-icon.svg`, `icon-192.png`, `icon-512.png`

**TypeScript Config (`tsconfig.json`):**
- `target: ES2020`
- `module: ESNext`, `moduleResolution: bundler`
- `jsx: react-jsx`
- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- `noEmit: true` (Vite handles emit; `tsc` is type-check only)

**SVG/PNG icon generation:**
- `@resvg/resvg-js` 2.6.2 — devDependency, used for converting SVG icons to PNG at build time

## Key Dependencies

**Critical:**
- `firebase` 10.12.0 — auth, Firestore database (`src/firebase.ts`)
- `mapbox-gl` 3.20.0 — interactive map rendering, routing, geocoding (`src/pages/Map.tsx`, `src/utils/`)
- `@types/mapbox-gl` 3.4.1 — TypeScript types for mapbox-gl

**Infrastructure:**
- `react-dom` 18.3.1 — DOM rendering
- `@types/react` 18.3.3, `@types/react-dom` 18.3.0 — TypeScript types

## Configuration

**Environment:**
- Vite `import.meta.env` pattern — all runtime config via `VITE_*` prefix
- Centralised in `src/config.ts` (exports `MAPBOX_TOKEN`) and `src/firebase.ts` (initialises Firebase app)
- `.env.example` documents all required variables (7 total)
- `.env` file present (not committed)

**Deployment:**
- `vercel.json` — SPA rewrites (`"source": "/(.*)"` → `/index.html`), 1-year immutable cache for `/assets/`

## Platform Requirements

**Development:**
- `npm run dev` → Vite dev server with HMR
- `npm run build` → `tsc && vite build`
- `npm run preview` → local preview of dist

**Production:**
- Deployed to Vercel (static SPA)
- Service Worker via Workbox for offline/PWA capabilities
- No server-side rendering; all data fetched client-side from Firebase

---

*Stack analysis: 2026-04-06*
