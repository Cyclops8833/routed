import { NavLink, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useNotifications } from '../contexts/NotificationContext'

interface Tab {
  path: string
  label: string
  icon: (active: boolean) => ReactElement
}

function MapPinIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-moss)' : 'var(--color-stone)'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
        fill={color}
      />
    </svg>
  )
}

function RouteIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-moss)' : 'var(--color-stone)'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="18" r="2.5" stroke={color} strokeWidth="2" />
      <circle cx="18" cy="6" r="2.5" stroke={color} strokeWidth="2" />
      <path
        d="M6 15.5C6 15.5 6 12 9 10.5C12 9 12 7.5 12 7.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 8.5C18 8.5 18 12 15 13.5C12 15 12 16.5 12 16.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function GroupIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-moss)' : 'var(--color-stone)'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="7" r="3" stroke={color} strokeWidth="2" />
      <circle cx="17" cy="8" r="2.5" stroke={color} strokeWidth="1.8" />
      <path
        d="M2 20c0-3.314 3.134-6 7-6s7 2.686 7 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M17 14c2.21 0 4 1.567 4 3.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PersonIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-moss)' : 'var(--color-stone)'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="2" />
      <path
        d="M4 20c0-3.866 3.582-7 8-7s8 3.134 8 7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

const tabs: Tab[] = [
  {
    path: '/map',
    label: 'Map',
    icon: (active) => <MapPinIcon active={active} />,
  },
  {
    path: '/trips',
    label: 'Trips',
    icon: (active) => <RouteIcon active={active} />,
  },
  {
    path: '/crew',
    label: 'Crew',
    icon: (active) => <GroupIcon active={active} />,
  },
  {
    path: '/profile',
    label: 'Profile',
    icon: (active) => <PersonIcon active={active} />,
  },
]

export default function TabBar() {
  const location = useLocation()
  const { unvotedTrips } = useNotifications()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--tab-bar-height) + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        boxShadow: '0 -1px 0 rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path
        const showDot = tab.path === '/trips' && unvotedTrips > 0
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              textDecoration: 'none',
              color: isActive ? 'var(--color-moss)' : 'var(--color-stone)',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '11px',
              fontWeight: isActive ? '600' : '400',
              transition: 'color 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
            }}
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              {tab.icon(isActive)}
              {showDot && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-1px',
                    right: '-3px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#7C5CBF',
                    border: '1.5px solid var(--color-surface)',
                  }}
                />
              )}
            </div>
            <span>{tab.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
