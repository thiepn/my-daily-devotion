# Durable recovery foundation — slice 5C

Stacked on portable-boundary PR #27 (`4adc244`). Implements the owner-approved storage foundation; no merge or deployment is automatic. **Editors still keep unsaved writing in memory.** This release does not promise termination recovery until the editor integration ships.

## Delivered behavior

- Unchanged v1 domain schema plus three additive v2 recovery stores, initialized atomically for fresh installations and upgrades. Domain contract and portable format/schema stay v1. Historical source gates now check the approved registry and an exact hash of the original v1 schema declaration.
- Typed private payloads for all fifteen editor kinds, including incomplete raw scheduling values, frozen dates, full Scripture ranges, baselines, and return context. Runtime shape/identity checks reject unsafe routes, unknown formats and mismatched generations without deleting unavailable writing.
- Metadata-only directory pages, readonly review, explicit recovery forks, monotonic checkpoints, and expected-generation discard. One writer per editor serializes acknowledgments and puts discard after pending writes. A late writer cannot update a retired or missing ID.
- Atomic `saveWithDraft` contract with explicit table closure, validation, durable operation marker, generation-bound source retirement, post-commit checkpoint and acknowledgment. First adapters exercise reflection saves and prayer creation, wording, updates, encouragement and ordinary answers. Duplicate requests return the recorded result; marker-write failures roll back domain changes/events. Newer writing and independently edited source/sibling drafts survive.
- Both restore paths preserve private contents. Replace rotates the journal epoch atomically; merge retains it. Confirmation binds the domain snapshot and epoch from one readonly transaction. Draft-only changes do not invalidate review; domain/epoch changes do. Old-epoch drafts remain readable and copyable, but cannot checkpoint, fork or save without explicit future review/rebinding.
- Blocked upgrades have a recoverable opening screen. Version changes close the old connection without reloading or replacing editor text. Unsupported versions produce update guidance instead of reset. Service-worker activation waits while existing writing guards or restore commitment protect the page.

## Verification and limitations

Tests cover fresh/upgrade/aborted migration, original-row preservation, lower-version IndexedDB rejection, all payload kinds, 10,000 metadata rows without body reads, stale/discard races, exact event counts, duplicate submissions, rollback, newer writing, recovery lineage, epoch-bound restoration and optional/private export boundaries. Real Chromium, Firefox, WebKit and mobile journeys cover blocked old tabs, in-memory writing during upgrade and protected service-worker controls.

Candidate images cover the new blocked state at 320, 390 and 1440px in light/dark, plus 200% text. Only the Advanced schema label intentionally changes an existing baseline. The canonical screens and artwork receive their existing comparisons; this storage release introduces no visual redesign.

Final exact-commit certification and PR evidence are recorded separately after execution. Passing storage tests is not a claim that the writing journey is now durable. Human screen-reader/usability rounds and physical-device interruption checks remain outstanding.

## Next bounded slice: 5D

Connect Reflection, reader notes and prayer capture/detail/settings/session editors to the serialized repository. Add 500 ms debounce / 2 s maximum, honest recovery status and failure handling, explicit recovery offers, target/conflict comparison, safe post-save rebasing and copy-only leftover answer/update text. Use the existing session transaction for session answers; the ordinary-answer adapter explicitly refuses them. Extend adapters for notes/settings and preserve every navigation guard, frozen date, range, revision and explicit event.

Collection/metadata editor wiring and the Recovery journal follow in 5E. No accounts, sync, saved-version retention, removal recovery, or recovery backup extension is introduced here. Ordinary backups intentionally omit unfinished drafts.
