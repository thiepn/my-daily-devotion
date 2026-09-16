# Phase 0 — Implementation Contract & Canonical Data

Status: **implemented / frozen for Phase 1**

This document is the authoritative product-and-data contract for My Daily Devotion (MDD) before application code is introduced. Later phases may extend these contracts, but must not silently reinterpret them.

## 1. Product boundary

MDD is a private, local-first Christian devotional application centered on:

1. Scripture reading.
2. Optional personal response.
3. Intentional prayer.
4. Automatically preserved devotional history.

The active devotional loop is **Read → Respond → Pray**. **Remember** is an automatic product output, not a required user task.

MDD is not a social network, content feed, spiritual habit game, general-purpose PKM system, sermon recorder, academic Bible-study suite, or AI devotional generator.

## 2. Phase 0 hard scope

Phase 0 freezes:

- canonical Scripture source and provenance rules;
- canonical 66-book Protestant ordering and identifiers;
- Scripture reference identity rules;
- canonical M’Cheyne source and calendar semantics;
- prayer lifecycle semantics;
- prayer scheduling and deterministic queue precedence;
- devotional/activity history semantics;
- date and timezone semantics;
- identity, revision, and tombstone rules;
- backup/export format contract;
- schema-versioning and migration principles;
- V1 scope boundary and prohibited scope creep.

Phase 0 deliberately does **not** implement UI, IndexedDB/Dexie, search, PWA behavior, sync, cloud accounts, notifications, or Bible rendering. Those start in later phases.

## 3. Canonical Scripture source

### 3.1 Translation

The canonical bundled translation for V1 is the **Berean Standard Bible (BSB)**.

Canonical upstream:

- publisher: Berean Bible;
- official downloads page: `https://berean.bible/downloads.htm`;
- preferred ingestion format: **USJ**;
- accepted fallback ingestion format: **USFM**;
- text licensing status: public domain as stated by Berean Bible from 2023-04-30.

The app must not flatten the source into verse-only text during ingestion. Paragraphs, poetry, headings, superscriptions, verse identity, and other reader-relevant semantic structure must survive normalization whenever represented by the canonical source.

### 3.2 Provenance

Every imported Bible build must record at minimum:

- `translationId` (`BSB`);
- display name;
- source URL;
- upstream edition/release information when available;
- import timestamp;
- source SHA-256 checksum(s);
- parser version;
- normalized-data version.

A Bible build with unknown provenance is invalid for release.

### 3.3 Canonical verse identity

Canonical internal book IDs use standard USFM identifiers from `canonical/scripture/canon.json`.

A verse key is:

`<BOOK>.<chapter>.<verse>`

Examples:

- `GEN.1.1`
- `JHN.3.16`
- `1CO.13.4`

Rules:

- book ID is uppercase canonical USFM ID;
- chapter and verse are positive base-10 integers with no zero-padding;
- verse identity is translation-independent;
- translation identity belongs to the containing Scripture reference/link, not the verse key itself;
- ranges are stored structurally as start/end verse keys, never as presentation strings only.

Presentation labels such as `John 3:16–18` are derived data.

## 4. Canonical M’Cheyne contract

### 4.1 Source

MDD implements Robert Murray M’Cheyne’s classic 365-day calendar with two **Family** readings and two historically named **Secret** readings per calendar day.

Canonical reference metadata is stored in `canonical/mcheyne/source-manifest.json`.

UI may label the historical Secret grouping as **Private readings** while preserving `secret` as the canonical machine identifier and explaining the historical terminology where appropriate.

### 4.2 Calendar behavior

The plan has exactly **365 assignments**.

Calendar mode:

- January 1 maps to assignment 1;
- December 31 maps to assignment 365;
- February 29 has **no canonical assignment**;
- in leap years, March 1 still maps to the historical March 1 assignment;
- the schedule must never shift after February 29.

Self-paced mode:

- Day 1 may begin on any local calendar date;
- advancement is by plan sequence, not by civil-date arithmetic;
- self-paced behavior must not mutate the canonical calendar mapping.

### 4.3 Reading completion

