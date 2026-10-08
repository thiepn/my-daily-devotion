# Offline integration candidate — 2026-10-08

This branch collects the implemented Morning Grace, durable-editor and Remember stack for review against main. It is not merged, deployed or certified as the complete product. Historical release documents remain historical; use the actual candidate's contracts and editor coverage.

## Automated evidence

| Slice | Source commit | Hosted certification | Unit / browser / images |
|---|---|---|---|
| Manual reviews, PR #37 | c7f320080cb630f36d6503a8d794e7644d5057ac | 37751063855 | 314 / 1018 / 467 |
| Backup check, PR #38 | c0b6ab000971f5135da83457bc2d15a5f348e9f7 | 37754750061 | 316 / 1038 / 479 |
| Selected journal copies, PR #39 | dc0044a51533bdbe54ea1d35462a0285585f7e05 | 37755490650 | 318 / 1050 / 490 |
| Opt-in remembering, PR #40 | 76656c7b84d7d4411b4cf5062c0780030b257af9 | 37755833465 | 321 / 1066 / 501 |

All final runs have zero failures, skips and flaky cases, with eight browser shards and Windows image comparison. Exact PR merge commit for the newest certified stack: `622e489cb5bd74a932dbec061e347c2a195d7534`. Package SHA-256 `b81d0ccd770d197b84f6f0f687794bc9ae7c67bf1aed297ad1441caecc52f78c`; deployment digest `faf6659ae8a56d32e5fa20ffcb00d61fe45e363a72fd2b174b2ebb6567f815cf`. The downloaded archive and all 173 deployment hashes were independently verified. These are supporting evidence for this integration branch, not a substitute for its own final CI.

Earlier stale image failures are resolved by inspection and deliberate baseline updates, without changing assertions or tolerances. The Backups card grew by one disclosure, Privacy grew by optional choices, and manual review links sit below the established scenic History composition. Default Today/History appearance is unchanged when suggestions are off. New screens extend the journal typography/surfaces/botanical accent; they have no direct canonical mockup. Enlarged writing scrolls naturally. Browser PDF pagination remains browser-dependent.

## Compatibility and remaining gates

Physical database 2, domain contract 1 and ordinary portable backup format/schema 1. No schema-3 stores or optional recovery archive format are implemented. Browsing/review/export/suggestions introduce no devotional events; local choices are excluded from portable backups. Existing Scripture, M’Cheyne, prayer/session and explicit-save semantics remain intact.

PR #31's schema-3 specification still requires the owner review explicitly required by Batch C before dependent implementation. Its saved versions, Recently removed and optional recovery backups remain unfinished. Do not mark the whole offline push complete or imply that ordinary backups contain drafts. Roadmap version milestones remain pending release assembly, not published versions.

Human screen-reader/usability rounds, older-reader review, physical-phone keyboards/IME, interruption and performance measurements remain pending. Automated 200%/keyboard/contrast/overflow tests do not replace those gates. Migration-safe release recovery must preserve upgraded databases; an old binary is not a safe downgrade.

A separate local `thiepn-platform` repository prepares loopback Worker/account UI/API contracts, client-bound membership RLS, a container integration workflow, operations runbooks and an isolated two-device encryption review experiment. Worker checks/tests/build and synthetic crypto/SQLite experiments pass. This machine lacks Docker/Podman, so real Supabase Auth/Postgres/PKCE/mail integration has not passed. There is no hosted platform repository, provisioning, real journal upload or shipped MDD account interface. Device approval, rotation, production reconciliation and independent security review remain open.

## Explicit release sequence

Review the recovery specification; implement and certify Batch C; assign accurate milestone versions and compatibility tables; complete human/device gates; update this candidate; run exact integration certification; obtain explicit merge approval; certify the resulting main commit; obtain deployment approval; deploy the certified artifact without rebuilding and verify identity/hashes. No merge, deployment, DNS or paid service is authorized by creation of this candidate.
