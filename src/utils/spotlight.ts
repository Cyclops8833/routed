import { destinations } from '../data/destinations'
import type { Destination } from '../data/destinations'

// Geographic centre of Victoria
const VIC_CENTER_LAT = -37.0
const VIC_CENTER_LNG = 144.5

const STORAGE_KEY = 'routed-spotlight'

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Rough drive time estimate: 150km straight-line ≈ 1.5hrs */
export function estimateDriveHours(dest: Destination): number {
  const km = haversineKm(VIC_CENTER_LAT, VIC_CENTER_LNG, dest.lat, dest.lng)
  return Math.round((km / 100) * 10) / 10
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Returns 3 spotlight destinations — one from each drive-time bucket.
 * Stores the picked IDs in localStorage; reshuffles if same as last time or forceReshuffle.
 */
export function getSpotlightDestinations(forceReshuffle = false): Destination[] {
  const short = destinations.filter((d) => {
    const km = haversineKm(VIC_CENTER_LAT, VIC_CENTER_LNG, d.lat, d.lng)
    return km < 150
  })
  const medium = destinations.filter((d) => {
    const km = haversineKm(VIC_CENTER_LAT, VIC_CENTER_LNG, d.lat, d.lng)
    return km >= 150 && km <= 280
  })
  const long = destinations.filter((d) => {
    const km = haversineKm(VIC_CENTER_LAT, VIC_CENTER_LNG, d.lat, d.lng)
    return km > 280
  })

  let prevIds: string[] = []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) prevIds = JSON.parse(stored) as string[]
  } catch {
    // ignore
  }

  function pickFresh(bucket: Destination[], exclude: string[]): Destination | null {
    const available = bucket.filter((d) => !exclude.includes(d.id))
    const pool = available.length > 0 ? available : bucket
    return pickRandom(pool)
  }

  let picks: Destination[]

  if (forceReshuffle) {
    picks = [
      pickFresh(short, prevIds),
      pickFresh(medium, prevIds),
      pickFresh(long, prevIds),
    ].filter((d): d is Destination => d !== null)
  } else {
    picks = [
      pickRandom(short),
      pickRandom(medium),
      pickRandom(long),
    ].filter((d): d is Destination => d !== null)
  }

  const newIds = picks.map((d) => d.id)

  // If same as before, reshuffle
  if (!forceReshuffle && JSON.stringify(newIds.sort()) === JSON.stringify([...prevIds].sort())) {
    return getSpotlightDestinations(true)
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newIds))
  } catch {
    // ignore
  }

  return picks
}
