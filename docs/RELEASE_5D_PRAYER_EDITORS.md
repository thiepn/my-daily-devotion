# Durable editor integration — Prayer writing and settings

This review slice stacks on Verse notes, PR #33. It covers wording, updates, encouragement, ordinary answer notes and Prayer Settings. Batch B and release 1.4.0 remain incomplete: Focused Prayer answers, collection writing and People/Categories still need integration. No merge, deployment or cloud connection is performed.

## Recovery and explicit saves

Material changes use the existing editor-owned controller, serialized writer, 500 ms debounce and two-second maximum. Opening pristine editors, empty answer notes, recovery offers and contextual Scripture remains write-free. Draft protection has its own status, independent from saving the prayer. Private-storage failure retains input with Retry and copy guidance; it does not manufacture a saved record.

Recovery compares the kept writing before explicitly forking into a new owned ID. Original nested return URLs, request baselines and raw settings survive restart. Missing, deleted, answered, archived and previous-journal targets remain copyable rather than being recreated. Session answer drafts are deliberately unavailable for ordinary Detail recovery until their identified-session adapter ships.

Wording, update/encouragement, answer and settings adapters join their actual existing transaction tables with private draft retirement. They return the committed record directly. Failed optional refresh does not repeat an action. Newer wording/settings remains editable against the committed baseline; newer update/answer writing is kept for copying and cannot record another action. Protected fields and submission locks prevent duplicate submissions; tests also simulate queued input arriving during commitment.

Switching Update/Encouragement retains the text. An acknowledged draft transfers atomically into a new kind/owned ID without devotional writes; failure preserves its previous acknowledged owner. Only an explicit save records the selected action. Unchanged effective wording/settings performs no domain write.

## Settings compatibility

Physical database schema remains 2; domain contract and ordinary portable backup format/schema remain 1. Original indexes, stored domain shapes, prayer lifecycle, queue ordering and event types are unchanged.

Private prayer-settings payloads accept an optional, strictly validated `baselineAdministration`. New editors include it so the complete raw baseline survives even when no schedule record exists. Legacy payloads remain readable and require current-record comparison when their missing baseline cannot be reconstructed. Older strict clients leave this extended private shape unavailable rather than applying it. This is not a database migration or portable-backup change. Incomplete numeric/date inputs and hidden schedule fields remain raw draft values; explicit domain saves still enforce existing validation.

## Visual review and verification

The existing warm journal composition, request typography, botanical accent and shell remain. Update tabs and editor/save actions wrap at narrow widths and enlarged text instead of clipping. An independently checked strong terracotta token fixes the answer timeline label's contrast on its tinted surface in both themes.

New deterministic comparisons cover six widths, dark, 200% text, long writing, recovery comparison, incomplete settings, conflicts, persistence failures and discard dialogs. Existing Detail, Settings and Focused Prayer comparisons remain in the gate. Synthetic fixture IDs are valid UUIDs; this does not rewrite production records.

The draft PR records exact-commit unit, browser, image and artifact evidence after certification. Early supporting runs exposed old asynchronous-discard selectors and tests that attempted to type into protected fields. Corrected tests await completed retirement, assert protected controls, and simulate genuinely queued input; no coverage, contrast threshold or image tolerance is removed.

Manual review retains the approved family. Recovery adds disclosed content and therefore extends page length. Physical-phone keyboards/IME, independent screen-reader review and usability rounds remain outstanding human/device gates. Passing automated comparisons is not final visual certification.
