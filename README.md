# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional journal built around **Read → Reflect → Pray → Remember**.

Read Scripture, preserve a reflection, bring it into prayer, and return to meaningful records. Scripture, fonts and artwork are bundled for offline use.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**My Daily Devotion 1.3.0 — Morning Grace integration candidate**

The development branch integrates the Morning Grace visual releases for Today, Bible, Prayer, History, Reflection, prayer capture/detail/settings/sessions, People/Categories, and Data & Backup. It is a release candidate, not a claim that this version is already deployed.

The development database uses the approved additive schema 2 recovery foundation; the domain contract and ordinary portable backup format remain version 1. Account-free local use, BSB Scripture, M’Cheyne calendar/self-paced semantics, explicit completion/prayed actions, revisions, tombstones and offline behavior remain supported. Durable device-local drafts now cover Reflection, verse notes, prayer capture/editors/settings, Focused Prayer answers, Collections and People/Categories. Recovery is explicit, and acknowledged draft protection is distinct from saving a devotional record. Ordinary backups omit drafts. Schema-3 saved versions, Recently removed and optional recovery backups remain specification-gated.

History offers manual weekly review, inclusive date ranges, selected-period Markdown and print/Save as PDF previews. Your data includes a non-restoring backup check. Anniversary suggestions and monthly in-app backup reminders require opt-in and remain browser-local. See the [offline integration evidence and remaining gates](docs/OFFLINE_INTEGRATION_STATUS.md). The current 1.3.0 package label is retained on the unmerged stack; roadmap 1.4.0/1.5.0/1.6.0 milestones are not claims of published releases. Final version assignment and release certification follow the reviewed recovery scope.

Search, Collections, Saved Scripture, Reading Plan, and optional first-run introduction now use the journal composition. See [Search & Saved Scripture](docs/RELEASE_2_SEARCH_SAVED.md) and [Reading Plan & first-run experience](docs/RELEASE_3_READING_PLAN.md). Presentation cleanup and dedicated evening artwork are implemented; see [Release 4](docs/RELEASE_4_PRESENTATION.md). Participant usability/screen-reader rounds and physical-device performance remain outstanding. The remaining roadmap is in [PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md). The mockup and approved artwork/icon govern presentation; historical design JSON/CSS does not override them. See [visual authority](docs/VISUAL_AUTHORITY.md).

Certification builds once, checks the same artifact across desktop Chromium/Firefox/WebKit, mobile, offline and Windows image comparisons, then validates complete fresh evidence before packaging. Deployment is a separate manual workflow; a successful push does not publish the app.

The [durable local drafts specification](docs/specs/DURABLE_LOCAL_DRAFTS.md) is owner-approved. Its certified [portability prerequisite](docs/RELEASE_5B_PORTABILITY.md) excludes internal tables from ordinary exports and domain restore. The [recovery foundation](docs/RELEASE_5C_RECOVERY_FOUNDATION.md) adds migration, private storage, serialized generations, atomic commitment primitives and safe upgrade handling. [The first editor integration](docs/RELEASE_5D_REFLECTION.md) connects Reflection. Remaining editor integrations and the Recovery journal are next; [the implementation push](docs/OFFLINE_COMPLETION_PUSH.md) records their dependencies and subsequent work.

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
