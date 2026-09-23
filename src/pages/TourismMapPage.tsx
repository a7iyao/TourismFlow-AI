import { Layers, Map as MapIcon } from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { Panel } from '../components/common/Panel'
import { TourismConcentrationMap } from '../components/map/TourismConcentrationMap'
import { destinations } from '../data'
import { useAnalytics } from '../hooks/useAnalytics'

export function TourismMapPage() {
  const { tourismPressure } = useAnalytics()

  const bands = {
    low: destinations.filter((d) => d.tourismPressure < 40).length,
    moderate: destinations.filter(
      (d) => d.tourismPressure >= 40 && d.tourismPressure <= 70,
    ).length,
    high: destinations.filter((d) => d.tourismPressure > 70).length,
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Geospatial"
        title="Malaysia Tourism Concentration Map"
        description="Destination markers colored by tourism pressure. Click a marker for its full snapshot."
      />

      <Panel
        title="Interactive Tourism Concentration Map"
        icon={MapIcon}
        description="Markers are colored by the demonstration destination pressure index."
        note="Demonstration dataset locations. Marker color uses the destination pressure index; the popup also shows the state-level pressure index from the tourism ingredient file when the state matches."
      >
        <TourismConcentrationMap tourismPressure={tourismPressure} />
      </Panel>

      <Panel
        title="Pressure Legend"
        icon={Layers}
        description="Marker color represents tourism pressure at each destination."
      >
        <div className="sd-legend">
          <span className="sd-legend-item">
            <span className="sd-legend-dot sd-legend-dot--low" />
            Low — {bands.low} destinations
          </span>
          <span className="sd-legend-item">
            <span className="sd-legend-dot sd-legend-dot--mod" />
            Moderate — {bands.moderate} destinations
          </span>
          <span className="sd-legend-item">
            <span className="sd-legend-dot sd-legend-dot--high" />
            High — {bands.high} destinations
          </span>
        </div>
      </Panel>
    </div>
  )
}