# Prayer journal — implementation and visual review

The third phone in the user-supplied Concept 11 board is the visual target. This release implements the primary Prayer screen, existing-metadata filtering, and a read-only Focus preview. History and prayer editing/session screens retain their existing presentation and behavior.

## Composition and reference comparison

The app-only reference crop is (747, 198)–(1053, 893): 306 × 695 pixels, uniformly normalized to 390 × 886. The implementation is a 390 × 844 CSS viewport at device scale factor 1. The different aspect ratios are preserved. Phone hardware and small rounded-corner remnants are excluded from judgement. `prayer-comparison.png` shows both; all fixture identities and requests are synthetic test data, never production defaults.

- **Typography:** Caslon heading, literary italic BSB quotation, serif person/request hierarchy, and small Inter metadata. The existing Caslon face is heavier than the concept and the UI metadata is sans-serif. These are deliberate continuations of the approved Today/Bible foundation.
- **Spacing and layout:** heading/plus, quotation, segments, request list, and botanical Focus card follow the same order and relative visual weight. Five short requests and the Begin action appear above the bottom navigation at 390 × 844. A 320px phone scrolls normally; 200% text reflows to two status columns and full previews.
- **Colors and surfaces:** cream paper, deep forest actions, pastel sage/terracotta identity circles, fine warm separators and a soft Focus card. Dark mode uses existing warm olive/charcoal tokens; no filter inversion or remote artwork.
- **Image quality:** the bundled raster olive sprig is visible in the Focus card and empty state on mobile. Person photographs are intentionally represented by real linked-person initials. The approved book/cross brand is retained.
- **Copy and content:** the quotation is actual COL.4.2 from the bundled BSB asset, including its terminal comma. No hand-authored Scripture paraphrase, sample person, request, date or metric is shipped. Missing optional Scripture falls back to unquoted devotional copy while the list stays available.

## Reviewed differences and corrections

1. The first rendering placed the Focus action too low. Reduced empty spacing and row padding without reducing 44px controls; moved queue explanation below the Begin/Resume action.
2. Browser checks found ambiguous implicit filter labels. Added explicit labels and IDs, then checked keyboard operation across engines.
3. The 320px enlarged view crowded bottom-tab labels and two-letter initials. Retained text scaling, removed excess navigation edge padding at that size, and made identity circles/grid columns scale with text. Added rendered label-bound assertions.
4. Four statuses, global counts and explicit Filters replace the concept's three mixed-purpose tabs. Pagination has a visible count and Show more, so large archives remain fully discoverable.
5. Last-prayed metadata is explicitly labeled, rather than implying an unspecified recency date. Rows use chevrons opening existing detail actions instead of adding a management menu.
6. The Focus card is taller than the concept because its explanation and session-length disclosure remain accessible. Those secondary controls may be below the fold. The card's primary action remains visible in the standard five-request 390px fixture.
7. A saved session whose requests are all answered/removed has an explicit Finish session action. Browsing cannot invoke the repository's mutating reconciliation or pretend a new session will start. Existing session navigation performs reconciliation after the user's action.

No claim of pixel-perfect duplication, manual screen-reader certification, physical-device certification, or completion of the entire visual redesign is made. Screenshot baselines record the inspected implementation; they are not a substitute for user design approval.

## Architecture and behavior

`src/prayer/journal.ts` supplies typed read-only library and Focus models. Dexie readonly transactions enforce the no-write boundary. It deliberately avoids category default initialization, `startOrResume`, and reconciling `loadState`. Existing queue and session repositories remain unchanged.

The Prayer list combines status with optional `person` and `category` query parameters. Invalid/deleted IDs are removed with URL replacement; counts stay global. Request/add links carry the current filtered URL through the existing `return` parameter. Five requests appear initially and Show more reveals ten at a time. No migration, new preference, persistent subsystem, or backup format is introduced.

`src/styles/prayer.css` owns the screen in the existing `screens` layer. 149 superseded selectors were removed from the legacy cascade; secondary workflow styles remain. The shared navigation receives only a narrow enlarged-text padding correction. Reduced motion, meaningful focus, safe areas and mobile artwork are retained.

The screen reloads its presentation on foreground, pageshow and civil-date/time-zone changes. Generation checks ignore stale reads after a refresh or unmount. List, Focus and Scripture failures are independent; retry preserves saved requests.

## Verification checklist

- TypeScript, all unit/domain/integration tests and production build.
- Existing contract verifiers updated to check current Prayer ownership instead of retired classes/text.
- Cross-browser filtering, pagination, status counts, deep-link normalization, return context, preview/resume, midnight rollover, read failures and retries.
- Read-only snapshots covering prayers, metadata, schedules, sessions/items, updates, resolutions and History.
- Cold offline Prayer quotation, requests and botanical artwork alongside existing offline/backup journeys.
- Image comparisons at 320/360/390/430/768/1440px, dark, empty, long, filters, saved session, recoverable error and 200% text; existing Today/Bible/Data/brand comparisons retained.
- Manual composition/crop/type/color/icon review, plus axe, keyboard, reflow, 44px controls and enlarged label-bound checks.

Exact commit and final test outcomes belong in the PR and task delivery report. Database schema remains v1; domain repositories, Scripture corpus and devotional completion semantics are unchanged.
