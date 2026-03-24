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
  unvotedTrips: number   // voting trips where current user hasn't voted (pulsing dot)
  imminentTrips: number  // confirmed trips departing within 7 days
}

const NotificationContext = createContext<NotificationContextValue>({
  unvotedTrips: 0,
  imminentTrips: 0,
})

export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext)
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unvotedTrips, setUnvotedTrips] = useState(0)
  const [imminentTrips, setImminentTrips] = useState(0)
  const [uid, setUid] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null)
    })
  }, [])

  // Voting trips where this user hasn't voted yet
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

    const unsub = onSnapshot(q, async (snap) => {
      const votingTrips = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip))
      if (votingTrips.length === 0) {
        setUnvotedTrips(0)
        return
      }
      const checks = votingTrips.map(async (trip) => {
        try {
          const voteDoc = await getDoc(doc(db, 'trips', trip.id, 'votes', uid))
          return !voteDoc.exists()
        } catch {
          return false
        }
      })
      const results = await Promise.all(checks)
      setUnvotedTrips(results.filter(Boolean).length)
    })

    return unsub
  }, [uid])

  // Confirmed trips departing within 7 days
  useEffect(() => {
    if (!uid) {
      setImminentTrips(0)
      return
    }

    const q = query(
      collection(db, 'trips'),
      where('attendees', 'array-contains', uid),
      where('status', '==', 'confirmed')
    )

    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now()
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
      const count = snap.docs.filter((d) => {
        const trip = d.data() as Trip
        if (!trip.dateRange?.start) return false
        const departure = new Date(trip.dateRange.start).getTime()
        return departure > now && departure - now <= sevenDaysMs
      }).length
      setImminentTrips(count)
    })

    return unsub
  }, [uid])

  return (
    <NotificationContext.Provider value={{ unvotedTrips, imminentTrips }}>
      {children}
    </NotificationContext.Provider>
  )
}
