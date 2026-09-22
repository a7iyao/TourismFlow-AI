/**
 * Development-only validation for the recommendation engine.
 *
 * This module is type-checked by `tsc -b` but is never imported by the
 * application, so it does not ship in the production bundle. Run it with:
 *
 *   npm run validate:recommendations
 */
import { destinations } from '../data/destinations.ts'
import {
  DEFAULT_RECOMMENDATION_LIMIT,
  recommendDestinations,
} from './recommendationEngine.ts'
import type {
  CrowdingPreference,
  RecommendationResult,
  TouristInterest,
} from './recommendationEngine.ts'

interface ValidationScenario {
  name: string
  currentId: string
  interests: TouristInterest[]
  preference: CrowdingPreference
}

const SCENARIOS: ValidationScenario[] = [
  {
    name: 'Langkawi — Beach / Nature / Culture — Low Crowding',
    currentId: 'langkawi',
    interests: ['Beach', 'Nature', 'Culture'],
    preference: 'Low Crowding',
  },
  {
    name: 'Kuala Lumpur — Food / Shopping / Culture — Balanced',
    currentId: 'kuala-lumpur',
    interests: ['Food', 'Shopping', 'Culture'],
    preference: 'Balanced',
  },
  {
    name: 'Cameron Highlands — Nature / Adventure — Low Crowding',
    currentId: 'cameron-highlands',
    interests: ['Nature', 'Adventure'],
    preference: 'Low Crowding',
  },
]

const NUMERIC_COMPONENTS = [
  'score',
  'similarity',
  'lowerPressureScore',
  'economicPotential',
  'interestMatch',
  'demandOpportunity',
] as const

function isWholeNumberInRange(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100
}

function checkScenario(
  scenario: ValidationScenario,
  results: RecommendationResult[],
): string[] {
  const failures: string[] = []

  if (results.length === 0) {
    failures.push('expected at least one recommendation, received none')
  }
  if (results.length > DEFAULT_RECOMMENDATION_LIMIT) {
    failures.push(
      `expected at most ${DEFAULT_RECOMMENDATION_LIMIT} recommendations, received ${results.length}`,
    )
  }

  for (const result of results) {
    for (const component of NUMERIC_COMPONENTS) {
      if (!isWholeNumberInRange(result[component])) {
        failures.push(
          `${result.destination.destination}: ${component}=${result[component]} is not a whole number in 0–100`,
        )
      }
    }
    if (result.destination.id === scenario.currentId) {
      failures.push(`${result.destination.destination} recommended itself`)
    }
    if (!result.destination.recommendationEligibility) {
      failures.push(`${result.destination.destination} is not recommendation eligible`)
    }
    if (result.explanation.length === 0) {
      failures.push(`${result.destination.destination} has an empty explanation`)
    }
  }

  for (let i = 1; i < results.length; i += 1) {
    if (results[i - 1].score < results[i].score) {
      failures.push('results are not sorted from highest to lowest score')
      break
    }
  }

  return failures
}

function logResults(results: RecommendationResult[]): void {
  results.forEach((result, index) => {
    console.log(
      `  ${index + 1}. ${result.destination.destination} (${result.destination.state})` +
        ` — score ${result.score}` +
        ` | similarity ${result.similarity}` +
        ` | pressure relief ${result.lowerPressureScore}` +
        ` | economic ${result.economicPotential}` +
        ` | interest ${result.interestMatch}` +
        ` | demand ${result.demandOpportunity}` +
        ` | matched ${result.matchedInterests.join(', ') || '—'}`,
    )
    console.log(`     "${result.explanation}"`)
  })
}

function runValidation(): boolean {
  console.log('SMART DESTINATION AI — recommendation engine validation')
  console.log('-------------------------------------------------------')

  const byId = new Map(destinations.map((destination) => [destination.id, destination]))
  let allPassed = true

  for (const scenario of SCENARIOS) {
    const currentDestination = byId.get(scenario.currentId)
    if (!currentDestination) {
      console.error(`\n${scenario.name}\n  FAIL — current destination not found`)
      allPassed = false
      continue
    }

    const results = recommendDestinations(
      currentDestination,
      scenario.interests,
      scenario.preference,
    )

    console.log(`\n${scenario.name}`)
    logResults(results)

    const failures = checkScenario(scenario, results)
    if (failures.length === 0) {
      console.log(`  PASS — ${results.length} alternatives validated`)
    } else {
      allPassed = false
      for (const failure of failures) {
        console.error(`  FAIL — ${failure}`)
      }
    }
  }

  console.log(
    `\n${allPassed ? 'VALIDATION PASSED' : 'VALIDATION FAILED'}`,
  )
  return allPassed
}

export const recommendationEngineValidationPassed = runValidation()
