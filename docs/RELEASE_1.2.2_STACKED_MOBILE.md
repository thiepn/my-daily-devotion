# My Daily Devotion 1.2.2 — Stacked mobile app flows

Version 1.2.2 is a focused refinement of the 1.2.1 phone navigation release.

## Root tabs versus pushed screens

The four persistent mobile tabs now belong only to the four root destinations:

- Today
- Bible
- Prayer
- History

Secondary workflows behave as pushed app screens. They use a compact route title and a 44×44 Back control, while the root tab bar and unrelated Search/Data actions are hidden.

This applies to Reading Plan, Reflection, Scripture Collections, Prayer capture/detail/settings/metadata, History detail, Search and Data.

## Contextual Back behavior

Back destinations are explicit and safe rather than delegated to arbitrary browser history.

Validated return context is preserved where the devotional flow provides it, including:

- Bible → Reflection
- Bible → Collections
- Reflection → Add Prayer
- Add Prayer → Prayer detail
- Prayer detail → Prayer settings

Directly opened screens still return to their nearest logical root destination.

## Focused Prayer

An active Focused Prayer session uses its own session chrome and can occupy the full phone viewport. Empty, unavailable and finished session states retain the pushed-screen app bar so the user is never left without navigation.

## Mobile ergonomics

- Safe-area insets are included in the app bar and sticky Bible toolbar geometry.
- Reflection and Add Prayer keep their primary actions reachable near the bottom edge while typing.
- Secondary page H1s remain semantic but are no longer rendered as a duplicate visual title beneath the app bar.
- 320px width, 200% text resizing and 844×390 phone landscape are explicitly covered.
- Desktop and tablet Morning Grace composition is unchanged.

## Compatibility

- Database schema remains **1**.
- Backup format remains **1**.
- Scripture, M’Cheyne, Prayer, History and search semantics remain unchanged.
- No cloud dependency or account requirement is introduced.

## Verification

The release candidate must pass the cumulative Phase 12 gate, including unit/integration tests, Chromium/Firefox/WebKit UX coverage, mobile Chromium, offline PWA checks, WCAG A/AA validation, 320px reflow, 200% text resizing, phone landscape, Morning Grace verification, the mobile layout contract and exact-package release hardening.
