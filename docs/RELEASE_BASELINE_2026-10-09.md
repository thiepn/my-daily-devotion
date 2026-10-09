# P0 — Integration baseline and branch disposition

**Frozen source reference:** 2026-10-09, `main` commit [`87f4d25f43892dc9c5fbfbcda8c1ed739286e8e8`](https://github.com/thiepn/my-daily-devotion/commit/87f4d25f43892dc9c5fbfbcda8c1ed739286e8e8). This is the application feature baseline **before the P0 documentation-only changes**. Once these documents merge, the new `main` SHA needs separate exact-commit certification. This file is intentionally a frozen evidence record, not a hard-coded assertion about any future HEAD.

## Verified facts and qualification boundaries

- Ownership: `thiepn/my-daily-devotion`; default and sole release-integration branch `main`. Do not confuse with the separate `greeksage` GitHub account.
- PR #12 and #22 previously merged; on October 9, PRs **#41, #42, #43 and #44** were merged into `main` in dependency order. The final integrated feature-source commit is the frozen reference above.
- [Release Certification CI #37896665631](https://github.com/thiepn/my-daily-devotion/actions/runs/37896665631) and [Phase 0 Contract #37896665636](https://github.com/thiepn/my-daily-devotion/actions/runs/37896665636) succeeded for the frozen feature-source commit. Certification attested **344 unit/integration, 1,118 browser and 526 Windows image cases** (eight browser shards; zero failures, skips or flaky cases), and created `mdd-certified-release`.
- The separate manual `.github/workflows/deploy.yml` workflow requires an exact successful `main` certification run ID. It does not deploy on merge/push. **No new deployment or GitHub release is evidenced by the source integration.**
- Package version remains **1.3.0** in `package.json`, while last published GitHub release is **v1.2.5**. Do not assign milestone versions 1.4.0/1.5.0/1.6.0 merely because their proposed features entered the candidate.
- Schema contract: **physical IndexedDB schema 3**, **domain contract 1**, **ordinary portable backup version/schema 1**. Existing saved journal contents must survive upgrades. The older deployed site's origin must be preserved; moving it to `mdd.thiepn.dev` requires a migration/transfer mechanism.
- Automated certification is **not** equivalent to manual visual approval, human screen-reader/accessibility tests, physical-phone IME/keyboard validation, performance certification or live-production operational approval.

## What is integrated

Morning Grace Today/Bible/Prayer/History, BSB reading and M’Cheyne, manual reviews, selected-period exports, Search/Saved Scripture/Collections, prayer management and Focused Prayer, durable drafts and Recovery directory, twenty previous saved versions, thirty-day Recently removed, ordinary portable backup checking, and optional anniversary/backup reminders. The normal backup format excludes private recovery stores. **Recovery-inclusive archive format 2 (C4) remains missing.** Accounts, web sync and native app packages are not included.

## Open-PR disposition

GitHub compare at this frozen main commit confirms the following **25 historical PR heads are ancestors of main** (comparison `head_sha...main_sha`, `behind_by=0`). Their implementation is included in the integrated history, so they are eligible to close as **superseded, not discarded**:

`#13–#21`, `#23–#30`, `#32–#34`, `#36–#40`.

The following **five open PRs have divergent heads** and must not be bulk-merged, forcibly rebased or deleted in P0:

| PR | Disposition | Reason |
|---|---|---|
| [#9](https://github.com/thiepn/my-daily-devotion/pull/9) | Retain for manual decision | Older 1.2.6 native confirmation changes not an ancestor |
| [#10](https://github.com/thiepn/my-daily-devotion/pull/10) | Retain for manual decision | Older mobile polish branch not an ancestor |
| [#11](https://github.com/thiepn/my-daily-devotion/pull/11) | Retain for manual decision | Older mobile polish branch not an ancestor |
| [#31](https://github.com/thiepn/my-daily-devotion/pull/31) | Retain for diff review | Schema-3 specification branch differs by one commit; inspect before closure |
| [#35](https://github.com/thiepn/my-daily-devotion/pull/35) | Retain for diff review | Focused Prayer session branch differs by one commit; inspect before closure |

**Branch safety:** PR closure is metadata cleanup, not branch deletion. Keep every Codex head branch and its history intact. No force push. Remaining divergent PRs are **not** approved code to merge directly into the current release.

## Release process and next phases

- `main` holds reviewed integrations. Codex creates fresh feature branches from a **current** `main` head, one bounded objective per PR, not from already integrated stacks.
- Each PR records functional/regression tests, data-schema and backup compatibility, visual/accessibility evidence, exact commit SHA, known limitations and rollback/recovery notes.
- A successful PR check is not authority to publish or deploy. Merge, live deployment, GitHub release publication, DNS origin transfer and paid service upgrades are independent decisions.
- **P1** verifies real journal migration paths and backup safety before exposing schema 3 to existing users.
- **P2** performs explicit manually approved `Deploy certified release` on the *then-current* `main` SHA and verifies all live assets without rebuilding.
- Later P3–P8 harden the offline app; P9–P15 develop identity, encrypted sync, native clients and operations.

Owner-facing next step: [current release checklist](RELEASE_CHECKLIST.md); Codex-facing next step: [branch/PR workflow](CODEX_WORKFLOW.md).
