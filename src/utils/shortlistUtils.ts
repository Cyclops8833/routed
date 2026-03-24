import { collection, doc, setDoc, deleteDoc, query, where, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import type { Shortlist } from '../types'

/** Toggle shortlist for current user. Document ID is `${memberUid}_${destinationId}`. */
export async function toggleShortlist(
  memberUid: string,
  destinationId: string,
  isCurrentlyShortlisted: boolean
): Promise<void> {
  const docId = `${memberUid}_${destinationId}`
  const ref = doc(db, 'shortlists', docId)
  if (isCurrentlyShortlisted) {
    await deleteDoc(ref)
  } else {
    await setDoc(ref, { memberUid, destinationId, createdAt: Timestamp.now() })
  }
}

/** Subscribe to all shortlists for a specific destination (real-time). */
export function subscribeToDestinationShortlists(
  destinationId: string,
  callback: (shortlists: Shortlist[]) => void
): () => void {
  const q = query(collection(db, 'shortlists'), where('destinationId', '==', destinationId))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shortlist))
    callback(items)
  })
}

/** Subscribe to all shortlists by a specific member (real-time). */
export function subscribeToMemberShortlists(
  memberUid: string,
  callback: (shortlists: Shortlist[]) => void
): () => void {
  const q = query(collection(db, 'shortlists'), where('memberUid', '==', memberUid))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shortlist))
    callback(items)
  })
}

/** Subscribe to ALL shortlists (for crew wishlist view). Use with care. */
export function subscribeToAllShortlists(
  callback: (shortlists: Shortlist[]) => void
): () => void {
  return onSnapshot(collection(db, 'shortlists'), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shortlist))
    callback(items)
  })
}
