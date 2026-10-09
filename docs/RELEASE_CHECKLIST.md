# Release checklist — integrated offline main candidate

**Ship only from a commit** that passed its exact-commit release certification and retained every P1/P2 migration, archive, accessibility and physical-device acceptance gate. Prior CI or a green PR alone does not qualify a merged artifact.

Authoritative status as of **2026-10-09**. This checklist applies to the **exact new commit** proposed for deployment, not simply to a successful historical PR. See [P0 release baseline](RELEASE_BASELINE_2026-10-09.md) and [Codex workflow](CODEX_WORKFLOW.md).

## Confirmed prior to this P0 documentation change

- [x] Source application integration on `main`: `87f4d25f43892dc9c5fbfbcda8c1ed739286e8e8` via PRs #41–#44.
- [x] `Phase 0 Contract` and `Release Certification CI` succeeded for that exact source commit: runs [37896665636](https://github.com/thiepn/my-daily-devotion/actions/runs/37896665636) and [37896665631](https://github.com/thiepn/my-daily-devotion/actions/runs/37896665631).
- [x] Certified build: 344 unit/integration cases, 1,118 browser cases across eight shards, 526 Windows visual comparisons; no failures/skips/flaky tests; exact release artifact produced.
- [x] Code-backed physical schema 3, domain contract 1, ordinary portable backup format/schema 1; durable drafts, saved versions and Recently removed included.
- [x] Deployment workflow is manually dispatched, not triggered on push; package metadata currently 1.3.0; last published release is v1.2.5.

**Warning:** This is evidence for the pre-P0 source commit. Any documentation-only merge changes `main` SHA and requires a fresh passing run on that new SHA before invoking the certified deployment workflow.

## P0 repository and evidence

- [ ] Merge the P0 documentation-only change after reviewing the diff and current PR/branch inventory.
- [ ] Confirm old stacked PRs with head commits provably contained in `main` have been closed as superseded *without deleting their branches*.
- [ ] Resolve or explicitly retain distinct legacy/diverged PRs #9, #10, #11, #31 and #35; never force-merge their divergent histories.
- [ ] Re-run certification on the resulting exact `main` SHA and record its artifact/run ID.

## P1 — data integrity gate before deploying an upgraded journal

- [ ] Confirm data and device backup availability on the existing live origin.
- [ ] Test real upgrade paths from previously deployed local schemas to physical schema 3 with representative saved records, tombstones, prayers, dates, reader state and device-local drafts.
- [ ] Test interrupted migration, persistence/rollback, cold reload, multiple tabs, quota pressure and recovery from backup.
- [ ] Validate original ordinary portable-v1 encrypted/plain import and reviewed replace/merge, including wrong password and corrupt archive behavior.
- [ ] Document that **ordinary** portable backups omit private unfinished drafts, previous writing versions and Recently removed recovery copies; do not claim optional recovery format 2 is released.
- [ ] Verify package, application and service-worker versions and prevent downgrade to incompatible database schema.

## P2 — explicit web release

- [ ] Review canonical Morning Grace artwork/icons, real screens at 320/360/390/430/768/1440px, dark mode, 200% text and keyboard/focus/contrast; preserve all open human/device qualifications.
- [ ] Obtain explicit authorization for live deployment, distinct from authorization to merge.
- [ ] Trigger **Deploy certified release** on the current `main` SHA using that exact SHA's successful `Release Certification CI` run ID; leave `publish_release=false` without separate permission.
- [ ] Deploy the certified archive *without rebuilding*; verify the deployed commit identity and every asset checksum, service-worker behavior and offline cold boot.
- [ ] Preserve the existing browser origin until an old-origin → new-origin encrypted journal transfer and recovery exercise have been validated. DNS redirect alone does not migrate IndexedDB.
- [ ] Retain a deploy verification report and a rollback/recovery plan compatible with schema 3.
- [ ] Publish a correctly versioned immutable GitHub release only after explicit release approval; never overwrite v1.2.5 or reuse a tag.

## Post-release quality requirements

- [ ] Screen-reader, physical-phone IME/keyboard, usable offline install/update and representative 10,000-record navigation/search performance reports.
- [ ] No unresolved critical or high-severity defects; known lower-priority limitations recorded.
- [ ] New Codex feature PRs target `main`, include exact-commit tests and avoid resurrecting closed stacked PRs.

Human acceptance and production deployment are **not** implied by a green automated CI run.