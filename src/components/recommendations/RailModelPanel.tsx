import { Activity, Database, TrendingUp, TriangleAlert } from 'lucide-react'
import { Panel } from '../common/Panel'
import type { RailModelMetrics } from '../../types/analytics'

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('en-MY', {
    maximumFractionDigits: digits,
  }).format(value)
}

/**
 * Displays the precomputed KTMB ridership forecast model metrics (from the
 * Layer 4 rail demand pipeline). Purely a reporting surface — it never runs
 * or modifies the model.
 */
export function RailModelPanel({ metrics }: { metrics: RailModelMetrics }) {
  const thresholds = metrics.congestion_bands.thresholds_by_service
  const serviceNames = Object.keys(thresholds)

  return (
    <Panel
      title="Rail Demand Forecast Model (Layer 4)"
      icon={Activity}
      description="Transparent reporting of the precomputed KTMB ridership model. The frontend only reads the saved artifacts."
    >
      <div className="sd-metric-row">
        <div className="sd-metric">
          <span className="sd-metric-label">Model</span>
          <span className="sd-metric-value">{metrics.model}</span>
          <span className="sd-metric-sub">{metrics.analytical_category}</span>
        </div>
        <div className="sd-metric">
          <span className="sd-metric-label">Strict time split</span>
          <span className="sd-metric-value">
            {metrics.train_period[0]} → {metrics.train_period[1]}
          </span>
          <span className="sd-metric-sub">
            train {formatNumber(metrics.train_rows, 0)} rows
          </span>
        </div>
        <div className="sd-metric">
          <span className="sd-metric-label">Test window</span>
          <span className="sd-metric-value">
            {metrics.test_period[0]} → {metrics.test_period[1]}
          </span>
          <span className="sd-metric-sub">
            test {formatNumber(metrics.test_rows, 0)} rows
          </span>
        </div>
      </div>

      <div className="sd-metric-row">
        <div className="sd-metric">
          <span className="sd-metric-label">MAE</span>
          <span className="sd-metric-value">{formatNumber(metrics.metrics.mae, 4)}</span>
          <span className="sd-metric-sub">
            vs baseline {formatNumber(metrics.baseline.mae, 4)} ({metrics.baseline.name})
          </span>
        </div>
        <div className="sd-metric">
          <span className="sd-metric-label">RMSE</span>
          <span className="sd-metric-value">{formatNumber(metrics.metrics.rmse, 4)}</span>
        </div>
        <div className="sd-metric">
          <span className="sd-metric-label">R²</span>
          <span className="sd-metric-value">{formatNumber(metrics.metrics.r2, 4)}</span>
        </div>
        <div className="sd-metric">
          <span className="sd-metric-label">MAE improvement</span>
          <span className="sd-metric-value">
            {formatNumber(metrics.mae_improvement.percent, 2)}%
          </span>
          <span className="sd-metric-sub">
            absolute {formatNumber(metrics.mae_improvement.absolute, 4)}
          </span>
        </div>
      </div>

      <div className="sd-model-verdict">
        {metrics.model_retained_against_baseline ? (
          <span className="sd-verdict-chip sd-verdict-chip--ok">
            <TrendingUp size={13} />
            Model retained against baseline
          </span>
        ) : (
          <span className="sd-verdict-chip sd-verdict-chip--warn">
            <TriangleAlert size={13} />
            Model not retained against baseline
          </span>
        )}
        <span className="sd-verdict-note">{metrics.retention_rule.description}</span>
      </div>

      <div className="sd-threshold-block">
        <div className="sd-scorebar-meta">
          <span className="sd-scorebar-label">Predicted ridership congestion thresholds</span>
        </div>
        <div className="sd-service-grid">
          {serviceNames.map((service) => {
            const band = thresholds[service]
            const raw = band as {
              p60_threshold: number
              p85_threshold: number
              maximum_predicted_ridership: number
            }
            return (
              <div className="sd-service-card" key={service}>
                <h4>{service}</h4>
                <p>
                  LOW ≤ {formatNumber(raw.p60_threshold, 2)} · MODERATE ≤{' '}
                  {formatNumber(raw.p85_threshold, 2)} · HIGH &gt;{' '}
                  {formatNumber(raw.p85_threshold, 2)} passengers
                </p>
                <p>Model peak {formatNumber(raw.maximum_predicted_ridership, 2)}</p>
              </div>
            )
          })}
        </div>
        <p className="sd-panel-note">
          <Database size={13} />
          {metrics.congestion_bands.note}
        </p>
      </div>

      <div className="sd-features-row">
        <span className="sd-scorebar-label">Features used</span>
        <div className="sd-chip-row">
          {metrics.features.map((feature) => (
            <span className="sd-chip" key={feature}>
              {feature}
            </span>
          ))}
        </div>
        <p className="sd-panel-note">
          <TriangleAlert size={13} />
          {metrics.public_holiday_feature}
        </p>
      </div>
    </Panel>
  )
}