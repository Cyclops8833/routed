import { useState, useCallback, useRef, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '../firebase'
import { UserProfile, Vehicle, HomeLocation } from '../types'
import { useTheme } from '../hooks/useTheme'
import { getUserPhoto } from '../utils/userPhoto'

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

async function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const size = 128
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No canvas context')); return }

      // Cover crop to square
      const srcSize = Math.min(img.width, img.height)
      const sx = (img.width - srcSize) / 2
      const sy = (img.height - srcSize) / 2
      ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size)

      let quality = 0.82
      let dataUri = canvas.toDataURL('image/jpeg', quality)

      // Reduce quality if too large
      if (dataUri.length > 70 * 1024) {
        quality = 0.65
        dataUri = canvas.toDataURL('image/jpeg', quality)
      }
      if (dataUri.length > 70 * 1024) {
        quality = 0.5
        dataUri = canvas.toDataURL('image/jpeg', quality)
      }

      resolve(dataUri)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

export default function ProfilePage({ profile }: ProfilePageProps) {
  const { theme, toggle: toggleTheme } = useTheme()
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [suburb, setSuburb] = useState(profile.homeLocation?.suburb ?? '')
  const [geocodeResult, setGeocodeResult] = useState<HomeLocation | null>(profile.homeLocation ?? null)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [customPhoto, setCustomPhoto] = useState<string | null>(profile.customPhotoURL ?? null)
  const [photoUploading, setPhotoUploading] = useState(false)

  // Lazy migration: if customPhotoURL is a legacy base64 blob, upload it to Storage
  useEffect(() => {
    if (!profile.customPhotoURL?.startsWith('data:')) return

    async function migrateAvatar() {
      try {
        const res = await fetch(profile.customPhotoURL!)
        const blob = await res.blob()
        const storageRef = ref(storage, `avatars/${profile.uid}.jpg`)
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
        const downloadURL = await getDownloadURL(storageRef)
        await updateDoc(doc(db, 'users', profile.uid), { customPhotoURL: downloadURL })
        setCustomPhoto(downloadURL)
      } catch (err) {
        console.error('Avatar migration failed — will retry on next load:', err)
      }
    }

    migrateAvatar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally runs once on mount; profile.customPhotoURL is a stable prop

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

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const dataUri = await processImage(file)
      // Convert base64 data URI to Blob for Storage upload
      const res = await fetch(dataUri)
      const blob = await res.blob()
      const storageRef = ref(storage, `avatars/${profile.uid}.jpg`)
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
      const downloadURL = await getDownloadURL(storageRef)
      await updateDoc(doc(db, 'users', profile.uid), { customPhotoURL: downloadURL })
      setCustomPhoto(downloadURL)
    } catch (err) {
      console.error('Photo upload failed:', err)
    } finally {
      setPhotoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoChange}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {/* Avatar with edit button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {(() => {
            const photoSrc = customPhoto ?? getUserPhoto(profile)
            return photoSrc ? (
              <img
                src={photoSrc}
                alt={profile.displayName}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--color-moss)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-moss)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '28px',
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontWeight: '700',
                }}
              >
                {initials}
              </div>
            )
          })()}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={photoUploading}
            aria-label="Edit profile photo"
            style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#C4893B',
              border: '2px solid var(--color-surface)',
              cursor: photoUploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            {photoUploading ? (
              <span style={{ width: '10px', height: '10px', border: '1.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
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

        {/* Dark mode toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '15px',
                fontWeight: '600',
                color: 'var(--color-charcoal)',
              }}
            >
              {theme === 'dark' ? 'Dark mode' : 'Light mode'}
            </div>
            <div
              style={{
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '13px',
                color: 'var(--color-stone)',
                marginTop: '2px',
              }}
            >
              {theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            </div>
          </div>
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            style={{
              width: '52px',
              height: '28px',
              borderRadius: '100px',
              border: 'none',
              cursor: 'pointer',
              background: theme === 'dark' ? 'var(--color-moss)' : 'var(--color-border)',
              position: 'relative',
              transition: 'background 0.2s ease',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '3px',
                left: theme === 'dark' ? '26px' : '3px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: 'white',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
              }}
            >
              {theme === 'dark' ? '🌙' : '☀️'}
            </span>
          </button>
        </div>

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
