# Durable local drafts — Release 5 technical specification

Status: approved by the owner on 2026-10-05 with “approve and continue”; implementation proceeds through the ordered slices below. Parent: certified presentation PR #25, branch commit `0b07df1bdcee29ce2be36b16088a3f274520be23`. Approval authorizes implementation, not merging or deployment. Slice 5B introduces the portability boundary while retaining schema v1; recovery and the migration remain later slices.

## Outcome and boundary

Recover unfinished writing after reload or application termination, without treating recovery as a saved reflection, prayer, answer, note, or metadata entry. Domain saves remain explicit. Drafts are device-local, absent from normal backups, search, History, queue eligibility, and the first sync release.

Cover reflection writing, reader verse notes, new prayers, prayer wording, updates, encouragement, answer notes in Detail and Focused Prayer, Prayer Settings, collection creation/renaming/item notes, and People/Category creation/editing. Preserve invalid or incomplete field values so recovery does not erase unfinished work. This release does not implement saved versions, recently removed records, recovery backup payloads, accounts, encryption, sync, or native storage.

The approved specification permits additive database schema **2** in slice 5C, while domain contract **1** and portable format/schema **1** remain separate. Slice 5B leaves the running database at schema v1.

## Current implementation and gaps

This source audit describes the specification baseline. Slice 5B addresses the table-enumeration gaps in backup/portability; the migration and editor/recovery requirements remain unimplemented until their respective slices.

| Source | Current behavior | Integration requirement |
|---|---|---|
| `src/data/schema.ts`, `migrations.ts`, `database.ts` | Only v1 registered; startup records current database metadata | Preserve v1 registration, add atomic v2 stores and migration metadata; handle blocked/old clients |
| `src/data/backup.ts` | Snapshot, validation, and replacement enumerate all tables except `schemaMetadata` | Replace enumeration with an explicit portability allowlist before internal stores exist |
| `src/data/portability.ts` | Prepared merge/replace fingerprint domain snapshot; commit enumerates live tables | Use the same allowlist throughout; do not clear internal drafts during restore |
| `src/writing/useWritingGuard.tsx`, `src/prayer/usePrayerDraftGuard.tsx`, `src/app/useDraftGuard.tsx` | Route/in-page dialogs and unload warnings; no durable storage | Share draft flush/discard/retirement behavior while retaining explicit save guards |
| `src/reflection/ReflectionScreen.tsx` | Frozen date, body baseline, pending Scripture, revision conflicts; newer typing survives saves | Persist full draft/context; retire only the submitted generation and committed attachments |
| `src/scripture/BibleScreen.tsx` | Note body, range and revision in memory; some native confirmations remain | Recover exact translation/range and baseline; replace affected note confirmations with journal dialogs |
| `src/prayer/NewPrayerScreen.tsx` | Memory-only body/details/source; committed creation cached in a ref | Durable committed marker must prevent a crash from replaying creation |
| `src/prayer/PrayerDetailScreen.tsx`, `PrayerSettingsScreen.tsx` | Explicit editors, revision comparisons and status checks | Typed editor adapters; retain unavailable/read-only work as copyable drafts |
| `src/prayer/PrayerSessionScreen.tsx` | Optional inline answer, saved session date/order, committed-answer protection | Recover notes against identified session/item; never start/reconcile/answer from recovery |
| `src/scripture/CollectionsScreen.tsx` | Create/rename/item-note editors with baselines and explicit saves | Restore editor kind and exact record/context, including changed/deleted targets |
| `src/prayer/MetadataJournal.tsx` | Explicit directory editors, conflicts, linked-reference removal protection | Persist name/relationship/notes or category name; preserve deduplication results |

Existing repository APIs, revision checks, event semantics and transaction boundaries are retained through compatible adapters. Existing prayer schedule inputs include string values and hidden conditional fields; a draft must keep the editor values, not prematurely coerce them into domain records.

## Storage model

Proposed three internal stores, all excluded from portable snapshots and sync:

