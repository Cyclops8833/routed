# Phase 1: Port Map Enhancements — Research

**Researched:** 2026-04-06
**Domain:** Mapbox GL JS v3 — terrain, pitch/tilt, style toggle, attribution
**Confidence:** HIGH

## Summary

This phase ports four discrete map features from `S:\Claude\wildmap` into `S:\Claude\routed`. The source implementations are fully readable and production-quality; every feature's exact Mapbox API usage is confirmed in wildmap's codebase. Routed uses vanilla `mapbox-gl` (v3.20.0) with a `mapboxgl.Map` ref pattern, whereas wildmap uses `react-map-gl/mapbox` (a React wrapper around the same GL JS engine). The porting work is therefore a **translation from react-map-gl abstractions back to raw mapbox-gl imperative API calls** — the underlying Mapbox APIs (`addSource`, `setTerrain`, `easeTo`, `setStyle`, `AttributionControl`) are identical between both approaches.

The four features are largely independent. Features 1 (terrain) and 2 (tilt) are related — tilt only makes visual sense with terrain, and wildmap links them. Feature 3 (style toggle) already has a partial implementation in routed but needs to be replaced with a two-button Topo/Satellite control matching wildmap's visual pattern. Feature 4 (attribution) is the smallest change — pass `{ compact: true }` to `NavigationControl` disabled mode and add `AttributionControl` with `compact: true`, or simply pass the compact option at Map construction.

**Primary recommendation:** Implement all four features directly in `Map.tsx` as inline state + imperative mapbox-gl calls. No Zustand store or react-map-gl is needed — routed's architecture is simpler and imperative patterns are already established in that file.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mapbox-gl | 3.20.0 | Map engine — terrain, sky, style, attribution | Already in routed; same version as wildmap |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React useState | (built-in) | isSatellite, isPitch, isTerrain flags | All feature toggles live in Map.tsx component state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline state in Map.tsx | Zustand store (like wildmap) | Zustand is overkill for routed — one page needs these states |
| Single toggle button | Two-button pill (wildmap pattern) | Pill is clearer UX; already exists in wildmap verbatim |

### No new packages required
All features use Mapbox GL JS APIs already bundled. `[VERIFIED: package.json]` — routed already has `mapbox-gl: ^3.20.0`.

## Architecture Patterns

### Recommended Project Structure

No new files needed. All changes live in one existing file:

```
src/
└── pages/
    └── Map.tsx    ← all four feature changes here
```

### Feature 1: 3D Terrain

**What:** Add a DEM raster source and enable terrain exaggeration via `map.setTerrain()`. Toggle on/off.

**Exact wildmap implementation** (`S:\Claude\wildmap\src\App.tsx`, lines 420–434):

```typescript
// Source: S:\Claude\wildmap\src\App.tsx
const applyTerrain = (map: MapboxMap): void => {
  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
};

const removeTerrain = (map: MapboxMap): void => {
  map.setTerrain(null);
};
```

**Trigger:** useEffect watching `terrain3DEnabled` state + `mapLoaded`. In routed, this becomes a `useState<boolean>` for `isTerrain` toggled by a button.

**Style-swap survival:** When `map.setStyle()` is called (topo/satellite toggle), the DEM source is wiped. Must re-apply terrain in the `style.load` event listener. Wildmap handles this at line 461–463:

```typescript
// Source: S:\Claude\wildmap\src\App.tsx
map.on('style.load', () => {
  if (isTerrain) { // routed equivalent: read current state in closure
    applyTerrain(map);
  }
});
```

**Critical:** routed's `toggleStyle()` (line 452–459) calls `map.setStyle()` directly. After adding terrain, this handler must re-apply terrain if terrain is currently on. Use a `useRef` or closure over latest state to avoid stale closure.

### Feature 2: Tilt Button

**What:** A button that toggles map pitch between 0° and 60° via `map.easeTo({ pitch })`.

**Exact wildmap implementation** (`S:\Claude\wildmap\src\components\map\TiltButton.tsx`):

```typescript
// Source: S:\Claude\wildmap\src\components\map\TiltButton.tsx
const isTilted = mapPitch > 5; // threshold prevents flickering from inertia

const handleToggle = () => {
  mapRef?.easeTo({ pitch: isTilted ? 0 : 60, duration: 400 });
};
```

