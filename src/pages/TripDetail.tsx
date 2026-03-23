import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc,
  onSnapshot,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase'
import type { Trip, UserProfile } from '../types'
import { destinations as allDestinations } from '../data/destinations'
import type { Destination } from '../data/destinations'
import { calculateCosts } from '../utils/costEngine'
import type { CostLineItem, FuelPrices, CostBreakdown as CostBreakdownData } from '../utils/costEngine'
import CostBreakdown from '../components/CostBreakdown'
import { getDocs, query, where } from 'firebase/firestore'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string
  text: string
  assignee: string | null
  done: boolean
}

interface Comment {
  id: string
  uid: string
  displayName: string
  photoURL: string | null
  text: string
  createdAt: Timestamp | null
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

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
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  if (!end || dateRange.start === dateRange.end) {
    return start.toLocaleDateString('en-AU', opts)
  }
  return `${start.toLocaleDateString('en-AU', opts)} – ${end.toLocaleDateString('en-AU', opts)}`
}

function countdownText(startDate: string): string | null {
  if (!startDate) return null
  const now = new Date()
  const departure = new Date(startDate)
  const diffMs = departure.getTime() - now.getTime()
  if (diffMs <= 0) return null
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (days === 1) return '1 day to go'
  if (days < 7) return `${days} days to go`
  const weeks = Math.floor(days / 7)
  const rem = days % 7
  if (rem === 0) return `${weeks} week${weeks !== 1 ? 's' : ''} to go`
  return `${weeks}w ${rem}d to go`
}

function nightsFromDateRange(dateRange: { start: string; end: string }): number {
  if (!dateRange.start || !dateRange.end) return 1
  const s = new Date(dateRange.start)
  const e = new Date(dateRange.end)
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 1
}

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

