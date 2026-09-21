# Changelog

## 1.2.4 — 2026-09-21

### Dense secondary mobile workflows

- Recompose Prayer Detail as a compact single-stream mobile story with denser lifecycle actions, updates and context rows.
- Keep Prayer status visibly present after the desktop secondary heading collapses.
- Rebuild Prayer Settings as a flat mobile settings page with tighter fields, compact weekday selection and a sticky save bar.
- Put the People/Categories editor before the saved list on phone so add/edit work does not require scrolling past the collection.
- Convert People/Categories rows into compact native-style management rows with 44px actions.
- Recompose History Moments with a compact local segmented switcher and denser timeline rows.
- Keep the full History Day date visible after the desktop H1/eyebrow collapse.
- Tighten History Day/Moments entry typography and vertical rhythm without changing stored history semantics.
- Add 320px, 200% text, accessibility and desktop-preservation coverage for these secondary workflows.
- Preserve the 1.2.3 contextual utility navigation, root mobile screens, desktop/tablet Morning Grace composition, database schema 1 and backup format 1.

## 1.2.3 — 2026-09-21

### Contextual mobile utilities

- Make Search and Data remember the exact root screen that opened them instead of always returning to Today.
- Preserve Bible chapter/verse context, Prayer status filters and History route context through mobile utility navigation.
- Keep the return target when Search submits a query or changes its filters.
- Add contextual return behavior to Search Bible, Collections → Search and History → Search entry points.
- Keep direct-open Search/Data routes safely falling back to Today.
- Preserve the 1.2.2 stacked-screen shell, desktop/tablet Morning Grace composition, database schema 1 and backup format 1.

## 1.2.2 — 2026-09-21

### Stacked mobile app flows

- Keep Today, Bible, Prayer and History as the four persistent root tabs while removing the root tab bar from pushed/detail workflows.
- Hide unrelated Search/Data app-bar actions on secondary screens and use the route title plus a 44×44 Back control instead.
- Remove duplicate visual secondary H1 chrome on phone while retaining semantic H1 structure for accessibility.
- Preserve explicit return context across Bible → Reflection, Reflection → Prayer and Prayer detail/settings flows instead of depending on browser history.
- Make active Focused Prayer immersive while keeping native Back navigation on empty, unavailable and finished session states.
- Add safe-area-aware app-bar/Bible-toolbar geometry and safe-area-aware sticky actions for Reflection and Add Prayer.
- Tighten keyboard-first editor sizing and keep primary save actions reachable near the bottom edge.
- Extend 320px, 200% text-resize, phone-landscape, accessibility and visual certification coverage for pushed mobile screens.
- Preserve desktop/tablet Morning Grace layouts, database schema 1, backup format 1 and devotional domain semantics.

## 1.2.1 — 2026-09-21

### Mobile-native secondary navigation

- Move phone Back navigation for secondary routes into the compact mobile app bar.
- Hide duplicate in-content Back links on phone while retaining them on desktop.
- Route Reading Plan/Reflection to Today, Collections to Bible, Prayer subroutes to their Prayer parent, History detail/moments to History, and Search/Data to Today.
- Preserve all 1.2.0 mobile-first layouts, desktop/tablet layouts, schema 1, backup format 1 and existing domain semantics.

## 1.2.0 — 2026-09-21

### Mobile-first application redesign

- Rebuild the phone layout as a dedicated application composition instead of stacked desktop screens.
- Add compact sticky phone app bar and fixed four-tab bottom navigation.
- Move phone appearance controls into Data / Appearance while preserving accessible Search and Data actions.
- Replace large Today reading cards with a grouped four-reading list and compact response surfaces.
- Make Bible reading-first on phone with compact sticky book/chapter controls and no decorative chapter artwork.
- Recompose Prayer with tighter request rows, compact focused-prayer controls and horizontal status tabs.
- Recompose History with compact segmented navigation, three-column monthly summary and denser calendar.
- Extend compact phone treatment to Reflection, Plan, Add Prayer, Prayer Detail, Focused Prayer, Collections, Search, Data and History detail screens.
- Treat phone landscape up to 900×500 as the mobile application layout instead of falling back to tablet composition.
- Preserve desktop/tablet Morning Grace layouts, database schema 1, backup format 1 and all existing domain semantics.

## 1.1.0 — 2026-09-20

### Morning Grace Editorial

