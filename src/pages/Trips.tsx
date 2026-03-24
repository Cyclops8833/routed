import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase'
import type { Trip } from '../types'
import { getUpcomingLongWeekends } from '../data/publicHolidays'

const PENDING_DATES_KEY = 'routed-pending-trip-dates'

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  const now = new Date()
  const target = new Date(dateStr)
  const diff = target.getTime() - now.getTime()
  if (diff <= 0) return null
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function daysRemaining(deadlineStr: string): number | null {
  return daysUntil(deadlineStr)
}

function formatDateRange(dateRange: { start: string; end: string }): string {
  if (!dateRange.start) return ''
  const start = new Date(dateRange.start)
  const end = dateRange.end ? new Date(dateRange.end) : null
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (!end || dateRange.start === dateRange.end) {
    return start.toLocaleDateString('en-AU', opts)
  }
  return `${start.toLocaleDateString('en-AU', opts)} – ${end.toLocaleDateString('en-AU', opts)}`
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const navigate = useNavigate()

  // Listen for auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null)
    })
    return unsub
  }, [])

  // Real-time trips listener
  useEffect(() => {
    if (uid === null) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'trips'),
      where('attendees', 'array-contains', uid),
      orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip))
        setTrips(loaded)
        setLoading(false)
      },
      () => {
        setLoading(false)
      }
    )

    return unsub
  }, [uid])

  const upcomingTrips = trips.filter((t) =>
    ['proposed', 'voting', 'confirmed', 'active'].includes(t.status)
  )
  const pastTrips = trips.filter((t) => t.status === 'completed')
  const displayedTrips = activeTab === 'upcoming' ? upcomingTrips : pastTrips

  const topoPattern = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='140' viewBox='0 0 200 140'%3E%3Cellipse cx='100' cy='70' rx='90' ry='55' fill='none' stroke='%234A6741' stroke-width='0.8' opacity='0.18'/%3E%3Cellipse cx='100' cy='70' rx='72' ry='42' fill='none' stroke='%234A6741' stroke-width='0.8' opacity='0.18'/%3E%3Cellipse cx='100' cy='70' rx='54' ry='30' fill='none' stroke='%234A6741' stroke-width='0.8' opacity='0.18'/%3E%3Cellipse cx='100' cy='70' rx='36' ry='19' fill='none' stroke='%234A6741' stroke-width='0.8' opacity='0.18'/%3E%3C/svg%3E")`

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - var(--tab-bar-height) - env(safe-area-inset-bottom))',
        backgroundColor: 'var(--color-base)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with topo pattern */}
      <div
        style={{
          position: 'relative',
          padding: '32px 20px 24px',
          backgroundColor: 'var(--color-base)',
          backgroundImage: topoPattern,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 140px',
          borderBottom: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: '28px',
              fontWeight: '700',
              color: 'var(--color-charcoal)',
              margin: 0,
            }}
          >
            Trips
          </h1>
          <p
            style={{
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '14px',
              color: 'var(--color-stone)',
              margin: '4px 0 0',
            }}
          >
            Plan and vote on your next adventure
          </p>
        </div>
      </div>

      {/* Tab filters */}
      <div
        style={{
          display: 'flex',
          padding: '12px 16px 0',
          gap: '4px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {(['upcoming', 'past'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px',
              borderRadius: '100px 100px 0 0',
              border: 'none',
              background: activeTab === tab ? 'var(--color-surface)' : 'transparent',
              color: activeTab === tab ? '#4A6741' : 'var(--color-stone)',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '14px',
              fontWeight: activeTab === tab ? '600' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid #4A6741' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {tab === 'upcoming' ? 'Upcoming' : 'Past'}
            {tab === 'upcoming' && upcomingTrips.length > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  background: 'rgba(74,103,65,0.12)',
                  color: '#4A6741',
                  borderRadius: '100px',
                  padding: '1px 6px',
                }}
              >
                {upcomingTrips.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '16px 16px 32px' }}>
        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              gap: '16px',
            }}
          >
            <div className="spinner" />
            <span
              style={{
                color: 'var(--color-stone)',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '14px',
              }}
            >
              Loading trips...
            </span>
          </div>
        ) : displayedTrips.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: '16px', opacity: 0.4 }}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="6" cy="18" r="2.5" stroke="var(--color-moss)" strokeWidth="2" />
                <circle cx="18" cy="6" r="2.5" stroke="var(--color-moss)" strokeWidth="2" />
                <path
                  d="M6 15.5C6 12 9 10.5 12 9.5"
                  stroke="var(--color-moss)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M12 9.5C15 8.5 18 7 18 8.5"
                  stroke="var(--color-moss)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p
              style={{
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '15px',
                color: 'var(--color-stone)',
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {activeTab === 'upcoming'
                ? 'No upcoming trips. Hit the + on the map to plan one.'
                : 'No completed trips yet.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displayedTrips.map((trip, tripIdx) => {
              const isCompleted = trip.status === 'completed'
              const isActive = trip.status === 'active'

              // Status-specific badge content
              let extraBadge: { text: string; bg: string; color: string } | null = null
              if (trip.status === 'proposed') {
                extraBadge = { text: 'Awaiting vote', bg: 'rgba(196,137,59,0.1)', color: '#C4893B' }
              } else if (trip.status === 'voting') {
                const remaining = trip.votingDeadline ? daysRemaining(trip.votingDeadline) : null
                const deadlineText = remaining !== null ? ` · ${remaining}d left` : ''
                extraBadge = {
                  text: `Voting open${deadlineText}`,
                  bg: 'rgba(196,137,59,0.12)',
                  color: '#C4893B',
                }
              } else if (trip.status === 'confirmed') {
                const days = daysUntil(trip.dateRange.start)
                if (days !== null) {
                  extraBadge = {
                    text: days === 1 ? 'Tomorrow!' : `In ${days} days`,
                    bg: 'rgba(74,103,65,0.1)',
                    color: '#4A6741',
                  }
                }
              }

              return (
                <div
                  key={trip.id}
                  className="card-animate"
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  style={{
                    animationDelay: `${tripIdx * 40}ms`,
                    background: isCompleted ? 'rgba(140,133,120,0.05)' : 'var(--color-surface)',
                    borderRadius: '14px',
                    border: isCompleted
                      ? '1px solid rgba(140,133,120,0.2)'
                      : isActive
                      ? '1.5px solid rgba(74,103,65,0.4)'
                      : '1px solid var(--color-border)',
                    boxShadow: isCompleted ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
                    padding: '16px',
                    cursor: 'pointer',
                    opacity: isCompleted ? 0.7 : 1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: 'Fraunces, Georgia, serif',
                        fontSize: '17px',
                        fontWeight: '700',
                        color: isCompleted ? 'var(--color-stone)' : 'var(--color-charcoal)',
                        margin: 0,
                        flex: 1,
                      }}
                    >
                      {trip.name || 'Untitled Trip'}
                    </h3>

                    {isActive ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#4A6741',
                            display: 'inline-block',
                            animation: 'pulse 1.5s ease-in-out infinite',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            fontFamily: 'DM Sans, system-ui, sans-serif',
                            color: '#4A6741',
                          }}
                        >
                          Happening now!
                        </span>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          borderRadius: '100px',
                          padding: '3px 9px',
                          backgroundColor: isCompleted
                            ? 'rgba(140,133,120,0.1)'
                            : trip.status === 'voting'
                            ? 'rgba(124,92,191,0.12)'
                            : trip.status === 'confirmed'
                            ? 'rgba(74,103,65,0.12)'
                            : 'rgba(196,137,59,0.12)',
                          color: isCompleted
                            ? 'var(--color-stone)'
                            : trip.status === 'voting'
                            ? '#7C5CBF'
                            : trip.status === 'confirmed'
                            ? '#4A6741'
                            : '#C4893B',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          fontFamily: 'DM Sans, system-ui, sans-serif',
                        }}
                      >
                        {trip.status === 'proposed'
                          ? 'Proposed'
                          : trip.status === 'voting'
                          ? 'Voting'
                          : trip.status === 'confirmed'
                          ? 'Confirmed'
                          : 'Completed'}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      flexWrap: 'wrap',
                      fontFamily: 'DM Sans, system-ui, sans-serif',
                      fontSize: '13px',
                      color: 'var(--color-stone)',
                      alignItems: 'center',
                    }}
                  >
                    {trip.dateRange?.start && (
                      <span>📅 {formatDateRange(trip.dateRange)}</span>
                    )}
                    <span>
                      👥 {trip.attendees?.length ?? 0} member
                      {(trip.attendees?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                    {trip.selectedDestinationIds?.length > 0 && (
                      <span>
                        📍 {trip.selectedDestinationIds.length} destination
                        {trip.selectedDestinationIds.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {extraBadge && (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          borderRadius: '100px',
                          padding: '2px 8px',
                          background: extraBadge.bg,
                          color: extraBadge.color,
                        }}
                      >
                        {extraBadge.text}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Long weekends planning section */}
      {activeTab === 'upcoming' && !loading && (() => {
        const longWeekends = getUpcomingLongWeekends(4)
        if (longWeekends.length === 0) return null
        return (
          <div style={{ padding: '0 16px 32px' }}>
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '18px', fontWeight: '700', color: 'var(--color-charcoal)', margin: '0 0 4px' }}>
                Long Weekends
              </h3>
              <p style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '13px', color: 'var(--color-stone)', margin: 0 }}>
                Tap to plan a trip for these dates
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {longWeekends.map((lw, idx) => {
                const fromD = new Date(lw.from)
                const toD = new Date(lw.to)
                const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
                const rangeStr = `${fromD.toLocaleDateString('en-AU', opts)} – ${toD.toLocaleDateString('en-AU', opts)}`
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      try {
                        localStorage.setItem(PENDING_DATES_KEY, JSON.stringify({ from: lw.from, to: lw.to }))
                      } catch { /* ignore */ }
                      navigate('/map')
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(196,137,59,0.4)'; e.currentTarget.style.background = 'rgba(196,137,59,0.04)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-surface)' }}
                  >
                    <div>
                      <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', fontWeight: '700', color: 'var(--color-charcoal)', marginBottom: '2px' }}>
                        {lw.holiday.name}
                      </div>
                      <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '12px', color: 'var(--color-stone)' }}>
                        📅 {rangeStr}
                      </div>
                    </div>
                    <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '13px', color: '#C4893B', fontWeight: '600' }}>
                      Plan →
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}

