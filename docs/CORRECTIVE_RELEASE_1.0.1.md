# My Daily Devotion 1.0.1 — corrective release

Scope: fix the findings in the audit of `bfe58ca5b8f977f6f001a4f9ab901e2680c6908d`. Preserve the existing editorial UI, local data, original history, BSB translation and database schema 1. No new feature roadmap or origin migration.

| Finding | Correction | Verification |
| --- | --- | --- |
| A01 concurrent imports | Read/decide/write in one transaction; atomic enrollment/import; non-destructive idempotent repair of historical duplicates | Overlapping imports, explicit unread, integrity audit, backup round-trip, invalid inputs |
| A02 stale mutable editors | Transactional revision checks for settings, People, categories and collections; explicit compare/use-latest UI | Repository races and multi-tab browser regressions |
| A03 in-page draft loss | Save/discard/cancel for metadata switches and prayer lifecycle actions; preserve answer notes separately | Real browser tests including failure recovery and dialog accessibility |
| A04 missing Exodus 12:51 | March 1 extends through verse 51; documented generator correction; completion is unchanged | Every shipped verse is checked against the entire annual schedule |
| A05 Scripture spacing | Parser 5 preserves closing-quote boundaries; copy preserves poetry and verse boundaries | 28 independent quotation fixtures, full reader/search/copy agreement |
| A06 silent failed writes | Visible errors, pending guards, validated dates and retry; session failures caught | Failure injection after startup; no false completion or unhandled rejection |
| A07 runtime dependency inventory | fflate classified and audited as a production dependency; notices include its license | Locked install, production audit, notices/release verification |
| A08 evidence/coverage | Firefox and WebKit regression projects; exact commit and results in release evidence; no rebuild after browser tests; live file-hash comparison; durable GitHub Release | See machine-readable reports attached to this exact release |

The 12 initial data-safety regression cases failed against the audited implementation before repairs and passed afterward. Do not use historical phase-document counts as current execution evidence. The published `verification-summary.json`, `unit-results.json`, `browser-results.json`, `release-manifest.json`, `SHA256SUMS` and `deployment-verification.json` identify actual results and source commit.

## Data and content compatibility

No database reset or schema migration is required. Duplicate repair preserves the newest explicit reading state, including an unread state; redundant rows receive deletion markers rather than being erased. Activity history is retained. Repair records are stored in preferences. Backups remain format 1. Prior completion of March 1 remains completed; the additional verse is visible in the reader without silently changing personal progress.

## Explicit limits

Browser emulation is not a physical-device test. Physical Android/iOS installation, OS termination, real touch keyboards and human screen-reader use have not been certified by this automated release suite. Live IndexedDB is not application-encrypted; removed records can remain as tombstones; same-origin apps share the browser-storage trust boundary. A dedicated origin requires a separately authorized migration and explicit data transfer.

Repository branch protection is a GitHub administration setting, separate from source-code checks. Do not claim it is enabled unless the repository setting has actually been verified. CI refuses to deploy until verification passes; the permanent release is published only after all deployed-file hashes match the tested package.
