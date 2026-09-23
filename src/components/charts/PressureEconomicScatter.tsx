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
import { destinations } from '../../data'
import {
  MEDIAN_ECONOMIC,
  MEDIAN_PRESSURE,
  QUADRANT_COLOR,
  quadrantKeyOf,
} from '../../utils/quadrants'

interface PressureEconomicScatterProps {
  highlightIds?: string[]
}

export function PressureEconomicScatter({ highlightIds = [] }: PressureEconomicScatterProps) {
  const highlightSet = new Set(highlightIds)

  const data = destinations.map((destination) => {
    const point = {
      name: destination.destination,
      pressure: destination.tourismPressure,
      economic: destination.economicPotential,
      crowding: destination.crowdingLevel,
    }
    return { ...point, quadrant: quadrantKeyOf(point.pressure, point.economic) }
  })

  return (
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
            {data.map((point) => {
              const highlighted = highlightSet.has(point.name)
              return (
                <Cell
                  key={point.name}
                  fill={QUADRANT_COLOR[point.quadrant]}
                  opacity={highlighted ? 1 : 0.55}
                />
              )
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
