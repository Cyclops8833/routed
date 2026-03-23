import { useState, useCallback, useRef } from 'react'
import { User } from 'firebase/auth'
import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { UserProfile, Vehicle, HomeLocation } from '../types'

interface OnboardingProps {
  user: User
  existingProfile: UserProfile | null
}

type VehicleType = 'car' | '4wd' | 'motorbike'
type FuelType = 'petrol' | 'diesel'

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

function newVehicle(): VehicleForm {
  return { id: generateId(), name: '', type: 'car', fuelType: 'petrol', consumption: '9' }
}

// Step progress indicator
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '32px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={
            i === current ? 'step-dot step-dot--active' : i < current ? 'step-dot step-dot--done' : 'step-dot'
          }
        />
      ))}
    </div>
  )
}

// Vehicle type icons
function VehicleIcon({ type }: { type: VehicleType }) {
  if (type === 'car') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.92 5.01A1 1 0 0018 4.5h-12a1 1 0 00-.92.61l-2 5A1 1 0 003 11v5a1 1 0 001 1h1a2 2 0 004 0h6a2 2 0 004 0h1a1 1 0 001-1v-5a1 1 0 00-.08-.39l-2-5.6zM7 16a1 1 0 110-2 1 1 0 010 2zm10 0a1 1 0 110-2 1 1 0 010 2zM5.28 10l1.42-3.56h10.6l1.42 3.56H5.28z" />
      </svg>
    )
  }
  if (type === '4wd') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 8h-3V6a1 1 0 00-1-1H4a1 1 0 00-1 1v9H2v2h2a2 2 0 104 0h8a2 2 0 104 0h2v-5l-2-4zM6 18a1 1 0 110-2 1 1 0 010 2zm10.5-8H17l1.5 3h-6.5V7H16l.5 3zM18 18a1 1 0 110-2 1 1 0 010 2z" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8 2 5.5 5 5.5 8c0 1.5.5 3 1.5 4l-2 6h14l-2-6c1-1 1.5-2.5 1.5-4C18.5 5 16 2 12 2zm0 2c2.5 0 4.5 2 4.5 4 0 1-.4 2-1 2.7L12 12l-3.5-1.3C8 10 7.5 9 7.5 8c0-2 2-4 4.5-4z" />
    </svg>
  )
}

