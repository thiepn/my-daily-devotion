# My Daily Devotion 1.2.3 — Contextual mobile utilities

Version 1.2.3 finishes the navigation context work started in 1.2.2.

## Search and Data

Search and Data are pushed mobile utilities rather than destinations that always belong to Today.

When opened from a root screen, they now carry the exact source route as a validated return target. This preserves useful route state such as:

- a Bible chapter and selected verse;
- the current Prayer status filter;
- the current History view;
- Today itself.

Submitting a Search query or changing Search filters retains that return target.

## In-content Search

The same contract now applies to:

- Bible → Search Bible;
- Scripture Collections → Search;
- History Overview/Moments → Search.

Back therefore returns to the screen that actually opened Search rather than jumping to Today.

## Direct-open safety

A directly opened Search or Data URL without a valid return target still falls back to Today. Return values must be internal absolute paths and protocol-relative values are rejected.

## Compatibility

- Database schema remains **1**.
- Backup format remains **1**.
- Scripture, M’Cheyne, Prayer, History and search semantics are unchanged.
- Desktop/tablet Morning Grace composition is unchanged.
- The 1.2.2 stacked mobile shell, safe-area behavior and 200% reflow fixes remain intact.

## Verification

The release candidate must pass the full cumulative Phase 12 release matrix plus the mobile-layout contract checks for contextual Search/Data navigation.
