# Morning Grace V2 — current implementation guidance

The supplied Concept 11 image is the visual authority. Earlier Morning Grace JSON/mobile contracts and phase documents record history; their “frozen” labels do not override the image. Domain and persistence contracts remain authoritative for behavior.

Today and Bible now use V2 presentation. Prayer, History and secondary compositions await their individual review gates. This is the roadmap's first implementation slice, not completion of all six releases.

## Ownership

| Concern | Owner |
|---|---|
| Cascade | `index.css`: legacy → foundation → components → screens |
| Semantic tokens | `tokens.css` |
| Paper, actions, icons, artwork, navigation | `components.css` |
| Semantic Scripture typesetting | `scripture.css` |
| Today composition and breakpoints | `today.css` |
| Bible composition, dialogs, dock and breakpoints | `bible.css` |
| Reader controls/preferences | `BibleReaderControls.tsx`, `reader-appearance.ts` |
| Screens awaiting migration | Historical CSS inside the legacy layer |

Remove superseded selectors as each screen migrates. Bible selectors were removed from eleven historical stylesheets; unrelated members of grouped selectors were retained. Do not create another override stylesheet. Bible styles contain no `!important`.

Libre Caslon Text and Inter are locally bundled, pinned OFL font packages, covered by the notice generator. No remote fonts or artwork. `MorningGraceArtwork` owns morning, context, reflection and botanical variants. Bible uses its own 1200 × 470 WebP; reflection remains a dawn crop pending History. Art has empty alternative text and stays visible on mobile. The imagined Bible landscape makes no geographic accuracy claim.

## Reader behavior

Passage and Aa panels use native modal dialogs with explicit initial focus and trigger restoration. Font, size and spacing use typed values in the existing v1 preferences table. Imported fields are validated independently. Writes are serialized and failures remain visible without blocking reading. Preferences create no devotional History events.

Highlight, Note, Copy and More form the selection dock. More exposes Reflect, Pray, Bookmark and Add to collection. Existing note guards, repositories and explicit completion remain in use. The dock's measured height reserves scrolling space. Verse numbers retain 44px targets; Scripture paragraphs, poetry, headings, superscriptions and red-letter segments follow the corpus.

## Separate content correction

Visual inspection found `Twelvetogether` in Luke 9:1. The checksum-verified pinned USJ source places an omitted note between those words without whitespace. Parser version 6 restores separators after omitted notes followed by a word. The separately committed review covers 112 verses; only whitespace changed. Wording, punctuation, verse/translation identities, normalized schema, database schema, plan assignments and stored annotations are unchanged. `scripture:verify` checks these fixtures, all 31,086 reader/copy/search identities and all 365 M’Cheyne assignments.

## Image comparisons

`npm run test:visual` compares 18 versioned candidate baselines using pinned Chromium on Windows. CI uses `windows-2025`; cross-platform behavior remains in the full browser suite. Both font families are bundled. The visual job gates deployment and never updates images automatically.

Baselines cover Today/Bible at 320, 360, 390, 430, 768 and 1440px; Data backup controls in light/dark; Bible selection in light/dark; 320px/200% reader settings; and failed chapter loading. Other empty/populated/conflict workflows retain functional screenshot coverage and gain comparisons as they migrate.

Run without update mode first. Inspect expected/actual/diff and compare with the supplied reference. Document intentional changes in `design-qa.md`, then use `npm run test:visual -- --update-snapshots`, inspect again and submit images for human review. Implementer review establishes a regression reference; it does not replace user design approval or screen-reader usability testing.

## Next slice

After Bible review, rebuild Prayer individually: editorial heading, verified BSB quotation, existing lifecycle tabs, request-first rows, initials from actual person metadata, factual recency and a Focus Prayer card using the deterministic queue. Retain explicit “Prayed” and all scheduling/lifecycle semantics. Migrate Prayer-only CSS and pass the same rendered/functional gates before History. Durable drafts, native storage and encrypted sync require their later specifications and review gates.
