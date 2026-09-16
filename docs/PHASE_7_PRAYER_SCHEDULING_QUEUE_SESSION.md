# Phase 7 — Prayer Scheduling, Queue & Focused Session

Status: **implemented**

Phase 7 turns Phase 6's simple least-recently-prayed flow into the complete deterministic prayer scheduling and session engine while preserving MDD's principle that prayer is not a task inbox.

## Storage

No migration is required. The database remains schema v1 because Phase 1 already provisioned `prayerSchedules`, `prayerSessions`, `prayerSessionItems`, `people`, and `categories`.

## People & categories

A prayer may optionally reference one first-class Person and one flat Category. People support name, relationship and notes. Categories start with the restrained defaults Personal, Family, Friends, Church, Mission, Study/Work and World. Both remain optional. Nested categories and generic tags are still rejected.

Metadata that is still referenced by a prayer cannot be deleted until the prayer is reassigned, preventing silent orphaning.

## Recurrence

Supported modes are exactly the Phase 0 contract:

- normal rotation;
- daily;
- selected ISO weekdays;
- every N calendar days from an anchor date;
- monthly;
- one specific date;
- manual only.

Recurrence is evaluated against the current local calendar date, not elapsed 24-hour durations. Calendar arithmetic is DST-safe. A monthly day beyond the length of a month clamps to that month's last day.

Missed recurrence never creates debt. A request scheduled for yesterday is not automatically overdue today. A fixed schedule already prayed on the current local date is no longer considered due again in another same-day session.

## Event dates & Focus

Event date and Focus are optional and distinct from recurrence.

An event is boosted the day before, the day itself and one follow-up day after. After that it has no queue influence. Focus uses `focusUntil` to temporarily keep a request near the front and expires naturally by local date. There is deliberately no permanent Low/Medium/High/Critical priority field.

## Deterministic queue

Only active, non-deleted prayers are automatically eligible. Manual-only prayers never enter automatic sessions.

Queue precedence is:

1. `FOCUS_OR_EVENT`
2. `FIXED_DUE`
3. `NEVER_PRAYED`
4. `ROTATION`

Each prayer is deduplicated after every band. Rotation remains deterministic: never-prayed first where appropriate, then `lastPrayedAt` ascending, `createdAt` ascending and stable ID.

Quick, Regular and Extended are target depths of 4, 10 and 20. If genuinely due Focus/event/fixed requests exceed the target, they are not discarded simply to hit a number.

## Durable focused sessions

Focused Prayer now persists a frozen queue as one `PrayerSession` plus ordered `PrayerSessionItem` rows. Leaving the screen does not lose position. Returning on the same local date resumes the exact same session and queue even if another depth button is selected.

`Next` records the prayer as prayed, updates `lastPrayedAt`, writes `PRAYER_PRAYED`, and stores item outcome `NEXT`.

`Skip` advances with outcome `SKIP` and never changes `lastPrayedAt`.

`Answered` creates the normal atomic PrayerResolution and marks the session item `ANSWERED`.

If a queued prayer is answered, archived, waiting or removed elsewhere before resume, reconciliation prevents stale prayer work from resurfacing. When no pending items remain, the session closes automatically. The user may also explicitly End session without producing a score or completion statistic.

An unfinished session from a previous local date is closed before a new day's queue is created so date-sensitive recurrence is never carried stale across midnight.

## Timezone behavior

Historical local dates remain unchanged. Current recurrence uses the user's present local calendar date. IANA timezone conversion is explicit and tested, including dates that differ for the same UTC instant in Europe and North America. DST boundaries use civil-date arithmetic rather than milliseconds-per-day assumptions.

## UI

- Quick Add keeps the prayer body as the only required field and hides administration behind **Add details**.
- Prayer detail exposes metadata in a secondary administrative section with a dedicated editor.
- People and Categories have small management screens under Prayer.
- Today shows Resume when a session is open.
- Prayer shows Resume session and explains that depth numbers are targets, not hard caps.
- Focused Prayer foregrounds the request, optional person, latest update and Scripture while hiding schedule/category clutter.

## Verification

`npm run verify:phase7` re-runs every earlier gate, the full production build and Phase 7-specific checks. Tests cover recurrence modes, DST-safe calendar arithmetic, timezone conversion, event windows, four-band ordering, dedupe, manual-only exclusion, missed-recurrence behavior, same-day fixed-due suppression, due overflow, lifecycle exclusion, People/category integrity, durable Next/Skip semantics, concurrent session start protection, date rollover and external-answer reconciliation.
