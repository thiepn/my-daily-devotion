# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional journal built around **Read → Reflect → Pray → Remember**.

Read Scripture, preserve a reflection, bring it into prayer, and return to meaningful records. Scripture, fonts and artwork are bundled for offline use.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**1.3.0 is the integrated, certified web/PWA candidate on `main`. It is not yet confirmed deployed or published.**

The October 9 integration merged [PRs #41–#44](https://github.com/thiepn/my-daily-devotion/pulls?q=is%3Apr+is%3Amerged), incorporating Morning Grace, durable writing and journal drafts, Saved versions, Recently removed, manual reviews, backup checking and optional Remember features. The pre-consolidation application baseline is commit [`87f4d25`](https://github.com/thiepn/my-daily-devotion/commit/87f4d25f43892dc9c5fbfbcda8c1ed739286e8e8). Its [successful exact-commit certification](https://github.com/thiepn/my-daily-devotion/actions/runs/37896665631) records **344 unit/integration tests, 1,118 browser cases and 526 Windows image comparisons**, with no failures, skips or flaky tests. A certified release artifact was produced.

**Implemented:** the Read → Reflect → Pray → Remember offline loop; BSB Scripture and M’Cheyne reading; search, saved Scripture, Collections, History and selected-period exports; prayer requests and Focused Prayer; durable local editor drafts and Recovery directory; up to twenty previous saved writing versions and reviewed restoration; thirty-day Recently removed restoration; encrypted/plain portable backups with reviewed import; backup checking; opt-in remembering and local backup reminders; responsive Morning Grace layouts and offline PWA behavior.

**Data compatibility:** physical database schema **3**, domain contract **1**, ordinary portable backup format/schema **1**. Standard backups exclude private draft/recovery stores. **Optional recovery-inclusive backup format 2 is not implemented yet**. Cloud accounts, journal sync and native app packages are not part of the shipped offline candidate.

**Delivery distinction:** the newest published GitHub release is **v1.2.5**. Package metadata says **1.3.0**, but a merge or successful CI job is not a live deployment or published version. Deployment uses the manually triggered `Deploy certified release` workflow and an exact successful `main` certification run.

Use the [P0 source and branch baseline](docs/RELEASE_BASELINE_2026-10-09.md), [Codex workflow](docs/CODEX_WORKFLOW.md), [current release checklist](docs/RELEASE_CHECKLIST.md) and [product roadmap](docs/PRODUCT_ROADMAP.md). Older phase and development-branch reports are historical snapshots, not live status statements.

Participant usability, screen-reader rounds, physical-device IME/keyboard checks, long-journal performance measurements and migration-to-schema-3 testing against real existing journals require separate evidence. Changing from the current web origin to `mdd.thiepn.dev` is not a normal redirect: IndexedDB is origin-scoped, and a reviewed transfer flow is required.


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
- Complete product audit and remediation: [`docs/PRODUCT_AUDIT_2026-09-17.md`](docs/PRODUCT_AUDIT_2026-09-17.md)
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

Full local certification runs on Windows because the reviewed image baselines use Windows Chromium. It executes every contract, TypeScript/unit test, a single production build, all browser journeys and image comparisons, then reopens the package and checks its contents and hashes. Linux CI runs the equivalent build, browser shards, Windows image job and evidence-aggregation stages. Missing tests/shards, stale results, retries, failures and altered artifacts fail certification.

## Build a release package

```bash
npm run release:package
```

This writes the deployable web/PWA archive and integrity metadata to `release/`. CI uploads the same directory only after the full release certification passes.

See [the 1.3.0 release notes](docs/RELEASE_1.3.0_MORNING_GRACE.md) and [release operations](docs/RELEASE_CHECKLIST.md) for integration, exact-commit verification and manual deployment. Historical Phase 0–12 documents describe the original implementation sequence; the current product roadmap governs later releases.

## Corrective release evidence

See `docs/CORRECTIVE_RELEASE_1.0.1.md`. CI uploads unit and browser JSON reports plus a commit-linked summary. These are execution evidence, not a claim of physical-device or screen-reader certification.
