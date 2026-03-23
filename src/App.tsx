import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import MapPage from './pages/Map'
import TripsPage from './pages/Trips'
import CrewPage from './pages/Crew'
import ProfilePage from './pages/Profile'

function LoadingScreen() {
  return (
    <div
      className="topo-pattern"
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
      <Routes>
        <Route path="/map" element={<MapPage />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/crew" element={<CrewPage />} />
        <Route path="/profile" element={<ProfilePage profile={profile} />} />
        <Route path="*" element={<Navigate to="/map" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