**In routed:** `mapRef.current` is the raw `mapboxgl.Map`. The call becomes:

```typescript
mapRef.current?.easeTo({ pitch: isPitched ? 0 : 60, duration: 400 });
```

**Pitch tracking:** Wildmap uses a Zustand store updated from `map.on('pitch', ...)`. In routed, use `useState<number>(0)` for `mapPitch` and update it from the existing `map.on('load', ...)` handler:

```typescript
map.on('pitch', () => {
  setMapPitch(map.getPitch());
});
```

**Active state:** `isTilted = mapPitch > 5` (5° threshold avoids flickering near 0° due to inertia).

### Feature 3: Topo/Satellite Style Toggle (Replace Existing)

**What:** Replace the current single-button toggle (`{isSatellite ? '🗺 Terrain' : '🛰 Satellite'}`) with a two-button pill matching wildmap's `BaseStyleToggle`.

**Current routed state:** Single button at `top: 106px, right: 10px` with `toggleStyle()` handler. The style constants `MAP_STYLE_TERRAIN` and `MAP_STYLE_SATELLITE` already exist at lines 22–23 (correct URLs: `outdoors-v12` / `satellite-streets-v12`).

**Wildmap BaseStyleToggle pattern:**

```typescript
// Source: S:\Claude\wildmap\src\components\controls\BaseStyleToggle.tsx
<div className="fixed right-4 z-10 flex flex-col rounded-lg ...">
  <button onClick={() => setBaseStyle('outdoors')} aria-pressed={baseStyle === 'outdoors'}>
    Topo
  </button>
  <button onClick={() => setBaseStyle('satellite')} aria-pressed={baseStyle === 'satellite'}>
    Satellite
  </button>
</div>
```

**In routed:** Since Map.tsx uses inline styles (not Tailwind classes), implement this as a React inline-style two-button group positioned at `top: 106px, right: 10px`. Keep the same `isSatellite` state and `toggleStyle` logic but split into two buttons.

**Style-swap pitfall (terrain re-application):** See Feature 1 — `style.load` handler must exist.

### Feature 4: Attribution — Compact (i) Icon Only

**What:** Replace the default full-text Mapbox attribution (which includes Creative Commons text) with the compact icon-only "i" button that expands on click.

**Wildmap approach** (`S:\Claude\wildmap\src\App.tsx`, lines 448, 472):

```typescript
// Source: S:\Claude\wildmap\src\App.tsx
// On <Map> component:
attributionControl={false}    // disable react-map-gl's default

// Inside <Map>:
<AttributionControl compact={true} />  // react-map-gl wrapper
```

**Routed equivalent** — vanilla mapbox-gl, in the map init:

```typescript
// Current routed map init (line 285-291):
const map = new mapboxgl.Map({
  container: mapContainerRef.current,
  style: MAP_STYLE_TERRAIN,
  center: [133.7751, -25.2744],
  zoom: 4,
  attributionControl: false,  // disable built-in
})
// Then add compact control:
map.addControl(new mapboxgl.AttributionControl({ compact: true }))
```

**Note:** The existing `NavigationControl` is unrelated to attribution. Setting `compact: true` shows only the (i) circle icon; clicking it expands the full attribution. This satisfies Mapbox's ToS requirement (attribution must be available) while removing the always-visible Creative Commons text. `[CITED: docs.mapbox.com/mapbox-gl-js/api/markers/]`

### Anti-Patterns to Avoid

- **Don't remove attribution entirely:** Mapbox ToS requires attribution to be accessible. `compact: true` keeps it accessible via click. `[CITED: docs.mapbox.com/help/getting-started/attribution/]`
- **Don't apply terrain before map `load` fires:** `addSource` and `setTerrain` must be called after the map is fully loaded. Routed already has a `mapLoaded` state gate.
- **Don't forget style.load re-application:** Calling `setStyle()` wipes all custom sources and terrain. Must re-apply terrain and sky in the `style.load` event handler.
- **Don't use stale closure for terrain state:** The `style.load` callback captures the state value at binding time. Use a `useRef` mirroring `isTerrain` state to read the latest value inside the callback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DEM elevation data | Custom raster tiles | `mapbox://mapbox.mapbox-terrain-dem-v1` | Mapbox's hosted DEM; requires Mapbox token already in project |
| Attribution icon UI | Custom HTML overlay | `mapboxgl.AttributionControl({ compact: true })` | Built-in, ToS-compliant, accessible |
| Style switch | Custom layer management | `map.setStyle(url)` | Mapbox handles layer teardown/rebuild |
| Pitch animation | CSS transform | `map.easeTo({ pitch, duration })` | Mapbox handles camera interpolation |