Completion is explicit.

- Opening a reading does not mark it complete.
- Scrolling to the end does not mark it complete.
- Reader position is separate from completion.
- Read-ahead is permitted.
- Missed calendar assignments remain unread; they do not disappear and are not converted into streak debt.
- No streak concept exists in the canonical plan model.

### 4.4 Assignment identity

A canonical assignment has:

- stable sequence `1..365`;
- month/day calendar key;
- four ordered readings;
- reading group for each reading: `family` or `secret`;
- Scripture reference(s) resolved structurally during canonical-data generation.

No assignment is identified by a year-specific date.

## 5. Date and timezone contract

MDD distinguishes human calendar identity from event instants.

### 5.1 Types

- `LocalDate`: `YYYY-MM-DD` calendar date with no timezone.
- `Instant`: UTC ISO-8601 timestamp ending in `Z`.
- `TimeZoneId`: IANA timezone identifier, e.g. `Europe/Berlin`.

### 5.2 Rules

- A devotional day is keyed by `LocalDate`.
- Historical devotional-day keys never shift when the user changes timezone.
- `Today` follows the device’s current local calendar date.
- Prayer recurrence is evaluated against the current local calendar date and timezone.
- Event occurrence history stores a UTC instant plus the relevant timezone when needed for reconstruction.
- The default devotional boundary is civil midnight.
- V1 has no configurable 03:00/04:00 rollover boundary.

Example: a devotion recorded as `2026-09-16` in Germany remains `2026-09-16` after travel to Korea.

## 6. Identity, revisions, and deletion

Persistent user-owned entities use client-generated UUIDs from creation time.

Every mutable sync-relevant entity must be designed to support:

- `id`;
- `createdAt`;
- `updatedAt`;
- `revision` (monotonically increasing integer);
- `deletedAt` tombstone where deletion must survive future sync.

Hard deletion is exceptional. Tombstones are preferred for records that may later participate in synchronization.

Derived indexes and caches do not require tombstones.

## 7. Devotional-day contract

`DevotionDay` is a thin historical grouping record, not a spiritual scorecard.

Canonical fields:

- `id`;
- `localDate`;
- optional `planEnrollmentId`;
- `startedAt`;
- `lastActiveAt`.

There is deliberately **no** `devotionCompleted`, `perfectDay`, `streak`, or equivalent boolean.

The app derives factual state from actual records: readings completed, reflection present, prayer session occurred, etc.

Empty devotional days are not pre-created. A record is created only when meaningful activity exists.

## 8. Reflection contract

V1 supports one primary daily reflection per devotional date.

Reflection is optional and may be one sentence or long-form writing.

The canonical model supports:

- Markdown-compatible plain text;
- one or more structural Scripture links;
- creation/update timestamps;
- source devotional date;
- conversion/linkage to prayer without losing origin context.

Prompts are presentation aids and never required fields.

## 9. Scripture-linked user data

V1 distinguishes:

- **Highlight** — visual emphasis on a Scripture range;
- **Bookmark** — saved location/range;
- **VerseNote** — durable note attached to Scripture;
- **Reflection** — dated devotional response that may link Scripture;
- **CollectionItem** — Scripture range saved into a Scripture-centric collection.

These concepts must not be collapsed into one generic note object.

`ScriptureLink` is the canonical relationship primitive between personal records and Scripture.

Supported initial owners:

- `reflection`;
- `prayer`;
- `prayerUpdate`;
- `verseNote`.

## 10. Prayer lifecycle

Canonical prayer statuses:

- `ACTIVE`
- `WAITING`
- `ANSWERED`
- `ARCHIVED`

Allowed lifecycle transitions:

- `ACTIVE → WAITING`
- `WAITING → ACTIVE`
- `ACTIVE → ANSWERED`
- `WAITING → ANSWERED`
- `ACTIVE → ARCHIVED`
- `WAITING → ARCHIVED`
- `ANSWERED → ARCHIVED`

Restoring an archived prayer is an explicit product action and must restore to a deliberate target state, never by accidental state mutation.

