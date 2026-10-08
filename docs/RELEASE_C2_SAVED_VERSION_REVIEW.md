# Batch C2 — review earlier saved writing

This slice follows the owner-approved Batch C specification and PR #42 on `codex/offline-saved-versions`. It exposes the existing twenty-version retention and revision-checked restoration through the Morning Grace journal. It does not implement Recently removed or recovery-inclusive backups.

## Delivered behavior

- Recovery has separate Drafts and Saved versions views. The saved-version directory shows twenty metadata-only entries, then twenty more, without names or private excerpts.
- A selected version presents labeled, copyable current and earlier writing. Paragraphs are retained; no raw HTML or remote content is rendered.
- Explicit restoration checks both the current record revision and the exact reviewed version contents within the existing atomic command. Concurrent edits require a fresh review. Removed targets, answered/archived wording and previous-journal versions remain copyable without a restore control.
- Successful restoration retains the original identity, creation date, devotional date and Scripture relationships, and captures the replaced writing. No new devotional activity is generated. A failed refresh retains the committed result; Retry refresh never repeats the mutation.
- Contextual links cover reflections, prayer wording, verse notes, collections, collection notes and people. Existing dirty-editor guards remain in effect. Verse-note returns reopen the editor with the entire Scripture range; reflection returns restore scroll and focus.
- Required reads use readonly transactions and foreground/cross-tab refreshes. Optional query parameters are validated and safely normalized. Controls retain the shared busy/unload protections during commitment.

Physical database schema stays **3**, domain contract **1**, ordinary portable backup format/schema **1**. No new stored fields, migration, History types, lifecycle permissions or queue behavior are introduced. Ordinary backups continue excluding private recovery stores.

## Verification and review

The C1 foundation passed hosted run `37791018754`: source head `fa8a9d4f7f8ff37ed5b99151a781234daa927493`, tested PR merge `2d6156512cafd63439943f8aacc20c6d2dd86ea4`; 329 unit tests, 1,074 browser cases and 501 image comparisons across all eight browser shards, with no failures, skips or flaky results. Its package SHA-256 is `d18bfc9058f25c55aef1deac2415acb4c3037ea72f082c9dc43f64b1a037a889`; all 173 deployment file hashes were independently checked. This evidence belongs to C1, not this new screen.

C2 supporting checks: TypeScript, all **334** unit/integration tests and production build passed. The build verifies 31,086 BSB verse identities and 365 M’Cheyne assignments. **32** targeted journeys passed across desktop Chromium, Firefox, WebKit and mobile Chromium: browsing/pagination/copy/cancel snapshots, explicit restoration, concurrent edits, invalid context, dirty note guards and full-range return, failed writes and committed restores followed by failed refreshes.

Thirteen new deterministic comparison images cover 320/360/390/430/768/1440px, directory, dark, enlarged text, empty, confirmation, removed and error states. Recovery directory/empty baselines deliberately change for the new navigation. Contextual editor links receive rendered comparison review; thresholds are unchanged. Baseline generation is preparation for review, not proof by itself. The 187 affected editor/archive comparisons passed after deliberate baseline preparation; final comparison runs without updates remain separate. A small avatar-color difference was checked against the foundation build, which already uses the same deterministic terracotta tone; this slice changes no identity colors.

The initial browsing test incorrectly included an editor’s outstanding committed-draft acknowledgment cleanup in its snapshot interval. The fixture now finishes that existing save cleanup before measuring readonly browsing. Initial visual captures exposed a copy button nested inside a field label; the controls are now separate and label assertions pass. These initial runs are not reported as passes.

The rendered comparison follows the existing warm journal family, with botanical heading, stacked mobile panels and two desktop columns. Read-only textareas support selection/copy; this is a recovery utility rather than a pixel reproduction of a canonical phone. Long content scrolls, and the restore action can be below the fold. The original landscape, logo and canonical screen compositions are unchanged.

Exact-commit full hosted certification remains a release gate for C2. Physical-phone keyboard/IME checks, human screen-reader testing, usability rounds and reference-device performance measurement remain open. No merge, deployment, hosted provisioning or real journal upload is authorized by this slice.

## Next bounded release

Implement Recently removed: transactional deletion groups with exact parent/child revisions, thirty-day eligibility, relationship checks and restoration without duplicate History events. Then implement separately versioned, optional recovery-inclusive backups with independent payload validation and atomic reviewed import. Neither feature is present in C2.
