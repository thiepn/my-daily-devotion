# Reflection and prayer capture — review record

The approved implementation scope is the two writing screens, explicit save-and-continue, and their navigation safeguards. The canonical board supplies the visual family; it does not contain either of these screens. This is not a claim of pixel equivalence to an absent secondary-screen mockup.

## Visual evidence

- Source: user-supplied `codex-clipboard-2deba43d-e2cc-4602-9e09-3d9c1ddf8c87.png`, 1448 × 1086. Only application content is considered.
- [Before and after](writing/writing-comparison.png): 390px mobile captures resized proportionally to 300px columns; the top 760 output pixels are shown. Before captures use the host's locale; deterministic new baselines use en-US.
- [Visual-family comparison](writing/writing-visual-family.png): canonical Today application crop (298 × 644, resized to 390 × 844) beside new populated Reflection and Add Prayer captures at 390 × 844, device scale factor 1.
- Full-resolution candidates: `tests/visual/baselines/writing-*.png`. Six widths: 320, 360, 390, 430, 768, 1440. Additional empty, dark, enlarged, long, expanded source, preview, details, conflict, dialog and failure states.

## Review and corrections

1. The initial mobile render lost Back because legacy stacked-navigation CSS forced every in-content back link to be hidden. Restricting that legacy selector to unmigrated screens restored the contextual link. New captures show one visible heading and one usable Back action.
2. The original plain editor was dominated by always-visible toolbar buttons and technical source furniture. The new writing surface is first, with collapsed formatting/prompts and a readable preview; linked Scripture remains above the writing surface.
3. Keyboard review found initial dialog focus inconsistent. The dialog explicitly focuses Keep editing after becoming modal. Safari formatting review found the selection could be lost when toolbar focus moved; capturing it on blur preserves the selected words.
4. Enlargement review retained native textarea scrolling and increased prayer textarea height in rems so 200% text receives additional writing space.
5. The backup warning originally started with “Saved on this device” even in an unsaved editor. Final copy describes the explicit save requirement instead.

## Fidelity surfaces

- **Typography:** bundled Caslon display and writing text, Inter metadata, strong single editorial heading. Raw Markdown is intentionally visible in Write; Preview renders the supported formatting. Controls do not imitate a word processor ribbon.
- **Spacing:** 760px maximum column; 18px mobile gutters (12px at 320px); warm editor surface, quiet source disclosure, actions in document flow. Long passages and 200% text extend naturally.
- **Colors:** existing cream/forest/sage palette and terracotta prayer accent; existing warm dark tokens. No color inversion or new theme model.
- **Artwork:** locally bundled olive sprig remains visible at every tested width. No new or temporary assets. A landscape hero would displace writing and is deliberately excluded by this release's approved plan.
- **Content:** real dated reflection and source references, bundled BSB text, factual save states. Screenshot writing is deterministic test data only.

Full-frame comparisons establish hierarchy and atmosphere. Full-resolution source, dialog, and enlarged captures provide the focused control/text review; no extra crop is needed to read these areas.

## Boundaries and remaining differences

- These screens inherit the visual family but prioritize writing; they are less image-rich than the four reference overview screens.
- The Reflection-to-prayer action can appear below the first viewport when Scripture context or long writing is present.
- Dark mode uses the existing low-light treatment of the olive sprig; bespoke evening artwork remains later work.
- Unsaved drafts are memory-only. No termination recovery, autosave, schema migration or new History semantics are claimed.
- Browser keyboard/accessibility checks do not substitute for physical-device keyboard or human screen-reader certification.

No actionable visual P0/P1/P2 finding remains in the inspected candidates. Functional certification is a separate release gate, recorded against the release commit rather than inferred from these images.

final result: passed

## Implementation and compatibility

`writing.css` owns both screen compositions. 141 superseded Reflection/capture selectors were removed; shared legacy styling remains for unmigrated workflows.

Shared writing primitives provide safe Markdown preview, modal navigation decisions and optional Scripture loading. HTML and remote images are excluded from preview. react-markdown is pinned; generated third-party notices include its dependency tree.

Capture reads existing people/categories without seeding metadata merely by opening the editor. Existing category management retains its default-category initialization. The initial capture defaults remain no person, no category and normal rotation.

Reflection saves return committed links from the same transaction, avoiding a misleading post-commit refresh failure. Optional source-revision validation guards prayer capture without changing stored records. Schema, database version, backup format, prayer queue and explicit completion semantics remain unchanged.

Branch dependency: this release is stacked on the unmerged History branch `codex/morning-grace-v2-history` (PR #16). Do not merge or deploy automatically.
