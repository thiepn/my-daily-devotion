# Morning Grace artwork system

`MorningGraceArtwork` owns decorative image rendering; `components.css` owns crop variants; `today.css` owns the Today composition. Assets are imported through Vite, bundled locally and included in the existing manifest-based service-worker precache. There are no runtime image or font requests to external services.

| Bundled asset | Dimensions | Role |
| --- | --- | --- |
| `src/assets/morning-grace/dawn.webp` | 1200 × 800 | Final light Today illustration: ivory/peach dawn, layered sage mountains, detailed botanical foreground |
| `src/assets/morning-grace/olive-sprig.webp` | 480 × 505, alpha | Reusable editorial botanical ornament |

Both images were originally generated for this task using OpenAI image generation. No third-party stock artwork was copied or downloaded, and neither asset contains text. Generation prompts and editing provenance are recorded beside this file. The softened landscape supersedes the original more golden candidate; the original prompt remains as provenance.

The `morning` variant is used on Today. `context` and `reflection` provide art-band crop architecture for future Bible/History work; they currently reuse the dawn image and are not final contextual art for those screens. `botanical` uses the transparent sprig. Decorative images use empty alt text and `aria-hidden`; Scripture, labels and controls remain live HTML.

Local Libre Caslon Text (Fontsource 5.3.0) uses the SIL Open Font License. Phosphor React 2.1.10 supplies consistent semantic devotional/navigation icons under MIT. The normal third-party notice generator includes both packages. See the upstream licenses in the installed packages and generated release notices.

The Today light illustration is a finished asset for this implementation, not a placeholder requiring external generation. Dark presentation currently uses low opacity over a warm olive-charcoal surface, without filter inversion. A separately art-directed evening illustration and final Bible/History contextual images remain work for later phases.

The SVG `MorningGraceMotifs` component remains only for unreconstructed screens. Do not use those old geometric landscapes for new canonical screen rebuilds.
