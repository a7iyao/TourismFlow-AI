import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartScatter, Gauge, Target } from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { Panel } from '../components/common/Panel'
import { destinations } from '../data'

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

const MEDIAN_PRESSURE = median(destinations.map((d) => d.tourismPressure))
const MEDIAN_ECONOMIC = median(destinations.map((d) => d.economicPotential))

type QuadrantKey = 'opportunity' | 'established' | 'emerging' | 'risk'

function quadrantKeyOf(pressure: number, economic: number): QuadrantKey {
  if (economic >= MEDIAN_ECONOMIC && pressure < MEDIAN_PRESSURE) return 'opportunity'
  if (economic >= MEDIAN_ECONOMIC && pressure >= MEDIAN_PRESSURE) return 'established'
  if (economic < MEDIAN_ECONOMIC && pressure < MEDIAN_PRESSURE) return 'emerging'
  return 'risk'
}

const QUADRANT_COLOR: Record<QuadrantKey, string> = {
  opportunity: '#13a08a',
  established: '#3b82f6',
  emerging: '#d9910b',
  risk: '#dc4448',
}

const quadrants = [
  {
    key: 'opportunity' as const,
    className: 'sd-quadrant--opportunity',
    tag: 'Low Pressure + High Potential',
    title: 'Opportunity Destinations',
    text: 'Ready to absorb more demand and convert it into sustainable economic value.',
  },
  {
    key: 'established' as const,
    className: 'sd-quadrant--established',
    tag: 'High Pressure + High Potential',
    title: 'Established Destinations',
    text: 'Popular and valuable, but at risk of overcrowding. Prime candidates for demand redistribution.',
  },
  {
    key: 'emerging' as const,
    className: 'sd-quadrant--emerging',
    tag: 'Low Pressure + Low Potential',
    title: 'Emerging Destinations',
    text: 'Early-stage destinations that could grow with targeted support and visibility.',
  },
  {
    key: 'risk' as const,
    className: 'sd-quadrant--risk',
    tag: 'High Pressure + Low Potential',
    title: 'Pressure Risk',
    text: 'Under-managed demand with limited economic return — needs careful management.',
  },
]

const data = destinations.map((destination) => {
  const point = {
    name: destination.destination,
    pressure: destination.tourismPressure,
    economic: destination.economicPotential,
    crowding: destination.crowdingLevel,
  }
  return { ...point, quadrant: quadrantKeyOf(point.pressure, point.economic) }
})

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
        <div className="sd-chart">
          <ResponsiveContainer width="100%" height={440}>
            <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="pressure"
                name="Tourism Pressure"
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                label={{ value: 'Tourism Pressure', position: 'insideBottom', offset: -6, fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="economic"
                name="Economic Potential"
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                label={{ value: 'Economic Potential', angle: -90, position: 'insideLeft', fontSize: 12 }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value, name) => [
                  `${value == null ? '—' : `${value}/100`}`,
                  String(name),
                ]}
              />
              <ReferenceLine
                x={MEDIAN_PRESSURE}
                stroke="#6b7c84"
                strokeDasharray="4 4"
                label={{ value: 'median pressure', fontSize: 11, fill: '#6b7c84', position: 'insideTopRight' }}
              />
              <ReferenceLine
                y={MEDIAN_ECONOMIC}
                stroke="#6b7c84"
                strokeDasharray="4 4"
                label={{ value: 'median economic', fontSize: 11, fill: '#6b7c84', position: 'insideTopRight' }}
              />
              <Scatter data={data} name="Destinations">
                {data.map((point) => (
                  <Cell
                    key={point.name}
                    fill={QUADRANT_COLOR[point.quadrant]}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
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