- Replace the original visual presentation with the Morning Grace Editorial system across canonical and secondary screens.
- Add the Morning Sprig Book brand mark, unified editorial icon family, botanical/sunrise/landscape motifs, warm paper palette and authored light/dark themes.
- Redesign Today around the daily M’Cheyne readings and response flow; redesign Bible around Scripture-first chapter reading; redesign Prayer around requests and people; redesign History around reflective factual recall.
- Extend Morning Grace to Reflection, full reading plan, Prayer detail/settings/People/Categories/Focused Prayer/Add Prayer, Collections, Search and Data/Backup.
- Normalize application chrome, controls, loading/error/offline states, conflict review and unsaved-draft dialogs.
- Preserve responsive 320px layouts, 200% text resizing, reduced-motion behavior and automated WCAG A/AA validation.
- Preserve database schema 1, backup format 1, Scripture corpus, M’Cheyne semantics, prayer scheduling/queue behavior and all 1.0.1 corrective integrity fixes.

## 1.0.1 — 2026-09-17

- Serialize reading imports and completion edits; repair historical duplicate reading records without erasing data or changing schema 1.
- Reject stale prayer settings, People, category, and collection saves. Add explicit conflict comparison and draft-safe in-page actions.
- Add recoverable mutation errors, pending guards, atomic enrollment/import, and calendar-date validation.
- Refresh date-sensitive reading and prayer entry screens across midnight and foreground changes without resetting historical editors.
- Correct March 1 to Exodus 12:21–51, preserving existing completion; verify every bundled verse against the complete annual schedule.
- Normalize 28 closing-quote boundaries and preserve block/verse spacing in copied passages; cross-check reader, search, and copy text across the full corpus.
- Include shipped fflate in runtime dependency auditing and notices.
- Add Firefox/WebKit regression projects and commit-linked machine-readable release evidence; package the tested build without rebuilding it.
- Clarify unencrypted local storage, origin boundaries, soft deletion, and backup retention.

## 1.0.0 — 2026-09-17

First complete release of My Daily Devotion.

### Scripture

- Full offline Berean Standard Bible with 66 canonical Protestant books.
- Semantic Bible reader preserving headings, paragraphs, poetry, superscriptions and reader-relevant markup.
- Highlights, bookmarks, reader position, verse notes and Scripture collections.
- Local 31,086-verse search index and reference-aware Scripture search.

### Daily reading

- Complete 365-assignment M’Cheyne plan with four readings per assignment.
- Calendar and self-paced modes, explicit completion state, progress import and earlier-unread access without streak mechanics.
- Today flow integrated directly with Bible reading.

### Reflection and prayer

- Dated reflections with structural Scripture links.
- Quick prayer capture, lifecycle states, answered-prayer history and source provenance.
- Scheduling, deterministic prayer queue, People/categories, event/focus metadata and resumable focused prayer sessions.

### Remember

- Automatic devotional History calendar and day views derived from meaningful activity.
- Moments view for reflections, Scripture and prayer developments.
- Grouped local search across Scripture and personal devotional data.

### Data ownership

- Local-first IndexedDB persistence with UUID/revision/tombstone semantics.
- Plain portable export.
- Checksum-validated `.mddbackup` export and restore, with optional password encryption.
- Restore validation before live data modification and destructive backup-recovery tests.

### Application quality

- Quiet editorial light/dark visual system across phone, tablet and desktop layouts.
- Installable offline PWA with dedicated icons and complete BSB/search/M’Cheyne/application caching.
- Route-level code splitting, safe service-worker updates and persistent-storage handling.
- WCAG A/AA automated validation, keyboard/focus checks, 320px reflow and 200% text-resize validation.
- Desktop, mobile and controlled cold-offline browser journeys for the complete Read → Respond → Pray → Remember loop.

### Release hardening

- Reproducible dependency lockfile and `npm ci` certification.
- Production dependency vulnerability gate.
- Self-only Content Security Policy and no-referrer policy.
- Runtime-error release smoke tests and invalid-route recovery validation.
- Versioned release ZIP, release manifest and SHA-256 checksum.

### Complete product audit and remediation

- Protect drafts and reject stale edits; serialize related writes and repeated reading completion.
- Validate backup record shapes, Scripture bounds, duplicates and relationships; preserve newer local writes during restore validation.
- Restore archived answered prayers correctly; complete collection management and exact-verse navigation.
- Keep deleted devotional text out of History and constrain internal return links.
- Refine editorial headings, reader spacing, mobile utilities, control readability, wrapping and restore feedback.
- Isolate offline caches per build; preserve old-tab chunks and pending updates; recover from interrupted installation.
- Expand behavioral, adversarial, accessibility, responsive and offline coverage. See [the product audit](docs/PRODUCT_AUDIT_2026-09-17.md).
