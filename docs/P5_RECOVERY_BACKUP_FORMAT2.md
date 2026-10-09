# P5 — Optional encrypted recovery backup (format 2)

This is an **isolated, non-deployed implementation**. Normal .mddbackup archives stay **format 1**, portable domain schema 1, physical IndexedDB schema 3. Format-2 export must be explicitly selected for each encrypted export; no cloud upload or account service is involved.

## Included private recovery writing

The file contains the 21 ordinary domain tables plus typed metadata/content pairs from editorDrafts, editorDraftContents, savedVersions, savedVersionContents, removalGroups and removalGroupContents, with a source journal epoch. Draft payloads and prior saved writing can contain private unfinished thoughts. The UI presents an adjacent privacy warning rather than hiding this detail in Advanced. Credentials, keys, client/server sync state, device IDs, diagnostics, local receipts and unrelated IndexedDB tables are excluded.

The archive retains manifest version 2 and recovery payload version 1. A single AES-256-GCM encrypted data.json combines domain and private recovery data, avoiding nonce reuse across separately encrypted files. PBKDF2-SHA-256, password requirements, checksums, decompression and archive size limits are inherited from format 1. Plain format 2 is deliberately unsupported.

## Export and import

- Read all domain and optional recovery stores in **one readonly IndexedDB transaction**, then hash/compress/encrypt after the transaction ends.
- Validate format and checksum, paired discriminated metadata/writing, UUIDs, draft generations, supported dates/routes, previous record revisions, counts and source epoch. Check domain records and relationships in a temporary throwaway database.
- Provide a review of ordinary live/deletion-marker counts and **separate private recovery counts**, without displaying writing contents in summaries.
- Merge/Replace commits ordinary and private records atomically after comparing both local fingerprints with reviewed state. Concurrent changes invalidate the review.
- Existing local private recovery stores are never cleared. Identical imported identities are deduplicated; conflicting IDs are copied under new IDs.
- **Every imported recovery entry is detached into a previous-journal epoch**, including on Merge. It can be reviewed/copied but cannot silently reapply unsaved writing or reactivate a Recently removed tombstone against another journal. The 30-day eligibility deadline is not extended.
- Ordinary format-1 restore retains the existing behavior, without reading or mutating optional recovery.

## Tests and human qualification

Added unit tests for ordinary-v1 compatibility, format-2 password requirements, private-content encryption, content-count reviews, import/reimport and local preservation, previous-journal isolation, invalid header/password, schema/metadata errors and stale review. Existing portability tests additionally cover domain conflict/rollback, encrypted/plain v1 and corrupt archives.

Before a production release, require passing TypeScript, all automated browser/unit, Windows visual and exact-artifact CI checks; a disposable-profile old-origin migration; a real encrypted format-2 export transferred to a second test device; Android interrupted-import/low-storage and backup recovery exercises; screen-reader and keyboard inspections; and a final exact-main SHA certificate. No live deploy, schema migration or release publication occurs in P5.

**Next:** P6 complete functional defect audit, while outstanding P1–P4 CI and physical-device gates are resolved.
