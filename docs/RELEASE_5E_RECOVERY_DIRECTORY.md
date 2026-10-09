# Recovery directory — bounded delivery

Dependency: durable-draft editor controller and Reflection in draft PR #29, commit e6e1144. This is a directory slice, not completion of all 5D/5E editors. Database schema 2, domain contract 1, ordinary backup format/schema 1 remain unchanged.

## Delivered behavior

- `/recovery` lists metadata without private excerpts, twenty entries at a time. `/recovery/:draftId` reads private writing only after selection. Directory pagination, return context, scroll and originating focus are retained.
- Your data links to Recovery. All fifteen foundation payload types have copyable labeled fields when readable. Removed/read-only, previous-journal and already-recorded actions cannot be attached or repeated automatically. Unsupported/corrupt payloads remain stored with an unavailable explanation.
- Reflection has an explicit editor handoff: the kept draft opens in a comparison dialog, without a fork or domain write until Recover is chosen. Its original devotional date, baseline, pending Scripture and return context remain authoritative. Other editors await separate integrations and currently offer copying only.
- Discard uses the generation reviewed when confirmation opened. Newer writing causes a conflict rather than being erased. Saved journal records and backups are unaffected. Existing writer generation checks prevent late queued checkpoints from reopening a retired draft.
- Read-only foreground/database refresh ignores stale route results; a failed refresh retains already-open writing. Saved-target availability is optional and cannot erase usable recovery content.
- Shared journal typography, paper surfaces, botanical ornament and dialog controls extend the existing composition. No new artwork, accounts or persistent stores.

## Verification and limitations

Read-model tests cover privacy, safe returns/pagination, zero writes, removed records, previous journals, already-recorded actions and generation conflicts. Browser tests cover paging beyond forty, exact focus restoration, explicit fork/save, discard, failed refresh, stale confirmation, copying and enlarged dark presentation. Twelve image cases cover six widths, writing, dark, 200% text, empty, confirmation and failure.

Exact-commit full certification belongs in the draft PR. Supporting runs and new-baseline capture do not substitute for final comparison assertions. Manual review corrected missing mobile journal margins and a duplicated shell heading. Human screen-reader, physical-device interruption and usability review remain pending. Ordinary backups do not contain these drafts; recovery is not an external backup or a guarantee against browser eviction.

Next: reader and prayer editors, then Collections/People/Categories, using the same serialized controller and operation-specific atomic adapters. Do not label 1.4.0 complete until all supported editors pass acknowledged-draft restart and failure tests.