```ts
editorDrafts:
  "&id,kind,targetKey,updatedAt,journalEpoch,[targetKey+updatedAt]"
editorDraftContents:
  "&id"
draftJournalState:
  "&key"
```

`draftJournalState` has one `journal` row containing a random `epoch` and format version. It binds draft context to this journal incarnation. Replacement restore rotates it atomically with domain replacement; merge does not. This is dedicated recovery metadata, not a generic preference. No user/account identifier is introduced.

Each `editorDrafts` row has:

- `id`: random UUID belonging to one editor instance, never the target record's UUID.
- `formatVersion: 1`, a discriminated `kind`, created/updated instants, and original `journalEpoch`.
- `targetKey`: canonical local lookup key (kind + saved ID, reflection date, full verse range, or an independent new-capture UUID). No body text in indexes.
- Typed target/context: optional saved IDs, complete Scripture ranges/translation, frozen devotional date, source IDs and expected revisions, session/item IDs, validated return route and reading locator when applicable.
- A monotonically increasing `generation`, lifecycle state (`active`, `committed`, `discarded`), and expected baseline/dependent revisions, such as prayer/schedule and source reflection. Private payload and baseline text live in a matching `editorDraftContents` row, keyed by this draft ID and generation, never in directory metadata.
- Optional submitted-generation commitment marker: operation UUID, submitted generation, resulting record IDs/revisions, commitment instant and disposition. It contains no copied historical event or encrypted secret.
- Optional recovery lineage `{sourceDraftId, sourceGeneration}` for an explicitly recovered fork.

`editorDraftContents` contains the typed payload and baseline values needed for comparison. Separating it allows indexed directory pagination to read only metadata. Metadata/content updates, fork, retirement and discard always share a transaction; mismatched/missing generations are a recoverable error, not permission to overwrite. Payloads are a typed union, not `Record<string, unknown>` or arbitrary component-state serialization:

| Kind | Recoverable payload |
|---|---|
| `reflection` | `bodyMd`, pending attachment references, explicit dismissal flags, original date and baseline |
| `verse-note` | `bodyMd`, exact reference and expected note ID/revision |
| `prayer-create` | Request, raw `PrayerAdministrationValue`, source/pending references, omissions, initiation date |
| `prayer-wording` | Request body and original prayer revision/status |
| `prayer-update` / `prayer-encouragement` | Body, prayer ID and relevant baseline |
| `prayer-answer` | Optional answer text, parent revision; optional saved session/item identity and date |
| `prayer-settings` | Full raw administration value and prayer/schedule baseline |
| `collection-create` / `collection-rename` / `collection-item-note` | Name or note and exact collection/item baseline |
| `person-create` / `person-edit` | Name, relationship and notes, plus baseline where saved |
| `category-create` / `category-edit` | Name and baseline where saved |

Opening a pristine editor, loading Scripture, browsing Recovery, previewing, or opening a disclosure creates no draft. Allocate/persist only after an actual dirty change or explicit Recover action. A pending attachment presented on entry is retained when writing starts; route inspection alone must not produce a record. If all payload changes return exactly to baseline, remove the uncommitted row through the same serialized writer. A destructive empty edit is still dirty when its baseline was nonempty.

No automatic expiry, destructive size cap, or silent eviction of drafts. Quota failure cannot delete older drafts or domain records. Store no passwords, file bytes, backup candidates, tokens, keys, diagnostic payloads, rendered Scripture HTML, or remote assets. Live IndexedDB draft content has the same unencrypted local-storage limitations as current saved writing.

## Repository and editor contracts

Proposed modules: `src/recovery/types.ts`, `validation.ts`, `repository.ts`, `editor-adapters.ts`, `useDurableDraft.ts`, `RecoveryScreen.tsx`, `context.ts`; one `recovery.css` screen composition using existing journal primitives.

