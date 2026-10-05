# Morning Grace artwork system

`MorningGraceArtwork` owns decorative image rendering; `components.css` owns crop variants; `today.css` owns the Today composition. Assets are imported through Vite, bundled locally and included in the existing manifest-based service-worker precache. There are no runtime image or font requests to external services.

| Bundled asset | Dimensions | Role |
| --- | --- | --- |
| `src/assets/morning-grace/dawn.webp` | 1200 × 800 | Final light Today illustration: ivory/peach dawn, layered sage mountains, detailed botanical foreground |
| `src/assets/morning-grace/olive-sprig.webp` | 480 × 505, alpha | Reusable editorial botanical ornament |
| `src/assets/morning-grace/bible-context.webp` | 1200 × 470 | Dedicated Bible countryside band |
| `src/assets/morning-grace/history-reflection.webp` | 1200 × 500 | Dedicated History reflection band |
| `src/assets/morning-grace/evening-valley.webp` | 1200 × 800 | Evening Today valley |
| `src/assets/morning-grace/evening-context.webp` | 1200 × 470 | Evening Bible countryside |
| `src/assets/morning-grace/evening-reflection.webp` | 1200 × 500 | Evening History reflection band |

The original dawn and botanical assets were generated using OpenAI image generation. Dedicated Bible, History, and evening assets extend that locally bundled collection. No third-party stock artwork was copied or downloaded, and the assets contain no lettering. Generation prompts and editing provenance are recorded with the artwork.

The `morning`, `context`, and `reflection` variants own the dedicated Today, Bible and History scenes. Each selects its authored light/evening asset from the applied appearance, including System changes and restored preferences. They never invert a daytime image. `botanical` uses the approved transparent sprig in both themes. Decorative images use empty alt text and `aria-hidden`; Scripture, labels and controls remain live HTML. [Evening provenance and exact prompts](../../src/assets/morning-grace/EVENING_PROVENANCE.md) record the built-in generation and delivery process.

Local Libre Caslon Text (Fontsource 5.3.0) uses the SIL Open Font License. Phosphor React 2.1.10 supplies consistent semantic devotional/navigation icons under MIT. The normal third-party notice generator includes both packages. See the upstream licenses in the installed packages and generated release notices.

The light and evening scenes are implemented assets rather than placeholders requiring external generation. Dark compositions use deliberate shading over warm olive-charcoal surfaces and retain visible artwork. Rendered comparisons are recorded in the Release 4 report; participant review remains outstanding.

The unused geometric `MorningGraceMotifs` component and demonstration screens have been removed.

