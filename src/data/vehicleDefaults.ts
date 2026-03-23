// Default fuel consumption (L/100km) by vehicle name.
// Used by the cost engine when a member hasn't set a custom value.
// Add new vehicles here as crew members join.

export const VEHICLE_CONSUMPTION_DEFAULTS: Record<string, number> = {
  'Kia Sportage': 8.5,
  'Ford Ranger Raptor': 10.5,
  'Nissan Pathfinder': 9.0,
  'Holden Colorado': 9.5,
  'VW Amarok': 9.0,
  'Motorbike': 5.0,
  'Toyota RAV4 Hybrid': 5.5,
}

// Fallback defaults by vehicle type when no name match is found
export const TYPE_CONSUMPTION_DEFAULTS: Record<'car' | '4wd' | 'motorbike', number> = {
  car: 9.0,
  '4wd': 10.5,
  motorbike: 5.0,
}

/**
 * Returns the best consumption estimate for a vehicle.
 * Tries name match first, falls back to type default.
 */
export function getConsumptionDefault(vehicleName: string, vehicleType: 'car' | '4wd' | 'motorbike'): number {
  return VEHICLE_CONSUMPTION_DEFAULTS[vehicleName] ?? TYPE_CONSUMPTION_DEFAULTS[vehicleType]
}
