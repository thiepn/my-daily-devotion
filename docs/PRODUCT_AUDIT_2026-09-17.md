# Complete product audit — 17 September 2026

This maintenance pass retains application version **1.0.0**, IndexedDB schema **1**, the local-first architecture, and Read → Respond → Pray → Remember. No dependency versions or cloud services were added.

## Findings and implemented fixes

| Area | Problem found | Result |
| --- | --- | --- |
| Functionality | Archive restoration lost answered state; collection maintenance was incomplete; exact Scripture context was lost through several links; missing/deleted routes could stall. | Answered prayers retain their resolution when restored. Collections can be renamed/deleted with duplicate protection. Search, History, reflection, prayer, and collections open the exact verse. Missing entities and failed lazy routes offer recovery. |
| Data integrity | Checksum-valid malformed records could enter restore; duplicate keys could silently overwrite; concurrent saves/completions could race; restore validation could overwrite a newer local write. | Per-table record and Scripture-bound validation, duplicate/natural-key checks, relational audits, consistent backup snapshots, transactional writes, optimistic edit revisions, and a restore baseline check prevent these cases before changing live data. |
| UX | Leaving editors discarded drafts; prayer activity refresh overwrote unsaved wording; scheduling language and focused-session actions were unclear. | Navigation/reload guards protect drafts. Prayer activity preserves edits. Schedule wording and “Prayed · Next” describe the action. In-progress sessions remain resumable. |
| UI | Restore feedback could be distant from the action; hidden destructive intent and inconsistent management controls caused friction. | Backup appears first, restore has a readable preview/cancel/explicit replace confirmation, feedback stays visible, and deletion controls consistently confirm intent. |
| Visual design | Oversized page headings, excessive vertical space, small secondary actions, and repeated empty search groups weakened hierarchy. | Smaller editorial headings, tighter rhythm, readable controls, calmer lists, compact reader chrome, and only meaningful result groups keep Scripture and personal content prominent. |
| Accessibility | Skip navigation interfered with hash routing; prayer update lacked an accessible name; some selected controls and source links were ambiguous. | Skip navigation focuses content without changing routes. Update fields, selected toggles, calendar/source actions, route announcements, and keyboard focus have behavioral coverage. |
| Responsive/mobile | Data was unreachable from the mobile header; collection controls and unbroken search text overflowed; forms required excessive space. | Visible Search/Data utilities, wrapping management rows/results, single-column collections, readable form sizes, and reduced reader chrome work at 320px through wide desktop and 200% text. |
| Offline/PWA | A version-only cache mixed different 1.0.0 builds; early cleanup could remove chunks needed by old tabs or a pending update. | Content-derived build cache identities, scoped cached shells, atomic failed-install cleanup, retained old lazy assets, and installing/waiting-update guards keep updates coherent. Activation remains deliberate. |
| Performance | Calendar and Moments loaded unnecessary full activity arrays. | Indexed month queries and an indexed newest-200 Moments query reduce work. A 1,000-prayer/5,000-event browser fixture verifies list, search, and History responsiveness. Existing route splitting remains. |
| Privacy/security | Deleted devotional text could resurface in History; import parsing lacked structural and size limits; return links accepted protocol-relative destinations. | Removed content no longer reappears through History. Restore rejects oversized/duplicate/malformed archive contents. Return links remain within the application. CSP, no-referrer, local-only storage, and Web Crypto encryption remain intact. |
| Build/release | Deeply nested npm gates exceeded Windows environment limits; static assertions depended on obsolete wording/implementation. | A sequential certification runner preserves every gate. Assertions now verify the scheduling mode, scoped cache behavior, and the runner’s complete gate list. The generated Scripture bounds are checked against the pinned corpus. |

## Regression coverage

