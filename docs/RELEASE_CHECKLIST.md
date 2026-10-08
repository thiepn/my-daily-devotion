# Current release checklist — Morning Grace and recovery

This is an operational gate, not a historical assertion that every item has passed. Complete it for the exact proposed release commit and retain the resulting evidence in the integration PR. Merge, deployment and publication require explicit owner authorization.

Ship only from a commit whose complete hosted certification and manual visual review succeed. Local results support that decision; they do not substitute for it.

## Candidate and compatibility

- [ ] Review constituent PRs #12–#21 in the integration PR against `main`.
- [ ] Record the source commit, package version 1.3.0 and known discrepancies.
- [ ] Verify package, application and service-worker versions agree.
- [ ] Record the exact compatibility contracts: original presentation uses database v1; the approved recovery foundation/editor integration uses database v2; domain and ordinary portable backup format/schema remain v1. Do not treat a database downgrade as a safe rollback.
- [ ] Check the current editor coverage reports: Reflection, prayer capture, verse notes, prayer wording/updates/encouragement/ordinary answers, settings, Focused Prayer answers, Collections and People/Categories have dedicated integration slices. Verify the final directory-editor report and exact integrated certification before marking Batch B complete or promising restart recovery across every editor.
- [ ] Review old PRs #9–#11 for necessary scoped fixes; do not import their global navigation/CSS changes wholesale. Close superseded PRs only after approved integration.
- [ ] Inspect the canonical application crops, approved icon and current screenshots together using `docs/VISUAL_AUTHORITY.md`.

## Exact-commit certification

- [ ] Worktree is clean. Run `npm run verify:phase12` on Windows for complete local supporting evidence.
- [ ] Hosted Release Certification CI succeeds for the integrated commit. Its build job runs static/domain checks, inventories all cases and builds the production artifact once.
- [ ] All eight browser shards and the Windows image job pass without skips, failures or retries. Aggregation rejects missing coverage, stale reports and differing artifact hashes.
- [ ] Review Chromium, mobile, Firefox, WebKit and offline journeys, including cold cached Bible/search, explicit completion/prayed behavior and service-worker update handling.
- [ ] Review encrypted/plain backups, validation, reviewed merge/replace, rollback and fresh-install recovery.
- [ ] Inspect mobile widths 320/360/390/430, tablet/desktop, dark mode and 200% text. Passing baselines alone do not certify fidelity.
- [ ] Check keyboard/focus, 44px controls, contrast, safe areas, long content and unavailable-source/error states.
- [ ] Retain content-free test reports, SHA-256 package manifest, coverage inventory and visual discrepancy report.

## Explicit release actions

- [ ] Obtain authorization to merge. Re-run hosted certification on the resulting `main` commit; a PR merge ref is not the deployed commit.
- [ ] Obtain authorization to deploy. Manually dispatch **Deploy certified release** on that exact `main` commit with its successful certification run ID. Leave **publish_release** disabled unless publication is also authorized.
- [ ] Deployment validates the completed main run, archive checksum, every asset hash and build identity. It extracts the certified artifact without rebuilding.
- [ ] Verify deployed identity and every asset; retain deployment proof. A failed verification requires investigation and an explicit recovery decision.
- [ ] If publication is authorized, publish the immutable versioned package and current 1.3.0 notes. Existing version tags/releases must not be overwritten.
- [ ] Close superseded stack PRs only after successful approved integration, with a link to the integration PR.

## Operational limits

No automatic deployment on `main` push. The original 1.3.0 integration milestone was presentation-only; Search, Collections, Reading Plan and evening artwork were added in subsequent unmerged changes. Recovery introduces its separately approved migration and editor coverage. Record the contracts and behavior of the actual candidate rather than repeating historical limitations or claiming every editor is durable. Accounts, cloud services and sync remain outside the current offline candidate.
