import { EqualApproximately } from 'lucide-react'
import { Panel } from '../common/Panel'
import type { SustainableDiversionData } from '../../types/analytics'

interface DiversionModelWeightsProps {
  data: SustainableDiversionData
}

const FACTOR_LABELS: Record<string, string> = {
  similarity: 'Destination similarity',
  lower_pressure: 'Lower tourism pressure',
  economic_opportunity: 'Economic opportunity',
  sustainable_mobility: 'Sustainable mobility',
}

/**
 * Explains the precomputed Sustainable Diversion model weights and the
 * client-side re-ranking layer. Every number shown here is read from the
 * loaded artifact metadata — nothing is hardcoded.
 */
export function DiversionModelWeights({ data }: DiversionModelWeightsProps) {
  const weights = data.metadata.scoreWeights

  return (
    <Panel
      title="Transparent Scoring Model"
      icon={EqualApproximately}
      description="How alternatives are ranked. The precomputed engine score stays authoritative; interests and crowding preference nudge the order."
    >
      {Object.entries(weights).map(([key, weight]) => (
        <div className="sd-factor" key={key}>
          <div className="sd-factor-meta">
            <h5>{FACTOR_LABELS[key] ?? key}</h5>
          </div>
          <div
            className="sd-factor-track"
            role="img"
            aria-label={`${FACTOR_LABELS[key] ?? key} weight ${Math.round(weight * 100)} percent`}
          >
            <div
              className="sd-factor-fill"
              style={{ width: `${weight * 100}%` }}
            />
          </div>
          <span className="sd-factor-weight">{Math.round(weight * 100)}%</span>
        </div>
      ))}
      <div className="sd-sum-note">
        <span>Model weights sum to</span>
        <strong>
          {Math.round(
            Object.values(weights).reduce((sum, weight) => sum + weight, 0) *
              100,
          )}
          %
        </strong>
      </div>
      <p className="sd-panel-note">
        When you select interests and a crowding preference, the list is
        re-sorted in the browser as 70% model score · 20% crowding tilt · 10%
        interest fit. The original model score stays visible on every card.
      </p>
    </Panel>
  )
}