export const CROWDING_LEVELS = ['Low', 'Moderate', 'High'] as const

export type CrowdingLevel = (typeof CROWDING_LEVELS)[number]

export interface Destination {
  id: string
  destination: string
  state: string
  latitude: number
  longitude: number
  tourismPressure: number
  tourismDemand: number
  economicPotential: number
  beachScore: number
  natureScore: number
  cultureScore: number
  foodScore: number
  adventureScore: number
  heritageScore: number
  shoppingScore: number
  crowdingLevel: CrowdingLevel
  accommodationActivity: number
  recommendationEligibility: boolean
}

export type DestinationId = Destination['id']