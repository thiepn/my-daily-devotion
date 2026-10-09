# Batch C3 — Recently removed

This change is stacked on PR #43, `codex/offline-version-review`, whose source head `6ca2a754a51777b847695036ad5d909a88ae882a` passed hosted run 37800764575: 334 unit tests, 1,098 browser cases and 514 image comparisons across eight browser shards. The downloaded package and all 175 deployment-file hashes were independently checked. That is evidence for the base, not certification of this change.

## Behavior and compatibility

Existing removal commands now capture the original parent and only the children they actually tombstone, within the same transaction. Supported roots are reflections, prayers, verse notes, highlights, bookmarks, collections, collection items, people and categories. A failed recovery-store write rolls the entire removal back. Removing metadata still rejects references from nondeleted prayers in every status. Existing prayer cascades, explicit action permissions and event semantics are retained.

Recently removed is available alongside Drafts and Saved versions. Its directory shows twenty metadata-only entries, then twenty more, without private excerpts. Opening an entry exposes readable, selectable retained writing and the original recovery deadline. Restoration requires explicit confirmation and checks the exact reviewed recovery copy, journal epoch, original thirty-day window, tombstone revisions and content, source relationships and uniqueness. It restores original IDs and dates with one new revision per restored record. It does not restore previously removed children, modify sessions, rebuild queues, or add History events. Expired, previous-journal and restored entries remain copyable and cannot replay restoration.

Foreground and database updates refresh readonly views. Changed recovery copies require another review. A committed restoration remains reported if refreshing fails; Retry refresh cannot repeat the mutation. Controls use the shared accessible journal dialog and commitment/unload guards. Return URLs, revealed counts, scroll and focus use the existing journal navigation contract.

Physical database schema remains **3**, domain contract **1**, ordinary portable backup format/schema **1**. No new stores or domain indexes. Ordinary backups exclude private recovery copies. Recovery-inclusive backups remain a separate following change.

## Verification and visual review

Supporting checks passed TypeScript, 344 unit/integration tests and the production build, including all 31,086 BSB verses and 365 M’Cheyne assignments. Twenty new journeys cover readonly browsing/paging/copy/cancel snapshots, explicit restoration, original dates and events, stale tombstones, failed writes, post-commit refresh failure, expiration, missing entries and normalized optional context in Chromium, Firefox, WebKit and mobile Chromium.

Twelve new image comparisons cover 320/360/390/430/768/1440px, dark, 200% text, directory, empty, confirmation and expiration states. Existing Drafts and Saved versions directory images deliberately change for the third navigation choice. Comparison thresholds and coverage are unchanged. Exact-commit certification and results are recorded in the draft PR; baseline generation is not certification.

Initial browser checks exposed Safari's pointer-focus behavior; opening Restore now explicitly focuses its triggering control so Escape returns focus there. Running capture and browser jobs into one output folder also interrupted trace retention; their output directories are now isolated. Enlarged-text review exposed a button exceeding the narrow screen; controls now wrap within their available width. Initial failing runs are not counted as passes.

The rendered screen retains botanical character, paper surfaces and literary copy fields. It is a recovery utility, with no direct canonical phone reference. Original dates use compact read-only controls; long retained writing and larger removal groups extend naturally below the fold. No new artwork or logo is introduced. Human screen-reader, physical-phone keyboard/IME, usability and reference-device performance gates remain pending. No merge, deployment or cloud provisioning.

## Changed areas

- Removal capture/validation/restore and read-only presentation models under `src/recovery`.
- Existing repository removal entry points and exact-draft discard transaction boundaries.
- Recovery routes/navigation, Recently removed screen and existing `screens` CSS layer.
- Unit/browser/image tests, deterministic fixtures and reviewed recovery baselines.

Next: optional, independently versioned recovery backups with validated private payloads, isolated import identities and atomic reviewed commitment. Ordinary portable-v1 backups remain the default.
