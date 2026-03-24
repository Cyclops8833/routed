import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import type { UserProfile } from '../types'
import { longWeekends, type LongWeekend } from '../data/longWeekends'
import {
  subscribeToAllAvailability,
  setWeekendAvailability,
  removeWeekendAvailability,
  setCustomAvailability,
  removeAvailability,
  type Availability,
} from '../utils/availabilityUtils'
import { useNavigate } from 'react-router-dom'

const PENDING_DATES_KEY = 'routed-pending-trip-dates'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function isPast(endDate: string): boolean {
  return new Date(endDate) < new Date()
}

type AvailStatus = 'available' | 'unavailable' | 'none'

function MemberAvatar({ member, size = 28 }: { member: UserProfile; size?: number }) {
  const src = member.customPhotoURL ?? member.photoURL
  if (src) {
    return (
      <img
        src={src}
        alt={member.displayName}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#4A6741',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: '700',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        flexShrink: 0,
      }}
    >
      {member.displayName.charAt(0).toUpperCase()}
    </div>
  )
}

interface WeekendCardProps {
  lw: LongWeekend
  allMembers: UserProfile[]
  currentUid: string | null
  availabilityData: Availability[]
}

function WeekendCard({ lw, allMembers, currentUid, availabilityData }: WeekendCardProps) {
  const navigate = useNavigate()

  // Get availability for this weekend
  function getMemberStatus(uid: string): AvailStatus {
    const avail = availabilityData.find(
      (a) => a.weekendId === lw.id && a.memberUid === uid
    )
    if (!avail) return 'none'
    return avail.available ? 'available' : 'unavailable'
  }

  const past = isPast(lw.endDate)

  async function handleToggle(uid: string) {
    if (uid !== currentUid || past) return
    const current = getMemberStatus(uid)
    if (current === 'none') {
      await setWeekendAvailability(uid, lw.id, true)
    } else if (current === 'available') {
      await setWeekendAvailability(uid, lw.id, false)
    } else {
      // unavailable → none
      await removeWeekendAvailability(uid, lw.id)
    }
  }

  const availCount = allMembers.filter((m) => getMemberStatus(m.uid) === 'available').length
  const unavailCount = allMembers.filter((m) => getMemberStatus(m.uid) === 'unavailable').length
  const noResponseCount = allMembers.length - availCount - unavailCount
  const crewCanMakeIt = availCount >= 5

  const currentUserAvailable = currentUid ? getMemberStatus(currentUid) === 'available' : false

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: crewCanMakeIt ? '1.5px solid rgba(74,103,65,0.4)' : '1px solid var(--color-border)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: crewCanMakeIt ? '0 0 16px rgba(74,103,65,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
        opacity: past ? 0.5 : 1,
        minWidth: '280px',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '18px', fontWeight: '700', color: 'var(--color-charcoal)', marginBottom: '2px' }}>
          {lw.name}
        </div>
        <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', color: 'var(--color-stone)' }}>
          {formatDateShort(lw.startDate)} – {formatDateShort(lw.endDate)}
        </div>
        {lw.notes && (
          <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '12px', color: 'var(--color-stone)', fontStyle: 'italic', marginTop: '2px' }}>
            {lw.notes}
          </div>
        )}
        {crewCanMakeIt && (
          <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#4A6741', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
            The boys could make this one!
          </div>
        )}
      </div>

      {/* Member rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {allMembers.map((member) => {
          const status = getMemberStatus(member.uid)
          const isCurrentUser = member.uid === currentUid
          return (
            <div
              key={member.uid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: isCurrentUser && !past ? 'pointer' : 'default',
              }}
              onClick={() => handleToggle(member.uid)}
            >
              <MemberAvatar member={member} size={28} />
              <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '13px', color: 'var(--color-charcoal)', flex: 1 }}>
                {member.displayName}
                {isCurrentUser && <span style={{ color: 'var(--color-stone)', fontSize: '11px' }}> (you)</span>}
              </span>
              <span style={{ fontSize: '16px', lineHeight: 1 }}>
                {status === 'available' ? '✅' : status === 'unavailable' ? '❌' : '⬜'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Tally */}
      <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '12px', color: 'var(--color-stone)', marginBottom: '12px' }}>
        {availCount} available · {unavailCount} unavailable · {noResponseCount} no response
      </div>

      {/* Plan trip button */}
      {!past && currentUserAvailable && (
        <button
          onClick={() => {
            try {
              localStorage.setItem(PENDING_DATES_KEY, JSON.stringify({ from: lw.startDate, to: lw.endDate }))
            } catch { /* ignore */ }
            navigate('/map')
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '8px',
            background: '#4A6741',
            border: 'none',
            color: 'white',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#3d5636' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#4A6741' }}
        >
          Plan a trip for this weekend
        </button>
      )}
    </div>
  )
}

