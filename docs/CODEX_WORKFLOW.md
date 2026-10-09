# Codex development workflow — MDD after P0

This is the working contract for future MDD branches. Start from the [frozen P0 baseline](RELEASE_BASELINE_2026-10-09.md), then fetch **current** `main` before working.

## One base branch, one scoped PR

1. Fetch the latest `origin/main`; create a new branch such as `codex/p1-journal-migration-audit`. Never continue the pre-integration chains as new PR bases.
2. Keep a PR limited to one defined phase/slice. Its target is `main` unless a *new* explicitly reviewed stacked dependency is unavoidable and documented.
3. Do **not** merge or resurrect historical PRs #13–#40. Their ancestor-contained work was integrated through PRs #41–#44. Five divergent PRs #9/#10/#11/#31/#35 need deliberate diff triage, not unconditional cherry-picking.
4. Do not delete any historical branches as part of housekeeping; no force pushes to active Codex work. Closed PR discussions remain accessible.
5. Preserve the current Morning Grace visual authority and `Read → Reflect → Pray → Remember` product scope; no generic dashboards, streak mechanics, feed or auto-created devotion events.

## Acceptance evidence required in each PR

- Short problem statement, user impact, files affected and non-goals.
- Exact source SHA, base SHA and clear compatibility impact: physical database version, domain contract, ordinary backup version, optional recovery payload, origin and service worker.
- Tests for normal flows **and** destructive/interrupted/stale/multi-tab flows where data is touched.
- Screenshot/review of actual UI (320/360/390/430/768/1440px, dark mode, 200% text as applicable), accessibility and performance impact; never update an image baseline without inspecting the difference.
- `npm run verify:phase12` or hosted `Release Certification CI` on the exact candidate, with unit, eight browser shards, Windows visual comparisons, and artifact/package evidence.
- Outstanding manual device, screen-reader and migration tests labeled **pending**, not passed.

## Promotion sequence

`Feature branch → reviewed PR to main → exact main CI → P1 data-integrity gate → explicit deploy authorization → manually dispatch Deploy certified release → inspect deployed identity/hashes.`

Do not assume that source merge, `package.json` version 1.3.0, or certification means deployment. `.github/workflows/deploy.yml` deploys **only** a previously certified run on current `main` and has an independent optional `publish_release` switch.

## Data safety

- Current storage: physical schema 3, domain and ordinary portable backup contracts 1. New schema/protocol changes need isolated migration review and old-backup compatibility.
- Ordinary portable archives exclude private drafts, previous saved versions and recently removed content. Never add these silently to v1. Recovery-inclusive archives must be explicit and separately versioned.
- Keep the site's current origin until there is a reviewed old-origin handoff: redirects do not transfer IndexedDB.
- Do not enable cloud upload merely because a user signs in; connected journal sync requires a separate explicit consent step and reviewed encryption design.
