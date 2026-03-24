import { doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export async function openVoting(tripId: string, deadline?: Date): Promise<void> {
  const updates: Record<string, unknown> = { status: 'voting' }
  if (deadline) {
    updates.votingDeadline = deadline.toISOString()
  }
  await updateDoc(doc(db, 'trips', tripId), updates)
}

export async function closeVoting(
  tripId: string,
  winnerDestinationId: string
): Promise<void> {
  await updateDoc(doc(db, 'trips', tripId), {
    status: 'confirmed',
    confirmedDestinationId: winnerDestinationId,
    votingDeadline: null,
  })
}

export async function startTrip(tripId: string): Promise<void> {
  await updateDoc(doc(db, 'trips', tripId), {
    status: 'active',
    startedAt: Timestamp.now(),
  })
}

export async function completeTrip(tripId: string): Promise<void> {
  await updateDoc(doc(db, 'trips', tripId), {
    status: 'completed',
    completedAt: Timestamp.now(),
  })
}

export async function cancelTrip(tripId: string): Promise<void> {
  await updateDoc(doc(db, 'trips', tripId), {
    status: 'cancelled',
    cancelledAt: Timestamp.now(),
  })
}

export async function reopenVoting(tripId: string): Promise<void> {
  await updateDoc(doc(db, 'trips', tripId), {
    status: 'voting',
    confirmedDestinationId: null,
    votingDeadline: null,
  })
}
