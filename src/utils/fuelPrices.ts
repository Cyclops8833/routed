import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

// ---------------------------------------------------------------------------
// Types and constants
// ---------------------------------------------------------------------------

export interface LiveFuelPrices {
  petrol: number       // dollars per litre
  diesel: number       // dollars per litre
  isEstimated: boolean // true when using fallback, false when from live API
}

export const FALLBACK_PRICES: LiveFuelPrices = {
  petrol: 2.30,
  diesel: 2.85,
  isEstimated: true,
}

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

// ---------------------------------------------------------------------------
// Cache read
// ---------------------------------------------------------------------------

/**
 * Loads cached fuel prices from the user's Firestore document.
 * Returns null if no cache exists, the cache is older than 24 hours, or any
 * read error occurs. The caller should fall back to fetchFuelPrices() on null.
 */
export async function loadFuelPriceCache(uid: string): Promise<LiveFuelPrices | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    if (!snap.exists()) return null

    const cache = snap.data()?.fuelPriceCache as
      | { petrol: number; diesel: number; cachedAt: Timestamp }
      | undefined

    if (!cache || !cache.cachedAt) return null

    const ageMs = Date.now() - cache.cachedAt.toMillis()
    if (ageMs > CACHE_MAX_AGE_MS) return null

    return { petrol: cache.petrol, diesel: cache.diesel, isEstimated: false }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Cache write
// ---------------------------------------------------------------------------

/**
 * Persists live fuel prices to the user's Firestore document.
 * Mirrors the saveDriveCache() pattern — merges into the existing user doc.
 */
export async function saveFuelPriceCache(
  uid: string,
  petrol: number,
  diesel: number
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    fuelPriceCache: { petrol, diesel, cachedAt: Timestamp.now() },
  })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Maps a suburb string to a city name for the fuelprice.io API.
 * Always returns 'Melbourne' — all Routed users are Victorian and regional
 * price variance is not worth the added complexity (per D-02).
 */
function resolveCity(_suburb: string): string {
  return 'Melbourne'
}

/**
 * Tries the legacy query-string endpoint first, then the v1 RESTful endpoint.
 * Returns { petrol, diesel } in dollars per litre, or null on complete failure.
 */
async function tryFetchPrices(
  apiKey: string,
  city: string
): Promise<{ petrol: number; diesel: number } | null> {
  // Attempt 1: Legacy endpoint (fuelprice.io legacy docs)
  try {
    const [petrolRes, dieselRes] = await Promise.all([
      fetch(
        `https://fuelprice.io/api/?key=${apiKey}&action=get_city_average&fuel_type=unleaded&city=${encodeURIComponent(city)}`
      ),
      fetch(
        `https://fuelprice.io/api/?key=${apiKey}&action=get_city_average&fuel_type=diesel&city=${encodeURIComponent(city)}`
      ),
    ])
    if (petrolRes.ok && dieselRes.ok) {
      const [petrolData, dieselData] = await Promise.all([
        petrolRes.json() as Promise<{ average?: number }>,
        dieselRes.json() as Promise<{ average?: number }>,
      ])
      const petrol = petrolData.average
      const diesel = dieselData.average
      if (
        typeof petrol === 'number' &&
        petrol > 0 &&
        typeof diesel === 'number' &&
        diesel > 0
      ) {
        // API returns cents per litre — convert to dollars
        return { petrol: petrol / 100, diesel: diesel / 100 }
      }
    }
  } catch {
    // Legacy endpoint failed — fall through to v1
  }

  // Attempt 2: v1 RESTful endpoint (api.fuelprice.io)
  try {
    // Discover the Melbourne city ID from the cities list
    const citiesRes = await fetch('https://api.fuelprice.io/v1/cities', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!citiesRes.ok) return null

    const cities = (await citiesRes.json()) as Array<{ id: string; name: string }>
    const melbourne = cities.find((c: { name: string }) =>
      c.name.toLowerCase().includes('melbourne')
    )
    if (!melbourne) return null

    const avgRes = await fetch(
      `https://api.fuelprice.io/v1/cities/${melbourne.id}/average`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )
    if (!avgRes.ok) return null

    const avgData = (await avgRes.json()) as { unleaded?: number; diesel?: number }
    if (
      typeof avgData.unleaded === 'number' &&
      avgData.unleaded > 0 &&
      typeof avgData.diesel === 'number' &&
      avgData.diesel > 0
    ) {
      // v1 may return cents or dollars — if > 10 assume cents
      const petrol = avgData.unleaded > 10 ? avgData.unleaded / 100 : avgData.unleaded
      const diesel = avgData.diesel > 10 ? avgData.diesel / 100 : avgData.diesel
      return { petrol, diesel }
    }
  } catch {
    // v1 endpoint also failed
  }

  return null
}

// ---------------------------------------------------------------------------
// Primary fetch function
// ---------------------------------------------------------------------------

/**
 * Fetches current Melbourne petrol and diesel prices from fuelprice.io.
 *
 * Strategy:
 * 1. If VITE_FUELPRICE_API_KEY is not set, returns FALLBACK_PRICES immediately.
 * 2. Tries the legacy query-string endpoint first, then the v1 RESTful endpoint.
 * 3. If both endpoints fail or return unexpected data, returns FALLBACK_PRICES.
 * 4. On any unexpected error, logs and returns FALLBACK_PRICES.
 *
 * The suburb argument is used to resolve a city name (always 'Melbourne' per D-02).
 * Callers should check isEstimated to know whether the price is live or fallback.
 */
export async function fetchFuelPrices(suburb: string): Promise<LiveFuelPrices> {
  try {
    const apiKey = import.meta.env.VITE_FUELPRICE_API_KEY as string | undefined
    if (!apiKey) {
      console.warn('VITE_FUELPRICE_API_KEY not set — using fallback fuel prices')
      return FALLBACK_PRICES
    }

    const city = resolveCity(suburb)
    const result = await tryFetchPrices(apiKey, city)

    if (result) {
      return { petrol: result.petrol, diesel: result.diesel, isEstimated: false }
    }

    return FALLBACK_PRICES
  } catch {
    console.error('fetchFuelPrices failed, using fallback')
    return FALLBACK_PRICES
  }
}
