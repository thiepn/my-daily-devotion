# Prayer Detail & Settings — visual review

This release extends the integrated Morning Grace Prayer, Reflection and Add Prayer screens. The canonical four-phone board has no Prayer Detail or Settings composition, so this is a family comparison, not a claim of pixel-identical reconstruction.

## Evidence and normalization

- Canonical source: the user-supplied 1448 × 1086 Concept 11 board (`codex-clipboard-2deba43d-e2cc-4602-9e09-3d9c1ddf8c87.png`). The poster, bezels and external foliage are not application UI.
- Direct composition sources: `tests/visual/baselines/prayer-light-390.png`, `writing-reflection-390.png`, and `writing-prayer-390.png`, from the integrated Writing branch.
- Combined source/implementation evidence: [visual family](prayer-detail/prayer-detail-visual-family.png). Each application capture is 390 × 844 CSS pixels at density 1; no aspect-ratio stretching. Different screens and fixture content are explicitly intentional.
- [Before/after comparison](prayer-detail/prayer-detail-comparison.png) compares the prior always-editable request and flat settings form with the new reading view and grouped settings. Full before captures are retained in the same directory.
- The full 44-candidate image set is in `tests/visual/baselines/prayer-detail-*.png` and `prayer-settings-*.png`. Viewports: 320 × 568, 360 × 800, 390 × 844, 430 × 932, 768 × 1024, 1440 × 900. Enlarged text uses 320px and 200% root font size. Animations are disabled; fonts are bundled and loaded before capture.
- The in-app browser was used for capture → saved Prayer → Settings → explicit save → Prayer. Reading layout, labels, disabled unchanged save and restored Edit details focus were inspected. The local preview reported no warnings or errors during this check.

## Comparison history and corrections

1. **P1, fixed:** the first mobile rendering inherited both the legacy app bar and journal heading, and lost its paper gutters. Detail and Settings now use the writing route shell: one visible heading and contextual Back. The revised 390px and 320px images show the correction.
2. **P2, fixed:** Settings inherited inner top/bottom borders from each reused administration group, creating double dividers and unnecessary gaps. The shared field component has an explicit sectioned variant; legacy framing is retained only for its original unsectioned use. Three section separators now belong to the new composition.
3. **P2, fixed:** at 200% text, initials extended beyond the fixed circle. Its diameter now scales with its type size. The enlarged Detail candidate was recaptured and inspected.
4. **Interaction, fixed:** saving an update before entering the answer editor originally retained a pre-save revision. Guarded editor transitions now use the committed result. An existing capture/answer journey exposed this; browser tests retain the sequence.
5. **Test harness corrections:** older selectors were replaced with reading-view and grouped-settings selectors without removing backup, scheduling, touch-target, keyboard or overflow assertions. A pending-read test now navigates within the running app instead of restarting WebKit under a deliberately held database lock. Concurrent test runners use separate artifact directories and a stable local preview. Full-page captures start at scroll position zero to avoid rendering an off-viewport fixed skip link inside the exported document; the actual viewport was independently checked. The final full-suite review also corrected the remaining core-journey selector from the old mobile Back button to the journal Back link.
6. **P1, fixed:** the full mobile suite caught terracotta action text on the inherited sage hover/touch surface below 4.5:1. Hovered devotional and removal controls now use the matching strong foreground token. The narrow/enlarged keyboard journey explicitly measures both themes, including the removal dialog, so this state no longer depends on incidental pointer position during an axe scan.

## Required fidelity surfaces

- **Typography:** bundled Caslon/reading serif remains dominant for requests and timeline text; Inter handles dates, statuses and controls. Preserved paragraphs are readable. Settings headings wrap naturally at 320px. Enlarged content scrolls rather than being compressed.
- **Spacing and layout:** the journal column is capped at 760px. Paper gutters, restrained radius, subtle shadow, compact context disclosures and quiet timeline separators extend the Writing screens. Primary devotional/save actions stay in document flow. The request may naturally push its timeline below the first viewport.
- **Colors and tokens:** cream canvas, lighter paper, forest actions, sage identity circle and restrained terracotta are inherited from the integrated system. Dark mode uses the existing olive/charcoal and cream tokens. Focus and automated contrast checks cover both themes.
- **Image quality:** the existing locally bundled `olive-sprig.webp` is reused through `MorningGraceArtwork`; no new artwork, external images, photographs, filters that invert artwork or generated lettering. It remains visible at narrow widths. The enlarged identity circle was specifically rechecked.
- **Copy and content:** saved records supply request text, dates, updates and answers. Full BSB passages load from the bundled corpus. No fictional status transitions, scores or activity are introduced. Save/recovery copy distinguishes memory-only writing from saved data. Timeline labels describe real record kinds; answer notes remain optional.

Focused inspection used the original-size 390px request/settings captures, dark full-page capture, 1440px composition and top regions of both enlarged captures. These make initials, label spacing, type wrapping and borders readable; they supplement the full-view family comparison.

## Deliberate differences and remaining limits

- The request has a paper reading surface and Settings has a structured form; neither is depicted directly in the canonical board. They extend the established secondary-screen family rather than copying a primary-screen list.
- At 320px, “Prayer settings” wraps to two lines. At 200% text, long requests and controls extend well below the fold. This is intentional reflow.
- Native select/date controls vary across browser engines. Dedicated evening artwork, manual assistive-technology certification and physical-device keyboard testing remain later work.
- The approved font has slightly different weight from the concept image. No external artwork is required for this release.
- Image baselines are review candidates. Passing comparisons prevents unintended changes; it does not constitute user design approval.

No actionable P0/P1/P2 visual finding remains in the scoped screens after the corrections above. Exact-commit functional and image results are recorded separately with the draft PR and verification output.

final result: passed
