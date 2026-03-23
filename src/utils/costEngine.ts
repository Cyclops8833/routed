import type { UserProfile } from '../types'
import type { Destination } from '../data/destinations'
import { getConsumptionDefault } from '../data/vehicleDefaults'

export interface FuelPrices {
  petrol: number  // default 1.90
  diesel: number  // default 1.85
}

export interface CostLineItem {
  id: string
  label: string
  amount: number      // total amount
  addedByUid: string
}

export interface MemberCost {
  uid: string
  displayName: string
  fuelCost: number        // individual (their vehicle, their distance)
  campsiteCost: number    // even split
  foodCost: number        // per-person daily rate × nights
  otherCost: number       // even split of all line items
  total: number
  overBudget: boolean
}

export interface CostBreakdown {
  members: MemberCost[]
  totalFuel: number
  totalCampsite: number
  totalFood: number
  totalOther: number
  grandTotalPerPerson: number  // average
  cheapestMember: MemberCost
  mostExpensiveMember: MemberCost
}

export function calculateCosts(params: {
  attendees: UserProfile[]
  distancesKm: Record<string, number>   // uid → one-way km to destination
  destination: Destination
  nights: number
  maxBudget: number
  fuelPrices: FuelPrices
  dailyFoodRate: number   // default 30
  lineItems: CostLineItem[]
}): CostBreakdown {
  const {
    attendees,
    distancesKm,
    destination,
    nights,
    maxBudget,
    fuelPrices,
    dailyFoodRate,
    lineItems,
  } = params

  const memberCount = attendees.length || 1

  const totalOtherAll = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const otherCostPerMember = totalOtherAll / memberCount

  const campsiteCostPerMember = (destination.campsiteCostPerNight * nights) / memberCount
  const foodCostPerMember = dailyFoodRate * nights

  const members: MemberCost[] = attendees.map((attendee) => {
    const distanceKm = distancesKm[attendee.uid] ?? 0
    const primaryVehicle = attendee.vehicles[0]

    let fuelCost = 0
    if (primaryVehicle && distanceKm > 0) {
      const consumption =
        primaryVehicle.consumption > 0
          ? primaryVehicle.consumption
          : getConsumptionDefault(primaryVehicle.name, primaryVehicle.type)

      const fuelPrice =
        primaryVehicle.fuelType === 'diesel'
          ? fuelPrices.diesel
          : fuelPrices.petrol

      fuelCost = (distanceKm * 2) * (consumption / 100) * fuelPrice
    }

    const total = fuelCost + campsiteCostPerMember + foodCostPerMember + otherCostPerMember

    return {
      uid: attendee.uid,
      displayName: attendee.displayName,
      fuelCost,
      campsiteCost: campsiteCostPerMember,
      foodCost: foodCostPerMember,
      otherCost: otherCostPerMember,
      total,
      overBudget: total > maxBudget,
    }
  })

  // Sort cheapest first
  members.sort((a, b) => a.total - b.total)

  const totalFuel = members.reduce((sum, m) => sum + m.fuelCost, 0)
  const totalCampsite = members.reduce((sum, m) => sum + m.campsiteCost, 0)
  const totalFood = members.reduce((sum, m) => sum + m.foodCost, 0)
  const totalOther = members.reduce((sum, m) => sum + m.otherCost, 0)
  const grandTotalPerPerson =
    members.length > 0
      ? members.reduce((sum, m) => sum + m.total, 0) / members.length
      : 0

  const cheapestMember = members[0]
  const mostExpensiveMember = members[members.length - 1]

  return {
    members,
    totalFuel,
    totalCampsite,
    totalFood,
    totalOther,
    grandTotalPerPerson,
    cheapestMember,
    mostExpensiveMember,
  }
}
