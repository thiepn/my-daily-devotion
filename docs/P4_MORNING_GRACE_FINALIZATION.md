# P4 — Morning Grace visual and interaction finalization

**Scope:** preserve the user-supplied four-phone Morning Grace authority (Today, Bible, Prayer, History), not introduce a dashboard or generic design kit. Historical source crops and existing visual comparisons remain the reference. **This phase is a scoped correction and verification PR, not an assertion of pixel-perfect approval or physical-device certification.**

## Inspected

- Canonical visual authority and retained reference crops, Today/Prayer/History/writing/Focused Prayer/Data design QA, single-layered stylesheet imports and Morning Grace semantic tokens.
- Current shell, text scaling, mobile stacked navigation, modal primitives, calendar accessibility, offline/responsive tests, and existing Windows visual inventory.
- Current GitHub certification for P0–P3. Those runs are not green: the P0 source checklist omitted an exact-release policy phrase required by `verify-phase12`; additional issues remain on the P1 visual, P2 verification and P3 TypeScript checks. **No production ship is inferred from this phase.**

## Focused corrections

| Surface | Observed implementation weakness | Change |
|---|---|---|
| Journal confirmations | Shared `JournalDialog` hard-coded a title ID, which can collide when separate dialogs are mounted | Use per-instance React `useId` to keep the named-dialog relationship unique without altering layout |
| Short phone/large type dialogs | The shared dialog had a fixed 24px inset and no native safe-area-height subtraction; labels/actions could grow beyond the short viewport | Account for visual safe-area height, contain scrolling, allow unbroken button text and reduce only the mobile dialog inset |
| Journal headings | Long titles/subtitles had no intrinsic word-break fallback on narrow/enlarged compositions | Add word wrapping without truncation or changing source typography |
| History calendar | A noninteractive day used `aria-label` on a bare span, which may not expose its full date/empty state to assistive technologies | Provide visually hidden complete date text while keeping the visible day numeral and current illustration |
| Calendar focus | Distinct month buttons and compressed date-list links needed explicit focus rings | Add stateful visible outline using the existing forest focus token; no artificial backgrounds or cards |
| Certification contract | P0 documentation accidentally removed the source rule demanded by release hardening | Restore the exact-commit release policy **as a substantive statement**, not by deleting the assertion |

No Scripture content, journal DB schema, saved records, portable backup format, prayer actions, tokens, artwork, app version or origin is modified.

## Automated new P4 checks

- At 320px and 200% text, a saved reflection can be found in the calendar's single-column alternative, visited, and accessed with no horizontal clipping or automated WCAG violations.
- At 390px, noninteractive calendar dates provide explicit accessible date/no-history text while the seven-column grid remains the visual presentation.
- At 320px and 200% root text, a journal confirmation is named, remains within the short viewport, and its Keep editing action preserves unsaved writing.
- The canonical four destinations retain exactly one visible primary navigation at 360, 390, 768 and 1440 CSS pixels without horizontal overflow.

## Unverified / next gates

- CI must pass unit/build, all browser shards, Windows comparisons and the exact-artifact aggregator for this PR head and, after merge, for the new main SHA. **Do not update screenshot baselines without examining rendered deltas.**
- Compare actual normal/200% layouts on 320/360/390/430/768/1440, light/dark, portrait/landscape and real long journal text against the retained Morning Grace references.
- Complete human screen-reader focus-flow and physical Android keyboard and safe-area checks separately. Browser emulation is not a physical-device certificate.
- P1 migration testing, P2 deploy gates and P3 code/test remediation remain separate until their own CI results pass. No deployment or release publication is part of P4.

**P5 next:** Optional recovery-inclusive archive format 2; its contents and user consent require a separate approved privacy/data contract.
