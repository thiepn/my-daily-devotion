# My Daily Devotion — Morning Grace Editorial

## Phase 5 — Final Visual Polish & Consistency Pass

Status: **implemented on redesign branch**

Phase 5 is a consistency pass over the completed Morning Grace redesign. It does not introduce a new visual direction.

## Audit findings addressed

The Phase 4 evidence showed three remaining inconsistencies:

1. Mobile top chrome was visually crowded because Search, Data, and three theme labels competed with the current screen title.
2. Add Prayer, History Day, and History Moments still inherited older screen composition patterns.
3. Loading, recovery, draft conflict, and platform status states still looked like pre–Morning Grace utilities.

The final polish layer also normalizes small control, typography, dark-mode, and interaction differences that accumulated across the earlier implementation phases.

## Application chrome

Search and Data now use the canonical icon family. On desktop they retain text labels. On phone they become icon-first while their accessible names remain intact.

Theme controls also become icon-first at phone widths.

The current route title stays visible and receives the available header width.

## Typography

Morning Grace display typography is consistently used for major state headings and editorial headings.

Reading typography remains reserved for Scripture, prayer text, reflection writing, and long-form content.

Headings use balanced wrapping where supported; body excerpts use more natural line wrapping.

## Controls

Secondary and quiet controls now share:

- 8px restrained radius;
- common border treatment;
- common hover behavior;
- consistent transition timing;
- accessible focus rings.

Primary actions retain domain color and gain only a small one-pixel hover lift.

There are no spring, bounce, glow, or glass effects.

## Mobile chrome

At phone widths:

- Search becomes an icon button;
- Data becomes an icon button;
- Light / System / Dark become icon-only visually while retaining full accessible labels;
- the route title is ellipsized if necessary;
- bottom navigation remains the primary product navigation.

This frees horizontal space for content without hiding functionality.

## Loading, errors, offline and update states

Route loading now uses the Morning Sprig Book mark.

Startup failure and route recovery states share the Morning Grace state language.

Offline and update status remain factual and compact. Their behavior is unchanged.

## Draft and conflict states

The custom in-page draft dialog now has a clearer hierarchy:

- Save and continue — primary
- Discard and continue — destructive/terracotta
- Keep editing — quiet

The conflict review panel uses a warm editorial warning treatment while continuing to preserve the unsaved draft by default.

Browser-native before-unload confirmation remains native because browsers control that security surface.

## Add Prayer

Add Prayer now uses the same secondary-screen language as Reflection and Prayer Detail:

- terracotta top accent;
- large reading-serif request field;
- optional details remain secondary;
- source Scripture/reflection context sits in a supporting column.

Prayer creation semantics are unchanged.

## History Day and Moments

History Day and Moments now use the same quiet secondary header and editorial history treatment as the canonical History screen.

Their routes and event derivation are unchanged.

## Dark mode

Morning Grace landscape layers are deliberately brighter in dark mode instead of becoming muddy.

Paper surfaces retain modest depth while avoiding glow.

## Motion

A short 190ms opacity + 4px route reveal provides continuity between screens.

Reduced-motion preferences remove this animation and interactive translation.

## Accessibility

The pass preserves:

- semantic navigation;
- full accessible labels for icon-first controls;
- visible focus indicators;
- 44px interaction targets where required;
- 320px viewport support;
- 200% text resizing;
- reduced-motion behavior;
- non-color-only state information.

## Source of truth

- Contract: `canonical/morning-grace-final-polish.v1.json`
- Styles: `src/styles/morning-grace-polish.css`
- Verification: `scripts/verify-morning-grace-phase5.mjs`
- Browser tests: `tests/ux/morning-grace-polish.spec.ts`

## Phase boundary

Phase 5 completes implementation-level Morning Grace visual work.

The redesign PR must remain unmerged until the resulting full visual evidence is reviewed and accepted. After acceptance, the next work is release integration rather than another redesign phase.
