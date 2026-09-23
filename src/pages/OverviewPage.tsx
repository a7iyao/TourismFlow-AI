import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChartScatter,
  Gauge,
  Lightbulb,
  Map as MapIcon,
  Search,
  Sparkles,
  Sprout,
  TrainFront,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { KpiCard } from '../components/cards/KpiCard'
import { DataDisclaimer } from '../components/common/DataDisclaimer'
import { Panel } from '../components/common/Panel'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { PrototypeBadge } from '../components/common/PrototypeBadge'
import { TourismConcentrationMap } from '../components/map/TourismConcentrationMap'
import { PressureEconomicScatter } from '../components/charts/PressureEconomicScatter'
import { destinations } from '../data'
import { useAnalytics } from '../hooks/useAnalytics'
import {
  CROWDING_PREFERENCES,
  TOURIST_INTERESTS,
  rankSustainableRecommendations,
} from '../engine/sustainableRanking'
import type {
  CrowdingPreference,
  TouristInterest,
} from '../engine/sustainableRanking'
import { cn } from '../utils/cn'

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

const pillars = [
  {
    icon: TriangleAlert,
    tagClass: 'sd-hero-tag--problem',
    tag: 'The Problem',
    title: 'Tourism concentrates in a few popular destinations.',
    text: 'Most visitor flow lands in a handful of places, driving overcrowding, environmental strain and uneven economic benefit.',
  },
  {
    icon: Lightbulb,
    tagClass: 'sd-hero-tag--solution',
    tag: 'The Solution',
    title: 'SMART DESTINATION AI redirects demand.',
    text: 'It recommends similar destinations with lower tourism pressure, economic headroom and better rail-based access — so travellers keep the experience without the crowd.',
  },
  {
    icon: Sprout,
    tagClass: 'sd-hero-tag--impact',
    tag: 'The Impact',
    title: 'Balanced distribution and new opportunity.',
    text: 'More balanced tourism distribution, plus new economic opportunities for alternative and emerging destinations.',
  },
]

