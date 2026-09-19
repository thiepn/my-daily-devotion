# My Daily Devotion — Morning Grace Editorial

## Phase 1 — Design Language

Status: **implemented on redesign branch**

Selected direction: **Concept 11 — Morning Grace Editorial**

Phase 1 establishes the design language that all later MDD redesign work must inherit. It is intentionally a foundation pass rather than a screen-by-screen redesign.

## Product character

Morning Grace Editorial is a warm, Scripture-first devotional experience shaped by morning light, natural imagery, thoughtful typography and quiet interaction.

It should feel closer to a beautifully designed devotional journal and printed Bible than to a SaaS dashboard, productivity system, chat application or church administration tool.

The permanent identity principles are:

- Scripture readability before decoration.
- Editorial composition before card grids.
- Warm paper and restrained natural color before bright application chrome.
- Personal devotional language before productivity jargon.
- Natural imagery and botanical details used sparingly.
- Quiet controls with progressive disclosure.
- Clear functional state without gamification.
- Light and dark themes authored as the same product.

## Foundation implemented in Phase 1

### Color

The foundation is warm ivory paper, olive-charcoal ink and muted sage.

Domain accents are deliberately limited:

- Today — morning gold plus sage.
- Bible — sage.
- Reflection — muted teal.
- Prayer — terracotta.
- History — deep sage.

Neutral surfaces remain dominant. Accent color must not become the background of every card.

### Typography

Three semantic typography roles are implemented:

1. **Display serif** for major headings and devotional emphasis.
2. **Reading serif** for Scripture, reflections, prayer text and long-form history.
3. **UI sans** for navigation, controls, labels and metadata.

The application remains fully offline and therefore does not introduce a remote font request in Phase 1. The stacks prefer suitable local faces and retain robust system fallbacks. Exact bundled brand fonts may be evaluated in the later brand-assets phase.

### Shape and surfaces

The radius system is 4 / 8 / 12 / 18 px.

Separation should come from spacing, typography and fine rules before containers. Soft elevation is permitted only where it clarifies functional hierarchy. Glassmorphism, glow effects and excessive pills remain prohibited.

### Navigation

Mobile retains fixed bottom navigation for Today, Bible, Prayer and History.

Desktop retains a slim editorial rail. The rail and utility chrome have been rephrased away from generic workspace/SaaS language.

### Reading

Scripture uses the dedicated reading-serif role and a constrained reading measure. Highlight colors use restrained sage and warm-gold values rather than fluorescent application colors.

### Controls

Primary actions use deep sage, with domain-specific terracotta or teal permitted where context benefits from it. Controls use deliberate moderate radii rather than universal pills.

### Dark mode

Dark mode uses olive-charcoal surfaces, warm cream text and softened natural accents. It is not a simple light-theme inversion.

## Explicit anti-generic guardrails

The following patterns are prohibited:

- generic AI/SaaS composition;
- endless card grids;
- giant rounded cards;
- decorative gradients;
- glassmorphism;
- purple AI palettes;
- pill controls everywhere;
- floating toolbars everywhere;
- analytics dashboards as the main History experience;
- streaks, achievements or spiritual scoring;
- emoji-based interface graphics;
- oversized mobile hero typography.

## Phase boundary

Phase 1 does **not** finalize:

- the app mark;
- the complete icon set;
- landscape illustrations;
- botanical assets;
- the final Today, Bible, Prayer and History compositions;
- tablet/desktop canonical screen layouts.

Those require visual source material and belong to subsequent redesign phases.

The existing MDD database, Scripture content, M’Cheyne engine, prayer engine, history model, backup format and local data semantics are unchanged.

## Source of truth

The machine-readable contract is:

`canonical/morning-grace-design-language.v1.json`

The final stylesheet layer is:

`src/styles/morning-grace.css`

The verification gate is:

`scripts/verify-morning-grace-phase1.mjs`

Later screen work must follow this contract rather than the older quiet-editorial prototype language.