```ts
interface DraftRepository {
  list(query: DraftListQuery): Promise<DraftPage>; // metadata only, no bodies
  read(id: string): Promise<DraftReadResult>;
  persist(input: TypedDraftSnapshot): Promise<DraftPersistResult>;
  forkForRecovery(id: string, generation: number): Promise<DraftForkResult>;
  discard(id: string, expectedGeneration: number): Promise<DraftDiscardResult>;
}
```

All results distinguish missing/unsupported format, stale generation, storage failure, unavailable target, and success. List/read are readonly. `persist` distinguishes first creation from updates with an expected stored generation; an update to a missing/retired ID is rejected, never upserted. Runtime validation occurs on every stored payload before rendering/adoption. Invalid or unsupported records remain present, with a truthful unavailable notice and explicit discard; never silently delete them or trust persisted URLs/Markdown.

`useDurableDraft` reports separate domain and recovery status: `Not saved yet` / `Unsaved changes` / `Saving…` / `Saved locally` versus `Keeping draft…` / `Draft kept on this device` / `Draft could not be kept — keep this page open`. Announce settled failures once with retry/copy actions; do not announce every keystroke. Acknowledgment means the persistence transaction completed, not that the browser guarantees survival against eviction or hardware failure.

Keep dirty/baseline ownership in the editor adapter. The hook never invokes domain save, lifecycle mutation, category seeding, or session reconciliation. Existing read-only refreshes must not overwrite dirty payloads. Optional Scripture/metadata failures leave recovered writing usable.

## Persistence ordering and lifecycle

1. Capture immutable payload/context snapshots on change, including pending settings/attachments. Increment generation for material payload changes; UI expansion/preview/selection alone does not increment it.
2. Debounce normal writes by **500 ms**, with a **2-second maximum** while editing continuously. Serialize writes per draft ID; reject an older generation after a newer one has committed. Coalesce queued snapshots without losing the newest state.
3. Explicit save, controlled navigation, and editor switching flush the latest generation and await settlement. A flush failure retains memory and offers Retry, Keep editing, or explicit continuation acknowledging that the latest draft is not protected. A valid explicit domain save remains possible even when separate draft persistence failed.
4. On `visibilitychange` to hidden, request immediate best-effort flush; keep the controlled path authoritative. Retain unload warnings for dirty changes and in-flight saves. Do not rely on unload/pagehide or async React cleanup to promise storage completion.
5. Starting IME composition does not discard text; the editor snapshots current values and flushes the final composed value on composition end. Never move the caret or focus during draft persistence.
6. Leaving a draft starts no background domain save. “Discard and continue” cancels queued snapshots, then atomically clears private contents and marks the expected generation discarded before resetting memory/proceeding. Retain the compact discarded marker until the writer's pending operations settle; subsequent updates reject its state, and a deleted ID cannot be recreated by an update. If discard fails, stay and offer Retry or Keep editing rather than falsely claiming the draft was discarded.
7. Commit acknowledgments are ignored by stale/unmounted controllers, while the repository operation itself settles consistently. Navigation cancels timers, not already-started transactions; stale queued writes cannot resurrect a discarded/retired draft.

Only text already acknowledged as kept is covered by restart recovery. An abrupt kill during the debounce window may lose the last edits. The interface and help must state this honestly; browser eviction and clearing site data still require independent backups.

## Concurrent tabs and explicit recovery

Each live editor allocates an independent random draft ID. Neither a route key nor `sessionStorage` identifies a writer: tabs can duplicate routes/storage. Do not use timestamps to choose a winning draft or steal a writer's draft after a timeout.

Opening an editor reads matching drafts and presents a recovery offer without replacing loaded or dirty text. One candidate is offered by date; several candidates open a chooser with type, target/date and last-kept time. No private body excerpts appear in global notices or diagnostics.

An explicit Recover action forks the selected generation into a new editor-owned UUID, preserving lineage and baseline. Keep the original until a successful save or explicit discard; a source editor may still be running. A later successful domain save may retire the source only if its generation still matches the adopted generation. Newer source generations and independent siblings remain recoverable. Never purge every draft matching a target.

