import { useState, useCallback, useRef } from 'react'
import { signOut } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { UserProfile, Vehicle, HomeLocation } from '../types'

interface ProfilePageProps {
  profile: UserProfile
}

type VehicleType = Vehicle['type']
type FuelType = Vehicle['fuelType']

interface VehicleForm {
  id: string
  name: string
  type: VehicleType
  fuelType: FuelType
  consumption: string
}

const DEFAULT_CONSUMPTION: Record<VehicleType, number> = {
  car: 9,
  '4wd': 13,
  motorbike: 5,
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function VehicleTypeIcon({ type }: { type: VehicleType }) {
  if (type === 'car') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.92 5.01A1 1 0 0018 4.5h-12a1 1 0 00-.92.61l-2 5A1 1 0 003 11v5a1 1 0 001 1h1a2 2 0 004 0h6a2 2 0 004 0h1a1 1 0 001-1v-5a1 1 0 00-.08-.39l-2-5.6zM7 16a1 1 0 110-2 1 1 0 010 2zm10 0a1 1 0 110-2 1 1 0 010 2zM5.28 10l1.42-3.56h10.6l1.42 3.56H5.28z" />
      </svg>
    )
  }
  if (type === '4wd') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 8h-3V6a1 1 0 00-1-1H4a1 1 0 00-1 1v9H2v2h2a2 2 0 104 0h8a2 2 0 104 0h2v-5l-2-4zM6 18a1 1 0 110-2 1 1 0 010 2zm10.5-8H17l1.5 3h-6.5V7H16l.5 3zM18 18a1 1 0 110-2 1 1 0 010 2z" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8 2 5.5 5 5.5 8c0 1.5.5 3 1.5 4l-2 6h14l-2-6c1-1 1.5-2.5 1.5-4C18.5 5 16 2 12 2zm0 2c2.5 0 4.5 2 4.5 4 0 1-.4 2-1 2.7L12 12l-3.5-1.3C8 10 7.5 9 7.5 8c0-2 2-4 4.5-4z" />
    </svg>
  )
}

