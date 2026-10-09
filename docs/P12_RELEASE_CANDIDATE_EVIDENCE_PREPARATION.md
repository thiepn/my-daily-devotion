# P12 — Release Candidate Integration & Operations Evidence Review

**Status:** preparation-only stacked draft on P11, **NOT an integrated release candidate**. The inherited P8 visuals remain unapproved; P9 has not been implemented/qualified; P10/P11 full certification failed on inherited visual differences. This phase introduces **no** merge, deploy, publish, origin migration, live health polling, cache purge, backup mutation or fabricated human signoff.

## Why this is distinct from P10/P11

- **P10** inventories 14 mechanical/human approval *claims* against an exact source SHA; all signoff is independently required.
- **P11** validates the structure of release handoff, main-branch certification **metadata claims**, and post-release observations, but does not fetch authenticated CI data or verify actual archive bytes.
- **P12** validates **actual offline release ZIP bytes** against \`release-manifest.json\`, \`SHA256SUMS\`, \`deployment-hashes.json\`, \`verification-summary.json\` and \`build-evidence.json\`. It imports the existing production archive verifier, checks that each entry is rooted under \`my-daily-devotion/\`, rejects noncanonical asset paths, verifies all file SHA-256 hashes, matches \`build-info.json\` source SHA/version, and recomputes the certified build's SHA-256 manifest digest. This adds independent *local artifact byte integrity*, not provenance authentication or signoff.
- Optionally correlate a P11 unsigned handoff to the **same real archive**. Forged/mismatched SHA, manifest version, schema, file inventory, or stale gate claims fail. No JSON can authorize deployment.

## Input and use

The tool is **offline/read-only** and consumes exactly the files already emitted by the existing successful \`mdd-certified-release\` archive after extraction into an access-controlled folder. It does not download artifacts or use GitHub credentials. Do **not** substitute a failed P8/P10/P11 build artifact for the missing certified release.

Required sibling files:

- \`release-manifest.json\`, \`SHA256SUMS\`, \`deployment-hashes.json\`
- \`verification-summary.json\`, \`build-evidence.json\`
- The exact ZIP file named by the manifest, \`my-daily-devotion-VERSION-web.zip\`

Optional \`p11-handoff.json\` contains only unsigned, privacy-safe reviewer-claim metadata. No private journal content, encrypted backup files, passwords, prayer text or identifiable device telemetry may be placed here. File paths are fixed, checked against symlinks, and archive size is bounded. Unexpected invalid content yields a generic message, not raw source records.

Run locally:

~~~sh
npm ci --ignore-scripts
node --test scripts/p12/candidate.check.mjs
node scripts/p12/candidate-cli.mjs /secure/certified-release/ EXACT_40_HEX_MAIN_SHA
~~~

Exit codes: **3** for locally verified bytes which *still cannot authorize a release*, **4** for missing, unsafe, inconsistent or invalid evidence. There is **no exit-0 release-success path**, no deployment/network action and no logs of reviewer IDs/evidence URLs. An optional P11 handoff does not change this.

An offline byte match does not prove GitHub CI result authenticity. Before considering deployment, an authorized operator must independently fetch the GitHub Actions run via the API and compare \`head_sha\`, \`head_branch=main\`, \`event\`, \`name\`, \`conclusion=success\`, job inventory and certified artifact IDs. Merely supplying a JSON run object is not enough. Existing \`scripts/deploy-certified.mjs\` retains independent enforced checks.

## Human and predecessor gating

1. Obtain independent P8 judgment on **all eight quota banners and the separate removed-dialog screenshot**; do not replace goldens or change pixel thresholds without review. Requalify the resulting exact SHA and final release artifact certificate.
2. Implement and qualify missing P9 provenance, origin/scope and rollback controls, then restack P10/P11/P12 on the exact qualified predecessor head. The current P12 stack deliberately skips P9 as **preparation only**.
3. Complete P1/P2 existing **original-origin** disposable-profile v1.2.5 schema 1 → schema 3 migration, two-tab/interrupt/quota/reload, tested password-encrypted off-device portable-v1 backup and fresh-profile restore; record independent signoff. Redirects do not migrate IndexedDB.
4. Obtain real Android Chrome/Samsung Internet PWA cold-start/update, IME/keyboard, storage-pressure and backgrounding evidence, and human TalkBack, focus, contrast and 200% text acceptance.
5. Only after exact-main full CI and an authenticated \`mdd-certified-release\` artifact, obtain **separate merge, production deployment and release publication approvals**. Do not create any success attestations automatically.

## Recovery and post-release scope

An on-device schema-3 IndexedDB database cannot safely be downgraded by reverting the website to the published schema-1 runtime. A failure requires **forward-compatible code or verified password-encrypted portable-v1 recovery in a fresh compatible browser profile**. Preserve the original web origin and journal. Do not clear site data, silently redirect, overwrite a user's sole backup, purge caches, or run a destructive automated rollback.

Future privacy-safe operational observation, when authorized, is limited to static source SHA/version, HTTPS origin/path, service-worker registration scope, immutable asset hashes and coarse availability. No per-user diagnostics, IP/device identifiers, personal prayer/history content or backup bytes. No post-release probe or physical device test is claimed here.

## Current qualifications

- P8 draft #53 at \`3d1b4be19f03301dcd4fa86b11aac0e68a92229c\`: nine unapproved image differences, no final certificate.
- P9: **not started**.
- P10 draft #54 at \`8245008ae3272366a11e32b106fa47f8c4b80619\`: 12/12 preparation tests, Phase 0 and production build passed; full Release Certification **failed** on inherited nine Windows visual failures; WebKit was cancelled.
- P11 draft #55 at \`014deabb5aaefd4735aa9a2f0da9478dd97fb274\`: 12/12 preparation tests, Phase 0, production build and eight browser shards passed; full Release Certification **failed** on eight inherited storage visual differences, removed-dialog, and transient \`ERR_NO_BUFFER_SPACE\` on a Windows navigation; certificate skipped.

**Following P13 — Evidence Authenticity & Reviewer Closure Preparation:** not started. Objectives: repository-linked immutable CI artifact identity and checksum reconciliation, replay-resistant reviewer evidence receipts, physical-device evidence intake and human-operated readiness/rollback escalation. No signoff or publication can be inferred from this future tooling.
