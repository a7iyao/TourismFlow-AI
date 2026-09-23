import {
  ArrowLeftRight,
  MapPin,
  Route,
  TrainFront,
} from 'lucide-react'
import { LabelValue } from './LabelValue'
import { ScoreBar } from './ScoreBar'
import type { RankedRecommendation } from '../../engine/sustainableRanking'

interface RecommendationCardProps {
  rank: number
  recommendation: RankedRecommendation
  onCompare: (destination: string) => void
  onViewMap?: () => void
}

function formatChip(value: number | null): string {
  return value === null
    ? 'Not available'
    : `${value <= 49 ? 'Limited' : value <= 84 ? 'Partial' : 'Strong'} rail access (${Math.round(value)}/100)`
}

export function RecommendationCard({
  rank,
  recommendation,
  onCompare,
  onViewMap,
}: RecommendationCardProps) {
  const {
    destination,
    state,
    displayScore,
    score,
    similarity,
    lowerPressureScore,
    economicOpportunity,
    sustainableMobility,
    railAccessibility,
    railCongestion,
    gatewayStation,
    matchedInterests,
    explanation,
    interestFit,
  } = recommendation

  return (
    <article className="sd-rec-card">
      <div className="sd-rec-top">
        <span className="sd-rec-rank">#{rank}</span>
        <div className="sd-rec-title">
          <h4>
            {destination}
            <span className="sd-rec-state">{state}</span>
          </h4>
        </div>
        <div className="sd-rec-score">
          <span className="sd-rec-score-value">{Math.round(displayScore)}</span>
          <span className="sd-rec-score-label">display score</span>
        </div>
      </div>

      <p className="sd-rec-explanation">{explanation}</p>

      {interestFit > 0 ? (
        <div className="sd-rec-chips">
          <span className="sd-chip sd-chip--interest">Interest fit {Math.round(interestFit)}/100</span>
          {matchedInterests.slice(0, 4).map((interest) => (
            <span className="sd-chip" key={interest}>
              {interest}
            </span>
          ))}
        </div>
      ) : null}

      <div className="sd-rec-bars">
        <ScoreBar label="Destination similarity" value={similarity} />
        <ScoreBar label="Lower tourism pressure" value={lowerPressureScore} />
        <ScoreBar label="Economic opportunity" value={economicOpportunity} />
        <ScoreBar label="Sustainable mobility" value={sustainableMobility} />
      </div>

      <div className="sd-rec-meta">
        <LabelValue
          icon={Route}
          label="Sustainable Diversion Score"
          value={`${Math.round(score)}/100 (precomputed model)`}
        />
        <LabelValue
          icon={TrainFront}
          label="Nearest gateway"
          value={gatewayStation || 'No direct rail gateway'}
        />
        <LabelValue icon={MapPin} label="Rail accessibility" value={formatChip(railAccessibility)} />
        <LabelValue
          icon={TrainFront}
          label="Gateway congestion"
          value={railCongestion === null ? 'No rail forecast at gateway' : `${Math.round(railCongestion)}/100`}
        />
      </div>

      <div className="sd-rec-actions">
        {onViewMap ? (
          <button
            type="button"
            className="sd-btn sd-btn--ghost"
            onClick={onViewMap}
          >
            <MapPin size={15} />
            View on Map
          </button>
        ) : null}
        <button
          type="button"
          className="sd-btn sd-btn--ghost"
          onClick={() => onCompare(destination)}
        >
          <ArrowLeftRight size={15} />
          Compare
        </button>
      </div>
    </article>
  )
}