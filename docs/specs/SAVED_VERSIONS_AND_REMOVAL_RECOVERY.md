# Saved versions, Recently removed and recovery backups

Status: proposed for owner review, 2026-10-07. Batch C of the approved offline completion push explicitly requires this review before dependent implementation. This document authorizes no migration, merge, deployment or cloud service. Complete Batch B editor integration and its certification before shipping this release.

## Contracts and migration

Physical IndexedDB schema becomes **3**. Domain contract and ordinary portable schema remain **1**. Ordinary `.mddbackup` archives remain format **1**. An explicitly selected recovery-inclusive archive uses format **2**, with domain schema **1** and recovery payload version **1**. These numbers have different meanings and must be labeled independently in UI, manifests and tests.

Keep the exact existing v1/v2 Dexie registrations and domain indexes. Add only these internal stores:

```ts
savedVersions: "&id,targetKey,capturedAt,[targetKey+capturedAt],journalEpoch"
savedVersionContents: "&id"
removalGroups: "&id,removedAt,expiresAt,journalEpoch,state"
removalGroupContents: "&id"
```

Metadata contains no writing or person names. Contents are private, typed records with a format discriminant; do not accept arbitrary component state. All four stores are absent from ordinary backups, Search, History, queue calculation and initial synchronization. Draft stores remain unchanged.

The additive upgrade updates schema metadata atomically and creates no retrospective versions or removal groups. Fresh install and v1 → v3 use the same registrations. Blocked clients retain the existing close-connection/write-protection behavior. An aborted upgrade leaves the old schema intact. Unsupported newer schemas remain unavailable rather than being reopened by an older application. Database downgrade is not a rollback procedure.

## Saved versions

Version metadata: random `id`, `formatVersion: 1`, `journalEpoch`, typed `kind`, canonical `targetKey`, `capturedAt`, original record identity/revision and saved writing date where applicable. Private contents contain the prior editable values, not an entire application snapshot.

| Kind | Prior editable values |
|---|---|
| Reflection | `bodyMd` |
| Prayer wording | `body` |
| Verse note | `bodyMd`, with immutable full BSB range in its target context |
| Collection | Name and existing description, where the current API supports changing it |
| Collection item | Existing item note |
| Person | Name, relationship and notes |
| Prayer update/encouragement/answer | Text only if an existing, permitted mutation changes it; no new editing permission |

Record creation produces no previous version. An unchanged normalized save produces no version. Changes solely to prayer lifecycle, schedule, last-prayed time, reader position, metadata ordering or selection produce no writing version.

Within the **same transaction** as a meaningful explicit save: check current revision/status/relationships; store prior editable values; commit the domain mutation and its existing events; retire the exact saved draft generation; retain the newest twenty previous versions for that target. Order by capture instant with stable ID tie-breaker. Failure at any step rolls everything back. Never snapshot on draft checkpoints, browsing, conflict comparison or remote refresh.

Version restoration is an explicit command with expected current revision and selected version identity. Display Your current writing / Selected saved version first. Restore only allowed fields through the same validated mutation path, capture the replaced current writing as a version, and increment the current revision once. Preserve IDs, creation dates, reflection local date, Scripture identity, parent relationships and original activity events. This command cannot create a missing record, attach absent sources, bypass answered/archived restrictions, or create a duplicate reflection/prayer activity event. Read-only or removed targets offer copying and, where eligible, the distinct removal-recovery flow.

After restore, return the committed record directly. A later read failure offers Retry refresh; it must not replay restoration. Revision conflicts retain both comparisons and require renewed explicit review. Version pruning deletes only internal recovery rows, never domain tombstones; it is not secure erasure and does not change older backups.

## Recently removed

Support records already removable by the user: reflections with links, prayers with the children actually removed by that command, verse notes, highlights, bookmarks, collections/items, people and categories. Do not add removability to schedules, sessions, completions, History or other unsupported records.

Removal metadata: random group ID, format version, original journal epoch, removal instant, `expiresAt = removedAt + 30 × 24 hours`, `state: available | restored | expired`, root kind/ID, and affected IDs with exact **pre-removal and post-removal revisions**. Contents retain the original typed records and relationship context. No activity events are members of a removal group.

Capture the group within the same transaction that performs the existing removal, its actual child tombstones and draft retirement. Record only children changed by that operation; children deleted earlier never join the group. Inspect the current repository's cascade rather than assuming all linked children were removed. Preserve existing event behavior; no new removal/restoration event type is introduced.

Restoration checks the group is available, belongs to the reviewed current journal and is unexpired. Every affected record must still be its exact post-removal tombstone revision. Validate references, unique daily reflection/range constraints, collection parents, and person/category reference restrictions in the transaction. A later edit, new assignment, replacement restore or incompatible live record causes a distinguishable conflict. Never overwrite or silently deduplicate such a record.

Restore original IDs, creation dates and stored devotional dates. Clear only this operation's deletion markers; increment each restored current revision once. Restore only its recorded children and valid relationships. Do not restore, rewrite or duplicate activity events. A prayer restoration retains the original saved lifecycle and schedule; it does not rebuild session queues or mark anything prayed. People/category restoration preserves current flat ordering and duplicate-name rules.

Mark the group restored atomically; repeated requests cannot restore twice. Expiration is based on the original absolute removal instant, not import time, time zone or clock-adjusted devotional date. Browsing merely displays expired eligibility and writes nothing. Explicit maintenance may retire expired private recovery payloads, but never physically compacts domain tombstones. An expired backup cannot renew the thirty-day window. If the device clock is unreliable, explain eligibility uncertainty rather than rewriting original dates.

