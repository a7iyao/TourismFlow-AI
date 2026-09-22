import type {
  RailCongestionThresholds,
  RailModelMetrics,
  SustainableDiversionData,
  TourismPressureRow,
} from '../types/analytics'

const DIVERSION_URL = `${import.meta.env.BASE_URL}data/sustainable_diversion.json`
const METRICS_URL = `${import.meta.env.BASE_URL}data/rail_model_metrics.json`
const PRESSURE_URL = `${import.meta.env.BASE_URL}data/tourism_pressure.csv`

/**
 * Coerce values parsed from compact precomputed artifacts.
 * - railCongestion is written as "" when no rail forecast exists for the
 *   gateway, so it is normalised to null before it reaches the UI.
 */
function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = toNullableNumber(value)
  return parsed === null ? fallback : parsed
}

async function loadJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`)
  }
  return response.json()
}

async function loadCsv(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`)
  }
  const text = await response.text()
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const [header, ...rows] = lines
  const columns = header.split(',')
  return rows.map((line) => {
    const values = line.split(',')
    const record: Record<string, unknown> = {}
    columns.forEach((column, index) => {
      record[column] = values[index]
    })
    return record
  })
}

function parseDiversion(data: unknown): SustainableDiversionData {
  if (!data || typeof data !== 'object') {
    throw new Error('sustainable_diversion.json has an unexpected shape')
  }
  const raw = data as Record<string, unknown>
  const metadata = (raw.metadata ?? {}) as Record<string, unknown>

  const numberRecord = (value: unknown): Record<string, number> => {
    if (!value || typeof value !== 'object') return {}
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        toNumber(item),
      ]),
    )
  }

  const recommendations = Array.isArray(raw.recommendations)
    ? raw.recommendations.map((item) => {
        const rec = item as Record<string, unknown>
        return {
          sourceDestination: String(rec.sourceDestination ?? ''),
          destination: String(rec.destination ?? ''),
          state: String(rec.state ?? ''),
          score: toNumber(rec.score),
          similarity: toNumber(rec.similarity),
          tourismPressure: toNumber(rec.tourismPressure),
          lowerPressureScore: toNumber(rec.lowerPressureScore),
          economicOpportunity: toNumber(rec.economicOpportunity),
          sustainableMobility: toNumber(rec.sustainableMobility),
          railAccessibility: toNullableNumber(rec.railAccessibility),
          railCongestion: toNullableNumber(rec.railCongestion),
          gatewayStation: String(rec.gatewayStation ?? ''),
          matchedInterests: Array.isArray(rec.matchedInterests)
            ? rec.matchedInterests.map(String)
            : [],
          explanation: String(rec.explanation ?? ''),
        }
      })
    : []
  return {
    schema: String(raw.schema ?? ''),
    generatedAt: String(raw.generatedAt ?? ''),
    metadata: {
      prototypeNote: String(metadata['prototypeNote'] ?? ''),
      tourismPressureLevel: String(metadata['tourismPressureLevel'] ?? ''),
      destinationCount: toNumber(metadata['destinationCount']),
      gatewayMappingCount: toNumber(metadata['gatewayMappingCount']),
      destinationsWithoutDirectRail: toNumber(
        metadata['destinationsWithoutDirectRail'],
      ),
      topPerDestination: toNumber(metadata['topPerDestination']),
      interestWeight: toNumber(metadata['interestWeight']),
      scoreWeights: numberRecord(metadata['scoreWeights']),
      economicWeights: numberRecord(metadata['economicWeights']),
      mobilityWeights: numberRecord(metadata['mobilityWeights']),
    },
    recommendations,
  }
}

