import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase'
import type { UserProfile } from '../types'

interface CrewContextValue {
  allUsers: UserProfile[]
}

const CrewContext = createContext<CrewContextValue>({ allUsers: [] })

export function useCrewContext(): CrewContextValue {
  return useContext(CrewContext)
}

export function CrewProvider({ children }: { children: ReactNode }) {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [uid, setUid] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null)
    })
  }, [])

  useEffect(() => {
    if (!uid) {
      setAllUsers([])
      return
    }
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map((d) => d.data() as UserProfile))
    })
    return unsub
  }, [uid])

  return (
    <CrewContext.Provider value={{ allUsers }}>
      {children}
    </CrewContext.Provider>
  )
}
