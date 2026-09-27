# People & Categories — visual review

These screens are not directly depicted in the canonical four-phone board. The implementation extends the integrated Prayer, Prayer Detail and Reflection family; the board remains the visual authority for palette, type, natural materials and botanical character.

## Evidence

- Direct sources: `tests/visual/baselines/prayer-light-390.png`, `prayer-detail-390.png`, and `writing-reflection-390.png`.
- [Source and implementation together](people-categories/metadata-visual-family.png): Prayer, Detail, Reflection, People and Categories at 390 × 844, density 1. The sheet resizes each to 320px while preserving its aspect ratio. Different fixture content and screen purposes are intentional.
- [Before and after](people-categories/people-categories-comparison.png): matching one-person and seven-category fixtures at 390 × 844, density 1. Before screens used permanently open forms and utility headings; after screens lead with the saved directory and on-demand editing.
- [Responsive comparison](people-categories/metadata-responsive.png): original 320 × 568, 360 × 800, 390 × 844 and 430 × 932 captures; thumbnails preserve aspect ratio.
- [Dark, editor, expanded, confirmation and error states](people-categories/metadata-states.png), and [200% text at 320px](people-categories/metadata-enlarged.png).
- Original-size baseline inspection additionally covered 768 × 1024 and 1440 × 900, conflict comparisons and long names/notes. Full before/after desktop captures are included in this directory. Original candidate pixels live in `tests/visual/baselines/metadata-*.png`.
- Captures use bundled fonts, frozen dates, local fixture records, disabled animations and a consistent top scroll position. Full-page captures draw fixed navigation at the initial viewport's bottom; content beneath it remains reachable by scrolling.
- The in-app preview verified on-demand editor opening without field autofocus, dirty Cancel, the shared discard/keep dialog and focus restored to Add person. No application warning or error appeared in that interaction.

## Findings and corrections

1. **P2, fixed — navigation spacing.** The first mobile candidate used flex when re-enabling the approved navigation, bunching tabs together. The screen now restores its shared four-column grid. Fresh captures show evenly distributed tabs.
2. **P2, fixed — enlarged text.** At 320px/200%, fixed identity circles and the heading/art row constrained text. Circles now grow with text, artwork wraps onto its own row, and the narrow heading scale preserves a readable Categories title.
3. **P2, fixed — terracotta initials contrast.** The inherited clay text color did not meet the normal-text threshold on this surface. A scoped token blend darkens the initials appropriately in light and dark modes. Independent axe checks pass.
4. **Interaction, fixed — return readiness and counts.** Focus restoration waits for linked requests. Selected entries outside the current page/search receive an explicit label, preserving truthful matching counts and stable ordering.
5. **Capture correction.** Early full-page images retained scroll offsets after field focus. The existing long History Day comparison also exposed a font-dependent offset of the off-screen skip link; that one baseline was recaptured with an explicit top scroll position, preserving selected-entry focus and unchanged History content. The suite now resets capture scroll consistently; this does not change application focus behavior.
6. **Cascade cleanup.** Seventy-six superseded metadata selectors were removed from six legacy files. One screens-layer stylesheet owns the replacement; shared components used elsewhere remain intact.

## Visual assessment

- **Typography:** integrated Caslon editorial headings and row names, literary notes, restrained Inter labels and counts. Relationships are subordinate; absent relationships leave no placeholder. Notes preserve paragraphs.
- **Composition:** the saved directory follows a compact heading, Add action and labeled search. Warm panels are reserved for notes, editors, suggestions and recoverable states. Quiet separators replace nested utility cards. The desktop journal is capped at 760px.
- **Color and control treatment:** cream paper, forest primary actions, sage/terracotta identities and discreet management actions match the family. Dark mode uses the existing warm olive palette. Keyboard outlines and 44px control assertions remain.
- **Assets:** the bundled botanical remains visible on mobile. No landscape, logo, photograph, generated lettering, external art generation or remote asset dependency was introduced.
- **Density and reflow:** the standard five-person directory extends slightly beyond 390 × 844; Categories is more compact because there are no relationship lines. At 320px, long content or 200% text, natural scrolling preserves readability and controls. Editors and actions remain in document flow.
- **Content:** all names, notes, counts, links and statuses derive from live records. Suggested category names appear before activation; unknown counts never become false zeroes. Removal restrictions explain all statuses accurately.

## Remaining differences and limits

- This is a secondary-screen extension of the approved journal, not a claim that the concept board contains these exact layouts. The integrated font differs slightly from the concept lettering.
- Dedicated evening artwork remains future work; the existing dark botanical treatment is retained without inversion.
- The screenshots are reviewed implementation candidates awaiting user design review. Passing image comparisons alone is not visual approval.
- Physical-device virtual-keyboard and manual screen-reader certification were not performed. Automated keyboard, contrast, overflow, safe-area and enlarged-text checks are reported separately.

No actionable P0/P1/P2 visual finding remains in the inspected replacement. Functional exact-commit certification is reported separately in the draft PR.

final result: passed
