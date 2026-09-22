import { useMemo, useState } from 'react'
import { CircleCheck, Info, MessageSquare, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { Panel } from '../components/common/Panel'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { RailModelPanel } from '../components/recommendations/RailModelPanel'
import { destinations } from '../data'
import { useAnalytics } from '../hooks/useAnalytics'
import {
  defaultInterestsFor,
  rankSustainableRecommendations,
} from '../engine/sustainableRanking'

interface SystemInsight {
  title: string
  text: string
  drivers: string[]
}

export function AiInsightsPage() {
  const { diversion, railMetrics, loading, error } = useAnalytics()
  const [sourceId, setSourceId] = useState('langkawi')

  const source = destinations.find((d) => d.id === sourceId)
  const sourceName = source?.destination ?? ''

  const ranked = useMemo(() => {
    if (!diversion || !source) return []
    return rankSustainableRecommendations(
      diversion.recommendations,
      source.destination,
      defaultInterestsFor(source.destination),
      'Low Crowding',
    )
  }, [diversion, source])

  const systemInsights = useMemo<SystemInsight[]>(() => {
    const insights: SystemInsight[] = []
    if (!diversion) return insights

    const highest = destinations.reduce((a, b) =>
      b.tourismPressure > a.tourismPressure ? b : a,
    )
    const highestRec = diversion.recommendations.find(
      (rec) => rec.sourceDestination === highest.destination,
    )
    if (highestRec) {
      insights.push({
        title: 'Highest-pressure origin',
        drivers: [
          `Pressure ${highest.tourismPressure}/100`,
          `Top alternative scores ${Math.round(highestRec.score)}/100`,
          `Lower-pressure score ${Math.round(highestRec.lowerPressureScore)}/100`,
          highestRec.gatewayStation
            ? `Gateway ${highestRec.gatewayStation}`
            : 'No direct rail gateway',
        ],
        text: `${highest.destination} shows the highest destination pressure in the dataset (${highest.tourismPressure}/100). The diversion engine ranks ${highestRec.destination} first, with a lower-pressure score of ${Math.round(highestRec.lowerPressureScore)}/100 — a clear redistribution target${highestRec.gatewayStation ? ` reachable via ${highestRec.gatewayStation}` : ''}.`,
      })
    }

    const emerging = destinations
      .filter((d) => d.recommendationEligibility)
      .sort((a, b) => a.tourismPressure - b.tourismPressure)
      .slice(0, 3)
      .reduce((a, b) => (b.economicPotential > a.economicPotential ? b : a))
    if (emerging) {
      insights.push({
        title: 'Emerging opportunity',
        drivers: [
          `Pressure ${emerging.tourismPressure}/100`,
          `Economic potential ${emerging.economicPotential}/100`,
          emerging.crowdingLevel === 'Low' ? 'Low crowding level' : `${emerging.crowdingLevel} crowding`,
        ],
        text: `${emerging.destination} ranks among the least pressured destinations (${emerging.tourismPressure}/100) while offering meaningful economic potential (${emerging.economicPotential}/100). It is well positioned to absorb redirected demand sustainably.`,
      })
    }

    return insights
  }, [diversion])

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Intelligence"
        title="AI Insights"
        description="Deterministic, data-driven narratives that explain why destinations are recommended. Every claim maps to a displayed number — no generated text."
      />

      <Panel
        title="System Insights"
        icon={Sparkles}
        description="Generated from the loaded analytics artifacts whenever data is available."
      >
        <LoadingState loading={loading} />
        <ErrorState message={error ?? ''} />
        {systemInsights.map((insight) => (
          <div className="sd-insight" key={insight.title}>
            <span className="sd-insight-tag">
              <MessageSquare size={13} />
              {insight.title}
            </span>
            <p>{insight.text}</p>
            <div className="sd-insight-why">
              {insight.drivers.map((driver) => (
                <div key={driver}>
                  <CircleCheck size={15} strokeWidth={2.4} />
                  {driver}
                </div>
              ))}
            </div>
          </div>
        ))}
      </Panel>

      <Panel
        title="Scenario Narratives"
        icon={Sparkles}
        description="Pick an origin destination to see why its top alternatives are recommended."
      >
        <LoadingState loading={loading} />
        <div className="sd-field">
          <label className="sd-field-label" htmlFor="insight-destination">
            Origin destination
          </label>
          <select
            id="insight-destination"
            className="sd-select"
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
          >
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.destination}
              </option>
            ))}
          </select>
        </div>
        <div className="sd-insight-stack">
          {ranked.slice(0, 3).map((rec, index) => (
            <div className="sd-insight" key={rec.destination}>
              <span className="sd-insight-tag">
                <MessageSquare size={13} />
                #{index + 1} {sourceName} → {rec.destination}
              </span>
              <p>{rec.explanation}</p>
              <div className="sd-insight-why">
                <div>
                  <CircleCheck size={15} strokeWidth={2.4} />
                  Similarity {Math.round(rec.similarity)}/100
                </div>
                <div>
                  <CircleCheck size={15} strokeWidth={2.4} />
                  Lower pressure {Math.round(rec.lowerPressureScore)}/100
                </div>
                <div>
                  <CircleCheck size={15} strokeWidth={2.4} />
                  Economic {Math.round(rec.economicOpportunity)}/100
                </div>
                <div>
                  <CircleCheck size={15} strokeWidth={2.4} />
                  Mobility {Math.round(rec.sustainableMobility)}/100
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {railMetrics ? <RailModelPanel metrics={railMetrics} /> : null}

      <Panel
        title="How Insights Stay Honest"
        icon={Info}
        description="Every generated claim references a measurable factor so the system can justify its recommendations."
      >
        <div className="sd-check-list">
          <div className="sd-check-item">
            <span className="sd-check-icon">
              <CircleCheck size={15} strokeWidth={2.2} />
            </span>
            <div>
              <h4>Explainable by construction</h4>
              <p>
                Insights are composed from the same precomputed metrics used to
                rank alternatives, so a human can verify each statement.
              </p>
            </div>
          </div>
          <div className="sd-check-item">
            <span className="sd-check-icon">
              <Info size={15} strokeWidth={2.2} />
            </span>
            <div>
              <h4>No hallucinated claims</h4>
              <p>
                Narratives only reference values that exist in the loaded
                artifacts. If an artifact is missing, the related insight is
                omitted rather than invented.
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}