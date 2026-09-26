# My Daily Devotion — Morning Grace Editorial

## Phase 2 — Brand Assets & Visual Motifs

Status: **implemented on redesign branch**

Brand update: the user-approved **Cream Forest Book and Cross** supersedes the historical Morning Sprig Book described below. See [approved artwork and export guidance](artwork/approved-brand.md). The old no-cross/no-shadow mark restrictions no longer apply. Other unmigrated screen directions here remain historical.

Phase 2 freezes the visual asset language that sits on top of the Phase 1 design system.

## Brand mark — Morning Sprig Book

The Morning Grace mark combines three ideas:

- **Open book** — Scripture is the root of the devotional life.
- **Growing sprig** — faith is formed through small, faithful days.
- **Morning sun** — God's mercies are new every morning.

The mark is intentionally not a generic cross badge, church logo, flame, dove, or productivity symbol. Christian identity comes primarily through Scripture, language, and product purpose rather than literal clip-art symbolism.

The production geometry is shared between the React shell mark and the public/PWA assets.

## Icon family

All interface icons use one 20 × 20 editorial-outline family:

- 1.55 px optical stroke
- round caps
- round joins
- low detail
- no emoji
- no mixed third-party icon styles

Primary navigation:

- **Today:** sunrise over a quiet horizon
- **Bible:** open book
- **Prayer:** praying hands
- **History:** editorial timeline

Supporting icons include leaf, sprig, reflection, people, answered prayer, highlight, note, bookmark, search, plus, share, more, and settings.

Selected icons keep the same geometry and gain semantic domain color rather than switching to a different icon style.

## Botanical language

The canonical botanical is an olive-like sprig.

Botanicals are used as editorial punctuation, not decoration wallpaper.

Allowed placements:

- edge of a hero
- focus-prayer composition
- section ending
- quiet empty state
- History closing band

Rule: **no more than one meaningful botanical gesture per major composition.**

Botanical art is prohibited behind Scripture body text.

## Landscape system

Morning Grace landscapes are flat editorial watercolor/ink hybrids rather than photography.

Core subjects:

- morning hills
- quiet paths
- calm lakes
- distant villages
- fields
- olive/pine silhouettes

Color is limited to the paper canvas, sage/olive family, and a small morning-gold light cue.

There are no embedded words, people as focal subjects, fantasy skies, HDR effects, neon, or stock-photo realism.

### Canonical artwork zones

| Placement | Shape | Rule |
| --- | --- | --- |
| Today hero | 16:7 | clear text-safe area |
| Bible contextual header | 5:2 | optional; never behind Scripture paragraphs |
| History closing band | 16:5 | quiet reflective landscape |
| Empty state | 4:3 | substantial negative space |

## Image-generation master direction

When later phases need scenic raster artwork, use the contract's master prompt and keep one coherent illustrator style across the entire product.

Generated art must never contain text or logos. Interface copy remains real HTML.

## Dark mode

The SVG mark, icons, and motifs are theme-aware.

Dark scenic artwork must be separately authored or simplified. Raster images are **not** mechanically inverted.

## PWA assets

The Morning Sprig Book mark now defines:

- favicon SVG
- 192px app icon
- 512px app icon
- 512px maskable icon
- Apple touch icon

The manifest and browser theme color use Morning Grace paper rather than the old visual-system value.

## Reusable code assets

- `BrandMark.tsx` — theme-aware brand mark
- `Icon.tsx` — canonical interface icon family
- `MorningGraceMotifs.tsx` — botanical, sunrise, landscape, and editorial flourish motifs
- `morning-grace-brand.css` — motif and icon rendering rules

Static equivalents live under `public/brand/`.

## Phase boundary

Phase 2 finalizes the **ingredients**, not the final screen compositions.

Today, Bible, Prayer, and History remain Phase 3 work. Their structure must be redesigned deliberately using these assets rather than decorated after the fact.

No database, Scripture corpus, M'Cheyne plan, prayer scheduling, history semantics, backup format, or local-storage behavior changes in this phase.
