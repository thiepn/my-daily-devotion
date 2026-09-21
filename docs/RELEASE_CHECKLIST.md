# MDD 1.2.2 Release Checklist

This checklist is operational. Automated gates remain authoritative where they exist.

## Source and version

- [x] Product version is `1.2.2` in `package.json` and `src/app/version.ts`.
- [x] Service-worker cache generation is `mdd-app-v1.2.2`.
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
