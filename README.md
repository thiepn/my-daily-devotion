# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional application built around Scripture, personal response, prayer, and remembered spiritual history.

> Read Scripture. Respond when something matters. Pray intentionally. Let MDD remember the story.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**Phase 7 — Prayer Scheduling, Queue & Focused Session**

MDD now includes the full offline BSB reader, canonical M’Cheyne Today workflow, optional dated reflections and Verse Notes, plus a durable prayer system with People/categories, recurrence, event dates, temporary Focus, deterministic four-band queueing, and resumable persisted prayer sessions. Missed prayer recurrence never creates overdue debt, and there are no streaks, priority scores, XP, or prayer-minute goals.

- Phase 0 contract: [`docs/PHASE_0_IMPLEMENTATION_CONTRACT.md`](docs/PHASE_0_IMPLEMENTATION_CONTRACT.md)
- Phase 1 foundation: [`docs/PHASE_1_LOCAL_FOUNDATION.md`](docs/PHASE_1_LOCAL_FOUNDATION.md)
- Phase 2 visual design: [`docs/PHASE_2_VISUAL_DESIGN.md`](docs/PHASE_2_VISUAL_DESIGN.md)
- Phase 3 Scripture platform: [`docs/PHASE_3_SCRIPTURE_PLATFORM.md`](docs/PHASE_3_SCRIPTURE_PLATFORM.md)
- Phase 4 M’Cheyne & Today: [`docs/PHASE_4_MCHEYNE_TODAY.md`](docs/PHASE_4_MCHEYNE_TODAY.md)
- Phase 5 Reflection & Scripture Capture: [`docs/PHASE_5_REFLECTION_SCRIPTURE_CAPTURE.md`](docs/PHASE_5_REFLECTION_SCRIPTURE_CAPTURE.md)
- Phase 6 Prayer Core: [`docs/PHASE_6_PRAYER_CORE.md`](docs/PHASE_6_PRAYER_CORE.md)
- Phase 7 Prayer Scheduling, Queue & Focused Session: [`docs/PHASE_7_PRAYER_SCHEDULING_QUEUE_SESSION.md`](docs/PHASE_7_PRAYER_SCHEDULING_QUEUE_SESSION.md)

## Local development

```bash
npm install
npm run dev
```

The build generates pinned BSB and M’Cheyne runtime assets from their canonical sources.

## Verification

```bash
npm run verify:phase7
```

The Phase 7 gate re-runs every earlier contract, persistence, build, visual, Scripture, M’Cheyne, reflection and prayer-core check before certifying scheduling, deterministic queueing and durable session behavior.
