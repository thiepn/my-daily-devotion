# P23 — Independent External Reviewer & Release Custody Reconciliation

**Preparation only — NO_GO.** P23 does not create authenticated reviewer identities, independently operated ledgers, real rights approvals, physical device observations, release credentials, a recovery operation, or a launch decision.

## Implemented controls

- `scripts/p23/external-review.mjs` recomputes P22's **real immutable release ZIP** and all inherited signed original-host/rights/PWA, P21 owner NO-GO, P20 rotation, and P19/18/17 custody chains. Source rights, CDN and PWA object review attestations must match **specific P22 escrow material SHA-256**. Physical Android Chrome/Samsung Internet/TalkBack/accessibility reviews can refer only to source- and receipt-bound evidence already in P22; previous-stable encrypted recovery can refer only to an existing signed previous-stable packet. Nothing fabricates an absent source object, device, backup or reviewer. All claims are `REVIEW_PENDING` or `REJECTED`, never approval.
- Each detached attestation is signed under **three independently supplied, distinct Ed25519 reviewer public keys** with source-specific roles (rights provenance, physical accessibility, encrypted recovery). Rejects revoked reviewer identifiers, prior key revisions below an externally held minimum, key substitutions, wrong subject permissions, signature tampering, expired/old source, reused UUIDv4 nonces, incorrect previous sequence/digest and out-of-order records. Receipt digests form a domain-separated chain rooted in **externally provided** sequence/digest, not in the submitted evidence itself.
- `scripts/p23/multi-operator.mjs` accepts only a **NO_GO_EVIDENCE_HOLD_NO_WRITE** request signed by separately pinned, distinct source-operations and independent-recovery keys, binding immutable artifact, exact source and complete P22/P23 reviewer digest. Independently retained prior operator sequence/digest and nonce histories must match. Any supplied external observation of a second proposal on the same ledger slot, or reuse of a nonce, **blocks** the handoff rather than treating an in-process check as an atomic compare-and-swap. No registry write is performed and no machine approval is issued. A lack of observed contention does **not** prove an actual off-Git ledger transaction completed.
- `scripts/p23/reconcile-cli.mjs` reads bounded local metadata and a **separate original ZIP byte file**, requires out-of-band P17–P22 trust keys and replay inventories, plus P23 reviewer/owner pins, revocation IDs, revision floor, previous reviewer/actor checkpoint and externally sourced contention observations. Trust values in the submitted bundle are not accepted. Valid-but-unapproved output exits **3**; invalid/missing proof exits **4**, with redacted diagnostics. There is no release-success exit code 0.
- Dedicated P23 read-only GitHub Actions workflow and adversarial `node:test` regression suite. No mandatory release CI, screenshot golden, production code, DNS, OAuth/account, production secrets, service-worker deployment, IndexedDB or encrypted journal data changed.

### Trust limitations and human boundaries

The code checks cryptographic consistency **under supplied pins**. It does not authenticate the actual legal source-rights holder, whether external keys are independently governed, whether a person physically operated Samsung Internet/TalkBack, whether previous-stable backup restoration occurred, whether signer revocation reached a live verifier, or whether an off-Git contention registry is actually append-only. These are **explicitly not verified** in reports. Suspicious or compromised signer custody requires independent human suspension and new trusted root attestation; a signature by a compromised key is not proof of safe rotation.

P8 #53 still has zero independent human decisions for its nine original screenshot differences. P9 remains unimplemented/unqualified and P10–P23 are preparation-only stacked drafts requiring proper P9 completion, restacking and exact-head full Release Certification. P22 #66 passed 15/15 dedicated and Phase0 and its 356/356 unit/eight browser shards, but full CI **failed 9 unapproved Windows visual screenshots**, skipping final certification. P21/P20/P19 likewise failed the same nine; P17/P18 additionally had intermittent visual navigation failures. Goldens and all gates remain unchanged.

P1/P2 real original-origin schema1→schema3 migration and encrypted portable-v1 off-device restore, source/object/CDN license approval, physical Android Chrome/Samsung Internet/TalkBack/keyboard/200%-text, authenticated signer custody, and separate **merge, deploy, publish** human authority are OPEN. Do not access protected journals, clear app/site data, downgrade schema 3, purge caches, deploy or publish.

### Operator use (local evidence only)

    npm ci --ignore-scripts
    node --test scripts/p23/reconcile.check.mjs
    node scripts/p23/reconcile-cli.mjs review /secure/p23-claims.json /secure/release.zip EXACT_40_HEX_SHA CURRENT_ISO_TIME

In addition to P22's independently retained environment keys and histories, require `MDD_P23_EXTERNAL_REVIEWER_PINS_JSON`, `MDD_P23_EXTERNAL_REVOKED_REVIEWERS_JSON`, `MDD_P23_MIN_TRUSTED_REVIEWER_REVISION`, `MDD_P23_PREVIOUS_REVIEW_SEQUENCE`, `MDD_P23_PREVIOUS_REVIEW_DIGEST`, `MDD_P23_PREVIOUS_REVIEW_NONCES_JSON`, `MDD_P23_EXTERNAL_OPERATOR_PINS_JSON`, `MDD_P23_PREVIOUS_OPERATOR_SEQUENCE`, `MDD_P23_PREVIOUS_OPERATOR_DIGEST`, `MDD_P23_PREVIOUS_OPERATOR_NONCES_JSON` and `MDD_P23_EXTERNAL_CONTENTION_OBSERVATIONS_JSON`. Never copy them from the submitted claim packet.

## P24 — Independent Off-Git Custody Witness & Original Acceptance Gate Reconciliation

**Not started.** Objectives: source/object/rights/CDN and physical-device original evidence owner custody; independent live replay witness and signer compromise/revocation-state reconciliation; original-site backup and prior-stable recovery proof; isolated pre-cutover and postrelease human decisions. Default **NO_GO**; no merge, deployment or publication.
