# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional application built around Scripture, personal response, prayer, and remembered spiritual history.

> Read Scripture. Respond when something matters. Pray intentionally. Let MDD remember the story.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**Phase 11 — UX Validation**

Phase 11 is implemented and cumulatively certified. MDD now has browser-level validation for the actual devotional journeys built across Phases 0–10 rather than relying only on repository and component tests.

The automated UX matrix covers first-run M’Cheyne setup, Scripture reading and factual completion, the complete **Read → Respond → Pray → Remember** flow, Scripture Search and Collections, desktop and touch/mobile layouts, keyboard navigation and route focus, WCAG A/AA automated checks, 320 px reflow, 200% text resizing, and a controlled cold-start PWA journey with the network fully disabled.

Validation also closed concrete defects found during testing: light-theme secondary-text contrast, accessible date/history controls, SPA route focus, transient false-empty History states, complete offline precaching of lazy route chunks, and Vary-safe Cache Storage matching for offline modules. Phase 11 did not add a new devotional feature system or change the IndexedDB schema.

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
- Phase 11 UX Validation: [`docs/PHASE_11_UX_VALIDATION.md`](docs/PHASE_11_UX_VALIDATION.md)

## Local development

```bash
npm install
npm run dev
```

The build generates pinned BSB, the local verse-search corpus, and M’Cheyne runtime assets from their canonical sources. Service-worker registration is production-only, so normal Vite development does not cache development assets.

## Verification

```bash
npm run verify:phase11
```

The Phase 11 gate reruns every earlier contract, TypeScript verification, the full Vitest suite, production Scripture/M’Cheyne builds, all prior phase gates, and the Playwright browser UX matrix before certifying the finished user journeys, accessibility/reflow behavior, and controlled cold-offline PWA experience.
