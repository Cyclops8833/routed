import type mapboxgl from 'mapbox-gl'
import { destinations } from '../data/destinations'
import type { UserProfile } from '../types'

const SHORTLIST_RING_LAYER = 'destinations-shortlist-ring'

const SOURCE_ID = 'destinations-source'
const DOTS_LAYER = 'destinations-dots'
const HOVER_LAYER = 'destinations-dots-hover'

export interface DestinationDotsOptions {
  /** Returns the latest shortlist entries — called at popup-open time */
  getShortlists?: () => Array<{ memberUid: string; destinationId: string }>
  /** Returns the latest crew member profiles — called at popup-open time */
  getMembers?: () => UserProfile[]
  /** Called when "Plan a trip here" is tapped */
  onPlanTrip?: (destinationId: string) => void
}

function getActivityIcons(activities: string[]): string {
  const icons: string[] = []
  if (activities.includes('camping')) icons.push('🏕️')
  if (activities.includes('hiking')) icons.push('🥾')
  if (activities.includes('fishing')) icons.push('🎣')
  if (activities.includes('4wd')) icons.push('🚙')
  return icons.join(' ')
}

function getRoadLabel(roadType: string): string {
  if (roadType === '4wd-only') return '🚙 4WD Only'
  if (roadType === 'unsealed') return '🪨 Unsealed'
  return '🛣 Sealed'
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]*[.!?]/)
  return match ? match[0] : text.slice(0, 120) + (text.length > 120 ? '…' : '')
}

function avatarHtml(initial: string, colour: string): string {
  return `<div style="width:20px;height:20px;border-radius:50%;background:${colour};color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initial}</div>`
}

const MEMBER_COLOURS = ['#4A6741','#C4893B','#B85C38','#7C5CBF','#E07A5F','#5B8DB8','#8B6E47','#3D8B6E']

function buildPopupHtml(
  destId: string,
  shortlists: Array<{ memberUid: string; destinationId: string }>,
  members: UserProfile[]
): string {
  const dest = destinations.find((d) => d.id === destId)
  if (!dest) return `<div>Unknown destination</div>`

  const cost = dest.campsiteCostPerNight === 0
    ? `<span style="color:#4A6741;font-weight:600;">Free</span>`
    : `<span style="color:#8C8578;">$${dest.campsiteCostPerNight}/night</span>`

  const roadLabel = getRoadLabel(dest.roadType)
  const activityIcons = getActivityIcons(dest.activities)

  const bookingBadge = dest.bookingInfo.requiresBooking
    ? `<span style="font-size:10px;font-weight:600;color:#C4893B;background:rgba(196,137,59,0.1);border:1px solid rgba(196,137,59,0.3);border-radius:100px;padding:2px 8px;">📅 Booking required</span>`
    : `<span style="font-size:10px;font-weight:600;color:#4A6741;background:rgba(74,103,65,0.08);border:1px solid rgba(74,103,65,0.25);border-radius:100px;padding:2px 8px;">✓ No booking needed</span>`

  // Fish species
  const fishHtml = dest.fishSpecies && dest.fishSpecies.length > 0
    ? `<div style="font-size:11px;color:#8C8578;margin-top:4px;">🎣 ${dest.fishSpecies.join(', ')}</div>`
    : ''

  // Crew interest (shortlists for this destination)
  const destShortlists = shortlists.filter((s) => s.destinationId === destId)
  let crewInterestHtml = ''
  if (destShortlists.length > 0) {
    const sortedMembers = [...members].sort((a, b) => a.uid.localeCompare(b.uid))
    const avatars = destShortlists.slice(0, 4).map((s) => {
      const idx = sortedMembers.findIndex((m) => m.uid === s.memberUid)
      const member = sortedMembers[idx]
      const colour = MEMBER_COLOURS[idx % MEMBER_COLOURS.length] ?? '#4A6741'
      const initial = (member?.displayName ?? '?')[0].toUpperCase()
      return avatarHtml(initial, colour)
    }).join('')
    const extra = destShortlists.length > 4 ? `<span style="font-size:10px;color:#8C8578;">+${destShortlists.length - 4}</span>` : ''
    const names = destShortlists.slice(0, 2).map((s) => {
      const m = members.find((x) => x.uid === s.memberUid)
      return m?.displayName?.split(' ')[0] ?? 'Someone'
    })
    const label = destShortlists.length === 1
      ? `${names[0]} is keen`
      : destShortlists.length <= 2
        ? `${names.join(' & ')} are keen`
        : `${destShortlists.length} crew keen`
    crewInterestHtml = `
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px;">
        <div style="display:flex;gap:3px;">${avatars}${extra}</div>
        <span style="font-size:11px;color:#8C8578;">${label}</span>
      </div>`
  }

  // Crew notes
  const notesHtml = dest.crewNotes
    ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(140,133,120,0.2);font-size:11px;color:#8C8578;font-style:italic;line-height:1.5;">${dest.crewNotes}</div>`
    : ''

  const photoHtml = dest.photos && dest.photos[0]
    ? `<img src="${dest.photos[0]}" alt="${dest.name}" onerror="this.style.display='none'" style="width:100%;height:150px;object-fit:cover;display:block;border-radius:4px 4px 0 0;margin-bottom:10px;" />`
    : ''

  return `
    <div style="font-family:'DM Sans',system-ui,sans-serif;width:300px;max-width:90vw;">
      ${photoHtml}
      <div style="font-family:'Fraunces',Georgia,serif;font-size:17px;font-weight:700;color:#2D2D2D;margin-bottom:6px;line-height:1.2;">${dest.name}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
        <span style="font-size:11px;font-weight:600;background:rgba(74,103,65,0.1);color:#4A6741;border-radius:100px;padding:2px 8px;">${dest.region}</span>
        ${bookingBadge}
      </div>
      <div style="font-size:12px;color:#4A4A44;line-height:1.5;margin-bottom:8px;">${firstSentence(dest.description)}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#8C8578;display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
        <span>⛺ ${cost}</span>
        <span>${roadLabel}</span>
        ${activityIcons ? `<span>${activityIcons}</span>` : ''}
      </div>
      ${fishHtml}
      ${crewInterestHtml}
      ${notesHtml}
      <button
        onclick="window.__routedPlanTrip && window.__routedPlanTrip('${destId}')"
        style="margin-top:12px;width:100%;padding:10px;background:#4A6741;color:#FAFAF7;border:none;border-radius:10px;font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.01em;"
      >Plan a trip here →</button>
    </div>`
}

/** Add all destination dots as a GeoJSON source + circle layers to the map */
export function addDestinationDots(map: mapboxgl.Map, Popup: typeof mapboxgl.Popup, options?: DestinationDotsOptions): void {
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

  // Register global plan-trip callback so the popup button can reach React
  if (options?.onPlanTrip) {
    ;(window as Window & { __routedPlanTrip?: (id: string) => void }).__routedPlanTrip = options.onPlanTrip
  }

  map.on('click', DOTS_LAYER, (e) => {
    const features = e.features
    if (!features || features.length === 0) return
    const props = features[0].properties
    if (!props) return

    const shortlists = options?.getShortlists?.() ?? []
    const members = options?.getMembers?.() ?? []
    const html = buildPopupHtml(String(props.id), shortlists, members)

    if (popup) popup.remove()

    const geometry = features[0].geometry
    if (geometry.type !== 'Point') return
    const coords = geometry.coordinates as [number, number]

    popup = new Popup({ offset: 14, maxWidth: '360px' })
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
