/**
 * SMART DESTINATION AI — Alternative Destination Recommendation Engine.
 *
 * NOTE: This is a TRANSPARENT PROTOTYPE SCORING MODEL, NOT a trained ML model.
 *
 * Every recommendation is produced by an explainable weighted formula over the
 * demonstration dataset. It is deliberately data-driven and auditable so it can
 * later be replaced (or extended) by real machine-learning components such as:
 *   - destination clustering
 *   - cosine similarity over feature vectors
 *   - learned ranking models
 *   - tourism demand forecasting
 *   - official tourism / economic / environmental datasets
 *
 * Recommendation Score =
 *   0.35 × Destination Similarity
 * + 0.25 × Lower Tourism Pressure
 * + 0.20 × Economic Potential
 * + 0.10 × Interest Match
 * + 0.10 × Tourism Demand Opportunity
 *
 * All component scores are normalised to 0–100.
 */
import { destinations } from '../data/destinations.ts'
import type { Destination } from '../types/destination.ts'
import {
  average,
  clamp,
  featureSimilarity,
  roundScore,
  safeScore,
} from '../utils/scoring.ts'

/** Supported tourist interests in the prototype dataset. */
export const TOURIST_INTERESTS = [
  'Beach',
  'Nature',
  'Culture',
  'Food',
  'Adventure',
  'Heritage',
  'Shopping',
] as const

export type TouristInterest = (typeof TOURIST_INTERESTS)[number]

/** Supported crowding preferences. */
export const CROWDING_PREFERENCES = [
  'Low Crowding',
  'Balanced',
  'Popular',
] as const

export type CrowdingPreference = (typeof CROWDING_PREFERENCES)[number]

/** Default number of alternatives returned per request. */
export const DEFAULT_RECOMMENDATION_LIMIT = 5

/** An interest counts as "matched" when the candidate scores >= this value. */
export const MATCHED_INTEREST_THRESHOLD = 70

/** Weighted scoring model. Weights are explicit so every score is explainable. */
export const RECOMMENDATION_WEIGHTS = {
  similarity: 0.35,
  lowerPressure: 0.25,
  economic: 0.2,
  interest: 0.1,
  demand: 0.1,
} as const

export const TOTAL_RECOMMENDATION_WEIGHT = Object.values(
  RECOMMENDATION_WEIGHTS,
).reduce((sum, weight) => sum + weight, 0)

/** A single ranked alternative destination returned by the engine. */
export interface RecommendationResult {
  destination: Destination
  score: number
  similarity: number
  lowerPressureScore: number
  economicPotential: number
  interestMatch: number
  demandOpportunity: number
  matchedInterests: TouristInterest[]
  explanation: string
}

type ScoreField =
  | 'beachScore'
  | 'natureScore'
  | 'cultureScore'
  | 'foodScore'
  | 'adventureScore'
  | 'heritageScore'
  | 'shoppingScore'

interface InterestTrait {
  interest: TouristInterest
  field: ScoreField
  word: string
}

/** Maps each supported interest to its score field and a lower-case label. */
const INTEREST_TRAITS: readonly InterestTrait[] = [
  { interest: 'Beach', field: 'beachScore', word: 'beach' },
  { interest: 'Nature', field: 'natureScore', word: 'nature' },
  { interest: 'Culture', field: 'cultureScore', word: 'culture' },
  { interest: 'Food', field: 'foodScore', word: 'food' },
  { interest: 'Adventure', field: 'adventureScore', word: 'adventure' },
  { interest: 'Heritage', field: 'heritageScore', word: 'heritage' },
  { interest: 'Shopping', field: 'shoppingScore', word: 'shopping' },
]

const TRAIT_BY_INTEREST = INTEREST_TRAITS.reduce<Record<TouristInterest, InterestTrait>>(
  (map, trait) => {
    map[trait.interest] = trait
    return map
  },
  {} as Record<TouristInterest, InterestTrait>,
)

