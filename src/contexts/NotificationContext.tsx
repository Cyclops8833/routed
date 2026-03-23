import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase'
import type { Trip } from '../types'

interface NotificationContextValue {
  unvotedTrips: number
}

const NotificationContext = createContext<NotificationContextValue>({ unvotedTrips: 0 })

export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext)
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unvotedTrips, setUnvotedTrips] = useState(0)
  const [uid, setUid] = useState<string | null>(null)

  // Track auth state
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null)
    })
  }, [])

  // Listen to voting trips for this user, check if they've voted
  useEffect(() => {
    if (!uid) {
      setUnvotedTrips(0)
      return
    }

    const q = query(
      collection(db, 'trips'),
      where('attendees', 'array-contains', uid),
      where('status', '==', 'voting')
    )

    const unsubTrips = onSnapshot(q, async (snap) => {
      const votingTrips = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip))

      if (votingTrips.length === 0) {
        setUnvotedTrips(0)
        return
      }

      // For each voting trip, check if this user has a vote doc
      const checks = votingTrips.map(async (trip) => {
        try {
          const voteDoc = await getDoc(doc(db, 'trips', trip.id, 'votes', uid))
          return !voteDoc.exists()
        } catch {
          return false
        }
      })

      const results = await Promise.all(checks)
      const count = results.filter(Boolean).length
      setUnvotedTrips(count)
    })

    return unsubTrips
  }, [uid])

  return (
    <NotificationContext.Provider value={{ unvotedTrips }}>
      {children}
    </NotificationContext.Provider>
  )
}
