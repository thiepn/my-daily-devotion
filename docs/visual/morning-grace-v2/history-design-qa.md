# History journal — implementation and visual review

The fourth phone in the user-supplied Concept 11 board is the visual target. This release covers the overview, separate calendar, History Day, and Moments. It is stacked on Prayer PR #15 at `720445b1eba7473213fedbeb80effdf8547293ca`; it does not merge or deploy that work.

## Reference and composition

`history-comparison.png` compares the app-only reference, previous History, and the new 390 × 844 overview. The reference is cropped inside the phone and scaled uniformly; the app viewport and reference aspect ratios remain different. Fixture dates, writing and counts are synthetic test data, never production defaults.

- **Hierarchy:** editorial History heading and search, four segments, botanical overview, five meaningful rows, live Scripture over a scenic ending, approved bottom navigation. Calendar browsing is now a separate destination. The year selector and readable factual metric labels make the overview card taller than the concept.
- **Typography:** existing Caslon display and literary Scripture faces; restrained Inter controls and metadata. Caslon remains somewhat heavier than the concept. Row previews are limited to two lines at normal text sizes; enlarged views expose more text naturally.
- **Surfaces and color:** warm cream paper, light elevated overview, forest segments, sage and terracotta semantic circles, fine separators. Dark presentation uses the existing warm palette and a shaded illustration, not inversion.
- **Artwork:** original local 1200 × 500 WebP with layered mountains, detailed trees and pale space for live text. The complete BSB Lamentations 3:22–23 is longer than the mockup quotation. At 390 × 844 the quotation and framing trees are visible above navigation; the lower valley and explanatory totals disclosure continue below the fold. At 320px and enlarged text, natural scrolling is expected.
- **Secondary screens:** shared heading, period controls, entry rows and states create one journal family. Day uses a complete date and focuses the selected, expanded entry. The calendar changes to a dated list when seven 44px columns cannot fit. Moments emphasizes reflections, answers, encouragement and highlights.

The illustration matches the reference's material, palette and composition rather than copying its exact mountain silhouettes. Dedicated evening artwork, physical-device testing and human screen-reader certification remain later work. Screenshot baselines record the inspected implementation and await user design approval; passing comparisons do not establish pixel-perfect fidelity.

## Read models and privacy

`src/history/journal.ts` owns period/view parsing, factual totals, grouped feed rows and pagination. `src/history/repository.ts` retains the existing public read APIs and resolves only visible rows' referenced source records in readonly transactions. Optional Scripture assets load after the transactions. No stored model, migration, event producer, prayer lifecycle or reading-completion rule changes.

- Days count distinct stored `localDate` values. Prayer and reflection totals count distinct subjects represented by creation events in the selected period. Switching activity segments does not alter these totals.
- Reading groups require the same stored date, enrollment and assignment. They list actual completed passages. Explicit prayed actions form a daily row whose destination exposes each event. Other actions stay separate.
- Ordering uses stored date, latest constituent event time and stable ID. Browser time-zone changes cannot move an event to another historical day.
- Removed records can contribute factual metrics. Both child and parent tombstones suppress private excerpts and source links. Answer resolution IDs are honored; missing answers never fall back to unrelated writing.
- Excerpts reflect current saved writing. History is not a snapshot archive. Day provides full text and a separate original-record action.
- Overview reveals five rows, then ten; Moments reveals twenty at a time with no 200-entry cutoff. Totals need no archive-wide private-body scan.

## Navigation and resilience

URL state preserves period, view and revealed count. Calendar preserves its month and origin; Day preserves the selected event and origin; Search and source links carry the complete return chain. Ephemeral scroll/focus state restores the originating row. Pointer origins are tracked explicitly because Safari does not focus clicked links. Scripture chapter changes retain the History return destination.

Dexie live queries refresh source edits across tabs, foregrounding and return navigation. Local-date changes advance This year at New Year without changing explicitly selected years. Cleanup guards ignore obsolete asynchronous results. Optional quotation failures keep the landscape and unquoted fallback; database failures offer retry without pretending totals are zero.

## CSS ownership

`src/styles/history.css` is the single History composition owner in the established screens layer. It includes its own mobile, container-size, dark and reduced-motion rules. Superseded primary and secondary History selectors were removed from legacy Morning Grace and phase styles; shared selectors needed by other workflows remain. The new composition uses no `!important` declarations.

The shared artwork component now exposes the dedicated reflection asset. Provenance and the generation prompt are in `history-art.md`. Existing Today, Bible, Prayer and brand assets are unchanged.

## Verification scope

- All TypeScript, domain/integration and production-build gates; existing contract checks updated for current composition ownership.
- Chromium desktop/mobile, Firefox, WebKit, offline startup and interrupted-update/backup journeys.
- Exact metrics, grouping boundaries, segments, ordering, >200 pagination, 10,000-event reads, bounded source resolution, tombstones, missing details, failed Scripture, leap dates and year rollover.
- Browser return chains, selected-entry focus, read retries, cross-tab edits and before/after database snapshots proving browsing is read-only.
- Image comparisons for all four History views at 320/360/390/430/768/1440px, plus dark, 200% text, long writing, empty period/segment/archive, unavailable entries, selected prayed actions and errors. Existing Today/Bible/Prayer/icon baselines stay unchanged.
- Rendered inspection of hierarchy, image crop, five-row density, focus, 44px controls, keyboard access, safe-area spacing and enlarged-text reflow. Axe checks complement the manual visual review.

The initial full browser run passed 291/294. It exposed a Safari focus-return defect, a Safari-specific keyboard-test assumption, and a legacy calendar test still targeting the overview. These were corrected before final certification. Exact commit, final counts and evidence are recorded in the PR and delivery report, rather than referring to this exploratory run as a clean release.

Schema remains v1. Persistence formats, UUIDs, revisions, tombstones, prayer/session queues, Scripture identity, M’Cheyne semantics, backup formats and explicit completion actions are preserved.