/** How strongly selected interests are boosted inside the similarity average. */
const SELECTED_INTEREST_SIMILARITY_WEIGHT = 1.5
const BASE_TRAIT_SIMILARITY_WEIGHT = 1

/**
 * Low Crowding relies heavily on absolute headroom (low pressure).
 * Popular relies more on relative relief so higher-pressure destinations are
 * penalised less. Balanced sits in between.
 */
const PRESSURE_PREFERENCE_WEIGHT: Record<CrowdingPreference, number> = {
  'Low Crowding': 0.8,
  Balanced: 0.5,
  Popular: 0.2,
}

/** Drop unknown/duplicate interests defensively. */
function normalizeInterests(interests: readonly TouristInterest[]): TouristInterest[] {
  const known = new Set(TOURIST_INTERESTS)
  return Array.from(new Set(interests)).filter((interest) => known.has(interest))
}

/**
 * Destination Similarity (0–100).
 * Averages per-characteristic similarity across all seven tourism traits.
 * Characteristics matching the traveller's selected interests receive slightly
 * more importance (1.5×) while keeping the calculation fully explainable.
 */
function scoreDestinationSimilarity(
  current: Destination,
  candidate: Destination,
  selected: TouristInterest[],
): number {
  let weightedSum = 0
  let weightTotal = 0
  for (const trait of INTEREST_TRAITS) {
    const similarity = featureSimilarity(current[trait.field], candidate[trait.field])
    const featureWeight = selected.includes(trait.interest)
      ? SELECTED_INTEREST_SIMILARITY_WEIGHT
      : BASE_TRAIT_SIMILARITY_WEIGHT
    weightedSum += similarity * featureWeight
    weightTotal += featureWeight
  }
  return weightedSum / weightTotal
}

/**
 * Lower Tourism Pressure (0–100).
 * Combines the candidate's absolute headroom (100 - pressure) with the relief
 * it offers relative to the current destination. The crowding preference blends
 * the two, steering the model without overriding the other factors.
 */
function scoreLowerTourismPressure(
  current: Destination,
  candidate: Destination,
  preference: CrowdingPreference,
): number {
  const currentPressure = safeScore(current.tourismPressure)
  const candidatePressure = safeScore(candidate.tourismPressure)

  const headroom = 100 - candidatePressure
  const relief = clamp(50 + currentPressure - candidatePressure)

  const absoluteWeight = PRESSURE_PREFERENCE_WEIGHT[preference]
  return clamp(absoluteWeight * headroom + (1 - absoluteWeight) * relief)
}

/**
 * Interest Match (0–100).
 * The candidate's scores for the selected interests, averaged.
 * Empty interest lists are handled gracefully (returns 0, no division by zero).
 */
function scoreInterestMatch(candidate: Destination, selected: TouristInterest[]): number {
  if (selected.length === 0) return 0
  return average(selected.map((interest) => safeScore(candidate[TRAIT_BY_INTEREST[interest].field])))
}

/**
 * Tourism Demand Opportunity (0–100).
 * Blends existing demand with capacity headroom. Headroom is weighted higher so
 * destinations that already show strong demand are rewarded, but the busiest
 * destinations are never rewarded purely for being busy.
 */
function scoreDemandOpportunity(candidate: Destination): number {
  const demand = safeScore(candidate.tourismDemand)
  const headroom = 100 - safeScore(candidate.tourismPressure)
  return clamp(0.6 * headroom + 0.4 * demand)
}

/** Interests where the candidate scores >= MATCHED_INTEREST_THRESHOLD. */
function matchedInterestsFor(
  candidate: Destination,
  selected: TouristInterest[],
): TouristInterest[] {
  return selected.filter(
    (interest) => safeScore(candidate[TRAIT_BY_INTEREST[interest].field]) >= MATCHED_INTEREST_THRESHOLD,
  )
}

interface ExplanationInput {
  similarity: number
  lowerPressureScore: number
  economicPotential: number
  demandOpportunity: number
  matchedInterests: TouristInterest[]
}

/**
 * Builds a short, data-driven explanation from the candidate's own scores.
 * No destination-specific sentence is ever hardcoded.
 */