On reopening, compare current source identities, journal epoch, parent/child tombstones, status and revisions against the draft baseline. If unchanged, offer recovery into the relevant editor. If changed, show **Your draft / Saved version** and require an explicit choice before saving; opening a comparison is readonly. Deleted or now-read-only targets yield copyable writing with no Save-to-deleted action. An unresolved new-record identity (for example a reflection created elsewhere for the same day) must use the current record's explicit conflict path, not create a second reflection.

If a draft targets an old journal epoch after replacement restore, treat it as writing from the previous local journal. Copy is always available. Rebinding to a current record/new capture requires an explicit reviewed action, fresh validation and fresh baseline; do not silently attach old IDs even if they happen to match.

## Explicit save and crash consistency

Draft retirement must be part of the **same IndexedDB transaction** as the explicit domain mutation and existing History events. A “save, then delete draft” sequence is not sufficient: a crash between those actions can offer an already-created prayer/update as a new request.

Use a compatible `saveWithDraft` adapter around existing repositories, with an optional typed draft commit context. Declare the full transaction table closure for each operation, including both draft metadata/content stores and the epoch state; nested repository transactions must join it. Generate operation IDs and prepare payload validation before opening the transaction. No network, Scripture loading, timers or password processing inside the transaction.

The adapter performs:

1. Check journal epoch, current target availability/status, expected revisions, and the submitted draft/operation identity.
2. If that operation already has a committed marker, return its recorded result without rerunning the mutation.
3. Execute the existing domain operation, including all required links and its existing events atomically.
4. Mark the submitted generation committed, recording returned IDs/revisions. If a newer persisted generation exists, retain it and update its target/baseline appropriately. Otherwise remove its private payload and leave a compact committed marker until the editor acknowledges the result.
5. Retire a recovered source only through its expected source generation. Other branches remain untouched.
6. Return `CommittedDraftSaveResult`; subsequent loading errors are Retry refresh, never Retry mutation.

After acknowledgment, delete a marker only when no newer payload needs it, including newer input still queued in memory. Rebase/persist that newer generation before releasing the commitment marker; a failed checkpoint leaves it present and the editor open with copy/retry actions. A restart can resolve a committed marker to the existing record; it must not expose it as unsaved new content. Never store an indefinite ledger of all saves. A newer generation has a new operation ID; reusing an operation ID with different submitted generation/target is an error, not permission to save different content.

Creation outcomes need adapter-specific treatment: a prayer becomes an edit of its returned ID where current lifecycle rules permit; category deduplication adopts the returned existing category; collection creation uses the returned collection. An update/encouragement or answer cannot be replayed to record leftover text again. When no existing safe editor exists, preserve newer text as **copyable unsaved writing** until explicit dismissal or a separately chosen new action. Focused Prayer recovery never marks a session item, answers a prayer, or resumes/rebuilds a queue.

If there is no durable row because persistence failed, a valid explicit save still writes its domain records and a compact operation marker atomically where storage permits. If the entire transaction fails, neither domain mutation nor retirement succeeds. Do not label failed storage as saved. Test first-write failures as well as retirement failures.

Transaction failure retains submitted and newer text. A conflict or deletion retains copyable text and preserves the original base for comparison. Fields may be disabled during commitment; adapters must nevertheless handle newer programmatic/queued input. Never navigate while an unsaved newer generation remains.

## Recovery experience and navigation

Add `/recovery` and `/recovery/:draftId` with a validated `return` parameter. Link Recovery from Your data and show a discreet editor offer when matching drafts exist. No new primary bottom tab or repeated interruption on Today.

The journal list is newest-kept first with stable ID tie-breaker, twenty rows initially and twenty more per activation, accurate visible/total counts, typed labels, original date/target and kept time. Show no content excerpts by default. Load full text only for selected review. Offer Recover/Copy/Discard, with accessible confirmation for discard explaining that ordinary backups do not contain unfinished drafts.

