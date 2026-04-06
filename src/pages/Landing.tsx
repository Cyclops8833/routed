import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import TopoPattern from '../components/TopoPattern'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export default function Landing({ authError }: { authError?: string | null }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setError(null)
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      const e = err as { code?: string; message?: string }
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        // User closed popup — not a real error
      } else {
        setError('Could not sign in. Please try again.')
        console.error('Sign-in error:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="topo-bg-wrapper noise-overlay"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-base)',
        padding: '24px',
        position: 'relative',
      }}
    >
      {/* Topo background pattern */}
      <TopoPattern />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '360px',
          width: '100%',
          gap: '0',
        }}
      >
        {/* Logo / compass icon */}
        <div style={{ marginBottom: '16px' }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="28" r="26" stroke="#4A6741" strokeWidth="2" />
            <circle cx="28" cy="28" r="18" stroke="#4A6741" strokeWidth="1.2" opacity="0.5" />
            <circle cx="28" cy="28" r="10" stroke="#4A6741" strokeWidth="1" opacity="0.3" />
            <polygon points="28,10 32,28 28,24 24,28" fill="#4A6741" />
            <polygon points="28,46 24,28 28,32 32,28" fill="#C4893B" />
          </svg>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 'clamp(64px, 20vw, 88px)',
            fontWeight: '800',
            color: 'var(--color-moss)',
            margin: '0 0 12px 0',
            letterSpacing: '-2px',
            lineHeight: '1',
          }}
        >
          Routed
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontSize: '18px',
            color: 'var(--color-stone)',
            margin: '0 0 48px 0',
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          Find where the road takes you.
        </p>

        {/* Sign-in button */}
        <button
          className="btn-primary"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{ width: '100%', fontSize: '17px', padding: '16px 28px' }}
        >
          {loading ? (
            <span
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: 'white',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }}
            />
          ) : (
            <GoogleIcon />
          )}
          {loading ? 'Signing in…' : 'Sign in with Google'}
        </button>

        {/* Error */}
        {(error || authError) && (
          <p
            style={{
              color: 'var(--color-terracotta)',
              fontSize: '14px',
              marginTop: '12px',
              textAlign: 'center',
            }}
          >
            {error || authError}
          </p>
        )}

        {/* Subtext */}
        <p
          style={{
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontSize: '14px',
            color: 'var(--color-stone)',
            margin: '32px 0 0 0',
            textAlign: 'center',
          }}
        >
          Eight mates. One map. Let's go.
        </p>
      </div>
    </div>
  )
}
