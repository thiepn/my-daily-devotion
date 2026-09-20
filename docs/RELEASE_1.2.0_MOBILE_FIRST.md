# My Daily Devotion 1.2.0 — Mobile-First Experience

My Daily Devotion 1.2.0 rebuilds the phone experience so it behaves like a dedicated mobile app rather than a desktop layout compressed into a narrow viewport.

The Morning Grace Editorial identity remains unchanged. Desktop and tablet layouts remain based on the accepted 1.1.0 system.

## Mobile shell

- compact sticky app bar;
- compact fixed four-tab bottom navigation;
- Search and Data remain immediately available as icon actions;
- appearance controls move from the phone app bar to Data / Appearance;
- no glassmorphism or blurred navigation;
- tighter 10–12px phone gutters and 12–20px section rhythm;
- portrait and phone-landscape share the same mobile application composition.

## Today

- removes desktop hero artwork on phone;
- converts the four M’Cheyne readings from large cards into one grouped reading list;
- reduces progress and navigation chrome;
- keeps one clear Continue reading action;
- Reflection and Prayer become two compact response surfaces;
- first-run plan choices become compact setup rows instead of 120px desktop feature cards.

## Bible

- removes the desktop hero/landscape presentation on phone;
- opens directly into book/chapter navigation and Scripture;
- uses compact sticky book/chapter controls;
- uses the full phone reading width with smaller reading gutters;
- retains Search and Collections as secondary actions;
- keeps selected-verse actions in a compact surface above the bottom tab bar;
- phone-landscape compresses chapter metadata enough to keep actual Scripture visible above the tab bar.

## Prayer

- removes large decorative quote artwork on phone;
- keeps Add prayer as a compact primary action;
- compresses focused-prayer depth controls;
- uses horizontally scrollable status tabs;
- reduces request-row height and metadata density;
- tightens empty-state spacing.

## History

- removes desktop hero artwork on phone;
- uses compact segmented Overview / Moments / Search navigation;
- keeps monthly statistics in a dense three-column summary;
- tightens recent-history rows and calendar density;
- uses an edge-to-edge calendar surface on phone.

## Secondary workflows

Reflection, full M’Cheyne plan, Add Prayer, Prayer Detail, Focused Prayer, Collections, Search, Data and History detail views receive phone-specific spacing and edge-to-edge work surfaces where appropriate.

## Accessibility and resilience

The release preserves:

- semantic navigation and accessible names for icon-only actions;
- WCAG A/AA automated validation;
- 320px reflow;
- 200% text resizing;
- reduced-motion support;
- light/dark/system themes;
- phone-landscape behavior;
- Firefox, WebKit, desktop Chromium and mobile Chromium coverage;
- offline PWA behavior.

## Compatibility

This release does not require a data migration.

- Database schema remains **1**.
- Backup format remains **1**.
- Scripture corpus and M’Cheyne assignments are unchanged.
- Prayer scheduling/queue/session semantics are unchanged.
- Existing reflections, prayers, reading progress, Scripture annotations and History remain intact.

## Release evidence

The release is published only after the exact release commit passes locked dependency installation, dependency audit, unit/integration tests, complete Scripture verification, full browser/accessibility certification, mobile-first contract verification, release packaging, Pages deployment, and deployed-file identity verification.