Preserve validated original return context, complete Scripture identity/range, frozen reflection/capture date, selected History entry and session identity. Invalid or obsolete destinations fall back safely to the applicable journal surface. URLs can contain a local draft ID, never the body, baseline content or secrets. Opening the original session from Recovery reads the identified session only; it cannot call start/resume implicitly.

Use warm journal heading, botanical accent, 760px column, readable text, 44px controls, document-flow actions and existing dialogs. Do not autofocus the mobile keyboard. Keep write/preview/formatting/disclosure selection behavior intact. Recovered preview uses the existing safe renderer with no raw HTML or remote images. Distinguish empty Recovery, loading, invalid format, missing draft, target conflict/unavailability and retryable storage failure.

## Migration and portability prerequisites

### Prerequisite implementation slice — still schema v1

Introduce one typed portable-table allowlist shared by snapshot creation, validation, temporary validation databases, merge, preview effects/fingerprint, plain/encrypted export, Markdown `data.json`, replacement commitment and legacy snapshot restore:

`devotionDays`, `reflections`, `highlights`, `bookmarks`, `verseNotes`, `collections`, `collectionItems`, `scriptureLinks`, `planEnrollments`, `readingProgress`, `readerPositions`, `prayers`, `prayerUpdates`, `prayerResolutions`, `prayerSchedules`, `prayerSessions`, `prayerSessionItems`, `people`, `categories`, `activityEvents`, `preferences`.

Exclude `schemaMetadata`, all three recovery stores, and future keys/accounts/devices/outboxes/checkpoints. Use explicit portable schema/contract constants instead of exporting current physical database version. V1 ordinary backups keep the exact table shape, validation/checksums, password rules, encryption and merge behavior; no optional recovery extension until Release 6. Continue rejecting unknown portable tables and unsupported formats clearly.

A draft change must not invalidate an already-reviewed domain restore. A domain change or journal-epoch change must invalidate it. Both merge and replace preserve unfinished drafts. Replacement rotates the epoch in the same transaction and explains that existing drafts are retained from the previous journal and need review. Include epoch in the reviewed local binding, but not exported data or effects counts.

### Proposed additive v2 migration

Register unchanged v1, then v2 with the three new stores. Existing domain table schemas, rows, IDs, revisions and events remain byte-equivalent. Create the singleton journal epoch and update `schemaMetadata` inside the upgrade transaction. Handle fresh installations separately: Dexie upgrade callbacks are not a substitute for initializing the latest schema on first creation. `prepareDatabase` must validate both paths consistently and never rewrite domain data as part of draft initialization.

Add migration tests that abort deliberately and prove v1 remains intact; successful upgrade produces no drafts and no History events. Preserve existing repair behavior with separate assertions so its intentional pre-existing repairs are not misattributed to this migration.

Old open tabs receive database version-change handling: close their connection, preserve unsaved text in memory and offer copy/reload guidance; never force reload or discard. A blocked upgrade displays Retry and guidance to finish/close the other tab. Do not repeatedly auto-open an old-schema connection. An older v1 binary cannot be assumed to reopen a v2 database; catch version errors with a recoverable update-required screen, not deletion/recreation.

Release/update procedure must stop activation while protected writing/commitment is active, retain the working offline shell on failed update, and certify old/new tab interactions. Rollback is a forward-fix or a reviewed portable export/restore procedure, not a blind downgrade. Record the new database schema in release artifacts while keeping portable schema independent.

Source checks that currently assert schema 1 in historical phases must be revised in the **implementation** to assert the reviewed migration registry, unchanged domain contract/portable schema, additive table definitions and compatibility tests. Do not simply remove their compatibility coverage. This specification does not change those gates or schema constants.

## Ordered implementation and release gates

