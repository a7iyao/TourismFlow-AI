import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeftRight, ChartColumn, Layers, Radar as RadarIcon } from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { Panel } from '../components/common/Panel'
import { ErrorState, LoadingState } from '../components/common/LoadingState'
import { destinations } from '../data'
import { useAnalytics } from '../hooks/useAnalytics'
import type { Destination } from '../types/destination'
import { cn } from '../utils/cn'

const MAX_COMPARISON = 4

const TRAIT_FIELDS: Array<{ field: keyof Destination; label: string }> = [
  { field: 'beachScore', label: 'Beach' },
  { field: 'natureScore', label: 'Nature' },
  { field: 'cultureScore', label: 'Culture' },
  { field: 'foodScore', label: 'Food' },
  { field: 'adventureScore', label: 'Adventure' },
  { field: 'heritageScore', label: 'Heritage' },
  { field: 'shoppingScore', label: 'Shopping' },
] as const

const PALETTE = ['#0c7a64', '#3b82f6', '#d9910b', '#dc4448']

const DEFAULT_SELECTED = ['Langkawi', 'Desaru', 'Taiping']

export function DestinationComparisonPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { diversion, loading, error } = useAnalytics()

  const selected = useMemo(() => {
    const paramValue = searchParams.get('dest')
    const names = paramValue
      ? paramValue.split(',').map((name) => name.trim()).filter(Boolean)
      : DEFAULT_SELECTED
    const found: Destination[] = []
    for (const name of names.slice(0, MAX_COMPARISON)) {
      const destination = destinations.find(
        (item) => item.destination.toLowerCase() === name.toLowerCase(),
      )
      if (destination && !found.some((item) => item.id === destination.id)) {
        found.push(destination)
      }
    }
    return found.length > 0 ? found : DEFAULT_SELECTED.map(
      (name) => destinations.find((item) => item.destination === name)!,
    )
  }, [searchParams])

  const updateSelection = (destination: Destination) => {
    const already = selected.some((item) => item.id === destination.id)
    let next: Destination[]
    if (already) {
      next = selected.filter((item) => item.id !== destination.id)
    } else {
      if (selected.length >= MAX_COMPARISON) return
      next = [...selected, destination]
    }
    setSearchParams(
      next.length > 0
        ? { dest: next.map((item) => item.destination).join(',') }
        : {},
    )
  }

  const radarData = TRAIT_FIELDS.map((trait) => {
    const row: Record<string, string | number> = { trait: trait.label }
    for (const destination of selected) {
      row[destination.destination] = destination[trait.field] as number
    }
    return row
  })

  const barData = selected.map((destination) => ({
    destination: destination.destination,
    pressure: destination.tourismPressure,
    demand: destination.tourismDemand,
    economic: destination.economicPotential,
  }))

  const source = selected[0]
  const comparisonRows = useMemo(() => {
    if (!diversion || !source) return []
    const rows: Array<{
      target: string
      score: number | null
      similarity: number | null
      lowerPressure: number | null
      economic: number | null
      mobility: number | null
      gateway: string
    }> = []
    for (const destination of selected.slice(1)) {
      const rec = diversion.recommendations.find(
        (item) =>
          (item.sourceDestination === source.destination &&
            item.destination === destination.destination) ||
          (item.sourceDestination === destination.destination &&
            item.destination === source.destination),
      )
      rows.push({
        target: destination.destination,
        score: rec?.score ?? null,
        similarity: rec?.similarity ?? null,
        lowerPressure: rec?.lowerPressureScore ?? null,
        economic: rec?.economicOpportunity ?? null,
        mobility: rec?.sustainableMobility ?? null,
        gateway: rec?.gatewayStation ?? '',
      })
    }
    return rows
  }, [diversion, selected, source])

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Comparison"
        title="Destination Comparison"
        description="Compare up to four destinations across tourism characteristics, pressure, demand and economic potential."
      />

      <Panel
        title="Select destinations"
        icon={ArrowLeftRight}
        description="Click to add or remove. Up to four destinations may be compared at once."
      >
        <div className="sd-compare-chips">
          {destinations.map((destination) => (
            <button
              type="button"
              key={destination.id}
              className={cn(
                'sd-opt',
                selected.some((item) => item.id === destination.id) && 'is-on',
              )}
              onClick={() => updateSelection(destination)}
              aria-pressed={selected.some((item) => item.id === destination.id)}
            >
              {destination.destination}
            </button>
          ))}
        </div>
      </Panel>

      <div className="sd-chart-grid">
        <Panel
          title="Characteristics Radar"
          icon={RadarIcon}
          description="Tourist experience characteristics (0–100) from the demonstration dataset."
        >
          <LoadingState loading={loading} />
          <div className="sd-chart">
            <ResponsiveContainer width="100%" height={380}>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid />
                <PolarAngleAxis dataKey="trait" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tickCount={6} />
                {selected.map((destination, index) => (
                  <Radar
                    key={destination.id}
                    name={destination.destination}
                    dataKey={destination.destination}
                    stroke={PALETTE[index % PALETTE.length]}
                    fill={PALETTE[index % PALETTE.length]}
                    fillOpacity={0.08}
                    strokeWidth={2}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Pressure · Demand · Economic"
          icon={ChartColumn}
          description="Where tourism concentrates versus where economic value can grow."
        >
          <div className="sd-chart">
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="destination" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pressure" name="Tourism Pressure" fill="#dc4448" radius={[4, 4, 0, 0]} />
                <Bar dataKey="demand" name="Tourism Demand" fill="#d9910b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="economic" name="Economic Potential" fill="#0c7a64" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="sd-panel-note">
            Demonstration dataset values — not official statistics.
          </p>
        </Panel>
      </div>

      {source ? (
        <Panel
          title="Precomputed Sustainable Diversion Data"
          icon={Layers}
          description={`Model metrics from the Sustainable Diversion engine, keyed on ${source.destination} as the source.`}
        >
          <LoadingState loading={loading} />
          <ErrorState message={error ?? ''} />
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Alternative</th>
                  <th>Score</th>
                  <th>Similarity</th>
                  <th>Lower Pressure</th>
                  <th>Economic</th>
                  <th>Mobility</th>
                  <th>Gateway</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.target}>
                    <td>{row.target}</td>
                    <td>{row.score === null ? '—' : row.score.toFixed(2)}</td>
                    <td>{row.similarity === null ? '—' : row.similarity.toFixed(2)}</td>
                    <td>{row.lowerPressure === null ? '—' : row.lowerPressure.toFixed(2)}</td>
                    <td>{row.economic === null ? '—' : row.economic.toFixed(2)}</td>
                    <td>{row.mobility === null ? '—' : row.mobility.toFixed(2)}</td>
                    <td>{row.gateway || 'No direct rail'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sd-panel-note">
            Score = 0.35 similarity · 0.30 lower pressure · 0.20 economic ·
            0.15 sustainable mobility (precomputed, see Find Alternative).
          </p>
        </Panel>
      ) : null}
    </div>
  )
}