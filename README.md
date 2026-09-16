# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional application built around Scripture, personal response, prayer, and remembered spiritual history.

> Read Scripture. Respond when something matters. Pray intentionally. Let MDD remember the story.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**Phase 3 — Scripture Platform**

MDD now contains a real Berean Standard Bible platform: reproducible USJ ingestion, all 66 normalized books in production builds, semantic Scripture rendering, book/chapter navigation, reader-position restoration, verse-range selection, persistent highlights and bookmarks, and copy actions. Phase 1 local-data invariants and the Phase 2 visual system remain intact.

- Phase 0 contract: [`docs/PHASE_0_IMPLEMENTATION_CONTRACT.md`](docs/PHASE_0_IMPLEMENTATION_CONTRACT.md)
- Phase 1 foundation: [`docs/PHASE_1_LOCAL_FOUNDATION.md`](docs/PHASE_1_LOCAL_FOUNDATION.md)
- Phase 2 visual design: [`docs/PHASE_2_VISUAL_DESIGN.md`](docs/PHASE_2_VISUAL_DESIGN.md)
- Phase 3 Scripture platform: [`docs/PHASE_3_SCRIPTURE_PLATFORM.md`](docs/PHASE_3_SCRIPTURE_PLATFORM.md)

## Local development

```bash
npm install
npm run dev
```

The first development/build run generates pinned BSB assets under `public/bible/`; later runs reuse them while the source digest matches.

## Verification

```bash
npm run verify:phase3
```

The Phase 3 gate re-runs every earlier contract, persistence, test, build, and visual-system check, then validates the complete normalized BSB asset set and Scripture-platform wiring.