## Runtime State Inventory

Step 2.5: SKIPPED — this is a greenfield feature addition, not a rename/refactor/migration phase.

## Common Pitfalls

### Pitfall 1: Terrain Lost After Style Swap
**What goes wrong:** User enables terrain, then switches Topo/Satellite. Terrain disappears and doesn't come back.
**Why it happens:** `map.setStyle()` removes all custom sources including `mapbox-dem`. The `mapLoaded` state stays `true` but terrain source is gone.
**How to avoid:** Add `map.on('style.load', handler)` inside the map `load` callback. In the handler, check a `useRef` (not state, to avoid stale closures) for `isTerrain` and call `applyTerrain(map)` if true.
**Warning signs:** Terrain toggle button shows active but map is flat after style change.

### Pitfall 2: Stale Closure in style.load Handler
**What goes wrong:** `style.load` handler always reads `isTerrain = false` (the initial value).
**Why it happens:** The handler is defined inside `useEffect([])` (runs once), capturing the initial `isTerrain` value.
**How to avoid:** Mirror `isTerrain` state into a `useRef`: `const isTerrainRef = useRef(false)` updated in a separate `useEffect([isTerrain])`. Read `isTerrainRef.current` inside the `style.load` handler.

### Pitfall 3: NavigationControl and Attribution Overlap
**What goes wrong:** Adding `AttributionControl` after `NavigationControl` causes visual overlap in the bottom-right corner.
**Why it happens:** Both controls default to `bottom-right` position. `AttributionControl` position defaults to `bottom-right`.
**How to avoid:** Keep `NavigationControl` at `top-right` (current position). `AttributionControl` with `compact: true` renders as a small (i) in the `bottom-right` — this is the standard Mapbox position and won't conflict.

### Pitfall 4: Topo/Satellite Button Position Conflicts with NavigationControl
**What goes wrong:** Two-button pill placed at same coordinates as NavigationControl or crew pins.
**Why it happens:** Routed's current single-button is at `top: 106px, right: 10px`. NavigationControl is at `top-right`. The pill is taller than the single button.
**How to avoid:** Measure the existing NavigationControl height (~93px for zoom +/-). Current button at 106px should remain valid. If adding a tilt button too, stack them below: NavigationControl (~93px) → style pill (~72px) → tilt button (~48px) with ~8px gaps.

### Pitfall 5: Sky Layer Complexity (OPTIONAL — skip for routed)
**What goes wrong:** Wildmap's SkyLayer is a full component with SunCalc dependency, civil dawn/dusk scheduling, GPS integration.
**Why it happens:** It's complex because wildmap targets backcountry use where time-of-day matters.
**How to avoid:** For routed (group trip planning), a simple always-daytime sky layer is sufficient when terrain is on. This saves adding the `suncalc` package. Just call `addSkyLayer(map)` with the daytime atmosphere paint once when terrain is enabled.

## Code Examples

### Full Terrain Toggle Pattern (for Map.tsx)

