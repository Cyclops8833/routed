import { collection, doc, setDoc, deleteDoc, addDoc, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export interface Availability {
  id?: string
  memberUid: string
  weekendId: string | null
  startDate: string
  endDate: string
  available: boolean
  updatedAt: Date
}

/** Set availability for a long weekend. Document ID: `${memberUid}_${weekendId}`. */
export async function setWeekendAvailability(
  memberUid: string,
  weekendId: string,
  available: boolean
): Promise<void> {
  const docId = `${memberUid}_${weekendId}`
  await setDoc(doc(db, 'availability', docId), {
    memberUid,
    weekendId,
    startDate: '',
    endDate: '',
    available,
    updatedAt: Timestamp.now(),
  })
}

/** Remove a weekend availability entry. */
export async function removeWeekendAvailability(
  memberUid: string,
  weekendId: string
): Promise<void> {
  const docId = `${memberUid}_${weekendId}`
  await deleteDoc(doc(db, 'availability', docId))
}

/** Set custom date range availability (auto-generated document ID). */
export async function setCustomAvailability(
  memberUid: string,
  startDate: string,
  endDate: string
): Promise<void> {
  await addDoc(collection(db, 'availability'), {
    memberUid,
    weekendId: null,
    startDate,
    endDate,
    available: true,
    updatedAt: Timestamp.now(),
  })
}

/** Subscribe to all availability documents (real-time). */
export function subscribeToAllAvailability(
  callback: (availability: Availability[]) => void
): () => void {
  return onSnapshot(collection(db, 'availability'), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Availability))
    callback(items)
  })
}

/** Remove an availability entry by document ID. */
export async function removeAvailability(availabilityId: string): Promise<void> {
  await deleteDoc(doc(db, 'availability', availabilityId))
}
