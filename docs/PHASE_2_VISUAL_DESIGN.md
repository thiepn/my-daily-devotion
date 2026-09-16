# Phase 2 — Dedicated Visual Design

Status: **implemented**

Phase 2 establishes MDD’s visual identity without adding Scripture ingestion, prayer scheduling, search, PWA caching, cloud features, or other product functionality.

## Direction

The canonical direction is **quiet editorial reading journal**. MDD should feel closer to a carefully typeset personal reading journal than a SaaS dashboard, church-media product, habit tracker, or generic mobile utility.

## Typography

The system intentionally uses local font stacks so the visual foundation does not depend on a network request. UI uses a restrained system sans stack; Scripture, major headings, reflections, and prayer emphasis use a bookish serif stack led by Palatino-family faces with Georgia fallback.

Typography carries more hierarchy than containers, shadows, or decoration.

## Color

The light theme uses warm paper rather than pure white, charcoal rather than pure black, and one deep forest accent. Answered-prayer moments receive a quiet ochre-brown semantic accent. Dark mode is separately authored rather than produced by simple inversion.

No decorative gradients are part of the system.

## Surfaces and shape

The default structural devices are whitespace, typographic contrast, hairline rules, and occasional paper surfaces. Rounded rectangles are not the universal container. Shadows are absent by default. Larger radii are reserved for true controls rather than content grouping.

## Navigation

Desktop uses a narrow left editorial rail. Mobile uses a fixed bottom navigation for Today, Bible, Prayer, and History. This keeps the primary architecture stable while letting the reading/content area stay visually quiet.

## Screen motifs

- **Today:** reading rows and progress are linear, not dashboard cards. Reflection is represented as a journal page, and prayer as a calm secondary continuation.
- **Bible:** the reader is page-first with narrow measure, generous leading, subdued verse numbers, and minimal action chrome.
- **Prayer:** lists use rules and type hierarchy; Focused Prayer becomes a single strong composition rather than a stack of widgets.
- **History:** chronological editorial timeline rather than charts, streak calendars, or gamified completion heatmaps.

The Phase 2 screens are visual prototypes only. Their sample content is not wired to product data and exists to validate hierarchy, density, type, color, and responsive behavior.

## Theme behavior

System, Light, and Dark can be previewed directly in the shell. Phase 2 does not persist the setting; product preference persistence belongs to a later feature implementation using the existing local data layer.

## Brand mark

The visual mark combines an open-page silhouette with a quiet upward/path gesture. It avoids crosses, praying hands, flames, doves, gradients, and overly literal Bible clip-art. PWA icon production remains a later release/platform task.

## Accessibility and resilience

The visual system includes visible focus states, reduced-motion handling, semantic text contrast, large mobile tap areas, safe-area-aware bottom navigation, and no remote font dependency. Final WCAG validation remains part of the later accessibility and UX phases.

## Guardrails

`canonical/visual-system.v1.json` freezes the direction. `scripts/verify-phase2.mjs` checks the required design artifacts, theme modes, reduced-motion handling, mobile navigation breakpoint, primary navigation labels, local-font-only policy, and absence of gradients/external CSS assets.
