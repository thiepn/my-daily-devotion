# My Daily Devotion 1.2.4 — Dense secondary mobile workflows

Version 1.2.4 continues the mobile-first work by redesigning the remaining management and detail workflows that were responsive but still structurally desktop-like.

## Prayer Detail

Prayer Detail is now one compact mobile story stream:

- the request remains prominent without occupying a desktop-sized editor;
- status remains visibly present after the desktop heading collapses;
- lifecycle actions use a compact two-column action area;
- answer/update forms are edge-to-edge task surfaces rather than inset desktop cards;
- history rows and prayer metadata are significantly denser.

## Prayer Settings

Prayer Settings now behaves like a phone settings page:

- fields use tighter vertical rhythm;
- weekday selection becomes a compact grid;
- management links stay close to the related fields;
- Save/Cancel remain reachable in a sticky bottom action bar.

## People and Categories

The editor now comes before the saved list on phone. This removes the need to scroll past a long collection before adding or editing an item.

Saved rows use compact mobile management actions while keeping 44px touch targets.

## History detail

History Day and Moments now use denser timeline composition.

- History Day keeps its full date visibly present after the visual H1 collapses.
- Moments uses a compact local segmented switcher.
- entry rows, quotations and dates use tighter mobile typography and spacing.

## Reflow and compatibility

At 200% text, dense two-column mobile action groups collapse to one column rather than shrinking text or creating horizontal overflow.

The release preserves:

- the 1.2.3 contextual Search/Data navigation;
- all four root mobile screens;
- desktop/tablet Morning Grace composition;
- database schema **1**;
- backup format **1**;
- all Scripture, M’Cheyne, Prayer and History domain semantics.

## Verification

The release candidate must pass the full cumulative Phase 12 matrix plus dedicated mobile tests for editor ordering, Prayer detail/settings, History context, 320px reflow, 200% text and desktop preservation.
