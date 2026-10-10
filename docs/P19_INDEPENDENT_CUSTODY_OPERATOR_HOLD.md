# P19 — Independent Evidence Custody & Human Release Decision Integrity

**Status: preparation only; all release gates default DENIED.** This draft neither records genuine human signoff nor operates physical devices, merges, deploys, publishes, edits protected journals, moves DNS, clears IndexedDB, purges caches or provisions production keys.

## Implementation

- `scripts/p19/decision.mjs` takes the full P18 source and **recalculates the exact release ZIP bytes**, source/hash manifest, witnessed P17 dual-Ed25519/replay chain, original HTTPS origin/path and archived build identity. An independently supplied P19 operator decision may only be `HOLD_FOR_INDEPENDENT_REVIEW`. It binds the exact handoff SHA-256, archive SHA-256, source commit, source origin, fresh UUIDv4 nonce, prior externally kept ledger sequence and SHA-256 digest, a strict **twelve-gate OPEN/BLOCKED matrix**, issuance and expiry. Two separately pinned **distinct Ed25519 public keys** for release-operator and independent-evidence-auditor must each sign that identical payload. Bad key fingerprints, shared keys, replayed nonce, wrong source or digest, expired claims, changed gate states or any executable action fail closed.
- `scripts/p19/decision-cli.mjs` accepts a local evidence-only packet and an **independent release ZIP file**, never ZIP contents embedded in claimed JSON. Witness pins, operator pins, prior P17 witness/handoff/operator nonces, original custody root SHA, previous custody and operator ledger checkpoints must be sourced from **independent operator-controlled records** through environment. Self-reported pins or a self-supplied previous checkpoint do not constitute independent authority. Rejects private fields and symlinks, and caps input sizes.
- `scripts/p19/decision.check.mjs`: thirteen adversarial Node tests, with ephemeral fixture keys and real in-memory ZIP bytes, covering reviewer signature tampering, source substitution, PR artifact confusion, forgery of gate approval, distinct key independence, nonce/revision replay, stale operator history, altered ZIP bytes, no-op CLI and private-input redaction.
- Dedicated P19 CI runs Node tests with `contents: read` and no deployment, release, secret provision or publication steps. Existing mandatory certification tests, visual goldens and release workflows remain untouched.

## No machine-issued human permission

The valid signed HOLD record proves only payload integrity **under public keys supplied by the calling operator**. It does not establish production signing-key custody, independent human identity, current revocation status, genuine device operation, physical migration, or correctness of the original screenshots. A signed HOLD record is not a release certificate or a permanent append-only log. Its nonce and previous ledger sequence/digest must be registered and authenticated by a separately controlled operator registry. The CLI returns exit **3** when integrity checks match, **4** on rejection; it never returns exit 0 as permission. Every report explicitly sets releaseAuthorized, mergeAuthorized, deployAuthorized, publicationAuthorized and actionsPerformed to false.

## Offline use

    npm ci --ignore-scripts
    node --test scripts/p19/decision.check.mjs
    node scripts/p19/decision-cli.mjs hold /secure/p19-evidence.json /secure/my-daily-devotion-VERSION-web.zip EXACT_40_HEX_SHA CURRENT_ISO_TIME

Required independent environment values:
- MDD_EXTERNAL_WITNESS_PINS_JSON; MDD_PREVIOUS_WITNESS_NONCES_JSON; MDD_PREVIOUS_HANDOFF_NONCES_JSON
- MDD_TRUSTED_LEDGER_SEQUENCE; MDD_TRUSTED_LEDGER_DIGEST; MDD_MIN_TRUSTED_CUSTODY_REVISION; MDD_CUSTODY_ROOT_SHA256
- MDD_EXTERNAL_OPERATOR_PINS_JSON; MDD_PREVIOUS_OPERATOR_NONCES_JSON; MDD_OPERATOR_LEDGER_SEQUENCE; MDD_OPERATOR_LEDGER_DIGEST

Never put operator private keys, user journals, actual backup bytes, personal device identifiers, prayers or privileged auth tokens into GitHub evidence, audit packets or CI artifacts.

## Qualification blockers

- **P8 #53** remains unapproved: all nine original human visual decisions are open (eight quota warning screenshots plus removed-dialog). No golden or visual assertion edits are authorized.
- **P9** is unimplemented/unqualified. P10–P19 are **preparation-only stacked drafts** requiring qualified P9 and correct exact-head restacking/release certification.
- **P17 #61 / P18 #62** exact-head Release Certification both **FAILED**: all eight browser shards, builds and unit tests passed; ten Windows failures each (nine unapproved image differences plus one transient missing `<main>` after navigation in visual capture). Both final artifact certificates skipped. No production main certificate exists.
- **P1/P2** actual original-origin deployed v1.2.5 schema-1 to schema-3 migration, password-encrypted portable-v1 off-device backup restore and forward-compatible recovery must be conducted in disposable profiles by independent humans. Do not downgrade physical schema-3 journals, purge site data or silently change browser origin.
- Real Android Chrome, Samsung Internet, TalkBack, accessibility/IME, 200% text and physical PWA cold-start/recovery signoffs are OPEN. Distinct merge, deployment and publication operator approvals are OPEN. No actual approval or release has been performed.

## Operator hold and escalation

Where a trust anchor, custody revision, previous nonce registry, exact artifact, image-specific review, origin, encrypted backup, physical device or human authorization is absent, **remain on HOLD**. Independently reconcile the source and local SHA-256 with certified-main GitHub API and actual archive; visually inspect every P8 diff; perform actual device/accessibility/migration acceptance and a non-destructive forward recovery trial. Record human reviews in a separate protected registry. Do not auto-complete an approval based on this code.

## Next P20 — Independent Release Evidence Attestation & Operations Escalation

**Not started.** Objectives: genuinely independently retained custody/rotation/replay evidence and immutable source artifacts, verified human device/migration/accessibility review handoff, safe forward-only rollback escalation, and a formally protected operator decision boundary. Publication remains disabled by default.
