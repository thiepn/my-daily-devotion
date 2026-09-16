# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional application built around Scripture, personal response, prayer, and remembered spiritual history.

> Read Scripture. Respond when something matters. Pray intentionally. Let MDD remember the story.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**Phase 8 — History, Search & Data Portability**

MDD now includes the full offline BSB reader and M’Cheyne workflow, optional reflection/Verse Notes, the complete prayer scheduling/session engine, automatic Calendar/Day/Moments history, grouped local search across Scripture and personal devotional data, Scripture Collections, checksum-verified and optionally encrypted `.mddbackup` archives, validated merge/replace restore, and human-readable Markdown export. The application remains local-first with no account or cloud dependency.

- Phase 0 contract: [`docs/PHASE_0_IMPLEMENTATION_CONTRACT.md`](docs/PHASE_0_IMPLEMENTATION_CONTRACT.md)
- Phase 1 foundation: [`docs/PHASE_1_LOCAL_FOUNDATION.md`](docs/PHASE_1_LOCAL_FOUNDATION.md)
- Phase 2 visual design: [`docs/PHASE_2_VISUAL_DESIGN.md`](docs/PHASE_2_VISUAL_DESIGN.md)
- Phase 3 Scripture platform: [`docs/PHASE_3_SCRIPTURE_PLATFORM.md`](docs/PHASE_3_SCRIPTURE_PLATFORM.md)
- Phase 4 M’Cheyne & Today: [`docs/PHASE_4_MCHEYNE_TODAY.md`](docs/PHASE_4_MCHEYNE_TODAY.md)
- Phase 5 Reflection & Scripture Capture: [`docs/PHASE_5_REFLECTION_SCRIPTURE_CAPTURE.md`](docs/PHASE_5_REFLECTION_SCRIPTURE_CAPTURE.md)
- Phase 6 Prayer Core: [`docs/PHASE_6_PRAYER_CORE.md`](docs/PHASE_6_PRAYER_CORE.md)
- Phase 7 Prayer Scheduling, Queue & Focused Session: [`docs/PHASE_7_PRAYER_SCHEDULING_QUEUE_SESSION.md`](docs/PHASE_7_PRAYER_SCHEDULING_QUEUE_SESSION.md)
- Phase 8 History, Search & Data Portability: [`docs/PHASE_8_HISTORY_SEARCH_PORTABILITY.md`](docs/PHASE_8_HISTORY_SEARCH_PORTABILITY.md)

## Local development

```bash
npm install
npm run dev
```

The build generates pinned BSB, the local verse-search corpus, and M’Cheyne runtime assets from their canonical sources.

## Verification

```bash
npm run verify:phase8
```

The Phase 8 gate reruns all earlier contracts, persistence tests, Scripture/M’Cheyne builds and visual guardrails before certifying History, search, Scripture Collections and long-term backup/import portability.
