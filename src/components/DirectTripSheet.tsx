/**
 * DirectTripSheet — streamlined trip creation when a destination is pre-selected
 * from the map popup. Skips all browsing/ranking. Shows the destination locked in,
 * then collects: trip name, date range, crew. Submits immediately.
 */
import { useState, useEffect } from 'react'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { useCrewContext } from '../contexts/CrewContext'
import { useNavigate } from 'react-router-dom'
import { db, auth } from '../firebase'
import { sendNotification } from '../utils/notifications'
import { destinations } from '../data/destinations'
import type { UserProfile } from '../types'

interface DirectTripSheetProps {
  destinationId: string
  currentUser: UserProfile | null
  onClose: () => void
  onChangeDest: () => void // "Change" link → back to picker
}

const today = new Date().toISOString().split('T')[0]

function calcNights(start: string, end: string): number {
  if (!start || !end) return 2
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return Math.max(1, Math.ceil((e - s) / 86400000))
}

export default function DirectTripSheet({
  destinationId,
  currentUser,
  onClose,
  onChangeDest,
}: DirectTripSheetProps) {
  const navigate = useNavigate()
  const dest = destinations.find((d) => d.id === destinationId)
  const { allUsers } = useCrewContext()

  const [crewMembers, setCrewMembers] = useState<UserProfile[]>([])
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set())
  const [tripName, setTripName] = useState(dest?.name ?? '')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync crew from context
  useEffect(() => {
    const profiles = allUsers
    setCrewMembers(profiles)
    setSelectedAttendees(new Set(profiles.map((p) => p.uid)))
  }, [allUsers])

  if (!dest) {
    return (
      <div style={{ padding: '24px 20px', fontFamily: 'DM Sans, system-ui, sans-serif', color: 'var(--color-stone)' }}>
        Destination not found.
      </div>
    )
  }

  const nights = calcNights(dateFrom, dateTo)
  const tripLength: 'overnighter' | 'long-weekend' = nights <= 1 ? 'overnighter' : 'long-weekend'

  const toggleAttendee = (uid: string) => {
    setSelectedAttendees((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!currentUser) return
    if (!tripName.trim()) { setError('Give the trip a name'); return }
    if (!dateTo) { setError('Pick an end date'); return }
    if (selectedAttendees.size < 1) { setError('Select at least one crew member'); return }

    setSaving(true)
    setError(null)
    try {
      const ref = await addDoc(collection(db, 'trips'), {
        name: tripName.trim(),
        dateRange: { start: dateFrom, end: dateTo },
        tripLength,
        maxBudget: 300,
        creatorUid: currentUser.uid,
        attendees: Array.from(selectedAttendees),
        selectedDestinationIds: [dest.id],
        status: 'proposed',
        createdAt: Timestamp.now(),
      })
      // D-06: trip_proposed — notify all crew except creator (fire-and-forget)
      const creatorName = auth.currentUser?.displayName ?? 'Someone'
      const recipientTokens = allUsers
        .filter((u) => u.uid !== auth.currentUser?.uid && u.fcmToken)
        .map((u) => u.fcmToken!)
      if (recipientTokens.length > 0) {
        sendNotification(recipientTokens, {
          title: `${creatorName} proposed a trip to ${dest.name}`,
          body: 'Open Routed to check it out.',
        })
      }
      onClose()
      navigate(`/trips/${ref.id}`)
    } catch {
      setError('Failed to create trip. Try again.')
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-charcoal)',
    fontFamily: 'DM Sans, system-ui, sans-serif',
    fontSize: '15px',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--color-stone)',
    fontFamily: 'DM Sans, system-ui, sans-serif',
    marginBottom: '6px',
  }

  return (
    <div style={{ padding: '8px 20px 100px', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      {/* Header */}
      <h2 style={{
        fontFamily: 'Fraunces, Georgia, serif',
        fontSize: '22px',
        fontWeight: '700',
        color: 'var(--color-charcoal)',
        margin: '0 0 20px',
      }}>
        Plan a Trip
      </h2>

      {/* Locked destination card */}
      <div style={{
        borderRadius: '14px',
        border: '2px solid var(--color-moss)',
        background: 'rgba(74,103,65,0.06)',
        padding: '14px 16px',
        marginBottom: '24px',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: '17px',
              fontWeight: '700',
              color: 'var(--color-charcoal)',
              marginBottom: '4px',
              lineHeight: 1.2,
            }}>
              {dest.name}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                background: 'rgba(74,103,65,0.12)',
                color: 'var(--color-moss)',
                borderRadius: '100px',
                padding: '2px 8px',
              }}>
                {dest.region}
              </span>
              {dest.roadType === '4wd-only' && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  background: 'rgba(196,137,59,0.1)',
                  color: '#C4893B',
                  borderRadius: '100px',
                  padding: '2px 8px',
                }}>
                  🚙 4WD Only
                </span>
              )}
              <span style={{ fontSize: '11px', color: 'var(--color-stone)', fontFamily: 'JetBrains Mono, monospace' }}>
                {dest.campsiteCostPerNight === 0 ? '⛺ Free' : `⛺ $${dest.campsiteCostPerNight}/night`}
              </span>
            </div>
            {dest.crewNotes && (
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: 'var(--color-stone)',
                fontStyle: 'italic',
                lineHeight: 1.5,
              }}>
                "{dest.crewNotes}"
              </div>
            )}
          </div>
          <button
            onClick={onChangeDest}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-moss)',
              fontSize: '13px',
              fontWeight: '600',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              cursor: 'pointer',
              padding: '2px 0',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Change
          </button>
        </div>
      </div>

      {/* Trip name */}
      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle}>Trip name</label>
        <input
          type="text"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          placeholder={`Trip to ${dest.nearestTown}`}
          style={inputStyle}
        />
      </div>

      {/* Date range */}
      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle}>Dates</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--color-stone)', marginBottom: '4px' }}>From</div>
            <input
              type="date"
              value={dateFrom}
              min={today}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ ...inputStyle }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--color-stone)', marginBottom: '4px' }}>To</div>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || today}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ ...inputStyle }}
            />
          </div>
        </div>
        {dateTo && (
          <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-stone)' }}>
            {nights} night{nights !== 1 ? 's' : ''} · {tripLength === 'overnighter' ? 'Overnighter' : 'Long weekend'}
          </div>
        )}
      </div>

      {/* Crew selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Who's coming</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {crewMembers.map((member) => {
            const checked = selectedAttendees.has(member.uid)
            return (
              <label
                key={member.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: `1.5px solid ${checked ? 'var(--color-moss)' : 'var(--color-border)'}`,
                  background: checked ? 'rgba(74,103,65,0.05)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAttendee(member.uid)}
                  style={{ display: 'none' }}
                />
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: checked ? 'var(--color-moss)' : 'var(--color-border)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '700',
                  flexShrink: 0,
                  transition: 'background 0.15s ease',
                }}>
                  {member.displayName[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-charcoal)' }}>
                    {member.displayName}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-stone)' }}>
                    {member.homeLocation?.suburb ?? ''}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '16px' }}>
                  {checked ? '✓' : ''}
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'rgba(224,122,95,0.1)',
          color: '#E07A5F',
          fontSize: '13px',
          fontWeight: '600',
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '14px',
          background: saving ? 'var(--color-stone)' : 'var(--color-moss)',
          color: '#FAFAF7',
          border: 'none',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          fontSize: '15px',
          fontWeight: '700',
          cursor: saving ? 'not-allowed' : 'pointer',
          letterSpacing: '0.01em',
        }}
      >
        {saving ? 'Creating trip…' : `Let's go → ${dest.nearestTown}`}
      </button>
    </div>
  )
}
