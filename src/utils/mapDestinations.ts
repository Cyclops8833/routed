import type mapboxgl from 'mapbox-gl'
import { destinations } from '../data/destinations'

const SHORTLIST_RING_LAYER = 'destinations-shortlist-ring'

const SOURCE_ID = 'destinations-source'
const DOTS_LAYER = 'destinations-dots'
const HOVER_LAYER = 'destinations-dots-hover'

function getActivityIcons(activities: string[]): string {
  const icons: string[] = []
  if (activities.includes('camping')) icons.push('🏕️')
  if (activities.includes('hiking')) icons.push('🥾')
  if (activities.includes('fishing')) icons.push('🎣')
  if (activities.includes('4wd')) icons.push('🚙')
  return icons.join(' ')
}

/** Add all destination dots as a GeoJSON source + circle layers to the map */
export function addDestinationDots(map: mapboxgl.Map, Popup: typeof mapboxgl.Popup): void {
  if (map.getSource(SOURCE_ID)) return

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: destinations.map((d) => ({
      type: 'Feature',
      id: d.id,
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
      properties: {
        id: d.id,
        name: d.name,
        region: d.region,
        roadType: d.roadType,
        activities: d.activities.join(','),
        campsiteCostPerNight: d.campsiteCostPerNight,
        tripLength: d.tripLength.join(','),
      },
    })),
  }

  map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })

  map.addLayer({
    id: DOTS_LAYER,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-radius': 5,
      'circle-color': ['match', ['get', 'roadType'], '4wd-only', '#C4893B', '#4A6741'],
      'circle-opacity': 0.65,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#FAFAF7',
    },
  })

  map.addLayer({
    id: HOVER_LAYER,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['get', 'id'], ''],
    paint: {
      'circle-radius': 9,
      'circle-color': ['match', ['get', 'roadType'], '4wd-only', '#C4893B', '#4A6741'],
      'circle-opacity': 1,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FAFAF7',
    },
  })

  let popup: mapboxgl.Popup | null = null

  map.on('mouseenter', DOTS_LAYER, () => {
    map.getCanvas().style.cursor = 'pointer'
  })

  map.on('mouseleave', DOTS_LAYER, () => {
    map.getCanvas().style.cursor = ''
    map.setFilter(HOVER_LAYER, ['==', ['get', 'id'], ''])
  })

  map.on('mousemove', DOTS_LAYER, (e) => {
    const features = e.features
    if (!features || features.length === 0) return
    const feature = features[0]
    const id = feature.properties?.id as string | undefined
    if (id) {
      map.setFilter(HOVER_LAYER, ['==', ['get', 'id'], id])
    }
  })

  map.on('click', DOTS_LAYER, (e) => {
    const features = e.features
    if (!features || features.length === 0) return
    const props = features[0].properties
    if (!props) return

    const costText =
      props.campsiteCostPerNight === 0
        ? 'Free'
        : `$${props.campsiteCostPerNight}/night`

    const activityIcons = getActivityIcons(
      String(props.activities ?? '').split(',').filter(Boolean)
    )

    // Look up booking info from full destination data
    const destData = destinations.find((d) => d.id === props.id)
    const requiresBooking = destData?.bookingInfo?.requiresBooking ?? false
    const bookingBadge = requiresBooking
      ? `<div style="font-size:11px; font-weight:600; color:#C4893B; background:rgba(196,137,59,0.1); border:1px solid rgba(196,137,59,0.3); border-radius:100px; padding:2px 8px; display:inline-block; margin-bottom:4px;">📅 Booking required</div>`
      : `<div style="font-size:11px; font-weight:600; color:#4A6741; background:rgba(74,103,65,0.08); border:1px solid rgba(74,103,65,0.25); border-radius:100px; padding:2px 8px; display:inline-block; margin-bottom:4px;">✓ First in, first served</div>`

    const html = `
      <div style="font-family: DM Sans, system-ui, sans-serif; min-width: 180px;">
        <div style="font-family: Fraunces, Georgia, serif; font-size:15px; font-weight:700; color:#2D2D2D; margin-bottom:6px;">
          ${props.name}
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
          <span style="font-size:11px; font-weight:600; background:rgba(74,103,65,0.1); color:#4A6741; border-radius:100px; padding:2px 8px;">
            ${props.region}
          </span>
        </div>
        ${bookingBadge}
        <div style="font-size:12px; color:#8C8578; margin-bottom:4px;">⛺ ${costText}</div>
        ${activityIcons ? `<div style="font-size:14px; margin-top:4px;">${activityIcons}</div>` : ''}
      </div>
    `

    if (popup) popup.remove()

    const geometry = features[0].geometry
    if (geometry.type !== 'Point') return
    const coords = geometry.coordinates as [number, number]

    popup = new Popup({ offset: 12, maxWidth: '240px' })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map)
  })
}

/**
 * Update destination dot visuals based on shortlist data.
 * Destinations with 2+ shortlists get an outer ring.
 */
export function updateDestinationShortlistVisuals(
  map: mapboxgl.Map,
  shortlistedDestinationIds: string[]
): void {
  if (!map.getLayer(DOTS_LAYER)) return

  // Count shortlists per destination
  const counts: Record<string, number> = {}
  for (const id of shortlistedDestinationIds) {
    counts[id] = (counts[id] ?? 0) + 1
  }
  const popularIds = Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .map(([id]) => id)

  // Add ring layer if not present
  if (!map.getLayer(SHORTLIST_RING_LAYER)) {
    map.addLayer({
      id: SHORTLIST_RING_LAYER,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['in', ['get', 'id'], ['literal', popularIds]],
      paint: {
        'circle-radius': 12,
        'circle-color': 'transparent',
        'circle-opacity': 0,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#C4893B',
        'circle-stroke-opacity': 0.45,
      },
    }, DOTS_LAYER)
  } else {
    map.setFilter(SHORTLIST_RING_LAYER, ['in', ['get', 'id'], ['literal', popularIds]])
  }
}

/**
 * Highlight ranked destinations on the map.
 * dimOthers: if true, dim non-ranked dots; if false, reset to default opacity.
 */
export function highlightRankedDestinations(
  map: mapboxgl.Map,
  rankedIds: string[],
  dimOthers: boolean
): void {
  if (!map.getLayer(DOTS_LAYER)) return

  if (dimOthers && rankedIds.length > 0) {
    map.setPaintProperty(DOTS_LAYER, 'circle-opacity', [
      'match',
      ['get', 'id'],
      rankedIds,
      0.9,
      0.2,
    ])
    map.setPaintProperty(DOTS_LAYER, 'circle-radius', [
      'match',
      ['get', 'id'],
      rankedIds,
      8,
      5,
    ])
  } else {
    map.setPaintProperty(DOTS_LAYER, 'circle-opacity', 0.65)
    map.setPaintProperty(DOTS_LAYER, 'circle-radius', 5)
  }
}
