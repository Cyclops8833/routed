import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase'
import type { Trip } from '../types'

const STATUS_CONFIG: Record<
  Trip['status'],
  { label: string; bg: string; color: string }
> = {
  proposed: { label: 'Proposed', bg: 'rgba(196,137,59,0.12)', color: '#C4893B' },
  voting: { label: 'Voting', bg: 'rgba(124,92,191,0.12)', color: '#7C5CBF' },
  confirmed: { label: 'Confirmed', bg: 'rgba(74,103,65,0.12)', color: '#4A6741' },
  active: { label: 'Active', bg: 'rgba(74,103,65,0.18)', color: '#4A6741' },
  completed: { label: 'Completed', bg: 'rgba(140,133,120,0.15)', color: '#8C8578' },
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
  const navigate = useNavigate()

  // Listen for auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null)
    })
    return unsub
  }, [])

  // Fetch trips once uid is known
  useEffect(() => {
    if (uid === null) {
      setLoading(false)
      return
    }

    async function fetchTrips() {
      try {
        const q = query(
          collection(db, 'trips'),
          where('attendees', 'array-contains', uid),
          orderBy('createdAt', 'desc')
        )
        const snap = await getDocs(q)
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip))
        setTrips(loaded)
      } catch (err) {
        console.error('Failed to load trips:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTrips()
  }, [uid])

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
        ) : trips.length === 0 ? (
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
                <circle
                  cx="6"
                  cy="18"
                  r="2.5"
                  stroke="var(--color-moss)"
                  strokeWidth="2"
                />
                <circle
                  cx="18"
                  cy="6"
                  r="2.5"
                  stroke="var(--color-moss)"
                  strokeWidth="2"
                />
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
              No trips yet. Hit the + on the map to plan one.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {trips.map((trip) => {
              const statusCfg = STATUS_CONFIG[trip.status] ?? STATUS_CONFIG.proposed
              return (
                <div
                  key={trip.id}
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: '14px',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    padding: '16px',
                    cursor: 'pointer',
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
                        color: 'var(--color-charcoal)',
                        margin: 0,
                        flex: 1,
                      }}
                    >
                      {trip.name || 'Untitled Trip'}
                    </h3>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '100px',
                        padding: '3px 9px',
                        backgroundColor: statusCfg.bg,
                        color: statusCfg.color,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {statusCfg.label}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      flexWrap: 'wrap',
                      fontFamily: 'DM Sans, system-ui, sans-serif',
                      fontSize: '13px',
                      color: 'var(--color-stone)',
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
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
