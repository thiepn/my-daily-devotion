# My Daily Devotion 1.2.6 — Mobile interaction polish

Version 1.2.6 removes several remaining browser-like interaction behaviors from the mobile app without changing devotional data or domain semantics.

## Native route draft protection

Leaving a dirty editor through in-app navigation no longer opens the browser's generic confirm popup.

The app now uses the same bottom-sheet interaction language introduced in 1.2.5:

- Keep editing preserves the current draft.
- Leave without saving explicitly discards the route draft.
- Escape/cancel returns to editing.
- Focus is restored when the user stays.
- Real reload, close and browser-level unload events still use the platform-required beforeunload protection.

Dirty-state registration is centralized at the app shell, so all routes share one navigation blocker instead of each editor installing its own browser confirm.

## Screen scroll memory

Each route/query state keeps an in-session vertical scroll position.

This means:

- opening a new destination begins at the top;
- returning to a previously visited screen restores where the user left it;
- root tabs behave more like persistent app destinations;
- pushed utility/detail screens can return without losing reading position;
- Bible's existing verse and saved-reader-position restoration still runs after the generic route reset and remains authoritative.

Scroll memory is session-only and stores no user content.

## Keyboard and touch polish

Phone layouts now provide app-bar and bottom-bar-aware scroll padding/margins for editable controls.

Mobile chrome and common controls use direct-manipulation touch behavior, with restrained pressed feedback on tabs, utilities and primary list links.

## Compatibility

1.2.6 preserves:

- the 1.2.5 native mobile state system;
- the 1.2.4 dense secondary workflows;
- contextual Search/Data return behavior;
- desktop/tablet Morning Grace composition;
- database schema **1**;
- backup format **1**;
- M’Cheyne, Scripture, Prayer, Reflection and History semantics.

## Certification

The release candidate must pass the full Phase 12 matrix plus interaction-specific tests covering route draft protection, absence of SPA browser confirm, scroll-position restoration, focus margins, direct touch handling, 320px/200% text reflow, landscape phones, accessibility and desktop dialog preservation.
