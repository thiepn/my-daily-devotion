# P17 — Human Evidence Closure & Release Operations Safeguards

**Status: evidence-only preparation. No real hardware, original-origin migration, owner reviews, release approval, production signing keys, merge, deployment or publication have been performed.**

## Implemented

- Two Ed25519 **witness signatures** are required for a source-bound custody-root SHA-256 fingerprint, minimum custody-roster revision, retained ledger sequence and SHA-256 digest, expiry and fresh UUIDv4 nonce. The custody witness and recovery witness must have separate pinned public keys and identity handles. The operator must supply these pins and independent replay floors from a trusted outside channel; the untrusted packet is never permitted to authenticate its own witnesses. P17 checks the signatures but cannot prove who actually controls the keys.
- The witnessed prior checkpoint is fed to P16's exact-source signed receipt history and revocation verifier. Each appended receipt must advance the hash chain and sequence; the end checkpoint must be root-signed. An older witnessed revision, changed prior digest, reused witness nonce, revoked signer, stale SHA or substituted operator receipt batch fails.
- Device/accessibility packets are allowlisted to coarse scenario IDs and a SHA-256 evidence reference that must match an accepted signed Android Chrome, Samsung Internet or TalkBack/accessibility receipt. All physical-device flags remain **unverified human claims**, not measurements. No real journal, screenshots containing private text, device IDs, IP addresses or backup contents belong in audit JSON.
- Disposable-profile P1/P2 migration/backup packets require *two distinct* signed migration and encrypted off-device backup evidence hashes, same original HTTPS origin **and exact path**, schema-1 to schema-3 transition, protected portable-v1 encryption and a fresh disposable profile. The validator does not perform migration or restore.
- Forward-only recovery from physical schema 3 is enforced through inherited P15/P16 no-op logic. No site-data deletion, destructive rollback, live migration, DNS move, cache purge, release action or deployment is possible. Even completely signed synthetic data always yields `releaseAuthorized=false`.
- The read-only CLI `node scripts/p17/closure-cli.mjs inspect BUNDLE.json EXACT_SHA CURRENT_TIME` requires operator-supplied `MDD_EXTERNAL_WITNESS_PINS_JSON`, `MDD_PREVIOUS_WITNESS_NONCES_JSON`, `MDD_MIN_WITNESSED_LEDGER_SEQUENCE` and `MDD_MIN_WITNESSED_CUSTODY_REVISION` via trusted environment. Do not copy them from the submitted bundle. It exits 3 for consistent-but-unverified claims and 4 for invalid evidence; never exit 0 for release permission.
- Test with `node --test scripts/p17/closure.check.mjs`. All test signers and witness keys are synthetic ephemeral Node fixtures. No production credentials are provisioned.

## Scope and trust boundaries

The P17 two-witness format provides evidence *integrity under supplied pins*, not independent identity/authority unless humans authenticate the pins using separate custody records. Neither offline JSON nor an Ed25519 signature certifies that a physical device was operated or the operator examined the actual visual changes. The operator must independently verify real P1/P2 data migration/backup in disposable profiles and collect actual hardware/accessibility signoffs.

### Release blockers that remain OPEN

1. P8 PR #53 at `3d1b4be19f03301dcd4fa86b11aac0e68a92229c` has **0 independent submitted visual reviews** covering eight quota-warning screens and removed-dialog.png. No golden changes are authorized. Subsequent screenshot checks have fluctuated between eight and nine failures; exact original review remains open.
2. **P9 has not been implemented or qualified**. P10–P17 are separate preparation drafts and must be correctly restacked on certified P9 with mandatory exact-head CI before an integrated candidate exists.
3. P16 #60 at `f2f7aeecf891c1d31bb8895514485bba800e2745`: dedicated 15/15, Phase 0, build/356 unit tests and all eight browser shards passed. Full Release Certification #38035840047 **failed 10/526 visual cases** (nine known images plus one `ERR_NO_BUFFER_SPACE` Windows navigation), final certificate skipped. No independent screenshot decisions recorded.
4. P1/P2 actual original-origin v1.2.5 schema-1→schema-3 migration, password-encrypted portable-v1 backup off-device restoration, two-tab/IME/quota/offline recovery and physical Android Chrome/Samsung Internet/TalkBack accessibility tests are human-only and not done.
5. Independent operator **merge**, separate **deploy** and separate **publication** signoffs are OPEN. A GitHub PR build or synthetic-merge archive is not an authenticated exact-main release certificate. Do not access live journals, clear IndexedDB, purge caches, publish, deploy or issue secrets.

## P18 — Independent Human Evidence Handoff & Certification Readiness

**Not started.** Objectives: operator-verified custody and checkpoint authority, authenticated artifact and human-review provenance continuity, physical Android/accessibility and original-origin migration acceptance packets, safe forward-compatible backup-recovery drill and a default-denied nondeploying release readiness handoff. No automatic release.
