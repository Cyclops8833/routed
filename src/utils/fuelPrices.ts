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

// ---------------------------------------------------------------------------
// Primary fetch function
// ---------------------------------------------------------------------------

/**
 * Fetches current Victorian petrol and diesel prices via the Servo Saver
 * (Service Victoria) proxy. Suburb is unused — all users are Victorian and
 * the API returns state-wide data averaged across all stations (per D-02).
 */
export async function fetchFuelPrices(_suburb: string): Promise<LiveFuelPrices> {
  try {
    const res = await fetch('/api/fuel-prices')
    if (!res.ok) {
      console.warn('fuel-prices proxy returned', res.status, '— using fallback')
      return FALLBACK_PRICES
    }
    const data = await res.json() as { petrol?: number; diesel?: number; error?: string }
    if (typeof data.petrol === 'number' && data.petrol > 0 && typeof data.diesel === 'number' && data.diesel > 0) {
      return { petrol: data.petrol, diesel: data.diesel, isEstimated: false }
    }
    return FALLBACK_PRICES
  } catch {
    console.error('fetchFuelPrices failed, using fallback')
    return FALLBACK_PRICES
  }
}
