# P21 — Independent Human Evidence Custody & Nondeploying Closure Review

**State: PREPARATION ONLY / NO_GO.** No physical Android or accessibility checks, original-origin migration/backup restore, production signer rotation, real owner approvals, merge, deployment, publication, DNS, storage, cache or protected journal actions have been performed.

## Actual source work

- `scripts/p21/evidence.mjs`: Recalculates the P20 three-party rotation intent, signed P19 operator HOLD, witnessed P17/P18 exact-source and ZIP-byte evidence. Strict PWA **original HTTPS origin and exact path**, service-worker script origin/scope, SHA-256 refs for PWA manifest and SW, rights/source/host and CDN intake. Source rights, CDN rights, actual physical Android Chrome/Samsung Internet/TalkBack/keyboard/contrast and encrypted-backup claims are only **PENDING / REVIEW_REQUESTED / REJECTED**, never approved. Hashes must match the appropriate exact-source signed reviewer receipt. No private journal text, credentials, personal device IDs or arbitrary metadata fields allowed.
- `scripts/p21/evidence.mjs` forward-only recovery packet identifies a **different previous-stable SHA + archive digest**, limits test execution to **disposable profiles**, requires signed encrypted off-device portable-v1 backup receipt, installed schema >= 3, target schema >= installed schema, and explicitly forbids clearing IndexedDB, purging caches, modifying live records or attempting a schema downgrade. It does NOT perform restore or validate prior-stable content on actual devices. P1/P2 real original-origin schema-1→3 migration and off-device restore must be independently performed and inspected.
- `scripts/p21/owner-closure.mjs`: Two distinct **Ed25519 pinned public keys and identities** verify an exact-source, immutable archive and host evidence binding for a **PRE_CUTOVER_HOLD** and subsequent **POST_RELEASE_NOT_EXECUTED** record. Both are chronologically chained to an **externally retained** prior operator ledger sequence + digest, with separate, replay-checked UUIDv4 nonces, time limits and signature checks. No record may say an actual postrelease event occurred. This software verifies signatures under supplied public pins only; never proves actual independent human identity or authorizes a real-world decision.
- `scripts/p21/closure-cli.mjs`: read-only offline inspector. Actual immutable release ZIP is an independent file; original-source, witness, operator, rotation, previous ledger/revocation/nonce history and owner signer keys are provided **out of band** via trusted environment values. The CLI never reads live journals, contacts deployment providers or creates a signer. Exit **3** for structural/signed checks with release still denied, **4** on invalid data; it never exits 0 as authorization. Error output is generic and does not leak submitted values or paths.
- `scripts/p21/closure.check.mjs`: adversarial tests with synthetic, ephemeral Ed25519 keys and actual ZIP bytes, including origin/PWA path/scope, rights/CDN provenance, physical evidence, backup restore, forward-only schema recovery, owner stage ordering, signing pin substitution, stale chronology/nonces, privacy-safe CLI rejection.
- Dedicated P21 CI has repository **contents: read** only and no release/upload/production operation. Existing full Release Certification, screenshot goldens and thresholds are untouched.

## Human and predecessor blockers, all OPEN

1. **P8 #53** at `3d1b4be19f03301dcd4fa86b11aac0e68a92229c`: zero independent reviewer submissions. All nine originally unapproved image-specific decisions (eight quota warnings and removed-dialog.png) require qualified human inspection. No baseline update authorized.
2. **P9** origin/signer/recovery platform infrastructure missing/unqualified. P10–P21 are preparatory stacked drafts, requiring a qualified P9 head, correct restacking and green exact-head full CI before any production integration review.
3. **P20 #64** at `58abf2593153986bc2da781ec828a801b3bdf827`: dedicated 14/14 and Phase 0 successful, build/unit 356/356, 8/8 browser shards, full Release CI #38062179520 **FAILED** on original nine Windows visual differences (517/526); final artifact certification skipped. P19 #63 also failed nine; P17/18 failed nine plus transient visual navigation missing `main`. No justified source-baseline changes.
4. P1/P2 actual original deployed-origin schema1→schema3 migration, original IndexedDB continuity, two-tab interruptions and password-encrypted portable-v1 **off-device** backup restoration remain untested by independent humans. A new origin loses access to existing local IndexedDB.
5. Real Android Chrome/Samsung Internet/installed PWA/TalkBack/IME/keyboard/contrast/200%-text acceptance, original rights/CDN review, independently authenticated witness/signer custody and distinct explicit human **merge / deploy / publish** approvals remain absent.
6. Matching source/ZIP hashes and signatures under **operator-supplied pins** do not prove independent key custody, physically operated devices, genuine prior-stable restoration, actual human signoffs, or a certified production-main artifact.

## Offline review; no live operations

    npm ci --ignore-scripts
    node --test scripts/p21/closure.check.mjs
    node scripts/p21/closure-cli.mjs review /secure/p21-review.json /secure/exact-release.zip EXACT_40_HEX_SHA CURRENT_ISO_TIME

Requires the same separately retained P17/P19/P20 source and anti-replay environment records, plus `MDD_P21_EXTERNAL_OWNER_PINS_JSON`, `MDD_P21_OWNER_LEDGER_SEQUENCE`, `MDD_P21_OWNER_LEDGER_DIGEST` and `MDD_P21_PREVIOUS_OWNER_NONCES_JSON`. Never take these from the submitted packet. The output is **NO_GO**, not a release certificate.

On mismatch, damaged ZIP, stale root/revocation or failing original-host tests: stop; preserve original IndexedDB and encrypted off-device backups, do not downgrade physical schema 3, purge caches, migrate, deploy or merge.

## P22 — Original-Host Acceptance Evidence & Independent Release Decision Isolation

**NOT STARTED.** Objectives: authentic independently sourced original-host source-rights/CDN/PWA and physical device evidence, previously stable safe recovery proofs, protected human witness escalation and distinct owner-controlled *precutover vs postrelease* decision reconciliation. All real gates stay denied until independently performed and authorized.
