/**
 * SMART DESTINATION AI — Sustainable Diversion ranking layer.
 *
 * The Sustainable Diversion Engine (ml/scripts/build_sustainable_diversion.py)
 * precomputes a sorted list of alternatives per source destination using:
 *
 *   score = 0.35 × Destination Similarity
 *         + 0.30 × Lower Tourism Pressure
 *         + 0.20 × Economic Opportunity
 *         + 0.15 × Sustainable Mobility
 *
 * This module RE-RANKS that precomputed list in the browser when the traveller
 * refines their request with interests and a crowding preference. It keeps the
 * model score authoritative and only nudges the ordering transparently:
 *
 *   displayScore = 0.70 × model score
 *                + 0.20 × crowding tilt
 *                + 0.10 × interest fit          (when interests are selected)
 *
 *   displayScore = 0.80 × model score
 *                + 0.20 × crowding tilt          (when no interests selected)
 *
 * - crowding tilt  = lowerPressureScore      for "Low Crowding"
 *                    50                      for "Balanced" (neutral)
 *                     100 - lowerPressureScore for "Popular"
 * - interest fit   = average of the candidate's demonstration-dataset
 *                    characteristic scores for the selected interests.
 */
import { destinations } from '../data/destinations.ts'
import type { SustainableDiversionRecommendation } from '../types/analytics.ts'
import {
  CROWDING_PREFERENCES,
  TOURIST_INTERESTS,
} from './recommendationEngine.ts'
import type { CrowdingPreference, TouristInterest } from './recommendationEngine.ts'
import { average, roundScore, safeScore } from '../utils/scoring.ts'

type ScoreField =
  | 'beachScore'
  | 'natureScore'
  | 'cultureScore'
  | 'foodScore'
  | 'adventureScore'
  | 'heritageScore'
  | 'shoppingScore'

const FIELD_BY_INTEREST: Record<TouristInterest, ScoreField> = {
  Beach: 'beachScore',
  Nature: 'natureScore',
  Culture: 'cultureScore',
  Food: 'foodScore',
  Adventure: 'adventureScore',
  Heritage: 'heritageScore',
  Shopping: 'shoppingScore',
}

/** Weights used to blend the re-ranked display score. */
export const RERANK_WEIGHTS_WITH_INTERESTS = {
  score: 0.7,
  crowdingTilt: 0.2,
  interestFit: 0.1,
} as const

export const RERANK_WEIGHTS_NO_INTERESTS = {
  score: 0.8,
  crowdingTilt: 0.2,
} as const

export interface RankedRecommendation extends SustainableDiversionRecommendation {
  interestFit: number
  crowdTilt: number
  displayScore: number
}

export function normalizeInterests(
  interests: readonly TouristInterest[],
): TouristInterest[] {
  const known = new Set<string>(TOURIST_INTERESTS)
  return Array.from(new Set(interests)).filter((interest) => known.has(interest))
}

function characteristicScore(destinationName: string, field: ScoreField): number {
  const destination = destinations.find(
    (item) => item.destination === destinationName,
  )
  return destination ? safeScore(destination[field]) : 0
}

/**
 * Sensible default interest selection for a destination: its three strongest
 * characteristic scores (so the request is meaningful without any input).
 */
export function defaultInterestsFor(
  destinationName: string,
): TouristInterest[] {
  return (Object.keys(FIELD_BY_INTEREST) as TouristInterest[])
    .map((interest) => ({
      interest,
      score: characteristicScore(destinationName, FIELD_BY_INTEREST[interest]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.interest)
}

export function interestFitFor(
  candidate: string,
  interests: readonly TouristInterest[],
): number {
  const selected = normalizeInterests(interests)
  if (selected.length === 0) return 0
  return Math.round(
    average(selected.map((interest) => characteristicScore(candidate, FIELD_BY_INTEREST[interest]))),
  )
}

export function crowdTiltFor(
  recommendation: SustainableDiversionRecommendation,
  preference: CrowdingPreference,
): number {
  if (preference === 'Low Crowding') return safeScore(recommendation.lowerPressureScore)
  if (preference === 'Popular') return 100 - safeScore(recommendation.lowerPressureScore)
  return 50
}

/**
 * Re-ranks the precomputed recommendations for the given source destination
 * according to the traveller's interests and crowding preference.
 */
export function rankSustainableRecommendations(
  recommendations: readonly SustainableDiversionRecommendation[],
  currentDestination: string,
  interests: readonly TouristInterest[],
  preference: CrowdingPreference,
): RankedRecommendation[] {
  const selected = normalizeInterests(interests)
  const candidateList = recommendations.filter(
    (recommendation) => recommendation.sourceDestination === currentDestination,
  )

  const ranked = candidateList.map<RankedRecommendation>((recommendation) => {
    const interestFit = interestFitFor(recommendation.destination, selected)
    const crowdTilt = crowdTiltFor(recommendation, preference)
    const withInterests = selected.length > 0
    const scoreWeight = withInterests
      ? RERANK_WEIGHTS_WITH_INTERESTS.score
      : RERANK_WEIGHTS_NO_INTERESTS.score
    const tiltWeight = withInterests
      ? RERANK_WEIGHTS_WITH_INTERESTS.crowdingTilt
      : RERANK_WEIGHTS_NO_INTERESTS.crowdingTilt
    const interestWeight = withInterests ? RERANK_WEIGHTS_WITH_INTERESTS.interestFit : 0
    const displayScore = roundScore(
      scoreWeight * recommendation.score +
        tiltWeight * crowdTilt +
        interestWeight * interestFit,
    )
    return { ...recommendation, interestFit, crowdTilt, displayScore }
  })

  ranked.sort(
    (a, b) =>
      b.displayScore - a.displayScore ||
      b.score - a.score ||
      a.destination.localeCompare(b.destination),
  )
  return ranked
}

export function congestionBandFor(value: number | null): string {
  return value === null ? 'No rail forecast' : `${Math.round(value)} congestion`
}

export { CROWDING_PREFERENCES, TOURIST_INTERESTS }
export type { CrowdingPreference, TouristInterest }