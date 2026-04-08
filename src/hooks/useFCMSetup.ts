import { useEffect, useRef, useCallback } from 'react'
import { getToken } from 'firebase/messaging'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { messaging, auth, db } from '../firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

/**
 * FCM setup hook — handles token registration and refresh.
 *
 * Behaviour (per D-02):
 * - On app load, if Notification.permission === 'granted', calls getToken()
 *   and writes to users/{uid}.fcmToken if changed.
 * - Exposes requestPermission() for contextual prompting (D-03).
 *
 * Guards:
 * - 'Notification' in window (iOS Safari non-PWA safety)
 * - messaging !== null (FCM not supported)
 * - User is authenticated
 */
export function useFCMSetup() {
  const tokenRegistered = useRef(false)

  // Register/refresh FCM token for the given uid
  const registerToken = useCallback(async (uid: string): Promise<string | null> => {
    console.log('[fcm] registerToken called — messaging:', !!messaging, 'permission:', Notification.permission, 'vapid:', !!VAPID_KEY)
    if (!messaging || !('Notification' in window)) return null
    if (Notification.permission !== 'granted') return null
    if (!VAPID_KEY) {
      console.warn('[fcm] VITE_FIREBASE_VAPID_KEY not set')
      return null
    }

    try {
      const swReg = await navigator.serviceWorker.getRegistration()
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg || undefined,
      })

      if (!token) return null

      // Only write to Firestore if token changed (avoids unnecessary writes)
      const userRef = doc(db, 'users', uid)
      const snap = await getDoc(userRef)
      if (snap.data()?.fcmToken !== token) {
        await setDoc(userRef, { fcmToken: token }, { merge: true })
      }

      return token
    } catch (err) {
      console.warn('[fcm] Token registration failed:', err)
      return null
    }
  }, [])

  // Request permission and register token (for contextual prompting per D-03)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!messaging || !('Notification' in window)) return false
    if (Notification.permission === 'denied') return false
    if (Notification.permission === 'granted') {
      // Already granted — just ensure token is registered
      const uid = auth.currentUser?.uid
      if (uid) await registerToken(uid)
      return true
    }

    try {
      const result = await Notification.requestPermission()
      if (result === 'granted') {
        const uid = auth.currentUser?.uid
        if (uid) await registerToken(uid)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [registerToken])

  // On auth state change: if permission already granted, refresh token (D-02)
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user && !tokenRegistered.current) {
        tokenRegistered.current = true
        registerToken(user.uid)
      }
      if (!user) {
        tokenRegistered.current = false
      }
    })
  }, [registerToken])

  return {
    /** Call in click handler for contextual permission prompt (D-03) */
    requestPermission,
    /** Whether push is supported in this browser */
    isSupported: typeof window !== 'undefined' && 'Notification' in window && messaging !== null,
    /** Current permission state */
    permission: typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied' as NotificationPermission,
  }
}
