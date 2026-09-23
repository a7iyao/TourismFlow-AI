import { ChartScatter, Gauge, Target } from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { Panel } from '../components/common/Panel'
import { PressureEconomicScatter } from '../components/charts/PressureEconomicScatter'
import { quadrantKeyOf } from '../utils/quadrants'
import type { QuadrantKey } from '../utils/quadrants'
import { destinations } from '../data'

const quadrants: {
  key: QuadrantKey
  className: string
  tag: string
  title: string
  text: string
}[] = [
  {
    key: 'opportunity',
    className: 'sd-quadrant--opportunity',
    tag: 'Low Pressure + High Potential',
    title: 'Opportunity Destinations',
    text: 'Ready to absorb more demand and convert it into sustainable economic value.',
  },
  {
    key: 'established',
    className: 'sd-quadrant--established',
    tag: 'High Pressure + High Potential',
    title: 'Established Destinations',
    text: 'Popular and valuable, but at risk of overcrowding. Prime candidates for demand redistribution.',
  },
  {
    key: 'emerging',
    className: 'sd-quadrant--emerging',
    tag: 'Low Pressure + Low Potential',
    title: 'Emerging Destinations',
    text: 'Early-stage destinations that could grow with targeted support and visibility.',
  },
  {
    key: 'risk',
    className: 'sd-quadrant--risk',
    tag: 'High Pressure + Low Potential',
    title: 'Pressure Risk',
    text: 'Under-managed demand with limited economic return — needs careful management.',
  },
]

const data = destinations.map((destination) => ({
  name: destination.destination,
  quadrant: quadrantKeyOf(
    destination.tourismPressure,
    destination.economicPotential,
  ),
}))

const categoryCounts = data.reduce<Record<QuadrantKey, number>>(
  (counts, point) => {
    counts[point.quadrant] = (counts[point.quadrant] ?? 0) + 1
    return counts
  },
  { opportunity: 0, established: 0, emerging: 0, risk: 0 },
)

export function EconomicPotentialPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Analytics"
        title="Economic Potential vs Tourism Pressure"
        description="Position every destination on a matrix of tourism pressure against economic potential, classified into four strategic categories."
      />

      <Panel
        title="Economic Potential Matrix"
        icon={ChartScatter}
        description="Tourism pressure on the horizontal axis, economic potential on the vertical axis. Hover a bubble to inspect it."
        note="Quadrant boundaries use the medians of the demonstration dataset. Analytical categories only, not official classifications."
      >
        <PressureEconomicScatter />
      </Panel>

      <Panel
        title="Strategic Categories"
        icon={Target}
        description="The matrix groups destinations into four analytical categories."
        note="These labels are analytical categories for the prototype, not official classifications."
      >
        <div className="sd-quadrant-grid">
          {quadrants.map((quadrant) => (
            <div className={`sd-quadrant ${quadrant.className}`} key={quadrant.key}>
              <span className="sd-quadrant-tag">{quadrant.tag}</span>
              <h4>
                {quadrant.title} <em className="sd-count">({categoryCounts[quadrant.key]})</em>
              </h4>
              <div className="sd-quadrant-names">
                {data
                  .filter((point) => point.quadrant === quadrant.key)
                  .map((point) => (
                    <span className="sd-chip" key={point.name}>
                      {point.name}
                    </span>
                  ))}
              </div>
              <p>{quadrant.text}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Reading the Matrix"
        icon={Gauge}
        description="What the visualization is designed to reveal."
      >
        <div className="sd-check-list">
          <div className="sd-check-item">
            <span className="sd-check-icon">
              <Gauge size={15} strokeWidth={2.2} />
            </span>
            <div>
              <h4>Pressure axis</h4>
              <p>
                Horizontal position shows how concentrated tourism demand is
                relative to the rest of the dataset.
              </p>
            </div>
          </div>
          <div className="sd-check-item">
            <span className="sd-check-icon">
              <Target size={15} strokeWidth={2.2} />
            </span>
            <div>
              <h4>Opportunity axis</h4>
              <p>
                Vertical position shows the economic potential available to be
                unlocked by redistributing demand.
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}