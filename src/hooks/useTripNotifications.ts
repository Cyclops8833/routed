import { useEffect, useRef } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import { useCrewContext } from '../contexts/CrewContext'
import { sendNotification } from '../utils/notifications'
import type { Trip } from '../types'

/**
 * Helper: get FCM tokens for a list of UIDs, excluding current user (Pitfall 5).
 */
function getRecipientTokens(
  allUsers: { uid: string; fcmToken?: string }[],
  recipientUids: string[],
  excludeUid: string
): string[] {
  return allUsers
    .filter((u) => recipientUids.includes(u.uid) && u.uid !== excludeUid && u.fcmToken)
    .map((u) => u.fcmToken!)
}

/**
 * Hook that monitors trip state changes and dispatches push notifications.
 *
 * Deduplication strategy (Pitfall 4):
 * - Maintains a Set of `notifiedKeys` in memory (session-scoped)
 * - Key format: `{tripId}:{eventType}:{statusOrTimestamp}`
 * - Prevents re-firing on subsequent onSnapshot callbacks or app reloads within same session
 *
 * For D-07 (trip_approaching), also writes `approachingNotifiedAt` to the trip doc
 * in Firestore for cross-session deduplication.
 */
export function useTripNotifications() {
  const { allUsers } = useCrewContext()
  const prevStatuses = useRef<Map<string, string>>(new Map())
  const notifiedKeys = useRef<Set<string>>(new Set())
  const initialLoad = useRef(true)

  // D-04 (vote_requested) + D-05 (trip_confirmed): Watch status transitions
  useEffect(() => {
    const currentUid = auth.currentUser?.uid
    if (!currentUid || allUsers.length === 0) return

    const q = query(
      collection(db, 'trips'),
      where('attendees', 'array-contains', currentUid)
    )

    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      // On initial load, just record statuses — don't fire notifications
      if (initialLoad.current) {
        snap.docs.forEach((d) => {
          const trip = { id: d.id, ...d.data() } as Trip
          prevStatuses.current.set(trip.id, trip.status)
        })
        initialLoad.current = false
        return
      }

      for (const change of snap.docChanges()) {
        if (change.type !== 'modified') continue

        const trip = { id: change.doc.id, ...change.doc.data() } as Trip
        const prevStatus = prevStatuses.current.get(trip.id)
        prevStatuses.current.set(trip.id, trip.status)

        if (!prevStatus || prevStatus === trip.status) continue

        // D-04: vote_requested — proposed/confirmed -> voting
        if (trip.status === 'voting' && (prevStatus === 'proposed' || prevStatus === 'confirmed')) {
          const key = `${trip.id}:vote_requested:${trip.status}`
          if (!notifiedKeys.current.has(key)) {
            notifiedKeys.current.add(key)
            const tokens = getRecipientTokens(allUsers, trip.attendees, currentUid)
            sendNotification(tokens, {
              title: `${trip.name} needs your vote`,
              body: 'Open Routed to cast your vote.',
            })
          }
        }

        // D-05: trip_confirmed — voting -> confirmed
        if (trip.status === 'confirmed' && prevStatus === 'voting') {
          const key = `${trip.id}:trip_confirmed:${trip.status}`
          if (!notifiedKeys.current.has(key)) {
            notifiedKeys.current.add(key)
            const tokens = getRecipientTokens(allUsers, trip.attendees, currentUid)
            sendNotification(tokens, {
              title: `${trip.name} is on — check the details`,
              body: 'The trip has been confirmed.',
            })
          }
        }
      }
    })

    return unsub
  }, [allUsers])

  // D-07: trip_approaching — confirmed trips within 7 days
  useEffect(() => {
    const currentUid = auth.currentUser?.uid
    if (!currentUid || allUsers.length === 0) return

    const q = query(
      collection(db, 'trips'),
      where('attendees', 'array-contains', currentUid),
      where('status', '==', 'confirmed')
    )

    const unsub = onSnapshot(q, async (snap: QuerySnapshot<DocumentData>) => {
      const now = Date.now()

      for (const d of snap.docs) {
        const trip = { id: d.id, ...d.data() } as Trip
        if (!trip.dateRange?.start) continue

        const departure = new Date(trip.dateRange.start).getTime()
        const daysUntil = (departure - now) / (24 * 60 * 60 * 1000)

        // Fire when trip is between 6.5 and 7.5 days away (catches the 7-day window once)
        if (daysUntil > 0 && daysUntil <= 7.5 && daysUntil >= 6.5) {
          // Cross-session dedup: check Firestore field
          const tripData = d.data()
          if (tripData.approachingNotifiedAt) continue

          const key = `${trip.id}:trip_approaching`
          if (notifiedKeys.current.has(key)) continue
          notifiedKeys.current.add(key)

          // Write dedup flag to Firestore
          await setDoc(doc(db, 'trips', trip.id), { approachingNotifiedAt: new Date().toISOString() }, { merge: true })

          const tokens = getRecipientTokens(allUsers, trip.attendees, currentUid)
          sendNotification(tokens, {
            title: `${trip.name} is 7 days away`,
            body: "Make sure you're ready to go!",
          })
        }
      }
    })

    return unsub
  }, [allUsers])
}
