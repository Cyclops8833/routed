import { lazy, Suspense, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { initTheme } from './hooks/useTheme'
import { useFCMSetup } from './hooks/useFCMSetup'
import { useTripNotifications } from './hooks/useTripNotifications'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import TripsPage from './pages/Trips'
import CrewPage from './pages/Crew'
import ProfilePage from './pages/Profile'
import { NotificationProvider } from './contexts/NotificationContext'
import { CrewProvider } from './contexts/CrewContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NotificationPrompt } from './components/NotificationPrompt'

const MapPage = lazy(() => import('./pages/Map'))
const TripDetailPage = lazy(() => import('./pages/TripDetail'))
const AvailabilityPage = lazy(() => import('./pages/Availability'))

function LoadingScreen() {
  return (
    <div
      className="topo-bg"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-base)',
        gap: '24px',
      }}
    >
      <div
        style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: '36px',
          fontWeight: '700',
          color: 'var(--color-moss)',
          letterSpacing: '-0.5px',
        }}
      >
        Routed
      </div>
      <div className="spinner" />
    </div>
  )
}

function AppContent() {
  const { user, profile, loading, authError } = useAuth()
  // FCM token registration — runs on auth state change (D-02); safe to call unconditionally
  useFCMSetup()
  // Trip notification triggers — D-04 (vote_requested), D-05 (trip_confirmed), D-07 (trip_approaching)
  useTripNotifications()

  if (loading) return <LoadingScreen />

  if (!user) return <Landing authError={authError} />

  if (!profile || !profile.onboardingComplete) {
    return <Onboarding user={user} existingProfile={profile} />
  }

  return (
    <Layout>
      <NotificationPrompt />
      <Suspense fallback={<div className="topo-bg" style={{ height: '100vh' }} />}>
        <Routes>
          <Route path="/map" element={<MapPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/:tripId" element={<TripDetailPage />} />
          <Route path="/crew" element={<CrewPage />} />
          <Route path="/profile" element={<ProfilePage profile={profile} />} />
          <Route path="/availability" element={<AvailabilityPage />} />
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default function App() {
  // Initialise theme before first render to avoid flash of wrong theme
  useLayoutEffect(() => {
    initTheme()
  }, [])

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <CrewProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </CrewProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
