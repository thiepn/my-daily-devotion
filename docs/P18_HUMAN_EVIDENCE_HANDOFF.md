# P18 — Independent Human Evidence Handoff & Certification Readiness

**Status: evidence-only preparation. Never merge, deploy, publish, purge caches, mutate original-site data, create credentials or claim human acceptance from a synthetic test.**

## Scope implemented

- `scripts/p18/handoff.mjs`: recomputes the SHA-256 of the **actual supplied release ZIP** using P12's archive verifier and verifies all manifest, build evidence, exact source SHA, build-info identity, file checksums, strict archive entry names and verification summary. This is distinct from a GitHub artifact outer-ZIP digest or a claimed JSON SHA. It also rechecks P17's dual independently pinned witness signatures, revocation floor, hash-linked exact-head reviewer receipts, original-origin and protected encrypted-backup recovery constraints, and refuses if the P17-reviewed SHA-256 differs from the **actual immutable archive**. When supplied, P13 verifies the required eleven successful `main` workflow jobs and unique nonexpired certified-release artifact, tied to the run and artifact IDs in the P17 review packet. GitHub metadata passed as JSON cannot by itself prove that it was freshly retrieved from GitHub by an independent operator.
- `scripts/p18/handoff-cli.mjs`: read-only **offline** source/material handoff, with ZIP supplied as a separate file, size/symlink checks, no arbitrary internet URLs or release actions. It requires two **external** witness pins and previously used witness nonces; prior handoff nonces, original custody root fingerprint, previous ledger digest/sequence and minimum custody revision must be supplied from operator-owned records through environment variables, **not** from the handoff or reviewer JSON. A newly created handoff digest binds source SHA, original origin/path, custody revision, receipt count, exact checked ZIP digest, version and one fresh handoff nonce. A new handoff digest cannot authenticate itself without a trusted external retention register.
- `scripts/p18/handoff.check.mjs`: uses ephemeral fixture keys and *real in-memory ZIP bytes*, including tampered entry bytes, forged source, changed reviewed archive, replayed handoff nonce, wrong external witness and custody floors, origin/rollback changes, false release-authorized claims, PR artifacts vs main, untrusted GitHub jobs, safe CLI output and rejecting private evidence metadata.
- Mandatory existing Release Certification CI remains unchanged. The new preparation CI has read-only repository permissions and no deployment steps.

## Offline use (never an authorization action)

    npm ci --ignore-scripts
    node --test scripts/p18/handoff.check.mjs
    node scripts/p18/handoff-cli.mjs inspect /secure/handoff.json /secure/my-daily-devotion-VERSION-web.zip EXACT_MAIN_SOURCE_SHA CURRENT_ISO_TIME

The JSON has only `handoff`, `closureInput`, `candidateInput`, optionally `githubEvidence`. Omit `releaseArchive` from `candidateInput` JSON: actual ZIP bytes are read from the separate file. Never include backup bytes, private devotional entries, reviewer private identities, IP or physical-device IDs. All external trust values are independently sourced by the operator:

- `MDD_EXTERNAL_WITNESS_PINS_JSON`
- `MDD_PREVIOUS_WITNESS_NONCES_JSON`
- `MDD_PREVIOUS_HANDOFF_NONCES_JSON`
- `MDD_TRUSTED_LEDGER_SEQUENCE`
- `MDD_TRUSTED_LEDGER_DIGEST`
- `MDD_MIN_TRUSTED_CUSTODY_REVISION`
- `MDD_CUSTODY_ROOT_SHA256`

Exit 3 means only source/byte/signature **structural checks** are consistent; exit 4 means blocked. There is no release-success exit code 0. Every successful result explicitly states `releaseAuthorized=false`, `deployAuthorized=false`, `publicationAuthorized=false`, no performed actions and no independent physical-device or human acceptance. The actual GitHub API and physical site must be independently inspected by authorized owners.

## Blocked prerequisites (do not infer approvals)

- P8 #53 still lacks independent decisions for nine originally changed screenshot baselines: eight full-quota warnings and `removed-dialog.png`. No golden updates or assertion relaxation.
- P9 has not been implemented or qualified; P10–P18 are **separate preparation-only stacked draft branches** pending correct restacking after all predecessors qualify.
- P17 PR #61 at last known `ffd8fced97f7401217f083c64c08d9290662c6bb`: P17 dedicated 14/14 and Phase 0 successful; inherited release CI 38053362479 was still running when P18 started, and no final certified release was available. P16 predecessor had 356/356 unit, 8/8 browser and 15/15 dedicated tests passing but full CI failed nine inherited visual diffs plus Windows `ERR_NO_BUFFER_SPACE`, skipping final certification.
- P1/P2 original deployed origin v1.2.5 schema1→schema3 migration, independent encrypted off-device portable-v1 backup/restore in disposable profile, PWA scope and safe interrupted forward recovery are not human-accepted.
- Physical Android Chrome/Samsung Internet/TalkBack/IME/accessibility and distinct independent merge/deploy/publication approvals remain OPEN.

## Operator-only forward recovery

On missing SHA, altered archive, stale service worker/origin, unverified screenshot, incompatible schema or unapproved device evidence, **stop**; preserve original origin and user data, retain encrypted off-device backups, and use only independently tested forward-compatible fixes or restore in fresh compatible disposable browser profiles. Never clear IndexedDB, downgrade schema 3 to schema 1, purge caches, move the origin, merge, deploy or publish automatically.

**Next P19 — Independent Evidence Custody & Human Release Decision Integrity** (not started): authenticated external checkpoint retention, independently sourced real-device/origin-migration acceptance, signed human decision provenance and final operator-only default-denied release handoff. No automatic publication.
