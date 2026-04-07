import { useEffect, useRef } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import { useCrewContext } from '../contexts/CrewContext'
import { sendNotification } from '../utils/notifications'
import type { Trip } from '../types'

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000
const TWENTY_THREE_HOURS_MS = 23 * 60 * 60 * 1000

interface ShameLogEntry {
  lastShamedAt: string
  shameCount: number
}

/**
 * Check if shame notification should be sent for a specific non-voter.
 * Returns { shouldSend, shameCount } -- shameCount is the day N for the message.
 */
function shouldSendShame(
  votingStartedAt: Timestamp,
  shameLog: ShameLogEntry | null
): { shouldSend: boolean; shameCount: number } {
  const now = Date.now()
  const votingStartMs = votingStartedAt.toMillis()
  const elapsed = now - votingStartMs

  // Not yet 72 hours since voting started
  if (elapsed < SEVENTY_TWO_HOURS_MS) {
    return { shouldSend: false, shameCount: 0 }
  }

  // Never shamed -- fire first shame (D-08)
  if (!shameLog) {
    return { shouldSend: true, shameCount: 1 }
  }

  // Check if 23+ hours since last shame (D-09 daily follow-up)
  const lastShamedMs = new Date(shameLog.lastShamedAt).getTime()
  if ((now - lastShamedMs) > TWENTY_THREE_HOURS_MS) {
    return { shouldSend: true, shameCount: shameLog.shameCount + 1 }
  }

  return { shouldSend: false, shameCount: shameLog.shameCount }
}

/**
 * Shame notifications hook (D-08 + D-09).
 *
 * How it works:
 * 1. Subscribes to voting trips where current user is an attendee
 * 2. For each voting trip with votingStartedAt 72+ hours ago:
 *    - Checks each attendee's vote status (trips/{tripId}/votes/{uid})
 *    - For non-voters: checks shameLog (trips/{tripId}/shameLog/{uid})
 *    - If shouldSendShame() returns true: sends notification, updates shameLog
 *
 * Limitation: Only fires when an app user has the app open.
 * For 7 users where at least one opens daily, this is acceptable.
 * The notifying user (whoever has app open) sends shame to non-voters.
 */
export function useShameNotifications() {
  const { allUsers } = useCrewContext()
  const processing = useRef(false)

  useEffect(() => {
    const currentUid = auth.currentUser?.uid
    if (!currentUid || allUsers.length === 0) return

    const q = query(
      collection(db, 'trips'),
      where('attendees', 'array-contains', currentUid),
      where('status', '==', 'voting')
    )

    const unsub = onSnapshot(q, async (snap) => {
      // Prevent concurrent processing
      if (processing.current) return
      processing.current = true

      try {
        for (const tripDoc of snap.docs) {
          const trip = { id: tripDoc.id, ...tripDoc.data() } as Trip & { votingStartedAt?: Timestamp }

          // Skip if no votingStartedAt (trip created before this feature)
          if (!trip.votingStartedAt) continue

          // Check each attendee
          for (const attendeeUid of trip.attendees) {
            // Check if attendee has voted
            try {
              const voteDoc = await getDoc(doc(db, 'trips', trip.id, 'votes', attendeeUid))
              if (voteDoc.exists()) continue // Already voted -- no shame needed
            } catch {
              continue // Can't check vote status -- skip
            }

            // Check shame log
            let shameLog: ShameLogEntry | null = null
            try {
              const shameDoc = await getDoc(doc(db, 'trips', trip.id, 'shameLog', attendeeUid))
              if (shameDoc.exists()) {
                shameLog = shameDoc.data() as ShameLogEntry
              }
            } catch {
              // No shame log yet -- that's fine
            }

            const { shouldSend, shameCount } = shouldSendShame(trip.votingStartedAt, shameLog)

            if (!shouldSend) continue

            // Get the non-voter's FCM token
            const nonVoter = allUsers.find((u) => u.uid === attendeeUid)
            if (!nonVoter?.fcmToken) continue

            // Build message per D-08/D-09
            const notification = shameCount <= 1
              ? {
                  title: `Still waiting on your vote for ${trip.name} \u{1F440}`,
                  body: 'The crew needs your input.',
                }
              : {
                  title: `Day ${shameCount} \u2014 still no vote for ${trip.name} \u{1FAF5}`,
                  body: 'Seriously, go vote.',
                }

            // Update shame log (optimistic -- write immediately to prevent duplicate from other clients)
            await setDoc(doc(db, 'trips', trip.id, 'shameLog', attendeeUid), {
              lastShamedAt: new Date().toISOString(),
              shameCount,
            })

            // Send shame notification
            sendNotification([nonVoter.fcmToken], notification)
          }
        }
      } finally {
        processing.current = false
      }
    })

    return unsub
  }, [allUsers])
}