Deletion is separate from lifecycle state.

Semantics:

- `ACTIVE`: eligible for normal prayer selection;
- `WAITING`: retained while awaiting outcome/context; normally omitted from rotation;
- `ANSWERED`: resolved as answered and retained permanently with resolution history;
- `ARCHIVED`: inactive historical record not necessarily answered.

## 11. Prayer structure

A Prayer may contain:

- body (required);
- optional Person;
- optional flat Category;
- optional Scripture link(s);
- optional Schedule;
- optional event date;
- optional temporary Focus-until date;
- origin reflection/devotion references;
- append-only updates;
- optional final answer reflection through PrayerResolution.

V1 has no nested categories and no generic tags.

### 11.1 Updates

Prayer evolution is append-oriented.

`PrayerUpdate.type` is initially:

- `update`
- `encouragement`

The original request is not overwritten merely because circumstances changed.

### 11.2 Answered prayer

Answered state preserves:

- original prayer;
- all updates;
- encouragements;
- linked Scripture;
- origin reflection/devotion;
- answer date;
- optional answer reflection.

No answer is turned into an achievement, score, or trophy.

## 12. Prayer scheduling

Canonical V1 scheduling modes:

- `ROTATION` (default; no fixed recurrence)
- `DAILY`
- `WEEKDAYS`
- `INTERVAL_DAYS`
- `MONTHLY`
- `ON_DATE`
- `MANUAL_ONLY`

Rules:

- recurrence produces eligibility, not debt records;
- missed recurrence days never create overdue duplicates;
- event date is distinct from recurrence;
- Focus is distinct from priority and is temporary;
- there is no Low/Medium/High/Critical prayer priority field.

## 13. Deterministic prayer queue

Queue generation is deterministic for the same input state, local date, timezone, and session state.

Eligibility baseline:

- status is `ACTIVE`;
- not deleted;
- not already surfaced in the current session unless explicitly regenerated with permission to repeat.

Queue precedence:

1. current Focus and imminent/event-date prayers;
2. fixed schedules due today;
3. new prayers never previously prayed;
4. normal rotation sorted by least recently prayed.

Deduplication is required after every precedence band.

Stable tie-break order for normal rotation:

1. `lastPrayedAt` null first;
2. `lastPrayedAt` ascending;
3. `createdAt` ascending;
4. `id` ascending.

Session depth presets are presentation policy, not queue semantics. Current V1 target sizes are approximately Quick 4, Regular 10, Extended 20 and may be tuned by UX validation without changing the queue contract.

### 13.1 Session actions

- **Next**: records the prayer as prayed and updates `lastPrayedAt`, then advances.
- **Skip**: advances without changing `lastPrayedAt`.
- **Answered**: creates the resolution/status transition and removes the prayer from subsequent eligible selection.

A prayer session is not summarized as spiritual productivity such as “10 prayers completed.”

## 14. Meaningful activity history

History records meaningful devotional events, not UI telemetry.

Canonical V1 activity types:

- `READING_COMPLETED`
- `HIGHLIGHT_CREATED`
- `REFLECTION_CREATED`
- `PRAYER_CREATED`
- `PRAYER_PRAYED`
- `PRAYER_UPDATED`
- `ENCOURAGEMENT_RECORDED`
- `PRAYER_ANSWERED`

Do not write activity events for opening screens, changing tabs, scrolling, changing font size, or other UI analytics noise.

Activity history supports automatic day history, Moments, later Scripture backlinks, and future export.

## 15. Backup and data longevity contract

Backup is a V1 release requirement, not an optional convenience.

Canonical container extension: `.mddbackup`.

Logical archive layout:

```text
manifest.json
data.json
attachments/        # may be empty in V1
```

`manifest.json` must include:

- format identifier;
- backup format version;
- app version;
- database/schema version;
- export timestamp;
- checksums for payload files;
- encryption metadata when encrypted.

Import sequence:

1. read archive;
2. validate format/version;
3. verify checksums;
4. decrypt if required;
5. parse into temporary structures;
6. migrate in temporary structures;
7. validate referential integrity;
8. present import summary/preview;
9. commit atomically as far as platform capabilities allow.

