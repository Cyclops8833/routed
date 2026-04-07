# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — Core App

**Shipped:** 2026-04-08  
**Phases:** 7 | **Plans:** 13 | **Timeline:** 16 days (2026-03-23 → 2026-04-08)

### What Was Built

- Full-bleed Mapbox map with 70 destination dots, 3D terrain, tilt, Topo/Sat style pill, compact attribution icon
- Complete trip lifecycle: proposed → voting → confirmed → active → completed — with crew voting, cost engine, per-person breakdown
- 70 curated destination photos (Unsplash CDN), displayed in popups and DestinationCard banners
- Live petrol prices via fuelprice.io API with 24hr Firestore cache and override toggle
- CrewContext eliminating 7 duplicate Firestore reads; Firebase Storage avatars replacing base64 blobs
- React error boundary with branded recovery screen; Firestore security rules; popup event bridge cleanup

### What Worked

- **Assumptions mode for context gathering** — skipping the interview-style questioning and leading with codebase evidence reduced back-and-forth significantly. Field name corrections (creatorUid vs createdBy) discovered during research saved execution-time bugs.
- **Wave-based parallel execution** — Plans with no file overlap ran in parallel worktrees. Phase 5 (4 plans) and Phase 6 (2 plans) both benefited from this.
- **Phase insertion (04.1)** — Decimal phase numbering let us insert an urgent fix mid-milestone without renumbering. Clean and unambiguous.
- **Incremental drive cache** — The mid-build save pattern (D-13 to D-15 in Phase 5 context) closed a latent bug where partial caches were accepted as valid. Discovered during planning, not after shipping.

### What Was Inefficient

- **Phase 2 was executed without formal GSD plans** — bugs were fixed directly, leaving 0 PLAN.md files but 2 SUMMARY.md files. The phase is functionally complete but anomalous in the index (`disk_status: partial`). Future hotfixes should still use `/gsd-fast` or a minimal plan to keep the index clean.
- **Worktree merge corruption in Phase 5** — Two commits were needed to restore Phase 5 changes after a worktree merge went wrong (`fix(05): restore all phase 05 changes after worktree merge corruption`). Windows worktree behavior can produce branches based on main instead of HEAD — the branch check step in executor prompts mitigates this but didn't catch it fully.
- **SUMMARY.md one-liner extraction was patchy** — Several summaries didn't populate the one-liner field in a format the extraction tool could parse, leading to garbage in MILESTONES.md that needed manual cleanup.
- **No PROJECT.md or REQUIREMENTS.md at milestone start** — Project was bootstrapped directly into phases without `/gsd-new-project`. This meant the complete-milestone workflow had nothing to evolve. Created PROJECT.md retroactively at v1.0 completion.

### Patterns Established

- **Field name verification during research** — Always grep for exact Firestore field names before writing security rules or queries. `creatorUid` and `memberUid` were the real names; CONTEXT.md had wrong ones.
- **`popup.on('open')` + `querySelector` for popup buttons** — Clean pattern for attaching React callbacks to Mapbox popup HTML without window globals.
- **Lazy self-healing migration** — For data format changes (base64→Storage), detect legacy value on profile load and migrate in-place. No admin script needed at 7-user scale.
- **CrewContext pattern** — Single `onSnapshot` subscription at app root, exposed via `useCrewContext()` hook. Template: `NotificationContext.tsx`.

### Key Lessons

1. **Bootstrap with `/gsd-new-project` next time** — Having PROJECT.md and REQUIREMENTS.md from day one makes milestone completion much smoother and keeps requirement traceability clean throughout.
2. **Use `/gsd-fast` for hotfixes** — Even tiny bug fixes benefit from a thin plan so the phase index stays consistent.
3. **Verify codebase field names in research, not planning** — Let the researcher grep and correct assumptions. By the time the planner runs, field names should be locked and correct.
4. **Document UAT items as todos immediately after verification** — Don't leave human-needed verification items only in VERIFICATION.md files; surface them as actionable todos so they don't get lost between sessions.

### Cost Observations

- Model mix: Opus 4.6 for planning, Sonnet 4.6 for research/execution/verification
- Parallel wave execution saved significant wall-clock time on Phases 5 and 6
- Context window at 200k — cross-phase CONTEXT.md enrichment was not active (requires 500k+)

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 7 |
| Plans | 13 |
| Timeline | 16 days |
| LOC (TypeScript) | ~13,900 |
| Worktree issues | 1 (Phase 5 merge corruption) |
| Hotfixes outside GSD | 1 (Phase 2 direct) |
