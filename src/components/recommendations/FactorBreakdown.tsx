import { EqualApproximately } from 'lucide-react'
import {
  RECOMMENDATION_FACTORS,
  TOTAL_FACTOR_WEIGHT,
} from '../../engine'
import { Panel } from '../common/Panel'

export function FactorBreakdown() {
  return (
    <Panel
      title="Transparent Scoring Model"
      icon={EqualApproximately}
      description="How alternative destinations are ranked. Weights are explicit so every recommendation can be explained."
    >
      {RECOMMENDATION_FACTORS.map((factor) => (
        <div className="sd-factor" key={factor.key}>
          <div className="sd-factor-meta">
            <h5>{factor.label}</h5>
            <p>{factor.description}</p>
          </div>
          <div
            className="sd-factor-track"
            role="img"
            aria-label={`${factor.label} weight ${Math.round(
              factor.weight * 100,
            )} percent`}
          >
            <div
              className="sd-factor-fill"
              style={{ width: `${factor.weight * 100}%` }}
            />
          </div>
          <span className="sd-factor-weight">
            {Math.round(factor.weight * 100)}%
          </span>
        </div>
      ))}
      <div className="sd-sum-note">
        <span>Weights sum to a normalized score of</span>
        <strong>{Math.round(TOTAL_FACTOR_WEIGHT * 100)}%</strong>
      </div>
    </Panel>
  )
}