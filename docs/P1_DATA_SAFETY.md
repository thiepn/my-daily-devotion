# P1 — Data safety and migration compatibility

**Scope:** verify local journal upgrades from published v1.2.5 (physical schema 1), interim draft-recovery schema 2, and current schema 3. No user data, deployment, DNS or release tags are modified. P1 is a pre-deployment safety gate, not a new product feature.

## Findings — source review, 2026-10-09

- The published [v1.2.5 schema](https://github.com/thiepn/my-daily-devotion/blob/v1.2.5/src/data/schema.ts) has the **same 22 original stores/index declarations** as current `schemaV1`. Its migrations register only physical version 1. This was checked against the published Git tag.
- Current `src/data/migrations.ts` registers v1 → v2 → v3 with additive private stores, keeps original domain indexes, initializes a journal epoch in v2, and adds saved-version/removal stores in v3. Unsupported metadata contracts abort the upgrade.
- `prepareDatabase` checks metadata compatibility, preserving a journal that the running app cannot interpret. Existing duplicate reading-progress repair is transactional, retains retired rows as tombstones, and is not a general destructive schema migration.
- The original **21 portable domain tables** remain an explicit allowlist. Normal archive format/schema stays version 1 and intentionally excludes drafts, saved versions, recently removed copies, device/account/sync state and physical schema metadata.
- Reviewed restore validates manifest, checksum, archive limits, records and relationships prior to the mutation transaction. Replace rotates the journal identity without deleting private recovery stores; old local drafts therefore cannot silently apply to the restored journal.
- No new production migration routine was justified by this review. Changes in this PR are tests and qualification documentation. Every regression fix must be supported by a reproducible failure.

## New automated safety cases

`src/data/migration-compatibility.test.ts` exercises the actual database constructor and fake IndexedDB, including persistent close/reopen:

1. **Published v1 shape → v3**, carrying real domain fixtures, history, reflections, prayers, tombstones, preferences, dates and revisions, followed by a second application startup with identical portable data and journal epoch.
2. **v2 → v3**, preserving the active unfinished private reflection and journal epoch, retaining all domain records, creating empty new recovery stores and maintaining portable-v1 boundaries.
3. **Injected interrupted v3 upgrade**, with a provisional write inside the aborted version transaction; verifies rollback of the entire operation, physical schema, metadata, draft contents and portable domain records, followed by successful retry.
4. **Bad stored domain contract** at both v1 and v2; verifies refusal and complete preservation of previous-schema data.
5. **Reviewed portable-v1 replace** on upgraded schema 3; verifies domain-only replacement, private draft retention, metadata preservation and deliberate journal-epoch rotation.

Existing tests cover additional backward compatibility, corrupt/tampered archives, wrong encryption password, unknown tables, invalid relations, stale review, injected restore failures, duplicate commits, and previously deleted records.

## Manual/live deployment blockers

Passing simulated migration tests **does not** qualify real-user storage upgrades. Before P2:

- [ ] Use a disposable profile on the actual existing web **origin**, running the currently deployed application. Populate a realistic journal (reading progress, prayers including answers/deletions, multiple reflections and large text); retain a verified encrypted **portable v1** backup off-device.
- [ ] On that disposable profile, upgrade to the **exact certified** v3 application. Independently compare texts, IDs, saved dates, revisions, tombstones and counts; close/reopen; verify ordinary backup export/import and recovery.
- [ ] Test two-tab upgrade/version-change, interrupted startup or unavailable storage, quota-pressure behavior, update/reload, and an actual physical Android browser/device. Record browser, OS, old app release, target commit and evidence.
- [ ] Exercise **backup-based recovery**, not downgrade: physical schema 3 cannot safely be opened by a v1 runtime.
- [ ] Preserve the existing browser origin. A redirect to `mdd.thiepn.dev` does **not** transfer IndexedDB. Design and qualify the old-origin handoff separately.
- [ ] Complete human/device visual and keyboard/IME checks and record any remaining severity-rated defects.

## Acceptance

**Engineering:** all new and existing unit, browser, Windows screenshot and exact-artifact certification jobs succeed for the P1 PR head and, after integration, its resulting `main` SHA.

**Operational:** P1 is **not fully qualified for an existing user's journal** until the above live-origin, physical-device and recovery exercises are recorded. A green test suite permits integration, not automatic deployment.

**Next phase:** P2 deploys the exact successful main artifact only after independent owner authorization, the completed migration-safety gate, and post-deployment verification. No rebuild is allowed between certification and publication.