function parseMetrics(data: unknown): RailModelMetrics {
  if (!data || typeof data !== 'object') {
    throw new Error('rail_model_metrics.json has an unexpected shape')
  }
  const raw = data as Record<string, unknown>
  const congestionRaw = (raw.congestion_bands ?? {}) as Record<string, unknown>
  const thresholdsRaw = (congestionRaw.thresholds_by_service ??
    {}) as Record<string, Record<string, unknown>>
  const thresholds_by_service: Record<string, RailCongestionThresholds> = {}
  for (const [service, value] of Object.entries(thresholdsRaw)) {
    thresholds_by_service[service] = {
      p60_threshold: toNumber(value?.['p60_threshold']),
      p85_threshold: toNumber(value?.['p85_threshold']),
      maximum_predicted_ridership: toNumber(
        value?.['maximum_predicted_ridership'],
      ),
    }
  }
  const metricsRaw = (raw.metrics ?? {}) as Record<string, unknown>
  const baselineRaw = (raw.baseline ?? {}) as Record<string, unknown>
  const improvementRaw = (raw.mae_improvement ?? {}) as Record<string, unknown>
  const retentionRaw = (raw.retention_rule ?? {}) as Record<string, unknown>
  const firstPeriod = Array.isArray(raw.train_period) ? raw.train_period : []
  const secondPeriod = Array.isArray(raw.test_period) ? raw.test_period : []
  return {
    model: String(raw.model ?? ''),
    analytical_category: String(raw.analytical_category ?? ''),
    train_period: [String(firstPeriod[0] ?? ''), String(firstPeriod[1] ?? '')],
    test_period: [String(secondPeriod[0] ?? ''), String(secondPeriod[1] ?? '')],
    train_rows: toNumber(raw.train_rows),
    test_rows: toNumber(raw.test_rows),
    features: Array.isArray(raw.features) ? raw.features.map(String) : [],
    metrics: {
      mae: toNumber(metricsRaw['mae']),
      rmse: toNumber(metricsRaw['rmse']),
      r2: toNumber(metricsRaw['r2']),
    },
    baseline: {
      name: String(baselineRaw['name'] ?? ''),
      mae: toNumber(baselineRaw['mae']),
    },
    mae_improvement: {
      absolute: toNumber(improvementRaw['absolute']),
      percent: toNumber(improvementRaw['percent']),
    },
    retention_rule: {
      description: String(retentionRaw['description'] ?? ''),
      min_improvement_percent: toNumber(retentionRaw['min_improvement_percent']),
    },
    model_retained_against_baseline:
      raw.model_retained_against_baseline === true,
    congestion_bands: {
      note: String(congestionRaw['note'] ?? ''),
      classification: String(congestionRaw['classification'] ?? ''),
      thresholds_by_service,
    },
    public_holiday_feature: String(raw.public_holiday_feature ?? ''),
  }
}

function parseTourismPressure(data: unknown): TourismPressureRow[] {
  if (!Array.isArray(data)) return []
  return data
    .map((item) => {
      const row = item as Record<string, unknown>
      return {
        state: String(row.state ?? ''),
        year: toNumber(row.year),
        tourism_intensity: toNumber(row.tourism_intensity),
        visitor_growth_pct: toNumber(row.visitor_growth_pct),
        tourists: toNumber(row.tourists),
        average_length_of_stay: toNumber(row.average_length_of_stay),
        receipts_per_resident_rm: toNumber(row.receipts_per_resident_rm),
        tourism_pressure_index: toNumber(row.tourism_pressure_index),
        pressure_band: String(row.pressure_band ?? ''),
      }
    })
    .filter((row) => row.year > 0)
}

// Module-level single-flight cache so every page reuses the same resolved data.
let diversionPromise: Promise<SustainableDiversionData> | null = null
let metricsPromise: Promise<RailModelMetrics> | null = null
let pressurePromise: Promise<TourismPressureRow[]> | null = null

export function loadSustainableDiversion(): Promise<SustainableDiversionData> {
  if (!diversionPromise) {
    diversionPromise = loadJson(DIVERSION_URL).then(parseDiversion)
  }
  return diversionPromise
}

export function loadRailModelMetrics(): Promise<RailModelMetrics> {
  if (!metricsPromise) {
    metricsPromise = loadJson(METRICS_URL).then(parseMetrics)
  }
  return metricsPromise
}

export function loadTourismPressure(): Promise<TourismPressureRow[]> {
  if (!pressurePromise) {
    pressurePromise = loadCsv(PRESSURE_URL).then(parseTourismPressure)
  }
  return pressurePromise
}

export { toNumber, toNullableNumber }