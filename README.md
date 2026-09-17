# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional application built around Scripture, personal response, prayer, and remembered spiritual history.

> Read Scripture. Respond when something matters. Pray intentionally. Let MDD remember the story.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**Phase 9 — Dedicated UI Refinement**

MDD now includes the full offline BSB reader and M’Cheyne workflow, optional reflection/Verse Notes, the complete prayer scheduling/session engine, automatic Calendar/Day/Moments history, grouped local search, Scripture Collections, encrypted/checksum-verified backup and validated restore, plus a unified final UI refinement layer. The implemented product now shares one quiet-editorial hierarchy for chrome, forms, controls, action groups, empty states and responsive layouts while remaining local-first with no account or cloud dependency.

- Phase 0 contract: [`docs/PHASE_0_IMPLEMENTATION_CONTRACT.md`](docs/PHASE_0_IMPLEMENTATION_CONTRACT.md)
- Phase 1 foundation: [`docs/PHASE_1_LOCAL_FOUNDATION.md`](docs/PHASE_1_LOCAL_FOUNDATION.md)
- Phase 2 visual design: [`docs/PHASE_2_VISUAL_DESIGN.md`](docs/PHASE_2_VISUAL_DESIGN.md)
- Phase 3 Scripture platform: [`docs/PHASE_3_SCRIPTURE_PLATFORM.md`](docs/PHASE_3_SCRIPTURE_PLATFORM.md)
- Phase 4 M’Cheyne & Today: [`docs/PHASE_4_MCHEYNE_TODAY.md`](docs/PHASE_4_MCHEYNE_TODAY.md)
- Phase 5 Reflection & Scripture Capture: [`docs/PHASE_5_REFLECTION_SCRIPTURE_CAPTURE.md`](docs/PHASE_5_REFLECTION_SCRIPTURE_CAPTURE.md)
- Phase 6 Prayer Core: [`docs/PHASE_6_PRAYER_CORE.md`](docs/PHASE_6_PRAYER_CORE.md)
- Phase 7 Prayer Scheduling, Queue & Focused Session: [`docs/PHASE_7_PRAYER_SCHEDULING_QUEUE_SESSION.md`](docs/PHASE_7_PRAYER_SCHEDULING_QUEUE_SESSION.md)
- Phase 8 History, Search & Data Portability: [`docs/PHASE_8_HISTORY_SEARCH_PORTABILITY.md`](docs/PHASE_8_HISTORY_SEARCH_PORTABILITY.md)
- Phase 9 Dedicated UI Refinement: [`docs/PHASE_9_UI_REFINEMENT.md`](docs/PHASE_9_UI_REFINEMENT.md)

## Local development

```bash
npm install
npm run dev
```

The build generates pinned BSB, the local verse-search corpus, and M’Cheyne runtime assets from their canonical sources.

## Verification

```bash
npm run verify:phase9
```

The Phase 9 gate reruns all earlier contracts, persistence tests, Scripture/M’Cheyne builds and feature guardrails before certifying the final cross-screen editorial refinement, product chrome, responsive composition and UI consistency.
