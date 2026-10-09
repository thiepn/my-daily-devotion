# P11 — Audited Release Handoff & Post-Release Monitoring Preparation

**Status:** draft preparation on top of P10's exact head, **not** a release, staging deployment, merge authorization or independent audit. P8 visual certification remains blocked; P9 remains unqualified; P10 acceptance is preparatory. No site was contacted or user record processed.

## What is implemented

- A **pending-only** handoff bundle tied to one exact 40-character Git SHA and a known existing HTTPS origin **and path**. An arbitrary new subdomain is not accepted as the original browser storage origin.
- Strict metadata checks for the immutable \`my-daily-devotion-VERSION-web.zip\` SHA-256 digest, file checksum inventory, build-info and index assets, physical database schema 3 and exact candidate SHA. These are **claims** until the certified artifact is independently fetched and checked.
- Exact-main CI certification fields must claim \`Release Certification CI\` complete/success on \`main\` from a \`push\` or \`workflow_dispatch\`, never a pull-request synthetic merge. The certification claim MUST refer to the same source SHA and archive digest. The existing deployment workflow has its own authoritative GitHub API validation and **must remain the actual authority**.
- Unsigned human reviewer evidence intake: known P10 gate ID, exact SHA, plain reviewer handle, timestamp, HTTPS evidence reference and explicit accept/reject. Missing/duplicate/unknown claims are rejected. A reviewer entry is **not authenticated or approved merely because JSON claims it is**.
- Read-only **post-release observation parser**: supplied observation must match original HTTPS site/path, exact build-info source/version, service-worker \`sw.js\` script/scope and **all** manifest file SHA-256 entries. This does not perform live network requests, upload telemetry, or claim human/device verification.
- Fail-closed CLI: \`assess\` returns **2** for incomplete metadata and **3** for fully claimed metadata; **never 0**, including when every unsigned review claims success. Invalid private/secret-bearing input returns generic exit **4** without logging data.

## Safe local use

Only create the bundle after the actual original site URL/path is known. Do not replace it with the desired future public domain.

~~~sh
node --test scripts/p11/handoff.check.mjs
node scripts/p11/handoff-cli.mjs template EXACT_40_HEX_SHA https://EXISTING_ORIGIN/EXISTING_PATH/ /private/p11-handoff.json
node scripts/p11/handoff-cli.mjs assess /private/p11-handoff.json EXACT_40_HEX_SHA
~~~

The template is created once with requested mode 0600 and starts with **all gates pending**. Store metadata/evidence references in an access-controlled location; no personal journal content, decrypted backup, image of private prayer, recovery key, account token, IP-address-based identifier or physical device identifier may enter the ledger. No unsigned metadata may issue an automation action.

## Human-owned acceptance (not performed)

1. Independently qualify P8's 8 storage-pressure screenshot differences and removed-dialog positioning; preserve strict Windows raster comparisons. See [visual request](https://github.com/thiepn/my-daily-devotion/pull/53#issuecomment-6089475907).
2. Complete P9 provenance/scope/rollback infrastructure with its **own** exact-head CI, then rebase/restack P10 and P11 onto the qualified chain. No earlier-head artifact is transferable across head changes.
3. Complete P1 existing-origin v1.2.5 schema-1 to schema-3 migration in **disposable** real browser profiles; confirm untouched off-device encrypted portable-v1 backup and restore on a clean compatible profile; test interrupted upgrade, two tabs, cold reload and storage limits.
4. Independently verify physical Android Chrome and Samsung Internet PWA/background/IME/offline/low-memory and human TalkBack/keyboard/contrast/200% text; collect private-data-free screenshots or evidence only.
5. Obtain independent **merge authorization**, then a distinct human **deployment authorization**. Main must pass exact-SHA release certification with a retained \`mdd-certified-release\` artifact, not a synthetic PR artifact. Existing production deployment workflow is **manual only**, with safe current Pages origin/path confirmed and publication disabled by default.
6. After authorized deploy, fetch the existing origin **read-only**, verify the original path, correct source SHA, all bytes against the certified archive, HTTPS/CSP, SW scope, offline cold boot and device data continuity. Non-sensitive structured observations can be inspected offline by the P11 validator. Do not claim this has occurred.

## Forward-only recovery and rollback

Physical IndexedDB schema 3 is **not downgradable** to published v1.2.5 schema 1 by deploying old code. On deployment mismatch, stop publication, preserve evidence and the original origin and app data, identify a **compatible** forward fix, and rehearse import of the verified password-encrypted portable-v1 backup in a fresh compatible profile. Do not delete site data, reset IndexedDB, perform cache purges, redirect old origins, restore unverified binaries, downgrade journal schema or expose real user backups. No live rollback action is included in these tools.

## Monitoring preparations (no monitoring yet)

A future authorized check may compare only HTTPS status, source SHA/version, static asset digests, service-worker script/scope and coarse service availability. Do not collect prayers, devotion history, written reflections, IP/user/device IDs, per-user events or backup contents. Preserve explicit human escalation on checksum mismatch, stale SW generation, unsafe origin move or schema incompatibility; no automatic destructive rollback.

## Current blockers and integration

- **P8 #53**: exact head \`3d1b4be\` is not certified, 9 Windows visuals unapproved.
- **P9**: not implemented or qualified.
- **P10 #54**: acceptance ledger is an unsigned preparation, not owner acceptance or release authorization; this P11 draft stacks on it.
- **P1 #46 / P2 #47**: existing-origin migration, encrypted backup, owner approval and physical Android human acceptance remain independent.

No merge/deploy/DNS changes/user data access/cache purge/real credentials/physical-device signoffs occurred.

**Following P12 — Release Candidate Integration & Operations Evidence Review**: not started; dependent on separately qualified P8–P11 and independent human acceptance. Objectives: final exact-main artifact integrity, approved release runbook, recovery rehearsal, audited operator decisions, and non-sensitive health evidence. No release without explicit authorization.
