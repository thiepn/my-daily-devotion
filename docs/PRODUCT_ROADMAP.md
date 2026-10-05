# Complete product implementation roadmap

Approved direction: Read → Reflect → Pray → Remember, canonical Morning Grace visual identity, dependable local-first use and optional connected services. Work proceeds through bounded reviewed releases; neither merging nor deployment is automatic.

## Release ledger

| Release | Deliverable | State |
|---|---|---|
| 1 | Integrate PRs #12–#21, certify one artifact, manual release operations, version 1.3.0 | Draft integration PR #22; certification passed, owner review/merge pending |
| 2 | Search scopes/pagination/excerpts, precise destinations, Saved Scripture hub and Collections journal | Draft PR #23; hosted certification passed, unmerged |
| 3 | Reading Plan journal, skippable onboarding, mode education, optional name and appropriate greeting | Draft PR #24; hosted certification passed, unmerged |
| 4 | CSS consolidation, complete states, evening artwork, accessibility/usability and performance | Draft PR #25; hosted certification passed (223 unit/integration, 794 browser, 309 images), unmerged; human/physical-device gates outstanding |
| 5 | Durable device-local drafts and Recovery view | [Specification](specs/DURABLE_LOCAL_DRAFTS.md) owner-approved; [5B portability boundary](RELEASE_5B_PORTABILITY.md) implemented, certification pending; migration/repository/editor slices remain |
| 6 | Twenty saved versions, thirty-day removal recovery, optional recovery backup payloads | Requires reviewed migration/portability spec |
| 7 | Manual weekly review, opt-in resurfacing/backup reminders, backup checks and period exports | Planned |
| 8 | Repository/platform boundaries, thiepn-platform, isolated domains/environments and origin transfer | Infrastructure inventory required |
| 9 | Shared thiepn.dev identity, app boundaries, account/device management | Free Cloudflare + Supabase + SMTP prototype |
| 10 | Encryption/sync protocol, test vectors, two-device prototype and independent review | Required before public sync beta |
| 11 | Encrypted web sync, durable outbox/checkpoints/conflicts and explicit journal connection | Depends on reviewed protocol |
| 12 | Capacitor iOS/Android, SQLite adapter, physical-device recovery and store preparation | After web sync |
| 13 | Opt-in local notifications, calendar export, private shortcuts/widgets | After native reliability |
| 14 | Public rollout, diagnostics, operations and user-driven improvements | Continuous gates |

## Locked product and safety decisions

- Finish visual releases with schema v1. Draft/recovery/sync migrations are separate reviewed work; preserve v1 backup import and independently version database, backup and sync formats.
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
