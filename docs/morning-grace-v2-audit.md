# Morning Grace V2 — reference lock and audit

Scope: main 54b4a2d → shared foundation + Today only. Source of visual truth is the user's Concept 11 board, specifically the UI inside the phones. Older canonical JSON files remain historical; their frozen statuses do not override this reference.

## Observed baseline

Captured at 390×844, fixed local date 2026-04-24. Today has warm colors and working bottom navigation, but is a compact utility screen: small italic greeting, no visible landscape, no contextual verse, four prominent reading rows, and two cramped response cards. Bible, Prayer and History similarly lose their illustrated regions on mobile. The initial Bible capture was a loading state and was rejected as visual evidence; a rendered Bible capture was obtained after the shared foundation changes. It is not represented as an untouched baseline.

Retain: real BSB/M’Cheyne loading, plan enrollment/calendar/self-paced/leap rules, explicit completion, reflection and prayer repositories, route return contracts, fixed bottom navigation, focus/reduced-motion/safe-area support, theme control in Data, all data/domain code.

Replace: Today hierarchy and composition, landscape placeholder, UI icon geometry on primary navigation, system-dependent display typography, repeated Today CSS across historical layers. Mobile hid the h1, introduction and every major illustration, reduced metadata to ~10px and promoted rows over the intended scenic opening. Tests encoded these decisions rather than fidelity.

## Visual measurements and mapping

The first phone's application content is approximately x48–356, y200–892 (excluding device chrome). Greeting occupies the upper-left, profile control the upper-right. Morning scenery spans the width behind the opening. The verse card overlaps the lower landscape. A single compact plan card follows, then two equal response cards, a full-width forest-green pill CTA and quiet four-tab navigation. Card corners are modest; shadows and rules are soft. Main headings are high-contrast literary serif; controls/metadata are restrained.

Real mapping: profile → Data; verse → first verse of the current M’Cheyne Psalm reading when present, otherwise the first incomplete reading (or first assigned reading), using complete BSB text. Before enrollment, the calendar assignment supplies the preview. All four readings → compact disclosure containing existing explicit completion controls; Reflect → daily persisted reflection; Pray → open session/due queue or capture; CTA → first incomplete reading, then reflection when complete. No accounts/daily-verse model/streaks/photos.

## Foundation boundary

One entry stylesheet declares legacy → foundation → components → screens layers. tokens.css owns semantic tokens. Existing non-Today compositions remain bounded legacy material for later phases. New primitives and artwork own their styles, independent of legacy specificity. Today gets one screen stylesheet with its responsive rules beside its base composition; obsolete Today-only declarations are removed, not countermanded by another override file.

Original generated raster dawn and botanical assets are bundled through Vite so its existing manifest-based service-worker precache includes them. Existing low-detail motifs on unrebuilt screens remain until their dedicated phases; they are not claimed as final artwork. Dark artwork certification is deferred.

## Audited material and what survives

Inspected the Morning Grace canonical JSON/design documents, all seven `morning-grace*.css` files, App shell/navigation, TodayScreen, BibleScreen, PrayerScreen, HistoryScreens, Icon/MorningGraceMotifs, and the visual/responsive/accessibility/interaction tests. Historical frozen design decisions remain readable but are subordinate to the supplied board.

The old system matched the warm cream/green palette, serif intent and four devotional destinations. It missed the image-to-text balance, substantial scenery, generous literary opening, overlapping verse card and compact plan composition. The mobile rules explicitly set the hero, Bible and History art to `display: none !important`, then hid the opening hierarchy and compressed the remaining content. That mobile simplification was the principal fidelity break.

Removed obsolete Today rules from `morning-grace-screens.css`, `morning-grace-mobile.css` and `morning-grace-polish.css`. Other legacy selectors remain inside the declared legacy layer until their screen is rebuilt. The whole historical cascade has not been deleted; that would exceed this phase and risk secondary workflows.

## Next gate: Bible, not implemented here

After review of Today: lock the second phone crop, give Bible one owned screen stylesheet, replace the placeholder with a contextual raster band, compose compact back/book/chapter/type controls, then tune chapter heading, literary verse measure, subordinate verse numbers, highlights and the existing selection dock. Keep passage identity, reader position, notes/bookmarks/collections, reading completion and plan return context unchanged. Capture the same 320/360/390/430/1440 widths and enlarged text; compare the second phone and rerun Scripture, selection, search, completion and offline checks before Prayer begins.
