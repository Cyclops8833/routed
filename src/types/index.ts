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
  homeLocation: HomeLocation | null
  vehicles: Vehicle[]
  createdAt: Date
  onboardingComplete: boolean
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
}
