# Batch C1 — saved-version foundation

The owner approved PR #31's specification on 8 October 2026. This bounded change starts Batch C from the integration candidate `406ea5b0f6fe65b8b7e66777aea9ae8a95e435f1` (PR #41); it does not finish Batch C or publish version 1.5.0.

Physical database schema becomes 3 through the approved four additive private stores. Existing v1/v2 registrations and domain indexes remain intact. Domain contract and ordinary portable backup format/schema remain 1. Upgrades capture no retrospective versions, removal groups or activity.

Explicit meaningful edits capture the previous editable values for reflections, prayer wording, verse notes, collections, collection-item notes and people. Creation, unchanged writing, schedules, prayed actions, draft checkpoints and browsing capture no versions. Existing APIs provide no update/answer editing permission, so this change introduces none. Capture, pruning, domain save and exact draft retirement share their transaction. The newest twenty entries per target/journal remain; older journals are not erased by replacement.

Readonly directories contain no writing or names. Selected contents use strict typed shapes and immutable date/range context. The internal restoration command uses expected revisions and existing validated repository mutations, returns the committed record, snapshots the replaced writing and cannot recreate missing records or bypass read-only prayer status. It is not exposed as a user control yet.

## Supporting verification

- TypeScript and all 329 unit/integration tests passed.
- Eight new tests cover v2 upgrade/index/epoch preservation, upgrade abort, retention, six writing kinds, readonly snapshots, ordinary-backup exclusion, rollback, stale saves, restoration revisions/events, removed/read-only targets and previous-journal boundaries.
- 68 writing/directory/version browser journeys passed across Chromium, Firefox, WebKit and mobile Chromium. The twelve migration/update-protection journeys passed after moving their synthetic future-version fixture to schema 4. The initial run used the old schema-3 future fixture and failed those four cases; those results are not treated as a pass.
- 57 existing image comparisons passed across six widths, light/dark, enlarged text, loading/errors and dialogs. No CSS, composition, artwork, threshold or baseline change was made. Advanced now truthfully shows local database schema 3; ordinary backup remains format 1. Rendered Advanced views were inspected at 320px and 390px.
- Production build verifies all 31,086 BSB verses and 365 M'Cheyne assignments.

Hosted exact-commit certification remains pending for this new slice. Human screen-reader, physical-phone/IME and performance gates remain open.

## Next bounded changes

Add Saved versions comparison/confirmation UI and contextual links; implement exact-revision grouped removal/restoration with the thirty-day window; then opt-in recovery-inclusive format 2 validation, review and import. Removal stores are empty reservations in this slice: no removal capture or Recently removed UI exists yet. Ordinary backups still exclude all private recovery stores. No merge, deployment, hosted service or real journal upload occurred.
