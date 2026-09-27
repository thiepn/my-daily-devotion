# Data & Backup — visual and implementation review

Data has no dedicated phone in the canonical board. This release extends integrated Prayer Detail, Reflection and People/Categories: Caslon headings, literary body text, warm paper, forest actions, restrained terracotta and the bundled botanical. The canonical board remains the visual authority; older Data CSS is historical material.

## Evidence inspected

- [Before and after](docs/visual/morning-grace-v2/data-backup/data-before-after.png): the same 390 × 844 application viewport. The previous screen led with schema, technical privacy detail and historical corrections; the replacement leads with protecting the journal.
- [Source family and implementation](docs/visual/morning-grace-v2/data-backup/data-visual-family.png): Prayer Detail, Reflection, People and Your data at 390 × 844. Thumbnails preserve aspect ratio. These are synthetic fixture records, never personal data.
- [Responsive layouts](docs/visual/morning-grace-v2/data-backup/data-responsive.png): 320, 360, 390 and 430px, with original heights 568, 800, 844 and 932. Additional original-size inspection covered 768 × 1024 and [1440px desktop](docs/visual/morning-grace-v2/data-backup/after-1440.png); the [old desktop](docs/visual/morning-grace-v2/data-backup/before-1440.png) is retained.
- [Dark, export, review, confirmation and result](docs/visual/morning-grace-v2/data-backup/data-states.png), plus [320px at 200% text](docs/visual/morning-grace-v2/data-backup/data-enlarged.png). Individual baseline images also cover long filenames, mismatch/errors, replacement backup, Appearance, Privacy and Advanced.
- Captures use bundled fonts, fixed fixture dates, reduced motion and top scroll reset. Full-page screenshots paint fixed bottom navigation at the initial viewport bottom; subsequent content is accessible by scrolling.
- The in-app preview verified the encrypted form opens with container focus, Tab enters its first field, and Other export options exposes explicit unencrypted/retained-record explanations. No field autofocus opens a mobile keyboard.

## Corrections made during review

1. **P2, fixed — mobile return focus.** Duplicate shell links allowed focus restoration to choose a hidden desktop control. Restoration now selects a visible matching control, preserving the complete originating URL and scroll position.
2. **P2, fixed — enlarged actions.** A primary export button could become a narrow column beside Cancel. Intrinsic flex sizing now gives it a full row at narrow widths or enlarged text, keeping Cancel in document flow.
3. **P2, fixed — typography and control spacing.** A generic paragraph selector overrode heading metadata, and the initial file/preview controls touched. Specific metadata styles and an explicit control gap restore the journal hierarchy.
4. **Keyboard, fixed.** Opening an export form moves focus to its labeled container without focusing an input. Closing it restores the initiating action. The shared confirmation retains focus trapping, Escape cancellation and a safe initial focus.
5. **Cascade cleanup.** Data-owned selectors were removed from nine legacy stylesheets, retaining selectors shared by other workflows. One screens-layer composition file owns Data, reusing existing tokens and journal primitives. No new override layer or illustration was added.

## Visual assessment

The new page has one editorial heading, a small mobile-visible botanical, two warm functional paper sections and quiet disclosures. The forest encrypted-backup action is dominant. Restore uses subordinate terracotta, a compact four-step indicator, readable counts and reviewed effects, then the existing journal confirmation. Technical details move to Advanced. The 760px desktop column and approved mobile navigation remain consistent with the integrated family.

The warm dark palette uses explicit shared surface/text colors and the existing botanical treatment, with no inversion. Plain export remains readable. Enlarged text, long filenames and expanded review details reflow vertically instead of compressing controls or hiding artwork.

## Data safety and verification design

Schema and archive format remain v1; encryption parameters, password minimum, revision/tombstone merge rules, UUIDs and devotional event types are unchanged. Preview and import share a candidate builder. A memory-only review is bound to the exact local snapshot and database; commitment checks it inside the write transaction. A committed result is returned directly and retained separately from optional appearance refresh. Temporary validation databases are cleaned up. Export receipts contain only generation time/type in browser-local storage and never enter portable records.

Coverage exercises live versus removed counts, equal-revision differences, merge/replace effects, cancelled/stale reviews, cross-tab writes, rollback, duplicate submission, restored preferences, failed refresh, receipt failure, Markdown retained data, historical-format restoration, malformed/oversized archives and invalid relationships. Database snapshots prove browsing, preview/export/cancel do not mutate live records. Exact clean-commit test/build/browser/image results are reported in the draft PR, not inferred from screenshots.

## Remaining differences and limits

- This is an extension of the approved family, not a pixel-identical reproduction of a nonexistent Data mockup. Integrated Caslon lettering differs slightly from the concept board.
- At 390 × 844, the full primary backup section is visible; Restore follows below the fold. A reviewed restore, long filenames or enlarged text naturally require scrolling.
- Dedicated evening artwork remains later work. No external artwork is needed for this release.
- The screenshot candidates are manually reviewed implementation evidence awaiting user design review. Automated pixel comparisons do not substitute for that approval.
- Physical-device virtual keyboards and manual screen-reader certification were not performed. Automated keyboard, contrast, reflow and 44px target checks are separate evidence.
- Browser downloads cannot prove file retention; the UI deliberately reports generation and a download request only. Browser storage remains separate from an external backup.

No actionable P0/P1/P2 visual finding remains in the inspected replacement. Functional release certification and hosted infrastructure status are reported separately.

final result: passed