```typescript
// Source: Derived from S:\Claude\wildmap\src\App.tsx lines 420-434, 346-355, 461-463
// In Map.tsx — add these alongside existing state:
const [isTerrain, setIsTerrain] = useState(false)
const isTerrainRef = useRef(false)

// Mirror state to ref for style.load handler
useEffect(() => { isTerrainRef.current = isTerrain }, [isTerrain])

// Helper functions (add after existing imports/consts):
const applyTerrain = (map: mapboxgl.Map) => {
  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14,
    })
  }
  map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })
}

const removeTerrain = (map: mapboxgl.Map) => {
  map.setTerrain(null)
}

// In map 'load' handler, add style.load listener:
map.on('style.load', () => {
  if (isTerrainRef.current) applyTerrain(map)
})

// Terrain toggle effect:
useEffect(() => {
  const map = mapRef.current
  if (!map || !mapLoaded) return
  if (isTerrain) {
    applyTerrain(map)
    // Add simple sky layer
    if (!map.getLayer('sky-layer')) {
      map.addLayer({
        id: 'sky-layer',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun-intensity': 5,
          'sky-atmosphere-sun': [0, 80],
          'sky-atmosphere-color': '#78b4e0',
          'sky-atmosphere-halo-color': '#e0d8c8',
        },
      } as mapboxgl.AnyLayer)
    }
  } else {
    removeTerrain(map)
    if (map.getLayer('sky-layer')) map.removeLayer('sky-layer')
  }
}, [isTerrain, mapLoaded])
```

### Tilt Toggle Pattern

```typescript
// Source: Derived from S:\Claude\wildmap\src\components\map\TiltButton.tsx
const [mapPitch, setMapPitch] = useState(0)
const isTilted = mapPitch > 5

const handleTiltToggle = () => {
  mapRef.current?.easeTo({ pitch: isTilted ? 0 : 60, duration: 400 })
}

// In map 'load' handler:
map.on('pitch', () => {
  setMapPitch(map.getPitch())
})
```

### Attribution — Compact Mode

```typescript
// Source: Derived from S:\Claude\wildmap\src\App.tsx lines 448, 472
// In new mapboxgl.Map({...}) options — add:
attributionControl: false,

// After map construction:
map.addControl(new mapboxgl.AttributionControl({ compact: true }))
// (remove existing map.addControl(new mapboxgl.NavigationControl(), 'top-right')
//  only if you want to reorder controls — NavigationControl stays at top-right)
```

### Two-Button Style Toggle (inline-style, matches routed conventions)

```typescript
// Source: Derived from S:\Claude\wildmap\src\components\controls\BaseStyleToggle.tsx
// Replace the current single <button onClick={toggleStyle}> with:
<div
  style={{
    position: 'absolute',
    top: '106px',
    right: '10px',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.15)',
  }}
>
  <button
    onClick={() => { if (isSatellite) toggleStyle() }}
    aria-pressed={!isSatellite}
    style={{
      padding: '6px 12px',
      fontSize: '12px',
      fontFamily: 'DM Sans, system-ui, sans-serif',
      fontWeight: '600',
      background: !isSatellite ? '#4A6741' : 'rgba(30,30,28,0.75)',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      backdropFilter: 'blur(4px)',
    }}
  >
    Topo
  </button>
  <button
    onClick={() => { if (!isSatellite) toggleStyle() }}
    aria-pressed={isSatellite}
    style={{
      padding: '6px 12px',
      fontSize: '12px',
      fontFamily: 'DM Sans, system-ui, sans-serif',
      fontWeight: '600',
      background: isSatellite ? '#4A6741' : 'rgba(30,30,28,0.75)',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      backdropFilter: 'blur(4px)',
    }}
  >
    Sat
  </button>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fog` layer for atmosphere | `sky` layer type | Mapbox GL JS v2.x | Sky layer is the correct API for atmosphere above terrain |
| `map.setTerrain(null)` removes terrain but not source | Only `setTerrain(null)` is needed; source survives | Always | Source can remain if you want to toggle terrain back cheaply |
| Always-visible attribution text | `compact: true` shows (i) icon | Mapbox GL JS v1.x+ | Satisfies ToS while removing visual clutter |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sky layer `type: 'sky'` is available in mapbox-gl 3.20.0 (same engine version as wildmap) | Feature 1 code | Low — both projects use identical version `[VERIFIED: both package.json files]` |
| A2 | The topo/satellite button can be positioned at 106px top without conflicting with new tilt button stacked below | Pitfall 4 | Low — easy to adjust pixel values during implementation |
| A3 | `AttributionControl({ compact: true })` in the raw mapbox-gl API works the same as react-map-gl's `<AttributionControl compact={true} />` | Feature 4 | Low — react-map-gl is a thin wrapper; identical underlying API `[ASSUMED]` |

## Open Questions

