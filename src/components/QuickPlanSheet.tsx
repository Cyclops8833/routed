import { useState, useEffect } from 'react'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { useCrewContext } from '../contexts/CrewContext'
import { useNavigate } from 'react-router-dom'
import type { RefObject } from 'react'
import type { Map as MapboxMap } from 'mapbox-gl'
import { db } from '../firebase'
import type { UserProfile } from '../types'
import { rankDestinations } from '../utils/rankDestinations'
import type { RankedDestination } from '../utils/rankDestinations'
import DestinationCard from './DestinationCard'
import type { Destination } from '../data/destinations'

const CREW_COLOURS = [
  '#4A6741',
  '#C4893B',
  '#B85C38',
  '#7C5CBF',
  '#E07A5F',
  '#5B8DB8',
  '#8B6E47',
]

type Vibe = 'fishing' | 'bush' | '4wd' | 'surprise'
type QuickStep = 0 | 1 | 2 | 3 | 4

interface QuickPlanSheetProps {
  mapRef: RefObject<MapboxMap | null>
  currentUser: UserProfile | null
  onClose: () => void
  onSwitchToManual: () => void
  pendingDestinationId?: string | null
  onPendingDestConsumed?: () => void
}

const today = new Date().toISOString().split('T')[0]

function applyVibeFilter(results: RankedDestination[], vibe: Vibe): RankedDestination[] {
  if (vibe === 'surprise') return results
  return results.filter((r) => {
    const acts = r.destination.activities
    const road = r.destination.roadType
    if (vibe === 'fishing') return acts.includes('fishing')
    if (vibe === 'bush') return acts.includes('camping') || acts.includes('hiking')
    if (vibe === '4wd') return road === 'unsealed' || road === '4wd-only' || acts.includes('4wd')
    return true
  })
}

function getAutoTripName(dest: Destination | null): string {
  if (!dest) return 'Untitled Trip'
  return `Trip to ${dest.nearestTown || dest.name}`
}

