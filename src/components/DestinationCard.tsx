import type { RefObject } from 'react'
import type { Map as MapboxMap } from 'mapbox-gl'
import type { RankedDestination } from '../utils/rankDestinations'
import type { UserProfile } from '../types'
import { fetchRoutes, drawRoutes, clearRoutes, setDestination } from '../utils/mapRoutes'

interface DestinationCardProps {
  ranked: RankedDestination
  index: number
  isSelected: boolean
  onToggleSelect: (id: string) => void
  mapRef: RefObject<MapboxMap | null>
  attendees: UserProfile[]
  attendeeColours: Record<string, string>
  onViewOnMap: () => void
}

const CREW_COLOURS = [
  '#4A6741',
  '#C4893B',
  '#B85C38',
  '#7C5CBF',
  '#E07A5F',
  '#5B8DB8',
  '#8B6E47',
]

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatHours(mins: number): string {
  return (mins / 60).toFixed(1) + ' hrs'
}

function abbreviateSeason(s: string): string {
  const map: Record<string, string> = {
    summer: 'Sum',
    autumn: 'Aut',
    winter: 'Win',
    spring: 'Spr',
  }
  return map[s] ?? s
}

export default function DestinationCard({
  ranked,
  index,
  isSelected,
  onToggleSelect,
  mapRef,
  attendees,
  attendeeColours,
  onViewOnMap,
}: DestinationCardProps) {
  const { destination: dest, routes, estimatedCostPerPerson, overBudget } = ranked
  const isTopRanked = index < 3

  const driveTimes = routes.map((r) => r.durationMinutes)
  const minDrive = Math.min(...driveTimes)
  const maxDrive = Math.max(...driveTimes)

  const driveRangeStr =
    driveTimes.length === 1
      ? formatHours(driveTimes[0])
      : `${formatHours(minDrive)}–${formatHours(maxDrive)}`

  const handleViewOnMap = async () => {
    const map = mapRef.current
    if (!map) return

    clearRoutes(map)

    const attendeesWithLocation = attendees.filter(
      (a) => a.homeLocation && typeof a.homeLocation.lat === 'number'
    )

    const memberInputs = attendeesWithLocation.map((a, idx) => ({
      uid: a.uid,
      name: a.displayName,
      colour: attendeeColours[a.uid] ?? CREW_COLOURS[idx % CREW_COLOURS.length],
      lat: a.homeLocation!.lat,
      lng: a.homeLocation!.lng,
    }))

    try {
      const newRoutes = await fetchRoutes(memberInputs, {
        lat: dest.lat,
        lng: dest.lng,
      })
      drawRoutes(map, newRoutes)
    } catch {
      // Use cached routes from ranking if re-fetch fails
      drawRoutes(map, routes)
    }

    setDestination(map, dest.lat, dest.lng, dest.name)
    onViewOnMap()
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    border: '1px solid var(--color-border)',
    borderLeft: isTopRanked ? '4px solid #C4893B' : '1px solid var(--color-border)',
    opacity: overBudget ? 0.6 : 1,
    overflow: 'hidden',
    animation: `fadeInCard 0.3s ease both`,
    animationDelay: `${index * 50}ms`,
  }

  return (
    <div style={cardStyle}>
      <style>{`
        @keyframes fadeInCard {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ padding: '16px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: 'var(--color-charcoal)',
                  margin: 0,
                }}
              >
                {dest.name}
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--color-stone)',
                  background: 'rgba(140,133,120,0.12)',
                  borderRadius: '100px',
                  padding: '2px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {dest.region}
              </span>
              {dest.roadType === '4wd-only' && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#C4893B',
                    background: 'rgba(196,137,59,0.12)',
                    borderRadius: '100px',
                    padding: '2px 8px',
                    border: '1px solid rgba(196,137,59,0.3)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  4WD Only
                </span>
              )}
            </div>
          </div>

          {/* Select checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(dest.id)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#4A6741' }}
            />
          </label>
        </div>

        {/* Description */}
        <p
          style={{
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontSize: '14px',
            color: 'var(--color-stone)',
            margin: '0 0 8px 0',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.5',
          }}
        >
          {dest.description}
        </p>

        {/* Crew notes */}
        {dest.crewNotes && (
          <p
            style={{
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '13px',
              fontStyle: 'italic',
              color: '#C4893B',
              margin: '0 0 10px 0',
            }}
          >
            📍 {dest.crewNotes}
          </p>
        )}

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '10px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            color: 'var(--color-stone)',
          }}
        >
          <span>🕐 {driveRangeStr}</span>
          <span>
            ⛺{' '}
            {dest.campsiteCostPerNight === 0
              ? 'Free'
              : `$${dest.campsiteCostPerNight}/night`}
          </span>
          <span>📅 {dest.bestSeasons.map(abbreviateSeason).join(', ')}</span>
        </div>

        {/* Per-member drive times */}
        {routes.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            {routes.map((r) => (
              <div
                key={r.memberUid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: r.colour,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                    fontSize: '13px',
                    color: 'var(--color-charcoal)',
                    flex: 1,
                  }}
                >
                  {r.memberName}
                </span>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px',
                    color: 'var(--color-stone)',
                  }}
                >
                  {formatMinutes(r.durationMinutes)} · {r.distanceKm} km
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Fish species tags */}
        {dest.fishSpecies.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {dest.fishSpecies.map((species) => {
              const isTroutSalmon = /trout|salmon/i.test(species)
              return (
                <span
                  key={species}
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    borderRadius: '100px',
                    padding: '3px 9px',
                    backgroundColor: isTroutSalmon
                      ? 'rgba(74,103,65,0.12)'
                      : 'rgba(196,137,59,0.12)',
                    color: isTroutSalmon ? '#4A6741' : '#C4893B',
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                  }}
                >
                  {species}
                </span>
              )
            })}
          </div>
        )}

        {/* Cost + budget */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '15px',
              fontWeight: '600',
              color: overBudget ? '#E07A5F' : 'var(--color-charcoal)',
            }}
          >
            ~${Math.round(estimatedCostPerPerson)} per person
          </span>
          {overBudget && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#E07A5F',
                background: 'rgba(224,122,95,0.12)',
                borderRadius: '100px',
                padding: '3px 9px',
                border: '1px solid rgba(224,122,95,0.3)',
              }}
            >
              Over budget
            </span>
          )}
        </div>

        {/* View on map button */}
        <button
          onClick={handleViewOnMap}
          style={{
            width: '100%',
            background: '#4A6741',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#3d5636'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#4A6741'
          }}
        >
          View on map
        </button>
      </div>
    </div>
  )
}
