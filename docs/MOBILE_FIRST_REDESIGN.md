# My Daily Devotion — Mobile-First Layout Redesign

Status: **implemented on `design/mobile-first-1.2`**

This redesign exists because the 1.1.0 mobile interface still inherited desktop composition: large hero sections, large illustrations, desktop-scale card spacing and controls that were simply stacked vertically.

The phone layout is now treated as its own app surface.

## Mobile shell

- Compact sticky app bar.
- Search and Data remain quickly available.
- Theme selection moves to Data/Settings on phone.
- Fixed four-tab bottom navigation becomes smaller and denser.
- No glassmorphism or blurred navigation.
- Screen gutters are approximately 10–12px rather than desktop editorial margins.

## Phone landscape

Phone landscape remains a phone layout. Devices up to 900px wide and 500px tall use the same compact app-bar, tab-bar, row density and artwork suppression as portrait phones rather than falling back to the tablet composition.

## Today

The desktop hero and landscape are removed on phone.

The phone flow is:

1. compact date / greeting;
2. current M’Cheyne day;
3. one grouped four-reading list;
4. Continue reading;
5. two compact Reflection / Prayer response surfaces.

The four readings are no longer four large standalone cards.

## Bible

Bible becomes reading-first on phone.

- Large Bible intro is removed.
- Decorative chapter landscape is removed.
- Search and Collections remain compact secondary actions.
- Book and chapter controls become a sticky compact row under the app bar.
- Scripture uses the full phone width with small reading gutters.
- Verse actions remain in a bottom action surface above the tab bar.

Desktop Bible remains unchanged.

## Prayer

- Large quote artwork is removed.
- Add Prayer becomes a small app-style action.
- Focused Prayer becomes a compact panel.
- Quick / Regular / Extended become small inline choices.
- Status tabs horizontally scroll as compact chips.
- Prayer request rows are substantially tighter.

## History

- Large landscape hero is removed.
- Overview / Moments / Search becomes a compact segmented control.
- Monthly statistics stay in one three-column summary.
- Recent history rows are tightened.
- Calendar becomes edge-to-edge and denser.

## Secondary screens

Reflection, full reading plan, Prayer detail, Focused Prayer, Collections, Search and Data receive reduced mobile spacing, smaller headers and edge-to-edge work surfaces where that improves usability.

Desktop/tablet layouts are not changed by this file.

## Accessibility

The redesign retains:

- semantic labels;
- touch targets for core actions;
- 320px reflow;
- 200% text resize;
- dark mode;
- reduced motion;
- automated WCAG A/AA validation.

The mobile layout intentionally collapses multi-column summary elements at 200% text size rather than preserving density at the expense of readability.

## Release boundary

This branch is a mobile redesign candidate, not a production release. It should receive visual acceptance on real rendered screenshots before merge or version bump.