export default function QuickPlanSheet({ mapRef, currentUser, onClose, onSwitchToManual, pendingDestinationId, onPendingDestConsumed }: QuickPlanSheetProps) {
  const navigate = useNavigate()
  const { allUsers } = useCrewContext()
  const [step, setStep] = useState<QuickStep>(0)
  const [tripLength, setTripLength] = useState<'overnighter' | 'long-weekend' | null>(null)
  const [crewMembers, setCrewMembers] = useState<UserProfile[]>([])
  const [crewLoading, setCrewLoading] = useState(true)
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set())
  const [attendeeColours, setAttendeeColours] = useState<Record<string, string>>({})
  const [_vibe, setVibe] = useState<Vibe | null>(null)
  const [ranking, setRanking] = useState<RankedDestination[]>([])
  const [isRanking, setIsRanking] = useState(false)
  const [tripName, setTripName] = useState('')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState('')
  const [selectedDestIds, setSelectedDestIds] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  // When a destination is tapped "Plan a trip here" while this sheet is active
  useEffect(() => {
    if (!pendingDestinationId) return
    setSelectedDestIds((prev) => new Set([...prev, pendingDestinationId]))
    if (ranking.length > 0) setStep(4)
    onPendingDestConsumed?.()
  }, [pendingDestinationId])

  useEffect(() => {
    const profiles = [...allUsers].sort((a, b) => a.uid.localeCompare(b.uid))
    const colours: Record<string, string> = {}
    profiles.forEach((p, i) => {
      colours[p.uid] = CREW_COLOURS[i % CREW_COLOURS.length]
    })
    setCrewMembers(profiles)
    setAttendeeColours(colours)
    setSelectedAttendees(new Set(profiles.map((p) => p.uid)))
    setCrewLoading(false)
  }, [allUsers])

  async function runRanking(selectedVibe: Vibe) {
    setIsRanking(true)
    setRanking([])
    const attendees = crewMembers.filter((m) => selectedAttendees.has(m.uid))
    const nights = tripLength === 'overnighter' ? 1 : 3
    const start = Date.now()
    try {
      const results = await rankDestinations(attendees, tripLength ?? 'overnighter', 300, nights, {
        petrol: 2.1,
        diesel: 2.0,
      })
      const filtered = applyVibeFilter(results, selectedVibe).slice(0, 5)
      const elapsed = Date.now() - start
      if (elapsed < 500) {
        await new Promise((r) => setTimeout(r, 500 - elapsed))
      }
      setRanking(filtered)
      if (filtered.length > 0) {
        setTripName(getAutoTripName(filtered[0].destination))
      }
    } catch (err) {
      console.error('Ranking failed:', err)
    } finally {
      setIsRanking(false)
    }
  }

  function handleSelectVibe(v: Vibe) {
    setVibe(v)
    setStep(4)
    runRanking(v)
  }

  function toggleAttendee(uid: string) {
    setSelectedAttendees((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function toggleDestSelect(id: string) {
    setSelectedDestIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        if (next.size >= 5) return prev
        next.add(id)
      }
      return next
    })
  }

  async function handleCreateTrip() {
    if (!currentUser || selectedDestIds.size < 2) return
    setIsSaving(true)
    try {
      await addDoc(collection(db, 'trips'), {
        name: tripName || 'Untitled Trip',
        dateRange: { start: dateFrom, end: dateTo || dateFrom },
        tripLength: tripLength ?? 'overnighter',
        maxBudget: 300,
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

  const labelStyle: React.CSSProperties = {
    fontFamily: 'DM Sans, system-ui, sans-serif',
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--color-charcoal)',
    marginBottom: '20px',
    display: 'block',
  }

  // Step 0: Mode picker
  if (step === 0) {
    return (
      <div style={{ padding: '8px 20px 20px' }}>
        <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '22px', fontWeight: '700', color: 'var(--color-charcoal)', margin: '0 0 20px' }}>
          Plan a Trip
        </h2>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          {([
            { key: 'quick', icon: '⚡', title: 'Quick Plan', sub: '4 taps to your next adventure' },
            { key: 'manual', icon: '⚙️', title: 'Manual', sub: 'Full control over every detail' },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => opt.key === 'manual' ? onSwitchToManual() : setStep(1)}
              style={{
                flex: 1,
                height: '140px',
                borderRadius: '16px',
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-surface)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '16px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.borderColor = '#4A6741'
                el.style.background = 'rgba(74,103,65,0.04)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.borderColor = 'var(--color-border)'
                el.style.background = 'var(--color-surface)'
              }}
            >
              <span style={{ fontSize: '28px' }}>{opt.icon}</span>
              <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '16px', fontWeight: '700', color: 'var(--color-charcoal)' }}>{opt.title}</span>
              <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '12px', color: 'var(--color-stone)', textAlign: 'center' }}>{opt.sub}</span>
            </button>
          ))}
        </div>
        <button
          onClick={onSwitchToManual}
          style={{ background: 'none', border: 'none', color: '#4A6741', fontSize: '14px', fontWeight: '600', fontFamily: 'DM Sans, system-ui, sans-serif', cursor: 'pointer', padding: '4px 0' }}
        >
          Or browse all destinations →
        </button>
      </div>
    )
  }

  // Step 1: Trip length
  if (step === 1) {
    return (
      <div style={{ padding: '8px 20px 20px' }}>
        <button onClick={() => setStep(0)} style={{ background: 'none', border: 'none', color: '#4A6741', fontSize: '14px', fontWeight: '600', fontFamily: 'DM Sans, system-ui, sans-serif', cursor: 'pointer', padding: '4px 0', marginBottom: '16px' }}>
          ← Start over
        </button>
        <span style={labelStyle}>How long?</span>
        <div style={{ display: 'flex', gap: '12px' }}>
          {([
            { key: 'overnighter', label: 'Overnighter', icon: '🌙' },
            { key: 'long-weekend', label: 'Long Weekend', icon: '🏕️' },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setTripLength(opt.key); setStep(2) }}
              style={{
                flex: 1,
                height: '120px',
                borderRadius: '16px',
                border: `1.5px solid ${tripLength === opt.key ? '#4A6741' : 'var(--color-border)'}`,
                background: tripLength === opt.key ? 'rgba(74,103,65,0.06)' : 'var(--color-surface)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '32px',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{opt.icon}</span>
              <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-charcoal)' }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Step 2: Who's coming
  if (step === 2) {
    const canContinue = selectedAttendees.size >= 2
    return (
      <div style={{ padding: '8px 20px 20px' }}>
        <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#4A6741', fontSize: '14px', fontWeight: '600', fontFamily: 'DM Sans, system-ui, sans-serif', cursor: 'pointer', padding: '4px 0', marginBottom: '16px' }}>
          ← Back
        </button>
        <span style={labelStyle}>Who's coming?</span>
        {crewLoading ? (
          <div style={{ color: 'var(--color-stone)', fontSize: '14px' }}>Loading crew...</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              {crewMembers.map((member) => {
                const selected = selectedAttendees.has(member.uid)
                return (
                  <button
                    key={member.uid}
                    onClick={() => toggleAttendee(member.uid)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: selected ? 1 : 0.4,
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: attendeeColours[member.uid] ?? '#4A6741',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontFamily: 'Fraunces, Georgia, serif',
                      fontSize: '18px',
                      fontWeight: '700',
                      border: selected ? '3px solid #4A6741' : '3px solid transparent',
                      boxSizing: 'border-box',
                    }}>
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '11px', color: 'var(--color-stone)', maxWidth: '54px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.displayName.split(' ')[0]}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setStep(3)}
              disabled={!canContinue}
              className="btn-primary"
              style={{ width: '100%', opacity: canContinue ? 1 : 0.4 }}
            >
              Continue ({selectedAttendees.size} going)
            </button>
          </>
        )}
      </div>
    )
  }

  // Step 3: Vibe
  if (step === 3) {
    const vibeOptions: Array<{ key: Vibe; icon: string; label: string; sub: string }> = [
      { key: 'fishing', icon: '🎣', label: 'Fishing trip', sub: 'Destinations with fishing' },
      { key: 'bush', icon: '🌿', label: 'Bush escape', sub: 'Camping & hiking spots' },
      { key: '4wd', icon: '🚙', label: '4WD adventure', sub: 'Unsealed & 4WD tracks' },
      { key: 'surprise', icon: '🎲', label: 'Surprise me', sub: 'Fully random ranking' },
    ]
    return (
      <div style={{ padding: '8px 20px 20px' }}>
        <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#4A6741', fontSize: '14px', fontWeight: '600', fontFamily: 'DM Sans, system-ui, sans-serif', cursor: 'pointer', padding: '4px 0', marginBottom: '16px' }}>
          ← Back
        </button>
        <span style={labelStyle}>What's the vibe?</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {vibeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSelectVibe(opt.key)}
              style={{
                borderRadius: '16px',
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-surface)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '6px',
                padding: '16px',
                transition: 'all 0.15s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.borderColor = '#4A6741'
                el.style.background = 'rgba(74,103,65,0.04)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.borderColor = 'var(--color-border)'
                el.style.background = 'var(--color-surface)'
              }}
            >
              <span style={{ fontSize: '24px' }}>{opt.icon}</span>
              <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', fontWeight: '700', color: 'var(--color-charcoal)' }}>{opt.label}</span>
              <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '11px', color: 'var(--color-stone)' }}>{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Step 4: Results
  return (
    <div style={{ padding: '8px 20px 20px' }}>
      <button onClick={() => { setStep(0); setRanking([]); setSelectedDestIds(new Set()) }} style={{ background: 'none', border: 'none', color: '#4A6741', fontSize: '14px', fontWeight: '600', fontFamily: 'DM Sans, system-ui, sans-serif', cursor: 'pointer', padding: '4px 0', marginBottom: '16px' }}>
        ← Start over
      </button>

      {isRanking ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '16px' }}>
          <div className="spinner" />
          <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '15px', color: 'var(--color-stone)' }}>Finding your spots...</span>
        </div>
      ) : ranking.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-stone)', fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px' }}>
          No destinations matched. Try a different vibe or crew.
        </div>
      ) : (
        <>
          <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '13px', color: 'var(--color-stone)', marginBottom: '14px' }}>
            Top {ranking.length} spots · Select 2–5 to put to vote
            {selectedDestIds.size > 0 && <span style={{ color: '#4A6741', fontWeight: '600' }}> · {selectedDestIds.size} selected</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {ranking.map((r, i) => (
              <DestinationCard
                key={r.destination.id}
                ranked={r}
                index={i}
                isSelected={selectedDestIds.has(r.destination.id)}
                onToggleSelect={toggleDestSelect}
                mapRef={mapRef}
                attendees={crewMembers.filter((m) => selectedAttendees.has(m.uid))}
                attendeeColours={attendeeColours}
                onViewOnMap={() => {}}
                currentUserUid={currentUser?.uid}
                currentUserDriveCache={currentUser?.driveCache ?? null}
              />
            ))}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-stone)', fontFamily: 'DM Sans, system-ui, sans-serif', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Trip name
              </label>
              <input
                className="input"
                type="text"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder={ranking.length > 0 ? getAutoTripName(ranking[0].destination) : 'Trip name'}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: 'var(--color-stone)', marginBottom: '4px', fontFamily: 'DM Sans, system-ui, sans-serif' }}>From</div>
                <input className="input" type="date" value={dateFrom} min={today} onChange={(e) => setDateFrom(e.target.value)} style={{ fontSize: '14px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: 'var(--color-stone)', marginBottom: '4px', fontFamily: 'DM Sans, system-ui, sans-serif' }}>To</div>
                <input className="input" type="date" value={dateTo} min={dateFrom || today} onChange={(e) => setDateTo(e.target.value)} style={{ fontSize: '14px' }} />
              </div>
            </div>
            <button
              onClick={handleCreateTrip}
              disabled={selectedDestIds.size < 2 || isSaving}
              className="btn-primary"
              style={{ width: '100%', opacity: selectedDestIds.size < 2 ? 0.4 : 1 }}
            >
              {isSaving ? 'Saving...' : `Create & Start Voting (${selectedDestIds.size} destinations)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
