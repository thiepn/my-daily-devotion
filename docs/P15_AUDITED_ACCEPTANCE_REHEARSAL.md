# P15 — Audited Human Acceptance & Final Certification Readiness Preparation

**Status: unsigned/unapproved preparation only. No accepted human decision, real-device test, production release, merge, deploy, publication, DNS change, data mutation or rollback has occurred.**

## What is implemented

- A narrowly scoped **Ed25519 signature verifier** in scripts/p15/attestations.mjs. The signer public key is supplied **out of band** by the operator as DER/SPKI base64 with an independently pinned SHA-256 fingerprint, key ID, validity window and explicit reviewer roles. There are **no built-in or accepted production keys**; testing uses freshly generated ephemeral fixture keys only. Strict signed canonical JSON binds the exact source commit, subject, evidence digest, reviewer handle, explicit accept/reject, UUIDv4 nonce, issue/expiry and role. Reject wrong/expired/revoked pins, signer roles, future/expired attestations, duplicates, previously listed nonces and source authors claiming to be independent. No private journal strings or credentials are allowed in evidence metadata.
- Each **P8 visual comparison** remains an individually named review decision (eight storage-pressure warnings and removed-dialog.png). No passing screenshot comparison or forged visual checklist can retroactively authorize an existing golden. P14's latest comparison passed removed-dialog but the original P8 screenshot-review decision is **still OPEN**.
- Reviewer identity, **independently provisioned trust root**, current revocation data and append-only replay history are human/operator obligations. Local signature validity means only cryptographic integrity under the *provided* key; it does not establish signer identity, physical Android acceptance, owner approval or actual visual evidence correctness. Signature output must never be promoted to automatic authorization.
- A **no-op rehearsal** in scripts/p15/rehearsal.mjs binds a single exact source SHA, archive checksum claim, run/artifact IDs, same original HTTPS origin/path, 13 release-gate claims, explicit review gaps and a forward-compatible encrypted-backup recovery plan. It prohibits physical schema downgrade, unencrypted backup, changed storage origin/path, destructive steps and any enabled merge/deploy/publication. Even a purported fully passing packet returns releaseAuthorized=false and reports no actions performed. Claims are not a substitute for authenticated CI, byte-level P12 artifact integrity or a physical review.
- scripts/p15/acceptance-cli.mjs performs read-only local inspection. Exit 3 means only structural/signature or rehearsal checks passed; exit 4 means invalid or missing input. **Neither mode returns exit 0 as release authorization.** Error output never contains rejected private journal text, tokens or input file paths.
- scripts/p15/acceptance.check.mjs exercises signature tampering, role/nonce/expiry/pin/revocation failures, nine explicit visual approvals and all nondeploying recovery constraints. CI runs this as a separate Node suite outside Vitest discovery.

## Offline operator commands — no publication

    node --test scripts/p15/acceptance.check.mjs
    node scripts/p15/acceptance-cli.mjs attest TRUST_ROOT.json ATTESTATIONS.json TRUSTED_PRIOR_NONCES.json CODE_AUTHORS.json EXACT_SOURCE_SHA 2026-10-10T00:00:00Z
    node scripts/p15/acceptance-cli.mjs rehearse REHEARSAL.json

Never create or distribute signing private keys via this repository or ChatGPT. The review trust root must be sourced/authenticated by an independent authorized operator, pinned out-of-band and checked against a real revocation register. These preparatory tools do **not** create a registry or provision production credentials. The real current time must be independently supplied to the verifier; the date above is illustrative, not an acceptance instruction. Original filenames/baselines and protected private journals must never be attached to a public PR as evidence.

## P8 through P14 blockers

- **P8 PR #53** at 3d1b4be19f03301dcd4fa86b11aac0e68a92229c: no independent submitted reviews; original **nine** unapproved visual differences (eight quota-warning cases and removed-dialog). Changes to visual goldens require explicit independent image-specific authorization.
- **P9** platform/release infrastructure has not been implemented/qualified. P10–P15 branches stacked without P9 are **preparation drafts only**, not candidates for production merge until P9 is qualified and all later branches restacked and retested at exact heads.
- P10 #54 full release CI failed inherited visuals and cancelled WebKit; P11 #55 failed inherited visuals and one transient Windows buffer error; P12 #56 CI failed inherited visuals; P13 #57 failed nine visuals and a flaky WebKit keyboard-focus case. P14 #58 at c9f5204bfff930f8334a5a3f417a52d5005cfaf1 has P14 dedicated 13/13, Phase 0, unit/build and all eight browser shards passing, **but Windows 518/526** visuals and final certificate skipped.
- **P1/P2** owner acceptance: actual *original deployed origin* v1.2.5 schema-1 to schema-3 migration in disposable browser profiles, two-tab storage-pressure/upgrade, password-encrypted portable-v1 off-device backup and restore, and safe forward-compatible recovery. Redirecting to a new domain does not migrate IndexedDB. Do not downgrade schema 3 to a schema-1 runtime or erase site data.
- **Human physical-device/accessibility:** real Android Chrome and Samsung Internet installed PWA/browser tests, background resume, IME, quota, TalkBack, keyboard/focus, 200% text, contrast and independent human decisions. Synthetic/emulated tests do not substitute.
- Independent **merge**, **deployment**, and **publication** approvals are distinct steps, and a passing PR synthetic merge build is never an exact-main deployable certificate.

## Operator-reviewed, non-deploying acceptance procedure

1. Confirm the exact qualified release head and original HTTPS origin/path, and separately obtain an independently authenticated successful **main** CI certificate with all mandatory jobs and a complete immutable released artifact archive.
2. Confirm each one of nine visual decisions, then review real-device and migration evidence without revealing personal prayer or journal content. Validate the signer trust root, reviewer independence, revocation history and previously-used nonces with an external audit record.
3. Run the offline artifact-byte check from P12; correlate P13 GitHub CI run/artifact identity with actual SHA-256 bytes; run P14 device/source review claims and P15 signature inspection.
4. Run the P15 rehearsal *locally* with merge/deploy/publication all false. Review reported gaps manually. Preserve records, do not use an exit code as authorization.
5. If an app defect, unsupported origin, missing backup, bad signature or screenshot mismatch remains, **stop**. Continue only with non-destructive forward-compatible fixes, authenticated off-device backups and a fresh compatible profile. Never run an automatic downgrade, purge caches, clear IndexedDB, migrate live data or force publication.

## P16 — Controlled Operator Decision & Independent Closure

**Not started.** Future objectives: formally authenticated trust-root custody and revocation-state verification, append-only anti-replay receipts, physical Android/accessibility signed owner packets, independently verified P1/P2 original-origin migration/restore, and controlled evidence-only release readiness closure. Release remains forbidden until a separately authorized deployment decision.
