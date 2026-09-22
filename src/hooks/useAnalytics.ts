import { useEffect, useState } from 'react'
import {
  loadRailModelMetrics,
  loadSustainableDiversion,
  loadTourismPressure,
} from '../data/analytics'
import type {
  RailModelMetrics,
  SustainableDiversionData,
  TourismPressureRow,
} from '../types/analytics'

export interface AnalyticsState {
  diversion: SustainableDiversionData | null
  railMetrics: RailModelMetrics | null
  tourismPressure: TourismPressureRow[] | null
  loading: boolean
  error: string | null
}

const INITIAL_STATE: AnalyticsState = {
  diversion: null,
  railMetrics: null,
  tourismPressure: null,
  loading: true,
  error: null,
}

/**
 * Loads the three compact precomputed artifacts (sustainable diversion engine,
 * rail demand forecast metrics, state-level tourism pressure) with a shared
 * loading / error state.
 */
export function useAnalytics(): AnalyticsState {
  const [state, setState] = useState<AnalyticsState>(INITIAL_STATE)

  useEffect(() => {
    let active = true
    Promise.all([
      loadSustainableDiversion(),
      loadRailModelMetrics(),
      loadTourismPressure(),
    ])
      .then(([diversion, railMetrics, tourismPressure]) => {
        if (!active) return
        setState({ diversion, railMetrics, tourismPressure, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          diversion: null,
          railMetrics: null,
          tourismPressure: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to load analysis artifacts',
        })
      })
    return () => {
      active = false
    }
  }, [])

  return state
}

export function latestPressureRow(
  rows: TourismPressureRow[] | null,
  stateName: string,
): TourismPressureRow | undefined {
  if (!rows) return undefined
  const candidates = rows
    .filter((row) => row.state === stateName)
    .sort((a, b) => b.year - a.year)
  return candidates[0]
}