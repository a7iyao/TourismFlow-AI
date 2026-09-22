import {
  RECOMMENDATION_WEIGHTS,
  TOTAL_RECOMMENDATION_WEIGHT,
} from './recommendationEngine'

export {
  recommendDestinations,
  TOURIST_INTERESTS,
  CROWDING_PREFERENCES,
  DEFAULT_RECOMMENDATION_LIMIT,
  MATCHED_INTEREST_THRESHOLD,
} from './recommendationEngine'
export type {
  RecommendationResult,
  CrowdingPreference,
  TouristInterest,
} from './recommendationEngine'

export { RECOMMENDATION_WEIGHTS, TOTAL_RECOMMENDATION_WEIGHT }

export interface RecommendationFactor {
  key: string
  label: string
  weight: number
  description: string
}

type FactorKey = keyof typeof RECOMMENDATION_WEIGHTS

const FACTOR_META: Record<FactorKey, { label: string; description: string }> = {
  similarity: {
    label: 'Destination Similarity',
    description:
      'How closely the alternative matches the characteristics of the current destination.',
  },
  lowerPressure: {
    label: 'Lower Tourism Pressure',
    description:
      'Rewards alternatives that can absorb demand with a lower crowding burden.',
  },
  economic: {
    label: 'Economic Potential',
    description:
      'The capacity of the destination to generate sustainable tourism value.',
  },
  interest: {
    label: 'Tourist Interest Match',
    description:
      'How well the destination fits the traveller-selected interest profile.',
  },
  demand: {
    label: 'Tourism Demand Opportunity',
    description:
      'Headroom for additional visitors without stressing the destination.',
  },
}

export const RECOMMENDATION_FACTORS: RecommendationFactor[] = (
  Object.keys(FACTOR_META) as FactorKey[]
).map((key) => ({
  key,
  weight: RECOMMENDATION_WEIGHTS[key],
  ...FACTOR_META[key],
}))

export const TOTAL_FACTOR_WEIGHT = TOTAL_RECOMMENDATION_WEIGHT