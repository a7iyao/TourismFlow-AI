/**
 * Shared numeric helpers for the SMART DESTINATION AI recommendation engine.
 *
 * Every component score in the prototype is normalised to a 0–100 scale so it
 * can be combined transparently into a single weighted recommendation score.
 */

/** Clamp a number into the [min, max] range (defaults to 0–100). */
export function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * Guard a numeric score before use.
 * Missing or invalid values fall back to `fallback` (default 0) so a single bad
 * data point can never poison the recommendation score.
 */
export function safeScore(value: number, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clamp(value, 0, 100)
}

/**
 * Average a list of numbers.
 * Returns 0 for an empty list so callers never divide by zero.
 */
export function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * Transparent similarity for a single tourism characteristic.
 * 0 = completely different, 100 = identical.
 *
 * similarity = 100 - |currentScore - candidateScore|
 */
export function featureSimilarity(current: number, candidate: number): number {
  return clamp(100 - Math.abs(safeScore(current) - safeScore(candidate)))
}

/** Round a normalised 0–100 score to a whole number for display. */
export function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100))
}