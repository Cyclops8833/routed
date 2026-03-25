import { useEffect, useRef, useState, useCallback } from 'react'
import { collection, getDocs, getDoc, doc, query, where, onSnapshot } from 'firebase/firestore'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase'
import { MAPBOX_TOKEN } from '../config'
import type { UserProfile } from '../types'
import TripSheet from '../components/TripSheet'
import QuickPlanSheet from '../components/QuickPlanSheet'
import DirectTripSheet from '../components/DirectTripSheet'
import { addDestinationDots } from '../utils/mapDestinations'
import { getSpotlightDestinations } from '../utils/spotlight'
import { isCacheValid, buildDriveCache, saveDriveCache, formatDriveTime } from '../utils/driveCache'
import type { DriveCache } from '../types'
import type { Destination } from '../data/destinations'
import TopoPattern from '../components/TopoPattern'
// Key must match the one exported from Trips.tsx
const PENDING_DATES_KEY = 'routed-pending-trip-dates'
const WELCOME_SEEN_KEY = 'routed-welcome-seen'

const MAP_STYLE_TERRAIN = 'mapbox://styles/mapbox/outdoors-v12'
const MAP_STYLE_SATELLITE = 'mapbox://styles/mapbox/satellite-streets-v12'

const CREW_COLOURS = [
  '#4A6741',
  '#C4893B',
  '#B85C38',
  '#7C5CBF',
  '#E07A5F',
  '#5B8DB8',
  '#8B6E47',
]

const FAB_SEEN_KEY = 'routed-fab-seen'

function getVehicleBadge(type: 'car' | '4wd' | 'motorbike'): string {
  if (type === 'car') return '🚗'
  if (type === 'motorbike') return '🏍️'
  return '🚙'
}

function createMarkerElement(member: UserProfile, colour: string): HTMLDivElement {
  const initial = member.displayName.charAt(0).toUpperCase()
  const primaryVehicle = member.vehicles?.[0]

  const el = document.createElement('div')
  el.style.cssText = `
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: ${colour};
    border: 2.5px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-family: Fraunces, Georgia, serif;
    font-size: 15px;
    font-weight: 700;
    color: white;
    user-select: none;
  `
  el.textContent = initial

  if (primaryVehicle) {
    const badge = document.createElement('div')
    badge.style.cssText = `
      position: absolute;
      bottom: -4px;
      right: -4px;
      font-size: 11px;
      line-height: 1;
      background: white;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    `
    badge.textContent = getVehicleBadge(primaryVehicle.type)
    el.appendChild(badge)
  }

  return el
}

function buildPopupHTML(member: UserProfile): string {
  const vehicleList =
    member.vehicles && member.vehicles.length > 0
      ? member.vehicles
          .map((v) => `<div style="font-size:12px;color:#8C8578;margin-top:3px;">${getVehicleBadge(v.type)} ${v.name}</div>`)
          .join('')
      : '<div style="font-size:12px;color:#8C8578;margin-top:3px;">No vehicles listed</div>'

  return `
    <div style="font-family: Fraunces, Georgia, serif; font-size:15px; font-weight:700; color:#2D2D2D;">
      ${member.displayName}
    </div>
    ${member.homeLocation ? `<div style="font-size:12px;color:#8C8578;margin-top:2px;">📍 ${member.homeLocation.suburb}</div>` : ''}
    <div style="margin-top:6px;">${vehicleList}</div>
  `
}

type SheetMode = 'closed' | 'full' | 'peek'
type PlanMode = 'picker' | 'quick' | 'manual' | 'destination'

