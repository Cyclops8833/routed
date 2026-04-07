import { memo } from 'react'
import type { Destination } from '../data/destinations'
import type { DriveCache, HomeLocation } from '../types'
import { formatDriveTime } from '../utils/driveCache'

interface SpotlightCardProps {
  dest: Destination
  driveCache: DriveCache | null
  userHomeLocation: HomeLocation | null
  onTap: (dest: Destination) => void
}

function SpotlightCard({
  dest,
  driveCache,
  userHomeLocation,
  onTap,
}: SpotlightCardProps) {
  const cached = driveCache?.[dest.id]
  const driveLabel = cached
    ? `${formatDriveTime(cached.durationMinutes)} from you`
    : `~${Math.round((() => {
        const R = 6371, lat1 = userHomeLocation?.lat ?? -37.0, lng1 = userHomeLocation?.lng ?? 144.5
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

export default memo(SpotlightCard)
