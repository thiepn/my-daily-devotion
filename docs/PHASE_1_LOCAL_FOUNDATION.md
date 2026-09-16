# Phase 1 — Local Foundation & Data Integrity

Status: **implemented**

Phase 1 turns the frozen Phase 0 contract into executable application infrastructure. It deliberately does not attempt final visual design, Bible ingestion/rendering, M’Cheyne UI, prayer queue scheduling, search, PWA caching, cloud sync, or native features.

## 1. Foundation

The app now uses React + TypeScript + Vite, Dexie over IndexedDB, hash routing for static-host compatibility, and Vitest with fake-indexeddb for deterministic persistence tests.

## 2. Database schema v1

`MddDatabase` declares durable stores for devotional days, reflections, Scripture-linked records, reading progress and reader position, prayers and prayer history, people/categories, activity history, preferences, and schema metadata.

Mutable user records begin with UUID identity, timestamps, revision `1`, and a tombstone field. Schema registration lives in an explicit migration registry so later versions add migrations rather than rewriting v1 semantics.

Startup records both database schema and Phase 0 domain-contract versions and refuses incompatible/newer data instead of silently opening it.

## 3. Repository invariants

The shared mutable repository enforces UUID creation, monotonic revisions, soft deletion, and deleted-record filtering. Specialized repositories enforce one primary reflection per local date, thin DevotionDay creation, prayer-body validation, Phase 0 prayer lifecycle transitions, and atomic answered-prayer resolution creation.

## 4. Integrity and history

`ActivityLog` provides the append-only meaningful-event foundation. `auditDatabase()` detects duplicate daily reflections, orphan reflections, prayer-resolution mismatches, answered prayers without resolution records, and orphan Scripture links.

## 5. Backup prototype

The data-level backup layer exports every user-data table except internal schema metadata, canonicalizes the payload, computes a SHA-256 checksum, validates the full expected table set before restore, and replaces data inside one IndexedDB transaction. Invalid or tampered input is rejected before the target database is changed.

Archive packaging, password encryption, Markdown export, and advanced import migration remain scheduled for the later portability phase.

## 6. Application shell

A minimal Today / Bible / Prayer / History shell exists only to prove startup and routing. It is intentionally not the visual design; Phase 2 owns the visual system.

## 7. Verification gate

`npm run verify:phase1` runs, in order:

1. the Phase 0 canonical-contract verifier;
2. TypeScript type checking;
3. persistence/invariant tests;
4. a production Vite build.

GitHub Actions runs the same gate on pushes and pull requests.

## 8. Completion criteria

Phase 1 is complete when schema v1 opens, metadata is stable, UUID/revision/tombstone behavior is tested, the daily-reflection invariant is tested, answered prayer is atomic, backup round-trip and tamper preservation pass, the integrity audit passes on valid data, Phase 0 still verifies, and the production build succeeds.
