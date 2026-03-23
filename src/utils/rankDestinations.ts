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

  // Fetch routes for all destinations in parallel
  const routeResults = await Promise.allSettled(
    filtered.map((dest) =>
      fetchRoutes(memberInputs, { lat: dest.lat, lng: dest.lng })
    )
  )

  const currentSeason = getCurrentSeason()
  const adjacentSeasons = getAdjacentSeasons(currentSeason)

  const ranked: RankedDestination[] = []

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
