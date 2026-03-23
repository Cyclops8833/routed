import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { UserProfile, Vehicle } from '../types'

type VehicleType = Vehicle['type']

function VehicleTypeIcon({ type }: { type: VehicleType }) {
  if (type === 'car') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.92 5.01A1 1 0 0018 4.5h-12a1 1 0 00-.92.61l-2 5A1 1 0 003 11v5a1 1 0 001 1h1a2 2 0 004 0h6a2 2 0 004 0h1a1 1 0 001-1v-5a1 1 0 00-.08-.39l-2-5.6zM7 16a1 1 0 110-2 1 1 0 010 2zm10 0a1 1 0 110-2 1 1 0 010 2zM5.28 10l1.42-3.56h10.6l1.42 3.56H5.28z" />
      </svg>
    )
  }
  if (type === '4wd') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 8h-3V6a1 1 0 00-1-1H4a1 1 0 00-1 1v9H2v2h2a2 2 0 104 0h8a2 2 0 104 0h2v-5l-2-4zM6 18a1 1 0 110-2 1 1 0 010 2zm10.5-8H17l1.5 3h-6.5V7H16l.5 3zM18 18a1 1 0 110-2 1 1 0 010 2z" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8 2 5.5 5 5.5 8c0 1.5.5 3 1.5 4l-2 6h14l-2-6c1-1 1.5-2.5 1.5-4C18.5 5 16 2 12 2zm0 2c2.5 0 4.5 2 4.5 4 0 1-.4 2-1 2.7L12 12l-3.5-1.3C8 10 7.5 9 7.5 8c0-2 2-4 4.5-4z" />
    </svg>
  )
}

function CrewCardSkeleton() {
  return (
    <div
      className="card"
      style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div className="skeleton" style={{ width: '52px', height: '52px', borderRadius: '50%' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="skeleton" style={{ height: '18px', width: '60%' }} />
          <div className="skeleton" style={{ height: '14px', width: '40%' }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: '32px', borderRadius: '8px' }} />
    </div>
  )
}

function CrewCard({ member }: { member: UserProfile }) {
  const initials = member.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className="card"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = '0 6px 24px rgba(196, 137, 59, 0.15)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.transform = ''
        el.style.boxShadow = ''
      }}
    >
      {/* Avatar + Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {member.photoURL ? (
          <img
            src={member.photoURL}
            alt={member.displayName}
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--color-border)',
            }}
          />
        ) : (
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-moss)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '18px',
              fontFamily: 'Fraunces, Georgia, serif',
              fontWeight: '700',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: '17px',
              fontWeight: '700',
              color: 'var(--color-charcoal)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {member.displayName}
          </div>
          {member.homeLocation && (
            <div style={{ fontSize: '13px', color: 'var(--color-stone)', marginTop: '2px' }}>
              📍 {member.homeLocation.suburb}
            </div>
          )}
        </div>
      </div>

      {/* Vehicles */}
      {member.vehicles && member.vehicles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {member.vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(74, 103, 65, 0.05)',
              }}
            >
              <span style={{ color: 'var(--color-moss)' }}>
                <VehicleTypeIcon type={vehicle.type} />
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--color-charcoal)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {vehicle.name}
              </span>
              {vehicle.type === '4wd' && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 7px',
                    borderRadius: '100px',
                    backgroundColor: 'rgba(196, 137, 59, 0.15)',
                    color: 'var(--color-ochre)',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                  }}
                >
                  4WD
                </span>
              )}
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '100px',
                  backgroundColor: vehicle.fuelType === 'diesel'
                    ? 'rgba(44, 44, 44, 0.08)'
                    : 'rgba(74, 103, 65, 0.08)',
                  color: vehicle.fuelType === 'diesel'
                    ? 'var(--color-charcoal)'
                    : 'var(--color-moss)',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                {vehicle.fuelType}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--color-stone)',
                }}
              >
                {vehicle.consumption}L
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CrewPage() {
  const [members, setMembers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCrew() {
      try {
        const snap = await getDocs(collection(db, 'users'))
        const profiles = snap.docs.map((d) => d.data() as UserProfile)
        setMembers(profiles)
      } catch (err) {
        console.error('Failed to load crew:', err)
        setError('Could not load crew. Check your connection.')
      } finally {
        setLoading(false)
      }
    }
    loadCrew()
  }, [])

  return (
    <div
      style={{
        padding: '24px 16px',
        maxWidth: '600px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      <h1
        style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: '32px',
          fontWeight: '800',
          color: 'var(--color-charcoal)',
          margin: '0 0 4px 0',
        }}
      >
        The Crew
      </h1>
      <p style={{ color: 'var(--color-stone)', margin: '0 0 24px 0', fontSize: '15px' }}>
        {loading ? 'Loading…' : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
      </p>

      {error && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '10px',
            backgroundColor: 'rgba(184, 92, 56, 0.08)',
            border: '1px solid rgba(184, 92, 56, 0.2)',
            color: 'var(--color-terracotta)',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <>
            <CrewCardSkeleton />
            <CrewCardSkeleton />
            <CrewCardSkeleton />
          </>
        ) : members.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: 'var(--color-stone)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
            <p>No crew members yet.</p>
          </div>
        ) : (
          members.map((member, memberIdx) => (
            <div key={member.uid} className="card-animate" style={{ animationDelay: `${memberIdx * 40}ms` }}>
              <CrewCard member={member} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
