---
phase: "05"
plan: "02"
subsystem: "storage"
tags: [firebase-storage, avatar, migration, profile]
dependency_graph:
  requires: [05-01]
  provides: [avatar-storage-upload, lazy-avatar-migration]
  affects: [Profile.tsx, firebase.ts]
tech_stack:
  added: [firebase/storage (getStorage, ref, uploadBytes, getDownloadURL)]
  patterns: [Storage upload from Blob, lazy on-mount migration useEffect]
key_files:
  created: []
  modified:
    - src/firebase.ts
    - src/pages/Profile.tsx
decisions:
  - "Tasks 2 and 3 committed together — both modify Profile.tsx and are logically coupled"
  - "getUserPhoto() confirmed unchanged — already returns customPhotoURL as-is, works for both data URIs and HTTPS URLs"
  - "useEffect for lazy migration runs once on mount with empty dependency array — profile.customPhotoURL is a stable prop passed in"
metrics:
  duration: "~10 min"
  completed: "2026-04-07"
  tasks_completed: 4
  files_modified: 2
  files_created: 0
---

# Phase 05 Plan 02: Avatar migration — base64 Firestore blobs to Firebase Storage URLs Summary

New avatar uploads go to Firebase Storage at `avatars/{uid}.jpg` with download URL written to Firestore; existing base64 avatars are lazily migrated to Storage on first profile load.

## What Was Built

### Task 1 — `src/firebase.ts`
Added `getStorage` import and exported `storage = getStorage(app)`. The `storageBucket` was already present in `firebaseConfig` via `VITE_FIREBASE_STORAGE_BUCKET`.

### Task 2 — `handlePhotoChange` in `src/pages/Profile.tsx`
Replaced direct base64 Firestore write with Storage upload flow:
1. `processImage()` still produces a compressed JPEG data URI (128×128px, ≤70KB) — unchanged
2. Data URI is fetched and converted to a Blob
3. Blob is uploaded to `avatars/{uid}.jpg` via `uploadBytes`
4. `getDownloadURL` retrieves the HTTPS URL
5. HTTPS URL is written to `users/{uid}.customPhotoURL` in Firestore (not the base64 string)

### Task 3 — Lazy migration `useEffect` in `src/pages/Profile.tsx`
Added a `useEffect(() => { ... }, [])` that runs once on mount. If `profile.customPhotoURL` starts with `data:`, it performs the same Storage upload + URL overwrite automatically. Failures are caught and logged; the original base64 photo still displays via local `customPhoto` state.

### Task 4 — `getUserPhoto` confirmed no changes needed
`src/utils/userPhoto.ts` returns `profile.customPhotoURL ?? profile.photoURL ?? null` — works correctly for both legacy data URIs and new HTTPS URLs. Already has docstring comment.

## Deviations from Plan

None - plan executed exactly as written. Tasks 2 and 3 were committed together (single Profile.tsx change) for atomicity.

## Known Stubs

None — Storage upload is fully wired. Migration runs on mount automatically.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: storage-auth | src/pages/Profile.tsx | Firebase Storage security rules must restrict `avatars/{uid}` writes to authenticated owner — verify rules in Firebase Console before production use |

## Verification

- TypeScript: `npx tsc --noEmit` — clean (0 errors)
- Build: `npm run build` — succeeds in 4.95s
- `storage` export confirmed present in firebase.ts
- `handlePhotoChange` confirmed uses `uploadBytes` + `getDownloadURL` (no base64 to Firestore)
- Lazy migration `useEffect` confirmed present with `startsWith('data:')` guard
- `getUserPhoto` confirmed unchanged

## Self-Check: PASSED

- `src/firebase.ts` — exports `storage = getStorage(app)` confirmed
- `src/pages/Profile.tsx` — Storage upload in handlePhotoChange confirmed; lazy migration useEffect confirmed
- `src/utils/userPhoto.ts` — unchanged, confirmed
- Commits 5ac37b1, da757fd — present in git log
