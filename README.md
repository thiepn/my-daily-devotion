# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional application built around Scripture, personal response, prayer, and remembered spiritual history.

> Read Scripture. Respond when something matters. Pray intentionally. Let MDD remember the story.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**My Daily Devotion 1.0.0 — Phase 12 Release Hardening**

The planned Phase 0–12 development sequence is complete. Phase 12 converts the Phase 11-validated product into a reproducible, checksummed release candidate without adding another devotional feature system or changing IndexedDB schema version 1.

MDD 1.0 includes the full offline BSB reader and M’Cheyne workflow, reflection and Verse Notes, prayer capture/lifecycle/scheduling/focused sessions, automatic devotional history, grouped local search, Scripture Collections, encrypted/checksum-validated backup and restore, the quiet-editorial phone/tablet/desktop UI, installable offline PWA behavior, and browser validation of the complete **Read → Respond → Pray → Remember** journey.

Release hardening adds a committed npm lockfile, `npm ci` certification, high/critical production-dependency auditing, self-only Content Security Policy, no-referrer policy, generated third-party license notices, runtime-error/deep-link release smoke tests, and a versioned production ZIP with SHA-256 and release manifest.

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
- Phase 12 Release Hardening: [`docs/PHASE_12_RELEASE_HARDENING.md`](docs/PHASE_12_RELEASE_HARDENING.md)
- Privacy & data behavior: [`docs/PRIVACY_AND_DATA.md`](docs/PRIVACY_AND_DATA.md)
- Release checklist: [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)

## Local development

```bash
npm ci
npm run dev
```

The build generates the pinned BSB corpus, local verse-search index, M’Cheyne runtime asset, and third-party notices from canonical/locked sources. Service-worker registration is production-only, so normal Vite development does not cache development assets.

## Final verification

```bash
npm run verify:phase12
```

The Phase 12 gate reruns the complete Phase 0–11 chain, TypeScript and all Vitest tests, production builds, desktop/mobile/offline Playwright validation and release smoke tests, then packages and reopens the final archive to verify version alignment, schema, full BSB/search/M’Cheyne contents, security metadata, license notices, absence of source maps/development residue, and SHA-256 integrity.

## Build a release package

```bash
npm run release:package
```

This writes the deployable web/PWA archive and integrity metadata to `release/`. CI uploads the same directory only after the full release certification passes.

After 1.0, work should proceed through ordinary maintenance, bug-fix, dependency-update, or explicitly scoped feature releases rather than automatic new roadmap phases.