- **96 unit/integration tests in 21 files**: 24 added to the original 72. New coverage includes malformed-but-checksum-valid restores, all critical relationships through encrypted fresh-database recovery, concurrent writes during validation, stale edits, repeated completion, session atomicity, archive restoration, deleted History privacy, and six service-worker lifecycle cases.
- **43 Playwright tests**: desktop Chromium, touch/mobile Chromium, and real service-worker/offline projects. Includes complete devotional journeys; cancelled navigation/reload; stale two-tab edits; annotations; prayer lifecycle/scheduling/resume; collections; exact reference search/browser history; fresh-profile encrypted restore; wrong password/corruption/cancel/merge; route recovery; long content; large archives; axe/keyboard; responsive and visual capture; interrupted updates; old-tab lazy chunks; and cold offline reads/writes.
- The visual capture suite records **129 screenshots** covering empty/populated major surfaces, light/dark/system themes, 1440×900, 1920×1080, 768×1024, 1024×768, 320×568, 360×800, 390×844, 430×932, 844×390, 200% text, and representative Scripture forms.
- Existing 320px/200% checks now run in both desktop and mobile projects; there are no intentionally skipped test cases.
- The interrupted-update fixture publishes its replacement build before restoring connectivity, because the app legitimately checks for updates on the online event. Awaiting reload completion avoids testing the old DOM. These corrections preserve the intended failure and old-tab assertions.

## Walkthrough and interaction cost

| Step | Surface/journey | Result |
| --- | --- | --- |
| 1 | Today: first run, calendar/self-paced enrollment, plan and completion | Healthy; a reading opens in one click, with explicit completion and return context. |
| 2 | Bible: prose, poetry, superscriptions, red-letter content, long/short chapters, boundaries, selected verses | Healthy; select a verse then Highlight/Bookmark in two actions; Scripture remains readable across themes. |
| 3 | Reflection and verse notes: create, edit, save, leave, reload, stale second editor | Healthy; reflection handoff is verse → Reflect → Save; unsaved work is guarded. |
| 4 | Prayer: quick capture, metadata, schedules, updates, waiting/answered/archive/restore | Healthy; quick capture requires body and Save, with optional details kept secondary. |
| 5 | Focused prayer: begin, act, skip, exit, reload, resume | Healthy; one session choice starts prayer and each “Prayed · Next” records an explicit action. |
| 6 | History: calendar/day/Moments and reopened sources | Healthy; factual activity remains automatic and deleted text stays removed. |
| 7 | Search: references, text, personal content, filters, back/forward, long results | Healthy; result groups contain matches and exact references reopen the verse. |
| 8 | Collections: create, add, duplicate, rename, remove, delete | Healthy; management is reachable and narrow layouts wrap. |
| 9 | Data: plain/encrypted backup, preview, cancel, corrupt/wrong-password restore, merge/replace and fresh recovery | Healthy; rejected restores preserve live records and replace requires explicit confirmation. |
| 10 | Navigation/accessibility: desktop rail, mobile utilities/bottom navigation, keyboard, recovery | Healthy in exercised Chromium environments; no known blocking overflow or automated axe failures. |
| 11 | Offline/update: complete cache, cold start, read/search/write/History, interrupted install and old tabs | Healthy under automated complete-network-disconnection and update fixtures. |

## Verification and release evidence

Required commands are `npm ci`, `npm run audit:prod`, and `npm run verify:phase12`. The cumulative gate includes independent Phase 0, TypeScript, all unit/browser tests, production build, phases 2–11, release packaging, archive reopening and SHA-256 integrity. Both GitHub Actions workflows must pass on the exact final main commit. The authoritative release manifest records that commit and archive checksum; consult the successful main workflow artifact rather than a pre-commit local package.

## Evidence limits

Testing uses real Chromium and touch/mobile emulation on Windows plus Linux CI. It does not certify physical iOS/Safari keyboard, browser-toolbar, install-prompt, or assistive-technology behavior. Browser storage remains device/profile-local and can be cleared by the browser or user; encrypted backups remain the recovery mechanism. People/category assignment retains the existing single-primary-person/category model. Import limits are 64 MiB compressed and 128 MiB expanded. No known release-blocking defect remains in the exercised scope.
