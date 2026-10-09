# P10 — Integrated Release Acceptance and Evidence Closure

**Status:** acceptance tooling only, stacked on P8. P8's nine visual differences are not approved, P9 infrastructure is not qualified, and no live release authorization exists. This is not a release certificate, a merge approval or a device signoff.

## Scope

P10 inventories automated and human-only release checks against an exact 40-character source commit SHA, with a strict existing HTTPS origin and path. The evidence ledger is intentionally pending-only at creation. The validator rejects missing/duplicated gates, stale SHAs, pass claims without evidence URLs, human pass claims without reviewer/timestamp, and unrecognized fields that could leak personal devotional contents. It never discloses reviewer IDs/evidence URLs in its report.

**Important trust boundary:** the ledger contains *claims*, not signed/authenticated evidence. Even a ledger reporting all gates as passed always returns \`independentlyVerified: false\` and \`releaseAuthorized: false\`. This tool never calls deployment and is not a substitute for GitHub's exact-SHA certification or independent owner authorization.

## Mandatory acceptance work

1. **P8:** independent decisions on the eight quota-warning visual images and the separate \`removed-dialog.png\`; requalify Windows screenshot, all browser shards, build and exact-release archive on the resulting SHA. See [review request](https://github.com/thiepn/my-daily-devotion/pull/53#issuecomment-6089475907) and [scroll trace](https://github.com/thiepn/my-daily-devotion/pull/53#issuecomment-6089837701). Neither comment grants approval.
2. **P9:** qualify release provenance, original-origin/scope, rollback and privacy-safe operational diagnostics on an integrated exact head. The P10 draft does not implement P9.
3. **P1 existing-origin migration:** on a *disposable* local profile, upgrade the real deployed v1.2.5 schema-1 data to schema 3. Compare original IDs, texts, dates, revisions, deletions, prayer/reader states across close/reload. Test aborted upgrades, multi-tab block, storage limits and backup-based recovery.
4. **P1 encrypted backup:** verify password-encrypted portable-v1 backup outside the browser and restore on a fresh profile; ordinary portable-v1 deliberately excludes private drafts, saved writing versions and recently removed copies. No raw archive, password or private text in CI artifacts.
5. **P2 origin:** compare actual old HTTPS origin **and exact app path** with proposed deployment; do not assume a desired new domain is the original app origin. Redirects do not migrate IndexedDB. Do not clear site data or silently downgrade schema 3 to a v1 runtime.
6. **Device tests:** human-operated *physical* Android Chrome and Samsung Internet (PWA and browser tab): offline cold boot, background/low-memory resume, IME/keyboard, quota, updates, install, two-tab schema change. Emulation is not equivalent.
7. **Accessibility:** human TalkBack/focus/reduced-motion/keyboard/200% text/contrast/dark-mode/landscape acceptance; axe and Playwright remain automated supplements.
8. **Independent authorization:** a separate owner approval for merging and a distinct one for deploying the certified exact \`main\` SHA and existing origin. The manually dispatched existing workflow must use the successful *current main* certification archive, not a PR synthetic merge build, and publication requires another explicit decision.

## Run locally, without claiming certification

Use the actual verified old site URL, including path, **not** the aspirational new domain.

~~~sh
node --test scripts/p10/acceptance.check.mjs
node scripts/p10/acceptance-cli.mjs template <40-hex-SHA> https://CURRENT_ORIGIN/CURRENT_PATH/ https://CURRENT_ORIGIN/CURRENT_PATH/ /secure/location/p10-ledger.json
node scripts/p10/acceptance-cli.mjs assess /secure/location/p10-ledger.json <40-hex-SHA>
~~~

The template is created exclusively (no overwrite) with requested mode 0600 and 14 pending gates. Assessment returns code 2 for any unpassed gate and code 3 for even a completely self-reported passing ledger; **it never exits successfully as a release gate**. Only HTTPS links without fragments, credentials or token-bearing queries may be used as evidence references. Neither browser personal data, journal text, phone numbers, passwords, backup bytes nor privileged release credentials belong in the ledger. Store nonprivate device/platform metadata in separate controlled evidence.

## Qualification boundaries and integration

- P1 PR #46 and P2 PR #47 remain independent; do not assert manual acceptance from simulated tests.
- P8 PR #53 at \`3d1b4be19f03301dcd4fa86b11aac0e68a92229c\` is unqualified due to nine screenshots. No P9 branch has passed certification.
- P10 preparation is based on P8 only. After P9 is complete, **restack P10 on the exact qualified P9 head**, rerun all mandatory jobs and submit the independent human evidence.
- No merge, deployment, DNS change, application data migration, deletion or live-origin mutation occurs in this P10 preparation.

**Following phase: P11 — Audited Release Handoff & Post-Release Monitoring Preparation.** Not started. Objectives: independently verified acceptance bundle, exact-artifact deployment runbook, safe recovery escalations, non-sensitive diagnostics and post-deployment asset/integrity verification after explicit authorization.
