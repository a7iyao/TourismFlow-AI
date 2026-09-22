import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Layers, Map as MapIcon, MapPin } from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { Panel } from '../components/common/Panel'
import { destinations } from '../data'
import { useAnalytics } from '../hooks/useAnalytics'
import { latestPressureRow } from '../hooks/useAnalytics'
import type { Destination } from '../types/destination'
import type { TourismPressureRow } from '../types/analytics'

function pressureColor(pressure: number): string {
  if (pressure < 40) return '#0f9d6e'
  if (pressure <= 70) return '#d9910b'
  return '#dc4448'
}

function normalizeState(raw: string): string {
  const trimmed = raw.replace(/^W\.P\. /, '').trim()
  if (trimmed === 'Penang') return 'Pulau Pinang'
  return trimmed
}

function findStateRow(
  rows: TourismPressureRow[] | null,
  destination: Destination,
): TourismPressureRow | undefined {
  return latestPressureRow(rows, normalizeState(destination.state))
}

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
      >
        <div className="sd-map">
          <MapContainer
            center={[3.9, 109.5]}
            zoom={6}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {destinations.map((destination) => {
              const stateRow = findStateRow(tourismPressure, destination)
              const color = pressureColor(destination.tourismPressure)
              return (
                <CircleMarker
                  key={destination.id}
                  center={[destination.latitude, destination.longitude]}
                  radius={12}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.75, weight: 1.5 }}
                >
                  <Popup>
                    <div className="sd-popup">
                      <h4>{destination.destination}</h4>
                      <p className="sd-popup-state">{destination.state}</p>
                      <dl>
                        <div>
                          <dt>Tourism pressure</dt>
                          <dd>{destination.tourismPressure}/100</dd>
                        </div>
                        <div>
                          <dt>Crowding level</dt>
                          <dd>{destination.crowdingLevel}</dd>
                        </div>
                        <div>
                          <dt>Tourism demand</dt>
                          <dd>{destination.tourismDemand}/100</dd>
                        </div>
                        <div>
                          <dt>Economic potential</dt>
                          <dd>{destination.economicPotential}/100</dd>
                        </div>
                        <div>
                          <dt>State pressure index</dt>
                          <dd>
                            {stateRow
                              ? `${Math.round(stateRow.tourism_pressure_index)}/100 (${stateRow.pressure_band})`
                              : 'Not available'}
                          </dd>
                        </div>
                        <div>
                          <dt>Recommends alternatives</dt>
                          <dd>{destination.recommendationEligibility ? 'Yes' : 'Focus / origin only'}</dd>
                        </div>
                      </dl>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>
        <p className="sd-panel-note">
          <MapPin size={13} />
          Demonstration dataset locations. Marker color uses the destination
          pressure index; the popup also shows the state-level pressure index
          from the tourism ingredient file when the state matches.
        </p>
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