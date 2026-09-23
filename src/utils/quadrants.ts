import { destinations } from '../data'

export const medianOf = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

export const MEDIAN_PRESSURE = medianOf(
  destinations.map((d) => d.tourismPressure),
)

export const MEDIAN_ECONOMIC = medianOf(
  destinations.map((d) => d.economicPotential),
)

export type QuadrantKey = 'opportunity' | 'established' | 'emerging' | 'risk'

export function quadrantKeyOf(pressure: number, economic: number): QuadrantKey {
  if (economic >= MEDIAN_ECONOMIC && pressure < MEDIAN_PRESSURE) return 'opportunity'
  if (economic >= MEDIAN_ECONOMIC && pressure >= MEDIAN_PRESSURE) return 'established'
  if (economic < MEDIAN_ECONOMIC && pressure < MEDIAN_PRESSURE) return 'emerging'
  return 'risk'
}

export const QUADRANT_COLOR: Record<QuadrantKey, string> = {
  opportunity: '#13a08a',
  established: '#3b82f6',
  emerging: '#d9910b',
  risk: '#dc4448',
}