# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional application built around Scripture, personal response, prayer, and remembered spiritual history.

> Read Scripture. Respond when something matters. Pray intentionally. Let MDD remember the story.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**Phase 2 — Dedicated Visual Design**

The project now has a canonical visual system: quiet editorial reading-journal direction, authored light/dark themes, desktop rail + mobile bottom navigation, Scripture-reader typography, prayer/history visual motifs, reusable CSS design tokens, and a restrained brand mark. Phase 2 changes presentation only; Phase 1 local data behavior remains intact.

- Phase 0 contract: [`docs/PHASE_0_IMPLEMENTATION_CONTRACT.md`](docs/PHASE_0_IMPLEMENTATION_CONTRACT.md)
- Phase 1 foundation: [`docs/PHASE_1_LOCAL_FOUNDATION.md`](docs/PHASE_1_LOCAL_FOUNDATION.md)
- Phase 2 visual design: [`docs/PHASE_2_VISUAL_DESIGN.md`](docs/PHASE_2_VISUAL_DESIGN.md)

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run verify:phase2
```

The Phase 2 gate re-runs all Phase 0 and Phase 1 checks, then validates the visual-system contract and design guardrails.