| Change | Deliverable | Must pass before proceeding |
|---|---|---|
| 5A | Reviewed specification + current source map | Owner approval of migration, persistence semantics, recovery UX and portability behavior |
| 5B | Portable allowlist, schema/format separation, no database migration | Historical plain/encrypted/Markdown output/import tests, candidate effects and no-write browsing; schema remains v1 |
| 5C | Additive v2, typed repository, serialized generations and atomic commitment adapters | Fresh/upgrade/abort/blocked/downgrade tests; no domain changes; exact transaction rollback and duplicate-save tests |
| 5D | Reflection, reader notes and prayer capture/detail/settings/session adapters | Recovery and failure/concurrency journeys for each; frozen dates/ranges; no automatic answers, completion or session writes |
| 5E | Collection and metadata adapters + Recovery journal | All editors covered; deduplication/removal and unavailable-source cases; long/private content and return/focus review |
| 5F | Full regression and resilient release certification | Exact-commit functional, visual/accessibility, offline/backup/update and recovery evidence; no silent loss or unsupported downgrade |

Implementation commits remain reviewable on a dedicated branch based on the integrated presentation work. No merge/deploy automatically. If the presentation stack is unmerged, document the dependency. Human usability gates from Release 4 remain outstanding; this spec does not declare them complete.

Required test matrix:

- Persist/reload/recover each payload kind, partial invalid forms, pending attachments, hidden schedule values, original dates across midnight and time-zone changes; IME and cursor preservation.
- Read/browse/list/compare/preview produce zero domain writes; draft writes produce zero new History/completion/prayer/session records. Explicit saves have exact existing event/revision counts.
- Same target in two tabs, copied tab storage, out-of-order writes, route switches, recovered-source changes, stale callbacks and discard/queued-write races. Never overwrite independent branches.
- Kill before draft acknowledgment, after acknowledgment, before domain commit, after commit before acknowledgment, and after acknowledgment before navigation. New prayers, updates, answers and categories must not duplicate.
- Failed draft writes, quota pressure, aborted domain transactions, failed retirement, post-commit refresh failure, newer typing, conflicts, concurrent parent/child deletion and status changes; retain copyable content.
- Old/new-version tabs, blocked upgrade, migration failure, fresh v2 initialization, interrupted service-worker update and cold offline startup. Never delete/reset a database to recover a version error.
- V1 historical plain/encrypted import into v2; v2 ordinary portable-v1 export shape; Markdown excludes drafts; merge/replace keeps drafts; epoch mismatch and changed domain snapshot require review.
- Recovery metadata pagination and bounded body reads using a 10,000-row synthetic draft/archive fixture. Do not introduce full-text draft indexing or expose bodies to global search/logs.
- 320/360/390/430/768/1440px; light/dark, 200% text, long writing, recovered/failed/conflicting/copy-only states; keyboard/focus/screen-reader status, reduced motion, safe areas and software-keyboard layout.
- TypeScript, all domain/integration tests, production build, Chromium/Firefox/WebKit, all existing image comparisons, offline and backup checks on the final implementation commit. Physical-device and human checks reported separately.

## Review decision and limitations

The owner's approval covers: additive schema 2; three internal recovery stores separating directory metadata, private contents and journal epoch; 500 ms/2 s persistence timing; explicit fork recovery and generation-bound retirement; atomic domain-save markers; ordinary portable-v1 exclusion; preserving/reviewing drafts across replacement; and the staged implementation above. No additional migration approval is required for the agreed slices. Material changes to that contract require a revised review.

Until the implementation ships, all unsaved writing remains memory-only. After it ships, acknowledged drafts can still be lost through browser eviction, cleared site data, device loss or storage failure. Drafts are not external backups, secure storage, saved versions, removal recovery or cloud sync.

## Primary technical references

- [Dexie versioning](https://dexie.org/docs/Tutorial/Design#database-versioning) and [upgrade transaction API](https://dexie.org/docs/Version/Version.upgrade%28%29): implementation must preserve old registrations and verify upgrade versus fresh-create paths.
- [MDN IndexedDB versionchange](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/versionchange_event): another tab can request a structural change; handle connection closure and blocked upgrades.
- [MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event): unload events are unreliable, especially on mobile; they are warnings, not the persistence strategy.
- [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria): local recovery needs honest failure states and independent backups.