## Recovery UI and command results

Extend `/recovery` with Drafts / Saved versions / Recently removed views; keep twenty-row paging and metadata-only directories. Expose contextual links from supported record editors. Reveal private contents only for selected comparison/copying. Show removed unavailable parents and changed baseline relationships plainly, without dead source links.

Typed commands return `committed` with actual record results, `unchanged`, `conflict` with comparison information, `unavailable`, `expired` or `failed`. Distinguish failed commitment from failed refresh. Use shared journal dialogs, submission locks, accessible focus restoration, warm dark surfaces and ordinary return context. Restore actions require explicit confirmation. Copying and comparison are read-only.

## Portability allowlists and archive formats

The existing 21-table domain allowlist remains the only source of ordinary portable data. Do not return to exporting `database.tables`. Required domain tombstones remain present even when optional recovery content is omitted.

| Archive | Default | Included |
|---|---|---|
| Ordinary format 1 | Yes | Existing validated domain payload/schema 1, including tombstones |
| Recovery-inclusive format 2 | Explicit opt-in | Same domain payload plus a bounded, checksummed recovery manifest and typed draft/version/removal contents |

Keep the existing encryption algorithms, password requirements, bounded archive inspection, checksum validation and archive size limits. Format 2 has the same encryption envelope mechanism; it introduces no weaker crypto, password-derived journal key or remote runtime dependency. File inspection remains provisional until full validation. Unsupported archive/recovery versions fail clearly before a live write.

The recovery manifest declares payload version and separate counts for active drafts, copy-only writing, prior versions and eligible/expired removal groups. Review live records, ordinary deletion markers and optional recovery content separately. A recovery-inclusive file can expose unfinished private writing when unencrypted; explain this beside its opt-in, not only in Advanced.

Export only coherent metadata/content generations using readonly transactions. Include only needed commitment/lineage information for preventing already-recorded action replay. Exclude discarded empty draft markers and credentials, passwords, key material, accounts/devices, outboxes/cursors, server versions, browser receipts and diagnostics.

Validate recovery payload sizes, exact discriminated shapes, UUIDs, revisions, supported routes/dates/ranges, journal epochs, metadata/content correspondence and parent relationships. A recovery snapshot does not receive permission to mutate a domain record. Optional content corruption rejects the explicitly requested extended archive; do not silently import a partially validated backup. Temporary validation databases are always cleaned up.

## Reviewed import and journal boundaries

Keep one candidate implementation for preview and atomic commitment. Its fingerprint binds archive bytes/hash, mode, local domain state, and any recovery state it proposes changing. Inputs or concurrent writes invalidate review. Local private draft generations not included in a proposed change cannot be erased as a side effect.

Merge keeps existing domain rules: missing IDs added, higher revisions replace, equal revisions retain local records and show differing values. Replace shows local-only removal effects and the existing backup/explicit-skip safeguard. Domain commitment creates no new History events.

Preserve local drafts in both modes; replacement rotates the journal epoch as in schema 2. Local versions/removal groups associated with the former epoch remain separately reviewable and copyable, never silently applied to the replacement journal. Do not clear their contents because a portable-v1 file omits recovery data.

Imported drafts receive independent import identities while preserving original generation, context and replay disposition. Treat them as imported/previous-journal writing initially. They do not attach themselves to restored records. An explicit rebind/fork command must compare the current target, status and dependencies before creating a current-journal editor-owned draft. Never recover an already-recorded answer/update as a new action.

Imported versions and removal groups preserve source IDs/dates for comparison and retain a separate source-journal identity. Identical recovery entries deduplicate by source identity and content digest; incompatible collisions remain separate reviewable imports. Merely importing them must not make a removed group eligible against unrelated local records. Rebinding a removal group requires explicit review and exact agreement with its recorded tombstone revisions/relationships; expiry is never extended.

Ordinary v1 historical plain/encrypted backups continue to import into schema 3. Format 2 must be rejected clearly by clients that support only format 1. Portable-v1 exporting remains available after upgrade. Printable/selected Markdown exports are separate products and omit recovery content by default.

## Ordered implementation and release gates

1. Review this specification and bounded API/storage contracts. Complete durable-editor coverage first.
2. Add migration/stores, typed validation and readonly repositories; certify fresh/v1/v2 upgrades, blocked tabs, aborts and unsupported clients.
3. Integrate version capture with actual repository transactions and atomic draft-save adapters. Prove unchanged saves and browsing produce no versions; cap twenty with stable ordering.
4. Add grouped removal/restore against exact revisions; test cascades, prior child deletion, assignment races, expiry/leap-day/time-zone behavior and idempotency.
5. Add comparison/restoration presentation at six widths, dark/200% text, keyboard/focus, long writing, errors and conflicts.
6. Add opt-in format 2 export/validation/reviewed import with legacy format-1 fixtures. Exercise corruption/oversize/version rejection, concurrent review invalidation, rollback and interrupted post-commit refresh.
7. Certify the exact release commit and single production artifact; use 1.5.0 only after all gates pass. Do not merge or deploy automatically.

Database snapshots must prove every recovery browse/read/compare action leaves domain and recovery records unchanged. Mutation tests assert exact revisions/events, relationships, IDs/dates and rollback. Include representative 10,000-record archives and quota failures. Human visual, screen-reader and physical-device checks remain explicit release gates. This review does not certify future synchronization or establish a deletion-compaction protocol.
