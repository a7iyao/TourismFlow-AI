import {
  ArrowLeftRight,
  ChartColumn,
  Compass,
  Database,
  Gauge,
  LayoutGrid,
  Lightbulb,
  Map,
  Search,
  Sprout,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { KpiCard } from '../components/cards/KpiCard'
import { DataDisclaimer } from '../components/common/DataDisclaimer'
import { PageHeader } from '../components/common/PageHeader'
import { Panel } from '../components/common/Panel'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { RailModelPanel } from '../components/recommendations/RailModelPanel'
import { useAnalytics } from '../hooks/useAnalytics'
import { destinations } from '../data'
import { ScoreBar } from '../components/recommendations/ScoreBar'

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

const capabilities = [
  {
    icon: Search,
    title: 'Find Alternative Destination',
    text: 'Ranked similar destinations with lower tourism pressure and economic headroom.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Destination Comparison',
    text: 'Compare destinations across pressure, demand, economic potential and interests.',
  },
  {
    icon: Map,
    title: 'Tourism Concentration Map',
    text: 'Explore Malaysian destinations with markers colored by tourism pressure.',
  },
  {
    icon: TrendingUp,
    title: 'Economic Potential vs Tourism Pressure',
    text: 'Position destinations in strategic categories to spot opportunity and risk.',
  },
]

export function OverviewPage() {
  const { diversion, railMetrics, tourismPressure, loading, error } = useAnalytics()

  const latestRows = (tourismPressure ?? []).filter((row) => row.year === 2023)
  const meanPressureIndex = latestRows.length
    ? average(latestRows.map((row) => row.tourism_pressure_index))
    : null
  const topPressureStates = [...latestRows]
    .sort((a, b) => b.tourism_pressure_index - a.tourism_pressure_index)
    .slice(0, 5)

  const highCrowdingShare = destinations.filter(
    (destination) => destination.crowdingLevel === 'High',
  ).length
  const eligibleCount = destinations.filter(
    (destination) => destination.recommendationEligibility,
  ).length

  const kpis = [
    {
      id: 'pressure',
      label: 'State Tourism Pressure',
      value: meanPressureIndex === null ? '—' : `${Math.round(meanPressureIndex)} / 100`,
      caption:
        'Mean state-level tourism pressure index, latest year (2023) from the state tourism ingredient file.',
      tone: 'pressure' as const,
      pending: meanPressureIndex === null,
    },
    {
      id: 'concentration',
      label: 'Demand Concentration',
      value: `${Math.round((highCrowdingShare / destinations.length) * 100)}%`,
      caption:
        'Share of destinations running at a high crowding level — where demand concentrates most.',
      tone: 'concentration' as const,
      pending: false,
    },
    {
      id: 'economic',
      label: 'Mean Economic Potential',
      value: `${Math.round(average(destinations.map((d) => d.economicPotential)))} / 100`,
      caption:
        'Mean economic potential across all destinations in the demonstration dataset.',
      tone: 'economic' as const,
      pending: false,
    },
    {
      id: 'alternatives',
      label: 'Diversion Pairs Computed',
      value: diversion
        ? `${diversion.recommendations.length}`
        : '—',
      caption:
        'Precomputed sustainable alternative recommendations across all source destinations.',
      tone: 'alternative' as const,
      pending: diversion === null,
    },
  ]

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Command Center"
        title="Overview"
        description="Redirect tourism demand. Discover sustainable alternatives driven by precomputed analytics."
      />

      <div className="sd-hero">
        <div className="sd-hero-col">
          <span className="sd-hero-tag sd-hero-tag--problem">
            <TriangleAlert size={14} />
            The Problem
          </span>
          <h2>Tourism concentrates heavily in popular destinations.</h2>
          <p>
            A few destinations absorb most visitor flow, driving overcrowding,
            environmental strain and uneven economic benefit across the country.
          </p>
        </div>
        <div className="sd-hero-col">
          <span className="sd-hero-tag sd-hero-tag--solution">
            <Lightbulb size={14} />
            The Solution
          </span>
          <h2>SMART DESTINATION AI redirects demand.</h2>
          <p>
            The platform recommends similar destinations with lower tourism
            pressure, economic headroom and better rail-based access — so
            travellers keep the experience without the crowd.
          </p>
        </div>
        <div className="sd-hero-col">
          <span className="sd-hero-tag sd-hero-tag--impact">
            <Sprout size={14} />
            The Impact
          </span>
          <h2>Balanced distribution and new opportunities.</h2>
          <p>
            More balanced tourism distribution plus new economic opportunities
            for alternative and emerging destinations.
          </p>
        </div>
      </div>

      <div className="sd-kpi-grid">
        {kpis.map((kpi, index) => (
          <KpiCard
            key={kpi.id}
            data={kpi}
            icon={[Gauge, ChartColumn, Wallet, Compass][index]}
          />
        ))}
      </div>

      <Panel
        title="Tourism Pressure by State"
        icon={Gauge}
        description="Latest-year state-level tourism pressure index from the state ingredient file. Higher means more visitors per resident capacity."
        note="State-level analytical index from the provided tourism ingredient dataset, not an official classification."
      >
        <LoadingState loading={loading} />
        <ErrorState message={error ?? ''} />
        {topPressureStates.map((row) => (
          <ScoreBar
            key={row.state}
            label={row.state}
            value={row.tourism_pressure_index}
            hint={`${row.pressure_band}`}
            highlighted={row.pressure_band === 'MODERATE'}
          />
        ))}
      </Panel>

      <Panel
        title="Competition Capabilities"
        icon={LayoutGrid}
        description="The four required capabilities this dashboard demonstrates."
      >
        <div className="sd-capability-grid sd-check-list">
          {capabilities.map((item) => (
            <div className="sd-check-item" key={item.title}>
              <span className="sd-check-icon">
                <item.icon size={15} strokeWidth={2.2} />
              </span>
              <div>
                <h4>{item.title}</h4>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {railMetrics ? <RailModelPanel metrics={railMetrics} /> : null}

      <Panel
        title="Data & Methodology"
        icon={Database}
        description="Data transparency for the prototype. The architecture is designed to integrate official tourism, economic and environmental datasets."
      >
        <DataDisclaimer />
        <p
          style={{
            fontSize: 13.5,
            color: 'var(--sd-c-ink-2)',
            margin: '14px 0',
          }}
        >
          Alternatives are ranked by a precomputed Sustainable Diversion model
          over demonstration data, with strict time-based train/test splits for
          the rail forecast. No generated value is presented as an official
          government statistic. {eligibleCount} of {destinations.length}{' '}
          destinations are eligible for recommendation.
        </p>
      </Panel>
    </div>
  )
}