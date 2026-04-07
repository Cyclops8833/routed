---
phase: 7
slug: push-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — project has no test infrastructure |
| **Config file** | None |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build` + Firestore Console inspect for token writes
- **Before `/gsd-verify-work`:** Build green + all manual verifications checked
- **Max feedback latency:** ~15 seconds (build only)

---

## Per-Task Verification Map

| Task | Req | Wave | Behavior | Test Type | Automated Command | Status |
|------|-----|------|----------|-----------|-------------------|--------|
| Token registration | NOTIF-01/08 | 1 | `fcmToken` written to `users/{uid}` in Firestore after permission grant | Manual | `npm run build` | ⬜ pending |
| Permission prompt | NOTIF-01 | 1 | Contextual prompt fires when vote event detected, not on load | Manual | `npm run build` | ⬜ pending |
| CF Worker deploy | NOTIF-07 | 1 | Worker deployed, returns 200 to test POST | Manual | — | ⬜ pending |
| vote_requested | NOTIF-02 | 2 | Push received when trip moves to voting | Manual smoke | `npm run build` | ⬜ pending |
| trip_confirmed | NOTIF-03 | 2 | Push received when trip confirmed | Manual smoke | `npm run build` | ⬜ pending |
| trip_proposed | NOTIF-04 | 2 | Push received when new trip created | Manual smoke | `npm run build` | ⬜ pending |
| trip_approaching | NOTIF-05 | 2 | Push received 7 days before start | Manual | — | ⬜ pending |
| shame_72hr | NOTIF-06 | 2 | Shame fires after 72hr non-vote | Manual | — | ⬜ pending |
| shame_daily | NOTIF-06 | 2 | Daily follow-up shame until voted | Manual | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No test infrastructure to install. `npm run build` is the automated signal. All notification behavior requires manual smoke testing in browser with real Firebase project.

---

## Manual-Only Verifications

| Behavior | Req | Why Manual | Test Instructions |
|----------|-----|------------|-------------------|
| FCM token written | NOTIF-01 | Requires live browser + Firebase | Grant permission, check Firestore Console: `users/{uid}` has `fcmToken` field |
| Push notification received | NOTIF-02–04 | Requires OS + Firebase | Trigger trip state change, confirm OS-level notification appears on device |
| Shame notification 72hr | NOTIF-06 | Time-based, hard to automate | Set `votingStartedAt` to 73hr ago in Firestore, open app, confirm shame fires |
| iOS push works | — | Device required | Install app as PWA on iOS 16.4+, grant permission, confirm push arrives |
| CF Worker auth | NOTIF-07 | External service | POST to Worker URL with test payload, confirm 200 response and FCM delivery |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or are marked Manual-Only
- [ ] `npm run build` is the per-task sampling command
- [ ] Wave 0 is N/A — no new test infrastructure needed
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