export default function Onboarding({ user, existingProfile }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Step 1: Name
  const firstName = user.displayName?.split(' ')[0] ?? 'there'
  const [displayName, setDisplayName] = useState(existingProfile?.displayName ?? user.displayName ?? '')

  // Step 2: Home location
  const [suburb, setSuburb] = useState(existingProfile?.homeLocation?.suburb ?? '')
  const [geocodeResult, setGeocodeResult] = useState<HomeLocation | null>(existingProfile?.homeLocation ?? null)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 3: Vehicles
  const [vehicles, setVehicles] = useState<VehicleForm[]>(() => {
    if (existingProfile?.vehicles?.length) {
      return existingProfile.vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        fuelType: v.fuelType,
        consumption: String(v.consumption),
      }))
    }
    return [newVehicle()]
  })
  const [vehicleError, setVehicleError] = useState<string | null>(null)

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
        setGeocodeError('No results found. Try a nearby town.')
      }
    } catch {
      setGeocodeError('Could not look up that suburb. Check your connection.')
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
        // Auto-update consumption when type changes
        if (field === 'type') {
          updated.consumption = String(DEFAULT_CONSUMPTION[value as VehicleType])
        }
        return updated
      }),
    )
  }

  function addVehicle() {
    setVehicles((prev) => [...prev, newVehicle()])
  }

  function removeVehicle(id: string) {
    setVehicles((prev) => prev.filter((v) => v.id !== id))
  }

  // Validation
  function canAdvanceStep() {
    if (step === 0) return displayName.trim().length > 0
    if (step === 1) return geocodeResult !== null
    if (step === 2) {
      return vehicles.length > 0 && vehicles.every((v) => v.name.trim().length > 0 && Number(v.consumption) > 0)
    }
    return true
  }

  async function handleFinish() {
    setSaving(true)
    setSaveError(null)
    try {
      const vehicleData: Vehicle[] = vehicles.map((v) => ({
        id: v.id,
        name: v.name.trim(),
        type: v.type,
        fuelType: v.fuelType,
        consumption: Number(v.consumption),
      }))

      const profileData: Omit<UserProfile, 'createdAt'> & { createdAt: unknown } = {
        uid: user.uid,
        displayName: displayName.trim(),
        email: user.email ?? '',
        photoURL: user.photoURL,
        homeLocation: geocodeResult,
        vehicles: vehicleData,
        createdAt: existingProfile?.createdAt ?? Timestamp.now(),
        onboardingComplete: true,
      }

      await setDoc(doc(db, 'users', user.uid), profileData)
      // App.tsx will re-render because onAuthStateChanged fires after setDoc
      // but we need to force a reload of the profile. Reload page to trigger hook.
      window.location.reload()
    } catch (err) {
      console.error('Save error:', err)
      setSaveError('Could not save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const TOTAL_STEPS = 4

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-base)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 20px 40px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '16px' }}>
          <span
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: '28px',
              fontWeight: '700',
              color: 'var(--color-moss)',
            }}
          >
            Routed
          </span>
        </div>

        <StepDots current={step} total={TOTAL_STEPS} />

        {/* Step 0: Welcome / Name */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: '32px',
                  fontWeight: '700',
                  color: 'var(--color-charcoal)',
                  margin: '0 0 8px 0',
                }}
              >
                G'day, {firstName}!
              </h2>
              <p style={{ color: 'var(--color-stone)', margin: 0 }}>Let's get you set up.</p>
            </div>

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
                Your name
              </label>
              <input
                className="input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How do you want to be known?"
                autoFocus
              />
              <p style={{ fontSize: '13px', color: 'var(--color-stone)', marginTop: '6px' }}>
                This is what your crew sees.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Home Base */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: '32px',
                  fontWeight: '700',
                  color: 'var(--color-charcoal)',
                  margin: '0 0 8px 0',
                }}
              >
                Home Base
              </h2>
              <p style={{ color: 'var(--color-stone)', margin: 0 }}>
                Where do you start your adventures?
              </p>
            </div>

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
                Suburb or town
              </label>
              <input
                className="input"
                type="text"
                value={suburb}
                onChange={(e) => handleSuburbChange(e.target.value)}
                placeholder="e.g. Fitzroy, Melbourne"
                autoFocus
              />

              {geocoding && (
                <div
                  style={{
                    marginTop: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--color-stone)',
                    fontSize: '14px',
                  }}
                >
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
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
                    marginTop: '10px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(74, 103, 65, 0.08)',
                    border: '1px solid rgba(74, 103, 65, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4" stroke="#4A6741" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="9" stroke="#4A6741" strokeWidth="2" />
                  </svg>
                  <span style={{ fontSize: '14px', color: 'var(--color-moss)', fontWeight: '600' }}>
                    {geocodeResult.suburb}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--color-stone)', marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>
                    {geocodeResult.lat.toFixed(4)}, {geocodeResult.lng.toFixed(4)}
                  </span>
                </div>
              )}

              {geocodeError && (
                <p style={{ color: 'var(--color-terracotta)', fontSize: '14px', marginTop: '8px' }}>
                  {geocodeError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Vehicles */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: '32px',
                  fontWeight: '700',
                  color: 'var(--color-charcoal)',
                  margin: '0 0 8px 0',
                }}
              >
                Your Ride
              </h2>
              <p style={{ color: 'var(--color-stone)', margin: 0 }}>
                Tell us about your vehicle(s) for fuel cost estimates.
              </p>
            </div>

            {vehicles.map((vehicle, idx) => (
              <div
                key={vehicle.id}
                className="card"
                style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-stone)', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >
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
                        fontSize: '13px',
                        padding: '4px',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Nickname */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-charcoal)', marginBottom: '6px' }}>
                    Nickname
                  </label>
                  <input
                    className="input"
                    type="text"
                    value={vehicle.name}
                    onChange={(e) => updateVehicle(vehicle.id, 'name', e.target.value)}
                    placeholder="e.g. The Cruiser, Silvio"
                  />
                </div>

                {/* Vehicle type */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-charcoal)', marginBottom: '8px' }}>
                    Type
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['car', '4wd', 'motorbike'] as VehicleType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => updateVehicle(vehicle.id, 'type', type)}
                        style={{
                          flex: 1,
                          padding: '10px 8px',
                          borderRadius: '10px',
                          border: vehicle.type === type ? '2px solid var(--color-moss)' : '1.5px solid var(--color-border)',
                          background: vehicle.type === type ? 'rgba(74, 103, 65, 0.08)' : 'var(--color-surface)',
                          color: vehicle.type === type ? 'var(--color-moss)' : 'var(--color-stone)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          fontWeight: '600',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <VehicleIcon type={type} />
                        {type === '4wd' ? '4WD' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fuel type */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-charcoal)', marginBottom: '8px' }}>
                    Fuel
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['petrol', 'diesel'] as FuelType[]).map((fuel) => (
                      <button
                        key={fuel}
                        onClick={() => updateVehicle(vehicle.id, 'fuelType', fuel)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '10px',
                          border: vehicle.fuelType === fuel ? '2px solid var(--color-ochre)' : '1.5px solid var(--color-border)',
                          background: vehicle.fuelType === fuel ? 'rgba(196, 137, 59, 0.08)' : 'var(--color-surface)',
                          color: vehicle.fuelType === fuel ? 'var(--color-ochre)' : 'var(--color-stone)',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {fuel.charAt(0).toUpperCase() + fuel.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fuel consumption */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-charcoal)', marginBottom: '6px' }}>
                    Fuel consumption
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="40"
                      step="0.5"
                      value={vehicle.consumption}
                      onChange={(e) => updateVehicle(vehicle.id, 'consumption', e.target.value)}
                      style={{ paddingRight: '80px' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: '16px',
                        color: 'var(--color-stone)',
                        fontSize: '13px',
                        fontFamily: 'JetBrains Mono, monospace',
                        pointerEvents: 'none',
                      }}
                    >
                      L/100km
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {vehicleError && (
              <p style={{ color: 'var(--color-terracotta)', fontSize: '14px' }}>{vehicleError}</p>
            )}

            <button
              onClick={addVehicle}
              className="btn-secondary"
              style={{ fontSize: '15px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Add another vehicle
            </button>
          </div>
        )}

        {/* Step 3: Summary */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: '32px',
                  fontWeight: '700',
                  color: 'var(--color-charcoal)',
                  margin: '0 0 8px 0',
                }}
              >
                All set!
              </h2>
              <p style={{ color: 'var(--color-stone)', margin: 0 }}>
                Here's what we've got for you.
              </p>
            </div>

            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Avatar + Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={displayName}
                    style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' }}
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
                      fontSize: '22px',
                      fontFamily: 'Fraunces, Georgia, serif',
                      fontWeight: '700',
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: '700', fontSize: '18px', color: 'var(--color-charcoal)' }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--color-stone)' }}>{user.email}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-stone)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Home Base
                </div>
                <div style={{ fontWeight: '600', color: 'var(--color-charcoal)' }}>
                  {geocodeResult?.suburb ?? '—'}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-stone)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                  Vehicles
                </div>
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ color: 'var(--color-moss)' }}>
                      <VehicleIcon type={v.type} />
                    </div>
                    <span style={{ fontWeight: '600', flex: 1 }}>{v.name}</span>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '3px 8px',
                        borderRadius: '100px',
                        backgroundColor: v.type === '4wd' ? 'rgba(196, 137, 59, 0.12)' : 'rgba(74, 103, 65, 0.08)',
                        color: v.type === '4wd' ? 'var(--color-ochre)' : 'var(--color-moss)',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                      }}
                    >
                      {v.type === '4wd' ? '4WD' : v.type}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '3px 8px',
                        borderRadius: '100px',
                        backgroundColor: 'var(--color-border)',
                        color: 'var(--color-stone)',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {v.consumption}L
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {saveError && (
              <p style={{ color: 'var(--color-terracotta)', fontSize: '14px' }}>{saveError}</p>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div
          style={{
            marginTop: '40px',
            display: 'flex',
            gap: '12px',
            flexDirection: step === 3 ? 'column' : 'row',
          }}
        >
          {step > 0 && (
            <button
              className="btn-secondary"
              onClick={() => setStep((s) => s - 1)}
              style={{ flex: step < 3 ? 1 : undefined }}
            >
              Back
            </button>
          )}

          {step < 3 ? (
            <button
              className="btn-primary"
              onClick={() => {
                if (step === 2) {
                  const invalid = vehicles.some((v) => !v.name.trim() || Number(v.consumption) <= 0)
                  if (invalid) {
                    setVehicleError('Please fill in all vehicle details.')
                    return
                  }
                  setVehicleError(null)
                }
                setStep((s) => s + 1)
              }}
              disabled={!canAdvanceStep()}
              style={{ flex: 1 }}
            >
              Continue
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={handleFinish}
              disabled={saving}
              style={{ width: '100%', fontSize: '17px' }}
            >
              {saving ? (
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
              ) : null}
              {saving ? 'Saving…' : "Let's go!"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
