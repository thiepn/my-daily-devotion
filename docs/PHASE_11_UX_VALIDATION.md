# Phase 11 — UX Validation

Status: **implemented**

Phase 11 validates My Daily Devotion as a complete devotional experience rather than adding another feature system. The product remains the Phase 0–10 application; this phase adds browser-level evidence, closes UX defects found by those journeys, and freezes those fixes into a repeatable certification gate.

## Validation principle

The primary journey remains:

**Read → Respond → Pray → Remember**

Validation is therefore organized around meaningful user journeys rather than isolated components or screenshot polish. A defect discovered during validation is fixed and then preserved by an automated regression check.

## Browser validation harness

Phase 11 adds Playwright Test against the production Vite build. Tests run against `vite preview`, not the development server, so lazy chunks, service-worker behavior and production asset paths are exercised as shipped.

Three browser profiles are used:

- **desktop-chromium** — 1440×900, service workers blocked for fast deterministic product journeys;
- **mobile-chromium** — 390×844 touch/mobile emulation, with explicit 320px reflow checks;
- **offline-pwa** — production Chromium with service workers enabled for install/cache/offline behavior.

Failed runs retain screenshots, traces and video in CI for diagnosis.

## Core journey validation

The browser suite certifies:

1. First-run M’Cheyne setup → Today reading → Bible → explicit reading completion → factual progress on return.
2. Bible John 3:16 → Reflection → saved response → Prayer → prayed-now action → History.
3. Bible selection → Scripture Collection → local search → Scripture result recovery.
4. Stable navigation between Today, Bible, Prayer, History, Search and Data on both desktop and mobile layouts.

These tests validate actual IndexedDB-backed behavior through the user interface rather than bypassing repositories with test-only APIs.

## Accessibility validation

`@axe-core/playwright` scans major application surfaces against WCAG A/AA rules. Additional browser assertions cover areas automated rule engines do not adequately certify:

- skip navigation;
- SPA route focus movement;
- meaningful accessible names for date and calendar controls;
- dark-theme contrast scanning;
- keyboard navigation through primary app routes;
- route-specific document titles.

Phase 11 closes the focus and labeling defects exposed by this validation rather than suppressing the rules.

## Reflow and device validation

The suite validates:

- 320px-wide mobile reflow without horizontal document scrolling;
- mobile primary-navigation touch targets of at least 44px height;
- core screens at 200% text resizing without horizontal scrolling;
- desktop and mobile versions of the main devotional journeys.

These checks complement the authored responsive CSS from Phase 9 with rendered-browser evidence.

## Offline PWA validation

The PWA profile waits for the production service worker to finish installation and control the application, then disables networking entirely. A fresh page is opened from that controlled storage state to model a cold offline launch.

The offline test verifies that the user can:

- reopen the app with no network;
- open John 3 from the bundled BSB;
- select John 3:16;
- navigate to Search;
- search `John 3:16` from the cached 31,086-verse local index;
- see the application's offline platform state.

This is browser-level evidence for the offline contract established structurally in Phase 10.

## Scope discipline

Phase 11 does not add social features, AI devotion generation, cloud sync, new devotional databases, gamification, new prayer mechanics or a new visual direction. Database schema version 1 remains unchanged.

The purpose is to make existing workflows clearer, more reachable, and demonstrably robust.

## Verification

Run:

```bash
npm run verify:phase11
```

The command reruns Phases 0–10, the full Vitest suite and production build, then executes the Playwright desktop/mobile/PWA validation suite and the Phase 11 contract verifier.

## Next phase

**Phase 12 — Release Hardening** is the final defect-closure, release-candidate and shipping-certification phase. It should consume Phase 11's validated UX as frozen product behavior rather than reopening broad feature design.
