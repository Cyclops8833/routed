import {
  Destination,
  destinations as allDestinations,
  filterByVehicleAccess,
  filterByTripLength,
  getCurrentSeason,
} from '../data/destinations'
import type { UserProfile } from '../types'
import { fetchRoutes } from './mapRoutes'
import type { RouteResult } from './mapRoutes'
import { getConsumptionDefault } from '../data/vehicleDefaults'

/** Haversine distance in km */
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

/** Rough drive time estimate when no cache: haversine × 1.4 factor, 80km/h average */
function estimateMinutes(homeLat: number, homeLng: number, destLat: number, destLng: number): number {
  const km = haversineKm(homeLat, homeLng, destLat, destLng) * 1.4
  return Math.round((km / 80) * 60)
}

export interface RankedDestinationRoute {
  memberUid: string
  memberName: string
  colour: string
  durationMinutes: number
  distanceKm: number
  geometry: GeoJSON.LineString
}

export interface RankedDestination {
  destination: Destination
  score: number
  routes: RankedDestinationRoute[]
  estimatedCostPerPerson: number
  overBudget: boolean
  avgDriveMinutes: number
  maxDriveMinutes: number
}

const CREW_COLOURS = [
  '#4A6741',
  '#C4893B',
  '#B85C38',
  '#7C5CBF',
  '#E07A5F',
  '#5B8DB8',
  '#8B6E47',
]

const SEASON_ORDER: Array<'summer' | 'autumn' | 'winter' | 'spring'> = [
  'summer',
  'autumn',
  'winter',
  'spring',
]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getAdjacentSeasons(
  season: 'summer' | 'autumn' | 'winter' | 'spring'
): Array<'summer' | 'autumn' | 'winter' | 'spring'> {
  const idx = SEASON_ORDER.indexOf(season)
  const prev = SEASON_ORDER[(idx - 1 + 4) % 4]
  const next = SEASON_ORDER[(idx + 1) % 4]
  return [prev, next]
}

