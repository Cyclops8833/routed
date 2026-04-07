import { precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

// Workbox precaching (injected by VitePWA)
precacheAndRoute(self.__WB_MANIFEST)
self.skipWaiting()
clientsClaim()

// Firebase messaging for background push notifications
// Using compat SDK via importScripts — cannot use ES imports for Firebase in SW context
// The compat scripts are loaded from CDN at runtime
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// Firebase config — hardcoded because SW cannot access import.meta.env
// These are public Firebase config values (safe to embed — they are NOT secrets)
firebase.initializeApp({
  apiKey: '__VITE_FIREBASE_API_KEY__',
  authDomain: '__VITE_FIREBASE_AUTH_DOMAIN__',
  projectId: '__VITE_FIREBASE_PROJECT_ID__',
  storageBucket: '__VITE_FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__VITE_FIREBASE_APP_ID__',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {}
  self.registration.showNotification(title ?? 'Routed', {
    body: body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  })
})
