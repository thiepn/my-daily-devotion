# Phase 10 — PWA, Accessibility, Performance & Resilience

Status: **implemented**

Phase 10 turns My Daily Devotion from a complete local-first web product into an installable, offline-starting and recovery-tested application. It does not add devotional content systems or alter the Phase 0 domain contract.

## PWA and offline contract

MDD ships a standards-based web app manifest, dedicated 192 px and 512 px application icons, a maskable 512 px icon and an Apple touch icon. Static deployment uses relative Vite base paths so the same build works at a domain root or a GitHub Pages-style subpath.

A versioned first-party service worker is registered only in production. During installation it caches:

- the built HTML shell and its hashed JavaScript/CSS assets;
- the web app manifest and application icons;
- the complete M’Cheyne runtime plan;
- the BSB manifest;
- all 66 normalized BSB book assets;
- the complete local BSB verse-search index.

The install fails rather than claiming offline readiness when a required canonical offline asset cannot be cached. Navigation uses network-first behavior with the cached application shell as an offline fallback. Versioned static/Scripture requests use cache-first behavior with same-origin runtime fill for any later asset.

Service-worker updates never force a mid-session reload. A newly installed worker waits, MDD announces that an update is ready, and the user explicitly chooses **Reload to update**. Only then does the waiting worker activate and reload the controlled page.

## Local-storage resilience

On startup MDD requests persistent browser storage where the Storage Manager API supports it. The Data & Privacy screen reports whether storage is protected or best-effort and reports browser storage usage/quota when available. A manual persistence request remains available when the browser does not initially grant it.

Persistent-storage status is an additional safeguard, not a backup claim. The product continues to describe `.mddbackup` as the durable device-loss/browser-loss recovery mechanism.

Phase 10 adds a destructive recovery test that:

1. creates relational prayer history and a preference;
2. creates an encrypted `.mddbackup`;
3. deletes the original IndexedDB database;
4. creates a fresh database;
5. restores the validated backup;
6. verifies prayer/update/resolution/preference data and relational integrity.

A separate resilience test confirms that an app faced with a database schema newer than it supports refuses startup without clearing the existing records.

## Accessibility hardening

The Phase 9 responsive UI is retained and receives application-level accessibility hardening:

- a keyboard-visible **Skip to main content** link;
- an explicit focusable main workspace target;
- route-change announcements through a polite live region;
- page titles that follow the current route;
- accessible route-loading status while lazy chunks load;
- online/offline and update status announcements;
- a persisted Theme group rather than a visual-only preview;
- restore mode represented as a real `fieldset`/`legend` group;
- a labelled backup file input;
- Collections no longer nests one interactive action inside another button;
- `prefers-contrast: more` and forced-colors refinements;
- the existing reduced-motion and visible-focus contracts remain active.

Formal user testing with assistive technologies belongs to the UX-validation/release sequence; Phase 10 establishes and statically verifies the product primitives needed for it.

## Persisted theme

Light, System and Dark are now a real preference. The selected value is written to the IndexedDB `preferences` store so it participates in backup/restore, with a small `localStorage` mirror used only to apply light/dark before React paints. System mode removes the authored override and continues to follow the operating-system preference.

## Performance

Feature screens are route-level lazy imports behind `React.lazy` and `Suspense`, so Today does not eagerly execute Prayer administration, History, Search and backup/ZIP code at startup. Scripture search remains an on-demand data asset and is not included in the JavaScript entry bundle.

The Vite build uses portable relative asset paths and a stricter chunk warning threshold. The Phase 10 verifier inspects the production `dist` output and requires multiple JavaScript chunks plus a bounded entry chunk rather than accepting a return to the previous monolithic application bundle.

## Update and failure behavior

- service-worker registration failure does not prevent the online/local-data app from opening;
- offline state is visible but non-alarming because local data and precached Scripture remain usable;
- a service-worker update waits for explicit activation;
- database startup failures never automatically clear browser storage;
- the startup recovery screen explicitly advises reload/backup recovery rather than destructive reset;
- schema-newer-than-app remains a hard refusal;
- existing transactional backup/import validation remains unchanged.

## Scope boundaries

Phase 10 does **not** add accounts, cloud sync, telemetry, remote search, push notifications, devotional reminders, social features or background backup upload.

It also does not claim that static checks replace real-device evaluation. **Phase 11 — UX Validation** is next and should exercise the finished product with representative devotional workflows, phones/tablets/desktops, installed-PWA usage and assistive-technology scenarios. **Phase 12 — Release Hardening** follows that validation and owns final defect closure, packaging and release certification.

## Verification

Run:

```bash
npm run verify:phase10
```

The cumulative gate reruns Phases 0–9, TypeScript, all unit/integration tests and the production build before checking manifest/install metadata, PNG icon dimensions, service-worker offline coverage/update semantics, persistent-storage wiring, route code splitting, accessibility primitives, backup version consistency and the Phase 10 documentation contract.
