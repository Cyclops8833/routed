import { useState } from 'react'
import type { UserProfile } from '../types'
import { toggleShortlist } from '../utils/shortlistUtils'

interface ShortlistButtonProps {
  destinationId: string
  currentUserUid: string
  shortlistedByUids: string[]  // uids of all members who shortlisted this
  allMembers: UserProfile[]    // to show avatars
  size?: 'sm' | 'md'          // sm for map popups, md for cards
}

function MemberAvatar({ member, size = 20 }: { member: UserProfile; size?: number }) {
  const src = member.customPhotoURL ?? member.photoURL
  if (src) {
    return (
      <img
        src={src}
        alt={member.displayName}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1.5px solid var(--color-surface)',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#C4893B',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.45,
        fontWeight: '700',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        border: '1.5px solid var(--color-surface)',
        flexShrink: 0,
      }}
    >
      {member.displayName.charAt(0).toUpperCase()}
    </div>
  )
}

export default function ShortlistButton({
  destinationId,
  currentUserUid,
  shortlistedByUids,
  allMembers,
  size = 'md',
}: ShortlistButtonProps) {
  const isShortlisted = shortlistedByUids.includes(currentUserUid)
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [error, setError] = useState(false)

  const effectivelyShortlisted = optimistic !== null ? optimistic : isShortlisted

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    const prev = effectivelyShortlisted
    setOptimistic(!prev)
    setError(false)
    try {
      await toggleShortlist(currentUserUid, destinationId, prev)
      setOptimistic(null)
    } catch {
      setOptimistic(prev) // revert
      setError(true)
    }
  }

  const avatarUids = shortlistedByUids.slice(0, 3)
  const extraCount = shortlistedByUids.length - avatarUids.length
  const avatarMembers = avatarUids
    .map((uid) => allMembers.find((m) => m.uid === uid))
    .filter((m): m is UserProfile => m !== undefined)

  const isSm = size === 'sm'
  const btnSize = isSm ? 28 : 32
  const iconSize = isSm ? 14 : 16

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={handleClick}
        title={effectivelyShortlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        style={{
          width: btnSize,
          height: btnSize,
          borderRadius: '50%',
          border: `1.5px solid ${effectivelyShortlisted ? '#C4893B' : 'rgba(140,133,120,0.3)'}`,
          background: effectivelyShortlisted ? 'rgba(196,137,59,0.1)' : 'var(--color-surface)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          padding: 0,
          flexShrink: 0,
          outline: error ? '2px solid #E07A5F' : 'none',
        }}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill={effectivelyShortlisted ? '#C4893B' : 'none'}
          stroke={effectivelyShortlisted ? '#C4893B' : 'var(--color-stone)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>

      {/* Avatar row — only in md size */}
      {size === 'md' && shortlistedByUids.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '-4px' }}>
          {avatarMembers.map((m, i) => (
            <div key={m.uid} style={{ marginLeft: i === 0 ? 0 : -6 }}>
              <MemberAvatar member={m} size={16} />
            </div>
          ))}
          {extraCount > 0 && (
            <span
              style={{
                marginLeft: -4,
                fontSize: '10px',
                fontWeight: '600',
                color: 'var(--color-stone)',
                fontFamily: 'DM Sans, system-ui, sans-serif',
              }}
            >
              +{extraCount}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
