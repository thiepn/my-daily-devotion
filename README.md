# My Daily Devotion

My Daily Devotion (MDD) is a private, local-first Christian devotional application built around Scripture, personal response, prayer, and remembered spiritual history.

> Read Scripture. Respond when something matters. Pray intentionally. Let MDD remember the story.

MDD is intentionally not a social network, content feed, habit game, or general-purpose Bible study suite.

## Current status

**Phase 1 — Local Foundation & Data Integrity**

The executable local-first foundation is now in place: React/TypeScript/Vite, Dexie/IndexedDB schema v1, typed domain records, migrations, UUID/revision/tombstone semantics, repositories, meaningful activity history, integrity auditing, checksum-verified backup/restore primitives, routing, automated tests, and CI.

- Phase 0 contract: [`docs/PHASE_0_IMPLEMENTATION_CONTRACT.md`](docs/PHASE_0_IMPLEMENTATION_CONTRACT.md)
- Phase 1 foundation: [`docs/PHASE_1_LOCAL_FOUNDATION.md`](docs/PHASE_1_LOCAL_FOUNDATION.md)

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run verify:phase1
```

The Phase 1 gate re-runs the frozen Phase 0 contract verifier, TypeScript checks, persistence tests, and the production build.
