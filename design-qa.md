# Morning Grace V2 — Today visual QA

Scope: the new shared foundation and Today light-mode composition. This is an implementation review against the supplied image, not user approval of the four-screen redesign. Bible, Prayer, History, secondary workflows and final dark art remain outside this acceptance gate.

## Source, rendered evidence and normalization

- Visual truth: user attachment `C:/Users/junso/AppData/Local/Temp/codex-clipboard-2deba43d-e2cc-4602-9e09-3d9c1ddf8c87.png`, a 1448 × 1086 concept board. Only the first phone's application is compared.
- Source crop: x48–356, y198–892; 308 × 694 source pixels, uniformly resampled to 390 × 879. Saved in `docs/visual/morning-grace-v2/today-reference.png`. A few rounded bottom-corner bezel pixels remain in the crop and are excluded from evaluation. No status bar, phone bezel, board title or poster captions were implemented.
- Implementation: `http://127.0.0.1:4173/#/today`, production build; `docs/visual/morning-grace-v2/today-390-desktop-chromium.png`.
- CSS viewport 390 × 844, deviceScaleFactor 1. Full-page image is 390 × 855 because the page includes scroll padding beneath the fixed navigation. The original mockup has no specified CSS viewport/density, so the source was normalized by its application width; its taller aspect ratio is explicitly retained. This is structural visual comparison, not a pixel-diff score.
- State: light, reduced motion, local date fixed to 2026-04-24 07:00 Europe/Berlin, real calendar enrollment, 0/4 readings complete, collapsed plan, no reflection or prayers. The day is 114 and the live BSB preview is Psalms 35:1. These deliberately differ from the mock's fictional Day 118/Psalm 119:105; no example content was hard-coded into production.
- Full comparison: `docs/visual/morning-grace-v2/today-comparison.png` (800 × 879; source left, implementation right, 20px gap).
- Focused comparisons: `comparison-opening.png` and `comparison-actions.png` in that directory. Both were viewed after the final refinement, in addition to the full comparison.

## Findings and comparison history

1. Baseline — blocked. [P1] Mobile removed all Today scenery and suppressed the personal opening; four reading rows dominated the page. [P1] Primitive geometry could not represent the supplied illustration. [P2] Cascading overrides made composition unpredictable. Fixed by raster artwork, the Today hierarchy and an owned screen layer. Baseline evidence is retained in this task's `outputs/baseline/today-390.png`.
2. First rendered rebuild — blocked. [P1] The opening/verse/response heights pushed the CTA behind the fixed navigation at 390px. [P2] The initial art was too golden. Reduced structural spacing, kept the complete verse, and generated the softer ivory/peach/gray-sage variant. Evidence: task `outputs/iteration1` and `outputs/iteration2` captures.
3. Second comparison — blocked. [P2] The button still extended about 14px into the navigation area. Reduced response-card and section spacing; strengthened the viewport assertion. [P2] Desktop rail metadata failed contrast after the palette change; changed the faint-ink token to #5e625a. Post-fix evidence: task `outputs/iteration3` and final desktop capture.
4. Enlarged-text refinement — passed after recapture. Replaced exact-inline-style text-size selectors with intrinsic auto-fit/minmax card reflow, fluid scenic height and wrapping headings. Preserved the plan identity icon. Kept the profile glyph within its target. Tested at 320px with 200% root text, without overflow or text clipping. The full-page image places the fixed nav at the first viewport's bottom; it is not an in-document separator.
5. Final composition — passed after recapture. Added breathing room above navigation while retaining a scenic area greater than 230px. At 390 × 844 the complete CTA ends above the fixed bar; at 320/360 it remains reachable by scrolling. Final evidence is the versioned `docs/visual/morning-grace-v2` set, compared again side by side.

No actionable P0/P1/P2 finding remains for the scoped Today light screen. The following differences remain explicit:

