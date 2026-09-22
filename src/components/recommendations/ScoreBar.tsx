import { cn } from '../../utils/cn'

interface ScoreBarProps {
  label: string
  value: number
  hint?: string
  highlighted?: boolean
}

/**
 * A transparent 0–100 score bar used across recommendation and analysis cards.
 * The numeric value is always shown alongside the bar so no score is implied.
 */
export function ScoreBar({ label, value, hint, highlighted }: ScoreBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={cn('sd-scorebar', highlighted && 'sd-scorebar--hl')}>
      <div className="sd-scorebar-meta">
        <span className="sd-scorebar-label">{label}</span>
        <span className="sd-scorebar-value">
          {Math.round(clamped)}
          {hint ? <small> {hint}</small> : null}
        </span>
      </div>
      <div className="sd-scorebar-track" role="img" aria-label={`${label} ${Math.round(clamped)} of 100`}>
        <div className="sd-scorebar-fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}