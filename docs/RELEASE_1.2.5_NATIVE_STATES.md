# My Daily Devotion 1.2.5 — Native mobile application states

Version 1.2.5 finishes the phone-state language so loading, recovery, empty, conflict and unsaved-draft states feel like part of the app rather than desktop fallbacks.

## Unsaved changes

Unsaved-change confirmation is now a mobile bottom sheet:

- fixed to the bottom edge;
- safe-area aware;
- scrollable on short phones;
- Save, Keep editing and Discard actions are stacked and at least 44px high;
- 200% text remains reflow-safe.

Desktop keeps the existing centered dialog composition.

## Conflict review

Edit conflicts now use an edge-to-edge mobile comparison block rather than an inset card.

The local draft remains untouched while the user reviews the latest saved version. Keep/use actions are explicit and reflow to one column at enlarged text.

## Loading and recovery

Route loading is substantially smaller so the app bar remains the visual anchor.

Lazy-route failures, invalid routes and startup recovery use compact in-shell state composition with reachable recovery actions rather than oversized editorial pages.

Today, Bible, Reflection, Prayer detail/settings and History state branches now share the same mobile state vocabulary.

## Empty states

Prayer, Collections and Search empty results use quiet inline state rows with reduced spacing and no decorative empty-card artwork on phone.

## Offline and updates

Offline/update status is now a slim system strip beneath the app bar. It remains readable and usable at 200% text.

## Compatibility

The release preserves:

- v1.2.4 dense secondary workflows;
- v1.2.3 contextual Search/Data navigation;
- the four root mobile screens;
- desktop/tablet Morning Grace composition;
- database schema **1**;
- backup format **1**;
- all Scripture, M’Cheyne, Prayer and History domain semantics.

## Verification

The release candidate must pass the cumulative Phase 12 matrix plus dedicated state tests covering bottom-sheet geometry, 44px actions, conflict safety, lazy-route recovery, offline status, empty-state density, 320px reflow, 200% text, accessibility and desktop preservation.
