import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import type { RefObject } from 'react'
import type { Map as MapboxMap } from 'mapbox-gl'
import { db } from '../firebase'
import type { UserProfile, DriveCache } from '../types'
import { rankDestinations } from '../utils/rankDestinations'
import type { RankedDestination } from '../utils/rankDestinations'
import DestinationCard from './DestinationCard'
import { getHolidaysInRange, getUpcomingLongWeekends } from '../data/publicHolidays'

interface TripSheetProps {
  mapRef: RefObject<MapboxMap | null>
  currentUser: UserProfile | null
  onClose: () => void
  onPeek: () => void
  onDragHandlePointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  onDragHandlePointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void
  onDragHandlePointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void
  pendingDestinationId?: string | null
  onPendingDestConsumed?: () => void
}

type SheetView = 'form' | 'results'

const CREW_COLOURS = [
  '#4A6741',
  '#C4893B',
  '#B85C38',
  '#7C5CBF',
  '#E07A5F',
  '#5B8DB8',
  '#8B6E47',
]

function calcNights(start: string, end: string): number {
  if (!start || !end) return 2
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return Math.max(1, Math.ceil((e - s) / 86400000))
}

export default function TripSheet({ mapRef, currentUser, onClose, onPeek, onDragHandlePointerDown, onDragHandlePointerMove, onDragHandlePointerUp, pendingDestinationId, onPendingDestConsumed }: TripSheetProps) {
  const today = new Date().toISOString().split('T')[0]
  const navigate = useNavigate()

  // Form state
  const [tripName, setTripName] = useState('')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState('')
  const [tripLength, setTripLength] = useState<'overnighter' | 'long-weekend'>('overnighter')
  const [maxBudget, setMaxBudget] = useState(200)
  const [crewMembers, setCrewMembers] = useState<UserProfile[]>([])
  const [crewLoading, setCrewLoading] = useState(true)
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set())
  const [attendeeColours, setAttendeeColours] = useState<Record<string, string>>({})

  // Results state
  const [view, setView] = useState<SheetView>('form')
  const [ranking, setRanking] = useState<RankedDestination[]>([])
  const [isRanking, setIsRanking] = useState(false)
  const [rankError, setRankError] = useState<string | null>(null)
  const [selectedDestIds, setSelectedDestIds] = useState<Set<string>>(new Set())

  // Saving state
  const [isSaving, setIsSaving] = useState(false)

  // When a destination is tapped "Plan a trip here" while this sheet is active
  useEffect(() => {
    if (!pendingDestinationId) return
    setSelectedDestIds((prev) => new Set([...prev, pendingDestinationId]))
    setView('results')
    onPendingDestConsumed?.()
  }, [pendingDestinationId])

  // Load crew members from Firestore
  useEffect(() => {
    async function loadCrew() {
      try {
        const snap = await getDocs(collection(db, 'users'))
        const profiles = snap.docs
          .map((d) => d.data() as UserProfile)
          .sort((a, b) => a.uid.localeCompare(b.uid))

        const colours: Record<string, string> = {}
        profiles.forEach((p, i) => {
          colours[p.uid] = CREW_COLOURS[i % CREW_COLOURS.length]
        })

        setCrewMembers(profiles)
        setAttendeeColours(colours)
        // Default: all checked
        setSelectedAttendees(new Set(profiles.map((p) => p.uid)))
      } catch (err) {
        console.error('Failed to load crew:', err)
      } finally {
        setCrewLoading(false)
      }
    }
    loadCrew()
  }, [])

  const toggleAttendee = (uid: string) => {
    setSelectedAttendees((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) {
        next.delete(uid)
      } else {
        next.add(uid)
      }
      return next
    })
  }

  const handleFindDestinations = async () => {
    setRankError(null)
    setIsRanking(true)

    const attendees = crewMembers.filter((m) => selectedAttendees.has(m.uid))
    if (attendees.length === 0) {
      setRankError('Select at least one crew member.')
      setIsRanking(false)
      return
    }

    const nights = dateTo ? calcNights(dateFrom, dateTo) : (tripLength === 'overnighter' ? 1 : 3)

    try {
      const results = await rankDestinations(
        attendees,
        tripLength,
        maxBudget,
        nights,
        { petrol: 2.1, diesel: 2.0 }
      )
      setRanking(results)
      setView('results')
    } catch (err) {
      console.error('Ranking failed:', err)
      setRankError('Failed to rank destinations. Check your connection and try again.')
    } finally {
      setIsRanking(false)
    }
  }

  const toggleDestSelect = (id: string) => {
    setSelectedDestIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= 5) return prev // max 5
        next.add(id)
      }
      return next
    })
  }

  const handleContinueToVoting = async () => {
    if (!currentUser) return
    if (selectedDestIds.size < 2) return

    setIsSaving(true)
    try {
      await addDoc(collection(db, 'trips'), {
        name: tripName || 'Untitled Trip',
        dateRange: { start: dateFrom, end: dateTo || dateFrom },
        tripLength,
        maxBudget,
        creatorUid: currentUser.uid,
        attendees: crewMembers
          .filter((m) => selectedAttendees.has(m.uid))
          .map((m) => m.uid),
        selectedDestinationIds: Array.from(selectedDestIds),
        status: 'proposed',
        createdAt: Timestamp.now(),
      })
      onClose()
      navigate('/trips')
    } catch (err) {
      console.error('Failed to save trip:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const selectedCount = selectedDestIds.size

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-surface)',
      }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={onDragHandlePointerDown}
        onPointerMove={onDragHandlePointerMove}
        onPointerUp={onDragHandlePointerUp}
        style={{
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '10px',
          paddingBottom: '4px',
          flexShrink: 0,
          cursor: 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '4px',
            borderRadius: '2px',
            background: 'var(--color-stone)',
            opacity: 0.4,
          }}
        />
      </div>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 20px 12px',
          flexShrink: 0,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {view === 'results' ? (
          <button
            onClick={() => setView('form')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#4A6741',
              fontSize: '14px',
              fontWeight: '600',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              padding: '4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ← Back
          </button>
        ) : (
          <div />
        )}
        <h2
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: '20px',
            fontWeight: '700',
            color: 'var(--color-charcoal)',
            margin: 0,
          }}
        >
          {view === 'form' ? 'Plan a Trip' : 'Destinations'}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-stone)',
            fontSize: '22px',
            lineHeight: 1,
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: view === 'form' ? '20px' : '16px',
          paddingBottom: selectedCount >= 2 ? '100px' : '32px',
        }}
      >
        {view === 'form' ? (
          <FormView
            tripName={tripName}
            setTripName={setTripName}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            tripLength={tripLength}
            setTripLength={setTripLength}
            maxBudget={maxBudget}
            setMaxBudget={setMaxBudget}
            crewMembers={crewMembers}
            crewLoading={crewLoading}
            selectedAttendees={selectedAttendees}
            toggleAttendee={toggleAttendee}
            attendeeColours={attendeeColours}
            onFindDestinations={handleFindDestinations}
            isRanking={isRanking}
            rankError={rankError}
          />
        ) : (
          <ResultsView
            ranking={ranking}
            mapRef={mapRef}
            attendees={crewMembers.filter((m) => selectedAttendees.has(m.uid))}
            attendeeColours={attendeeColours}
            selectedDestIds={selectedDestIds}
            onToggleSelect={toggleDestSelect}
            onViewOnMap={onPeek}
            currentUserUid={currentUser?.uid}
            currentUserDriveCache={currentUser?.driveCache ?? null}
          />
        )}
      </div>

      {/* Continue to Voting sticky footer */}
      {view === 'results' && selectedCount >= 2 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            padding: '16px 20px',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          }}
        >
          <button
            onClick={handleContinueToVoting}
            disabled={isSaving}
            style={{
              width: '100%',
              background: '#4A6741',
              color: 'white',
              border: 'none',
              borderRadius: '100px',
              padding: '14px 28px',
              fontSize: '16px',
              fontWeight: '600',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              transition: 'background 0.15s ease',
            }}
          >
            {isSaving
              ? 'Saving...'
              : `Continue to Voting (${selectedCount} destination${selectedCount !== 1 ? 's' : ''})`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Form View ──────────────────────────────────────────────────────────────────

interface FormViewProps {
  tripName: string
  setTripName: (v: string) => void
  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  tripLength: 'overnighter' | 'long-weekend'
  setTripLength: (v: 'overnighter' | 'long-weekend') => void
  maxBudget: number
  setMaxBudget: (v: number) => void
  crewMembers: UserProfile[]
  crewLoading: boolean
  selectedAttendees: Set<string>
  toggleAttendee: (uid: string) => void
  attendeeColours: Record<string, string>
  onFindDestinations: () => void
  isRanking: boolean
  rankError: string | null
}

function FormView({
  tripName,
  setTripName,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  tripLength,
  setTripLength,
  maxBudget,
  setMaxBudget,
  crewMembers,
  crewLoading,
  selectedAttendees,
  toggleAttendee,
  attendeeColours,
  onFindDestinations,
  isRanking,
  rankError,
}: FormViewProps) {
  const today = new Date().toISOString().split('T')[0]
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--color-stone)',
    fontFamily: 'DM Sans, system-ui, sans-serif',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Trip name */}
      <div>
        <label style={labelStyle}>Trip name</label>
        <input
          className="input"
          type="text"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          placeholder="Weekend at the river"
        />
      </div>

      {/* Date range */}
      <div>
        <label style={labelStyle}>Date range</label>

        {/* Upcoming long weekend chips */}
        {(() => {
          const upcoming = getUpcomingLongWeekends(4)
          if (upcoming.length === 0) return null
          return (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-stone)', fontFamily: 'DM Sans, system-ui, sans-serif', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Upcoming long weekends
              </div>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                {upcoming.map((lw, idx) => {
                  const fromD = new Date(lw.from)
                  const toD = new Date(lw.to)
                  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
                  const rangeStr = `${fromD.toLocaleDateString('en-AU', opts)}–${toD.toLocaleDateString('en-AU', opts)}`
                  const shortName = lw.holiday.name.replace("King's Birthday", "King's Bday").replace('Friday before AFL Grand Final', 'AFL GF').replace('Australia Day', 'Aus Day')
                  return (
                    <button
                      key={idx}
                      onClick={() => { setDateFrom(lw.from); setDateTo(lw.to) }}
                      style={{
                        flexShrink: 0,
                        padding: '6px 10px',
                        borderRadius: '100px',
                        border: '1.5px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        cursor: 'pointer',
                        fontFamily: 'DM Sans, system-ui, sans-serif',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: 'var(--color-charcoal)',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.1s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C4893B'; e.currentTarget.style.color = '#C4893B' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-charcoal)' }}
                    >
                      {shortName} — {rangeStr}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-stone)',
                marginBottom: '4px',
                fontFamily: 'DM Sans, system-ui, sans-serif',
              }}
            >
              From
            </div>
            <input
              className="input"
              type="date"
              value={dateFrom}
              min={today}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ fontSize: '14px' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-stone)',
                marginBottom: '4px',
                fontFamily: 'DM Sans, system-ui, sans-serif',
              }}
            >
              To
            </div>
            <input
              className="input"
              type="date"
              value={dateTo}
              min={dateFrom || today}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ fontSize: '14px' }}
            />
          </div>
        </div>

        {/* Holiday banner */}
        {dateFrom && dateTo && (() => {
          const holidays = getHolidaysInRange(dateFrom, dateTo)
          const longWknd = holidays.find((h) => h.isLongWeekend)
          if (!longWknd) return null
          return (
            <div style={{
              marginTop: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(196,137,59,0.1)',
              border: '1px solid rgba(196,137,59,0.3)',
              color: '#C4893B',
              fontSize: '13px',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontWeight: '600',
            }}>
              ✨ {longWknd.name} — long weekend!
            </div>
          )
        })()}
      </div>

      {/* Trip length segmented control */}
      <div>
        <label style={labelStyle}>Trip length</label>
        <div
          style={{
            display: 'flex',
            background: 'var(--color-base)',
            borderRadius: '10px',
            padding: '3px',
            border: '1px solid var(--color-border)',
          }}
        >
          {(['overnighter', 'long-weekend'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setTripLength(opt)}
              style={{
                flex: 1,
                padding: '9px 12px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                transition: 'all 0.15s ease',
                background: tripLength === opt ? 'var(--color-surface)' : 'transparent',
                color: tripLength === opt ? '#4A6741' : 'var(--color-stone)',
                boxShadow:
                  tripLength === opt
                    ? '0 1px 4px rgba(0,0,0,0.1)'
                    : 'none',
              }}
            >
              {opt === 'overnighter' ? 'Overnighter' : 'Long Weekend'}
            </button>
          ))}
        </div>
      </div>

      {/* Max budget slider */}
      <div>
        <label style={labelStyle}>
          Max budget per head
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <input
            type="range"
            min={50}
            max={500}
            step={25}
            value={maxBudget}
            onChange={(e) => setMaxBudget(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#C4893B' }}
          />
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '16px',
              fontWeight: '600',
              color: '#C4893B',
              minWidth: '52px',
              textAlign: 'right',
            }}
          >
            ${maxBudget}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--color-stone)',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            marginTop: '2px',
          }}
        >
          <span>$50</span>
          <span>$500</span>
        </div>
      </div>

      {/* Who's coming */}
      <div>
        <label style={labelStyle}>Who's coming</label>
        {crewLoading ? (
          <div style={{ color: 'var(--color-stone)', fontSize: '14px', padding: '8px 0' }}>
            Loading crew...
          </div>
        ) : crewMembers.length === 0 ? (
          <div style={{ color: 'var(--color-stone)', fontSize: '14px', padding: '8px 0' }}>
            No crew members found.
          </div>
        ) : (
          <div
            style={{
              border: '1.5px solid var(--color-border)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {crewMembers.map((member, index) => (
              <label
                key={member.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  borderTop:
                    index > 0 ? '1px solid var(--color-border)' : 'none',
                  background: selectedAttendees.has(member.uid)
                    ? 'rgba(74,103,65,0.04)'
                    : 'transparent',
                  transition: 'background 0.1s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedAttendees.has(member.uid)}
                  onChange={() => toggleAttendee(member.uid)}
                  style={{
                    width: '17px',
                    height: '17px',
                    cursor: 'pointer',
                    accentColor: '#4A6741',
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: attendeeColours[member.uid] ?? '#4A6741',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontFamily: 'Fraunces, Georgia, serif',
                    fontSize: '14px',
                    fontWeight: '700',
                    flexShrink: 0,
                  }}
                >
                  {member.displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'DM Sans, system-ui, sans-serif',
                      fontSize: '15px',
                      fontWeight: '600',
                      color: 'var(--color-charcoal)',
                    }}
                  >
                    {member.displayName}
                  </div>
                  {member.homeLocation?.suburb && (
                    <div
                      style={{
                        fontFamily: 'DM Sans, system-ui, sans-serif',
                        fontSize: '12px',
                        color: 'var(--color-stone)',
                      }}
                    >
                      {member.homeLocation.suburb}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {rankError && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            background: 'rgba(224,122,95,0.1)',
            border: '1px solid rgba(224,122,95,0.3)',
            color: '#B85C38',
            fontSize: '14px',
            fontFamily: 'DM Sans, system-ui, sans-serif',
          }}
        >
          {rankError}
        </div>
      )}

      {/* Find Destinations button */}
      <button
        onClick={onFindDestinations}
        disabled={isRanking}
        style={{
          width: '100%',
          background: isRanking ? '#6b8f63' : '#4A6741',
          color: 'white',
          border: 'none',
          borderRadius: '100px',
          padding: '15px 28px',
          fontSize: '16px',
          fontWeight: '600',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          cursor: isRanking ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          transition: 'background 0.15s ease',
        }}
      >
        {isRanking ? (
          <>
            <div
              style={{
                width: '18px',
                height: '18px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            Ranking destinations...
          </>
        ) : (
          'Find Destinations'
        )}
      </button>
    </div>
  )
}

// ── Results View ───────────────────────────────────────────────────────────────

interface ResultsViewProps {
  ranking: RankedDestination[]
  mapRef: RefObject<MapboxMap | null>
  attendees: UserProfile[]
  attendeeColours: Record<string, string>
  selectedDestIds: Set<string>
  onToggleSelect: (id: string) => void
  onViewOnMap: () => void
  currentUserUid?: string
  currentUserDriveCache?: DriveCache | null
}

function ResultsView({
  ranking,
  mapRef,
  attendees,
  attendeeColours,
  selectedDestIds,
  onToggleSelect,
  onViewOnMap,
  currentUserUid,
  currentUserDriveCache,
}: ResultsViewProps) {
  if (ranking.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--color-stone)',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          fontSize: '15px',
        }}
      >
        No destinations matched your criteria. Try adjusting your filters.
      </div>
    )
  }

  const selectedCount = selectedDestIds.size

  return (
    <div>
      <div
        style={{
          marginBottom: '14px',
          fontSize: '13px',
          color: 'var(--color-stone)',
          fontFamily: 'DM Sans, system-ui, sans-serif',
        }}
      >
        {ranking.length} destinations ranked · Select 2–5 to put to vote
        {selectedCount > 0 && (
          <span style={{ color: '#4A6741', fontWeight: '600' }}>
            {' '}· {selectedCount} selected
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {ranking.map((r, i) => (
          <DestinationCard
            key={r.destination.id}
            ranked={r}
            index={i}
            isSelected={selectedDestIds.has(r.destination.id)}
            onToggleSelect={onToggleSelect}
            mapRef={mapRef}
            attendees={attendees}
            attendeeColours={attendeeColours}
            onViewOnMap={onViewOnMap}
            currentUserUid={currentUserUid}
            currentUserDriveCache={currentUserDriveCache}
          />
        ))}
      </div>
    </div>
  )
}
