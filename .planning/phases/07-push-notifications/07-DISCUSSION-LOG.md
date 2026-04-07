# Phase 7: Push notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-08
**Phase:** 07-push-notifications
**Mode:** discuss
**Areas discussed:** Permission prompt timing, Shame threshold, FCM token storage shape

---

## Gray Areas Presented

| Area | Options presented | Selected |
|------|-------------------|----------|
| Permission prompt timing | Contextual trigger / Settings toggle / Onboarding step | Contextual trigger |
| Shame threshold | 48hr fixed / Creator-set deadline / 72hr then daily | 72hr then daily |
| FCM token storage | users/{uid} doc / separate fcmTokens collection | users/{uid} doc |

---

## Decisions Made

### Permission prompt timing
- **Selected:** Contextual trigger
- **Rationale:** Ask when the first relevant event fires for a user who hasn't opted in yet. Most respectful approach, best acceptance rate.

### Shame threshold
- **Selected:** 72hr then daily until voted
- **Rationale:** Maximum guilt. First shame fires 72hr after trip moves to voting. Daily follow-ups until user votes or trip moves out of voting state.

### FCM token storage
- **Selected:** Inside users/{uid} doc (add fcmToken field)
- **Rationale:** Simple, one less collection. One token per user (last device wins). Fine at 7-8 user scale.

---

## Research Dependency

Delivery architecture not decided — user explicitly requested research-first. Researcher must determine viable Spark-tier approach (no Cloud Functions). Options to investigate: FCM v1 API from client, Cloudflare Worker relay, Web Push (VAPID).

---

## No Corrections

All options accepted as discussed — no corrections needed.