function buildExplanation(input: ExplanationInput): string {
  const labelled = input.matchedInterests
    .slice(0, 2)
    .map((interest) => TRAIT_BY_INTEREST[interest].word)
  const traitPhrase = labelled.join(' and ')

  const lead = traitPhrase
    ? input.similarity >= 70
      ? `Strong ${traitPhrase} similarity`
      : `Similar ${traitPhrase} character`
    : input.similarity >= 70
      ? 'Strong similarity in tourism characteristics'
      : 'Comparable tourism characteristics'

  const pressure = input.lowerPressureScore >= 65
    ? ', with significantly lower tourism pressure'
    : input.lowerPressureScore >= 45
      ? ', with lower tourism pressure'
      : ''

  const economic = input.economicPotential >= 75
    ? ' and high economic potential'
    : input.economicPotential >= 55
      ? ' and solid economic potential'
      : ''

  const demand =
    input.demandOpportunity >= 50
      ? ' It also offers headroom to absorb additional tourism demand more sustainably.'
      : ''

  return `${lead}${pressure}${economic}.${demand}`
}

/**
 * Recommends alternative destinations ranked from highest score to lowest.
 *
 * @param currentDestination the destination the traveller currently plans to visit
 * @param interests           selected interests (e.g. ['Beach', 'Nature'])
 * @param preference          crowding preference: 'Low Crowding' | 'Balanced' | 'Popular'
 * @param limit               maximum number of alternatives to return (default 5)
 */
export function recommendDestinations(
  currentDestination: Destination,
  interests: readonly TouristInterest[],
  preference: CrowdingPreference = 'Balanced',
  limit: number = DEFAULT_RECOMMENDATION_LIMIT,
): RecommendationResult[] {
  if (!currentDestination) return []

  const selected = normalizeInterests(interests)

  // Never recommend the current destination or ineligible destinations.
  const candidates = destinations.filter(
    (destination) =>
      destination.id !== currentDestination.id &&
      destination.recommendationEligibility === true,
  )

  const results = candidates.map<RecommendationResult>((candidate) => {
    const similarity = scoreDestinationSimilarity(currentDestination, candidate, selected)
    const lowerPressureScore = scoreLowerTourismPressure(
      currentDestination,
      candidate,
      preference,
    )
    const economicPotential = safeScore(candidate.economicPotential)
    const interestMatch = scoreInterestMatch(candidate, selected)
    const demandOpportunity = scoreDemandOpportunity(candidate)

    const score = roundScore(
      RECOMMENDATION_WEIGHTS.similarity * similarity +
        RECOMMENDATION_WEIGHTS.lowerPressure * lowerPressureScore +
        RECOMMENDATION_WEIGHTS.economic * economicPotential +
        RECOMMENDATION_WEIGHTS.interest * interestMatch +
        RECOMMENDATION_WEIGHTS.demand * demandOpportunity,
    )

    const similarityRounded = roundScore(similarity)
    const lowerPressureRounded = roundScore(lowerPressureScore)
    const economicRounded = roundScore(economicPotential)
    const interestRounded = roundScore(interestMatch)
    const demandRounded = roundScore(demandOpportunity)
    const matched = matchedInterestsFor(candidate, selected)

    return {
      destination: candidate,
      score,
      similarity: similarityRounded,
      lowerPressureScore: lowerPressureRounded,
      economicPotential: economicRounded,
      interestMatch: interestRounded,
      demandOpportunity: demandRounded,
      matchedInterests: matched,
      explanation: buildExplanation({
        similarity: similarityRounded,
        lowerPressureScore: lowerPressureRounded,
        economicPotential: economicRounded,
        demandOpportunity: demandRounded,
        matchedInterests: matched,
      }),
    }
  })

  results.sort(
    (a, b) =>
      b.score - a.score ||
      b.similarity - a.similarity ||
      a.destination.destination.localeCompare(b.destination.destination),
  )

  return results.slice(0, Math.max(0, limit))
}