1. **Should terrain be the default-on state or require explicit toggle?**
   - What we know: Wildmap defaults to `terrain3D: false` in its store. Routed has no terrain at all currently.
   - What's unclear: Product preference for routed.
   - Recommendation: Default off (match wildmap) — adds a terrain button that users tap to enable.

2. **Should tilt and terrain be linked (tilt only works when terrain is on)?**
   - What we know: Wildmap renders TiltButton regardless of terrain state — pitch works on flat map too, just less dramatic.
   - What's unclear: Routed product preference.
   - Recommendation: Independent — tilt works on flat map, terrain adds 3D texture. Show both buttons always.

3. **Sky layer — simplified daytime-only vs full SunCalc day/night?**
   - What we know: SunCalc is not in routed's dependencies. Wildmap's full SkyLayer is complex.
   - What's unclear: Whether the day/night sky cycling matters for routed (a planning app, not a field app).
   - Recommendation: Daytime atmosphere only — no SunCalc dependency, simpler code. If night cycling is later wanted, add SunCalc then.

## Environment Availability

Step 2.6: SKIPPED — phase is pure code changes within an existing project. No external tools, services, CLIs, or databases beyond the existing Mapbox token (already configured via `VITE_MAPBOX_TOKEN`).

## Validation Architecture

Manual smoke test is sufficient — no automated test framework is configured in routed (`[VERIFIED: package.json]` has no test runner). Validate by:

| Req | Behavior | Test Type | How to Verify |
|-----|----------|-----------|---------------|
| R1 | 3D terrain activates/deactivates on button tap | Manual smoke | Map visibly extrudes elevation; toggle clears it |
| R2 | Terrain survives Topo→Satellite style swap | Manual smoke | Enable terrain, switch style, terrain remains |
| R3 | Tilt button pitches map to 60°, returns to 0° | Manual smoke | Map camera tilts; button active state correct |
| R4 | Topo/Satellite pill shows correct active state | Manual smoke | Active button highlighted; style changes on tap |
| R5 | Attribution shows only (i) icon, full text on click | Manual smoke | No CC text visible; (i) icon present; click expands |

Run: `npm run dev` in `S:\Claude\routed` and open the Map tab.

## Security Domain

No security domain changes — this phase adds no auth, data input, or network calls beyond existing Mapbox tile fetches. Attribution and terrain use already-authenticated Mapbox token.

## Sources

### Primary (HIGH confidence)
- `S:\Claude\wildmap\src\App.tsx` — terrain applyTerrain/removeTerrain, style.load re-application, attribution setup, pitch tracking
- `S:\Claude\wildmap\src\components\map\TiltButton.tsx` — tilt toggle logic, pitch threshold (5°), easeTo call
- `S:\Claude\wildmap\src\components\controls\BaseStyleToggle.tsx` — two-button topo/satellite pill UI pattern
- `S:\Claude\wildmap\src\components\map\SkyLayer.tsx` — sky layer paint properties (atmosphere type)
- `S:\Claude\routed\src\pages\Map.tsx` — current routed map init, existing toggle button, isSatellite state
- `S:\Claude\routed\package.json` — confirms mapbox-gl 3.20.0, no zustand, no react-map-gl
- `S:\Claude\wildmap\package.json` — confirms same mapbox-gl 3.20.0

### Secondary (MEDIUM confidence)
- [Mapbox GL JS API — Markers and Controls](https://docs.mapbox.com/mapbox-gl-js/api/markers/) — AttributionControl `compact` option confirmed
- [Mapbox Attribution Policy](https://docs.mapbox.com/help/getting-started/attribution/) — compact mode satisfies ToS

### Tertiary (LOW confidence)
- WebSearch results on compact attribution behavior — cross-verified with official docs above

## Metadata

**Confidence breakdown:**
- Source implementations (wildmap): HIGH — source code read directly, exact API calls confirmed
- Routed current state: HIGH — source code read directly
- Mapbox API (terrain, pitch, sky, attribution): HIGH — identical library version, wildmap is working production code
- UI positioning / pixel values: MEDIUM — will need visual adjustment during implementation

**Research date:** 2026-04-06
**Valid until:** 2026-07-06 (stable APIs — Mapbox GL JS 3.x is not fast-moving)
