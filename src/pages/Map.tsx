import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
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
import { isCacheValid, buildDriveCache } from '../utils/driveCache'
import { fetchRoutes, drawRoutes } from '../utils/mapRoutes'
import type { DriveCache } from '../types'
import { destinations } from '../data/destinations'
import type { Destination } from '../data/destinations'
import TopoPattern from '../components/TopoPattern'
import SpotlightCard from '../components/SpotlightCard'
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
    position: absolute;
    transform: translate(-50%, -50%);
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

export default function MapPage() {
  const location = useLocation()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [crewLoaded, setCrewLoaded] = useState(false)
  const [isSatellite, setIsSatellite] = useState(false)
  const [isTerrain, setIsTerrain] = useState(false)
  const [mapPitch, setMapPitch] = useState(0)
  const isTerrainRef = useRef(false)
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

  // Keep isTerrainRef in sync so style.load closure reads latest value
  useEffect(() => { isTerrainRef.current = isTerrain }, [isTerrain])

  // Listen for auth to get current uid
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid ?? null)
    })
    return unsub
  }, [])

  // Load current user's own profile by their UID
  useEffect(() => {
    if (!currentUid) return
    getDoc(doc(db, 'users', currentUid)).then((snap) => {
      if (snap.exists()) setCurrentUser(snap.data() as UserProfile)
    })
  }, [currentUid])

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

  const applyTerrain = useCallback((map: mapboxgl.Map) => {
    if (!map.getSource('mapbox-dem')) {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      })
    }
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })
  }, [])

  const removeTerrain = useCallback((map: mapboxgl.Map) => {
    map.setTerrain(null)
  }, [])

  // Initialise map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_TERRAIN,
      center: [133.7751, -25.2744], // Australia
      zoom: 4,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.AttributionControl({ compact: true }))

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

      // Track pitch changes for tilt button active state
      map.on('pitch', () => {
        setMapPitch(map.getPitch())
      })

      // Re-apply dots + terrain after style swap (setStyle wipes all custom sources/layers)
      map.on('style.load', () => {
        addDestinationDots(map, mapboxgl.Popup, {
          getShortlists: () => shortlistsRef.current,
          getMembers: () => crewMembersRef.current,
          onPlanTrip: (destinationId) => {
            if (planModeRef.current === 'manual' || planModeRef.current === 'quick') {
              setPendingDestForPlanning(destinationId)
              setSheetMode('full')
            } else {
              setPreselectDestId(destinationId)
              setSheetMode('full')
              setPlanMode('destination')
            }
          },
        })
        if (isTerrainRef.current) {
          applyTerrain(map)
          // Re-add sky layer
          if (!map.getLayer('sky-layer')) {
            map.addLayer({
              id: 'sky-layer',
              type: 'sky',
              paint: {
                'sky-type': 'atmosphere',
                'sky-atmosphere-sun-intensity': 5,
                'sky-atmosphere-sun': [0, 80],
                'sky-atmosphere-color': '#78b4e0',
                'sky-atmosphere-halo-color': '#e0d8c8',
              },
            } as mapboxgl.AnyLayer)
          }
        }
      })
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Apply/remove 3D terrain when toggle changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    if (isTerrain) {
      applyTerrain(map)
      // Add static daytime sky layer for atmosphere
      if (!map.getLayer('sky-layer')) {
        map.addLayer({
          id: 'sky-layer',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun-intensity': 5,
            'sky-atmosphere-sun': [0, 80],
            'sky-atmosphere-color': '#78b4e0',
            'sky-atmosphere-halo-color': '#e0d8c8',
          },
        } as mapboxgl.AnyLayer)
      }
    } else {
      removeTerrain(map)
      if (map.getLayer('sky-layer')) map.removeLayer('sky-layer')
    }
  }, [isTerrain, mapLoaded, applyTerrain, removeTerrain])

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

      // Cache missing, stale, or partial — build/resume it
      // Only reuse existing cache entries if the home location hasn't changed (D-15 threat guard)
      const locationMatch =
        profile.driveCacheLocation &&
        Math.abs(profile.driveCacheLocation.lat - loc.lat) < 0.001 &&
        Math.abs(profile.driveCacheLocation.lng - loc.lng) < 0.001
      const existingCache = locationMatch ? profile.driveCache : undefined

      setCacheProgress({ done: 0, total: destinations.length })
      try {
        const cache = await buildDriveCache(
          loc.lat,
          loc.lng,
          currentUid!,
          existingCache,
          (done, total) => {
            setCacheProgress({ done, total })
          }
        )
        // No separate saveDriveCache call needed — buildDriveCache saves incrementally.
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
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([member.homeLocation!.lng, member.homeLocation!.lat])
            .setPopup(popup)
            .addTo(map!)

          markersRef.current.push(marker)
          bounds.extend([member.homeLocation!.lng, member.homeLocation!.lat])
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

  // Draw routes when navigated from TripDetail with focusDestId — no sheet, just lines
  useEffect(() => {
    if (!mapLoaded || !crewLoaded) return
    const focusDestId = (location.state as { focusDestId?: string } | null)?.focusDestId
    if (!focusDestId) return

    const map = mapRef.current
    if (!map) return

    const dest = destinations.find((d) => d.id === focusDestId)
    if (!dest) return

    const membersWithLocation = crewMembersRef.current
      .filter((p) => p.homeLocation && typeof p.homeLocation.lat === 'number')

    if (membersWithLocation.length === 0) return

    const routeMembers = membersWithLocation.map((p, idx) => ({
      uid: p.uid,
      name: p.displayName,
      colour: CREW_COLOURS[idx % CREW_COLOURS.length],
      lat: p.homeLocation!.lat,
      lng: p.homeLocation!.lng,
    }))

    map.flyTo({ center: [dest.lng, dest.lat], zoom: 8, duration: 1200 })

    fetchRoutes(routeMembers, { lat: dest.lat, lng: dest.lng }).then((routes) => {
      drawRoutes(map, routes)
    })
  }, [mapLoaded, crewLoaded])

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

  const handleTiltToggle = () => {
    mapRef.current?.easeTo({ pitch: mapPitch > 5 ? 0 : 60, duration: 400 })
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

  const handleSpotlightTap = useCallback((dest: Destination) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [dest.lng, dest.lat], zoom: 10 })
  }, [])

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

      {/* === Map controls — top right === */}

      {/* Topo / Satellite style pill */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        <button
          onClick={() => { if (isSatellite) toggleStyle() }}
          aria-pressed={!isSatellite}
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontWeight: '600',
            background: !isSatellite ? '#4A6741' : 'rgba(30,30,28,0.75)',
            color: 'white',
            border: 'none',
            cursor: isSatellite ? 'pointer' : 'default',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          Topo
        </button>
        <button
          onClick={() => { if (!isSatellite) toggleStyle() }}
          aria-pressed={isSatellite}
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontWeight: '600',
            background: isSatellite ? '#4A6741' : 'rgba(30,30,28,0.75)',
            color: 'white',
            border: 'none',
            cursor: !isSatellite ? 'pointer' : 'default',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          Sat
        </button>
      </div>

      {/* 3D Terrain toggle */}
      <button
        onClick={() => setIsTerrain((prev) => !prev)}
        aria-pressed={isTerrain}
        style={{
          position: 'absolute',
          top: '82px',
          right: '10px',
          zIndex: 10,
          padding: '6px 12px',
          fontSize: '12px',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          fontWeight: '600',
          background: isTerrain ? '#4A6741' : 'rgba(30,30,28,0.75)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          transition: 'background 0.15s ease',
        }}
      >
        3D
      </button>

      {/* Tilt / pitch toggle */}
      <button
        onClick={handleTiltToggle}
        aria-pressed={mapPitch > 5}
        style={{
          position: 'absolute',
          top: '122px',
          right: '10px',
          zIndex: 10,
          padding: '6px 12px',
          fontSize: '12px',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          fontWeight: '600',
          background: mapPitch > 5 ? '#4A6741' : 'rgba(30,30,28,0.75)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          transition: 'background 0.15s ease',
        }}
      >
        Tilt
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
              <SpotlightCard key={dest.id} dest={dest} driveCache={driveCache} userHomeLocation={currentUser?.homeLocation ?? null} onTap={handleSpotlightTap} />
            ))}
          </div>
          <button
            onClick={handleSpotlightShuffle}
            aria-label="Shuffle destinations"
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
