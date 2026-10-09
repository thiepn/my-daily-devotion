# P7 — Accessibility and performance qualification

**Branch-only implementation (2026-10-09).** Preserve the Morning Grace editorial artwork, colors and established visual baselines. P7 does **not** authorize a merge, production deployment or approval of human/device-only accessibility.

## Observed source issues and corrections

| Area | Source audit | P7 correction |
| --- | --- | --- |
| Bible-reader CPU work | Each rendered verse parsed/scanned all saved highlight, bookmark and note ranges on every selection/status/toolbar rerender. Long Psalm chapters and dense annotation collections amplified work. | Memoized chapter-local verse-coverage sets; each affected verse now does constant-time membership lookup. Existing cross-chapter and same-book semantics preserved. A unit test compares the index to the pre-existing canonical range predicate over overlapping/reversed/cross-book ranges and 1,200 saved ranges. |
| Browser loading announcements | The Bible reader had two asynchronous loading paragraphs without explicit status semantics after lazy route load. | Make both rendered loading states role=status. No extra journal writing or tracking. |
| Modal trigger state | Bible book/chapter and reading-appearance buttons opened labeled dialogs but did not advertise expanded state. | Add controlled aria-expanded to both buttons; preserve native dialog Escape, focus trapping and trigger-return behavior. |
| Release governance | Exact-commit release checklist text was lost in P0 docs. | Restore substantive exact-commit qualification wording without weakening existing certification assertions. |

## Automated matrix

- Screen-reader simulation/axe WCAG 2.0/2.1/2.2 A/AA across Today, Bible, Prayer and History in light/dark at 390 CSS px; normal empty-state screens retain existing separate accessibility tests.
- Bible modal keyboard operation: triggers report expanded/collapsed, focus starts at the dialog selector, Escape returns focus, dialogs have unique accessible headings.
- Reflow: all six primary/utility routes at 320 CSS px and 200% root text, no root/body horizontal clipping.
- Reduced motion: Today, Bible, Prayer, History and Data surfaces at mobile size have no computed animation/transition durations greater than 1 ms.
- Psalm 119 full long-chapter stress: verify 176 verse selection buttons, last verse accessible, no unbounded DOM growth (<12k elements), single resource <12 MiB encoded, combined loaded resource bytes <35 MiB; annotate a verse and preserve keyboard semantics.
- Resource test attaches only **nonpersonal** aggregate size/count/navigation/heap metrics. Avoid publishing Scripture content, notes, journals, IndexedDB records, user identifiers or keys as test artifacts.
- Run the new P7 spec on Chromium desktop, Chromium mobile, desktop Firefox and desktop WebKit; existing standalone PWA/Windows screenshot/visual and full Vitest certification remain required. Do **not** rebaseline canonical images or lower test thresholds without investigating a real regression.

These are broad guardrail budgets, not a claim of real-phone FPS or a precise laboratory Core Web Vitals measurement. Timing and JS heap readings vary with engine and runner; they are recorded for inspection rather than used as brittle pass/fail values.

## Remaining human/device gates

- Actual Android Chrome and Samsung Internet with a screen reader/TalkBack and keyboard navigation; hardware and on-screen keyboard, 200% text (and system font), landscape, safe areas, browser zoom.
- Keyboard-only route changes, live-region announcements and reader dialogs in Firefox, Chrome and Safari/WebKit with independent human review.
- Accessibility contrast/focus judgment for icons and subtle Morning Grace surfaces that automated axe cannot validate.
- Repeated route switching, long Psalm reading, 10k activity-record History stress, offline/online resume and PWA update under memory pressure; document OS version, device, browser and exact artifact SHA.
- Review current upstream P1–P6 failures/PRs separately. **Do not merge/deploy until exact-integrated-main certification, origin migration/backup drills and P2 owner approval pass.**

**Next phase: P8 — Offline Storage, Backgrounding & Update Resilience**. Objectives: safe restart while offline, durable local-writing checkpoint recovery, service-worker artifact integrity, storage quota/eviction warnings, blocked multi-tab upgrades and physical Android PWA resume tests. Implementation status: not started.