function Avatar({ profile, size = 32 }: { profile: UserProfile; size?: number }) {
  if (profile.photoURL) {
    return (
      <img
        src={profile.photoURL}
        alt={profile.displayName}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
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
      {profile.displayName.charAt(0).toUpperCase()}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────

export default function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [tripLoading, setTripLoading] = useState(true)
  const [currentUid, setCurrentUid] = useState<string | null>(null)
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null)
  const [attendeeProfiles, setAttendeeProfiles] = useState<UserProfile[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [newCheckItem, setNewCheckItem] = useState('')
  const [newComment, setNewComment] = useState('')
  const [commentSending, setCommentSending] = useState(false)

  // ── Auth ──
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid ?? null)
    })
  }, [])

  // ── Load current user profile ──
  useEffect(() => {
    if (!currentUid) return
    const unsub = onSnapshot(doc(db, 'users', currentUid), (snap) => {
      if (snap.exists()) {
        setCurrentProfile(snap.data() as UserProfile)
      }
    })
    return unsub
  }, [currentUid])

  // ── Trip real-time listener ──
  useEffect(() => {
    if (!tripId) return
    const unsub = onSnapshot(doc(db, 'trips', tripId), (snap) => {
      if (!snap.exists()) {
        setTripLoading(false)
        return
      }
      setTrip({ id: snap.id, ...snap.data() } as Trip)
      setTripLoading(false)
    })
    return unsub
  }, [tripId])

  // ── Load attendee profiles ──
  useEffect(() => {
    if (!trip || trip.attendees.length === 0) return

    async function loadProfiles() {
      if (!trip) return
      try {
        const q = query(
          collection(db, 'users'),
          where('uid', 'in', trip.attendees.slice(0, 10))
        )
        const snap = await getDocs(q)
        setAttendeeProfiles(snap.docs.map((d) => d.data() as UserProfile))
      } catch (err) {
        console.error('Failed to load attendee profiles:', err)
      }
    }

    loadProfiles()
  }, [trip?.attendees.join(',')])

  // ── Checklist real-time ──
  useEffect(() => {
    if (!tripId) return
    const unsub = onSnapshot(
      collection(db, 'trips', tripId, 'checklist'),
      (snap) => {
        setChecklist(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChecklistItem))
      }
    )
    return unsub
  }, [tripId])

  // ── Comments real-time ──
  useEffect(() => {
    if (!tripId) return
    const unsub = onSnapshot(
      collection(db, 'trips', tripId, 'comments'),
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment)
        all.sort((a, b) => {
          const at = a.createdAt?.toMillis() ?? 0
          const bt = b.createdAt?.toMillis() ?? 0
          return bt - at
        })
        setComments(all)
      }
    )
    return unsub
  }, [tripId])

  // ────────────────────────────────────────────────────────────
  // Cost config helpers
  // ────────────────────────────────────────────────────────────

  const fuelPrices: FuelPrices = trip?.costConfig?.fuelPrices ?? { petrol: 1.90, diesel: 1.85 }
  const dailyFoodRate: number = trip?.costConfig?.dailyFoodRate ?? 30
  const lineItems: CostLineItem[] = (trip?.costConfig?.lineItems ?? []) as CostLineItem[]

  const confirmedDestination: Destination | null = trip?.confirmedDestinationId
    ? (allDestinations.find((d) => d.id === trip.confirmedDestinationId) ?? null)
    : null

  const nights = trip ? nightsFromDateRange(trip.dateRange) : 1

  // Build distancesKm from attendee profiles (we don't have routes here — use 0 as placeholder)
  // In a real integration you'd store routes in Firestore; for now fuel shows as $0 if no distance data
  const distancesKm: Record<string, number> = {}

  const breakdown: CostBreakdownData | null =
    confirmedDestination && attendeeProfiles.length > 0
      ? calculateCosts({
          attendees: attendeeProfiles,
          distancesKm,
          destination: confirmedDestination,
          nights,
          maxBudget: trip?.maxBudget ?? 500,
          fuelPrices,
          dailyFoodRate,
          lineItems,
        })
      : null

  async function updateCostConfig(partial: Partial<Trip['costConfig']>) {
    if (!tripId || !trip) return
    const existing = trip.costConfig ?? {
      fuelPrices: { petrol: 1.90, diesel: 1.85 },
      dailyFoodRate: 30,
      lineItems: [],
    }
    await updateDoc(doc(db, 'trips', tripId), {
      costConfig: { ...existing, ...partial },
    })
  }

  async function handleAddLineItem(item: Omit<CostLineItem, 'id'>) {
    if (!trip) return
    const withId: CostLineItem = {
      ...item,
      id: crypto.randomUUID(),
      addedByUid: currentUid ?? '',
    }
    const existing = lineItems
    await updateCostConfig({ lineItems: [...existing, withId] })
  }

  async function handleRemoveLineItem(id: string) {
    await updateCostConfig({ lineItems: lineItems.filter((li) => li.id !== id) })
  }

  async function handleUpdateFuelPrices(prices: FuelPrices) {
    await updateCostConfig({ fuelPrices: prices })
  }

  async function handleUpdateFoodRate(rate: number) {
    await updateCostConfig({ dailyFoodRate: rate })
  }

  // ────────────────────────────────────────────────────────────
  // Checklist actions
  // ────────────────────────────────────────────────────────────

  async function addCheckItem() {
    if (!tripId || !newCheckItem.trim()) return
    await addDoc(collection(db, 'trips', tripId, 'checklist'), {
      text: newCheckItem.trim(),
      assignee: null,
      done: false,
    })
    setNewCheckItem('')
  }

  async function toggleCheckItem(item: ChecklistItem) {
    if (!tripId) return
    await updateDoc(doc(db, 'trips', tripId, 'checklist', item.id), {
      done: !item.done,
    })
  }

  async function deleteCheckItem(id: string) {
    if (!tripId) return
    await deleteDoc(doc(db, 'trips', tripId, 'checklist', id))
  }

  async function assignCheckItem(item: ChecklistItem, assignee: string | null) {
    if (!tripId) return
    await updateDoc(doc(db, 'trips', tripId, 'checklist', item.id), { assignee })
  }

  // ────────────────────────────────────────────────────────────
  // Comment actions
  // ────────────────────────────────────────────────────────────

  async function sendComment() {
    if (!tripId || !newComment.trim() || !currentProfile) return
    setCommentSending(true)
    try {
      await addDoc(collection(db, 'trips', tripId, 'comments'), {
        uid: currentProfile.uid,
        displayName: currentProfile.displayName,
        photoURL: currentProfile.photoURL,
        text: newComment.trim(),
        createdAt: serverTimestamp(),
      })
      setNewComment('')
    } catch (err) {
      console.error('Failed to send comment:', err)
    } finally {
      setCommentSending(false)
    }
  }

  // ────────────────────────────────────────────────────────────
  // Render states
  // ────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    fontFamily: 'DM Sans, system-ui, sans-serif',
    fontSize: '14px',
    padding: '10px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    background: 'var(--color-base)',
    color: 'var(--color-charcoal)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  if (tripLoading) {
    return (
      <div
        style={{
          minHeight: 'calc(100dvh - var(--tab-bar-height) - env(safe-area-inset-bottom))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div className="spinner" />
        <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', color: 'var(--color-stone)' }}>
          Loading trip...
        </span>
      </div>
    )
  }

  if (!trip) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          color: 'var(--color-stone)',
        }}
      >
        Trip not found.
        <br />
        <button
          onClick={() => navigate('/trips')}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            background: '#4A6741',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontSize: '14px',
          }}
        >
          Back to Trips
        </button>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[trip.status] ?? STATUS_CONFIG.proposed
  const isConfirmedOrBeyond = ['confirmed', 'active', 'completed'].includes(trip.status)
  const isEditable = ['confirmed', 'active'].includes(trip.status)
  const countdown = countdownText(trip.dateRange.start)

  const selectedDestinations: Destination[] = trip.selectedDestinationIds
    .map((id) => allDestinations.find((d) => d.id === id))
    .filter((d): d is Destination => d !== undefined)

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - var(--tab-bar-height) - env(safe-area-inset-bottom))',
        backgroundColor: 'var(--color-base)',
      }}
    >
      {/* Back header */}
      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <button
          onClick={() => navigate('/trips')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--color-stone)',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span
          style={{
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontSize: '14px',
            color: 'var(--color-stone)',
          }}
        >
          Trips
        </span>
      </div>

      <div style={{ padding: '16px 20px 40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Trip name + status */}
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
            <h1
              style={{
                fontFamily: 'Fraunces, Georgia, serif',
                fontSize: '26px',
                fontWeight: '700',
                color: 'var(--color-charcoal)',
                margin: 0,
                flex: 1,
              }}
            >
              {trip.name || 'Untitled Trip'}
            </h1>
            <span
              style={{
                fontSize: '12px',
                fontWeight: '600',
                borderRadius: '100px',
                padding: '4px 10px',
                backgroundColor: statusCfg.bg,
                color: statusCfg.color,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                marginTop: '4px',
              }}
            >
              {statusCfg.label}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '13px',
              color: 'var(--color-stone)',
            }}
          >
            {trip.dateRange?.start && (
              <span>📅 {formatDateRange(trip.dateRange)}</span>
            )}
            {countdown && (
              <span
                style={{
                  color: '#4A6741',
                  fontWeight: '600',
                }}
              >
                {countdown}
              </span>
            )}
          </div>
        </div>

        {/* ────── PROPOSED / VOTING ────── */}
        {!isConfirmedOrBeyond && (
          <>
            {/* Destinations list */}
            {selectedDestinations.length > 0 && (
              <section>
                <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '18px', fontWeight: '700', color: 'var(--color-charcoal)', margin: '0 0 12px' }}>
                  Destinations
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDestinations.map((dest) => (
                    <div
                      key={dest.id}
                      style={{
                        background: 'var(--color-surface)',
                        borderRadius: '10px',
                        border: '1px solid var(--color-border)',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--color-charcoal)' }}>
                          {dest.name}
                        </div>
                        <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '12px', color: 'var(--color-stone)' }}>
                          {dest.region}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Attending members */}
            <section>
              <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '18px', fontWeight: '700', color: 'var(--color-charcoal)', margin: '0 0 12px' }}>
                Attending ({trip.attendees.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {attendeeProfiles.map((p) => (
                  <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar profile={p} size={32} />
                    <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', color: 'var(--color-charcoal)' }}>
                      {p.displayName}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Voting placeholder */}
            <div
              style={{
                background: 'rgba(124,92,191,0.06)',
                border: '1px dashed rgba(124,92,191,0.3)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗳</div>
              <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', color: '#7C5CBF', fontWeight: '600' }}>
                Voting coming in Stage 5
              </div>
            </div>
          </>
        )}

        {/* ────── CONFIRMED / ACTIVE / COMPLETED ────── */}
        {isConfirmedOrBeyond && (
          <>
            {/* Confirmed destination */}
            {confirmedDestination && (
              <div
                style={{
                  background: 'rgba(74,103,65,0.06)',
                  border: '1px solid rgba(74,103,65,0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '24px' }}>📍</div>
                <div>
                  <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '16px', fontWeight: '700', color: '#4A6741' }}>
                    {confirmedDestination.name}
                  </div>
                  <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '13px', color: 'var(--color-stone)' }}>
                    {confirmedDestination.region} · {nights} night{nights !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            )}

            {/* Attending members */}
            <section>
              <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '18px', fontWeight: '700', color: 'var(--color-charcoal)', margin: '0 0 12px' }}>
                Attending ({trip.attendees.length})
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {attendeeProfiles.map((p) => (
                  <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar profile={p} size={28} />
                    <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '13px', color: 'var(--color-charcoal)' }}>
                      {p.displayName}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Cost Breakdown */}
            {breakdown && confirmedDestination ? (
              <CostBreakdown
                breakdown={breakdown}
                maxBudget={trip.maxBudget}
                editable={isEditable}
                nights={nights}
                lineItems={lineItems}
                fuelPrices={fuelPrices}
                dailyFoodRate={dailyFoodRate}
                onAddLineItem={isEditable ? handleAddLineItem : undefined}
                onRemoveLineItem={isEditable ? handleRemoveLineItem : undefined}
                onUpdateFuelPrices={isEditable ? handleUpdateFuelPrices : undefined}
                onUpdateFoodRate={isEditable ? handleUpdateFoodRate : undefined}
              />
            ) : (
              <div
                style={{
                  background: 'rgba(140,133,120,0.06)',
                  border: '1px dashed var(--color-border)',
                  borderRadius: '12px',
                  padding: '24px',
                  textAlign: 'center',
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  fontSize: '14px',
                  color: 'var(--color-stone)',
                }}
              >
                No confirmed destination yet — cost breakdown will appear here.
              </div>
            )}

            {/* Map placeholder */}
            <div
              style={{
                background: 'rgba(74,103,65,0.04)',
                border: '1px dashed rgba(74,103,65,0.25)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗺</div>
              <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', color: 'var(--color-stone)' }}>
                Routes shown on the main map
              </div>
            </div>

            {/* Checklist */}
            <section>
              <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '18px', fontWeight: '700', color: 'var(--color-charcoal)', margin: '0 0 12px' }}>
                Checklist
              </h2>

              {checklist.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: 'var(--color-surface)',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleCheckItem(item)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#4A6741', flexShrink: 0 }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontFamily: 'DM Sans, system-ui, sans-serif',
                          fontSize: '14px',
                          color: item.done ? 'var(--color-stone)' : 'var(--color-charcoal)',
                          textDecoration: item.done ? 'line-through' : 'none',
                        }}
                      >
                        {item.text}
                      </span>
                      {item.assignee && (
                        <span
                          style={{
                            fontFamily: 'DM Sans, system-ui, sans-serif',
                            fontSize: '12px',
                            color: 'var(--color-stone)',
                            background: 'rgba(140,133,120,0.1)',
                            borderRadius: '100px',
                            padding: '2px 8px',
                          }}
                        >
                          {item.assignee}
                        </span>
                      )}
                      {/* Assign to self */}
                      {currentProfile && item.assignee !== currentProfile.displayName && (
                        <button
                          onClick={() => assignCheckItem(item, currentProfile.displayName)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: 'var(--color-stone)',
                            padding: '2px 4px',
                          }}
                          title="Assign to me"
                        >
                          +me
                        </button>
                      )}
                      <button
                        onClick={() => deleteCheckItem(item.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#E07A5F',
                          fontSize: '16px',
                          lineHeight: 1,
                          padding: '2px 4px',
                        }}
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Add item..."
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCheckItem() }}
                />
                <button
                  onClick={addCheckItem}
                  style={{
                    padding: '10px 16px',
                    background: '#4A6741',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Add
                </button>
              </div>
            </section>

            {/* Comments */}
            <section>
              <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '18px', fontWeight: '700', color: 'var(--color-charcoal)', margin: '0 0 12px' }}>
                Comments
              </h2>

              {/* New comment input */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {currentProfile && (
                  <Avatar profile={currentProfile} size={32} />
                )}
                <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendComment() }}
                  />
                  <button
                    onClick={sendComment}
                    disabled={commentSending || !newComment.trim()}
                    style={{
                      padding: '10px 16px',
                      background: commentSending || !newComment.trim() ? 'rgba(74,103,65,0.4)' : '#4A6741',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: commentSending || !newComment.trim() ? 'default' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      fontFamily: 'DM Sans, system-ui, sans-serif',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Comments list (newest first) */}
              {comments.length === 0 ? (
                <div
                  style={{
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                    fontSize: '14px',
                    color: 'var(--color-stone)',
                    textAlign: 'center',
                    padding: '20px',
                  }}
                >
                  No comments yet. Be the first.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {comments.map((c) => {
                    const avatarProfile: UserProfile = {
                      uid: c.uid,
                      displayName: c.displayName,
                      photoURL: c.photoURL,
                      email: '',
                      homeLocation: null,
                      vehicles: [],
                      createdAt: new Date(),
                      onboardingComplete: true,
                    }
                    const ts = c.createdAt?.toDate()
                    return (
                      <div key={c.id} style={{ display: 'flex', gap: '10px' }}>
                        <Avatar profile={avatarProfile} size={32} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '13px', fontWeight: '600', color: 'var(--color-charcoal)' }}>
                              {c.displayName}
                            </span>
                            {ts && (
                              <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '11px', color: 'var(--color-stone)' }}>
                                {ts.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                                {' '}
                                {ts.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', color: 'var(--color-charcoal)', lineHeight: '1.5' }}>
                            {c.text}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
