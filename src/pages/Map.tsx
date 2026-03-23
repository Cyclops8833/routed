import { useEffect, useRef, useState, useCallback } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { db } from '../firebase'
import { MAPBOX_TOKEN } from '../config'
import type { UserProfile } from '../types'
import TripSheet from '../components/TripSheet'

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

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [crewLoaded, setCrewLoaded] = useState(false)
  const [isSatellite, setIsSatellite] = useState(false)
  const [sheetMode, setSheetMode] = useState<SheetMode>('closed')
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const dragStartY = useRef<number | null>(null)
  const dragPointerId = useRef<number | null>(null)
  const [dragDelta, setDragDelta] = useState(0)

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
      setMapLoaded(true)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

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

          // Use first member with location as current user proxy (or auth user in a real app)
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

  const toggleStyle = () => {
    const map = mapRef.current
    if (!map) return

    const newSatellite = !isSatellite
    setIsSatellite(newSatellite)
    map.setStyle(newSatellite ? MAP_STYLE_SATELLITE : MAP_STYLE_TERRAIN)
  }

  const handlePlanTrip = () => {
    setSheetMode('full')
  }

  const handleSheetClose = () => {
    setSheetMode('closed')
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

  const isLoading = !mapLoaded || !crewLoaded

  // Sheet height based on mode
  const sheetHeight =
    sheetMode === 'full'
      ? 'min(80vh, calc(100dvh - var(--tab-bar-height) - env(safe-area-inset-bottom) - 20px))'
      : sheetMode === 'peek'
      ? '32vh'
      : '0px'

  const sheetVisible = sheetMode !== 'closed'

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
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-base)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='140' viewBox='0 0 200 140'%3E%3Cellipse cx='100' cy='70' rx='90' ry='55' fill='none' stroke='%234A6741' stroke-width='0.8' opacity='0.18'/%3E%3Cellipse cx='100' cy='70' rx='72' ry='42' fill='none' stroke='%234A6741' stroke-width='0.8' opacity='0.18'/%3E%3Cellipse cx='100' cy='70' rx='54' ry='30' fill='none' stroke='%234A6741' stroke-width='0.8' opacity='0.18'/%3E%3Cellipse cx='100' cy='70' rx='36' ry='19' fill='none' stroke='%234A6741' stroke-width='0.8' opacity='0.18'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '200px 140px',
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

      {/* Plan a Trip FAB — hidden when sheet is open */}
      <button
        onClick={handlePlanTrip}
        aria-label="Plan a Trip"
        style={{
          position: 'fixed',
          bottom: 'calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 16px)',
          right: '20px',
          zIndex: 20,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#4A6741',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(74, 103, 65, 0.4)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease, visibility 0s',
          visibility: sheetVisible ? 'hidden' : 'visible',
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement
          btn.style.transform = 'scale(1.05)'
          btn.style.boxShadow = '0 6px 20px rgba(74, 103, 65, 0.5)'
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement
          btn.style.transform = ''
          btn.style.boxShadow = '0 4px 16px rgba(74, 103, 65, 0.4)'
        }}
        onMouseDown={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)'
        }}
        onMouseUp={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
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
        {sheetVisible && (
          <TripSheet
            mapRef={mapRef}
            currentUser={currentUser}
            onClose={handleSheetClose}
            onPeek={handleSheetPeek}
            onDragHandlePointerDown={handleDragHandlePointerDown}
            onDragHandlePointerMove={handleDragHandlePointerMove}
            onDragHandlePointerUp={handleDragHandlePointerUp}
          />
        )}
      </div>

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
