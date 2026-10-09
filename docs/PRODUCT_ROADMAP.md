# Complete product implementation roadmap

Approved direction: Read → Reflect → Pray → Remember, canonical Morning Grace visual identity, dependable local-first use and optional connected services. Work proceeds through bounded reviewed releases; neither merging nor deployment is automatic.

## Release ledger — verified October 9, 2026

This table describes **implementation on the integrated main branch**, not publication. Historic PR descriptions and their unmerged status are not current release status.

| Workstream | Current main-branch state | Outstanding gate |
|---|---|---|
| Morning Grace Today/Bible/Prayer/History, writing and backup UI (earlier releases 1–4) | Integrated through PR #41; certified in main run 37896665631 | Human visual/usability review, reference-device performance, deployment |
| Search, Saved Scripture, Collections, Reading Plan and optional onboarding | Integrated through PR #41 | Manual device and usability review |
| Durable local drafts and Recovery directory (earlier release 5) | Integrated through PR #41; physical database schema 2 foundation retained within schema 3 | Real-user migration and interruption checks |
| Saved versions and guarded restoration (release 6, C1–C2) | Integrated through PR #42 and #43 | Cross-version real-device validation |
| Recently removed / 30-day restoration (release 6, C3) | Integrated through PR #44, certified on resulting main | Optional recovery-inclusive backups (C4) still absent |
| Manual weekly/date-range review, export, backup check and opt-in Remember (release 7) | Integrated through PR #41 | Human/device gates |
| Origin migration, separate platform repository and isolated environments (release 8) | Planned; no verified live origin migration | Inventory production DNS and old-origin transfer safety |
| Shared thiepn.dev account identity and device management (release 9) | Design/prototype evidence only; not shipped in MDD | Isolated staging integration |
| Threat model, encryption protocol, two-device proof (release 10) | Specification/prototype work | Independent security review and exhaustive test vectors |
| Encrypted web sync with outbox/checkpoints/conflicts (release 11) | Not integrated in MDD | Security and dual-device correctness gates |
| Capacitor Android/iOS and SQLite adapter (release 12) | Not released | Native lifecycle, storage and device testing |
| Opt-in reminders/calendar/widgets (release 13) | Local in-app remembering exists; native extensions pending | Platform permissions and reliability |
| Public connected-platform rollout (release 14) | Not started | Operations, security and staged rollout |

## Execution sequence — stabilization P0–P15

- **P0 (this baseline):** consolidate repository evidence, close only PRs proven ancestry-contained, establish one current roadmap and a protected-by-process merge policy.
- **P1:** audit schema 1/2 → 3 upgrades, existing-user journal integrity and backup/restore compatibility.
- **P2:** explicitly authorize and deploy the newly certified main artifact, then verify identity and all live assets on the existing origin.
- **P3–P4:** physical-device defect removal and Morning Grace interaction/visual refinement.
- **P5–P8:** recovery-inclusive backups, exhaustive workflows, accessibility/performance and offline resilience.
- **P9–P12:** platform infrastructure, optional THIEPN accounts, reviewed encryption, encrypted cross-device sync.
- **P13–P15:** Android first, then iOS/device integrations and public operations.

Detailed baseline: [October 9 release baseline](RELEASE_BASELINE_2026-10-09.md). Development rules: [Codex workflow](CODEX_WORKFLOW.md).


## Locked product and safety decisions

- The integrated web candidate uses **physical database schema 3**; domain contract and ordinary portable backups remain version 1. Preserve v1 backup import and independently version future database, recovery-backup and sync formats. A database downgrade is not a safe rollback.
- Shared thiepn.dev login isolates each app’s private records and permissions. Account creation never uploads a guest journal or enables sync.
- Recovery uses a code or an existing approved device; support cannot decrypt journals. Losing both requires an independently usable backup or a new journal.
- First sync covers explicitly saved work and saved versions. Drafts, active reader position, device settings/reminders and backup receipts stay local.
- Recovery drafts persist until successful save or explicit discard. Recovering answer notes never records an answer.
- Keep twenty previous saved versions and a thirty-day restoration window. Preserve deletion groups, child revisions, IDs and original dates; no fabricated History events. Do not compact tombstones before the sync/deletion policy is reviewed.
- Replace database-wide export with a domain allowlist before internal tables arrive. Optional recovery payloads default off; required tombstones remain portable. Credentials, keys, outboxes, devices and cursors are excluded.
- Reviews are manually available; suggestions, resurfacing, backup reminders and notifications are opt-in. No missed-day pressure or spiritual scores.

## Platform implementation boundary

Use Cloudflare Workers for assets/APIs and standard Supabase Auth/Postgres for identity and encrypted service records. Keep MDD in this repository and shared account/API/infrastructure/contracts in thiepn-platform. Proposed sites: thiepn.dev, mdd.thiepn.dev, accounts.thiepn.dev and MDD’s /api/v1.

Inventory existing DNS first. Moving from thiepn.dev/my-daily-devotion changes browser origin: preserve an old-origin encrypted-transfer flow and verify restoration. A redirect does not move IndexedDB.

Begin with free services and a ten-account invited sync beta, configurable 10 MB journal allocation per account. Measure capacity, retain local saves when service/quotas fail, pause enrollment before exhaustion and require owner approval for any paid upgrade. Use independent encrypted off-site server exports and restore drills; free managed services are not independent backups.

API contracts cover identity/membership, devices, wrapped-key vault metadata, idempotent atomic pushes and cursor-based pulls. A local save and outbox operation commit together; incoming changes apply transactionally and never regenerate their historical events. Protocol review covers concurrent writing/lifecycle actions, deletion, old backups, replay/rollback, recovery, key rotation and device revocation.

## Required gates

Every release reports functional, rendered/accessibility, resilience and operational evidence on its exact commit. Include 320/360/390/430/768/1440px, light/dark/enlarged text, all engines, offline/backup behavior and meaningful failure/concurrency scenarios. Review actual rendering before baseline changes. Physical-device and human usability/screen-reader work must be reported separately from automated results.

Measure representative 10,000-record archives; target warm navigation under 200 ms and typical search under one second on a documented reference device. Broader content/audio/translations require a separate licensing and user-value specification. Social feeds, ads, competitive streaks and AI spiritual guidance are outside the committed core sequence.
