import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Trip, Vote } from '../types'
import { destinations as allDestinations } from '../data/destinations'
import type { Destination } from '../data/destinations'
import { closeVoting } from '../utils/tripActions'

interface VotingPanelProps {
  trip: Trip
  currentUserUid: string
  isCreator: boolean
  onTripUpdate: (updates: Partial<Trip>) => void
}

function countdownLabel(deadline: string): string {
  const now = new Date()
  const end = new Date(deadline)
  const diffMs = end.getTime() - now.getTime()
  if (diffMs <= 0) return 'Closed'
  const totalMinutes = Math.floor(diffMs / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `Closes in ${days}d ${hours}h`
  if (hours > 0) return `Closes in ${hours}h ${minutes}m`
  return `Closes in ${minutes}m`
}

function InitialsAvatar({ name, size = 24 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
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
        fontSize: size * 0.38,
        fontWeight: '700',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        flexShrink: 0,
        border: '1.5px solid white',
      }}
      title={name}
    >
      {initials}
    </div>
  )
}

export default function VotingPanel({
  trip,
  currentUserUid,
  isCreator,
  onTripUpdate,
}: VotingPanelProps) {
  const [votes, setVotes] = useState<Vote[]>([])
  const [deadlineLabel, setDeadlineLabel] = useState<string>('')
  const [tieBreaker, setTieBreaker] = useState<string>('')
  const [showTieBreaker, setShowTieBreaker] = useState(false)
  const [confirmingWinner, setConfirmingWinner] = useState(false)

  // Real-time votes listener
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'trips', trip.id, 'votes'),
      (snap) => {
        const loaded = snap.docs.map((d) => d.data() as Vote)
        setVotes(loaded)
      }
    )
    return unsub
  }, [trip.id])

  // Countdown ticker
  useEffect(() => {
    if (!trip.votingDeadline) return
    setDeadlineLabel(countdownLabel(trip.votingDeadline))
    const interval = setInterval(() => {
      if (trip.votingDeadline) {
        setDeadlineLabel(countdownLabel(trip.votingDeadline))
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [trip.votingDeadline])

  const selectedDestinations: Destination[] = trip.selectedDestinationIds
    .map((id) => allDestinations.find((d) => d.id === id))
    .filter((d): d is Destination => d !== undefined)

  const myVote = votes.find((v) => v.uid === currentUserUid)
  const totalMembers = trip.attendees.length
  const votedCount = votes.length
  const allVoted = votedCount >= totalMembers

  // Tally votes per destination
  const tally: Record<string, Vote[]> = {}
  for (const dest of selectedDestinations) {
    tally[dest.id] = votes.filter((v) => v.destinationId === dest.id)
  }

  // Check for tie (used when confirming winner)
  function getTiedDestinations(): Destination[] {
    if (selectedDestinations.length === 0) return []
    const maxVotes = Math.max(...selectedDestinations.map((d) => tally[d.id]?.length ?? 0))
    return selectedDestinations.filter((d) => (tally[d.id]?.length ?? 0) === maxVotes)
  }

  async function castVote(destinationId: string) {
    await setDoc(doc(db, 'trips', trip.id, 'votes', currentUserUid), {
      uid: currentUserUid,
      destinationId,
      votedAt: Timestamp.now(),
    })
  }

  async function handleCloseVoting() {
    const tied = getTiedDestinations()
    if (tied.length > 1) {
      setShowTieBreaker(true)
      setTieBreaker(tied[0].id)
    } else if (tied.length === 1) {
      await closeVoting(trip.id, tied[0].id)
      onTripUpdate({ status: 'confirmed', confirmedDestinationId: tied[0].id })
    }
  }

  async function handleConfirmWinner() {
    if (!tieBreaker) return
    setConfirmingWinner(true)
    try {
      await closeVoting(trip.id, tieBreaker)
      onTripUpdate({ status: 'confirmed', confirmedDestinationId: tieBreaker })
    } finally {
      setConfirmingWinner(false)
      setShowTieBreaker(false)
    }
  }

  async function handleConfirmWhenAllVoted() {
    const tied = getTiedDestinations()
    if (tied.length > 1) {
      setShowTieBreaker(true)
      setTieBreaker(tied[0].id)
    } else if (tied.length === 1) {
      setConfirmingWinner(true)
      try {
        await closeVoting(trip.id, tied[0].id)
        onTripUpdate({ status: 'confirmed', confirmedDestinationId: tied[0].id })
      } finally {
        setConfirmingWinner(false)
      }
    }
  }

  const isWinner = (destId: string): boolean => {
    if (trip.status !== 'confirmed') return false
    return trip.confirmedDestinationId === destId
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <h2
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: '20px',
            fontWeight: '700',
            color: 'var(--color-charcoal)',
            margin: 0,
          }}
        >
          Vote for your pick
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {trip.votingDeadline && deadlineLabel && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: '600',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                padding: '4px 10px',
                borderRadius: '100px',
                background: 'rgba(196,137,59,0.12)',
                color: '#C4893B',
                whiteSpace: 'nowrap',
              }}
            >
              {deadlineLabel}
            </span>
          )}
          {isCreator && (
            <button
              onClick={handleCloseVoting}
              style={{
                fontSize: '12px',
                fontWeight: '600',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                padding: '5px 12px',
                borderRadius: '100px',
                background: '#E07A5F',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Close voting
            </button>
          )}
        </div>
      </div>

      {/* Destination cards */}
      {selectedDestinations.map((dest) => {
        const destVotes = tally[dest.id] ?? []
        const myVoteIsThis = myVote?.destinationId === dest.id
        const hasVotedElsewhere = myVote && !myVoteIsThis
        const votePercent = totalMembers > 0 ? (destVotes.length / totalMembers) * 100 : 0
        const winner = isWinner(dest.id)

        return (
          <div
            key={dest.id}
            style={{
              background: 'var(--color-surface)',
              borderRadius: '12px',
              border: winner
                ? '2px solid #C4893B'
                : '1px solid var(--color-border)',
              padding: '14px',
              boxShadow: winner
                ? '0 0 0 3px rgba(196,137,59,0.15)'
                : '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {/* Destination header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <div
                  style={{
                    fontFamily: 'Fraunces, Georgia, serif',
                    fontSize: '16px',
                    fontWeight: '700',
                    color: 'var(--color-charcoal)',
                  }}
                >
                  {dest.name}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'DM Sans, system-ui, sans-serif',
                      padding: '2px 8px',
                      borderRadius: '100px',
                      background: 'rgba(140,133,120,0.1)',
                      color: 'var(--color-stone)',
                    }}
                  >
                    {dest.region}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'DM Sans, system-ui, sans-serif',
                      padding: '2px 8px',
                      borderRadius: '100px',
                      background: dest.roadType === '4wd-only'
                        ? 'rgba(196,137,59,0.1)'
                        : 'rgba(74,103,65,0.1)',
                      color: dest.roadType === '4wd-only' ? '#C4893B' : '#4A6741',
                    }}
                  >
                    {dest.roadType === '4wd-only' ? '4WD only' : dest.roadType === 'unsealed' ? 'Unsealed' : 'Sealed'}
                  </span>
                  {dest.campsiteCostPerNight === 0 ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'DM Sans, system-ui, sans-serif',
                        padding: '2px 8px',
                        borderRadius: '100px',
                        background: 'rgba(74,103,65,0.1)',
                        color: '#4A6741',
                      }}
                    >
                      Free camping
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'DM Sans, system-ui, sans-serif',
                        padding: '2px 8px',
                        borderRadius: '100px',
                        background: 'rgba(140,133,120,0.08)',
                        color: 'var(--color-stone)',
                      }}
                    >
                      ${dest.campsiteCostPerNight}/night
                    </span>
                  )}
                </div>
              </div>
              {winner && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                    padding: '4px 10px',
                    borderRadius: '100px',
                    background: 'rgba(196,137,59,0.15)',
                    color: '#C4893B',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Winner 🏆
                </span>
              )}
            </div>

            {/* Vote bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {destVotes.map((v) => (
                    <InitialsAvatar key={v.uid} name={v.uid.slice(0, 2)} size={20} />
                  ))}
                </div>
                <span
                  style={{
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                    fontSize: '12px',
                    color: 'var(--color-stone)',
                  }}
                >
                  {destVotes.length} / {totalMembers} voted
                </span>
              </div>
              <div
                style={{
                  height: '6px',
                  background: 'rgba(140,133,120,0.15)',
                  borderRadius: '100px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${votePercent}%`,
                    background: '#4A6741',
                    borderRadius: '100px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            {/* Vote button */}
            {trip.status === 'voting' && (
              <button
                onClick={myVoteIsThis ? undefined : () => castVote(dest.id)}
                disabled={myVoteIsThis}
                style={{
                  alignSelf: 'flex-start',
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: myVoteIsThis
                    ? '1.5px solid #4A6741'
                    : hasVotedElsewhere
                    ? '1.5px solid var(--color-border)'
                    : '1.5px solid #4A6741',
                  background: myVoteIsThis
                    ? 'rgba(74,103,65,0.08)'
                    : hasVotedElsewhere
                    ? 'var(--color-surface)'
                    : '#4A6741',
                  color: myVoteIsThis
                    ? '#4A6741'
                    : hasVotedElsewhere
                    ? 'var(--color-stone)'
                    : 'white',
                  cursor: myVoteIsThis ? 'default' : 'pointer',
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: '600',
                }}
              >
                {myVoteIsThis ? 'Your pick ✓' : hasVotedElsewhere ? 'Change vote' : 'Vote for this'}
              </button>
            )}
          </div>
        )
      })}

      {/* Footer progress */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: '10px',
          border: '1px solid var(--color-border)',
          padding: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span
            style={{
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '13px',
              color: 'var(--color-charcoal)',
              fontWeight: '600',
            }}
          >
            {votedCount} of {totalMembers} members have voted
          </span>
        </div>
        <div
          style={{
            height: '6px',
            background: 'rgba(140,133,120,0.15)',
            borderRadius: '100px',
            overflow: 'hidden',
            marginBottom: isCreator && allVoted ? '12px' : '0',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${totalMembers > 0 ? (votedCount / totalMembers) * 100 : 0}%`,
              background: '#4A6741',
              borderRadius: '100px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        {isCreator && allVoted && trip.status === 'voting' && (
          <button
            onClick={handleConfirmWhenAllVoted}
            disabled={confirmingWinner}
            style={{
              marginTop: '4px',
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: confirmingWinner ? 'rgba(74,103,65,0.5)' : '#4A6741',
              color: 'white',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '14px',
              fontWeight: '600',
              cursor: confirmingWinner ? 'default' : 'pointer',
            }}
          >
            {confirmingWinner ? 'Confirming…' : 'Confirm winner'}
          </button>
        )}
      </div>

      {/* Tie-breaker */}
      {showTieBreaker && (
        <div
          style={{
            background: 'rgba(196,137,59,0.06)',
            border: '1px solid rgba(196,137,59,0.3)',
            borderRadius: '12px',
            padding: '16px',
          }}
        >
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: '16px',
              fontWeight: '700',
              color: '#C4893B',
              marginBottom: '10px',
            }}
          >
            It's a tie — you pick the winner
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {getTiedDestinations().map((dest) => (
              <label
                key={dest.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  fontSize: '14px',
                  color: 'var(--color-charcoal)',
                }}
              >
                <input
                  type="radio"
                  name="tiebreaker"
                  value={dest.id}
                  checked={tieBreaker === dest.id}
                  onChange={() => setTieBreaker(dest.id)}
                  style={{ accentColor: '#C4893B' }}
                />
                {dest.name}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleConfirmWinner}
              disabled={confirmingWinner}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: confirmingWinner ? 'rgba(196,137,59,0.5)' : '#C4893B',
                color: 'white',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '14px',
                fontWeight: '600',
                cursor: confirmingWinner ? 'default' : 'pointer',
              }}
            >
              {confirmingWinner ? 'Locking in…' : 'Lock it in'}
            </button>
            <button
              onClick={() => setShowTieBreaker(false)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-stone)',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
