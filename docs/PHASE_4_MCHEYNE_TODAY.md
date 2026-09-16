# Phase 4 — M’Cheyne & Today

Status: **implemented**

Phase 4 connects the real Phase 3 Scripture platform to a complete daily M’Cheyne workflow while preserving the Phase 0 rule that reading completion is explicit and independent from scrolling, reflection, prayer, or streaks.

## Canonical plan

The repository now vendors `canonical/mcheyne/plan.v1.json`: exactly 365 fixed calendar assignments, four readings per assignment, two `family` and two historically named `secret` readings. The UI calls the latter **Private**.

The artifact is materialized from an immutable machine-readable mirror of the historical calendar and validated against the pinned BSB corpus and Phase 0 calendar anchors. It contains 1,460 logical readings and 1,461 structural Scripture ranges because the historic August 8 reading `Jeremiah 36,45` is genuinely discontiguous.

February 29 has no canonical assignment and never shifts March 1 onward.

## Calendar mode

A new user can follow the historic calendar from the current day. The enrollment begins tracking at that sequence so opening MDD in September does not invent eight months of missed-reading debt.

Today always follows the current local calendar date. Reading ahead from the full-plan view does not change Today. Unread tracked assignments remain available under a neutral Earlier unread section without streak, warning, or penalty language.

Calendar enrollments are year-scoped through `startedOn`; an old year is never reused as the current year’s progress state.

## Self-paced mode

Self-paced mode begins at Day 1 and advances to the first assignment whose four readings are not all explicitly complete. Civil-date arithmetic does not advance it.

## Existing-progress import

Calendar users can import a completed-through date. This creates or updates `ReadingProgress` records and expands the tracked range back to January 1, but deliberately does not generate `READING_COMPLETED` activity events or fake `DevotionDay` history for imported work.

## Today

The static Phase 2 Today mock has been replaced with live plan state:

- current M’Cheyne assignment;
- Family / Private labels;
- 0–4 factual progress;
- explicit completion/undo buttons;
- one-tap Continue reading to the first incomplete passage;
- factual completion copy at 4/4;
- neutral Earlier unread summary;
- leap-day explanation;
- full-plan link.

Reflection and prayer areas remain honest placeholders until Phases 5 and 6 rather than displaying invented user content.

## Full plan

`/today/plan` provides month navigation, all 365 assignments, factual 0–4 completion per day, annual reading progress, read-ahead links, and progress import. Every reading opens the real BSB reader.

## Reader handoff

M’Cheyne links carry enrollment, assignment, reading, segment, and origin context into `/bible/:book/:chapter`.

The reader:

- visually marks the assigned range without creating a user highlight;
- opens at the assignment’s actual first verse rather than an unrelated saved position;
- keeps context while navigating chapters inside a contiguous range;
- exposes separate Previous/Next passage links for discontiguous readings;
- provides explicit Mark reading complete / Mark unread controls;
- returns to Today or the full plan according to origin.

Reader position continues to persist normally and never marks a plan reading complete.

## Persistence and history

No database migration was required. Phase 4 activates the Phase 1 `PlanEnrollment` and `ReadingProgress` tables.

An explicit completion:

1. writes or updates `ReadingProgress`;
2. ensures a thin `DevotionDay` for the actual local day the action occurred;
3. appends one `READING_COMPLETED` activity event.

Undo clears current completion state with a monotonic revision but does not rewrite the historical fact that a completion event previously occurred.

## Corrective Scripture fix

Canonical plan validation exposed missing Psalm verse identities in the Phase 3 USJ normalizer when a verse milestone occurred inside a superscription container. The normalizer was corrected rather than weakening the plan validator. The pinned BSB build now produces 31,086 verse identities and retains those milestones.

## Verification

`npm run verify:phase4` runs all earlier phase gates plus Phase 4 tests and a complete plan audit. The Phase 4 verifier checks all 365 assignments, 1,460 readings, 1,461 structural ranges, canonical group order, leap-day semantics, frozen anchors, runtime-plan equality, and that every structural range endpoint exists in the generated BSB corpus.
