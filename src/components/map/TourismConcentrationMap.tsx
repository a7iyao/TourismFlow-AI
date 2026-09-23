import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { destinations } from '../../data'
import { latestPressureRow } from '../../hooks/useAnalytics'
import type { Destination } from '../../types/destination'
import type { TourismPressureRow } from '../../types/analytics'

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

interface TourismConcentrationMapProps {
  tourismPressure: TourismPressureRow[] | null
  highlightIds?: string[]
  height?: number | string
}

export function TourismConcentrationMap({
  tourismPressure,
  highlightIds = [],
  height = '100%',
}: TourismConcentrationMapProps) {
  const highlightSet = new Set(highlightIds)

  return (
    <div className="sd-map" style={{ height }}>
      <MapContainer
        center={[3.9, 109.5]}
        zoom={6}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; <a href=&quot;https://www.openstreetmap.org/copyright&quot;>OpenStreetMap</a> contributors"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {destinations.map((destination) => {
          const stateRow = findStateRow(tourismPressure, destination)
          const highlighted = highlightSet.has(destination.id)
          const color = pressureColor(destination.tourismPressure)
          const radius = highlighted ? 17 : 12
          const weight = highlighted ? 3 : 1.5
          return (
            <CircleMarker
              key={destination.id}
              center={[destination.latitude, destination.longitude]}
              radius={radius}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.75, weight }}
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
                    {highlighted ? (
                      <div>
                        <dt>Status</dt>
                        <dd>Highlighted</dd>
                      </div>
                    ) : null}
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
  )
}
