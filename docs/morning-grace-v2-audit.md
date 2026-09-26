# Morning Grace V2 — reference lock and audit

Scope: main 54b4a2d → shared foundation + Today only. Source of visual truth is the user's Concept 11 board, specifically the UI inside the phones. Older canonical JSON files remain historical; their frozen statuses do not override this reference.

## Observed baseline

Captured at 390×844, fixed local date 2026-04-24. Today has warm colors and working bottom navigation, but is a compact utility screen: small italic greeting, no visible landscape, no contextual verse, four prominent reading rows, and two cramped response cards. Bible, Prayer and History similarly lose their illustrated regions on mobile. The Bible loading screenshot was rejected and recaptured after Scripture rendered.

Retain: real BSB/M’Cheyne loading, plan enrollment/calendar/self-paced/leap rules, explicit completion, reflection and prayer repositories, route return contracts, fixed bottom navigation, focus/reduced-motion/safe-area support, theme control in Data, all data/domain code.

Replace: Today hierarchy and composition, landscape placeholder, UI icon geometry on primary navigation, system-dependent display typography, repeated Today CSS across historical layers. Mobile hid the h1, introduction and every major illustration, reduced metadata to ~10px and promoted rows over the intended scenic opening. Tests encoded these decisions rather than fidelity.

## Visual measurements and mapping

The first phone's application content is approximately x48–356, y200–892 (excluding device chrome). Greeting occupies the upper-left, profile control the upper-right. Morning scenery spans the width behind the opening. The verse card overlaps the lower landscape. A single compact plan card follows, then two equal response cards, a full-width forest-green pill CTA and quiet four-tab navigation. Card corners are modest; shadows and rules are soft. Main headings are high-contrast literary serif; controls/metadata are restrained.

Real mapping: profile → Data; verse → first verse of the current/next M’Cheyne passage using complete BSB text; all four readings → compact disclosure containing existing explicit completion controls; Reflect → daily persisted reflection; Pray → open session/due queue or capture; CTA → first incomplete reading, then reflection when complete. No accounts/daily-verse model/streaks/photos.

## Foundation boundary

One entry stylesheet declares legacy → foundation → components → screens layers. tokens.css owns semantic tokens. Existing non-Today compositions remain bounded legacy material for later phases. New primitives and artwork own their styles, independent of legacy specificity. Today gets one screen stylesheet with its responsive rules beside its base composition; obsolete Today-only declarations are removed, not countermanded by another override file.

Original generated raster dawn and botanical assets are bundled through Vite so its existing manifest-based service-worker precache includes them. Existing low-detail motifs on unrebuilt screens remain until their dedicated phases; they are not claimed as final artwork. Dark artwork certification is deferred.
