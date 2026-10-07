# Durable editor integration — Prayer capture slice

This bounded change builds on the Reflection controller and Recovery directory (PRs #29–#30). It does not complete all Batch B editors or release 1.4.0. Physical database schema remains 2; original domain contract and ordinary portable backup format/schema remain 1. No merge, deployment or cloud connection.

## Behavior

Material request/settings changes use the shared 500 ms debounce and two-second maximum. Pristine capture, focus, disclosures and optional Scripture loading remain write-free. Private drafts preserve raw incomplete settings, hidden conditional fields, complete BSB ranges, source revision or unresolved source, frozen source date and original return context.

Recovery offers metadata only until an explicit Review. The shared dialog compares writing first, with source/settings under disclosures; adoption forks to an editor-owned ID. Changed or unresolved reflections require explicit review or omission before a save. Previous-journal and already-recorded leftover writing remain copyable without automatic attachment or replay. `/recovery/:id` hands capture drafts to that review rather than creating prayers.

Explicit creation commits prayer, relationships, schedule, existing event and draft retirement atomically. The screen receives the committed prayer directly. A failed private checkpoint does not block a valid explicit save; a failed domain save retains writing. Standalone requests retain the existing null source-date behavior. Newer queued input during commitment remains durable, copyable and unsaved; it cannot create another request. Discard waits for retirement before navigation.

The controller now preserves asynchronously resolved navigation context and prevents a slow recovery fork from replacing newer typing. Both cases have unit coverage. No saved record, History event, queue eligibility or session is created by recovery.

## Private compatibility

The format-1 capture payload accepts an optional `sourceRequest` containing a validated reflection ID or null when the original source could not be resolved. Legacy payloads remain readable. Older clients with strict payload validation cannot adopt this extension; they leave it untouched until a compatible client reads it. It is excluded from ordinary portable backups. No domain field or index changes.

## Verification and limitations

Supporting checks cover reload recovery, incomplete hidden details, full ranges, midnight, original returns, changed sources, storage failure, duplicate commitment and queued input. Capture images cover six widths, dark, enlarged text, review/details and storage failure. Initial parallel supporting runs collided in Playwright output/server ownership; runs were repeated with separate ports/output directories. These harness failures are not presented as application failures or successful certification.

Full exact-commit local/hosted certification and artifact hashes belong in the draft PR after completion. Physical-phone keyboard/interruption and independent screen-reader/usability review remain outstanding. Recovery adds vertical space only when kept writing exists; it does not change the approved artwork or primary-screen design.

## Remaining editor integration

Bible notes, prayer wording/updates/encouragement/answers/settings, Focused Prayer answers, collections and People/Categories still require their own durable integration and verification. Schema-3 saved versions/removal recovery awaits the separate owner-reviewed specification. No recovery release is declared complete from this slice alone.
