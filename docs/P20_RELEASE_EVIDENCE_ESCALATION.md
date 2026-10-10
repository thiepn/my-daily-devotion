# P20 — Independent Release Evidence Attestation & Operations Escalation

**Status: preparation-only. NO_GO, no approvals or real-world key rotation.** No merge, deploy, publication, DNS move, cache purge, live data or credential issuance.

## Implemented source

- `scripts/p20/rotation.mjs`: source-bound evidence-only signer **rotation and revocation intent**. A previous signer, replacement signer and independent custodian must each sign the same Ed25519 canonical payload. All three pins must be independently supplied and have distinct key bytes and handles. Enforces one-step monotonic previous custody sequence/digest, revoked-key inventory, valid issue/expiry, UUIDv4 anti-replay history, source SHA and replacement identity. **This does not rotate or revoke a real key.** Suspected compromise cannot be remediated by accepting a possibly compromised signature as authority; stop and initiate an independently controlled human compromise procedure.
- `scripts/p20/escalation.mjs`: recalculates P19's actual immutable ZIP-byte release handoff, two-key signed default HOLD, P18/P17 trust chain, exact source/instance and original origin/path before correlating P20 rotation intent. Human device, TalkBack/accessibility and disposable migration/encrypted off-device backup packets must match the SHA-256 and digest of a matching signed reviewed receipt and may be only PENDING, REVIEW_REQUESTED or REJECTED, **never APPROVED** by this service. There are no physical-device tests here.
- `scripts/p20/escalation-cli.mjs`: offline nondeploying evidence inspector. Actual immutable ZIP is separate from JSON. It requires externally sourced P17 witness pins, P19 operator pins, current custody root, trusted prior ledger sequence/digest, historical witness/handoff/operator/rotation/escalation nonces, current revoked-key list and three P20 rotation pins. No input may self-certify its own external trust. Paths, credentials, private journal content, backups and device identifiers are not printed. Exit **3** for structurally checked yet unverified evidence, **4** on error; never 0 for release authorization.
- `scripts/p20/escalation.check.mjs`: fourteen adversarial tests with ephemeral keys and actual ZIP-byte fixtures for wrong provenance, signature/role substitution, old revoked signer, replay/fork, cross-source or previous-signature mismatch, forged permission, unsupported physical evidence, unsafe recovery, privacy and the CLI.
- Dedicated read-only CI uses `contents: read` and no GitHub mutation or release permissions. Existing mandatory Release Certification workflow, screenshots and production code unchanged.

## Run in isolated local workspace

    npm ci --ignore-scripts
    node --test scripts/p20/escalation.check.mjs
    node scripts/p20/escalation-cli.mjs hold /secure/p20-hold.json /secure/my-daily-devotion-VERSION-web.zip EXACT_SOURCE_SHA CURRENT_ISO_TIME

The operator must separately supply:
- MDD_CUSTODY_ROOT_SHA256; MDD_TRUSTED_LEDGER_SEQUENCE; MDD_TRUSTED_LEDGER_DIGEST; MDD_MIN_TRUSTED_CUSTODY_REVISION
- MDD_EXTERNAL_WITNESS_PINS_JSON; MDD_EXTERNAL_OPERATOR_PINS_JSON
- MDD_PREVIOUS_WITNESS_NONCES_JSON; MDD_PREVIOUS_HANDOFF_NONCES_JSON; MDD_PREVIOUS_OPERATOR_NONCES_JSON
- MDD_OPERATOR_LEDGER_SEQUENCE; MDD_OPERATOR_LEDGER_DIGEST
- MDD_P20_ROTATION_LEDGER_SEQUENCE; MDD_P20_ROTATION_LEDGER_DIGEST; MDD_P20_PREVIOUS_ACTIVE_KEY_ID
- MDD_P20_EXTERNAL_ROTATION_PINS_JSON; MDD_P20_PREVIOUS_REVOKED_KEYS_JSON; MDD_P20_PREVIOUS_ROTATION_NONCES_JSON; MDD_P20_PREVIOUS_ESCALATION_NONCES_JSON

The source of these pins and records must be authenticated by a human operator through an independently controlled record. **Never copy them from submitted JSON as proof of authenticity.** A valid signed rotation intent does not establish that revocation was published or a replacement actually activated. There is no append-only external registry deployed here.

## Original-host and physical release blockers remain OPEN

1. P8 PR #53 at `3d1b4be19f03301dcd4fa86b11aac0e68a92229c`: independent reviewer decisions for nine original visuals (eight quota warnings and removed-dialog.png) remain absent. No visual rebaselining authorized.
2. P9 is absent/unqualified. P10–P20 are separate preparation drafts; none is ready to integrate before qualified P9, correct restack and passing exact-head main-release certification.
3. P19 PR #63 at `d998a1381959176991a8a33f34abb9d563d92096`: dedicated 13/13 and Phase 0 passed; full Release Certification `38059538348` **FAILED**, despite 356 units/build and eight browser shards passing. Windows visual 517/526, nine original screenshot mismatches, final certification skipped. P17/P18 full certification failed similarly with one extra intermittent missing `main` navigation; not evidence for altering goldens.
4. Original physical v1.2.5 schema-1 to schema-3 browser-origin migration, password-encrypted off-device portable-v1 backup recovery, real Android Chrome/Samsung Internet/TalkBack/IME/accessibility and separate human merge/deploy/publication approvals are **not complete**.
5. Synthetic-merge build archives can have valid byte hashes without any authorized main-branch release certificate. Check real actual ZIP bytes and original-host service-worker scope with independent owners; do not purge caches, downgrade schema, redirect origin, or access protected journals.

## Operations escalation

On any absent signed review, unverified source/rights, current revocation-state uncertainty, a potentially compromised key, schema incompatibility, failed immutable release check, pending physical accessibility, or missing original-origin backup proof: **HOLD**. Preserve the existing browser origin and data. An independent human can request non-destructive forward-compatible remediation with an encrypted off-device backup and separate safe-profile verification; this tooling does not execute recovery.

## P21 — Independent Human Evidence Custody & Nondeploying Closure Review

**Not started.** Objectives: independently operator-held signer rotation and revocation reconciliation, authenticated external replay history, source/rights/original-host provenance and real physical/accessibility evidence, preserved prior-stable recovery proof and separately human-governed pre-cutover/postrelease decisions. No unattended release or publication.
