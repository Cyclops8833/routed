import { ReactNode } from 'react'
import TabBar from './TabBar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-base)',
      }}
    >
      <main
        className="tab-bar-safe"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </main>
      <TabBar />
    </div>
  )
}
