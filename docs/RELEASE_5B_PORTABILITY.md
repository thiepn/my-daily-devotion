# Durable drafts prerequisite — portable data boundary

Slice 5B implements the first approved prerequisite from [the draft specification](specs/DURABLE_LOCAL_DRAFTS.md). It stacks on specification PR #26 and the certified presentation work. No merge or deployment is automatic.

## Behavior

One explicit 21-table allowlist owns saved devotional records and portable preferences. Snapshot creation, snapshot validation/restore, archive review, review fingerprints and atomic merge/replace now use that boundary. Plain/encrypted backups and Markdown `data.json` inherit it from the shared snapshot implementation.

Exports never discover newly registered stores. Unexpected internal tables are not read into backups, included in content counts, validated as required backup tables, or cleared by domain restoration. Imported unknown tables remain rejected, even when checksums are valid. Required domain tables remain required.

Portable schema and domain contract are explicitly version 1, independent of physical database metadata. The application's actual database remains schema v1 in this slice. Historical v1 formats, encryption/KDF/password rules, checksum validation, relationship validation, revisions, tombstones, merge decisions, exact reviewed candidates and existing events are unchanged.

Reviewed restore binds only the portable domain snapshot. An internal-only change does not invalidate that review; a saved-domain or portable-preference change still does. Replacement changes only portable stores and preserves local schema metadata. Duplicate commitment and transaction rollback retain their current behavior.

## Verification

Eight new integration cases exercise a test-only extended database with private draft metadata/content, journal-state and outbox stores. Production registers no new stores. Tests cover:

- Complete v1 table membership, separate portable versions and no private leakage.
- Plain/encrypted export from the extended fixture into an ordinary v1 database, plus Markdown privacy.
- Legacy snapshot replacement preserving private stores and schema metadata.
- Merge and replace after internal-only changes, preserving those changes and exact content counts.
- Domain changes still rejecting stale review.
- Failed replacement rolling back portable writes without touching internal stores.
- Checksum-valid unknown private tables and missing required domain tables rejected before mutation.

Existing backup suites continue to cover corrupt/oversized/unsupported archives, relational validation, wrong passwords, merge revisions/tombstones, candidate effects and explicit cancellation. Exact-commit TypeScript, all tests, build, browser, image and offline certification results belong to the draft PR and its generated evidence. No screenshot baseline, CSS, component or navigation behavior changes in this slice.

## Boundary and next slice

This is not durable recovery. Unsaved writing remains memory-only. Journal-epoch rotation and epoch-bound restore confirmation require the approved 5C stores and are deliberately absent here; no pseudo-epoch preference is introduced. Slice 5C will add the migration, validated repository, generation ordering and atomic save adapters before editor adoption. It is already authorized by the owner's specification approval.

Version remains 1.3.0, database schema v1, domain contract v1, backup format/schema v1. Drafts, saved versions, account state, sync and native storage are not implemented or uploaded by this change.
