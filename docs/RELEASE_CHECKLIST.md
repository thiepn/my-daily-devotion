# MDD 1.2.6 Release Checklist

This checklist is operational. Automated gates remain authoritative where they exist.

## Source and version

- [x] Product version is `1.2.6` in `package.json` and `src/app/version.ts`.
- [x] Service-worker cache generation is `mdd-app-v1.2.6`.
- [x] Database schema remains version 1.
- [x] Direct dependency versions are exact and `package-lock.json` is committed.
- [x] Morning Grace changes presentation only; schema 1 and existing domain semantics remain unchanged.

## Data safety

- [x] Backup creation and validated restore remain covered by automated tests.
- [x] Destructive backup → database deletion → restore recovery remains covered.
- [x] Unsupported newer database schemas are rejected without destructive clearing.
- [x] Restore validation occurs before live data modification.
- [x] Privacy/data ownership behavior is documented.

## PWA and offline

- [x] Manifest, icons and install metadata are present.
- [x] Complete application lazy-route graph is precached.
- [x] All 66 BSB book assets, the Scripture search index and M’Cheyne plan are cached.
- [x] Cold offline Bible and Scripture search journey is browser-tested.
- [x] Service-worker update activation remains user-controlled.

## UX and accessibility

- [x] Desktop and touch/mobile devotional journeys are browser-tested.
- [x] Automated WCAG A/AA checks are green.
- [x] Keyboard route focus and skip navigation are green.
- [x] 320px reflow and 200% text resizing are green.
- [x] Primary routes cold-load without runtime errors.
- [x] Invalid routes recover to Today instead of rendering a blank shell.

## Security and build hygiene

- [x] Production CSP limits resources and network connections to self.
- [x] Referrer transmission is disabled.
- [x] CI runs a high/critical production dependency vulnerability gate.
- [x] Production build contains no source maps.
- [x] Release verifier rejects obvious development residue in shipped text assets.
- [x] Generated browser/build/release output is excluded from source control.

## Packaging

- [x] `npm run release:package` generates a versioned web/PWA ZIP.
- [x] SHA-256 is emitted in `SHA256SUMS`.
- [x] `release-manifest.json` records version, schema, archive size and checksum.
- [x] Final verifier opens the archive and confirms mandatory app, Scripture, search and M’Cheyne files.
- [x] Release CI uploads the checksummed package as an Actions artifact.

## Ship rule

Ship only from a commit where the independent Phase 0 contract and cumulative Phase 12 Release Certification workflow both conclude successfully. Do not waive a failed gate by checking this document manually.

- [x] Mobile-first layout contract passes, including 320px, phone landscape and desktop-preservation checks.

- [x] Mobile-native Back navigation remains phone-only and desktop in-content navigation remains available.
- [x] Root bottom tabs and Search/Data utilities are hidden on pushed mobile routes.
- [x] Pushed mobile Back targets are at least 44×44 CSS pixels and preserve validated devotional return context.
- [x] Active Focused Prayer may become immersive without removing Back navigation from empty or finished states.

- [x] Search and Data preserve their mobile source route and query state through Back navigation.
- [x] Search query/filter mutations retain the validated return target.

- [x] Prayer Detail/Settings and People/Categories use dense phone compositions without changing desktop layout.
- [x] History Day/Moments preserve visible context and compact timeline navigation on phone.
- [x] Dense secondary workflows pass 320px and 200% text reflow coverage.

- [x] Unsaved-change confirmation is a safe-area-aware mobile bottom sheet with 44px+ actions.
- [x] Conflict review, recovery/error and empty states use compact mobile-native compositions.
- [x] Offline/update status uses a slim mobile system strip and reflows at 200% text.

- [x] Pushed-route navigation starts at the top while app-bar Back restores the source route's previous scroll position.
- [x] Destructive People/Categories/Collections/Reflection/Prayer actions use accessible in-app confirmation instead of browser-native confirmation.
- [x] Mobile confirmation actions are at least 48px high and Cancel receives initial focus.
- [x] Coarse-pointer navigation receives deliberate touch feedback without disabling pinch zoom.
- [x] Focused inputs and textareas clear sticky mobile chrome through scroll margins.
- [x] Prayer capture supports Ctrl/Cmd+Enter save without changing normal Enter/newline behavior.
