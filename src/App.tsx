import { lazy, Suspense, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { initTheme } from './hooks/useTheme'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import TripsPage from './pages/Trips'
import CrewPage from './pages/Crew'
import ProfilePage from './pages/Profile'
import { NotificationProvider } from './contexts/NotificationContext'

const MapPage = lazy(() => import('./pages/Map'))
const TripDetailPage = lazy(() => import('./pages/TripDetail'))

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
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />

  if (!user) return <Landing />

  if (!profile || !profile.onboardingComplete) {
    return <Onboarding user={user} existingProfile={profile} />
  }

  return (
    <Layout>
      <Suspense fallback={<div className="topo-bg" style={{ height: '100vh' }} />}>
        <Routes>
          <Route path="/map" element={<MapPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/:tripId" element={<TripDetailPage />} />
          <Route path="/crew" element={<CrewPage />} />
          <Route path="/profile" element={<ProfilePage profile={profile} />} />
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
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </BrowserRouter>
  )
}
