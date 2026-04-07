import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Uncaught render error:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
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
          <div style={{ fontSize: '15px', color: 'var(--color-text-secondary)' }}>
            Something went wrong
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: 'var(--color-moss)',
              color: '#FAFAF7',
              border: 'none',
              borderRadius: '10px',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
