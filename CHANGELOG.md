# Changelog

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
