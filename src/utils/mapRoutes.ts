import mapboxgl from 'mapbox-gl'
import { MAPBOX_TOKEN } from '../config'

export interface RouteResult {
  memberUid: string
  memberName: string
  colour: string
  geometry: GeoJSON.LineString
  durationMinutes: number
  distanceKm: number
}

export async function fetchRoutes(
  members: Array<{ uid: string; name: string; colour: string; lat: number; lng: number }>,
  destination: { lat: number; lng: number }
): Promise<RouteResult[]> {
  const results = await Promise.allSettled(
    members.map(async (member) => {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${member.lng},${member.lat};${destination.lng},${destination.lat}?geometries=geojson&access_token=${MAPBOX_TOKEN}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Directions API error for ${member.name}: ${res.status}`)
      const data = await res.json()
      const route = data.routes?.[0]
      if (!route) throw new Error(`No route found for ${member.name}`)
      return {
        memberUid: member.uid,
        memberName: member.name,
        colour: member.colour,
        geometry: route.geometry as GeoJSON.LineString,
        durationMinutes: Math.round(route.duration / 60),
        distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      } satisfies RouteResult
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<RouteResult> => r.status === 'fulfilled')
    .map((r) => r.value)
}

export function drawRoutes(map: mapboxgl.Map, routes: RouteResult[]) {
  for (const route of routes) {
    const sourceId = `route-source-${route.memberUid}`
    const glowLayerId = `route-glow-${route.memberUid}`
    const solidLayerId = `route-solid-${route.memberUid}`

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: route.geometry,
        },
      })
    }

    if (!map.getLayer(glowLayerId)) {
      map.addLayer({
        id: glowLayerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-width': 8,
          'line-color': route.colour,
          'line-opacity': 0.25,
          'line-blur': 4,
        },
      })
    }

    if (!map.getLayer(solidLayerId)) {
      map.addLayer({
        id: solidLayerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-width': 3,
          'line-color': route.colour,
          'line-opacity': 0.9,
        },
      })
    }
  }
}

export function clearRoutes(map: mapboxgl.Map) {
  const style = map.getStyle()
  if (!style) return

  const layerIds = (style.layers ?? []).map((l) => l.id)
  for (const id of layerIds) {
    if (id.startsWith('route-')) {
      map.removeLayer(id)
    }
  }

  const sourceIds = Object.keys(style.sources ?? {})
  for (const id of sourceIds) {
    if (id.startsWith('route-source-')) {
      map.removeSource(id)
    }
  }
}

export function setDestination(
  map: mapboxgl.Map,
  lat: number,
  lng: number,
  name: string
): mapboxgl.Marker {
  const el = document.createElement('div')
  el.style.cssText = `
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background-color: #4A6741;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '20')
  svg.setAttribute('height', '20')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'white')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute(
    'd',
    'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z'
  )
  svg.appendChild(path)
  el.appendChild(svg)

  const marker = new mapboxgl.Marker({ element: el })
    .setLngLat([lng, lat])
    .setPopup(
      new mapboxgl.Popup({ offset: 24 }).setHTML(
        `<div style="font-family: Fraunces, Georgia, serif; font-size: 15px; font-weight: 700; color: #2D2D2D;">${name}</div>
         <div style="font-size: 12px; color: #8C8578; margin-top: 2px;">Destination</div>`
      )
    )
    .addTo(map)

  return marker
}