function SpotlightCard({
  dest,
  driveCache,
  onTap,
}: {
  dest: Destination
  driveCache: DriveCache | null
  onTap: (dest: Destination) => void
}) {
  const cached = driveCache?.[dest.id]
  const driveLabel = cached
    ? `${formatDriveTime(cached.durationMinutes)} from you`
    : `~${Math.round((() => {
        const R = 6371, lat1 = -37.0, lng1 = 144.5
        const dLat = ((dest.lat - lat1) * Math.PI) / 180
        const dLng = ((dest.lng - lng1) * Math.PI) / 180
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(dest.lat*Math.PI/180)*Math.sin(dLng/2)**2
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) / 100
      })() * 10) / 10}hr drive`
  const acts = dest.activities.slice(0, 2).map((a) => {
    if (a === 'camping') return '🏕️'
    if (a === 'hiking') return '🥾'
    if (a === 'fishing') return '🎣'
    if (a === '4wd') return '🚙'
    return ''
  })

  return (
    <button
      onClick={() => onTap(dest)}
      style={{
        width: '180px',
        minWidth: '180px',
        height: '100px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(74,103,65,0.2)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '4px',
        cursor: 'pointer',
        textAlign: 'left',
        flexShrink: 0,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.transform = ''
        el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.12)'
      }}
    >
      <div style={{
        fontFamily: 'Fraunces, Georgia, serif',
        fontSize: '13px',
        fontWeight: '700',
        color: '#2D2D2D',
        lineHeight: 1.25,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical' as const,
        maxHeight: '32px',
      }}>
        {dest.name}
      </div>
      <div style={{
        fontSize: '10px',
        fontWeight: '600',
        background: 'rgba(74,103,65,0.1)',
        color: '#4A6741',
        borderRadius: '100px',
        padding: '1px 6px',
        fontFamily: 'DM Sans, system-ui, sans-serif',
      }}>
        {dest.region}
      </div>
      <div style={{
        fontFamily: 'DM Sans, system-ui, sans-serif',
        fontSize: '11px',
        color: '#8C8578',
        marginTop: '2px',
      }}>
        {driveLabel} · {acts.join(' ')}
      </div>
    </button>
  )
}

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [crewLoaded, setCrewLoaded] = useState(false)
  const [isSatellite, setIsSatellite] = useState(false)
  const [sheetMode, setSheetMode] = useState<SheetMode>('closed')
  const [planMode, setPlanMode] = useState<PlanMode>('picker')
  const [preselectDestId, setPreselectDestId] = useState<string | null>(null)
  const [pendingDestForPlanning, setPendingDestForPlanning] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [currentUid, setCurrentUid] = useState<string | null>(null)
  const [driveCache, setDriveCache] = useState<DriveCache | null>(null)
  const [cacheProgress, setCacheProgress] = useState<{ done: number; total: number } | null>(null)
  const [hasTrips, setHasTrips] = useState<boolean | null>(null)
  const dragStartY = useRef<number | null>(null)
  const dragPointerId = useRef<number | null>(null)
  const [dragDelta, setDragDelta] = useState(0)
  const [fabPulse, setFabPulse] = useState(!localStorage.getItem(FAB_SEEN_KEY))
  const [coachMarkVisible, setCoachMarkVisible] = useState(!localStorage.getItem(FAB_SEEN_KEY))
  const [spotlightDests, setSpotlightDests] = useState<Destination[]>([])
  const coachMarkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // For popup shortlist + member data — stored in refs so popup closures always read latest
  const shortlistsRef = useRef<Array<{ memberUid: string; destinationId: string }>>([])
  const crewMembersRef = useRef<UserProfile[]>([])
  const planModeRef = useRef<PlanMode>('picker')
  const [welcomeVisible, setWelcomeVisible] = useState(!localStorage.getItem(WELCOME_SEEN_KEY))
  const [welcomeFading, setWelcomeFading] = useState(false)

  // Keep planModeRef in sync so Mapbox popup closures always read latest value
  useEffect(() => { planModeRef.current = planMode }, [planMode])

  // Listen for auth to get current uid
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid ?? null)
    })
    return unsub
  }, [])

  // Check if user has any trips
  useEffect(() => {
    if (!currentUid) return
    const q = query(collection(db, 'trips'), where('attendees', 'array-contains', currentUid))
    getDocs(q).then((snap) => {
      setHasTrips(snap.size > 0)
    }).catch(() => setHasTrips(false))
  }, [currentUid])

  // Load spotlight destinations
  useEffect(() => {
    const dests = getSpotlightDestinations()
    setSpotlightDests(dests)
  }, [])

  // Auto-dismiss coach mark after 8s
  useEffect(() => {
    if (coachMarkVisible) {
      coachMarkTimer.current = setTimeout(() => {
        setCoachMarkVisible(false)
      }, 8000)
    }
    return () => {
      if (coachMarkTimer.current) clearTimeout(coachMarkTimer.current)
    }
  }, [coachMarkVisible])

  // Initialise map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_TERRAIN,
      center: [133.7751, -25.2744], // Australia
      zoom: 4,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('load', () => {
      // Add destination dots BEFORE crew pins
      addDestinationDots(map, mapboxgl.Popup, {
        getShortlists: () => shortlistsRef.current,
        getMembers: () => crewMembersRef.current,
        onPlanTrip: (destinationId) => {
          if (planModeRef.current === 'manual' || planModeRef.current === 'quick') {
            // Active planning session — resume with destination pre-selected
            setPendingDestForPlanning(destinationId)
            setSheetMode('full')
          } else {
            // No active session — open streamlined direct form
            setPreselectDestId(destinationId)
            setSheetMode('full')
            setPlanMode('destination')
          }
        },
      })
      setMapLoaded(true)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Subscribe to shortlists so popup always has fresh data
  useEffect(() => {
    if (!currentUid) return
    const unsub = onSnapshot(collection(db, 'shortlists'), (snap) => {
      shortlistsRef.current = snap.docs.map((d) => {
        const data = d.data()
        return { memberUid: data.memberUid as string, destinationId: data.destinationId as string }
      })
    })
    return unsub
  }, [currentUid])

  // Check / build drive cache for the current user
  useEffect(() => {
    if (!currentUid) return

    async function checkAndBuildCache() {
      const snap = await getDoc(doc(db, 'users', currentUid!))
      if (!snap.exists()) return
      const profile = snap.data() as UserProfile
      const loc = profile.homeLocation
      if (!loc) return

      if (isCacheValid(profile.driveCache, profile.driveCacheLocation, loc.lat, loc.lng)) {
        setDriveCache(profile.driveCache ?? null)
        return
      }

      // Cache missing/stale — build it
      setCacheProgress({ done: 0, total: 70 })
      try {
        const cache = await buildDriveCache(loc.lat, loc.lng, (done, total) => {
          setCacheProgress({ done, total })
        })
        await saveDriveCache(currentUid!, cache, loc.lat, loc.lng)
        setDriveCache(cache)
      } catch (err) {
        console.error('Drive cache build failed:', err)
      } finally {
        setCacheProgress(null)
      }
    }

    checkAndBuildCache()
  }, [currentUid])

  // Load crew and place markers once map is loaded
  useEffect(() => {
    if (!mapLoaded) return

    const map = mapRef.current
    if (!map) return

    async function loadCrewMarkers() {
      try {
        const snap = await getDocs(collection(db, 'users'))
        const profiles = snap.docs
          .map((d) => d.data() as UserProfile)
          .sort((a, b) => a.uid.localeCompare(b.uid))

        // Store for popup use
        crewMembersRef.current = profiles

        const membersWithLocation = profiles.filter(
          (p) => p.homeLocation && typeof p.homeLocation.lat === 'number' && typeof p.homeLocation.lng === 'number'
        )

        // Clear existing markers
        for (const marker of markersRef.current) {
          marker.remove()
        }
        markersRef.current = []

        if (membersWithLocation.length === 0) {
          setCrewLoaded(true)
          return
        }

        const bounds = new mapboxgl.LngLatBounds()

        membersWithLocation.forEach((member, index) => {
          const colour = CREW_COLOURS[index % CREW_COLOURS.length]
          const el = createMarkerElement(member, colour)
          const popup = new mapboxgl.Popup({ offset: 20, maxWidth: '220px' }).setHTML(
            buildPopupHTML(member)
          )
          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([member.homeLocation!.lng, member.homeLocation!.lat])
            .setPopup(popup)
            .addTo(map!)

          markersRef.current.push(marker)
          bounds.extend([member.homeLocation!.lng, member.homeLocation!.lat])

          if (index === 0) {
            setCurrentUser(member)
          }
        })

        if (membersWithLocation.length > 0) {
          map!.fitBounds(bounds, { padding: 80, maxZoom: 10 })
        }
      } catch (err) {
        console.error('Failed to load crew markers:', err)
      } finally {
        setCrewLoaded(true)
      }
    }

    loadCrewMarkers()
  }, [mapLoaded])

  // Check for pending trip dates from Trips page
  useEffect(() => {
    function checkPendingDates() {
      try {
        const stored = localStorage.getItem(PENDING_DATES_KEY)
        if (stored) {
          localStorage.removeItem(PENDING_DATES_KEY)
          setPlanMode('manual')
          setSheetMode('full')
        }
      } catch { /* ignore */ }
    }
    checkPendingDates()
    window.addEventListener('focus', checkPendingDates)
    return () => window.removeEventListener('focus', checkPendingDates)
  }, [])

  const toggleStyle = () => {
    const map = mapRef.current
    if (!map) return

    const newSatellite = !isSatellite
    setIsSatellite(newSatellite)
    map.setStyle(newSatellite ? MAP_STYLE_SATELLITE : MAP_STYLE_TERRAIN)
  }

  const handlePlanTrip = () => {
    // Mark FAB as seen
    if (!localStorage.getItem(FAB_SEEN_KEY)) {
      localStorage.setItem(FAB_SEEN_KEY, 'true')
      setFabPulse(false)
      setCoachMarkVisible(false)
    }
    setPlanMode('picker')
    setSheetMode('full')
  }

  const handleSheetClose = () => {
    setSheetMode('closed')
    setPlanMode('picker')
  }

  const handleSheetPeek = () => {
    setSheetMode('peek')
  }

  const handleDragHandlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY
    dragPointerId.current = e.pointerId
    setDragDelta(0)
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  }, [])

  const handleDragHandlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null || dragPointerId.current !== e.pointerId) return
    const delta = e.clientY - dragStartY.current
    if (delta > 0) setDragDelta(delta)
  }, [])

  const handleDragHandlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerId.current !== e.pointerId) return
    const delta = e.clientY - (dragStartY.current ?? e.clientY)
    dragStartY.current = null
    dragPointerId.current = null
    setDragDelta(0)
    if (delta > 80) {
      handleSheetClose()
    }
  }, [])

  const handleWelcomeDismiss = () => {
    setWelcomeFading(true)
    setTimeout(() => {
      localStorage.setItem(WELCOME_SEEN_KEY, 'true')
      setWelcomeVisible(false)
      setWelcomeFading(false)
    }, 300)
  }

  const handleSpotlightTap = (dest: Destination) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [dest.lng, dest.lat], zoom: 10 })
  }

  const handleSpotlightShuffle = () => {
    const newDests = getSpotlightDestinations(true)
    setSpotlightDests(newDests)
  }

  const isLoading = !mapLoaded || !crewLoaded
  const sheetVisible = sheetMode !== 'closed'

  // Sheet height based on mode
  const sheetHeight =
    sheetMode === 'full'
      ? 'min(80vh, calc(100dvh - var(--tab-bar-height) - env(safe-area-inset-bottom) - 20px))'
      : sheetMode === 'peek'
      ? '32vh'
      : '0px'

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100dvh - var(--tab-bar-height) - env(safe-area-inset-bottom))',
        overflow: 'hidden',
      }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div
          className="topo-bg-wrapper"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-base)',
            gap: '20px',
          }}
        >
          <TopoPattern />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
            }}
          >
            <div
              style={{
                fontFamily: 'Fraunces, Georgia, serif',
                fontSize: '24px',
                fontWeight: '700',
                color: 'var(--color-moss)',
              }}
            >
              Routed
            </div>
            <div className="spinner" />
          </div>
        </div>
      )}

      {/* Drive cache build progress overlay */}
      {cacheProgress !== null && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 12px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            background: 'rgba(42,42,38,0.92)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '12px',
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            minWidth: '240px',
          }}
        >
          <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '13px', fontWeight: '600', color: '#FAFAF7' }}>
            Calculating your drive times…
          </div>
          <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                borderRadius: '2px',
                background: '#4A6741',
                width: `${Math.round((cacheProgress.done / cacheProgress.total) * 100)}%`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'rgba(250,250,247,0.6)' }}>
            {cacheProgress.done} / {cacheProgress.total} destinations
          </div>
        </div>
      )}

      {/* Map container */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Satellite/Terrain toggle — top right, below navigation controls */}
      <button
        onClick={toggleStyle}
        style={{
          position: 'absolute',
          top: '106px',
          right: '10px',
          zIndex: 10,
          background: 'rgba(30, 30, 28, 0.75)',
          color: 'white',
          border: 'none',
          borderRadius: '100px',
          padding: '6px 12px',
          fontSize: '12px',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          fontWeight: '500',
          cursor: 'pointer',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(30, 30, 28, 0.9)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(30, 30, 28, 0.75)'
        }}
      >
        {isSatellite ? '🗺 Terrain' : '🛰 Satellite'}
      </button>

      {/* Welcome card — shown on first visit, dismissable */}
      {!isLoading && welcomeVisible && !sheetVisible && (
        <div
          className={welcomeFading ? 'welcome-card-fade-out' : ''}
          onClick={handleWelcomeDismiss}
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            background: 'rgba(255,255,255,0.92)',
            borderRadius: '16px',
            padding: '20px 24px',
            maxWidth: '280px',
            textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            cursor: 'pointer',
            transition: 'opacity 0.3s ease',
          }}
        >
          {/* Dismiss × button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleWelcomeDismiss() }}
            aria-label="Dismiss"
            style={{
              position: 'absolute',
              top: '10px',
              right: '12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: 'var(--color-stone)',
              lineHeight: 1,
              padding: '2px 4px',
            }}
          >
            ×
          </button>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '20px', fontWeight: '700', color: 'var(--color-charcoal)', marginBottom: '8px' }}>
            Your crew's on the map.
          </div>
          <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', color: 'var(--color-stone)' }}>
            Tap 'Plan a Trip' to get moving.
          </div>
        </div>
      )}

      {/* Spotlight row — above FAB, hidden when sheet open */}
      {!sheetVisible && spotlightDests.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 76px)',
            left: 0,
            right: 0,
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 0,
          }}
        >
          <div className="spotlight-row" style={{ flex: 1 }}>
            {spotlightDests.map((dest) => (
              <SpotlightCard key={dest.id} dest={dest} driveCache={driveCache} onTap={handleSpotlightTap} />
            ))}
          </div>
          {/* Desktop labelled shuffle button */}
          <button
            onClick={handleSpotlightShuffle}
            className="shuffle-btn-label"
            style={{
              flexShrink: 0,
              marginRight: '12px',
              padding: '6px 10px',
              borderRadius: '100px',
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(74,103,65,0.25)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              cursor: 'pointer',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '12px',
              fontWeight: '600',
              color: '#4A6741',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            ↺ Shuffle
          </button>
          {/* Mobile icon-only shuffle button */}
          <button
            onClick={handleSpotlightShuffle}
            aria-label="Shuffle destinations"
            className="shuffle-btn-icon"
            style={{
              flexShrink: 0,
              marginRight: '12px',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(74,103,65,0.25)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4A6741',
              fontSize: '18px',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            ↺
          </button>
        </div>
      )}

      {/* Coach mark tooltip — shown on first use */}
      {coachMarkVisible && hasTrips === false && !sheetVisible && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 76px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 25,
            background: 'var(--color-charcoal)',
            color: '#FAFAF7',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '13px',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          Tap here to plan your first trip →
          {/* Triangle pointing down at FAB */}
          <div style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid var(--color-charcoal)',
          }} />
        </div>
      )}

      {/* Plan a Trip FAB — pill shaped, centred, hidden when sheet open */}
      <button
        onClick={handlePlanTrip}
        aria-label="Plan a Trip"
        className={fabPulse ? 'fab-pulse' : ''}
        style={{
          position: 'fixed',
          bottom: 'calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 16px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          height: '48px',
          paddingLeft: '20px',
          paddingRight: '24px',
          borderRadius: '24px',
          backgroundColor: '#4A6741',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 16px rgba(74, 103, 65, 0.4)',
          transition: fabPulse ? 'none' : 'transform 0.15s ease, box-shadow 0.15s ease',
          visibility: sheetVisible ? 'hidden' : 'visible',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!fabPulse) {
            const btn = e.currentTarget as HTMLButtonElement
            btn.style.transform = 'translateX(-50%) scale(1.04)'
            btn.style.boxShadow = '0 6px 20px rgba(74, 103, 65, 0.5)'
          }
        }}
        onMouseLeave={(e) => {
          if (!fabPulse) {
            const btn = e.currentTarget as HTMLButtonElement
            btn.style.transform = 'translateX(-50%)'
            btn.style.boxShadow = '0 4px 16px rgba(74, 103, 65, 0.4)'
          }
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span style={{
          fontFamily: 'DM Sans, system-ui, sans-serif',
          fontSize: '14px',
          fontWeight: '600',
          color: 'white',
        }}>
          Plan a Trip
        </span>
      </button>

      {/* Bottom Sheet */}
      <div
        onClick={sheetMode === 'peek' ? () => setSheetMode('full') : undefined}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(var(--tab-bar-height) + env(safe-area-inset-bottom))',
          height: sheetHeight,
          zIndex: 30,
          background: 'var(--color-surface)',
          borderRadius: sheetMode === 'peek' ? '16px 16px 0 0' : '20px 20px 0 0',
          boxShadow: sheetVisible ? '0 -4px 24px rgba(0,0,0,0.15)' : 'none',
          transform: sheetVisible ? `translateY(${dragDelta}px)` : 'translateY(100%)',
          transition: dragDelta > 0 ? 'none' : 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
          overflow: 'hidden',
          cursor: sheetMode === 'peek' ? 'pointer' : 'default',
        }}
      >
        {sheetVisible && planMode === 'manual' && (
          <TripSheet
            mapRef={mapRef}
            currentUser={currentUser}
            onClose={handleSheetClose}
            onPeek={handleSheetPeek}
            onDragHandlePointerDown={handleDragHandlePointerDown}
            onDragHandlePointerMove={handleDragHandlePointerMove}
            onDragHandlePointerUp={handleDragHandlePointerUp}
            pendingDestinationId={pendingDestForPlanning}
            onPendingDestConsumed={() => setPendingDestForPlanning(null)}
          />
        )}
        {sheetVisible && planMode !== 'manual' && (
          <>
            {/* Drag handle */}
            <div
              onPointerDown={handleDragHandlePointerDown}
              onPointerMove={handleDragHandlePointerMove}
              onPointerUp={handleDragHandlePointerUp}
              style={{
                display: 'flex',
                justifyContent: 'center',
                paddingTop: '10px',
                paddingBottom: '4px',
                cursor: 'grab',
                touchAction: 'none',
                userSelect: 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 2,
              }}
            >
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--color-stone)', opacity: 0.4 }} />
            </div>

            {/* Close button */}
            <button
              onClick={handleSheetClose}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '10px',
                right: '16px',
                zIndex: 3,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-stone)',
                fontSize: '22px',
                lineHeight: 1,
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>

            {/* Sheet content — scrollable */}
            <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingTop: '24px' }}>
              {planMode === 'destination' && preselectDestId ? (
                <DirectTripSheet
                  destinationId={preselectDestId}
                  currentUser={currentUser}
                  onClose={handleSheetClose}
                  onChangeDest={() => { setPreselectDestId(null); setPlanMode('picker') }}
                />
              ) : planMode === 'quick' ? (
                <QuickPlanSheet
                  mapRef={mapRef}
                  currentUser={currentUser}
                  onClose={handleSheetClose}
                  onSwitchToManual={() => setPlanMode('manual')}
                  pendingDestinationId={pendingDestForPlanning}
                  onPendingDestConsumed={() => setPendingDestForPlanning(null)}
                />
              ) : (
                /* Plan mode picker */
                <div style={{ padding: '8px 20px 20px' }}>
                  <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '22px', fontWeight: '700', color: 'var(--color-charcoal)', margin: '0 0 20px' }}>
                    Plan a Trip
                  </h2>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    {([
                      { key: 'quick' as PlanMode, icon: '⚡', title: 'Quick Plan', sub: '4 taps to your next adventure' },
                      { key: 'manual' as PlanMode, icon: '⚙️', title: 'Manual', sub: 'Full control over every detail' },
                    ]).map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setPlanMode(opt.key)}
                        style={{
                          flex: 1,
                          height: '140px',
                          borderRadius: '16px',
                          border: '1.5px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '16px',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget
                          el.style.borderColor = '#4A6741'
                          el.style.background = 'rgba(74,103,65,0.04)'
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget
                          el.style.borderColor = 'var(--color-border)'
                          el.style.background = 'var(--color-surface)'
                        }}
                      >
                        <span style={{ fontSize: '28px' }}>{opt.icon}</span>
                        <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '16px', fontWeight: '700', color: 'var(--color-charcoal)' }}>{opt.title}</span>
                        <span style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '12px', color: 'var(--color-stone)', textAlign: 'center' }}>{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPlanMode('manual')}
                    style={{ background: 'none', border: 'none', color: '#4A6741', fontSize: '14px', fontWeight: '600', fontFamily: 'DM Sans, system-ui, sans-serif', cursor: 'pointer', padding: '4px 0' }}
                  >
                    Or browse all destinations →
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Back to planning button — shown when peeking with active plan */}
      {sheetMode === 'peek' && (planMode === 'manual' || planMode === 'quick') && (
        <button
          onClick={() => setSheetMode('full')}
          style={{
            position: 'absolute',
            bottom: 'calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 16px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            background: 'var(--color-moss)',
            color: '#FAFAF7',
            border: 'none',
            borderRadius: '100px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '700',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            whiteSpace: 'nowrap',
          }}
        >
          ← Back to planning
        </button>
      )}

      {/* Backdrop overlay when sheet is full */}
      {sheetMode === 'full' && (
        <div
          onClick={handleSheetClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 29,
            background: 'rgba(0,0,0,0.2)',
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
