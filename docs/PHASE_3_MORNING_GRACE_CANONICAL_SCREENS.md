> Prayer V2 supersedes this document's Prayer composition. See `docs/visual/morning-grace-v2/prayer-design-qa.md`; the attached phone mockup and current V2 styles are authoritative.

# My Daily Devotion — Morning Grace Editorial

## Phase 3 — Canonical Screens

Status: **implemented on redesign branch**

Phase 3 turns Morning Grace from a token/asset system into the actual product experience on the four primary surfaces: **Today, Bible, Prayer, and History**.

The goal is not to decorate the old layouts. Each canonical screen now has a composition matched to its spiritual purpose.

## Today — Meet God today

Today opens with a restrained morning hero rather than a generic app heading.

The main hierarchy is:

1. date + morning orientation
2. today's M'Cheyne assignment
3. one clear continue-reading action
4. reflection and prayer response

The four readings become a deliberate reading set rather than a generic list. Completion remains factual; there are no streaks, scores, or overdue pressure.

The first-run enrollment flow remains available beneath the same Morning Grace hero and retains all existing calendar/self-paced/import semantics.

## Bible — Immerse in His Word

Bible is intentionally the most restrained canonical screen.

The hierarchy is:

1. compact Bible identity and search/collection access
2. optional M'Cheyne context
3. book/chapter navigation
4. contextual Morning Grace art band
5. chapter title
6. Scripture
7. quiet adjacent-chapter navigation

Art is always outside the Scripture paragraphs.

Verse selection still supports highlight, reflection, prayer, bookmark, copy, verse note, and collections. The functionality is unchanged; only its presentation is reorganized.

## Prayer — Bring it to Him

Prayer is now request-first rather than administration-first.

The hero communicates prayer as a personal devotional space and uses the Morning Grace botanical system.

Focused prayer remains available in Quick, Regular, and Extended depths, but the depth choices are presented as one calm decision rather than dashboard controls.

The prayer list emphasizes request body, answered/active state, and last-prayed context. People and Categories remain supporting management tools.

## History — Look back and see

History now begins with a reflective overview before the calendar.

The overview uses factual current-month information: days with recorded history, total recorded events, days containing prayer activity, and recent history days.

The calendar remains the canonical way to navigate individual dates, preserving existing History day routes.

No streaks, spiritual grades, performance scores, or competitive analytics are introduced.

## Responsive composition

Phone uses a one-column editorial flow, short artwork bands, progressive reading-card collapse, and the existing fixed bottom navigation.

Tablet retains split compositions only where space supports them. Desktop uses an editorial canvas beside the existing narrow rail. At 200% text size, split layouts collapse to one column.

## Functional preservation

Phase 3 does not change the database schema, M'Cheyne assignments or progress semantics, Scripture content, Bible annotation repositories, prayer scheduling/queue/session semantics, History derivation, or backup/restore formats.

The redesign is a presentation/composition change over the already-audited domain layer.

## Source of truth

Machine-readable contract: `canonical/morning-grace-canonical-screens.v1.json`

Final canonical-screen stylesheet: `src/styles/morning-grace-screens.css`

Verification: `scripts/verify-morning-grace-phase3.mjs`

Browser acceptance also covers canonical landmarks, 320px reflow, 200% text resizing, light/dark themes, and the existing devotional journeys.

## Phase boundary

Phase 3 finalizes the four primary screens only.

Secondary workflows—Reflection editor, prayer detail/settings/people/categories, full plan, collections, search, data/backup, and other management surfaces—remain later Morning Grace work.

Production remains unchanged until the broader redesign is accepted and the draft redesign PR is intentionally merged.
