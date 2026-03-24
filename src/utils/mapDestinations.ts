import type mapboxgl from 'mapbox-gl'
import { destinations } from '../data/destinations'

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
