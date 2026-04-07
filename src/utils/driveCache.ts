import { destinations } from '../data/destinations'
import { MAPBOX_TOKEN } from '../config'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { DriveCache } from '../types'

export type { DriveCache }

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const BATCH_SIZE = 5
const BATCH_DELAY_MS = 350

/** Returns true if the cache is populated, fresh, and was built at the same home location */
export function isCacheValid(
  cache: DriveCache | undefined,
  cachedLocation: { lat: number; lng: number } | undefined,
  currentLat: number,
  currentLng: number
): boolean {
  if (!cache || Object.keys(cache).length < destinations.length * 0.9) return false

  // Home location moved more than ~100m
  if (cachedLocation) {
    if (
      Math.abs(cachedLocation.lat - currentLat) > 0.001 ||
      Math.abs(cachedLocation.lng - currentLng) > 0.001
    ) {
      return false
    }
  }

  // Check age using oldest entry
  const entries = Object.values(cache)
  const oldest = Math.min(...entries.map((e) => e.cachedAt))
  return Date.now() - oldest < CACHE_MAX_AGE_MS
}

async function fetchOne(
  homeLat: number,
  homeLng: number,
  destLat: number,
  destLng: number
): Promise<{ durationMinutes: number; distanceKm: number } | null> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${homeLng},${homeLat};${destLng},${destLat}?geometries=geojson&access_token=${MAPBOX_TOKEN}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      routes?: Array<{ duration: number; distance: number }>
    }
    const route = data.routes?.[0]
    if (!route) return null
    return {
      durationMinutes: Math.round(route.duration / 60),
      distanceKm: Math.round(route.distance / 100) / 10,
    }
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Fetches drive times from a home location to all destinations.
 * Accepts an optional existing partial cache to resume from (D-13).
 * Persists to Firestore after each batch of BATCH_SIZE completes (D-14).
 * Skips destination IDs already present in existingCache.
 * onProgress(done, total) is called after each individual fetch.
 */
export async function buildDriveCache(
  homeLat: number,
  homeLng: number,
  uid: string,
  existingCache?: DriveCache,
  onProgress?: (done: number, total: number) => void
): Promise<DriveCache> {
  const cache: DriveCache = existingCache ? { ...existingCache } : {}
  const toFetch = destinations.filter((d) => !cache[d.id])
  const total = destinations.length
  let done = destinations.length - toFetch.length // already-cached count

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (dest) => {
        const result = await fetchOne(homeLat, homeLng, dest.lat, dest.lng)
        if (result) {
          cache[dest.id] = { ...result, cachedAt: Date.now() }
        }
        done++
        onProgress?.(done, total)
      })
    )
    // Mid-batch save (D-14): persist after each batch so a resume picks up from here
    try {
      await saveDriveCache(uid, cache, homeLat, homeLng)
    } catch (err) {
      console.warn('Drive cache mid-batch save failed (build continues):', err)
    }

    if (i + BATCH_SIZE < toFetch.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  return cache
}

/** Persists the cache and the home location it was built for to Firestore */
export async function saveDriveCache(
  uid: string,
  cache: DriveCache,
  homeLat: number,
  homeLng: number
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    driveCache: cache,
    driveCacheLocation: { lat: homeLat, lng: homeLng },
  })
}

/** Formats a duration in minutes as "~Xhr Ymin" or "~Ymin" */
export function formatDriveTime(minutes: number): string {
  if (minutes < 60) return `~${minutes}min`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `~${hrs}hr`
  return `~${hrs}hr ${mins}min`
}
