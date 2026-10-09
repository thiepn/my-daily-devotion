# P2 — Certified Web Release / Fail-Closed Launch Gate

**Status on 9 October 2026: prepared, not deployed.** The v1.2.5 public release and schema-3 development candidate cannot be treated as interchangeable. P1 PR #46 is still open and its certification is not yet complete; the main branch documentation commit has a pending certification run. No manual migrated-profile/device evidence has been supplied, so production dispatch is blocked.

## What P2 implements

- The deployment continues to use the **exact certified** archive from a successful CI run on the selected `main` SHA, without rebuilding.
- The deployment workflow now requires the **existing site URL**, including path. Before deploying, it retrieves the currently configured GitHub Pages `html_url` from the GitHub API and **refuses any origin/path difference**, any missing Pages configuration, or any unsafe HTTP/custom-port URL. This prevents an accidental release to an unverified origin.
- The workflow checks that the migration qualification PR **#46 has been merged**, then demands the explicit operator acknowledgement `P1-UPGRADE-AND-BACKUP-VERIFIED`. This acknowledgement is a guard against accidental dispatch, **not** proof the manual tests have passed; never enter it without that evidence.
- The existing exact commit/successful CI verification, SHA-256 comparisons, immutable package staging and deployed asset identity checks remain in force.
- The deployment attestation records the approved URL, source SHA and run ID in a non-sensitive verification artifact; journal contents, backup passwords and local device data must never appear in logs/artifacts.
- GitHub release publication remains **disabled by default** and independently controlled by `publish_release`. Merging is not publication.

## Required acceptance in order

1. [ ] P1 PR #46 tests pass, it is reviewed/merged, and its resulting new `main` SHA has its own successful **Release Certification CI** with `mdd-certified-release`.
2. [ ] An **existing-origin disposable-profile** rehearsal against the previously deployed v1.2.5 journal proves schema 1 → 3 continuity: exact text/IDs/dates/revisions, tombstones and reading progress, reload/persistence and two-tab update behavior.
3. [ ] The previous journal is saved to a **validated password-encrypted portable-v1 off-device backup**; restore on a fresh compatible profile proves recovery. Do not test with a person's only real journal.
4. [ ] At least one **physical Android device** and desktop browser are checked for update/service-worker behavior, offline cold start, storage limitations, keyboard/IME and no critical UI errors. Keep screenshots/reports **free of private journal text**.
5. [ ] Confirm the canonical *existing site URL and path* from GitHub Pages settings and the existing browser origin. If the Pages site URL differs from the real current journal origin, **stop**; investigate routing before deployment.
6. [ ] Review the visual authority and accessible states and document any remaining lower-severity limitations.
7. [ ] Obtain owner approval for the live deployment and manually dispatch **Deploy certified release** from current `main`. Provide:
   - `certification_run_id`: completed successful *current main* Release Certification CI run
   - `expected_public_url`: current existing GitHub Pages URL/path (do not guess a new domain)
   - `p1_migration_attestation`: `P1-UPGRADE-AND-BACKUP-VERIFIED` **only once steps 2–6 are done**
   - `publish_release`: `false` unless separately authorized
8. [ ] Retain the preflight and deployment-verification artifacts, confirm every asset matches the tested build, compare `build-info.json` source SHA, and verify the offline PWA and actual journal on the original browser profile.

## Rollback and data loss policy

Physical IndexedDB schema 3 is **not backwards compatible** with the v1.2.5 runtime. Rolling back the web code **does not** roll the on-device database back. Restore from a validated portable-v1 archive into a compatible application instead. Never clear user site data, force reset IndexedDB or move to `mdd.thiepn.dev` just to make an older app load.

If a deployment verification fails, stop rollout; retain the failure evidence. Do not assume a new deploy or redirect is a reversible database change.

## Gate checklist

- Existing original application origin preserved: **pending live comparison**
- P1 PR merged and exact main certification passed: **pending**
- Disposable-profile and device P1 evidence: **pending**
- New URL/attestation preflight implemented: **this PR**
- Live deployment / release publication: **not performed**

Next after completing this gate: P3 physical-device defect removal and P4 Morning Grace visual/interaction refinement.
