# Phase 6 — Prayer Core

Status: **implemented**

Phase 6 replaces the static prayer prototype with a real local-first prayer domain while deliberately stopping before Phase 7 scheduling complexity.

## Quick Add

A prayer requires only its body. `/prayer/new` works standalone, from a Reflection handoff, or from a structural Scripture selection. Reflection-origin prayers retain `sourceReflectionId` and `sourceDevotionDate`; linked Scripture is copied as structural `ScriptureLink` relationships, not duplicated verse text.

People, categories, recurrence, event dates and focus weighting remain outside this phase.

## Lifecycle

The frozen lifecycle remains `ACTIVE ↔ WAITING`, `ACTIVE/WAITING → ANSWERED`, and `ACTIVE/WAITING/ANSWERED → ARCHIVED`. Answering always creates a `PrayerResolution`; the app never represents an answered prayer with a status flag alone.

Prayer wording can be edited while the request is active or waiting. Remove is rare and uses tombstones for the prayer and active child records rather than erasing meaningful activity history.

## Updates & encouragements

Updates are append-only `PrayerUpdate` records. `update` records changing circumstances; `encouragement` records meaningful positive movement without pretending the request is answered. The original request is preserved.

Meaningful history events are emitted only for creation, prayed activity, updates, encouragements and answers. Administrative wording/status changes do not create history noise.

## Basic rotation

Phase 6 implements the simple implicit rotation promised by the product contract: active prayers with `lastPrayedAt = null` first, then least-recently-prayed ascending, then creation time and stable ID. Waiting, answered, archived and deleted prayers are excluded.

Quick, Regular and Extended focused modes surface up to 4, 10 and 20 prayers respectively. These are depth labels, not time promises. **Next** records the request as prayed; **Skip** does not change `lastPrayedAt`. A minimal Answered action is available inside the session.

The durable `PrayerSession` / deterministic scheduling engine, recurrence, event weighting and Focus bands remain Phase 7.

## Source context

- Scripture → Prayer carries the selected structural range.
- Reflection → Prayer carries the reflection ID/date and all active Scripture links.
- Prayer detail links back to its source reflection and Scripture.

## Storage

No database migration is required. Phase 6 activates the existing schema-v1 `prayers`, `prayerUpdates`, `prayerResolutions` and `scriptureLinks` stores.

## Verification

`npm run verify:phase6` re-runs every prior phase gate and adds Prayer Core repository/UI checks. Repository tests cover creation provenance, append-only updates, encouragements, least-recently-prayed ordering, Next/prayed semantics, atomic answering, tombstones and preservation of activity history.