export default function ProfilePage({ profile }: ProfilePageProps) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [suburb, setSuburb] = useState(profile.homeLocation?.suburb ?? '')
  const [geocodeResult, setGeocodeResult] = useState<HomeLocation | null>(profile.homeLocation ?? null)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [vehicles, setVehicles] = useState<VehicleForm[]>(
    profile.vehicles.map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      fuelType: v.fuelType,
      consumption: String(v.consumption),
    })),
  )

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const geocodeSuburb = useCallback(async (value: string) => {
    if (!value.trim() || value.trim().length < 3) {
      setGeocodeResult(null)
      setGeocodeError(null)
      return
    }
    setGeocoding(true)
    setGeocodeError(null)
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value.trim())}.json?country=AU&types=locality,place&access_token=${token}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Geocoding failed')
      const data = await res.json()
      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        const [lng, lat] = feature.center
        setGeocodeResult({
          suburb: feature.place_name.split(',')[0],
          lat,
          lng,
        })
      } else {
        setGeocodeResult(null)
        setGeocodeError('No results found.')
      }
    } catch {
      setGeocodeError('Could not look up that suburb.')
      setGeocodeResult(null)
    } finally {
      setGeocoding(false)
    }
  }, [])

  function handleSuburbChange(value: string) {
    setSuburb(value)
    setGeocodeResult(null)
    setGeocodeError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => geocodeSuburb(value), 300)
  }

  function updateVehicle(id: string, field: keyof VehicleForm, value: string) {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v
        const updated = { ...v, [field]: value }
        if (field === 'type') {
          updated.consumption = String(DEFAULT_CONSUMPTION[value as VehicleType])
        }
        return updated
      }),
    )
  }

  function addVehicle() {
    setVehicles((prev) => [...prev, { id: generateId(), name: '', type: 'car', fuelType: 'petrol', consumption: '9' }])
  }

  function removeVehicle(id: string) {
    setVehicles((prev) => prev.filter((v) => v.id !== id))
  }

  async function handleSave() {
    if (!displayName.trim()) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const vehicleData: Vehicle[] = vehicles.map((v) => ({
        id: v.id,
        name: v.name.trim(),
        type: v.type,
        fuelType: v.fuelType,
        consumption: Number(v.consumption),
      }))

      await setDoc(
        doc(db, 'users', profile.uid),
        {
          ...profile,
          displayName: displayName.trim(),
          homeLocation: geocodeResult ?? profile.homeLocation,
          vehicles: vehicleData,
        },
        { merge: true },
      )

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Save error:', err)
      setSaveError('Could not save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut(auth)
    } catch (err) {
      console.error('Sign-out error:', err)
      setSigningOut(false)
    }
  }

  const initials = profile.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      style={{
        padding: '24px 16px 40px',
        maxWidth: '540px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {profile.photoURL ? (
          <img
            src={profile.photoURL}
            alt={profile.displayName}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3px solid var(--color-moss)',
            }}
          />
        ) : (
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-moss)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontFamily: 'Fraunces, Georgia, serif',
              fontWeight: '700',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        )}
        <div>
          <h1
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: '26px',
              fontWeight: '800',
              color: 'var(--color-charcoal)',
              margin: '0 0 2px 0',
            }}
          >
            Profile
          </h1>
          <p style={{ color: 'var(--color-stone)', margin: 0, fontSize: '14px' }}>
            {profile.email}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Display name */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--color-charcoal)',
              marginBottom: '8px',
            }}
          >
            Display name
          </label>
          <input
            className="input"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        {/* Home location */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--color-charcoal)',
              marginBottom: '8px',
            }}
          >
            Home base
          </label>
          <input
            className="input"
            type="text"
            value={suburb}
            onChange={(e) => handleSuburbChange(e.target.value)}
            placeholder="Suburb or town"
          />

          {geocoding && (
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--color-stone)',
                fontSize: '13px',
              }}
            >
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid var(--color-border)',
                  borderTopColor: 'var(--color-moss)',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              Looking up…
            </div>
          )}

          {geocodeResult && (
            <div
              style={{
                marginTop: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(74, 103, 65, 0.08)',
                border: '1px solid rgba(74, 103, 65, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="#4A6741" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="9" stroke="#4A6741" strokeWidth="2" />
              </svg>
              <span style={{ fontSize: '13px', color: 'var(--color-moss)', fontWeight: '600' }}>
                {geocodeResult.suburb}
              </span>
            </div>
          )}

          {geocodeError && (
            <p style={{ color: 'var(--color-terracotta)', fontSize: '13px', marginTop: '6px' }}>
              {geocodeError}
            </p>
          )}
        </div>

        {/* Vehicles */}
        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--color-charcoal)',
              marginBottom: '12px',
            }}
          >
            Vehicles
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {vehicles.map((vehicle, idx) => (
              <div
                key={vehicle.id}
                className="card"
                style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-stone)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Vehicle {idx + 1}
                  </span>
                  {vehicles.length > 1 && (
                    <button
                      onClick={() => removeVehicle(vehicle.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-terracotta)',
                        fontSize: '12px',
                        padding: '4px',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <input
                  className="input"
                  type="text"
                  value={vehicle.name}
                  onChange={(e) => updateVehicle(vehicle.id, 'name', e.target.value)}
                  placeholder="Vehicle nickname"
                  style={{ padding: '10px 14px', fontSize: '15px' }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['car', '4wd', 'motorbike'] as VehicleType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => updateVehicle(vehicle.id, 'type', type)}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: vehicle.type === type ? '2px solid var(--color-moss)' : '1.5px solid var(--color-border)',
                        background: vehicle.type === type ? 'rgba(74, 103, 65, 0.08)' : 'var(--color-surface)',
                        color: vehicle.type === type ? 'var(--color-moss)' : 'var(--color-stone)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '11px',
                        fontWeight: '600',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <VehicleTypeIcon type={type} />
                      {type === '4wd' ? '4WD' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['petrol', 'diesel'] as FuelType[]).map((fuel) => (
                    <button
                      key={fuel}
                      onClick={() => updateVehicle(vehicle.id, 'fuelType', fuel)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: vehicle.fuelType === fuel ? '2px solid var(--color-ochre)' : '1.5px solid var(--color-border)',
                        background: vehicle.fuelType === fuel ? 'rgba(196, 137, 59, 0.08)' : 'var(--color-surface)',
                        color: vehicle.fuelType === fuel ? 'var(--color-ochre)' : 'var(--color-stone)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {fuel.charAt(0).toUpperCase() + fuel.slice(1)}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="40"
                    step="0.5"
                    value={vehicle.consumption}
                    onChange={(e) => updateVehicle(vehicle.id, 'consumption', e.target.value)}
                    style={{ paddingRight: '80px', fontSize: '15px', padding: '10px 80px 10px 14px' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '14px',
                      color: 'var(--color-stone)',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono, monospace',
                      pointerEvents: 'none',
                    }}
                  >
                    L/100km
                  </span>
                </div>
              </div>
            ))}

            <button onClick={addVehicle} className="btn-secondary" style={{ fontSize: '14px', padding: '10px 20px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Add vehicle
            </button>
          </div>
        </div>

        {/* Save feedback */}
        {saveSuccess && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(74, 103, 65, 0.1)',
              border: '1px solid rgba(74, 103, 65, 0.25)',
              color: 'var(--color-moss)',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            </svg>
            Saved!
          </div>
        )}

        {saveError && (
          <p style={{ color: 'var(--color-terracotta)', fontSize: '14px' }}>{saveError}</p>
        )}

        {/* Save button */}
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving || !displayName.trim()}
          style={{ width: '100%' }}
        >
          {saving ? (
            <span
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: 'white',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }}
            />
          ) : null}
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        {/* Sign out */}
        <div style={{ paddingTop: '8px' }}>
          <button
            className="btn-danger"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{ width: '100%' }}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  )
}
