# Durable writing — Collections, People and Categories

This slice completes the editor integrations in Batch B, subject to exact-commit certification and the human/device gates below. It stacks on Focused Prayer draft recovery, PR #35; no constituent change is merged or deployed automatically.

## Behavior

Collection creation, renaming and passage notes, person creation/details, and category creation/names use the existing serialized draft controller: 500 ms debounce and a two-second maximum. Pristine editors and browsing stay write-free. Explicit recovery compares the current saved entry, then forks a private editor-owned ID; changed baselines require review, and removed/previous-journal targets remain copyable.

The original directory search, selected entry, revealed rows, pending full Scripture range and nested return URL are retained in draft context. Person notes stay out of directory summaries and default search. Category suggestions remain an explicit, transactional command.

Explicit saves use dedicated atomic adapters for the actual domain tables and private retirement stores. Normalized unchanged edits do not revise domain records. Creation returns its committed identity, including truthful category/collection deduplication. Newer writing transfers transactionally to a fresh editable draft for that exact identity, never replaying creation. A failed transfer retains copyable protected writing and offers continuation against the saved entry. Newer independent source generations are not retired.

Conflict review does not replace entered text. Using saved details waits for queued draft retirement. Controlled discard waits for the writer; reload/termination recovery is guaranteed only for an acknowledged kept generation, not an in-flight best-effort hidden-page flush.

## Compatibility

Physical schema 2; domain contract 1; ordinary portable backup format/schema 1. No original domain index, UUID, lifecycle permission, prayer relationship, event type, session queue or portability rule changed. Metadata/collection actions create no devotional events. No schema-3 recovery stores or extended backups are implemented here.

## Verification and visual limits

Evidence is recorded on the exact review commit in the draft PR, including units, production build, relevant four-engine journeys, image comparisons and full certification status. Synthetic fixtures use valid UUIDs so strict draft validation is exercised; coverage and image tolerances remain unchanged.

New images cover 320/360/390/430/768/1440 px, dark, 200% text, explicit comparisons and draft-storage failure. Before accepting baselines, inspect the warm paper, typography, botanical ornament, mobile navigation, readable writing and document-flow actions. Recovery disclosures extend page length. Long collection lists naturally scroll; full-page captures include the fixed navigation at its viewport position.

Physical-phone software keyboards/IME, independent screen-reader testing and reader usability sessions remain pending. Passing generated images alone is not visual certification. The complete offline product also still needs owner-reviewed versions/removal recovery, remembering/export improvements and integration certification.
