# P3 — Mobile input and storage-upgrade resilience

**Scope:** implement and test issues reproducible from the current source, without changing devotional content, schema, portable backups, release permissions or visual authority. No actual physical Android/iOS device was connected for this phase.

## Confirmed source defects and contained fixes

| Risk from source audit | Implemented correction | Evidence |
|---|---|---|
| A fixed bottom mobile navigation could remain visible when the software keyboard reduces the available visual viewport, obscuring focused text entry | Add a visual-viewport observer that suppresses the bottom tab bar only while an enabled editor is focused and viewport reduction is at least 140 CSS px; restore it on blur/keyboard dismissal; reset baseline on width/orientation change; ignore pinch zoom and hardware-keyboard focus alone | New unit classifier and narrow-screen Playwright scenarios |
| Dexie's "blocked" version-change event was emitted but ignored by PlatformStatus, leaving a waiting storage upgrade unexplained | Present a distinct blocked-upgrade message advising other tab closure without clearing the journal; retain existing post-upgrade reload notice; announce "ready" after successful DB preparation so stale messages can clear | New Playwright simulated blocked/ready/closed event scenarios |

**Data safety:** No changes to editor contents or the underlying IndexedDB migration. Keyboard visibility is presentational; blur and viewport changes cannot write devotional events. The new status never suggests deleting site storage or downgrading from schema 3.

## Evidence and acceptance

- Code-level fixes: `src/app/useMobileKeyboard.ts`, `src/app/App.tsx`, `src/styles/shell.css`, `src/app/PlatformStatus.tsx` and `src/data/database.ts`.
- Automated coverage: `src/app/useMobileKeyboard.test.ts` and `tests/ux/mobile-device-resilience.spec.ts`; includes 320px/390px widths, viewport obstruction/recovery, focus loss, local text preservation, and blocked/closed/ready upgrade status.
- Do not change or rebaseline Windows screenshots to conceal failures. The exact P3 branch must pass TypeScript/unit, browser shards, and image certification before integrating.
- Physical-phone keyboard/IME behavior is **not** proven by browser viewport simulation. P3 is code-implemented but device-qualification remains outstanding.

## Required physical-device matrix (not yet executed)

| Device category | Test | Pass condition |
|---|---|---|
| Actual Android Chrome at 320–430 CSS px | On-screen keyboard on Reflection, prayer, verse notes, Search and Collections | Caret and save actions accessible, no text loss, nav restored on close |
| Android Samsung Internet | Rotation, keyboard, scroll and safe-area insets | No content overlay or unexpected viewport bounce |
| Android Chrome PWA (installed) | Offline restart, return from background, new service worker waiting | Drafts retained when acknowledged; no forced unsaved-reload |
| Desktop Chrome/Firefox + mobile emulation | Multi-tab IndexedDB upgrade and blocked-version event | Message describes correct state; local data not reset |
| Tablet and desktop keyboard | Hardware keyboard, 200% text, dark mode, orientation | No false software-keyboard suppression, no horizontal clipping |
| iOS WebKit/iPhone when platform release is planned | Virtual keyboard and viewport resizing | No overlay; no stale fixed footer |

Each physical run must record OS/browser/device, exact code SHA, screenshots free from personal journal content, reproduction steps, severity and pass/fail. Do not label CI simulation as physical testing.

## Relation to P1/P2

P1 data compatibility and P2 certified deployment remain separately gated and unmerged at the time P3 begins. P3 may merge after its independent CI passes, but **P3 is not a production release authorization**.

Next: P4 Morning Grace visual/interaction fidelity, followed by P5 optional recovery-inclusive backup format after a reviewed portability spec.