- [P3, typography/icons] Libre Caslon Text has a somewhat heavier heading than the source; Phosphor line icons are slightly finer. Their family, hierarchy, semantic meaning and active/inactive navigation treatment are coherent. Optical weight tuning can follow user review.
- [P3, art] The finished local illustration has different hills, trees and terrain, with more foreground detail. It reproduces the pale morning, layered mountains, botanical framing and paper-like image treatment, not the precise original drawing. No placeholder geometry is used on Today.
- [Expected, real data] Four M’Cheyne readings can occupy two lines, and full BSB verses vary in length. No text is clipped to force the mock's fictional density. Narrow screens and long readings can require scrolling.
- [Deferred, other screens/dark] Shared typography, tokens and navigation affect other screens, but their compositions remain legacy. Low-light opacity is a preliminary treatment, not final evening artwork or dark visual certification.

## Required fidelity surfaces

| Surface | Rendered assessment |
| --- | --- |
| Fonts/typography | Locally bundled literary serif, bold two-line opening, italic Scripture, subordinate reference, restrained metadata. Complete text reflows. No remote font fallback dependency for display or reading. Small sans UI remains platform-native. |
| Spacing/layout | Full-width scenic opening, overlapping verse card, compact plan, paired response cards, green CTA and four-tab footer match the source's order and visual emphasis. Modest 12px radii, 14–16px gutters and soft shadows. Desktop is an adaptation within the existing rail. |
| Color/tokens | Warm #faf6ee canvas, #fffbf5 paper, forest/sage accents, warm charcoal text and terracotta prayer circle. The CTA uses a restrained natural green light transition. Contrast checks pass. |
| Image quality | 1200 × 800 locally bundled WebP; soft sky, layered terrain and detailed natural foreground; visible at all widths. Decorative masking/cropping does not hide the artwork. No generated text, stock-watermark, transparency halo or primitive landscape substitute. |
| Copy/content | Greeting and prompts follow the reference. Scripture/date/day/references/completion come from existing runtime data. “From today's reading” accurately identifies the live source. Profile routes to Data; no account or daily-verse subsystem. |

## Verification and responsive evidence

- TypeScript passes; 23 unit/integration files, 115 tests pass. Production build passes, verifying all 31,086 BSB verse identities, 365 M’Cheyne assignments and 28 quotation regressions.
- Focused Chromium/offline suite: 48 passed (46 desktop Chromium + 2 offline PWA).
- Mobile Chromium Today/core journeys: 8 passed. Final Today composition/reflow rerun: 10 passed across desktop/mobile Chromium.
- Core devotional journeys: 3 Firefox + 3 WebKit passed. Firefox could not launch in the restricted execution environment; rerunning the same three tests with the permitted browser process environment passed. No application fix was needed.
- Earlier concurrent browser commands shared an output directory and caused two trace-file cleanup errors; the affected seven tests passed when rerun separately. Subsequent runs use distinct output directories. These were not hidden product failures.
- Captures: 390 × 844, 430 × 932, 360 × 800, 320 × 720, 1440 × 900; 320px at 200% text; a 320 × 568 short viewport; preliminary dark screenshot. Mobile DPR 2 captures are also in task outputs. Animations disabled; fonts and image decode awaited.
- Interaction checks: enrollment/import, calendar/self-paced/leap behavior, explicit completion and reload persistence, primary CTA, reflection/prayer routes, keyboard disclosure, ≥44px primary targets, narrow-scroll reachability, focus, no horizontal overflow, axe checks and zero page errors during canonical capture.
- Offline tests verify artwork and local Scripture after a controlled cold start, plus interrupted updates and old-tab lazy assets. Service-worker source is unchanged.

Reproduce the visual gate after `npm run build`:

```sh
npx playwright test tests/ux/morning-grace-v2.spec.ts --project=desktop-chromium --project=mobile-chromium --output=verification/today-v2
```

## Implementation checklist

- [x] Compare the source and rendered UI in one normalized image, including opening and action details.
- [x] Keep substantial artwork on 320/360/390/430px mobile.
- [x] Use live Scripture and all four assigned readings.
- [x] Preserve explicit completion, prayer and reflection routes.
- [x] Verify typography, surfaces, navigation, reflow, interaction and offline availability.
- [x] Preserve database/domain version 1 without migrations or repository changes.
- [ ] User review of Today before the Bible phase.
- [ ] Bible, Prayer, History, secondary screens and separately art-directed dark artwork in later phases.

final result: passed
