# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional application built around Scripture, personal response, prayer, and remembered spiritual history.

> Read Scripture. Respond when something matters. Pray intentionally. Let MDD remember the story.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**Phase 6 — Prayer Core**

MDD now has the complete offline BSB Scripture platform, canonical M’Cheyne Today workflow, optional dated reflection and Scripture capture, plus a real prayer core: Quick Add, lifecycle states, append-only updates/encouragements, answered-prayer resolution, Scripture/reflection provenance, and basic least-recently-prayed focused prayer. Scheduling, events, people/categories and the durable session engine remain Phase 7.

- Phase 0 contract: [`docs/PHASE_0_IMPLEMENTATION_CONTRACT.md`](docs/PHASE_0_IMPLEMENTATION_CONTRACT.md)
- Phase 1 foundation: [`docs/PHASE_1_LOCAL_FOUNDATION.md`](docs/PHASE_1_LOCAL_FOUNDATION.md)
- Phase 2 visual design: [`docs/PHASE_2_VISUAL_DESIGN.md`](docs/PHASE_2_VISUAL_DESIGN.md)
- Phase 3 Scripture platform: [`docs/PHASE_3_SCRIPTURE_PLATFORM.md`](docs/PHASE_3_SCRIPTURE_PLATFORM.md)
- Phase 4 M’Cheyne & Today: [`docs/PHASE_4_MCHEYNE_TODAY.md`](docs/PHASE_4_MCHEYNE_TODAY.md)
- Phase 5 Reflection & Scripture Capture: [`docs/PHASE_5_REFLECTION_SCRIPTURE_CAPTURE.md`](docs/PHASE_5_REFLECTION_SCRIPTURE_CAPTURE.md)
- Phase 6 Prayer Core: [`docs/PHASE_6_PRAYER_CORE.md`](docs/PHASE_6_PRAYER_CORE.md)

## Local development

```bash
npm install
npm run dev
```

The first run generates pinned BSB and M’Cheyne runtime assets; later runs reuse valid generated assets.

## Verification

```bash
npm run verify:phase6
```

The Phase 6 gate re-runs every earlier contract, persistence, build, visual-system, Scripture, M’Cheyne and reflection check, then certifies Prayer Core behavior.
