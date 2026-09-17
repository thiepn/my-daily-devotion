# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional application built around Scripture, personal response, prayer, and remembered spiritual history.

> Read Scripture. Respond when something matters. Pray intentionally. Let MDD remember the story.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**Phase 10 — PWA, Accessibility, Performance & Resilience**

MDD now includes the full BSB reader and M’Cheyne workflow, reflection/Verse Notes, the prayer scheduling/session engine, automatic devotional history, grouped local search, Scripture Collections, encrypted/checksum-verified backup and validated restore, the Phase 9 quiet-editorial UI system, plus an installable offline-first platform layer. The production PWA precaches the full BSB corpus, local verse-search index, M’Cheyne plan and built application shell; route features are code-split, theme preference is persisted, storage-persistence status is visible, service-worker updates are user-controlled, and destructive backup recovery is tested.

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
- Phase 10 PWA, Accessibility, Performance & Resilience: [`docs/PHASE_10_PWA_ACCESSIBILITY_PERFORMANCE_RESILIENCE.md`](docs/PHASE_10_PWA_ACCESSIBILITY_PERFORMANCE_RESILIENCE.md)

## Local development

```bash
npm install
npm run dev
```

The build generates pinned BSB, the local verse-search corpus, and M’Cheyne runtime assets from their canonical sources. Service-worker registration is production-only, so normal Vite development does not cache development assets.

## Verification

```bash
npm run verify:phase10
```

The Phase 10 gate reruns every earlier contract, the complete test suite and the production build before checking install metadata, application-icon dimensions, full offline Scripture/search coverage, safe service-worker updates, persistent-storage wiring, accessibility primitives, route code splitting and destructive backup recovery.