export async function rankDestinations(
  attendees: UserProfile[],
  tripLength: 'overnighter' | 'long-weekend',
  maxBudget: number,
  nights: number,
  fuelPrices: { petrol: number; diesel: number }
): Promise<RankedDestination[]> {
  const has4WD = attendees.some((a) =>
    a.vehicles.some((v) => v.type === '4wd')
  )

  const filtered = filterByVehicleAccess(
    filterByTripLength(allDestinations, tripLength),
    has4WD
  )

  const attendeesWithLocation = attendees.filter(
    (a) =>
      a.homeLocation &&
      typeof a.homeLocation.lat === 'number' &&
      typeof a.homeLocation.lng === 'number'
  )

  if (attendeesWithLocation.length === 0) return []

  const memberInputs = attendeesWithLocation.map((a, index) => ({
    uid: a.uid,
    name: a.displayName,
    colour: CREW_COLOURS[index % CREW_COLOURS.length],
    lat: a.homeLocation!.lat,
    lng: a.homeLocation!.lng,
  }))

  // Determine if we can use cached drive times (avoids ~560 API calls for 70 dests × 8 members)
  const allHaveCache = attendeesWithLocation.every(
    (a) => a.driveCache && Object.keys(a.driveCache).length > 0
  )

  const currentSeason = getCurrentSeason()
  const adjacentSeasons = getAdjacentSeasons(currentSeason)

  const ranked: RankedDestination[] = []

  if (allHaveCache) {
    // Fast path: use cached drive times, skip Mapbox API for scoring
    for (const dest of filtered) {
      const routes: RankedDestinationRoute[] = memberInputs.map((m) => {
        const attendee = attendeesWithLocation.find((a) => a.uid === m.uid)!
        const cached = attendee.driveCache?.[dest.id]
        const durationMinutes = cached?.durationMinutes
          ?? estimateMinutes(m.lat, m.lng, dest.lat, dest.lng)
        const distanceKm = cached?.distanceKm
          ?? Math.round(haversineKm(m.lat, m.lng, dest.lat, dest.lng) * 1.4 * 10) / 10
        return {
          memberUid: m.uid,
          memberName: m.name,
          colour: m.colour,
          durationMinutes,
          distanceKm,
          // geometry is empty — fetched separately when user taps "View on map"
          geometry: { type: 'LineString' as const, coordinates: [] },
        }
      })

      const driveTimes = routes.map((r) => r.durationMinutes)
      const avgDriveMinutes = driveTimes.reduce((s, t) => s + t, 0) / driveTimes.length
      const maxDriveMinutes = Math.max(...driveTimes)
      const fuelCosts = attendeesWithLocation.map((attendee) => {
        const route = routes.find((r) => r.memberUid === attendee.uid)
        if (!route) return 0
        const primaryVehicle = attendee.vehicles[0]
        if (!primaryVehicle) return 0
        const consumption = primaryVehicle.consumption > 0
          ? primaryVehicle.consumption
          : getConsumptionDefault(primaryVehicle.name, primaryVehicle.type)
        const fuelPrice = primaryVehicle.fuelType === 'diesel' ? fuelPrices.diesel : fuelPrices.petrol
        return (route.distanceKm * 2 * consumption) / 100 * fuelPrice
      })
      const avgFuelCost = fuelCosts.reduce((s, c) => s + c, 0) / fuelCosts.length
      const campsiteCost = (dest.campsiteCostPerNight * nights) / attendeesWithLocation.length
      const foodCost = 30 * nights
      const estimatedCostPerPerson = avgFuelCost + campsiteCost + foodCost

      const avgDriveScore = clamp(100 - (avgDriveMinutes / 360) * 100, 0, 100)
      const maxDriveScore = clamp(100 - (maxDriveMinutes / 360) * 100, 0, 100)
      const budgetScore = estimatedCostPerPerson <= maxBudget
        ? 100 - (estimatedCostPerPerson / maxBudget) * 50
        : 0
      const seasonScore = dest.bestSeasons.includes(currentSeason)
        ? 100
        : adjacentSeasons.some((s) => dest.bestSeasons.includes(s)) ? 50 : 0

      ranked.push({
        destination: dest,
        score: avgDriveScore * 0.4 + maxDriveScore * 0.2 + budgetScore * 0.25 + seasonScore * 0.15,
        routes,
        estimatedCostPerPerson,
        overBudget: estimatedCostPerPerson > maxBudget,
        avgDriveMinutes,
        maxDriveMinutes,
      })
    }
    return ranked.sort((a, b) => b.score - a.score)
  }

  // Slow path: no cache — call Mapbox Directions for all destinations
  const routeResults = await Promise.allSettled(
    filtered.map((dest) =>
      fetchRoutes(memberInputs, { lat: dest.lat, lng: dest.lng })
    )
  )

  for (let i = 0; i < filtered.length; i++) {
    const dest = filtered[i]
    const result = routeResults[i]

    if (result.status !== 'fulfilled' || result.value.length === 0) continue

    const routes: RankedDestinationRoute[] = result.value.map(
      (r: RouteResult) => ({
        memberUid: r.memberUid,
        memberName: r.memberName,
        colour: r.colour,
        durationMinutes: r.durationMinutes,
        distanceKm: r.distanceKm,
        geometry: r.geometry,
      })
    )

    const driveTimes = routes.map((r) => r.durationMinutes)
    const avgDriveMinutes =
      driveTimes.reduce((sum, t) => sum + t, 0) / driveTimes.length
    const maxDriveMinutes = Math.max(...driveTimes)

    // Calculate estimated cost per person
    const fuelCosts = attendeesWithLocation.map((attendee) => {
      const route = routes.find((r) => r.memberUid === attendee.uid)
      if (!route) return 0

      const primaryVehicle = attendee.vehicles[0]
      if (!primaryVehicle) return 0

      const consumption =
        primaryVehicle.consumption > 0
          ? primaryVehicle.consumption
          : getConsumptionDefault(primaryVehicle.name, primaryVehicle.type)

      const fuelPrice =
        primaryVehicle.fuelType === 'diesel'
          ? fuelPrices.diesel
          : fuelPrices.petrol

      return (route.distanceKm * 2 * consumption) / 100 * fuelPrice
    })

    const avgFuelCost =
      fuelCosts.reduce((sum, c) => sum + c, 0) / fuelCosts.length
    const campsiteCost =
      (dest.campsiteCostPerNight * nights) / attendeesWithLocation.length
    const foodCost = 30 * nights
    const estimatedCostPerPerson = avgFuelCost + campsiteCost + foodCost

    // Scoring
    const avgDriveScore = clamp(
      100 - (avgDriveMinutes / 360) * 100,
      0,
      100
    )
    const maxDriveScore = clamp(
      100 - (maxDriveMinutes / 360) * 100,
      0,
      100
    )

    let budgetScore: number
    if (estimatedCostPerPerson <= maxBudget) {
      budgetScore = 100 - (estimatedCostPerPerson / maxBudget) * 50
    } else {
      budgetScore = 0
    }

    let seasonScore: number
    if (dest.bestSeasons.includes(currentSeason)) {
      seasonScore = 100
    } else if (adjacentSeasons.some((s) => dest.bestSeasons.includes(s))) {
      seasonScore = 50
    } else {
      seasonScore = 0
    }

    const compositeScore =
      avgDriveScore * 0.4 +
      maxDriveScore * 0.2 +
      budgetScore * 0.25 +
      seasonScore * 0.15

    ranked.push({
      destination: dest,
      score: compositeScore,
      routes,
      estimatedCostPerPerson,
      overBudget: estimatedCostPerPerson > maxBudget,
      avgDriveMinutes,
      maxDriveMinutes,
    })
  }

  return ranked.sort((a, b) => b.score - a.score)
}
