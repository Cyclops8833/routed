export interface Vehicle {
  id: string
  name: string
  type: 'car' | '4wd' | 'motorbike'
  fuelType: 'petrol' | 'diesel'
  consumption: number // L/100km
}

export interface HomeLocation {
  suburb: string
  lat: number
  lng: number
}

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  customPhotoURL?: string
  homeLocation: HomeLocation | null
  vehicles: Vehicle[]
  createdAt: Date
  onboardingComplete: boolean
}

export interface Vote {
  uid: string
  destinationId: string
  votedAt: Date
}

export interface Shortlist {
  id?: string
  memberUid: string
  destinationId: string
  createdAt: Date
}

export interface Trip {
  id: string
  name: string
  dateRange: { start: string; end: string }
  tripLength: 'overnighter' | 'long-weekend'
  maxBudget: number
  creatorUid: string
  attendees: string[]
  selectedDestinationIds: string[]
  status: 'proposed' | 'voting' | 'confirmed' | 'active' | 'completed'
  createdAt: Date
  confirmedDestinationId?: string
  votingDeadline?: string
  votes?: Vote[]
  costConfig?: {
    fuelPrices: { petrol: number; diesel: number }
    dailyFoodRate: number
    lineItems: Array<{ id: string; label: string; amount: number; addedByUid: string }>
  }
}
