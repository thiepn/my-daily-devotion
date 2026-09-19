# My Daily Devotion — Morning Grace Editorial

## Phase 4 — Secondary Workflows

Status: **implemented on redesign branch**

Phase 4 extends Morning Grace from the four canonical screens into the workflows that support daily use.

The goal is not to give every utility screen a large hero. Secondary screens are intentionally quieter. They inherit Morning Grace typography, paper surfaces, natural accents, fine rules, and occasional motifs while preserving functional density where it is genuinely useful.

## Reflection — devotional journal

Reflection now behaves visually like a writing workspace rather than a form.

- the writing area receives the dominant surface;
- reading typography is used in the editor;
- linked Scripture and prayer handoff sit in a quieter context column;
- a single botanical cue connects the workspace to the Morning Grace visual system;
- formatting controls stay available but visually subordinate.

Draft safety, revision conflict handling, linked Scripture, and Reflection → Prayer handoff are unchanged.

## Full M’Cheyne plan — devotional almanac

The full plan is framed as a month-by-month reading almanac rather than a spreadsheet.

- plan progress is factual;
- the current day receives a restrained morning accent;
- each day groups its four readings clearly;
- Family / Private grouping remains visible;
- progress import stays explicit and separate.

There are no streaks, penalties, or “catch-up debt” concepts.

## Prayer detail — prayer story

The prayer request itself is visually primary.

Request wording uses reading typography and the lifecycle / answer / update history follows beneath it. Administrative context remains available but secondary.

Answered-prayer reflection receives a warm Morning Grace treatment without turning it into an achievement badge.

## Prayer settings, People, Categories — quiet administration

These screens now share one clear editorial administration language:

- fine rules;
- restrained paper panels;
- terracotta Prayer accent;
- master/detail layouts only where useful;
- clear form controls and conflict states.

They remain intentionally quieter than the main Prayer screen.

## Focused Prayer — sanctuary mode

Focused Prayer is treated as a dedicated devotional surface.

One request occupies the visual center. A restrained botanical motif sits in the background, and **Prayed · Next** remains the dominant action.

Session persistence, answer handling, updates, Scripture context, skip behavior, and end-session behavior are unchanged.

## Collections — Scripture library

Collections now read like a small Scripture library:

- collection index on the side;
- selected collection content as the primary reading surface;
- passage rows separated by editorial rules;
- add/remove behavior remains unchanged.

## Search — editorial index

Search receives a strong search field, restrained filters, and grouped editorial results.

Scripture and personal results remain fully local and preserve existing navigation behavior.

## Data & Backup — personal archive

Data remains intentionally utilitarian.

The page uses the Morning Grace visual language without obscuring:

- local-storage limitations;
- backup encryption boundaries;
- Markdown export;
- merge vs replace semantics;
- validation-before-restore;
- destructive replace confirmation.

Safety language is not softened for visual consistency.

## Responsive behavior

At phone widths, all master/detail layouts collapse to one column.

At 200% text size, Reflection, Prayer detail, metadata, Collections, Plan day rows, and plan summary all reflow without requiring horizontal scrolling.

## Functional preservation

Phase 4 changes presentation and layout only. It does not change the database schema, backup format, search index, M’Cheyne completion semantics, prayer scheduling/session semantics, revision conflict rules, or data portability behavior.

## Source of truth

- Contract: `canonical/morning-grace-secondary-workflows.v1.json`
- Styles: `src/styles/morning-grace-secondary.css`
- Verification: `scripts/verify-morning-grace-phase4.mjs`
- Browser acceptance: `tests/ux/morning-grace-secondary.spec.ts`

## Phase boundary

With Phase 4, both the primary and secondary product surfaces are in the Morning Grace system.

Remaining work should be cross-app refinement rather than another structural redesign: motion, consistency cleanup, final visual-fidelity review, and eventual release integration.

Production remains unchanged until the redesign PR is deliberately merged.
