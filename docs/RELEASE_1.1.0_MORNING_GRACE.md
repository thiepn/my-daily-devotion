# My Daily Devotion 1.1.0 — Morning Grace Editorial

My Daily Devotion 1.1.0 replaces the original visual presentation with the **Morning Grace Editorial** system while preserving the audited local-first devotional engine underneath.

This is a visual and experience release, not a data-model rewrite.

## Morning Grace Editorial

The app now uses one coherent design language across Today, Bible, Prayer, History and supporting workflows:

- warm paper surfaces and olive-charcoal text;
- restrained sage, teal, terracotta and morning-gold accents;
- separate display, reading and interface typography roles;
- the Morning Sprig Book brand mark;
- a single editorial icon family;
- restrained botanical and landscape motifs;
- authored light and dark themes;
- phone, tablet and desktop compositions built from the same system.

The app is intentionally designed to feel closer to a devotional journal and printed Bible than a productivity dashboard or generic SaaS interface.

## Canonical screens

### Today

Today now opens as a morning devotional surface centered on the current M’Cheyne assignment, with direct continuation into Scripture and a separate response section for reflection and prayer.

Progress remains factual. There are no streaks, spiritual scores or overdue-pressure mechanics.

### Bible

The Bible reader is the most restrained screen in the product.

The new composition prioritizes chapter reading, constrained Scripture measure and book-like typography. Search, collections, annotations and verse actions remain available without competing with the biblical text.

Decorative artwork is never placed behind Scripture paragraphs.

### Prayer

Prayer is now human/request-first rather than administration-first.

The main Prayer screen, Prayer Detail, Focused Prayer, Add Prayer, People, Categories and scheduling/settings all share one coherent system while preserving existing queue, scheduling, conflict and draft-safety behavior.

### History

History now combines a reflective monthly overview, recent activity, calendar navigation and detailed day/moment views without introducing streaks, rankings or spiritual performance metrics.

## Supporting workflows

The Morning Grace system also covers:

- Reflection;
- full M’Cheyne reading plan;
- Scripture Collections;
- global local search;
- Data & Backup;
- loading, offline/update and recovery states;
- edit-conflict review;
- unsaved-draft dialogs.

## Accessibility and responsive behavior

The release keeps the existing accessibility and resilience requirements:

- semantic keyboard navigation;
- visible focus indicators;
- automated WCAG A/AA checks;
- 320px reflow;
- 200% text resizing;
- reduced-motion support;
- authored dark-mode contrast;
- Firefox, WebKit, desktop Chromium and mobile Chromium coverage;
- controlled offline-PWA journeys.

Exact release-test results are attached to the immutable GitHub release generated from the deployed commit.

## Data compatibility

No database reset or schema migration is required.

- Database schema remains **1**.
- Backup format remains **1**.
- Existing reflections, prayers, Scripture annotations, History and reading progress remain in place.
- M’Cheyne completion semantics are unchanged.
- The Berean Standard Bible corpus and Scripture search identities are unchanged.

The 1.0.1 corrective-release integrity fixes remain intact, including serialized reading imports, stale-edit protection, draft-safe lifecycle actions, complete Exodus 12 coverage and Scripture text normalization.

## Privacy boundaries

This release does not change MDD’s local-first privacy model.

Live IndexedDB records are not application-encrypted. Optional encrypted backups protect the exported backup file, not the live database. Soft-deleted records may remain as tombstones and can remain in backups. Apps on the same origin share the browser-storage security boundary.

## Release evidence

The release is published only after:

1. locked dependency installation;
2. production dependency audit;
3. unit/integration verification;
4. complete Scripture and M’Cheyne verification;
5. cross-browser and accessibility journeys;
6. release packaging and checksum verification;
7. deployment of the exact certified artifact;
8. deployed-file identity verification.

The GitHub release assets include the certified web package, checksums, release manifest and deployment verification for the exact source commit.