export default function AvailabilityPage() {
  const [currentUid, setCurrentUid] = useState<string | null>(null)
  const [allMembers, setAllMembers] = useState<UserProfile[]>([])
  const [availabilityData, setAvailabilityData] = useState<Availability[]>([])
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const today = new Date().toISOString().split('T')[0]

  // Upcoming long weekends only
  const upcomingLW = longWeekends.filter((lw) => !isPast(lw.endDate))

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid ?? null)
    })
    return unsub
  }, [])

  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then((snap) => setAllMembers(snap.docs.map((d) => d.data() as UserProfile)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const unsub = subscribeToAllAvailability(setAvailabilityData)
    return unsub
  }, [])

  const customEntries = availabilityData.filter((a) => a.weekendId === null)
  const myCustomEntries = customEntries.filter((a) => a.memberUid === currentUid)
  const othersCustomEntries = customEntries.filter((a) => a.memberUid !== currentUid)

  async function handleAddCustom() {
    if (!currentUid || !customStart || !customEnd) return
    await setCustomAvailability(currentUid, customStart, customEnd)
    setCustomStart('')
    setCustomEnd('')
    setShowCustomPicker(false)
  }

  async function handleRemoveCustom(id: string) {
    if (!id) return
    await removeAvailability(id)
  }

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - var(--tab-bar-height) - env(safe-area-inset-bottom))',
        backgroundColor: 'var(--color-base)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '32px 20px 24px',
          backgroundColor: 'var(--color-base)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h1
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--color-charcoal)',
            margin: '0 0 4px',
          }}
        >
          When's everyone free?
        </h1>
        <p
          style={{
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontSize: '14px',
            color: 'var(--color-stone)',
            margin: 0,
          }}
        >
          Mark your availability for upcoming long weekends
        </p>
      </div>

      {/* Long weekends section */}
      <div style={{ padding: '20px 16px 0' }}>
        <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '20px', fontWeight: '700', color: 'var(--color-charcoal)', margin: '0 0 12px' }}>
          Long Weekends
        </h2>
      </div>

      {upcomingLW.length === 0 ? (
        <div style={{ padding: '0 16px 24px' }}>
          <p style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', color: 'var(--color-stone)', fontStyle: 'italic' }}>
            No upcoming long weekends — check back soon.
          </p>
        </div>
      ) : (
        <div
          style={{
            padding: '0 16px 20px',
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {upcomingLW.map((lw) => (
            <WeekendCard
              key={lw.id}
              lw={lw}
              allMembers={allMembers}
              currentUid={currentUid}
              availabilityData={availabilityData}
            />
          ))}
        </div>
      )}

      {/* Custom availability section */}
      <div style={{ padding: '0 16px 32px', borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
        <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '20px', fontWeight: '700', color: 'var(--color-charcoal)', margin: '0 0 8px' }}>
          Other dates I'm free
        </h2>
        <p style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '13px', color: 'var(--color-stone)', margin: '0 0 12px' }}>
          Mark custom date ranges when you're available
        </p>

        {/* My custom entries */}
        {myCustomEntries.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {myCustomEntries.map((a) => (
              <span
                key={a.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '100px',
                  background: 'rgba(74,103,65,0.1)',
                  border: '1px solid rgba(74,103,65,0.25)',
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  fontSize: '13px',
                  color: '#4A6741',
                }}
              >
                {formatDateShort(a.startDate)} – {formatDateShort(a.endDate)}
                <button
                  onClick={() => a.id && handleRemoveCustom(a.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '14px',
                    color: '#4A6741',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add custom dates */}
        {!showCustomPicker ? (
          <button
            onClick={() => setShowCustomPicker(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'none',
              border: '1.5px solid rgba(74,103,65,0.4)',
              color: '#4A6741',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,103,65,0.06)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
          >
            + Mark other dates I'm free
          </button>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '12px', color: 'var(--color-stone)', marginBottom: '4px' }}>From</label>
              <input
                type="date"
                value={customStart}
                min={today}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', background: 'var(--color-surface)', color: 'var(--color-charcoal)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '12px', color: 'var(--color-stone)', marginBottom: '4px' }}>To</label>
              <input
                type="date"
                value={customEnd}
                min={customStart || today}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', background: 'var(--color-surface)', color: 'var(--color-charcoal)' }}
              />
            </div>
            <button
              onClick={handleAddCustom}
              disabled={!customStart || !customEnd}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: customStart && customEnd ? '#4A6741' : 'rgba(74,103,65,0.3)',
                border: 'none',
                color: 'white',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: '600',
                cursor: customStart && customEnd ? 'pointer' : 'not-allowed',
              }}
            >
              Add
            </button>
            <button
              onClick={() => { setShowCustomPicker(false); setCustomStart(''); setCustomEnd('') }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'none',
                border: '1px solid var(--color-border)',
                color: 'var(--color-stone)',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Others' custom ranges (read-only) */}
        {othersCustomEntries.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '15px', fontWeight: '600', color: 'var(--color-charcoal)', margin: '0 0 8px' }}>
              Crew's other dates
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {othersCustomEntries.map((a) => {
                const member = allMembers.find((m) => m.uid === a.memberUid)
                return (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontFamily: 'DM Sans, system-ui, sans-serif',
                      fontSize: '13px',
                      color: 'var(--color-stone)',
                    }}
                  >
                    {member && <MemberAvatar member={member} size={20} />}
                    <span>{member?.displayName ?? 'Unknown'}</span>
                    <span>·</span>
                    <span>{formatDate(a.startDate)} – {formatDate(a.endDate)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
