# Morning Grace V2 — Bible and shared-control visual QA

Visual review: **passed for the scoped light Bible composition after iteration**. User design approval remains pending. This is not certification of Prayer, History, the whole redesign, final dark artwork or native-device accessibility. The preceding Today review is archived at `docs/visual/morning-grace-v2/today-design-qa.md`; Today was recaptured after bundling Inter.

## Evidence

- Source: user-supplied 1448 × 1086 Concept 11 board. Second phone application crop: x398–708, y198–892, excluding status bar/poster. Uniform normalization: 310 × 694 to 390 × 873. A narrow bezel edge is excluded from judgement.
- Render: production preview `/#/bible/LUK/9`, light, 390 × 844 CSS pixels, scale factor 1, reduced motion, local fonts loaded. No invented subtitle or skipped verses. Separate screenshots show actual Luke 9:23 selection and dock.
- Versioned evidence: `tests/visual/baselines`, plus `docs/visual/morning-grace-v2/bible-comparison.png` (source left, implementation right). The different source aspect ratio is retained; no pixel-perfect score is claimed against fictional sample content.
- Additional sizes: 320 × 568, 360 × 800, 430 × 932, 768 × 1024, 1440 × 900, 200% text. Annotation, preliminary dark, offline and failed-load journeys are exercised. Reader settings were also inspected in the in-app browser, including Escape/focus behavior.

## Findings and corrections

1. [P1, fixed] Mobile hid the Bible illustration and promoted utility chrome. Replaced with back/passage/collections/Aa controls and a locally bundled landscape visible at every required width.
2. [P1, fixed] Data's plain-backup label inherited the same color as its background. Its owning rule now sets ink explicitly. Direct contrast, keyboard and image checks cover both themes and disabled encrypted export.
3. [P1, fixed] The first 320px/200% modal clipped its title horizontally. Bounded width, shrinkable heading and shorter title now reflow; internal scroll-width is asserted. Vertical scrolling remains available.
4. [P2, fixed] Initial native/React autofocus timing was inconsistent. Dialogs now focus the first available selector after opening and restore the trigger on close. Keyboard and reload/persistence tests cover this.
5. [P2, fixed] Initial header/translation metadata pushed Scripture too far down. A 54px header retains 44px controls; art/title rhythm now aligns with the reference. Real corpus headings remain. Translation attribution lives in reader help and the passage panel.
6. [P2, fixed] Bundled Inter exposed 2px of enlarged-text Search overflow. Replaced the fixed action column with intrinsic sizing and restored 44px Search controls. Secondary controls are checked in both themes at narrow/enlarged sizes.
7. [Content, separately fixed] The old parser omitted a word boundary in Luke 9:1. An isolated parser commit and 112 whitespace-only fixtures correct the source-note case; this is not a display-text patch.
8. [Test determinism, fixed] Two CI runners captured different selection scroll offsets as local fonts and the status dock settled. Selection baselines now explicitly center the verse after that layout. The two updated candidates were inspected; comparison thresholds were not relaxed. Secondary target measurements disable entrance animation and still require 44px computed and rendered height.

## Close matches

Compact four-control header; wide ink-and-wash landscape; cream canvas; large literary chapter title; subdued metadata; small visible verse numerals; sage highlights; compact icon dock; refined four-tab navigation. The art is about 140px high at 390px and remains over 110px at 320px. Desktop has a bounded reading column. Today retains its illustrated opening, verse card, plan disclosure, Reflect/Pray cards and dominant CTA.

## Remaining differences and limits

- [P3, artwork] Larger foreground olive tree, subtler village and slightly more taupe palette than the reference. The medium and natural depth match, not the exact drawing. No external light-mode asset is required for this slice.
- [Expected, Scripture] BSB wording, headings, cross-references, paragraph grouping and red-letter styling differ from the mock's composite text. Actual chapter/saved/deep-linked positions are respected; verses 1–22 are not omitted to reproduce the poster.
- [Expected, interaction] Copy maps the mock's Share position to the existing offline feature. Selection reference, clear action and mutation feedback make the dock taller. More retains devotional/collection actions; the dock appears only for a selection.
- [P3, type/icons] Caslon headings are a little heavier and Phosphor strokes finer. Inter is bundled for consistent offline metadata/control rendering.
- [Deferred] Dark mode uses warm tokens and illustration opacity without inversion. Dedicated evening art is pending. Loading/error surfaces remain the existing recoverable states, not a new secondary-screen certification. Prayer and History await their own rebuilds.
- [Not claimed] Axe and keyboard checks do not constitute a manual screen-reader certification, usability study or physical iOS/Android test.

No unresolved P0/P1/P2 visual issue remains in the scoped light Bible composition. Baselines are review candidates, not user approval. Exact regression results and reviewed commit are recorded with the PR and task report.
