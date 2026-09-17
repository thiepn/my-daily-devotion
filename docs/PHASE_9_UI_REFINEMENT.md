# Phase 9 — Dedicated UI Refinement

Status: **implemented**

Phase 9 turns the fully implemented devotional product from Phases 0–8 into one deliberately composed interface without adding new devotional systems or changing the local data model. The frozen Phase 2 visual system remains authoritative: **quiet editorial reading journal**, typography before decoration, page-like rather than dashboard-like, restrained shape, no decorative gradients, no default shadows, and no gamification language.

## Objective

The purpose of this phase is consistency and intentionality. Later feature phases introduced many valid local interfaces—prayer administration, verse actions, history, search, collections and data portability—but also accumulated different control heights, action treatments, spacing rules and responsive behaviors. Phase 9 adds a final refinement layer so the application reads as one product instead of a sequence of feature implementations.

No IndexedDB schema, repository semantics, Scripture data, M’Cheyne behavior, prayer queue logic, search behavior or portability format changes are part of this phase.

## Application chrome

The shell now exposes product context instead of implementation metadata. The former user-visible phase label is removed and the utility bar presents a quiet “Devotional workspace / Private on this device” context alongside Search, Data and theme controls.

Primary navigation retains the established architecture—Today, Bible, Prayer and History—with an explicit active-state class on both the desktop rail and mobile bottom navigation. Desktop remains a narrow editorial rail; mobile remains bottom-navigation-first.

## Shared component refinement

`src/styles/phase9.css` loads after all feature-specific styles and acts as the final visual contract for implemented screens.

The refinement layer normalizes:

- screen gutters, title scale, introductory copy measure and section rhythm;
- primary, quiet and destructive action hierarchy;
- form fields, selects, text areas and common control sizing;
- action rows and wrapping behavior;
- list-row density and long-text handling;
- empty states without introducing cards or dashboard widgets;
- small, deliberate radii instead of universal rounded containers;
- minimum practical touch sizes for the normal interactive controls introduced across feature phases;
- disabled and hover states while preserving the existing light/dark palettes.

The layer deliberately contains no gradients or default box shadows.

## Screen refinement

### Today and M’Cheyne

Plan setup choices are visually returned to rules, whitespace and typography rather than reading as a card grid. Reading rows, full-plan rows, earlier-unread items and plan actions use a more consistent rhythm and responsive density.

### Bible

Book/chapter controls, chapter navigation and the selected-verse action dock now share the final control scale. Scripture remains page-first with the existing narrow reading measure and editorial typography; inline verse numbers are not inflated into disruptive button blocks.

### Reflection

The editor, formatting controls, linked-Scripture context and actions share a coherent scale. Optional reflection prompts are no longer styled as oversized pills. On wide screens, contextual Scripture/prayer material can remain visible beside the writing surface without changing the underlying workflow.

### Prayer

Capture, scheduling/details, status tabs, lifecycle actions, focused sessions, prayer history, People/Categories and settings are normalized to the same form and action language. The primary prayer list remains linear rather than becoming a card dashboard.

### History

Calendar navigation, tabs, day cells, timeline entries and Moments keep the factual “remember” emphasis established in Phase 8. Empty dates remain neutral and there is still no streak, heatmap or score treatment.

### Search, Collections and Data

Search controls and grouped results receive a consistent input/result rhythm. Collections retain the Scripture-only master/detail model while gaining a stronger desktop sidebar composition. Backup, restore and export remain explicit, calm administrative interfaces rather than prominent dashboard cards.

## Responsive matrix

Phase 9 explicitly authors layout behavior for the following classes of viewport:

- **Android / narrow phone:** approximately 320–430 px CSS width, including wrapped actions, compact headings, usable reader actions and bottom-navigation clearance.
- **Tablet / compact desktop:** approximately 760–980 px, where multi-column contexts collapse before they become cramped.
- **Desktop:** standard editorial rail plus full content workspace.
- **Wide desktop (1100 px+):** Reflection, Prayer detail/capture, metadata editing and Collections use restrained sticky contextual/master-detail regions where appropriate.
- **Short landscape:** viewports at or below roughly 520 px high reduce decorative vertical spacing while retaining usable controls.
- **Long content / larger text:** grid and flex children permit shrinking, user text can wrap, and action groups can wrap or stack rather than overflow.

These are CSS layout guarantees, not a substitute for the formal accessibility and device validation scheduled later.

## Scope boundaries

Phase 9 intentionally does **not** implement:

- service-worker or installable PWA behavior;
- offline-startup certification or update handling;
- storage-persistence requests;
- final WCAG/accessibility validation;
- performance profiling and low-end-device optimization;
- database migration recovery work;
- formal UX validation studies or new workflows created merely to fill visual space.

Those resilience/platform concerns belong to **Phase 10 — PWA, Accessibility, Performance & Resilience**. Formal UX validation follows later; Phase 9 is visual and interaction-surface refinement, not a new feature-discovery phase.

## Definition of done

Phase 9 is complete when:

1. the Phase 2 visual character remains intact across all implemented Phase 8 functionality;
2. development-phase labels are absent from normal product chrome;
3. common controls and actions follow one sizing and hierarchy system;
4. major screens have authored narrow, tablet, desktop and short-landscape behavior;
5. wide-screen master/detail screens use the available space intentionally without becoming dashboards;
6. long user-authored content can wrap without breaking layouts;
7. no new feature system or data-model change was introduced to solve a visual problem;
8. all previous cumulative verification remains green.

## Verification

Run:

```bash
npm run verify:phase9
```

The Phase 9 gate reruns every earlier contract, TypeScript check, test suite, generated Scripture/M’Cheyne build and feature verifier before checking the final refinement layer, product chrome, responsive coverage, versioning and visual guardrails.
