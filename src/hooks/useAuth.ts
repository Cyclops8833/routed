import { useState, useEffect } from 'react'
import { onAuthStateChanged, getRedirectResult, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { UserProfile } from '../types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Complete any pending redirect sign-in (mobile OAuth flow)
    getRedirectResult(auth).catch((err) => {
      const e = err as { code?: string }
      // auth/no-current-user fires on every load when no redirect was pending — ignore it
      if (e.code && e.code !== 'auth/no-current-user') {
        console.error('Redirect sign-in error:', err)
        setAuthError('Sign-in failed. Please try again.')
      }
    })

    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile)
        } else {
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
  }, [])

  return { user, profile, loading, authError }
}
