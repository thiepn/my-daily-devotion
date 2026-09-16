# Phase 8 — History, Search & Data Portability

Status: **implemented**

Phase 8 makes MDD's long-term memory usable and portable without adding accounts, cloud sync or another storage system.

## History

History is an automatic output of the existing meaningful activity log and source records. Users never manually construct a devotional history entry.

The primary History views are:

- **Calendar** — days show neutral Scripture / Reflection / Prayer / Answer markers. Empty days are simply empty, never red or failed.
- **Day** — resolves the original activity events back to reflections, prayers, answers, highlights and reading-plan activity.
- **Moments** — shows higher-value reflection, Scripture and prayer developments rather than every administrative action.

`PRAYER_PRAYED` activity is summarized rather than turned into a productivity feed. There are no streaks, scores or spiritual-growth analytics.

## Search

Search remains local and grouped by domain.

### Bible search

The pinned BSB build now generates a static verse-level search corpus alongside the 66 normalized book assets. It is fetched only when search is used and is not included in the initial application JavaScript.

Supported V1 behavior:

- words and multiword queries;
- exact quoted phrases;
- reference lookup such as `John 3:16`;
- optional book filter;
- optional Old/New Testament filter.

The result order is deterministic. MDD does not combine Scripture and personal records into one opaque ranking score.

### Personal search

Personal search groups results into:

- Prayers, including updates and answer reflections;
- Reflections;
- People;
- Saved Scripture, including Verse Notes and Scripture Collections.

All queries run against local IndexedDB data. Tombstoned records are excluded from normal search results.

## Scripture Collections

Collections remain Scripture-centric. A Collection contains structural Scripture ranges plus an optional short note; it is not a Notion-like mixed-object database.

The Bible reader's **More** menu can send the selected structural range to Collections. Collection items retain verse identities rather than copied Scripture text.

## `.mddbackup`

The production backup format is a ZIP-compatible `.mddbackup` archive containing at minimum:

- `manifest.json`
- `data.json`

The manifest records the format version, app/schema version, export time, per-file byte counts and SHA-256 checksums.

Import rejects malformed manifests, unsafe archive paths, duplicate file declarations, missing or undeclared payload files, checksum/length mismatches, newer unsupported schema versions, and unsupported encryption parameters before the live database can be modified.

### Optional encryption

Sensitive backups may be password encrypted locally using:

- PBKDF2-HMAC-SHA-256 key derivation;
- random salt;
- 310,000 iterations;
- AES-256-GCM authenticated encryption;
- random 96-bit IV.

MDD never stores the backup password and cannot recover a forgotten password.

## Safe import

Import is deliberately multi-stage:

1. open archive;
2. validate manifest and declared payload files;
3. validate byte counts and checksums;
4. decrypt if necessary;
5. validate snapshot structure and checksum;
6. restore into a temporary IndexedDB database;
7. run relational integrity checks;
8. only then modify the live database.

A failed preview/import leaves current data untouched.

Two explicit import modes exist:

- **Merge** — union records by stable ID/key and accept an incoming matching record only when its revision (or timestamp for non-revisioned data) is newer.
- **Replace** — replace current MDD data only after the complete candidate has passed temporary-database validation.

Merge is the default. Replace is intentionally more destructive and must be chosen explicitly.

## Human-readable archive

MDD can also export a normal ZIP containing Markdown and `data.json`:

- dated reflection files;
- Active / Waiting / Answered / Archived prayer documents with update history;
- Scripture highlights;
- Verse Notes;
- complete machine-readable data.

This is a longevity feature: the user's devotional history must remain useful even if MDD itself is no longer available years later.

## Integrity

The import integrity audit validates relationships including:

- Reflection → DevotionDay;
- answered Prayer → PrayerResolution;
- Prayer → Person / Category / Schedule / source Reflection;
- ScriptureLink → owner;
- CollectionItem → Collection;
- ReadingProgress → PlanEnrollment;
- PrayerSessionItem → PrayerSession.

## Storage and scope

No database migration is required. Phase 8 uses the schema-v1 stores already established in Phase 1.

Still deliberately absent:

- user accounts;
- cloud sync;
- shared/public history;
- search analytics;
- AI semantic interpretation;
- server-side search;
- background upload of backups.

## Verification

`npm run verify:phase8` reruns every previous phase gate and then certifies History routes, the generated BSB search corpus, grouped personal search, Scripture Collections, the portability UI, encryption/import architecture and Phase 8 visual integration.

Automated tests now exercise:

- automatic History derivation and Moments filtering;
- Scripture Collection identity and tombstones;
- Bible reference, phrase, multiword and filtered search with deterministic ordering;
- grouped personal search across prayers, updates, answers, reflections, people, Verse Notes and Collections, including tombstone exclusion;
- plain and encrypted backup round-trips;
- explicit replace semantics;
- both directions of revision-based merge conflict handling plus incoming tombstones;
- checksum tamper rejection;
- rejection of undeclared payloads and unsafe KDF parameters;
- checksum-valid but relationally invalid candidate rejection before live mutation;
- newer-schema rejection without changing live data;
- human-readable Markdown archival output.

Superseded CI runs are cancelled per branch so certification always targets the newest commit rather than consuming runners on obsolete snapshots.
