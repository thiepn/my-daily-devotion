# Phase 12 — Release Hardening

Status: **implemented**

Phase 12 is the final planned development phase for My Daily Devotion 1.0. It does not reopen product design or add normal feature scope. It converts the Phase 11-validated application into a reproducible, auditable release candidate and closes defects found by the release gate.

## Release boundary

The release candidate is **My Daily Devotion 1.0.0**.

The product contract remains unchanged:

**Read → Respond → Pray → Remember**

Database schema version 1 remains frozen. There is no cloud-account dependency, social layer, AI-generated devotional content, gamification, or new devotional subsystem in this phase.

## Hardening work

Phase 12 requires all of the following:

- exact application/package/service-worker version alignment at `1.0.0`;
- a committed npm lockfile and `npm ci` in certification CI;
- production-dependency vulnerability auditing at high/critical severity;
- the complete Phase 0–11 verification chain;
- browser smoke coverage for direct/cold loading of primary routes and invalid-route recovery;
- a production-only content-security policy and no-referrer policy;
- final PWA install metadata;
- no source maps or obvious development residue in the production build;
- a checksummed, versioned production archive generated from `dist/`;
- release-manifest verification, including database schema version and every bundled BSB asset;
- retention of the validated backup → delete → restore recovery contract;
- release documentation, privacy/data documentation, changelog, and operator checklist.

## Reproducibility

Direct dependency versions are pinned exactly and `package-lock.json` freezes the transitive graph. CI installs with:

```bash
npm ci --ignore-scripts
```

The release build therefore certifies the committed dependency graph rather than resolving a fresh transitive graph on every run.

## Security and privacy hardening

MDD remains local-first. The production document applies a self-only CSP for scripts, styles, images, fonts, network connections, workers and manifests, with only the existing inline theme bootstrap allowed. Referrer transmission is disabled.

CI runs:

```bash
npm run audit:prod
```

This treats high or critical vulnerabilities in production dependencies as release blockers.

## Release artifact

`npm run release:package` performs a clean production build and writes:

- `release/my-daily-devotion-1.0.0-web.zip`
- `release/release-manifest.json`
- `release/SHA256SUMS`

The archive contains the complete deployable PWA, including the application shell, lazy route chunks, icons, M’Cheyne plan, all 66 normalized BSB book assets, and the local Scripture search corpus.

The final verifier recomputes the archive SHA-256, opens the ZIP, and checks mandatory files against the generated Bible manifest.

## Release smoke matrix

The production Vite preview is exercised in Chromium on desktop and touch/mobile profiles. Release smoke tests verify that primary routes can cold-load without browser runtime errors and that an invalid deep link recovers to Today rather than producing a blank application. Phase 11 continues to certify WCAG, reflow, the devotional loop, and cold-offline PWA behavior.

## Shipping rule

MDD 1.0.0 is shippable only when all of the following are green on the same commit:

1. independent Phase 0 canonical contract;
2. `npm ci` from the committed lockfile;
3. production dependency audit;
4. cumulative `npm run verify:phase12`;
5. checksummed release artifact generation;
6. no failed browser tests or release verifier assertions.

A failed release gate is fixed and rerun. It is not waived by documenting the failure.

## Verification

Run:

```bash
npm run verify:phase12
```

After Phase 12, broad phased development ends. Future work should use ordinary maintenance, bug-fix, dependency-update, or explicitly scoped feature releases rather than opening another automatic roadmap phase.
