export interface RailCongestionThresholds {
  p60_threshold: number
  p85_threshold: number
  maximum_predicted_ridership: number
}

export interface RailModelMetrics {
  model: string
  analytical_category: string
  train_period: [string, string]
  test_period: [string, string]
  train_rows: number
  test_rows: number
  features: string[]
  metrics: {
    mae: number
    rmse: number
    r2: number
  }
  baseline: {
    name: string
    mae: number
  }
  mae_improvement: {
    absolute: number
    percent: number
  }
  retention_rule: {
    description: string
    min_improvement_percent: number
  }
  model_retained_against_baseline: boolean
  congestion_bands: {
    note: string
    classification: string
    thresholds_by_service: Record<string, RailCongestionThresholds>
  }
  public_holiday_feature: string
}

export interface SustainableDiversionRecommendation {
  sourceDestination: string
  destination: string
  state: string
  score: number
  similarity: number
  tourismPressure: number
  lowerPressureScore: number
  economicOpportunity: number
  sustainableMobility: number
  railAccessibility: number | null
  railCongestion: number | null
  gatewayStation: string
  matchedInterests: string[]
  explanation: string
}

export interface SustainableDiversionData {
  schema: string
  generatedAt: string
  metadata: {
    prototypeNote: string
    tourismPressureLevel: string
    destinationCount: number
    gatewayMappingCount: number
    destinationsWithoutDirectRail: number
    topPerDestination: number
    interestWeight: number
    scoreWeights: Record<string, number>
    economicWeights: Record<string, number>
    mobilityWeights: Record<string, number>
  }
  recommendations: SustainableDiversionRecommendation[]
}

export interface TourismPressureRow {
  state: string
  year: number
  tourism_intensity: number
  visitor_growth_pct: number
  tourists: number
  average_length_of_stay: number
  receipts_per_resident_rm: number
  tourism_pressure_index: number
  pressure_band: string
}

export type RailCongestionBand = 'Low' | 'Moderate' | 'High' | null