# Durable editor integration — Reflection slice

Based on PR #28, foundation commit `fdda87ef922b081411ecff58583a94535cc92d44`. This is the first bounded 5D change, not completion of all draft editors. No merge/deployment. Physical schema 2, original domain/ordinary portable format 1.

## Implemented

- Editor-owned serialized controller with 500 ms debounce/2 s maximum, material-generation snapshots, navigation flush, explicit fork recovery, expected-generation discard, storage retry and independent recovery status. Pristine tools/preview never create records; hidden-page flushing remains best-effort.
- Reflection drafts preserve original date, writing baseline, pending BSB ranges and return/reading context. Loaded saved text remains unchanged until explicit recovery. Changed sources require comparison; removed sources cannot be silently recreated. Previous-journal/copy-only writing remains readable for copying.
- Explicit save and pending links use the foundation's atomic commitment adapter, returning the committed reflection/links directly. Newer queued input keeps its saved baseline and prevents handoff. Successful domain saves are distinguished from recovery acknowledgments; compact markers remain while the editor can receive input and are acknowledged after its closing barrier.
- Async navigation discard awaits retirement; failed discard stays on screen. Reflection removal and this editor's draft retirement share a transaction, so failed removal retains both.
- Warm recovery notices and labeled literary comparison fields reuse existing journal primitives. Field protection, cursor/IME behavior, status announcements and enlarged-text reflow are covered. Ordinary backups omit drafts; this is not termination-proof storage or an external backup.

## Verification

Controller tests cover timing, independent editors, private-only writes, serialization, retry identity, explicit save after first-checkpoint failure, duplicate submission, newer typing, recovery lineage and removal rollback. Browser journeys add reload/explicit recovery, pristine zero-write review and failed checkpoint followed by explicit save to existing writing journeys. Fixtures now use real UUID-shaped reflection identities; domain snapshots exclude only the three internal recovery stores while full snapshots still prove pristine browsing unchanged.

Eleven new image cases cover six widths, kept/failure, dark and 200% text. Existing Reflection baselines change only for truthful recovery/help presentation; other screens retain their comparisons. Manual review corrected initially cramped inline comparison fields rather than accepting those images. Exact-commit counts and final artifact status belong in the draft PR; human screen-reader and physical-phone interruption checks remain outstanding.

## Next

Extend the same controller to reader notes and each prayer editor with operation-specific adapters, then collection/metadata editors and the Recovery directory. Other editors still keep unsaved text in memory. No version history, Recently removed, backup extension, accounts, sync or native services are introduced here.
