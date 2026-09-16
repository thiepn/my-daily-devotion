# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional application built around Scripture, personal response, prayer, and remembered spiritual history.

> Read Scripture. Respond when something matters. Pray intentionally. Let MDD remember the story.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**Phase 4 — M’Cheyne & Today**

MDD now has a real daily reading workflow on top of the Phase 3 BSB platform: a vendored 365-day M’Cheyne calendar, calendar and self-paced enrollment, live Today state, explicit completion, read-ahead, neutral missed-reading recovery, existing-progress import, full-plan browsing, and contextual handoff into the real Bible reader.

- Phase 0 contract: [`docs/PHASE_0_IMPLEMENTATION_CONTRACT.md`](docs/PHASE_0_IMPLEMENTATION_CONTRACT.md)
- Phase 1 foundation: [`docs/PHASE_1_LOCAL_FOUNDATION.md`](docs/PHASE_1_LOCAL_FOUNDATION.md)
- Phase 2 visual design: [`docs/PHASE_2_VISUAL_DESIGN.md`](docs/PHASE_2_VISUAL_DESIGN.md)
- Phase 3 Scripture platform: [`docs/PHASE_3_SCRIPTURE_PLATFORM.md`](docs/PHASE_3_SCRIPTURE_PLATFORM.md)
- Phase 4 M’Cheyne & Today: [`docs/PHASE_4_MCHEYNE_TODAY.md`](docs/PHASE_4_MCHEYNE_TODAY.md)

## Local development

```bash
npm install
npm run dev
```

Development/build generates the pinned BSB corpus under `public/bible/` and copies the vendored M’Cheyne artifact to `public/plans/`. Both are generated runtime assets and remain out of git.

## Verification

```bash
npm run verify:phase4
```

The Phase 4 gate re-runs every earlier contract, persistence, visual, Scripture, test, and production-build check, then audits the complete M’Cheyne artifact against the generated BSB corpus and verifies the Today/reader integration.
