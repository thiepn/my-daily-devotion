# Changelog

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
