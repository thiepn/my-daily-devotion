# My Daily Devotion 1.2.1 — Mobile-native navigation polish

Version 1.2.1 is a small follow-up to the 1.2.0 mobile-first redesign.

## Phone navigation

Secondary phone routes now use a native-style Back affordance directly in the compact app bar.

This covers:

- Reading Plan and Reflection → Today
- Scripture Collections → Bible
- Add Prayer, People, Categories and Focused Prayer → Prayer
- Prayer settings → the corresponding Prayer detail
- Prayer detail → Prayer
- History Moments and History Day → History
- Search and Data → Today

The older in-content “Back” links remain on desktop, but are hidden on phone so the same action is not repeated in two places.

## Why this release exists

The 1.2.0 redesign successfully replaced the previous desktop-stacked phone layout with compact mobile composition. A final visual review showed that secondary workflows still used webpage-style back links inside their content. Moving that action into the phone app bar makes those screens behave more like a native mobile application.

## Compatibility

This release changes navigation presentation only.

- Database schema remains **1**.
- Backup format remains **1**.
- Scripture, M’Cheyne, Prayer, History and search semantics are unchanged.
- Desktop/tablet layout remains unchanged.
- All 1.2.0 mobile density, reflow, dark-mode and accessibility work remains intact.

## Verification

The release candidate must pass the full cumulative release matrix, including unit/integration, Chromium/Firefox/WebKit, mobile Chromium, offline PWA, WCAG A/AA, 320px, 200% text resizing, Morning Grace Phase 1–5, the Mobile-first layout contract, deployment identity verification, and exact-package release hardening.
