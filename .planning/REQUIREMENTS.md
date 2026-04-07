---
milestone: v1.1
status: active
created: 2026-04-08
---

# Routed v1.1 — Requirements

> Crew engagement layer: keep everyone looped in, talking, and exploring new spots.

---

## Goals

1. **Push notifications** — OS-level alerts for key trip events so the crew stays in sync without opening the app
2. **Trip chat / comments** — Per-trip comment thread so the crew can discuss without leaving Routed
3. **More destinations** — Expand beyond 70 curated spots across regional Victoria

---

## Requirements

### REQ-NOTIF: Push Notifications

| ID | Requirement | Priority |
|----|-------------|----------|
| NOTIF-01 | Users can opt in to push notifications (FCM token registration) | Must |
| NOTIF-02 | Notification sent when a trip moves to voting state ("Vote needed for [trip]") | Must |
| NOTIF-03 | Notification sent when a trip is confirmed ("[Trip] is on — check costs") | Must |
| NOTIF-04 | Notification sent when a new trip is proposed ("[User] proposed a trip to [destination]") | Must |
| NOTIF-05 | Reminder notification X days before a confirmed trip's start date ("[Trip] is X days away") | Must |
| NOTIF-06 | Shame notification for crew members who haven't voted/responded after a threshold period | Should |
| NOTIF-07 | Delivery approach must work within Firebase Spark tier (no Cloud Functions) | Constraint |
| NOTIF-08 | FCM tokens stored in Firestore per user, refreshed on app load | Must |

> **Note:** Delivery architecture TBD — researcher to investigate Spark-tier options (client-side FCM, scheduled web workers, etc.)

---

### REQ-CHAT: Trip Chat / Comments

| ID | Requirement | Priority |
|----|-------------|----------|
| CHAT-01 | Each trip has a comment/message thread accessible from the trip detail view | Must |
| CHAT-02 | Crew members can post text messages to the thread | Must |
| CHAT-03 | Messages show author avatar, name, timestamp | Must |
| CHAT-04 | New messages appear without manual refresh (Firestore onSnapshot) | Must |
| CHAT-05 | Unread message count shown on trip card or notification badge | Should |

> **Note:** Threading depth, rich media, reactions — scope to be finalised in discuss-phase.

---

### REQ-DEST: More Destinations

| ID | Requirement | Priority |
|----|-------------|----------|
| DEST-01 | Destination list expanded beyond current 70 spots | Must |
| DEST-02 | New destinations follow same data shape (id, name, coords, region, tags, photo URL) | Must |
| DEST-03 | Each new destination has a curated Unsplash photo URL | Must |
| DEST-04 | Map dot density remains readable (no clustering required at target count) | Must |
| DEST-05 | Drive cache pre-fetch covers all new destinations automatically | Must |

---

## Out of Scope (v1.1)

- Native mobile app / App Store distribution
- User-submitted destinations (curator-only expansion for now)
- Booking / external links beyond current pattern
- Rich media in chat (images, links with previews)
- Notification preferences UI (opt-in/out per notification type) — v1.2+

---

## Success Criteria

- [ ] A crew member with notifications enabled receives an OS push when a trip moves to voting
- [ ] Crew can have a back-and-forth conversation inside a trip without leaving the app
- [ ] At least 30 new destinations added with photos, visible on the map
- [ ] Build stays green, no regressions

---

*Created: 2026-04-08*