export function OverviewPage() {
  const navigate = useNavigate()
  const { diversion, tourismPressure, loading, error } = useAnalytics()

  const [currentId, setCurrentId] = useState('langkawi')
  const [selectedInterests, setSelectedInterests] = useState<TouristInterest[]>([
    'Beach',
    'Nature',
    'Culture',
  ])
  const [preference, setPreference] = useState<CrowdingPreference>('Low Crowding')

  const current = destinations.find((destination) => destination.id === currentId)
  const currentName = current?.destination ?? ''

  const toggleInterest = (interest: TouristInterest) => {
    setSelectedInterests((currentValue) =>
      currentValue.includes(interest)
        ? currentValue.filter((item) => item !== interest)
        : [...currentValue, interest],
    )
  }

  const ranked = (() => {
    if (!diversion) return []
    const destination = destinations.find(
      (item) => item.id === currentId,
    )
    if (!destination) return []
    return rankSustainableRecommendations(
      diversion.recommendations,
      destination.destination,
      selectedInterests,
      preference,
    )
  })()

  const topThree = ranked.slice(0, 3)

  const mapHighlightIds = [
    current?.id,
    ...topThree.map(
      (recommendation) =>
        destinations.find(
          (destination) => destination.destination === recommendation.destination,
        )?.id,
    ),
  ].filter((value): value is string => Boolean(value))

  const scatterHighlightIds = [currentName, ...topThree.map((item) => item.destination)]

  const mobilityFor = (name: string): number | null => {
    const rows = (diversion?.recommendations ?? []).filter(
      (recommendation) => recommendation.destination === name,
    )
    if (rows.length === 0) return null
    return Math.round(average(rows.map((row) => row.sustainableMobility)))
  }

  const snapshot = current
    ? [
        {
          id: 'demand',
          label: 'Tourism Demand',
          value: `${current.tourismDemand} / 100`,
          caption: `Demand for ${currentName} in the demonstration dataset.`,
          tone: 'concentration' as const,
          pending: false,
        },
        {
          id: 'pressure',
          label: 'Tourism Pressure',
          value: `${current.tourismPressure} / 100`,
          caption: `${current.crowdingLevel} crowding — demand concentrates where pressure is highest.`,
          tone: 'pressure' as const,
          pending: false,
        },
        {
          id: 'economic',
          label: 'Economic Potential',
          value: `${current.economicPotential} / 100`,
          caption: `Economic headroom that redistributing demand could unlock.`,
          tone: 'economic' as const,
          pending: false,
        },
        {
          id: 'mobility',
          label: 'Sustainable Mobility',
          value: mobilityFor(currentName) === null ? '—' : `${mobilityFor(currentName)} / 100`,
          caption:
            mobilityFor(currentName) === null
              ? `No precomputed diversion targets offer ${currentName}.`
              : `Mean mobility score across alternatives that offer ${currentName}.`,
          tone: 'alternative' as const,
          pending: false,
        },
      ]
    : []

  const highCrowdingShare = Math.round(
    (destinations.filter((d) => d.crowdingLevel === 'High').length /
      destinations.length) *
      100,
  )

  const heroStats = [
    { label: 'Destinations', value: `${destinations.length}` },
    { label: 'High crowding destinations', value: `${highCrowdingShare}%` },
    {
      label: 'Mean economic potential',
      value: `${Math.round(average(destinations.map((d) => d.economicPotential)))}/100`,
    },
    {
      label: 'Diversion pairs computed',
      value: diversion ? `${diversion.recommendations.length}` : '—',
    },
  ]

  return (
    <div className="page-stack">
      <section className="sd-hero-band">
        <div className="sd-hero-band-main">
          <div className="sd-hero-band-top">
            <span className="sd-hero-band-eyebrow">Malaysia Sustainable Tourism Intelligence</span>
            <PrototypeBadge />
          </div>
          <h1>
            Redirect tourism demand.
            <br />
            Discover less crowded destinations.
          </h1>
          <p>
            SMART DESTINATION AI is an AI-powered recommender that helps
            travellers find similar destinations with lower tourism pressure,
            economic headroom and better rail-based access — balancing tourism
            distribution across Malaysia.
          </p>
          <div className="sd-hero-band-ctas">
            <button
              type="button"
              className="sd-btn sd-btn--light"
              onClick={() => navigate('/find-alternative')}
            >
              <Sparkles size={16} />
              Find Alternative Destination
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="sd-btn sd-btn--light-ghost"
              onClick={() => navigate('/map')}
            >
              <MapIcon size={16} />
              Explore the Tourism Map
            </button>
          </div>
        </div>
        <div className="sd-hero-band-stats">
          {heroStats.map((stat) => (
            <div className="sd-hero-band-stat" key={stat.label}>
              <span className="sd-hero-band-stat-value">{stat.value}</span>
              <span className="sd-hero-band-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <DataDisclaimer />

      <Panel
        title="Try the recommender"
        icon={Search}
        description="Pick a current destination, your interests and a crowding preference. The KPIs, map and matrix below update live."
        note="This is a live demo of the same Sustainable Diversion engine used in Find Alternative. Nothing is sent anywhere — everything runs in your browser."
      >
        <LoadingState loading={loading} />
        <ErrorState message={error ?? ''} />

        <div className="sd-request-grid">
          <div className="sd-field">
            <label className="sd-field-label" htmlFor="overview-destination">
              Current destination
            </label>
            <select
              id="overview-destination"
              className="sd-select"
              value={currentId}
              onChange={(event) => setCurrentId(event.target.value)}
            >
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.destination} — {destination.state}
                </option>
              ))}
            </select>
          </div>

          <div className="sd-field">
            <span className="sd-field-label">Tourist interests</span>
            <div className="sd-opt-grid">
              {TOURIST_INTERESTS.map((interest) => (
                <button
                  type="button"
                  key={interest}
                  className={cn(
                    'sd-opt',
                    selectedInterests.includes(interest) && 'is-on',
                  )}
                  onClick={() => toggleInterest(interest)}
                  aria-pressed={selectedInterests.includes(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          <div className="sd-field">
            <span className="sd-field-label">Crowding preference</span>
            <div className="sd-opt-row">
              {CROWDING_PREFERENCES.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={cn(
                    'sd-opt',
                    preference === option && 'is-on',
                  )}
                  onClick={() => setPreference(option)}
                  aria-pressed={preference === option}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title={`Destination snapshot — ${current?.destination ?? 'Not found'}`}
        icon={Gauge}
        description={`Key indicators for ${currentName}, updated live from your selections.`}
      >
        <div className="sd-kpi-grid">
          {snapshot.map((kpi, index) => (
            <KpiCard
              key={kpi.id}
              data={kpi}
              icon={[Gauge, TriangleAlert, Wallet, TrainFront][index]}
            />
          ))}
        </div>
      </Panel>

      <div className="sd-cta-row">
        <div className="sd-cta-copy">
          <h2>Ready to explore alternatives?</h2>
          <p>
            See the full ranked list for {currentName}, re-ranked by your
            interests and crowding preference.
          </p>
        </div>
        <button
          type="button"
          className="sd-btn sd-btn--primary"
          onClick={() => navigate('/find-alternative')}
        >
          <Sparkles size={16} />
          Find Alternative Destination
          <ArrowRight size={16} />
        </button>
      </div>

      <Panel
        title="Where they are"
        icon={MapIcon}
        description="Your destination and its top alternatives on the map. Highlighted markers are enlarged."
        note="Marker colors use the demonstration tourism pressure index."
      >
        <LoadingState loading={loading} />
        <ErrorState message={error ?? ''} />
        <TourismConcentrationMap
          tourismPressure={tourismPressure}
          highlightIds={mapHighlightIds}
          height={420}
        />
      </Panel>

      <Panel
        title="Economic potential vs tourism pressure"
        icon={ChartScatter}
        description="Where each destination sits on the pressure–economic matrix. The recommended alternatives are highlighted."
        note="Quadrant boundaries use the medians of the demonstration dataset. Analytical categories only, not official classifications."
      >
        <LoadingState loading={loading} />
        <ErrorState message={error ?? ''} />
        {!loading ? (
          <PressureEconomicScatter highlightIds={scatterHighlightIds} />
        ) : null}
      </Panel>

      <Panel
        title="Why it matters"
        icon={Sprout}
        description="The three forces behind SMART DESTINATION AI."
      >
        <div className="sd-hero">
          {pillars.map((pillar) => (
            <div className="sd-hero-col" key={pillar.tag}>
              <span className={`sd-hero-tag ${pillar.tagClass}`}>
                <pillar.icon size={14} />
                {pillar.tag}
              </span>
              <h2>{pillar.title}</h2>
              <p>{pillar.text}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}