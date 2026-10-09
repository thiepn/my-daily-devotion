# P8 — Offline Storage, Backgrounding and Update Resilience

**Status (2026-10-09):** Implementation on a stacked branch over P7 PR #52. No merge or deployment.

## Source-audited risks and changes

| Risk | Finding | Correction |
| --- | --- | --- |
| Incomplete deployment with a 200 HTML fallback | The service worker accepted HTTP success for a JS/CSS/JSON asset even if returned content was HTML, allowing a broken offline generation to install | Reject mismatched Content-Type before cache insertion, delete only the incomplete new cache and retain the old working generation |
| App scope escape | Shell links used string prefix matching and manifest-derived assets did not validate registration origin and subpath | Parse and validate identical origin and subpath for each required asset before requesting it |
| Mobile background lifecycle | The durable-draft hook flushed on hidden visibility, but not pagehide or freeze | Add best-effort pagehide/freeze checkpoint requests without claiming synchronous unload durability |
| Storage pressure | The estimate was only in Data > Advanced, and quota-exceeded drafts had no cross-screen warning | Show an advisory origin-wide estimate at 90% or higher, and surface a privacy-safe non-destructive quota error warning |
| Multi-tab IndexedDB upgrade | The original banner ignored blocked upgrades | Distinguish blocked from upgraded/closed; keep unsafe reload disabled while editing |
| Protected SW update | Existing update tokens blocked intentional activation with dirty writing | Retain the guard and add a regression test; never force reload or switch builds |

## Tests

- SW unit: interrupted install, a 200 HTML fallback for JS, subpath escape, old-generation retention and old-tab lazy chunks.
- Storage unit: finite ratio boundary, unknown estimates, nested quota exception and non-disclosure of private error text.
- Browser P8: prompt pagehide checkpoint, reload/retained private draft without a saved devotional event, quota injection and unchanged editor, estimate update on focus/pageshow, blocked/closed upgrade and protected SW update.
- Existing offline PWA cold-start, search, bundled BSB, old tab cache and partial deployment rollback checks remain required.
- The P7 keyboard/reflow/axe checks, Windows image references, exact-head CI and deployment checks remain mandatory.

## Human/device qualification outstanding

Android Chrome and Samsung Internet PWA physical devices: Home/Recents, process kill, low-memory resume, offline cold start, IME writing, storage pressure, OS updates, installed PWA and browser tabs. Verify two-tab schema upgrades and subpath/origin continuity using disposable data, no personal notes. Test interrupted network precache, recovery backup and exact-build identity. An acknowledged IndexedDB write, **not an unload callback**, is the reliable recovery boundary. No claims of human certification.

P1 migration, P2 deployment authorization, P5 format-2 backups, P6 functionality and P7 full CI remain independent gates. Nothing in P8 authorizes merge/deployment.

**Next: P9 — Platform & Release Infrastructure Consolidation.** Scope: artifact/origin integrity, qualification gates, recovery and operational rollback, route ownership, non-sensitive runtime diagnostics. Status: not started.
