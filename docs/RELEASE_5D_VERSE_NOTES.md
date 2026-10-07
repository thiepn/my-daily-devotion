# Durable editor integration — Verse notes

This slice stacks on Prayer capture, PR #32. It does not complete Batch B or release 1.4.0. Physical schema remains 2, domain contract 1, and ordinary portable backup format/schema 1. No cloud connection, merge or deployment.

## Behavior and compatibility

Verse notes use the shared controller: material writing is kept after 500 ms, with a two-second maximum during continuous typing. Opening a pristine editor, moving its cursor and reading Scripture create no draft. Explicit recovery compares kept writing before forking into an editor-owned ID. Full BSB ranges, reading context and nested return URLs survive recovery, including ranges spanning chapters. A fresh selection creates its own note context.

Explicit saves commit the note and private draft retirement atomically using the actual verseNotes transaction table. The committed note is returned directly; annotation refresh failure does not replay the save. Newer queued typing remains unsaved and durable against the new baseline. Unchanged saved text performs no domain write. Notes create no devotional activity events.

Concurrent changes require comparison. Removed targets retain copyable writing and cannot be recreated by recovery or a stale save. Existing explicit creation of a new note on a previously removed range remains supported. Live matches take precedence over unrelated tombstones; stable ID tie-breakers and the existing startVerseKey index require no migration. Removal checks both ID and revision within its transaction.

Selection changes, closing and navigation use the shared journal dialog. Discard awaits queued writes and retirement before proceeding. Browser unload warnings remain. The editor retains input and offers retry/copy guidance when private persistence fails; one valid explicit domain save remains possible.

## Presentation and evidence

The approved reader, landscape, shell and note dock remain. Recovery status is separate from domain-save status. Selected red-letter text previously fell below 4.5:1 in light and dark themes; dedicated selected-color tokens correct that defect without changing ordinary Scripture colors or inverting artwork.

Tests cover pristine reads, restart recovery, full ranges, original returns, stale edits/deletion, failed private storage, queued input during commitment, atomic retirement and event counts. Candidate images cover six widths, dark, 200% text, long writing, review, navigation confirmation, conflicts, deletion and persistence failures. At enlarged text the dock scrolls naturally; the Save action is reachable without shrinking controls.

Exact-commit certification and hashes belong in the draft PR after completion. One supporting Firefox run timed out at browser launch; it is not counted as an application pass. Physical-phone keyboards/IME, interruption and independent screen-reader/usability review remain human/device gates.

## Remaining work

Prayer wording, updates, encouragement, answers, settings, Focused Prayer answers, collections and People/Categories still need durable integration. Schema-3 saved versions/removal recovery remains gated on the separate specification review. This slice does not promise that every application editor survives termination.