A failed import must not damage the current database.

### 15.1 Backup modes

V1 must support:

- portable plain structured export for user ownership;
- encrypted backup for files that may travel outside the device.

Encrypted backup concept:

- password-derived key using a modern KDF available in the chosen platform/runtime;
- authenticated encryption (AES-GCM or equivalent);
- random salt and nonce/IV;
- algorithm and KDF parameters stored in non-secret metadata.

The application must never claim ordinary IndexedDB storage is encrypted or end-to-end encrypted.

## 16. Schema and migration contract

The first persistent application database introduced in Phase 1 starts at explicit schema version `1`.

Rules:

- no unversioned persistent production schema;
- migrations are forward-only and deterministic;
- a migration must never depend on network access;
- migrations must be testable against fixtures representing every previous released schema;
- failed migrations must not discard the last known-good user dataset;
- indexes/search caches are derived and rebuildable;
- canonical Bible content is immutable for a given normalized-data version;
- user data references canonical Scripture identity rather than presentation strings.

## 17. Future sync compatibility without Phase 0 sync

Cloud sync is explicitly **not V1**.

Phase 0 nevertheless reserves compatible semantics:

- UUID IDs from creation;
- revisions;
- tombstones;
- append-only history objects where practical;
- conflict copies for long-form reflection bodies rather than silent destructive overwrite;
- union-by-ID semantics for append-only events/updates;
- local write remains the primary save path in any future sync architecture.

No network account, sync SDK, or backend is introduced in Phase 0.

## 18. V1 scope boundary

### Included by V1

- full offline BSB;
- M’Cheyne calendar and self-paced enrollment;
- explicit reading completion and reader position;
- Scripture search;
- highlights, bookmarks, verse notes, Scripture-centric collections;
- daily reflection and Scripture linkage;
- prayer capture/lifecycle/people/categories/schedules/events/focus;
- deterministic least-recently-prayed queue;
- focused prayer sessions;
- prayer updates, encouragements, answers;
- automatic devotional history;
- grouped global search;
- local-first IndexedDB storage;
- backup/restore, encrypted backup, portable export;
- installable offline PWA;
- accessibility and resilience work.

### Explicitly not V1

- accounts;
- cloud sync;
- server dependency for core use;
- push notification infrastructure;
- native wrapper;
- widgets;
- biometric/keystore integration;
- photos and arbitrary attachments;
- Bible audio;
- multiple translations;
- custom reading-plan creator;
- generic tags;
- custom prayer pools unless later evidence requires them;
- AI-generated prayers/devotionals;
- semantic AI assessment of spirituality;
- social/group prayer;
- feeds;
- streaks, XP, badges, leaderboards, spiritual scores;
- sermon recording/transcription;
- full spaced-repetition memorization system;
- missions/news database.

A later phase may propose scope changes, but it must state the trade-off explicitly rather than silently adding them.

## 19. Phase 0 acceptance gates

Phase 0 is complete only when all of the following are true:

- [x] product semantic boundary documented;
- [x] official BSB source and license status pinned;
- [x] canonical Scripture IDs and verse-key format defined;
- [x] canonical M’Cheyne source and leap-day semantics pinned;
- [x] prayer lifecycle frozen;
- [x] recurrence modes frozen;
- [x] deterministic queue precedence and tie-breaks frozen;
- [x] date/timezone semantics frozen;
- [x] activity-history vocabulary frozen;
- [x] backup/migration contract frozen;
- [x] future-sync compatibility rules frozen without implementing sync;
- [x] V1 scope and non-goals frozen;
- [x] machine-readable contract files committed;
- [x] dependency-free contract verification command committed.

## 20. Change-control rule

From Phase 1 onward, a change to any frozen Phase 0 semantic must include:

1. an explicit contract change;
2. rationale;
3. migration/compatibility impact;
4. affected tests;
5. updated canonical machine-readable contract where applicable.

Implementation code must conform to this contract; the contract must not be silently rewritten to match accidental implementation behavior.
