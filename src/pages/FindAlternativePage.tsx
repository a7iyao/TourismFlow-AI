import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrainFront,
} from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { Panel } from '../components/common/Panel'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { RecommendationCard } from '../components/recommendations/RecommendationCard'
import { DiversionModelWeights } from '../components/recommendations/DiversionModelWeights'
import { destinations } from '../data'
import { useAnalytics } from '../hooks/useAnalytics'
import {
  CROWDING_PREFERENCES,
  TOURIST_INTERESTS,
  defaultInterestsFor,
  rankSustainableRecommendations,
} from '../engine/sustainableRanking'
import type {
  CrowdingPreference,
  TouristInterest,
} from '../engine/sustainableRanking'
import { cn } from '../utils/cn'

const steps = [
  {
    icon: MapPin,
    title: 'Select a current destination',
    text: 'Pick a popular destination such as Langkawi, Penang or Kuala Lumpur.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Set interests and crowding preference',
    text: 'The precomputed model ranks alternatives; interests and preference refine the order.',
  },
  {
    icon: Sparkles,
    title: 'Get ranked sustainable alternatives',
    text: 'Similar destinations with lower pressure, economic headroom and better rail-based access.',
  },
]

export function FindAlternativePage() {
  const navigate = useNavigate()
  const { diversion, loading, error } = useAnalytics()

  const [currentId, setCurrentId] = useState('langkawi')
  const [selectedInterests, setSelectedInterests] = useState<TouristInterest[]>(
    () => defaultInterestsFor('Langkawi'),
  )
  const [preference, setPreference] = useState<CrowdingPreference>('Low Crowding')
  const resultsRef = useRef<HTMLDivElement>(null)

  const current = destinations.find((destination) => destination.id === currentId)
  const currentName = current?.destination ?? ''

  const toggleInterest = (interest: TouristInterest) => {
    setSelectedInterests((currentValue) =>
      currentValue.includes(interest)
        ? currentValue.filter((item) => item !== interest)
        : [...currentValue, interest],
    )
  }

  const ranked = useMemo(() => {
    if (!diversion) return []
    return rankSustainableRecommendations(
      diversion.recommendations,
      currentName,
      selectedInterests,
      preference,
    )
  }, [diversion, currentName, selectedInterests, preference])

  const handleCompare = (destination: string) => {
    navigate(`/comparison?dest=${encodeURIComponent(currentName)},${encodeURIComponent(destination)}`)
  }

  const handleSubmit = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Recommendation"
        title="Find Alternative Destination"
        description="When a destination becomes too crowded, SMART DESTINATION AI recommends alternatives with similar characteristics, lower tourism pressure, economic headroom and better rail-based access."
      />

      <Panel title="How it works" description="The main user flow.">
        <div className="sd-steps">
          {steps.map((step, index) => (
            <div className="sd-step" key={step.title}>
              <span className="sd-step-num">{index + 1}</span>
              <step.icon size={18} style={{ color: 'var(--sd-c-primary-2)' }} />
              <h4>{step.title}</h4>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Request"
        icon={Search}
        description="Select where you currently plan to go, your interests, and your crowding preference."
      >
        <LoadingState loading={loading} />
        <ErrorState message={error ?? ''} />

        <div className="sd-request-grid">
          <div className="sd-field">
            <label className="sd-field-label" htmlFor="current-destination">
              Current destination
            </label>
            <select
              id="current-destination"
              className="sd-select"
              value={currentId}
              onChange={(event) => {
                setCurrentId(event.target.value)
                const next = destinations.find(
                  (item) => item.id === event.target.value,
                )
                if (next) {
                  setSelectedInterests(defaultInterestsFor(next.destination))
                }
              }}
            >
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.destination} — {destination.state}
                </option>
              ))}
            </select>
          </div>

          <div className="sd-field">
            <span className="sd-field-label">Tourist interests</span>
            <div className="sd-opt-grid">
              {TOURIST_INTERESTS.map((interest) => (
                <button
                  type="button"
                  key={interest}
                  className={cn(
                    'sd-opt',
                    selectedInterests.includes(interest) && 'is-on',
                  )}
                  onClick={() => toggleInterest(interest)}
                  aria-pressed={selectedInterests.includes(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          <div className="sd-field">
            <span className="sd-field-label">Crowding preference</span>
            <div className="sd-opt-row">
              {CROWDING_PREFERENCES.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={cn(
                    'sd-opt',
                    preference === option && 'is-on',
                  )}
                  onClick={() => setPreference(option)}
                  aria-pressed={preference === option}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button type="button" className="sd-btn sd-btn--primary" onClick={handleSubmit}>
          <Sparkles size={16} />
          Find Alternative Destination
        </button>
      </Panel>

      <div ref={resultsRef}>
        <Panel
          title="Ranked Alternatives"
          icon={Sparkles}
          description={`Alternatives for ${currentName}, ranked from the precomputed model and refined by your selections.`}
        >
          <LoadingState loading={loading} />
          <ErrorState message={error ?? ''} />
          {!error && !loading && selectedInterests.length === 0 ? (
            <p className="sd-panel-hint">
              No interests selected — ranking uses the precomputed model only
              (no interest-fit refinement).
            </p>
          ) : null}
          {!loading && diversion && ranked.length === 0 ? (
            <div className="sd-empty">
              No alternative recommendations are precomputed for {currentName}.
            </div>
          ) : null}
          {ranked.length > 0 ? (
            <div className="sd-rec-list">
              {ranked.slice(0, 10).map((recommendation, index) => (
                <RecommendationCard
                  key={`${recommendation.sourceDestination}-${recommendation.destination}`}
                  rank={index + 1}
                  recommendation={recommendation}
                  onCompare={handleCompare}
                />
              ))}
            </div>
          ) : null}
          <p className="sd-panel-note">
            <TrainFront size={13} />
            Every card shows the precomputed Sustainable Diversion Score (0.35
            similarity · 0.30 lower pressure · 0.20 economic · 0.15 mobility).
            Gateway congestion uses the Layer 4 rail forecast where available.
          </p>
        </Panel>
      </div>

      {diversion ? <DiversionModelWeights data={diversion} /> : null}
    </div>
  )
}