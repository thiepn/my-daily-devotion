# P14 — Independent Evidence Collection & Release Gate Reconciliation

**Status:** draft, preparation-only. No launch clearance, physical-device signoff, site migration, protected journal inspection, release operation, rollback, merge or deployment occurred.

## Purpose and trust boundaries

P14 augments the P13 unsigned reviewer receipt parser with two things: fixed-route GitHub review-source corroboration and human-checklist/recovery-plan *claim reconciliation*. It is not an attestation service. Its output always contains releaseAuthorized=false.

1. Read-only GitHub PR metadata. The source reader fetches the exact PR, current review records and commit-author records by three GET requests to the official repository's fixed GitHub API routes. It binds all source records to the PR head SHA, rejects duplicate review IDs, truncated pages and unsupported review states, and uses SHA-256 of review text rather than emitting that text. Code-review records from a non-author can be *source-correlated*, but an ordinary GitHub APPROVED code review is **not** explicit authorization for P8's nine screenshots, a merge, physical hardware, migration or deployment. Dismissals, edited content and review chronology still require direct human interpretation; credentials and scopes are never created here.
2. Source links and replay awareness. A P13 UUIDv4 receipt is matched to a source review ID, SHA, reviewer handle, submitted timestamp, decision and exact body digest. Previously used receipt IDs are rejected via the separately provided P13 history. This history file is **not** an authenticated append-only record and can be replaced or forged. Source JSON replay/counterfeiting is possible in offline mode. Claims remain unsigned and humanIdentityVerified=false.
3. Physical device/accessibility intake. P13 limits the evidence packet to allowlisted platform and scenario metadata. P14 reports *missing claimed scenarios* for Android Chrome, Samsung Internet and TalkBack, including offline cold start, backgrounding, IME, storage pressure, SW updates, focus, contrast and 200% text. No physical device is available in CI. The presence of claimedPhysical=true in JSON does not constitute physical-device testing.
4. Forward-only recovery policy. P14 permits only a same-origin, same-path candidate at physical schema 3 or above, a claimed password-encrypted off-device portable-v1 backup, and a forward-compatible-fix or fresh-compatible-profile-restore plan. It rejects schema downgrades, moved origin/path, destructive steps, unencrypted backup and stale source SHA. It does not read backups, touch IndexedDB, run a recovery action, or claim a successful human rehearsal.
5. No arbitrary actions. The read-only CLI has a GET-only mode for GitHub review summaries and an offline mode for source-linked unsigned receipts. Both return exit code 3 for structurally checked but untrusted claims and 4 for rejected evidence. Neither returns exit 0 as release clearance, prints secret input, or writes production resources.

## Commands

    node --test scripts/p14/reconcile.check.mjs
    node scripts/p14/evidence-cli.mjs github PR_NUMBER EXACT_40_HEX_PR_SHA
    node scripts/p14/evidence-cli.mjs reconcile PACKET_JSON HISTORY_JSON SOURCE_SNAPSHOT_JSON LINKS_JSON RECOVERY_JSON_OR_none EXACT_40_HEX_SHA

The offline source snapshot is untrusted JSON and must not be described as independently fetched simply because its fields resemble GitHub API output. For trusted provenance, run GitHub read mode directly and have an independent operator compare the source records, reviewer identity and screenshot-specific decision. Do not put private journal entries, passwords, actual encrypted backups, account/device IDs, IP addresses, real-device telemetry, or prayer text into GitHub PR comments or CI artifacts.

## Required manual gates (still blocked)

- P8 PR #53 at exact SHA 3d1b4be19f03301dcd4fa86b11aac0e68a92229c: **0 independent reviews** and nine unresolved screenshot differences, eight quota warnings plus removed-dialog. No golden updates are authorized.
- P9: provenance/origin/scope/rollback infrastructure not implemented and not certified. P10–P14 drafts may only be considered preparation until the predecessor P9 is independently qualified and all phases restacked.
- P10 #54: exact-head Release Certification failure (nine Windows visual differences, WebKit cancelled). P11 #55: exact-head Release Certification failure (nine visual differences and one Windows ERR_NO_BUFFER_SPACE).
- P12 #56: preparation tests/Phase 0 passed, final exact-head CI and artifacts need fresh qualification.
- P13 #57: preparation tests/Phase 0/356 unit tests passed. Full Release Certification run 38001651668 **failed**: Windows 9 visual mismatches and WebKit 251 pass + one keyboard focus test flaky. No certificate.
- P1/P2: original *deployed* v1.2.5 schema 1 to schema 3 migration/rollback-safe recovery in disposable profiles, trusted off-device encrypted portable-v1 backup restore, two-tab interruption/low-space behaviour; **physical** Android Chrome/Samsung Internet/TalkBack/IME and human accessibility acceptance. Different individuals/authorities must explicitly approve merge, deployment and release publication; they are distinct gates.

## Human operator evidence procedure

The operator must: verify the exact PR head and CI run IDs directly from GitHub; retrieve and inspect nine visual comparisons personally and record exact-image approval/rejection; check reviewer source identity and any changes_requested/dismissal chronology; operate genuine Android devices with consent; and test encrypted-backup restoration in a fresh safe profile without exposing private text.

On checksum mismatch, incompatible schema, PWA scope change, unapproved image or unresolved human evidence: stop the release process, preserve original origin and user data, and escalate to a qualified operator. Do not downgrade schema 3 to deployed schema 1, purge service workers, overwrite backup material, redirect domains or silently reset IndexedDB. Recovery is forward-compatible only.

## Following P15 — Audited Human Acceptance & Final Certification Readiness

**Not started.** Scope: independent evidence/identity attestations (outside this parser), exact-head requalification of the properly restacked chain, physical-device and accessibility approvals, original-origin backup/migration acceptance, and an operator-controlled *non-deploying* release rehearsal. No unattended merging or publication.
