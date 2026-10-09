# P13 — Evidence Authenticity & Reviewer Closure Preparation

**Status: preparation-only stacked draft.** This does not authenticate human signatures, accept actual device tests, merge, deploy, publish, migrate origins, inspect protected user data or execute recovery.

## Implementation

- **GitHub API provenance** (scripts/p13/provenance.mjs): Read-only GET from three fixed HTTPS GitHub API routes for an explicit run ID. Check exact SHA, main branch, completed successful Release Certification CI, all eleven mandatory jobs, and a unique nonexpired mdd-certified-release artifact belonging to the same run. Reject missing or truncated pagination. An optional GITHUB_TOKEN is accepted only through process environment and never printed. No remote writes.
- **Artifact distinction:** GitHub artifact ZIP transport digest is not necessarily the SHA-256 of the *inner* release ZIP. Actual release byte integrity still requires P12. GitHub API metadata checks cannot authorize publication or verify the inner archive.
- **Replay-aware unsigned review intake** (scripts/p13/reviewer.mjs): Require random UUIDv4 receipt IDs, exact source SHA, known P10 gate ID, safe reviewer handle, timestamp, explicit accept/reject, HTTPS reference and SHA-256 evidence digest. Compare against separately supplied previously used IDs and reject duplicates. **This is not cryptographically replay-proof across invocations:** the prior-ID register must be independently authenticated, append-only and operator-controlled; no such register is created here.
- **Privacy-safe device claims:** Only coarse platforms (Android Chrome, Samsung Internet, TalkBack, desktop keyboard/screen-reader) and allowlisted scenarios (offline boot, IME, resume, accessibility, recovery) are accepted. Unrecognized fields such as personal text, IP addresses, account/device identifiers, journal contents, passwords or backup data are prohibited. The word "physical" in a receipt is only an unverified claim, never human acceptance.
- **Offline and GitHub CLI** (scripts/p13/evidence-cli.mjs): Read-only github RUN_ID SHA; offline review PACKET_JSON HISTORY_JSON SHA. Both return code 3 for syntactically checked but unauthenticated claims, 4 on invalid input, and never issue release-success exit 0. Errors do not echo private input.

## Commands

    npm ci --ignore-scripts
    node --test scripts/p13/evidence.check.mjs
    node scripts/p13/evidence-cli.mjs github RUN_ID EXACT_40_CHARACTER_MAIN_SHA
    node scripts/p13/evidence-cli.mjs review /secure/receipt-packet.json /secure/prior-receipt-ids.json EXACT_40_CHARACTER_SHA

A packet contains only sourceCommit and receipts. An independent previous-ID file contains sourceCommit and receiptIds. Keep files in a controlled folder and never publish raw private evidence in CI.

## Release blockers retained

P8 PR #53 remains unapproved for eight storage-warning snapshots and removed-dialog.png. P9 is missing. P10 #54 full CI 37997169596 failed nine images, WebKit cancelled. P11 #55 full CI 37998034715 failed nine inherited differences plus an intermittent Windows ERR_NO_BUFFER_SPACE navigation; eight browser shards passed. P12 #56 has 13/13 preparatory tests and Phase 0 green, but final mandatory release certification must be checked separately. P1/P2 original-origin migration from live v1.2.5 schema 1 to schema 3, tested off-device encrypted portable-v1 backup, recovery, real Android Chrome/Samsung Internet/TalkBack/keyboard/IME/accessibility and distinct owner merge/deploy/publication signoffs are outstanding.

This branch must be restacked after P9 and the rest of the predecessor chain is qualified. It neither changes screenshot goldens nor authorizes merge, deployment, original-origin redirect, journal mutation, cache purges or destructive downgrade.

## Next P14 — Independent Evidence Collection & Release Gate Reconciliation

**Status: not started.** Objectives: authenticate independently sourced reviewer receipt histories and human judgments, qualify physical Android/accessibility observations, reconcile exact-main CI and original-origin backup/migration evidence, and validate non-destructive forward-recovery escalation without taking release actions.
