import type { UserProfile } from '../types'

/**
 * Returns the best available photo URL for a user.
 * Prefers customPhotoURL (uploaded), then falls back to Google photoURL.
 */
export function getUserPhoto(profile: UserProfile): string | null {
  return profile.customPhotoURL ?? profile.photoURL ?? null
}
